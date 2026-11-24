import bundledCache from "@/data/bse-cache.json";

import { buildTotals } from "./analytics";
import { expiryIso, toIstIso } from "./expiry";
import { parseLooseNumber } from "./format";
import type { ChainRow, OptionChainSnapshot, OptionQuote } from "./types";

type CacheRow = Record<string, string | number | null | undefined>;

type CacheEntry = {
  symbol: string;
  scripCd: number;
  expiry: string;
  expiries: string[];
  spot: number;
  rows: CacheRow[];
  ason?: { DT_TM?: string };
  fetchedAt?: string;
};

function mapCe(row: CacheRow): OptionQuote {
  return {
    lastPrice: parseLooseNumber(row.C_Last_Trd_Price),
    change: parseLooseNumber(row.C_NetChange),
    pChange: null,
    iv: parseLooseNumber(row.C_IV),
    oi: parseLooseNumber(row.C_Open_Interest),
    oiChg: parseLooseNumber(row.C_Absolute_Change_OI),
    volume: parseLooseNumber(row.C_Vol_Traded),
    bid: parseLooseNumber(row.C_BidPrice),
    bidQty: parseLooseNumber(row.C_BIdQty),
    ask: parseLooseNumber(row.C_OfferPrice),
    askQty: parseLooseNumber(row.C_OfferQty),
  };
}

function mapPe(row: CacheRow): OptionQuote {
  return {
    lastPrice: parseLooseNumber(row.Last_Trd_Price),
    change: parseLooseNumber(row.NetChange),
    pChange: null,
    iv: parseLooseNumber(row.IV),
    oi: parseLooseNumber(row.Open_Interest),
    oiChg: parseLooseNumber(row.Absolute_Change_OI),
    volume: parseLooseNumber(row.Vol_Traded),
    bid: parseLooseNumber(row.BidPrice),
    bidQty: parseLooseNumber(row.BIdQty),
    ask: parseLooseNumber(row.OfferPrice),
    askQty: parseLooseNumber(row.OfferQty),
  };
}

function loadCache(): Record<string, CacheEntry> | null {
  return bundledCache as Record<string, CacheEntry>;
}

export function listCachedBse(): Array<{ symbol: string; scrip: number }> {
  const cache = loadCache();
  if (!cache) return [];
  return Object.values(cache)
    .map((entry) => ({
      symbol: entry.symbol,
      scrip: Number(entry.rows?.[0]?.ScriP_cd ?? entry.scripCd ?? 0),
    }))
    .filter((row) => row.symbol && row.scrip > 0);
}

export function getBseCachedChain(symbol: string, expiry?: string): OptionChainSnapshot | null {
  const started = Date.now();
  const cache = loadCache();
  const entry = cache?.[symbol.toUpperCase()];
  if (!entry?.rows?.length) return null;

  const selected =
    expiry && entry.expiries.includes(expiry) ? expiry : entry.expiry;

  // Cache currently stores one expiry window (nearest). If another expiry requested, still return nearest with note in timestamp.
  const rows: ChainRow[] = entry.rows
    .map((row) => {
      const strike = parseLooseNumber(row.Strike_Price1 ?? row.Strike_Price);
      if (strike === null) return null;
      return { strike, ce: mapCe(row), pe: mapPe(row) };
    })
    .filter((r): r is ChainRow => r !== null)
    .sort((a, b) => a.strike - b.strike);

  const spot = parseLooseNumber(entry.spot) ?? parseLooseNumber(entry.rows[0]?.UlaValue);

  return {
    exchange: "BSE",
    symbol: entry.symbol,
    segment: "INDEX",
    expiry: selected,
    expiryIso: expiryIso(selected),
    expiries: entry.expiries?.length ? entry.expiries : [entry.expiry],
    spot,
    timestamp: toIstIso(entry.ason?.DT_TM?.trim() || entry.fetchedAt || ""),
    rows,
    totals: buildTotals(rows, spot),
    latencyMs: Date.now() - started,
    source: "bse",
    marketOpen: false,
    stale: true,
    asOf: entry.ason?.DT_TM?.trim() || entry.fetchedAt || null,
    feed: "rest",
  };
}
