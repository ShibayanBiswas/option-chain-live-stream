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

let curlGate: Promise<unknown> = Promise.resolve();

function runCurl(args: string[]): Promise<{ stdout: string; code: number }> {
  const run = curlGate.then(() => execCurl(args));
  curlGate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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

/**
 * Reliable exchange GET via system curl (Node fetch/undici gets reset by NSE/Akamai).
 */
export async function httpsGet(
  url: string,
  headers: Record<string, string>,
  _cookies = "",
): Promise<HttpResult> {
  const args = [
    "-sL",
    "--compressed",
    "--max-time",
    "35",
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

  const { stdout, code } = await runCurl(args);
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
  cookies = "",
): Promise<{ data: T; cookies: string; status: number }> {
  const res = await httpsGet(url, headers, cookies);
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
