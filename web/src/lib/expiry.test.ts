import { describe, expect, it } from "vitest";

import { focusStrikes, upcomingExpiries } from "./display";
import { blackScholes } from "./greeks";
import { daysToExpiry, isListedExpiryLive, toIstIso } from "./expiry";
import { classifySession, gateSession } from "./session";
import { assertBookShape } from "./schema";

describe("expiry and session", () => {
  const beforeClose = new Date("2026-11-24T15:00:00+05:30");
  const afterClose = new Date("2026-11-24T15:31:00+05:30");

  it("keeps spot focus on the 18 strikes either side of at the money", () => {
    const strikes = Array.from({ length: 50 }, (_, index) => 24000 + index * 50);
    const near = focusStrikes(strikes, 25210, "near", 25200);
    expect(near).toHaveLength(37);
    expect(near[0]).toBe(24300);
    expect(near.at(-1)).toBe(26100);
    expect(near).toContain(25200);
    expect(focusStrikes(strikes, 25210, "full", 25200)).toEqual(strikes);
    expect(focusStrikes([25500, 25600, 25800], 25800, "near", 25800)).toEqual([25500, 25600, 25800]);
  });

  it("keeps the next upcoming expiries in date order", () => {
    const now = new Date("2026-11-25T10:00:00+05:30");
    expect(
      upcomingExpiries(["08-Dec-2026", "01-Dec-2026", "24-Nov-2026", "15-Dec-2026"], 2, now),
    ).toEqual(["01-Dec-2026", "08-Dec-2026"]);
  });

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

  it("ignores a leftover Open from a previous trade date", () => {
    const morning = new Date("2026-11-25T08:18:00+05:30");
    const stale = gateSession(classifySession("Open"), "23-Nov-2026 15:30", morning);
    expect(stale.open).toBe(false);
    expect(stale.phase).toBe("closed");
    const live = gateSession(classifySession("Open"), "25-Nov-2026", new Date("2026-11-25T10:00:00+05:30"));
    expect(live.open).toBe(true);
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
