import { describe, expect, it } from "vitest";

import { readBseSeries } from "@/lib/bse";

describe("BSE index feed", () => {
  it("reads the homepage sensex payload", () => {
    const series = readBseSeries({
      PrevClose: "82000",
      Data: JSON.stringify([82100, 82250, 82435.99]),
    });
    expect(series?.prevClose).toBe(82000);
    expect(series?.points.at(-1)).toBe(82435.99);
  });

  it("reads a graph payload split by the exchange marker", () => {
    const series = readBseSeries('[{"PreClose":70400}]#@#[{"ltp":70410.81},{"ltp":70500}]');
    expect(series?.prevClose).toBe(70400);
    expect(series?.points).toEqual([70410.81, 70500]);
  });
});