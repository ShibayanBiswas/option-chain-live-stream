import { describe, expect, it } from "vitest";

import { putColumns, visibleColumns } from "./columns";
import type { ChainRow } from "./types";

function quote(partial: Partial<ChainRow["ce"]> = {}): ChainRow["ce"] {
  return {
    lastPrice: 10,
    change: 1,
    pChange: null,
    iv: 12,
    oi: 100,
    oiChg: null,
    volume: 50,
    bid: null,
    bidQty: null,
    ask: null,
    askQty: null,
    ...partial,
  };
}

function row(strike: number, extras: Partial<ChainRow> = {}): ChainRow {
  return {
    strike,
    ce: quote(),
    pe: quote(),
    ...extras,
  };
}

describe("visibleColumns", () => {
  it("keeps focus metrics in collapsed density", () => {
    expect(visibleColumns([row(100)], "focus")).toEqual(["volume", "oiChg", "oi", "chng", "ltp"]);
  });

  it("hides an empty bid and ask book, including when the market is closed", () => {
    const cols = visibleColumns([row(100)], "full", { marketOpen: false });
    expect(cols).not.toContain("bid");
    expect(cols).not.toContain("ask");
    expect(cols).toContain("pChg");
    expect(cols).toContain("delta");
    expect(cols).toContain("theta");
    expect(cols).toContain("gamma");
    expect(cols).toContain("vega");
  });

  it("hides empty bid ask in full density when the market is open", () => {
    const cols = visibleColumns([row(100)], "full", { marketOpen: true });
    expect(cols).not.toContain("bid");
    expect(cols).not.toContain("ask");
    expect(cols).toContain("oiChg");
  });

  it("includes populated book columns in full density", () => {
    const cols = visibleColumns(
      [
        row(100, {
          ce: quote({ bid: 9.5, bidQty: 40, ask: 10.2, askQty: 20, oiChg: 12 }),
        }),
      ],
      "full",
    );
    expect(cols).toContain("bid");
    expect(cols).toContain("ask");
    expect(cols).toContain("oiChg");
  });

  it("mirrors puts so Last stays against the strike", () => {
    expect(putColumns(["volume", "oiChg", "oi", "chng", "ltp"])).toEqual([
      "ltp",
      "chng",
      "oi",
      "oiChg",
      "volume",
    ]);
  });
});
