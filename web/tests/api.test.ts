import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chain-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chain-service")>("@/lib/chain-service");
  return { ...actual, loadOptionChain: vi.fn() };
});

vi.mock("@/lib/nse-ws", () => ({
  openNseOptionSocket: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock("@/lib/universe", () => ({
  loadUniverse: vi.fn(),
}));

vi.mock("@/lib/nse", () => ({
  getNseMarketStatus: vi.fn(),
}));

vi.mock("@/lib/quotes", () => ({
  loadQuoteBoard: vi.fn(),
}));

import { GET as chainGET } from "@/app/api/chain/route";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as metaGET } from "@/app/api/meta/route";
import { GET as oiGET } from "@/app/api/oi/route";
import { GET as quotesGET } from "@/app/api/quotes/route";
import { GET as streamGET } from "@/app/api/stream/route";
import { GET as universeGET } from "@/app/api/universe/route";
import { loadOptionChain } from "@/lib/chain-service";
import { getNseMarketStatus } from "@/lib/nse";
import { loadQuoteBoard } from "@/lib/quotes";
import { loadUniverse } from "@/lib/universe";
import type { OptionChainSnapshot } from "@/lib/types";

const snapshot: OptionChainSnapshot = {
  exchange: "NSE",
  symbol: "NIFTY",
  segment: "INDEX",
  expiry: "26-Nov-2026",
  expiries: ["26-Nov-2026", "31-Dec-2026"],
  spot: 100,
  timestamp: "2026-11-24T10:00:00.000Z",
  rows: [
    {
      strike: 100,
      ce: { lastPrice: 1, change: 0.2, pChange: null, iv: 12, oi: 10, oiChg: 1, volume: 4, bid: null, bidQty: null, ask: null, askQty: null },
      pe: { lastPrice: 2, change: -0.2, pChange: null, iv: 13, oi: 12, oiChg: -1, volume: 5, bid: null, bidQty: null, ask: null, askQty: null },
    },
  ],
  totals: {
    ceOi: 10,
    peOi: 12,
    ceOiChg: 1,
    peOiChg: -1,
    ceVolume: 4,
    peVolume: 5,
    pcr: 1.2,
    maxPain: 100,
    atm: 100,
    atmIv: 12.5,
  },
  latencyMs: 12,
  source: "nse",
  marketOpen: false,
  feed: "rest",
  pcrSeries: [{ t: "2026-11-24T10:00:00.000Z", pcr: 1.2 }],
};

const market = {
  status: "Close",
  tradeDate: "23-Nov-2026",
  niftyLast: 100,
  message: "Market is Closed",
  open: false,
  phase: "closed" as const,
  label: "Market Closed",
};

describe("API routes", () => {
  beforeEach(() => {
    vi.mocked(loadOptionChain).mockReset();
    vi.mocked(loadUniverse).mockReset();
    vi.mocked(getNseMarketStatus).mockReset();
    vi.mocked(loadQuoteBoard).mockReset();
  });

  it("requires a symbol on the chain, open interest, and stream routes", async () => {
    expect((await chainGET(new NextRequest("http://localhost/api/chain"))).status).toBe(400);
    expect((await oiGET(new NextRequest("http://localhost/api/oi"))).status).toBe(400);
    expect((await streamGET(new Request("http://localhost/api/stream"))).status).toBe(400);
  });

  it("returns the chain shape the desk renders", async () => {
    vi.mocked(loadOptionChain).mockResolvedValue(snapshot);
    const response = await chainGET(new NextRequest("http://localhost/api/chain?symbol=NIFTY&exchange=NSE&segment=INDEX"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.symbol).toBe("NIFTY");
    expect(body.rows[0].strike).toBe(100);
    expect(body.totals.pcr).toBe(1.2);
    expect(body.totals.atmIv).toBe(12.5);
  });

  it("maps an upstream rate limit to an unavailable chain", async () => {
    vi.mocked(loadOptionChain).mockRejectedValue(new Error("HTTP 429 rate limit"));
    const response = await chainGET(new NextRequest("http://localhost/api/chain?symbol=NIFTY"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Chain unavailable" });
  });

  it("returns open interest strikes and the ratio series", async () => {
    vi.mocked(loadOptionChain).mockResolvedValue(snapshot);
    const response = await oiGET(new NextRequest("http://localhost/api/oi?symbol=NIFTY"));
    const body = await response.json();
    expect(body.strikes[0]).toMatchObject({ strike: 100, callOi: 10, putOi: 12 });
    expect(body.pcrSeries).toHaveLength(1);
    expect(body.totals.maxPain).toBe(100);
  });

  it("returns only the book the universe loader produced", async () => {
    vi.mocked(loadUniverse).mockResolvedValue({
      indexes: [
        { symbol: "NIFTY", label: "NIFTY", exchange: "NSE", segment: "INDEX" },
        { symbol: "SENSEX", label: "SENSEX", exchange: "BSE", segment: "INDEX" },
      ],
      equities: [{ symbol: "ANANDRATHI", label: "ANANDRATHI", exchange: "NSE", segment: "EQUITY" }],
      refreshedAt: "2026-11-24T00:00:00.000Z",
    });
    vi.mocked(getNseMarketStatus).mockResolvedValue(market);
    const body = await (await universeGET()).json();
    expect(body.indexes.map((item: { symbol: string }) => item.symbol)).toEqual(["NIFTY", "SENSEX"]);
    expect(body.equities).toEqual([
      expect.objectContaining({ symbol: "ANANDRATHI", segment: "EQUITY" }),
    ]);
    expect(body.market).toMatchObject({ phase: "closed", label: "Market Closed" });
  });

  it("reports session phase and cache age from health", async () => {
    vi.mocked(getNseMarketStatus).mockResolvedValue(market);
    const body = await (await healthGET()).json();
    expect(body.ok).toBe(true);
    expect(body.nse.phase).toBe("closed");
    expect(body.cache.entries).toEqual(expect.any(Number));
  });

  it("returns a closed health check when the exchange status fails", async () => {
    vi.mocked(getNseMarketStatus).mockRejectedValue(new Error("HTTP 503"));
    const response = await healthGET();
    expect(response.status).toBe(503);
    expect((await response.json()).ok).toBe(false);
  });

  it("returns quotes for the ticker", async () => {
    vi.mocked(loadQuoteBoard).mockResolvedValue({
      items: [],
      ticker: [{ symbol: "NIFTY 50", exchange: "NSE", segment: "INDEX", name: "NIFTY 50", spot: 100, change: -1, pChange: -0.5, spark: [101, 100] }],
    });
    const body = await (await quotesGET()).json();
    expect(body.ticker[0].name).toBe("NIFTY 50");
    expect(String(body.ticker[0].change)).not.toContain("+");
  });

  it("includes the session on the meta route", async () => {
    vi.mocked(loadUniverse).mockResolvedValue({ indexes: [], equities: [], refreshedAt: "t" });
    vi.mocked(getNseMarketStatus).mockResolvedValue(market);
    const body = await (await metaGET()).json();
    expect(body.market.label).toBe("Market Closed");
    expect(body.serverTimeIst).toEqual(expect.any(String));
  });

  it("streams a chain event and then rotates", async () => {
    vi.mocked(loadOptionChain).mockResolvedValue(snapshot);
    process.env.STREAM_MAX_MS = "30";
    process.env.STREAM_WAIT_MS = "10";
    const response = await streamGET(new Request("http://localhost/api/stream?symbol=NIFTY&exchange=NSE&segment=INDEX"));
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain("event: chain");
    expect(text).toContain("event: end");
    expect(text).toContain("\"symbol\":\"NIFTY\"");
  });
});
