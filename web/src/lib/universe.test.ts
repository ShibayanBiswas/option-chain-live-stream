import { describe, expect, it } from "vitest";

import { WEALTH_EQUITY } from "./universe";

describe("wealth equity lock", () => {
  it("exports the Anand Rathi Wealth symbol", () => {
    expect(WEALTH_EQUITY).toBe("ANANDRATHI");
  });
});
