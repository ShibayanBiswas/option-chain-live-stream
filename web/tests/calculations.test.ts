import { describe, expect, it } from "vitest";

import { averageAtmIv, buildTotals, computeMaxPain, computePCR, findAtmStrike } from "@/lib/analytics";
import { clearChainCache, readChainCache, readPcr, recordPcr, writeChainCache } from "@/lib/chain-cache";
import { columnsFor } from "@/lib/columns";
import { chainMarks, depthPercent, volumeBands, volumeClass } from "@/lib/depth";
import { applyPatch, rowsChanged } from "@/lib/diff";
import { daysToExpiry, formatExpiryOption, groupExpiries, parseExpiryDate } from "@/lib/expiry";
import { blackScholes } from "@/lib/greeks";
import { formatSigned } from "@/lib/format";
import { matchIndexQuote } from "@/lib/index-match";
import { assertChain } from "@/lib/schema";
import { classifySession } from "@/lib/session";
import type { ChainRow, OptionChainSnapshot, OptionQuote } from "@/lib/types";

function quote(partial: Partial<OptionQuote> = {}): OptionQuote {
  return {
    lastPrice: null,
    change: null,
    pChange: null,
    iv: null,
    oi: null,
    oiChg: null,
    volume: null,
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

describe("session", () => {
  it("classifies open, pre-open, closed, and holiday from the exchange text", () => {
    expect(classifySession("Open", "Normal Market is Open")).toMatchObject({ phase: "open", label: "Market Open" });
    expect(classifySession("Pre-open", "Pre-Open")).toMatchObject({ phase: "pre-open", open: false });
    expect(classifySession("Close", "Market is Closed")).toMatchObject({ phase: "closed", label: "Market Closed" });
    expect(classifySession("Closed", "Market Holiday")).toMatchObject({ phase: "holiday", label: "Market Holiday" });
  });
});

describe("analytics", () => {
  const rows = [
    row(100, { oi: 1, oiChg: 2, iv: 10, volume: 5 }, { oi: 0 }),
    row(110, { oi: 0, iv: 20 }, { oi: 100, oiChg: -4, iv: 30, volume: 8 }),
  ];

  it("computes PCR, max pain, ATM, ATM IV, and open-interest change", () => {
    expect(computePCR(rows)).toBeCloseTo(100);
    expect(computeMaxPain(rows)).toBe(110);
    expect(findAtmStrike(105, [100, 110])).toBe(100);
    expect(findAtmStrike(106, [100, 110])).toBe(110);
    const totals = buildTotals(rows, 106);
    expect(totals.pcr).toBeCloseTo(100);
    expect(totals.maxPain).toBe(110);
    expect(totals.atm).toBe(110);
    expect(totals.ceOiChg).toBe(2);
    expect(totals.peOiChg).toBe(-4);
    expect(averageAtmIv(rows, 110)).toBe(25);
    expect(totals.atmIv).toBe(25);
  });
});

describe("greeks", () => {
  it("matches the published at-the-money Black-Scholes call", () => {
    const greek = blackScholes({ spot: 100, strike: 100, rate: 0.05, sigma: 0.2, timeYears: 1, type: "call" });
    expect(greek).not.toBeNull();
    expect(greek!.price).toBeCloseTo(10.4506, 2);
    expect(greek!.delta).toBeCloseTo(0.6368, 2);
    expect(greek!.gamma).toBeGreaterThan(0);
    expect(greek!.vega).toBeGreaterThan(0);
  });
});

describe("expiry", () => {
  const now = new Date("2026-11-24T08:00:00+05:30");

  it("parses exchange dates and counts days in India time", () => {
    expect(parseExpiryDate("26-Nov-2026")?.toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(parseExpiryDate("26 Nov 2026")?.toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(daysToExpiry("26-Nov-2026", now)).toBe(2);
    expect(daysToExpiry("24-Nov-2026", now)).toBe(0);
    expect(formatExpiryOption("26-Nov-2026", now)).toBe("26-Nov-2026 · 2 days");
  });

  it("groups the last expiry of each month as monthly", () => {
    const groups = groupExpiries(["03-Dec-2026", "10-Dec-2026", "31-Dec-2026", "26-Nov-2026"]);
    expect(groups.monthly).toEqual(["31-Dec-2026", "26-Nov-2026"]);
    expect(groups.weekly).toEqual(["03-Dec-2026", "10-Dec-2026"]);
  });
});

describe("columns", () => {
  it("keeps important columns when collapsed and reveals filled bid columns when expanded", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row(100 + index, { lastPrice: 1 + index, change: index === 0 ? 0.4 : -0.2, oi: 10, oiChg: 1, volume: index === 0 ? 0 : 20, iv: 12, bid: 1 }, { lastPrice: 2, change: 0.1, oi: 8, volume: 15, iv: 11, bid: 1 }),
    );
    const collapsed = columnsFor(rows, "collapsed");
    const expanded = columnsFor(rows, "expanded");
    expect(collapsed).toEqual(["oi", "oiChg", "volume", "iv", "chng", "ltp"]);
    expect(collapsed).not.toContain("bid");
    expect(expanded).toContain("bid");
    expect(expanded.at(-1)).toBe("ltp");
    expect(expanded.at(-2)).toBe("chng");
  });

  it("hides a column that is mostly empty", () => {
    const rows = [row(100, { lastPrice: 1, oi: 5, volume: 2, iv: 10 }, { lastPrice: 1, oi: 4, volume: 3, iv: 9 })];
    expect(columnsFor(rows, "expanded")).not.toContain("bid");
    expect(columnsFor(rows, "expanded")).not.toContain("chng");
  });
});

describe("depth and marks", () => {
  it("scales bars, shades volume, and marks walls", () => {
    expect(depthPercent(25, 100)).toBe(25);
    expect(depthPercent(0, 100)).toBe(0);
    const values = [10, 20, 30, 40, 100];
    const bands = volumeBands(values);
    expect(volumeClass(0, bands)).toBe("zero");
    expect(volumeClass(100, bands)).toBe("high");
    expect(volumeClass(10, bands)).toBe("low");
    const marks = chainMarks([
      row(100, { oi: 50, change: 1 }, { oi: 5, change: -1 }),
      row(110, { oi: 4, change: 9 }, { oi: 80, change: 0.2 }),
    ]);
    expect(marks.callWall).toBe(100);
    expect(marks.putWall).toBe(110);
    expect(marks.moveStrike).toBe(110);
  });
});

describe("diff and cache", () => {
  const base = row(100, { lastPrice: 1, oi: 2, volume: 3, iv: 4, change: 0.5 }, { lastPrice: 2, oi: 3, volume: 4, iv: 5, change: -0.5 });

  it("sends only the strikes that changed and merges them back", () => {
    const next = row(100, { lastPrice: 1.5, oi: 2, volume: 3, iv: 4, change: 0.8 }, base.pe);
    const diff = rowsChanged([base], [next, row(105, { lastPrice: 3, oi: 1, volume: 1, iv: 1, change: 0.1 })]);
    expect(diff.rows.map((item) => item.strike)).toEqual([100, 105]);
    const snapshot = {
      exchange: "NSE",
      symbol: "NIFTY",
      segment: "INDEX",
      expiry: "26-Nov-2026",
      expiries: ["26-Nov-2026"],
      spot: 100,
      timestamp: "t",
      rows: [base],
      totals: buildTotals([base], 100),
      latencyMs: 1,
      source: "nse",
      marketOpen: false,
      feed: "rest",
    } satisfies OptionChainSnapshot;
    const merged = applyPatch(snapshot, {
      ...snapshot,
      rows: diff.rows,
      removedStrikes: [],
      totals: buildTotals([next], 100),
    });
    expect(merged.rows).toHaveLength(2);
    expect(merged.rows[0]?.ce.lastPrice).toBe(1.5);
  });

  it("serves a fresh chain and then a stale one", () => {
    clearChainCache();
    const snapshot = {
      exchange: "NSE" as const,
      symbol: "NIFTY",
      segment: "INDEX" as const,
      expiry: "26-Nov-2026",
      expiries: ["26-Nov-2026"],
      spot: 100,
      timestamp: "t",
      rows: [base],
      totals: buildTotals([base], 100),
      latencyMs: 4,
      source: "nse" as const,
      marketOpen: false,
      feed: "rest" as const,
    };
    writeChainCache("NSE|INDEX|NIFTY|", snapshot, 1_000);
    expect(readChainCache("NSE|INDEX|NIFTY|", 2_000).hit).toBe("fresh");
    expect(readChainCache("NSE|INDEX|NIFTY|", 5_000).hit).toBe("stale");
    expect(readChainCache("NSE|INDEX|NIFTY|", 80_000).hit).toBe("miss");
    recordPcr("NSE|INDEX|NIFTY|", 0.8, new Date(1_000));
    recordPcr("NSE|INDEX|NIFTY|", 0.9, new Date(20_000));
    expect(readPcr("NSE|INDEX|NIFTY|")).toHaveLength(2);
  });
});

describe("schema and copy", () => {
  it("rejects a chain that is missing the fields the desk renders", () => {
    expect(() => assertChain({ symbol: "NIFTY" } as OptionChainSnapshot)).toThrow();
  });

  it("does not put a plus sign on a positive change", () => {
    expect(formatSigned(12.5, 2)).toBe("12.50");
    expect(formatSigned(-3, 2)).toContain("-");
    expect(formatSigned(12.5, 2)).not.toContain("+");
  });

  it("joins an option symbol to the exchange index name", () => {
    const match = matchIndexQuote("BANKNIFTY", [
      { group: "INDICES ELIGIBLE IN DERIVATIVES", name: "NIFTY BANK", last: 100, change: -1, pChange: -0.2, previousClose: 101, open: 102 },
    ]);
    expect(match?.name).toBe("NIFTY BANK");
  });
});
