import { describe, expect, it } from "vitest";

import { applyLtpPatch, diffLtpSlice, toLtpSlice } from "./ltp-slice";
import { freshLink, LOST_AFTER_MS, noteDelivery, noteDrop, noteLost, SSE_RETRY_WHILE_POLLING_MS } from "./stream-link";
import type { OptionChainSnapshot } from "./types";

describe("reconnect", () => {
  it("resets failures and stops polling when any stream event arrives", () => {
    let link = noteDrop(noteDrop(noteDrop(freshLink()).link).link).link;
    expect(link.polling).toBe(true);
    expect(link.failures).toBe(3);
    const delivered = noteDelivery(link, 4);
    expect(delivered.apply).toBe(true);
    expect(delivered.link.failures).toBe(0);
    expect(delivered.link.polling).toBe(false);
  });

  it("backs the poll off from 1.5s to 6s and retries SSE every 15s", () => {
    const first = noteDrop(noteDrop(noteDrop(freshLink()).link).link);
    expect(first.startPoll).toBe(true);
    expect(first.link.pollMs).toBe(1_500);
    expect(first.retryMs).toBe(SSE_RETRY_WHILE_POLLING_MS);
    const second = noteDrop(first.link);
    expect(second.link.pollMs).toBe(3_000);
    const third = noteDrop(second.link);
    expect(third.link.pollMs).toBe(6_000);
    expect(third.retryMs).toBe(15_000);
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
    expect(slice.rows[0]).toEqual({ strike: 100, ceLtp: 10, ceChg: 1, peLtp: 9, peChg: -1 });
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
