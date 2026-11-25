/**
 * Compare the desk API with the live NSE and BSE payloads.
 * Run: npm run verify:accuracy
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const JAR = path.join(os.tmpdir(), `ocls-verify-jar-${process.pid}.txt`);
const NSE = "https://www.nseindia.com";
const BSE_WWW = "https://www.bseindia.com";
const BSE_API = "https://api.bseindia.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function num(value) {
  if (value == null || value === "" || value === "-") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function close(a, b, tol = 0.02) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

async function getJson(urlPath) {
  const res = await fetch(`${BASE}${urlPath}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(`${urlPath} -> ${res.status} ${data.error || ""}`);
  return data;
}

function curl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "curl.exe" : "curl", args, { windowsHide: true });
    const out = [];
    const err = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`curl ${code}: ${Buffer.concat(err).toString("utf8").slice(0, 180)}`));
      else resolve(Buffer.concat(out).toString("utf8"));
    });
  });
}

async function prime(url, headers) {
  const args = ["-sL", "--compressed", "--max-time", "40", "-c", JAR, "-b", JAR, "-A", headers["User-Agent"] || UA, "-o", process.platform === "win32" ? "NUL" : "/dev/null"];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "user-agent") continue;
    args.push("-H", `${key}: ${value}`);
  }
  args.push(url);
  await curl(args);
}

async function curlJson(url, headers) {
  const args = ["-sL", "--compressed", "--max-time", "40", "-c", JAR, "-b", JAR, "-w", "\n__HTTP__:%{http_code}", "-A", headers["User-Agent"] || UA];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "user-agent") continue;
    args.push("-H", `${key}: ${value}`);
  }
  args.push(url);
  const stdout = await curl(args);
  const marker = "\n__HTTP__:";
  const idx = stdout.lastIndexOf(marker);
  const status = idx >= 0 ? Number(stdout.slice(idx + marker.length).trim()) : 0;
  const body = idx >= 0 ? stdout.slice(0, idx) : stdout;
  if (status >= 400 || /Access Denied/i.test(body.slice(0, 400))) {
    throw new Error(`HTTP ${status} for ${url}`);
  }
  return JSON.parse(body);
}

function nseHeaders(accept) {
  return {
    "User-Agent": UA,
    Accept: accept,
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${NSE}/option-chain`,
  };
}

async function rawNseChain(symbol, type, expiry) {
  await prime(`${NSE}/option-chain`, nseHeaders("text/html,application/xhtml+xml"));
  const info = await curlJson(`${NSE}/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`, nseHeaders("application/json,text/plain,*/*"));
  const chosen = expiry || info.expiryDates?.[0];
  assert(chosen, `${symbol}: NSE published no expiries`);
  assert(info.expiryDates?.includes(chosen), `${symbol}: ${chosen} is not on the NSE expiry list`);
  const chain = await curlJson(
    `${NSE}/api/option-chain-v3?type=${encodeURIComponent(type)}&symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(chosen)}`,
    nseHeaders("application/json,text/plain,*/*"),
  );
  return { expiry: chosen, chain, published: info.expiryDates ?? [] };
}

async function rawBseChain(scrip, product) {
  await prime(
    `${BSE_WWW}/markets/Derivatives/DeriReports/DeriOptionchain`,
    {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      Referer: `${BSE_WWW}/`,
      Origin: BSE_WWW,
    },
  );
  const expiries = await curlJson(
    `${BSE_API}/BseIndiaAPI/api/ddlExpiry/w?ProductType=${product}&scrip_cd=${scrip}`,
    {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: `${BSE_WWW}/markets/Derivatives/DeriReports/DeriOptionchain`,
      Origin: BSE_WWW,
    },
  );
  const expiry = expiries.Table?.[0]?.eXPIRY;
  assert(expiry, `BSE scrip ${scrip}: no expiry`);
  const chain = await curlJson(
    `${BSE_API}/BseIndiaAPI/api/DerivOptionChain_IV/w?Expiry=${encodeURIComponent(expiry)}&scrip_cd=${scrip}&strprice=0`,
    {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: `${BSE_WWW}/markets/Derivatives/DeriReports/DeriOptionchain`,
      Origin: BSE_WWW,
    },
  );
  return { expiry, chain };
}

function maxPain(rows) {
  let best = rows[0]?.strike ?? null;
  let bestPain = Infinity;
  for (const candidate of rows) {
    let pain = 0;
    for (const row of rows) {
      if (candidate.strike > row.strike) pain += (candidate.strike - row.strike) * (row.ce.oi || 0);
      if (candidate.strike < row.strike) pain += (row.strike - candidate.strike) * (row.pe.oi || 0);
    }
    if (pain < bestPain) {
      bestPain = pain;
      best = candidate.strike;
    }
  }
  return best;
}

