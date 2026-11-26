import { describe, expect, it } from "vitest";

import { applyLtpPatch, diffLtpSlice, toLtpSlice } from "./ltp-slice";
import { feedChipLabel, freshLink, LOST_AFTER_MS, noteDelivery, noteDrop, noteLost, SSE_RETRY_WHILE_POLLING_MS } from "./stream-link";
import type { OptionChainSnapshot } from "./types";

describe("reconnect", () => {
  it("resets failures and stops polling when any stream event arrives", () => {
    const link = noteDrop(noteDrop(noteDrop(freshLink()).link).link).link;
    expect(link.polling).toBe(true);
    expect(link.failures).toBe(3);
    const delivered = noteDelivery(link, 4);
    expect(delivered.apply).toBe(true);
    expect(delivered.link.failures).toBe(0);
    expect(delivered.link.polling).toBe(false);
  });

  it("backs the poll off from 1.5s to 6s and retries SSE at 1s, 2s, 5s, then 10s", () => {
    const once = noteDrop(freshLink());
    expect(once.retryMs).toBe(1_000);
    const twice = noteDrop(once.link);
    expect(twice.retryMs).toBe(2_000);
    const first = noteDrop(twice.link);
    expect(first.startPoll).toBe(true);
    expect(first.link.pollMs).toBe(1_500);
    expect(first.retryMs).toBe(5_000);
    const second = noteDrop(first.link);
    expect(second.link.pollMs).toBe(3_000);
    expect(second.retryMs).toBe(10_000);
    const third = noteDrop(second.link);
    expect(third.link.pollMs).toBe(6_000);
    expect(third.retryMs).toBe(10_000);
    expect(SSE_RETRY_WHILE_POLLING_MS).toBe(15_000);
  });

  it("marks the link lost after 10s and ignores an older event id", () => {
    expect(LOST_AFTER_MS).toBe(10_000);
    const lost = noteLost(freshLink());
    expect(lost.lost).toBe(true);
    const current = noteDelivery(lost, 8).link;
    const stale = noteDelivery(current, 7);
    expect(stale.apply).toBe(false);
    expect(stale.link.lastId).toBe(8);
  });
});

describe("feed chip", () => {
  it("says WebSocket once the NSE socket is open, and leaves a BSE book on the snapshot", () => {
    expect(feedChipLabel({ quiet: false, sameBook: true, feed: "polling", source: "nse", socket: "open", fallback: "REST" })).toBe("WebSocket");
    expect(feedChipLabel({ quiet: false, sameBook: true, feed: "websocket", source: "nse", socket: "idle", fallback: "REST" })).toBe("WebSocket");
    expect(feedChipLabel({ quiet: false, sameBook: true, feed: "polling", source: "bse", socket: "open", fallback: "REST" })).toBe("REST");
    expect(feedChipLabel({ quiet: true, sameBook: true, feed: "websocket", source: "nse", socket: "open", fallback: "REST" })).toBe("Stale");
    expect(feedChipLabel({ quiet: false, sameBook: false, feed: "websocket", source: "nse", socket: "open", fallback: "REST" })).toBe("Connecting");
  });
});

describe("ltp slice", () => {
  it("sends last price and change, then only the cell that moved", () => {
    const snapshot = {
      symbol: "NIFTY",
      expiry: "02-Dec-2026",
      timestamp: "t0",
      spot: 100,
      rows: [
        {
          strike: 100,
          ce: { lastPrice: 10, change: 1, pChange: null, iv: 12, oi: 5, oiChg: 0, volume: 2, bid: null, bidQty: null, ask: null, askQty: null },
          pe: { lastPrice: 9, change: -1, pChange: null, iv: 12, oi: 5, oiChg: 0, volume: 2, bid: null, bidQty: null, ask: null, askQty: null },
        },
      ],
    } as OptionChainSnapshot;
    const slice = toLtpSlice(snapshot);
    expect(slice.rows[0]).toEqual({ strike: 100, ceLtp: 10, ceChg: 1, ceVol: 2, peLtp: 9, peChg: -1, peVol: 2 });
    const moved = {
      ...slice,
      timestamp: "t1",
      rows: [{ ...slice.rows[0]!, ceLtp: 10.5 }],
    };
    const patch = diffLtpSlice(slice, moved);
    expect(patch?.cells).toEqual([[100, "ce", "ltp", 10.5]]);
    expect(applyLtpPatch(slice, patch!).rows[0]?.ceLtp).toBe(10.5);
  });
});
