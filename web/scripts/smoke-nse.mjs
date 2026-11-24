import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

// Use compiled approach via dynamic import of ts through tsx loader is flaky.
// Re-implement minimal smoke using the same https helper pattern.

import https from "node:https";
import { URL } from "node:url";

function get(url, headers = {}, cookies = "", redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          ...headers,
          Host: u.hostname,
          Connection: "close",
          ...(cookies ? { Cookie: cookies } : {}),
        },
      },
      (res) => {
        let next = cookies;
        for (const raw of res.headers["set-cookie"] || []) {
          const first = raw.split(";")[0];
          const i = first.indexOf("=");
          if (i > 0) {
            const map = new Map(
              next
                .split(";")
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p) => {
                  const j = p.indexOf("=");
                  return [p.slice(0, j), p.slice(j + 1)];
                }),
            );
            map.set(first.slice(0, i), first.slice(i + 1));
            next = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
          }
        }
        if (
          [301, 302, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects > 0
        ) {
          res.resume();
          resolve(
            get(new URL(res.headers.location, url).toString(), headers, next, redirects - 1),
          );
          return;
        }
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            cookies: next,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

const h = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html",
  "Accept-Language": "en-US,en;q=0.9",
};

const t0 = Date.now();
const home = await get("https://www.nseindia.com/option-chain", h);
console.log("home", home.status, Date.now() - t0);
const chain = await get(
  "https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=01-Dec-2026",
  {
    ...h,
    Accept: "application/json",
    Referer: "https://www.nseindia.com/option-chain",
  },
  home.cookies,
);
console.log("chain", chain.status, chain.body.slice(0, 80), Date.now() - t0);
