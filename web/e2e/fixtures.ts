import type { OptionChainSnapshot } from "../src/lib/types";

const quote = (partial: Partial<OptionChainSnapshot["rows"][number]["ce"]>) => ({
  lastPrice: null,
  change: null,
  pChange: null,
  iv: null,
  oi: null,
  oiChg: null,
  volume: null,
  bid: null,
  bidQty: null,
  ask: null,
  askQty: null,
  ...partial,
});

export const chain: OptionChainSnapshot = {
  exchange: "NSE",
  symbol: "NIFTY",
  segment: "INDEX",
  expiry: "26-Nov-2026",
  expiries: ["26-Nov-2026", "03-Dec-2026", "10-Dec-2026", "31-Dec-2026"],
  spot: 25340,
  timestamp: "2026-11-24T10:00:00.000Z",
  rows: [
    { strike: 25200, ce: quote({ lastPrice: 180, change: 4.2, iv: 12, oi: 1200, oiChg: 40, volume: 20, bid: 179, bidQty: 50, ask: 181, askQty: 75 }), pe: quote({ lastPrice: 12, change: -1.1, iv: 14, oi: 800, oiChg: -10, volume: 5, bid: 11.5, bidQty: 40, ask: 12.5, askQty: 35 }) },
    { strike: 25250, ce: quote({ lastPrice: 140, change: 2.5, iv: 11.5, oi: 2400, oiChg: 80, volume: 80, bid: 139, bidQty: 60, ask: 141, askQty: 55 }), pe: quote({ lastPrice: 18, change: -0.8, iv: 13, oi: 1500, oiChg: 15, volume: 40, bid: 17.5, bidQty: 25, ask: 18.5, askQty: 30 }) },
    { strike: 25300, ce: quote({ lastPrice: 96, change: -3.4, iv: 11, oi: 8000, oiChg: 200, volume: 400, bid: 95, bidQty: 100, ask: 97, askQty: 90 }), pe: quote({ lastPrice: 42, change: 1.6, iv: 12, oi: 6400, oiChg: -40, volume: 200, bid: 41, bidQty: 80, ask: 43, askQty: 70 }) },
    { strike: 25350, ce: quote({ lastPrice: 62, change: -6.1, iv: 10.4, oi: 15000, oiChg: 500, volume: 2000, bid: 61, bidQty: 120, ask: 63, askQty: 110 }), pe: quote({ lastPrice: 71, change: 5.4, iv: 10.8, oi: 22000, oiChg: 700, volume: 9000, bid: 70, bidQty: 150, ask: 72, askQty: 140 }) },
    { strike: 25400, ce: quote({ lastPrice: 34, change: -2.2, iv: 10, oi: 6000, oiChg: -80, volume: 200, bid: 33, bidQty: 70, ask: 35, askQty: 65 }), pe: quote({ lastPrice: 110, change: 3.3, iv: 11, oi: 9000, oiChg: 120, volume: 400, bid: 109, bidQty: 90, ask: 111, askQty: 85 }) },
    { strike: 25450, ce: quote({ lastPrice: 16, change: -0.6, iv: 9.5, oi: 1800, oiChg: 20, volume: 40, bid: 15.5, bidQty: 30, ask: 16.5, askQty: 28 }), pe: quote({ lastPrice: 155, change: 4.8, iv: 11.2, oi: 2600, oiChg: 60, volume: 80, bid: 154, bidQty: 40, ask: 156, askQty: 36 }) },
    { strike: 25500, ce: quote({ lastPrice: 8, change: 0, iv: 9, oi: 400, oiChg: 0, volume: 0, bid: 7.5, bidQty: 10, ask: 8.5, askQty: 12 }), pe: quote({ lastPrice: 210, change: 0, iv: 12, oi: 300, oiChg: 0, volume: 0, bid: 208, bidQty: 8, ask: 212, askQty: 9 }) },
  ],
  totals: {
    ceOi: 34800,
    peOi: 42600,
    ceOiChg: 760,
    peOiChg: 845,
    ceVolume: 2740,
    peVolume: 9725,
    pcr: 1.22,
    maxPain: 25350,
    atm: 25350,
    atmIv: 10.6,
  },
  latencyMs: 42,
  source: "nse",
  marketOpen: false,
  feed: "rest",
  pcrSeries: [
    { t: "2026-11-24T09:15:00.000Z", pcr: 1.05 },
    { t: "2026-11-24T10:00:00.000Z", pcr: 1.22 },
  ],
};

