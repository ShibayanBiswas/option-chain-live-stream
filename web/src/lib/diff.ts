import type { ChainRow, OptionChainSnapshot } from "./types";

export type ChainPatch = {
  symbol: string;
  expiry: string;
  spot: number | null;
  timestamp: string;
  latencyMs: number;
  feed: OptionChainSnapshot["feed"];
  totals: OptionChainSnapshot["totals"];
  rows: ChainRow[];
};

export function diffChain(prev: OptionChainSnapshot, next: OptionChainSnapshot): ChainPatch | null {
  if (prev.symbol !== next.symbol || prev.expiry !== next.expiry) return null;
  const previous = new Map(prev.rows.map((row) => [row.strike, JSON.stringify(row)]));
  const rows = next.rows.filter((row) => previous.get(row.strike) !== JSON.stringify(row));
  if (
    rows.length === 0 &&
    prev.spot === next.spot &&
    prev.totals.pcr === next.totals.pcr &&
    prev.totals.ceOi === next.totals.ceOi
  ) {
    return null;
  }
  return {
    symbol: next.symbol,
    expiry: next.expiry,
    spot: next.spot,
    timestamp: next.timestamp,
    latencyMs: next.latencyMs,
    feed: next.feed,
    totals: next.totals,
    rows,
  };
}

export type StreamEvent =
  | { type: "chain"; snapshot: OptionChainSnapshot }
  | { type: "patch"; patch: ChainPatch }
  | { type: "idle" };

/** First book is a chain. An unchanged book sends nothing. A changed book sends a patch. */
export function nextStreamEvent(
  previous: OptionChainSnapshot | null,
  next: OptionChainSnapshot,
  full: boolean,
): StreamEvent {
  if (full || !previous || previous.symbol !== next.symbol || previous.expiry !== next.expiry) {
    return { type: "chain", snapshot: next };
  }
  const patch = diffChain(previous, next);
  if (!patch) return { type: "idle" };
  return { type: "patch", patch };
}

export function applyPatch(snapshot: OptionChainSnapshot, patch: ChainPatch): OptionChainSnapshot {
  const byStrike = new Map(snapshot.rows.map((row) => [row.strike, row]));
  for (const row of patch.rows) byStrike.set(row.strike, row);
  const rows = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  return {
    ...snapshot,
    spot: patch.spot,
    timestamp: patch.timestamp,
    latencyMs: patch.latencyMs,
    feed: patch.feed,
    totals: patch.totals,
    rows,
  };
}
