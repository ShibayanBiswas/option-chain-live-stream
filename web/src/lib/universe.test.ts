import { describe, expect, it } from "vitest";

import { DESK_INDEXES, WEALTH_EQUITY } from "./universe";

describe("wealth equity lock", () => {
  it("exports the Anand Rathi Wealth symbol", () => {
    expect(WEALTH_EQUITY).toBe("ANANDRATHI");
  });

  it("lists only NIFTY and SENSEX", () => {
    expect(DESK_INDEXES).toEqual([
      { symbol: "NIFTY", exchange: "NSE" },
      { symbol: "SENSEX", exchange: "BSE" },
    ]);
  });
});
