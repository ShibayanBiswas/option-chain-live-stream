import { describe, expect, it } from "vitest";

import { formatDataAge, formatPrice, formatSigned, isEmptyValue } from "./format";

describe("formatSigned", () => {
  it("never prefixes a plus sign", () => {
    expect(formatSigned(12.5, 2)).toBe("12.50");
    expect(formatSigned(-3.25, 2)).toBe("-3.25");
  });
});

describe("formatPrice", () => {
  it("shows a price to two decimals and keeps a real zero", () => {
    expect(formatPrice(356.04)).toBe("356.04");
    expect(formatPrice(356.05)).toBe("356.05");
    expect(formatPrice(25756.34)).toBe("25,756.34");
    expect(formatPrice(0)).toBe("0.00");
    expect(formatPrice(null)).toBe("—");
    expect(formatSigned(0, 2)).toBe("0.00");
  });

  it("reads the exchange clock rather than the fetch time", () => {
    const age = formatDataAge("2026-11-25T08:07:00.000Z", Date.parse("2026-11-25T08:08:22.000Z"));
    expect(age?.label).toBe("Updated 13:37:00 IST · 82s ago");
    expect(age?.seconds).toBe(82);
    expect(formatDataAge("")).toBeNull();
  });
});

describe("isEmptyValue", () => {
  it("treats blanks and zeros as empty for column gating", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(0)).toBe(true);
    expect(isEmptyValue("—")).toBe(true);
    expect(isEmptyValue(4)).toBe(false);
  });
});