function checkBook(snap) {
  assert(Array.isArray(snap.rows) && snap.rows.length > 0, `${snap.symbol}: empty rows`);
  assert(snap.expiries.includes(snap.expiry), `${snap.symbol}: expiry not in the list`);
  assert(!snap.expiries.some((item) => /-\d+d/.test(String(item))), `${snap.symbol}: negative day count leaked`);
  let prev = -Infinity;
  for (const row of snap.rows) {
    assert(row.strike > prev, `${snap.symbol}: strike ${row.strike} out of order`);
    prev = row.strike;
  }
  const ceOi = snap.rows.reduce((sum, row) => sum + (row.ce.oi || 0), 0);
  const peOi = snap.rows.reduce((sum, row) => sum + (row.pe.oi || 0), 0);
  assert(close(ceOi, snap.totals.ceOi, 0.01), `${snap.symbol}: call OI ${snap.totals.ceOi} != ${ceOi}`);
  assert(close(peOi, snap.totals.peOi, 0.01), `${snap.symbol}: put OI ${snap.totals.peOi} != ${peOi}`);
  if (ceOi > 0) assert(close(peOi / ceOi, snap.totals.pcr, 0.0001), `${snap.symbol}: PCR mismatch`);
  const strikes = snap.rows.map((row) => row.strike);
  let atm = strikes[0];
  let dist = Math.abs(atm - snap.spot);
  for (const strike of strikes) {
    const next = Math.abs(strike - snap.spot);
    if (next < dist) {
      atm = strike;
      dist = next;
    }
  }
  assert(snap.totals.atm === atm, `${snap.symbol}: ATM ${snap.totals.atm} != ${atm}`);
  assert(snap.totals.maxPain === maxPain(snap.rows), `${snap.symbol}: max pain mismatch`);
  const atmRow = snap.rows.find((row) => row.strike === atm);
  const ivs = [atmRow?.ce?.iv, atmRow?.pe?.iv].filter((value) => value > 0);
  const atmIv = ivs.length ? ivs.reduce((sum, value) => sum + value, 0) / ivs.length : null;
  return { atm, atmIv, ceOi, peOi };
}

function compareNse(snap, raw) {
  const spot = num(raw.records?.underlyingValue);
  assert(close(snap.spot, spot, 0.05), `${snap.symbol}: spot ${snap.spot} != NSE ${spot}`);
  const sourceRows = raw.filtered?.data?.length ? raw.filtered.data : raw.records?.data ?? [];
  const ours = new Map(snap.rows.map((row) => [row.strike, row]));
  let checked = 0;
  const misses = [];
  for (const row of sourceRows) {
    const strike = num(row.strikePrice ?? row.CE?.strikePrice ?? row.PE?.strikePrice);
    if (strike == null) continue;
    const desk = ours.get(strike);
    if (!desk) {
      misses.push(strike);
      continue;
    }
    const pairs = [
      ["CE last", desk.ce.lastPrice, num(row.CE?.lastPrice)],
      ["CE oi", desk.ce.oi, num(row.CE?.openInterest)],
      ["CE iv", desk.ce.iv, num(row.CE?.impliedVolatility)],
      ["PE last", desk.pe.lastPrice, num(row.PE?.lastPrice)],
      ["PE oi", desk.pe.oi, num(row.PE?.openInterest)],
      ["PE iv", desk.pe.iv, num(row.PE?.impliedVolatility)],
    ];
    for (const [label, deskValue, sourceValue] of pairs) {
      if (!close(deskValue, sourceValue, 0.05)) {
        misses.push(`${strike} ${label} desk=${deskValue} nse=${sourceValue}`);
      }
    }
    checked += 1;
  }
  assert(checked > 0, `${snap.symbol}: NSE payload had no comparable rows`);
  assert(misses.length === 0, `${snap.symbol}: ${misses.slice(0, 6).join("; ")}`);
  return checked;
}

function compareBse(snap, raw) {
  const table = raw.Table ?? [];
  const spot = num(table[0]?.UlaValue);
  assert(close(snap.spot, spot, 0.05), `${snap.symbol}: spot ${snap.spot} != BSE ${spot}`);
  const ours = new Map(snap.rows.map((row) => [row.strike, row]));
  let checked = 0;
  const misses = [];
  for (const row of table) {
    const strike = num(row.Strike_Price1 ?? row.Strike_Price);
    if (strike == null) continue;
    const desk = ours.get(strike);
    if (!desk) {
      misses.push(strike);
      continue;
    }
    const pairs = [
      ["CE last", desk.ce.lastPrice, num(row.C_Last_Trd_Price)],
      ["CE oi", desk.ce.oi, num(row.C_Open_Interest)],
      ["PE last", desk.pe.lastPrice, num(row.Last_Trd_Price)],
      ["PE oi", desk.pe.oi, num(row.Open_Interest)],
    ];
    for (const [label, deskValue, sourceValue] of pairs) {
      if (!close(deskValue, sourceValue, 0.05)) misses.push(`${strike} ${label} desk=${deskValue} bse=${sourceValue}`);
    }
    checked += 1;
  }
  assert(checked > 0, `${snap.symbol}: BSE payload had no rows`);
  assert(misses.length === 0, `${snap.symbol}: ${misses.slice(0, 6).join("; ")}`);
  return checked;
}

