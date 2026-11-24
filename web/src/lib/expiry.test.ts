import { describe, expect, it } from "vitest";

import { blackScholes } from "./greeks";
import { daysToExpiry, isListedExpiryLive, toIstIso } from "./expiry";
import { classifySession } from "./session";
import { assertBookShape } from "./schema";

describe("expiry and session", () => {
  const beforeClose = new Date("2026-11-24T15:00:00+05:30");
  const afterClose = new Date("2026-11-24T15:31:00+05:30");

  it("drops a contract after the 15:30 IST cutoff on expiry day", () => {
    expect(isListedExpiryLive("24-Nov-2026", beforeClose)).toBe(true);
    expect(isListedExpiryLive("24-Nov-2026", afterClose)).toBe(false);
    expect(isListedExpiryLive("23-Nov-2026", beforeClose)).toBe(false);
    expect(daysToExpiry("26-Nov-2026", new Date("2026-11-24T10:00:00+05:30"))).toBe(2);
  });

  it("normalises exchange timestamps to IST", () => {
    expect(toIstIso("23-Nov-2026 15:40:00")).toBe("2026-11-23T15:40:00+05:30");
    expect(toIstIso("23 Nov 2026 | 20:41")).toBe("2026-11-23T20:41:00+05:30");
  });

  it("classifies holiday, pre-open, open and closed from the exchange words", () => {
    expect(classifySession("Open").phase).toBe("open");
    expect(classifySession("Close", "Market is Closed").phase).toBe("closed");
    expect(classifySession("", "Pre-Open session").phase).toBe("pre-open");
    expect(classifySession("Close", "Trading Holiday").phase).toBe("holiday");
  });

  it("rejects a book whose strikes are not monotonic or whose index spot is missing", () => {
    expect(() =>
      assertBookShape({ strikes: [100, 90], spot: 100, expiry: "a", expiries: ["a"], segment: "INDEX" }),
    ).toThrow(/monotonic/);
    expect(() =>
      assertBookShape({ strikes: [100], spot: null, expiry: "a", expiries: ["a"], segment: "INDEX" }),
    ).toThrow(/spot/);
  });

  it("prices a known at-the-money call above zero with delta near one half", () => {
    const greek = blackScholes({
      spot: 100,
      strike: 100,
      rate: 0,
      sigma: 0.2,
      timeYears: 1,
      type: "call",
    });
    expect(greek).not.toBeNull();
    expect(greek!.price).toBeGreaterThan(7);
    expect(greek!.price).toBeLessThan(9);
    expect(greek!.delta).toBeGreaterThan(0.5);
    expect(greek!.delta).toBeLessThan(0.6);
  });
});
