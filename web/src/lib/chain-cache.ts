import type { OptionChainSnapshot } from "./types";

const STALE_MS = 60_000;

type Entry = { at: number; value: OptionChainSnapshot };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<OptionChainSnapshot>>();
const pcrSeries = new Map<string, { t: string; pcr: number }[]>();

export function chainCacheKey(parts: {
  symbol: string;
  exchange?: string;
  segment?: string;
  expiry?: string;
}): string {
  return [parts.exchange ?? "", parts.segment ?? "", parts.symbol, parts.expiry ?? ""]
    .join("|")
    .toUpperCase();
}

function freshMs(value: OptionChainSnapshot): number {
  return value.marketOpen ? 2_000 : 30_000;
}

export function readChainCache(
  key: string,
  now = Date.now(),
): { hit: "fresh" | "stale" | "miss"; value?: OptionChainSnapshot } {
  const row = store.get(key);
  if (!row) return { hit: "miss" };
  const age = now - row.at;
  if (age <= freshMs(row.value)) return { hit: "fresh", value: row.value };
  if (age <= STALE_MS) return { hit: "stale", value: row.value };
  return { hit: "miss", value: row.value };
}

export function writeChainCache(key: string, value: OptionChainSnapshot, now = Date.now()) {
  store.set(key, { at: now, value });
}

/** Concurrent callers for the same book share one upstream request. */
export function coalesceChain(
  key: string,
  load: () => Promise<OptionChainSnapshot>,
): Promise<OptionChainSnapshot> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = load().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, run);
  return run;
}

export function recordPcr(key: string, pcr: number | null, now = new Date()) {
  if (pcr == null || !Number.isFinite(pcr)) return;
  const list = pcrSeries.get(key) ?? [];
  const last = list[list.length - 1];
  if (last && Math.abs(last.pcr - pcr) < 1e-9 && now.getTime() - Date.parse(last.t) < 10_000) return;
  list.push({ t: now.toISOString(), pcr });
  pcrSeries.set(key, list.slice(-80));
}

export function readPcr(key: string): { t: string; pcr: number }[] {
  return pcrSeries.get(key) ?? [];
}

export function chainCacheStats(now = Date.now()): { entries: number; oldestAgeMs: number | null } {
  let oldest: number | null = null;
  for (const row of store.values()) {
    const age = now - row.at;
    if (oldest == null || age > oldest) oldest = age;
  }
  return { entries: store.size, oldestAgeMs: oldest };
}

export function clearChainCache() {
  store.clear();
  inflight.clear();
  pcrSeries.clear();
}
