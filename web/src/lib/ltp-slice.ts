import type { CellTuple } from "./diff";
import type { OptionChainSnapshot } from "./types";

export type LtpRow = {
  strike: number;
  ceLtp: number | null;
  ceChg: number | null;
  peLtp: number | null;
  peChg: number | null;
};

/** One expiry, last price and change only. This is what Custom view renders. */
export type LtpSlice = {
  symbol: string;
  expiry: string;
  timestamp: string;
  spot: number | null;
  rows: LtpRow[];
};

export type LtpPatch = {
  expiry: string;
  timestamp: string;
  spot: number | null;
  cells: CellTuple[];
};

export function toLtpSlice(snapshot: OptionChainSnapshot): LtpSlice {
  return {
    symbol: snapshot.symbol,
    expiry: snapshot.expiry,
    timestamp: snapshot.timestamp,
    spot: snapshot.spot,
    rows: snapshot.rows.map((row) => ({
      strike: row.strike,
      ceLtp: row.ce.lastPrice,
      ceChg: row.ce.change,
      peLtp: row.pe.lastPrice,
      peChg: row.pe.change,
    })),
  };
}

export function diffLtpSlice(prev: LtpSlice, next: LtpSlice): LtpPatch | null {
  if (prev.expiry !== next.expiry) return null;
  const before = new Map(prev.rows.map((row) => [row.strike, row]));
  const cells: CellTuple[] = [];
  for (const row of next.rows) {
    const prior = before.get(row.strike);
    if (!prior || prior.ceLtp !== row.ceLtp) cells.push([row.strike, "ce", "ltp", row.ceLtp]);
    if (!prior || prior.ceChg !== row.ceChg) cells.push([row.strike, "ce", "chng", row.ceChg]);
    if (!prior || prior.peLtp !== row.peLtp) cells.push([row.strike, "pe", "ltp", row.peLtp]);
    if (!prior || prior.peChg !== row.peChg) cells.push([row.strike, "pe", "chng", row.peChg]);
  }
  if (cells.length === 0 && prev.spot === next.spot) return null;
  return { expiry: next.expiry, timestamp: next.timestamp, spot: next.spot, cells };
}

export function applyLtpPatch(slice: LtpSlice, patch: LtpPatch): LtpSlice {
  const rows = slice.rows.map((row) => ({ ...row }));
  const byStrike = new Map(rows.map((row) => [row.strike, row]));
  for (const [strike, side, field, value] of patch.cells) {
    const row = byStrike.get(strike) ?? { strike, ceLtp: null, ceChg: null, peLtp: null, peChg: null };
    if (side === "ce" && field === "ltp") row.ceLtp = value;
    if (side === "ce" && field === "chng") row.ceChg = value;
    if (side === "pe" && field === "ltp") row.peLtp = value;
    if (side === "pe" && field === "chng") row.peChg = value;
    byStrike.set(strike, row);
  }
  return {
    ...slice,
    timestamp: patch.timestamp,
    spot: patch.spot,
    rows: [...byStrike.values()].sort((a, b) => a.strike - b.strike),
  };
}
