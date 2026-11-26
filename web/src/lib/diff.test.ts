import { describe, expect, it } from "vitest";

import { coalescePatches, mergeChain, type ChainPatch, type CellTuple } from "./diff";
import type { OptionChainSnapshot, OptionQuote } from "./types";

function quote(lastPrice: number, volume: number): OptionQuote {
  return {
    lastPrice,
    change: 0,
    pChange: 0,
    iv: 10,
    oi: 100,
    oiChg: 1,
    volume,
    bid: 1,
    bidQty: 1,
    ask: 2,
    askQty: 1,
  };
}

function book(feed: OptionChainSnapshot["feed"], lastPrice: number, volume: number): OptionChainSnapshot {
  return {
    symbol: "NIFTY",
    exchange: "NSE",
    segment: "INDEX",
    expiry: "01-Dec-2026",
    expiries: [],
    spot: 100,
    timestamp: "2026-11-26T10:00:00+05:30",
    latencyMs: 1,
    feed,
    source: "nse",
    marketOpen: true,
    stale: false,
    rows: [{ strike: 100, ce: quote(lastPrice, volume), pe: quote(1, volume) }],
    totals: { ceOi: 1, peOi: 1, ceVolume: volume, peVolume: volume, pcr: 1, maxPain: null, atm: 100 },
  } as OptionChainSnapshot;
}

describe("mergeChain", () => {
  it("keeps a websocket price when a later REST book is lower", () => {
    const live = book("websocket", 356.05, 20);
    const rest = { ...book("polling", 350, 4), timestamp: "2026-11-26T10:00:02+05:30", rows: live.rows.map((row) => ({ ...row, ce: quote(350, 4), pe: row.pe })) };
    const merged = mergeChain(live, rest as OptionChainSnapshot);
    expect(merged.rows[0]?.ce.lastPrice).toBe(356.05);
    expect(merged.rows[0]?.ce.volume).toBe(20);
    expect(merged.feed).toBe("websocket");
  });

  it("does not let volume move backwards on two snapshots", () => {
    const first = book("polling", 10, 30);
    const second = { ...book("polling", 10.5, 12), timestamp: "2026-11-26T10:00:02+05:30" };
    expect(mergeChain(first, second).rows[0]?.ce.volume).toBe(30);
    expect(mergeChain(first, second).rows[0]?.ce.lastPrice).toBe(10.5);
  });
});

describe("coalescePatches", () => {
  function tick(cells: CellTuple[], spot = 100): ChainPatch {
    return {
      symbol: "NIFTY",
      expiry: "01-Dec-2026",
      spot,
      timestamp: "2026-11-26T10:00:01+05:30",
      latencyMs: 1,
      feed: "websocket",
      totals: book("websocket", 1, 1).totals,
      cells,
    };
  }

  it("keeps the latest price and the higher volume", () => {
    const first = tick([
      [100, "ce", "ltp", 10],
      [100, "ce", "volume", 20],
    ]);
    const second = tick(
      [
        [100, "ce", "ltp", 10.5],
        [100, "ce", "volume", 4],
      ],
      101,
    );
    const merged = coalescePatches(first, second);
    expect(merged.spot).toBe(101);
    expect(merged.cells).toEqual([
      [100, "ce", "ltp", 10.5],
      [100, "ce", "volume", 20],
    ]);
  });
});
