import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type HttpResult = {
  status: number;
  body: string;
  cookies: string;
};

const JAR_PATH = path.join(os.tmpdir(), `ocls-nse-jar-${process.pid}.txt`);

function curlBin(): string {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

/**
 * Node fetch is undici. NSE/Akamai often resets that TLS handshake, so curl
 * remains the last resort after a short undici attempt. Cookies live in memory
 * per host. Curl still writes a jar because the curl binary cannot see the
 * in-memory jar. Concurrency is capped per host.
 */
const HOST_LIMIT = 3;
const slots = new Map<string, number>();
const waiters = new Map<string, Array<() => void>>();
const memoryCookies = new Map<string, string>();
const breaker = new Map<string, { failures: number; openUntil: number }>();

async function withHostSlot<T>(host: string, run: () => Promise<T>): Promise<T> {
  while ((slots.get(host) ?? 0) >= HOST_LIMIT) {
    await new Promise<void>((resolve) => {
      const queue = waiters.get(host) ?? [];
      queue.push(resolve);
      waiters.set(host, queue);
    });
  }
  slots.set(host, (slots.get(host) ?? 0) + 1);
  try {
    return await run();
  } finally {
    slots.set(host, Math.max(0, (slots.get(host) ?? 1) - 1));
    const next = waiters.get(host)?.shift();
    next?.();
  }
}

function noteFailure(host: string) {
  const row = breaker.get(host) ?? { failures: 0, openUntil: 0 };
  row.failures += 1;
  if (row.failures >= 4) row.openUntil = Date.now() + 20_000;
  breaker.set(host, row);
}

function noteSuccess(host: string) {
  breaker.set(host, { failures: 0, openUntil: 0 });
}

export function hostBreaker(host: string): { open: boolean; failures: number } {
  const row = breaker.get(host);
  return { open: Boolean(row && row.openUntil > Date.now()), failures: row?.failures ?? 0 };
}

function execCurl(args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(curlBin(), args, { windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({
        stdout: Buffer.concat(out).toString("utf8"),
        code: code ?? 1,
      });
    });
  });
}

async function fetchOnce(url: string, headers: Record<string, string>, host: string): Promise<HttpResult> {
  const cookie = memoryCookies.get(host);
  const response = await fetch(url, {
    headers: {
      ...headers,
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(5_000),
    redirect: "follow",
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) memoryCookies.set(host, setCookie.split(",").map((part) => part.split(";")[0]).join("; "));
  return { status: response.status, body: await response.text(), cookies: memoryCookies.get(host) ?? "" };
}

/**
 * Undici first. Curl is only the fallback when NSE resets the Node TLS socket.
 */
export async function httpsGet(
  url: string,
  headers: Record<string, string>,
): Promise<HttpResult> {
  const host = new URL(url).host;
  const gate = breaker.get(host);
  if (gate && gate.openUntil > Date.now()) {
    throw new Error(`breaker open for ${host}`);
  }
  return withHostSlot(host, async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const viaFetch = await fetchOnce(url, headers, host);
        if (viaFetch.status === 403 || viaFetch.status === 429 || viaFetch.status >= 500) {
          throw new Error(`HTTP ${viaFetch.status}`);
        }
        if (/Access Denied/i.test(viaFetch.body)) throw new Error("HTTP 403: Access Denied");
        noteSuccess(host);
        return viaFetch;
      } catch (err) {
        lastError = err;
        try {
          const viaCurl = await curlGet(url, headers);
          if (viaCurl.cookies) memoryCookies.set(host, viaCurl.cookies);
          if (viaCurl.status === 429 || viaCurl.status >= 500) throw new Error(`HTTP ${viaCurl.status}`);
          noteSuccess(host);
          return viaCurl;
        } catch (curlErr) {
          lastError = curlErr;
          noteFailure(host);
          const wait = Math.min(4_000, 250 * 2 ** attempt) + Math.floor(Math.random() * 150);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("upstream failed");
  });
}

async function curlGet(url: string, headers: Record<string, string>): Promise<HttpResult> {
  const args = [
    "-sL",
    "--compressed",
    "--max-time",
    "6",
    "-c",
    JAR_PATH,
    "-b",
    JAR_PATH,
    "-w",
    "\n__HTTP_STATUS__:%{http_code}",
    "-A",
    headers["User-Agent"] ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  ];

  const skip = new Set(["user-agent", "cookie", "connection", "accept-encoding", "host"]);
  for (const [k, v] of Object.entries(headers)) {
    if (skip.has(k.toLowerCase())) continue;
    args.push("-H", `${k}: ${v}`);
  }
  args.push(url);

  const { stdout, code } = await execCurl(args);
  if (code !== 0) {
    throw new Error(`curl failed (${code}) for ${url}`);
  }

  const marker = "\n__HTTP_STATUS__:";
  const idx = stdout.lastIndexOf(marker);
  const status = idx >= 0 ? Number(stdout.slice(idx + marker.length).trim()) : 0;
  const body = idx >= 0 ? stdout.slice(0, idx) : stdout;

  let cookies = "";
  try {
    if (fs.existsSync(JAR_PATH)) {
      cookies = fs
        .readFileSync(JAR_PATH, "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split("\t"))
        .filter((p) => p.length >= 7)
        .map((p) => `${p[5]}=${p[6]}`)
        .join("; ");
    }
  } catch {
    /* ignore */
  }

  return {
    status: Number.isFinite(status) ? status : 0,
    body,
    cookies,
  };
}

export async function httpsGetJson<T>(
  url: string,
  headers: Record<string, string>,
): Promise<{ data: T; cookies: string; status: number }> {
  const res = await httpsGet(url, headers);
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status}: ${res.body.slice(0, 180)}`);
  }
  if (/Access Denied/i.test(res.body)) {
    throw new Error("HTTP 403: Access Denied");
  }
  return {
    data: JSON.parse(res.body) as T,
    cookies: res.cookies,
    status: res.status,
  };
}
