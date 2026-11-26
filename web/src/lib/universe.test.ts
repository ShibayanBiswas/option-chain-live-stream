import { describe, expect, it } from "vitest";

import { selectDesk, splitPinned, WEALTH_EQUITY } from "./universe";

describe("desk universe", () => {
  const input = {
    nseIndexes: ["BANKNIFTY", "NIFTY", "FINNIFTY"],
    nseEquities: ["ANANDRATHI", "RELIANCE", "TCS"],
    bseIndexes: [
      { symbol: "SX50", scrip: 2 },
      { symbol: "SENSEX", scrip: 1 },
    ],
    bseEquities: [{ symbol: "ANANDRATHI", scrip: 9 }],
  };

  it("discovers every index and pins NIFTY and SENSEX when scope is all", () => {
    expect(WEALTH_EQUITY).toBe("ANANDRATHI");
    const book = selectDesk(input, "all");
    expect(book.indexes.map((item) => `${item.exchange}:${item.symbol}`)).toEqual([
      "NSE:NIFTY",
      "NSE:BANKNIFTY",
      "NSE:FINNIFTY",
      "BSE:SENSEX",
      "BSE:SX50",
    ]);
    expect(book.equities.map((item) => `${item.exchange}:${item.symbol}`)).toEqual([
      "NSE:ANANDRATHI",
      "BSE:ANANDRATHI",
    ]);
    expect(book.equities.find((item) => item.exchange === "BSE")?.bseScrip).toBe(9);
  });

  it("puts every index except the pin under More", () => {
    const nse = selectDesk(input, "all").indexes.filter((item) => item.exchange === "NSE");
    expect(splitPinned(nse, "NIFTY")).toEqual({
      lead: [nse[0]],
      more: [nse[1], nse[2]],
    });
  });

  it("keeps only NIFTY and SENSEX when scope is core", () => {
    const book = selectDesk(input, "core");
    expect(book.indexes.map((item) => `${item.exchange}:${item.symbol}`)).toEqual(["NSE:NIFTY", "BSE:SENSEX"]);
    expect(book.equities.map((item) => `${item.exchange}:${item.symbol}`)).toEqual([
      "NSE:ANANDRATHI",
      "BSE:ANANDRATHI",
    ]);
  });
});
