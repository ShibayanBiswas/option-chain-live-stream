import { describe, expect, it } from "vitest";

import { shownOnDesk } from "./desk-visible";
import { selectDesk, WEALTH_EQUITY } from "./universe";

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

  it("shows only NIFTY, SENSEX, and Anand Rathi when the payload has ten indexes", () => {
    const rows = [
      ...["BANKNIFTY", "FINNIFTY", "NIFTY", "MIDCPNIFTY", "NIFTYNXT50"].map((symbol) => ({
        segment: "INDEX",
        symbol,
        exchange: "NSE",
      })),
      ...["BANKEX", "SENSEX", "SX50"].map((symbol) => ({ segment: "INDEX", symbol, exchange: "BSE" })),
      { segment: "EQUITY", symbol: "ANANDRATHI", exchange: "NSE" },
      { segment: "EQUITY", symbol: "ANANDRATHI", exchange: "BSE" },
    ];
    expect(shownOnDesk(rows).map((item) => `${item.exchange}:${item.symbol}`)).toEqual([
      "NSE:NIFTY",
      "BSE:SENSEX",
      "NSE:ANANDRATHI",
      "BSE:ANANDRATHI",
    ]);
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
