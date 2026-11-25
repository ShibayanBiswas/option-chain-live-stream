import { isEmptyValue } from "./format";
import type { ChainRow, ColumnKey, OptionQuote } from "./types";

export type SideColumn = {
  key: ColumnKey;
  label: string;
  always?: boolean;
  /** Present in the collapsed focus view. */
  focus?: boolean;
};

/**
 * Call-side order reads toward the strike.
 * Quiet book columns sit farthest left.
 * Last sits against the strike.
 */
/** Outside to inside, so the last price sits against the strike. */
export const SIDE_COLUMNS: SideColumn[] = [
  { key: "bidQty", label: "Bid Quantity" },
  { key: "bid", label: "Bid" },
  { key: "ask", label: "Ask" },
  { key: "askQty", label: "Ask Quantity" },
  { key: "vega", label: "Vega" },
  { key: "gamma", label: "Gamma" },
  { key: "theta", label: "Theta" },
  { key: "delta", label: "Delta" },
  { key: "iv", label: "IV" },
  { key: "volume", label: "Volume", always: true, focus: true },
  { key: "oiChg", label: "OI Change", focus: true },
  { key: "oi", label: "OI", always: true, focus: true },
  { key: "pChg", label: "% Change" },
  { key: "chng", label: "Change", focus: true },
  { key: "ltp", label: "LTP", always: true, focus: true },
];

const COLLAPSED: ColumnKey[] = ["volume", "oiChg", "oi", "chng", "ltp"];

function quoteField(q: OptionQuote, key: ColumnKey): number | null {
  switch (key) {
    case "oi":
      return q.oi;
    case "oiChg":
      return q.oiChg;
    case "volume":
      return q.volume;
    case "iv":
      return q.iv;
    case "ltp":
      return q.lastPrice;
    case "chng":
      return q.change;
    case "bidQty":
      return q.bidQty;
    case "bid":
      return q.bid;
    case "ask":
      return q.ask;
    case "askQty":
      return q.askQty;
    case "pChg":
      return q.pChange;
    case "delta":
      return q.delta ?? null;
    case "gamma":
      return q.gamma ?? null;
    case "theta":
      return q.theta ?? null;
    case "vega":
      return q.vega ?? null;
  }
}

export function visibleColumns(
  rows: ChainRow[],
  density: "focus" | "full" = "full",
  options?: { marketOpen?: boolean },
): ColumnKey[] {
  void options;
  if (density === "focus") return COLLAPSED;
  return SIDE_COLUMNS.filter((col) => {
    const quoteColumn = col.key === "bid" || col.key === "ask" || col.key === "bidQty" || col.key === "askQty";
    if (col.key === "delta" || col.key === "gamma" || col.key === "theta" || col.key === "vega") return true;
    if (col.key === "pChg") return true;
    if (col.always || col.focus || col.key === "iv") return true;
    if (quoteColumn) {
      return rows.some(
        (row) =>
          !isEmptyValue(quoteField(row.ce, col.key)) ||
          !isEmptyValue(quoteField(row.pe, col.key)),
      );
    }
    return true;
  }).map((c) => c.key);
}

/** Put side mirrors the call side so Last stays against the strike. */
export function putColumns(callCols: ColumnKey[]): ColumnKey[] {
  return [...callCols].reverse();
}

export function columnLabel(key: ColumnKey): string {
  return SIDE_COLUMNS.find((c) => c.key === key)?.label ?? key;
}

const HINTS: Record<ColumnKey, string> = {
  oi: "Open interest, contracts outstanding",
  oiChg: "Change in open interest",
  volume: "Contracts traded",
  iv: "Implied volatility",
  ltp: "Last traded price",
  chng: "Change from the previous close",
  bidQty: "Quantity at the best bid",
  bid: "Best bid",
  ask: "Best ask",
  askQty: "Quantity at the best ask",
  delta: "Black-Scholes delta from exchange IV",
  gamma: "Black-Scholes gamma",
  theta: "Black-Scholes theta per day",
  vega: "Black-Scholes vega",
  pChg: "Percent change",
};

export function columnHint(key: ColumnKey): string {
  return HINTS[key];
}
