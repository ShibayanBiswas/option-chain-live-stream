import { isEmptyValue } from "./format";
import type { ChainRow, ColumnKey, OptionQuote } from "./types";

export type SideColumn = {
  key: ColumnKey;
  label: string;
  tip: string;
  important?: boolean;
};

/**
 * Call-side order reads toward the strike.
 * Less important book columns sit furthest from the strike.
 * Last and Change sit against it.
 */
export const SIDE_COLUMNS: SideColumn[] = [
  { key: "bidQty", label: "Bid quantity", tip: "Quantity on the best bid" },
  { key: "bid", label: "Bid", tip: "Best bid" },
  { key: "ask", label: "Ask", tip: "Best ask" },
  { key: "askQty", label: "Ask quantity", tip: "Quantity on the best ask" },
  { key: "oi", label: "OI", tip: "Open interest", important: true },
  { key: "oiChg", label: "OI Change", tip: "Change in open interest", important: true },
  { key: "volume", label: "Volume", tip: "Contracts traded", important: true },
  { key: "iv", label: "IV", tip: "Implied volatility", important: true },
  { key: "chng", label: "Change", tip: "Price change", important: true },
  { key: "ltp", label: "Last", tip: "Last traded price", important: true },
];

const MOSTLY_EMPTY = 0.05;

export function quoteField(q: OptionQuote, key: ColumnKey): number | null {
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
  }
}

export function columnFillRatio(rows: ChainRow[], key: ColumnKey): number {
  let filled = 0;
  let total = 0;
  for (const row of rows) {
    for (const quote of [row.ce, row.pe]) {
      total += 1;
      if (!isEmptyValue(quoteField(quote, key))) filled += 1;
    }
  }
  if (total === 0) return 0;
  return filled / total;
}

/** Hide a column when almost every cell is empty. Bid and ask books often are. */
export function columnHasData(rows: ChainRow[], key: ColumnKey): boolean {
  return columnFillRatio(rows, key) >= MOSTLY_EMPTY;
}

export function columnsFor(rows: ChainRow[], mode: "collapsed" | "expanded"): ColumnKey[] {
  const populated = SIDE_COLUMNS.filter((column) => columnHasData(rows, column.key)).map((column) => column.key);
  if (mode === "expanded") return populated;
  const important = populated.filter((key) => SIDE_COLUMNS.find((column) => column.key === key)?.important);
  return important.length > 0 ? important : populated;
}

/** Put side mirrors the call side so Last and Change stay against the strike. */
export function putColumns(callCols: ColumnKey[]): ColumnKey[] {
  return [...callCols].reverse();
}

export function columnLabel(key: ColumnKey): string {
  return SIDE_COLUMNS.find((column) => column.key === key)?.label ?? key;
}

export function columnTip(key: ColumnKey): string {
  return SIDE_COLUMNS.find((column) => column.key === key)?.tip ?? key;
}