export const universe = {
  indexes: [
    { symbol: "NIFTY", label: "NIFTY", exchange: "NSE", segment: "INDEX" },
    { symbol: "NIFTYNXT50", label: "NIFTYNXT50", exchange: "NSE", segment: "INDEX" },
    { symbol: "FINNIFTY", label: "FINNIFTY", exchange: "NSE", segment: "INDEX" },
    { symbol: "BANKNIFTY", label: "BANKNIFTY", exchange: "NSE", segment: "INDEX" },
    { symbol: "MIDCPNIFTY", label: "MIDCPNIFTY", exchange: "NSE", segment: "INDEX" },
    { symbol: "NIFTYFPI", label: "NIFTYFPI", exchange: "NSE", segment: "INDEX" },
    { symbol: "SENSEX", label: "SENSEX", exchange: "BSE", segment: "INDEX" },
    { symbol: "BANKEX", label: "BANKEX", exchange: "BSE", segment: "INDEX" },
    { symbol: "SX50", label: "SX50", exchange: "BSE", segment: "INDEX" },
  ],
  equities: [
    { symbol: "ANANDRATHI", label: "ANANDRATHI", exchange: "NSE", segment: "EQUITY" },
    { symbol: "ANANDRATHI", label: "ANANDRATHI", exchange: "BSE", segment: "EQUITY", bseProduct: "SO", bseScrip: 543237 },
  ],
  market: {
    status: "Close",
    tradeDate: "23-Nov-2026",
    open: false,
    phase: "closed",
    label: "Market Closed",
    message: "Market Closed",
  },
  refreshedAt: "2026-11-24T10:00:00.000Z",
};

export const quotes = {
  items: [
    { symbol: "NIFTY", exchange: "NSE", segment: "INDEX", name: "NIFTY 50", spot: 25340, change: -120.5, pChange: -0.47, spark: [25480, 25410, 25340] },
    { symbol: "NIFTYNXT50", exchange: "NSE", segment: "INDEX", name: "NIFTY NEXT 50", spot: 72245.4, change: -961.85, pChange: -1.31, spark: [73200, 72800, 72245.4] },
    { symbol: "FINNIFTY", exchange: "NSE", segment: "INDEX", name: "NIFTY FIN SERVICE", spot: 28153.5, change: -717.7, pChange: -2.49, spark: [28800, 28400, 28153.5] },
    { symbol: "BANKNIFTY", exchange: "NSE", segment: "INDEX", name: "NIFTY BANK", spot: 58210, change: -340, pChange: -0.58, spark: [58600, 58400, 58210] },
    { symbol: "MIDCPNIFTY", exchange: "NSE", segment: "INDEX", name: "NIFTY MID SELECT", spot: 14199.6, change: -105.55, pChange: -0.74, spark: [14320, 14240, 14199.6] },
    { symbol: "NIFTYFPI", exchange: "NSE", segment: "INDEX", name: "NIFTY FPI 150", spot: 1600.25, change: -22.9, pChange: -1.41, spark: [1630, 1612, 1600.25] },
    { symbol: "SENSEX", exchange: "BSE", segment: "INDEX", name: "SENSEX", spot: 82400, change: -210, pChange: -0.25, spark: [82650, 82500, 82400] },
    { symbol: "BANKEX", exchange: "BSE", segment: "INDEX", name: "BANKEX", spot: 65000, change: 80, pChange: 0.12, spark: [64800, 64920, 65000] },
    { symbol: "SX50", exchange: "BSE", segment: "INDEX", name: "SENSEX 50", spot: 26600, change: -40, pChange: -0.15, spark: [26680, 26640, 26600] },
    { symbol: "ANANDRATHI", exchange: "NSE", segment: "EQUITY", name: "Anand Rathi Wealth", spot: 2355.9, change: -12.4, pChange: -0.52, spark: [2370, 2362, 2355.9] },
    { symbol: "ANANDRATHI", exchange: "BSE", segment: "EQUITY", name: "Anand Rathi Wealth", spot: 2354, change: -11, pChange: -0.46, spark: [2368, 2360, 2354] },
  ],
  ticker: [
    { symbol: "NIFTY 50", exchange: "NSE", segment: "INDEX", name: "NIFTY 50", spot: 25340, change: -120.5, pChange: -0.47, spark: [25480, 25340] },
    { symbol: "NIFTY BANK", exchange: "NSE", segment: "INDEX", name: "NIFTY BANK", spot: 58210, change: -340, pChange: -0.58, spark: [58600, 58210] },
    { symbol: "NIFTY FIN SERVICE", exchange: "NSE", segment: "INDEX", name: "NIFTY FIN SERVICE", spot: 28150, change: 90, pChange: 0.32, spark: [28000, 28150] },
  ],
};

export const oi = {
  symbol: "NIFTY",
  exchange: "NSE",
  expiry: "26-Nov-2026",
  spot: chain.spot,
  totals: chain.totals,
  pcrSeries: chain.pcrSeries,
  strikes: chain.rows.map((row) => ({
    strike: row.strike,
    callOi: row.ce.oi,
    putOi: row.pe.oi,
    callOiChange: row.ce.oiChg,
    putOiChange: row.pe.oiChg,
  })),
};
