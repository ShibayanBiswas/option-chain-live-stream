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
  { key: "pChg", label: "% Chng" },
  { key: "theta", label: "Theta" },
  { key: "delta", label: "Delta" },
  { key: "bidQty", label: "Bid Qty" },
  { key: "bid", label: "Bid" },
  { key: "ask", label: "Ask" },
  { key: "askQty", label: "Ask Qty" },
  { key: "oiChg", label: "Chng in OI", focus: true },
  { key: "oi", label: "OI", always: true, focus: true },
  { key: "volume", label: "Volume", always: true, focus: true },
  { key: "iv", label: "IV" },
  { key: "chng", label: "Chng", focus: true },
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
    case "theta":
      return null;
  }
}

export function visibleColumns(
  rows: ChainRow[],
  density: "focus" | "full" = "full",
  options?: { marketOpen?: boolean },
): ColumnKey[] {
  if (density === "focus") return COLLAPSED;
  const marketOpen = options?.marketOpen ?? true;
  return SIDE_COLUMNS.filter((col) => {
    const quoteColumn = col.key === "bid" || col.key === "ask" || col.key === "bidQty" || col.key === "askQty";
    if (!marketOpen && quoteColumn) return true;
    if (col.key === "delta" || col.key === "theta" || col.key === "pChg") return true;
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
  theta: "Black-Scholes theta per day",
  pChg: "Percent change",
};

export function columnHint(key: ColumnKey): string {
  return HINTS[key];
}
