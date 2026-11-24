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
  const symbols = json.indexes.map((row) => row.symbol);
  for (const need of ["NIFTY", "SENSEX", "BANKNIFTY"]) {
    assert(symbols.includes(need) || symbols.some((s) => s.includes(need)), `missing ${need}`);
  }
  assert(Array.isArray(json.equities), "equities missing");
  assert(
    json.equities.every((row) => row.symbol === "ANANDRATHI"),
    `equity leak: ${json.equities.map((r) => r.symbol).join(",")}`,
  );
  assert(json.equities.length >= 1, "ANANDRATHI equity missing");
  assert(json.market && typeof json.market.message === "string", "market message");
  assert(
    /Market Open|Market Closed|Pre Open|Market Holiday|Session/i.test(json.market.message),
    `unexpected market message ${json.market.message}`,
  );
});

await check("NIFTY chain", async () => {
  const { ok, json } = await get("/api/chain?symbol=NIFTY&exchange=NSE&segment=INDEX");
  assert(ok, `chain ${json?.error || "failed"}`);
  assert(Array.isArray(json.rows) && json.rows.length > 10, "rows thin");
  assert(Array.isArray(json.expiries) && json.expiries.length > 0, "expiries");
  assert(json.totals && "atm" in json.totals, "totals");
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
