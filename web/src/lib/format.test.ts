import { describe, expect, it } from "vitest";

import { formatPrice, formatSigned, isEmptyValue } from "./format";

describe("formatSigned", () => {
  it("never prefixes a plus sign", () => {
    expect(formatSigned(12.5, 2)).toBe("12.50");
    expect(formatSigned(-3.25, 2)).toBe("-3.25");
  });
});

describe("formatPrice", () => {
  it("rounds a price to one decimal", () => {
    expect(formatPrice(356.04)).toBe("356.0");
    expect(formatPrice(356.05)).toBe("356.1");
    expect(formatPrice(25756.34)).toBe("25,756.3");
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
