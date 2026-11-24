import { isEmptyValue } from "./format";
import type { ChainRow, ColumnKey, OptionQuote } from "./types";

export type SideColumn = {
  key: ColumnKey;
  label: string;
  always?: boolean;
};

/** Core columns always shown. Quote columns may be hidden when entirely empty. */
export const SIDE_COLUMNS: SideColumn[] = [
  { key: "oi", label: "OI", always: true },
  { key: "oiChg", label: "OI Chg" },
  { key: "volume", label: "Volume", always: true },
  { key: "iv", label: "IV", always: true },
  { key: "ltp", label: "LTP", always: true },
  { key: "chng", label: "Chng" },
  { key: "bidQty", label: "Bid Qty" },
  { key: "bid", label: "Bid" },
  { key: "ask", label: "Ask" },
  { key: "askQty", label: "Ask Qty" },
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

export function columnLabel(key: ColumnKey): string {
  return SIDE_COLUMNS.find((c) => c.key === key)?.label ?? key;
}
