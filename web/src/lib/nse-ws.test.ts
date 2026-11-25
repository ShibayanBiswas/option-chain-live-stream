import { describe, expect, it } from "vitest";

import { applyOptionTick, istTickTime, overlayContractFields } from "./nse-ws";
import type { OptionChainSnapshot, OptionQuote } from "./types";

function quote(partial: Partial<OptionQuote> = {}): OptionQuote {
  return {
    lastPrice: 10,
    change: 1,
    pChange: null,
    iv: 18.2,
    oi: 100,
    oiChg: 4,
    volume: 20,
    bid: 9.5,
    bidQty: 50,
    ask: 10.5,
    askQty: 75,
    ...partial,
  };
}

function book(): OptionChainSnapshot {
  return {
    exchange: "NSE",
    symbol: "NIFTY",
    segment: "INDEX",
    expiry: "01-Dec-2026",
    expiries: ["01-Dec-2026"],
    spot: 25700,
    timestamp: "2026-11-25T14:00:00+05:30",
    rows: [{ strike: 25700, ce: quote(), pe: quote({ lastPrice: 8 }) }],
    totals: { ceOi: 100, peOi: 100, ceVolume: 20, peVolume: 20, pcr: 1, maxPain: 25700, atm: 25700 },
    latencyMs: 40,
    source: "nse",
    marketOpen: true,
    feed: "polling",
  };
}

describe("NSE option socket", () => {
  it("reads an IST clock and ignores a bare date", () => {
    expect(istTickTime("2026-11-25 14:24:01")).toBe("2026-11-25T14:24:01+05:30");
    expect(istTickTime("2026-11-25")).toBeNull();
  });

  it("updates the last price and leaves IV and open interest from the chain", () => {
    const applied = applyOptionTick(book(), {
      strike: 25700,
      timestamp: "2026-11-25T14:24:01+05:30",
      ce: { lastPrice: 10.55, change: 0.55 },
    });
    expect(applied?.cells).toEqual([
      [25700, "ce", "ltp", 10.55],
      [25700, "ce", "chng", 0.55],
      [25700, "ce", "pChg", 5.5],
    ]);
    expect(applied?.snapshot.timestamp).toBe("2026-11-25T14:24:01+05:30");
    expect(
      applyOptionTick(applied!.snapshot, {
        strike: 25700,
        timestamp: "2026-11-25T14:10:00+05:30",
        ce: { lastPrice: 1 },
      }),
    ).toBeNull();
    expect(applied?.snapshot.feed).toBe("websocket");
    expect(applied?.snapshot.rows[0]?.ce.iv).toBe(18.2);
    expect(applied?.snapshot.rows[0]?.ce.oi).toBe(100);
    expect(applied?.snapshot.rows[0]?.pe.lastPrice).toBe(8);
  });

  it("copies open interest from a later chain refresh without wiping the socket price", () => {
    const current = applyOptionTick(book(), {
      strike: 25700,
      timestamp: "2026-11-25T14:24:01+05:30",
      ce: { lastPrice: 10.55 },
    })!.snapshot;
    const fresh = book();
    fresh.rows[0]!.ce = quote({ oi: 140, iv: 19 });
    const merged = overlayContractFields(current, fresh);
    expect(merged.rows[0]?.ce.lastPrice).toBe(10.55);
    expect(merged.rows[0]?.ce.oi).toBe(140);
    expect(merged.rows[0]?.ce.iv).toBe(19);
  });
});
