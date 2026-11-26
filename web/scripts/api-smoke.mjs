#!/usr/bin/env node
/**
 * Smoke the public API shapes the desk relies on.
 * Run against a local or remote base: BASE_URL=http://127.0.0.1:3000 node scripts/api-smoke.mjs
 */
const base = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const failures = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok  ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : err}`);
    console.error(`fail ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

await check("health", async () => {
  const { ok, json } = await get("/api/health");
  assert(ok, "health not ok");
  assert(json?.ok === true || json?.status === "ok" || typeof json === "object", "health shape");
});

await check("universe indices + wealth equity only", async () => {
  const { ok, json } = await get("/api/universe");
  assert(ok, `universe ${json?.error || "failed"}`);
  assert(Array.isArray(json.indexes) && json.indexes.length > 0, "indexes missing");
  const symbols = json.indexes.map((row) => `${row.exchange}:${row.symbol}`);
  assert(symbols.includes("NSE:NIFTY") && symbols.includes("BSE:SENSEX"), `NIFTY and SENSEX missing: ${symbols.join(",")}`);
  assert(symbols[0] === "NSE:NIFTY", `NIFTY should lead, got ${symbols[0]}`);
  assert(Array.isArray(json.equities), "equities missing");
  assert(
    json.equities.every((row) => row.symbol === "ANANDRATHI"),
    `equity leak: ${json.equities.map((r) => r.symbol).join(",")}`,
  );
  assert(json.equities.length === 1 && json.equities[0].exchange === "NSE", "equity should be NSE Anand Rathi only");
  assert(json.market && typeof json.market.message === "string", "market message");
  assert(
    /Market Open|Market Closed|Pre-Open|Market Holiday|Session/i.test(json.market.message),
    `unexpected market message ${json.market.message}`,
  );
});

await check("NIFTY chain", async () => {
  const { ok, json } = await get("/api/chain?symbol=NIFTY&exchange=NSE&segment=INDEX");
  assert(ok, `chain ${json?.error || "failed"}`);
  assert(Array.isArray(json.rows) && json.rows.length > 10, "rows thin");
  assert(Array.isArray(json.expiries) && json.expiries.length > 0, "expiries");
  assert(json.totals && "atm" in json.totals, "totals");
  assert(typeof json.spot === "number", "spot missing");
  assert(String(json.timestamp).includes("+05:30"), `timestamp not IST ${json.timestamp}`);
  if (json.expiryIso) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    assert(json.expiryIso >= today, `expired default expiry ${json.expiryIso}`);
  }
  for (let i = 1; i < json.rows.length; i += 1) {
    assert(json.rows[i].strike > json.rows[i - 1].strike, "strikes are not monotonic");
  }
  assert(json.stale !== true || json.marketOpen === false, "stale book marked live");
});

await check("ANANDRATHI NSE chain", async () => {
  const { ok, json } = await get("/api/chain?symbol=ANANDRATHI&exchange=NSE&segment=EQUITY");
  assert(ok, `anandrathi nse ${json?.error || "failed"}`);
  assert(Array.isArray(json.rows) && json.rows.length > 0, "no equity rows");
});

await check("SENSEX chain when BSE reachable", async () => {
  const { ok, status, json } = await get("/api/chain?symbol=SENSEX&exchange=BSE&segment=INDEX");
  if (status === 502 || status === 403) {
    console.log("skip SENSEX BSE upstream blocked");
    return;
  }
  assert(ok, `sensex ${json?.error || status}`);
  assert(Array.isArray(json.rows) && json.rows.length > 0, "sensex rows");
});

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\napi smoke passed");
