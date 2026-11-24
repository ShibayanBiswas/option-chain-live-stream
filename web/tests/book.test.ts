import { describe, expect, it } from "vitest";

import { deskBook } from "@/lib/book";
import { isAnandRathiSymbol } from "@/lib/equity";
import type { Instrument } from "@/lib/types";

function item(partial: Partial<Instrument> & Pick<Instrument, "symbol" | "exchange" | "segment">): Instrument {
  return { label: partial.symbol, ...partial };
}

describe("equity book", () => {
  it("recognises only Anand Rathi Wealth names", () => {
    expect(isAnandRathiSymbol("ANANDRATHI")).toBe(true);
    expect(isAnandRathiSymbol("Anand Rathi Wealth")).toBe(true);
    expect(isAnandRathiSymbol("RELIANCE")).toBe(false);
    expect(isAnandRathiSymbol("ANAND")).toBe(false);
  });

  it("keeps every index and drops every other equity", () => {
    const book = deskBook(
      [
        item({ symbol: "NIFTY", exchange: "NSE", segment: "INDEX" }),
        item({ symbol: "SENSEX", exchange: "BSE", segment: "INDEX" }),
        item({ symbol: "BANKEX", exchange: "BSE", segment: "INDEX" }),
      ],
      [
        item({ symbol: "RELIANCE", exchange: "NSE", segment: "EQUITY" }),
        item({ symbol: "ANANDRATHI", exchange: "NSE", segment: "EQUITY" }),
        item({ symbol: "ANANDRATHI", exchange: "BSE", segment: "EQUITY", bseProduct: "SO" }),
      ],
    );
    expect(book.indexes.map((row) => row.symbol)).toEqual(["NIFTY", "SENSEX", "BANKEX"]);
    expect(book.equities.map((row) => `${row.exchange}:${row.symbol}`)).toEqual(["NSE:ANANDRATHI", "BSE:ANANDRATHI"]);
  });
});
