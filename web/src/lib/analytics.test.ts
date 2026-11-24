import { describe, expect, it } from "vitest";

import { atmIv, buildTotals, chainHighlights, computeMaxPain, computePCR, findAtmStrike } from "./analytics";
import { canonicalTapeSymbol, describeExpiry, displayName, groupExpiries, matchTape } from "./display";
import { applyPatch, diffChain } from "./diff";
import type { ChainRow, OptionChainSnapshot, OptionQuote } from "./types";

function quote(partial: Partial<OptionQuote> = {}): OptionQuote {
  return {
    lastPrice: 10,
    change: 1,
    pChange: null,
    iv: 14,
    oi: 100,
    oiChg: 0,
    volume: 20,
    bid: null,
    bidQty: null,
    ask: null,
    askQty: null,
    ...partial,
  };
}

function row(strike: number, ce: Partial<OptionQuote> = {}, pe: Partial<OptionQuote> = {}): ChainRow {
  return { strike, ce: quote(ce), pe: quote(pe) };
}

describe("calculations", () => {
  it("finds the nearest strike", () => {
    expect(findAtmStrike(106, [100, 110])).toBe(110);
    expect(findAtmStrike(null, [100])).toBeNull();
  });

  it("computes put call ratio from open interest", () => {
    const rows = [row(100, { oi: 100 }, { oi: 250 })];
    expect(computePCR(rows)).toBe(2.5);
    expect(computePCR([row(100, { oi: 0 }, { oi: 10 })])).toBeNull();
  });

  it("picks max pain at the strike with the least writer loss", () => {
    const rows = [
      row(100, { oi: 10 }, { oi: 0 }),
      row(110, { oi: 0 }, { oi: 10 }),
    ];
    expect(computeMaxPain(rows)).toBe(100);
  });

  it("builds totals and at-the-money IV", () => {
    const rows = [row(100, { oi: 40, iv: 12 }, { oi: 80, iv: 18 })];
    const totals = buildTotals(rows, 101);
    expect(totals.pcr).toBe(2);
    expect(totals.atm).toBe(100);
    expect(atmIv(rows, 100)).toBe(15);
  });

  it("marks the heaviest open interest and the largest move", () => {
    const rows = [
      row(100, { oi: 10, change: 1 }, { oi: 90, change: -1 }),
      row(110, { oi: 80, change: 4 }, { oi: 5, change: 0.2 }),
    ];
    expect(chainHighlights(rows)).toEqual({
      maxCallOi: 110,
      maxPutOi: 100,
      maxMove: 110,
    });
  });
});

describe("expiries", () => {
  const now = new Date(2026, 10, 24);

  it("labels known symbols and counts days", () => {
    expect(displayName("BANKNIFTY")).toBe("BANK NIFTY");
    expect(displayName("ANANDRATHI")).toBe("Anand Rathi Wealth");
    expect(displayName("SX50")).toBe("SENSEX 50");
    expect(matchTape("BANKNIFTY", [{ symbol: "NIFTY BANK", last: 1 }])?.last).toBe(1);
    expect(matchTape("FINNIFTY", [{ symbol: "NIFTY FIN SERVICE", last: 2 }])?.last).toBe(2);
    expect(matchTape("NIFTYFPI", [{ symbol: "NIFTY FPI 150", last: 3 }])?.last).toBe(3);
    expect(canonicalTapeSymbol("NIFTY BANK")).toBe("BANKNIFTY");
    expect(canonicalTapeSymbol("NIFTY MID SELECT")).toBe("MIDCPNIFTY");
    const info = describeExpiry("26-Nov-2026", now);
    expect(info?.days).toBe(2);
    expect(info?.bucket).toBe("monthly");
  });

  it("treats the last Thursday as monthly", () => {
    expect(describeExpiry("07-Jan-2027", now)?.bucket).toBe("weekly");
    expect(describeExpiry("28-Jan-2027", now)?.bucket).toBe("monthly");
    const groups = groupExpiries(["23-Nov-2026", "07-Jan-2027", "28-Jan-2027"], now);
    expect(groups.weekly.map((item) => item.raw)).toEqual(["07-Jan-2027"]);
    expect(groups.monthly.map((item) => item.raw)).toEqual(["28-Jan-2027"]);
    expect(describeExpiry("23-Nov-2026", now)?.label).toBe("23-Nov-2026");
  });
});

describe("diff", () => {
  const base = {
    exchange: "NSE",
    symbol: "NIFTY",
    segment: "INDEX",
    expiry: "26-Nov-2026",
    expiries: ["26-Nov-2026"],
    spot: 100,
    timestamp: "t0",
    rows: [row(100)],
    totals: buildTotals([row(100)], 100),
    latencyMs: 10,
    source: "nse",
    marketOpen: false,
    feed: "rest",
  } satisfies OptionChainSnapshot;

  it("returns only the strike that changed", () => {
    const next: OptionChainSnapshot = {
      ...base,
      timestamp: "t1",
      rows: [row(100, { lastPrice: 11 }), row(110)],
    };
    const patch = diffChain(base, next);
    expect(patch?.rows.map((item) => item.strike)).toEqual([100, 110]);
    const merged = applyPatch(base, patch!);
    expect(merged.rows).toHaveLength(2);
    expect(merged.rows[0]?.ce.lastPrice).toBe(11);
  });
});
