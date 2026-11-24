import type { ChainRow, OptionChainSnapshot, OptionQuote } from "./types";

export type ChainPatch = {
  symbol: string;
  exchange: OptionChainSnapshot["exchange"];
  segment: OptionChainSnapshot["segment"];
  expiry: string;
  spot: number | null;
  timestamp: string;
  latencyMs: number;
  feed: OptionChainSnapshot["feed"];
  marketOpen: boolean;
  totals: OptionChainSnapshot["totals"];
  rows: ChainRow[];
  removedStrikes: number[];
  pcrSeries?: OptionChainSnapshot["pcrSeries"];
  stale?: boolean;
};

function quoteSame(a: OptionQuote, b: OptionQuote): boolean {
  const keys = Object.keys(a) as Array<keyof OptionQuote>;
  return keys.every((key) => a[key] === b[key]);
}

export function rowsChanged(prev: ChainRow[], next: ChainRow[]): { rows: ChainRow[]; removedStrikes: number[] } {
  const before = new Map(prev.map((row) => [row.strike, row]));
  const after = new Set(next.map((row) => row.strike));
  const rows = next.filter((row) => {
    const old = before.get(row.strike);
    if (!old) return true;
    return !quoteSame(old.ce, row.ce) || !quoteSame(old.pe, row.pe);
  });
  const removedStrikes = prev.filter((row) => !after.has(row.strike)).map((row) => row.strike);
  return { rows, removedStrikes };
}

export function toPatch(snapshot: OptionChainSnapshot, rows: ChainRow[], removedStrikes: number[] = []): ChainPatch {
  return {
    symbol: snapshot.symbol,
    exchange: snapshot.exchange,
    segment: snapshot.segment,
    expiry: snapshot.expiry,
    spot: snapshot.spot,
    timestamp: snapshot.timestamp,
    latencyMs: snapshot.latencyMs,
    feed: snapshot.feed,
    marketOpen: snapshot.marketOpen,
    totals: snapshot.totals,
    rows,
    removedStrikes,
    pcrSeries: snapshot.pcrSeries,
    stale: snapshot.stale,
  };
}

export function applyPatch(current: OptionChainSnapshot, patch: ChainPatch): OptionChainSnapshot {
  if (current.symbol !== patch.symbol || current.expiry !== patch.expiry || current.exchange !== patch.exchange) {
    return current;
  }
  const map = new Map(current.rows.map((row) => [row.strike, row]));
  for (const strike of patch.removedStrikes) map.delete(strike);
  for (const row of patch.rows) map.set(row.strike, row);
  const rows = [...map.values()].sort((a, b) => a.strike - b.strike);
  return {
    ...current,
    spot: patch.spot,
    timestamp: patch.timestamp,
    latencyMs: patch.latencyMs,
    feed: patch.feed,
    marketOpen: patch.marketOpen,
    totals: patch.totals,
    rows,
    pcrSeries: patch.pcrSeries ?? current.pcrSeries,
    stale: patch.stale,
  };
}
