import { isEmptyValue } from "./format";
import type { ChainRow, ColumnKey, OptionQuote } from "./types";

export type SideColumn = {
  key: ColumnKey;
  label: string;
  always?: boolean;
};

/**
 * Call-side order reads toward the strike.
 * Quiet book columns (OI, volume) sit farthest left.
 * Last and Change sit against the strike.
 */
export const SIDE_COLUMNS: SideColumn[] = [
  { key: "oi", label: "Open Interest", always: true },
  { key: "oiChg", label: "Interest Change" },
  { key: "volume", label: "Volume", always: true },
  { key: "iv", label: "IV", always: true },
  { key: "bidQty", label: "Bid Quantity" },
  { key: "bid", label: "Bid" },
  { key: "ask", label: "Ask" },
  { key: "askQty", label: "Ask Quantity" },
  { key: "ltp", label: "Last", always: true },
  { key: "chng", label: "Change" },
];

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
  }
}

export function visibleColumns(rows: ChainRow[]): ColumnKey[] {
  return SIDE_COLUMNS.filter((col) => {
    if (col.always) return true;
    return rows.some(
      (row) =>
        !isEmptyValue(quoteField(row.ce, col.key)) ||
        !isEmptyValue(quoteField(row.pe, col.key)),
    );
  }).map((c) => c.key);
}

/** Put side mirrors the call side so Last and Change stay against the strike. */
export function putColumns(callCols: ColumnKey[]): ColumnKey[] {
  return [...callCols].reverse();
}

export function columnLabel(key: ColumnKey): string {
  return SIDE_COLUMNS.find((c) => c.key === key)?.label ?? key;
}
