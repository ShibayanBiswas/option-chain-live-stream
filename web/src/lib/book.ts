import { isAnandRathiSymbol } from "./equity";
import type { Instrument } from "./types";

/** Indices stay as discovered. Equities are limited to Anand Rathi Wealth. */
export function deskBook(indexes: Instrument[], equities: Instrument[]): {
  indexes: Instrument[];
  equities: Instrument[];
} {
  return {
    indexes: indexes.filter((item) => item.segment === "INDEX"),
    equities: equities.filter((item) => item.segment === "EQUITY" && isAnandRathiSymbol(item.symbol)),
  };
}