async function readStream(symbol, exchange, segment) {
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(
      `${BASE}/api/stream?symbol=${symbol}&exchange=${exchange}&segment=${segment}`,
      { signal: controller.signal },
    );
    assert(res.ok && res.body, `${symbol}: stream ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const names = [];
    const start = Date.now();
    while (Date.now() - start < 20_000 && !names.includes("chain")) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const event = part.match(/^event: (.+)$/m)?.[1];
        if (event) names.push(event);
      }
    }
    assert(names.includes("chain"), `${symbol}: stream never sent a chain (${names.join(",") || "none"})`);
    return names;
  } finally {
    clearTimeout(kill);
    controller.abort();
  }
}

async function main() {
  console.log(`Live source check against ${BASE}`);
  const universe = await getJson("/api/universe");
  const symbols = universe.indexes.map((row) => `${row.exchange}:${row.symbol}`);
  assert(symbols.join(",") === "NSE:NIFTY,BSE:SENSEX", `index book ${symbols.join(",")}`);
  assert(universe.equities.every((row) => row.symbol === "ANANDRATHI"), "equity book is not only Anand Rathi");
  const books = [
    ...universe.indexes.map((row) => ({ ...row, type: row.nseType || "Indices" })),
    ...universe.equities.map((row) => ({ ...row, type: "Equity" })),
  ];
  console.log(`Book: ${books.map((row) => `${row.exchange}:${row.symbol}`).join(", ")}`);
  console.log(`Session: ${universe.market?.message}`);

  const blocked = [];
  for (const item of books) {
    const started = Date.now();
    let snap;
    try {
      snap = await getJson(
        `/api/chain?symbol=${encodeURIComponent(item.symbol)}&exchange=${item.exchange}&segment=${item.segment}`,
      );
    } catch (err) {
      if (item.exchange === "BSE") {
        blocked.push(item.symbol);
        console.log(`· BSE:${item.symbol} upstream blocked (${err.message})`);
        continue;
      }
      throw err;
    }
    const kpi = checkBook(snap);
    let source = "desk";
    let compared = 0;
    if (item.exchange === "NSE") {
      const raw = await rawNseChain(item.symbol, item.segment === "EQUITY" ? "Equity" : "Indices", snap.expiry);
      compared = compareNse(snap, raw.chain);
      source = "NSE live";
    } else {
      try {
        const raw = await rawBseChain(item.bseScrip, item.segment === "EQUITY" ? "SO" : "IO");
        assert(snap.expiry === raw.expiry || raw.chain, `${item.symbol}: BSE payload missing`);
        compared = compareBse(snap, raw.chain);
        source = "BSE live";
      } catch (err) {
        if (!snap.stale) {
          source = `desk live; direct BSE read failed (${err.message})`;
        } else {
          const cache = JSON.parse(fs.readFileSync(new URL("../src/data/bse-cache.json", import.meta.url), "utf8"));
          const entry = cache[item.symbol];
          assert(entry, `${item.symbol}: BSE denied and no cache (${err.message})`);
          assert(snap.stale === true, `${item.symbol}: cached book was not marked stale`);
          assert(close(snap.spot, entry.spot, 0.05), `${item.symbol}: spot ${snap.spot} != cache ${entry.spot}`);
          assert(snap.expiry === entry.expiry, `${item.symbol}: expiry ${snap.expiry} != cache ${entry.expiry}`);
          assert(snap.rows.length === entry.rows.length, `${item.symbol}: rows ${snap.rows.length} != cache ${entry.rows.length}`);
          source = `BSE cache ${entry.ason?.DT_TM || entry.fetchedAt} (${err.message})`;
        }
      }
    }
    const events = await readStream(item.symbol, item.exchange, item.segment);
    console.log(
      `✓ ${item.exchange}:${item.symbol} rows=${snap.rows.length} spot=${snap.spot} expiry=${snap.expiry} PCR=${snap.totals.pcr?.toFixed?.(2)} maxPain=${snap.totals.maxPain} ATM=${kpi.atm} IV=${kpi.atmIv?.toFixed?.(2) ?? "—"} source=${source} strikes=${compared} stream=${events.includes("chain") ? "chain" : events.join(",")} api=${Date.now() - started}ms`,
    );
  }
  if (blocked.length) {
    console.log(`\nBSE blocked with no cache: ${blocked.join(", ")}. NSE contracts matched.`);
  }
  console.log("\nListed contracts that the exchanges returned match the desk.");
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
