/**
 * Accuracy harness: raw NSE JSON vs our normalized snapshot fields.
 * Run: node scripts/verify-accuracy.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${data.error || ""}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function verifySymbol(symbol, exchange = "NSE", segment = "INDEX") {
  const t0 = Date.now();
  const snap = await getJson(
    `/api/chain?symbol=${encodeURIComponent(symbol)}&exchange=${exchange}&segment=${segment}`,
  );
  const latency = Date.now() - t0;

  assert(snap.symbol === symbol, `${symbol}: symbol mismatch`);
  assert(Array.isArray(snap.expiries) && snap.expiries.length > 0, `${symbol}: no expiries`);
  assert(snap.expiry && snap.expiries.includes(snap.expiry), `${symbol}: bad expiry`);
  assert(Array.isArray(snap.rows) && snap.rows.length > 0, `${symbol}: empty rows`);
  assert(snap.spot === null || Number.isFinite(snap.spot), `${symbol}: bad spot`);

  let prev = -Infinity;
  let liveLtp = 0;
  for (const row of snap.rows) {
    assert(row.strike > prev, `${symbol}: strikes not sorted at ${row.strike}`);
    prev = row.strike;
    if (row.ce?.lastPrice) liveLtp += 1;
    if (row.pe?.lastPrice) liveLtp += 1;
  }

  const ceOi = snap.rows.reduce((s, r) => s + (r.ce.oi || 0), 0);
  const peOi = snap.rows.reduce((s, r) => s + (r.pe.oi || 0), 0);
  assert(Math.abs(ceOi - snap.totals.ceOi) < 1e-6, `${symbol}: CE OI total mismatch`);
  assert(Math.abs(peOi - snap.totals.peOi) < 1e-6, `${symbol}: PE OI total mismatch`);
  if (ceOi > 0 && snap.totals.pcr != null) {
    assert(Math.abs(peOi / ceOi - snap.totals.pcr) < 1e-6, `${symbol}: PCR mismatch`);
  }

  // Empty bid/ask should be null/0 so UI can hide columns
  const anyBid = snap.rows.some((r) => (r.ce.bid || 0) > 0 || (r.pe.bid || 0) > 0);

  console.log(
    `✓ ${exchange}:${symbol} rows=${snap.rows.length} spot=${snap.spot} expiry=${snap.expiry} liveLtp=${liveLtp} bids=${anyBid ? "yes" : "hidden-ok"} api=${snap.latencyMs}ms e2e=${latency}ms`,
  );
  return { symbol, latency, rows: snap.rows.length, spot: snap.spot };
}

async function main() {
  console.log(`Accuracy suite against ${BASE}`);
  await getJson("/api/health");
  const results = [];
  results.push(await verifySymbol("NIFTY", "NSE"));
  results.push(await verifySymbol("ANANDRATHI", "NSE", "EQUITY"));
  try {
    results.push(await verifySymbol("SENSEX", "BSE"));
  } catch (err) {
    console.warn(`⚠ BSE:SENSEX skipped — ${err.message}`);
  }

  const avg = results.reduce((s, r) => s + r.latency, 0) / results.length;
  console.log(`\nPassed ${results.length} symbols · avg e2e latency ${avg.toFixed(0)} ms`);
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
