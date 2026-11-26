import type { OptionChainSnapshot, OptionQuote } from "./types";

const CELL_FIELDS = {
  ltp: "lastPrice",
  chng: "change",
  pChg: "pChange",
  oi: "oi",
  oiChg: "oiChg",
  volume: "volume",
  iv: "iv",
  bid: "bid",
  bidQty: "bidQty",
  ask: "ask",
  askQty: "askQty",
} as const;

export type CellField = keyof typeof CELL_FIELDS;
export type CellTuple = [number, "ce" | "pe", CellField, number | null];

export type ChainPatch = {
  symbol: string;
  expiry: string;
  spot: number | null;
  timestamp: string;
  latencyMs: number;
  feed: OptionChainSnapshot["feed"];
  totals: OptionChainSnapshot["totals"];
  cells: CellTuple[];
};

function blankQuote(): OptionQuote {
  return {
    lastPrice: null,
    change: null,
    pChange: null,
    iv: null,
    oi: null,
    oiChg: null,
    volume: null,
    bid: null,
    bidQty: null,
    ask: null,
    askQty: null,
  };
}

function cellsFor(strike: number, side: "ce" | "pe", prev: OptionQuote | null, next: OptionQuote): CellTuple[] {
  const out: CellTuple[] = [];
  for (const field of Object.keys(CELL_FIELDS) as CellField[]) {
    const key = CELL_FIELDS[field];
    const value = next[key] ?? null;
    if (prev == null) {
      if (value != null) out.push([strike, side, field, value]);
      continue;
    }
    if ((prev[key] ?? null) !== value) out.push([strike, side, field, value]);
  }
  return out;
}

export function diffChain(prev: OptionChainSnapshot, next: OptionChainSnapshot): ChainPatch | null {
  if (prev.symbol !== next.symbol || prev.expiry !== next.expiry) return null;
  const before = new Map(prev.rows.map((row) => [row.strike, row]));
  const cells: CellTuple[] = [];
  for (const row of next.rows) {
    const prior = before.get(row.strike);
    cells.push(...cellsFor(row.strike, "ce", prior?.ce ?? null, row.ce));
    cells.push(...cellsFor(row.strike, "pe", prior?.pe ?? null, row.pe));
  }
  if (
    cells.length === 0 &&
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
    cells,
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
  const byStrike = new Map(snapshot.rows.map((row) => [row.strike, { ...row, ce: { ...row.ce }, pe: { ...row.pe } }]));
  for (const [strike, side, field, value] of patch.cells) {
    const row = byStrike.get(strike) ?? { strike, ce: blankQuote(), pe: blankQuote() };
    row[side] = { ...row[side], [CELL_FIELDS[field]]: value };
    byStrike.set(strike, row);
  }
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
