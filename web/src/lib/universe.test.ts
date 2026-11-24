import { describe, expect, it } from "vitest";

import { selectDesk, WEALTH_EQUITY } from "./universe";

describe("desk universe", () => {
  it("keeps every discovered index and only Anand Rathi Wealth", () => {
    expect(WEALTH_EQUITY).toBe("ANANDRATHI");
    const book = selectDesk({
      nseIndexes: ["NIFTY", "BANKNIFTY", "FINNIFTY"],
      nseEquities: ["ANANDRATHI", "RELIANCE", "TCS"],
      bseIndexes: [
        { symbol: "SENSEX", scrip: 1 },
        { symbol: "SX50", scrip: 2 },
      ],
      bseEquities: [{ symbol: "ANANDRATHI", scrip: 9 }],
    });
    expect(book.indexes.map((item) => `${item.exchange}:${item.symbol}`)).toEqual([
      "NSE:NIFTY",
      "NSE:BANKNIFTY",
      "NSE:FINNIFTY",
      "BSE:SENSEX",
      "BSE:SX50",
    ]);
    expect(book.indexes.find((item) => item.symbol === "BANKNIFTY")?.label).toBe("NIFTY BANK");
    expect(book.indexes.find((item) => item.symbol === "SX50")?.label).toBe("SENSEX 50");
    expect(book.equities.map((item) => `${item.exchange}:${item.symbol}`)).toEqual([
      "NSE:ANANDRATHI",
      "BSE:ANANDRATHI",
    ]);
  });
});
