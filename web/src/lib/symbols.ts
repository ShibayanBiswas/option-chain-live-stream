import type { Instrument } from "./types";

export const NSE_INDEXES: Instrument[] = [
  { symbol: "NIFTY", label: "Nifty 50", exchange: "NSE", segment: "INDEX", nseType: "Indices" },
  { symbol: "BANKNIFTY", label: "Bank Nifty", exchange: "NSE", segment: "INDEX", nseType: "Indices" },
  { symbol: "FINNIFTY", label: "Fin Nifty", exchange: "NSE", segment: "INDEX", nseType: "Indices" },
  { symbol: "MIDCPNIFTY", label: "Midcap Select", exchange: "NSE", segment: "INDEX", nseType: "Indices" },
  { symbol: "NIFTYNXT50", label: "Nifty Next 50", exchange: "NSE", segment: "INDEX", nseType: "Indices" },
];

export const BSE_INDEXES: Instrument[] = [
  { symbol: "SENSEX", label: "Sensex", exchange: "BSE", segment: "INDEX", bseScrip: 1 },
  { symbol: "BANKEX", label: "Bankex", exchange: "BSE", segment: "INDEX", bseScrip: 12 },
  { symbol: "SX50", label: "Sensex 50", exchange: "BSE", segment: "INDEX", bseScrip: 47 },
];

export const EQUITIES: Instrument[] = [
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "ICICIBANK",
  "INFY",
  "SBIN",
  "BHARTIARTL",
  "ITC",
  "LT",
  "AXISBANK",
  "KOTAKBANK",
  "BAJFINANCE",
  "HINDUNILVR",
  "SUNPHARMA",
  "MARUTI",
  "TITAN",
  "ASIANPAINT",
  "ULTRACEMCO",
  "NTPC",
  "POWERGRID",
  "TATAMOTORS",
  "TATASTEEL",
  "JSWSTEEL",
  "ADANIENT",
  "ADANIPORTS",
  "WIPRO",
  "HCLTECH",
  "TECHM",
  "ONGC",
  "COALINDIA",
  "M&M",
  "NESTLEIND",
  "BAJAJFINSV",
  "HDFCLIFE",
  "SBILIFE",
].map((symbol) => ({
  symbol,
  label: symbol,
  exchange: "NSE" as const,
  segment: "EQUITY" as const,
  nseType: "Equity" as const,
}));

const ALL = [...NSE_INDEXES, ...BSE_INDEXES, ...EQUITIES];

export function getInstrument(symbol: string): Instrument | undefined {
  const key = symbol.trim().toUpperCase();
  const known = ALL.find((i) => i.symbol === key);
  if (known) return known;
  if (!key) return undefined;
  return {
    symbol: key,
    label: key,
    exchange: "NSE",
    segment: "EQUITY",
    nseType: "Equity",
  };
}

export function listIndexes(): Instrument[] {
  return [...NSE_INDEXES, ...BSE_INDEXES];
}
