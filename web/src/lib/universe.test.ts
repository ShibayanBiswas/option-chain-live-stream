import { describe, expect, it } from "vitest";

import { selectDesk, WEALTH_EQUITY } from "./universe";

describe("desk universe", () => {
  it("keeps NIFTY, SENSEX, and Anand Rathi Wealth only", () => {
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
      "BSE:SENSEX",
    ]);
    expect(book.indexes.find((item) => item.symbol === "NIFTY")?.label).toBe("NIFTY 50");
    expect(book.equities.map((item) => `${item.exchange}:${item.symbol}`)).toEqual(["NSE:ANANDRATHI"]);
  });
});
