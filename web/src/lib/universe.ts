import { BseBlockedError, discoverBseUnderlyings, getBseExpiries } from "./bse";
import { listCachedBse } from "./bse-cache";
import { discoverNseBook } from "./nse";
import type { Exchange, Instrument, Segment } from "./types";

export type DeskUniverse = {
  indexes: Instrument[];
  equities: Instrument[];
  refreshedAt: string;
};

let cache: { at: number; value: DeskUniverse } | null = null;
const TTL_MS = 10 * 60 * 1000;

/** Equity option book is restricted to Anand Rathi Wealth only. */
const WEALTH_EQUITY = "ANANDRATHI";

/** The desk lists these two index contracts and nothing else. */
export const DESK_INDEXES = [
  { symbol: "NIFTY", exchange: "NSE" as const },
  { symbol: "SENSEX", exchange: "BSE" as const },
];

function asInstrument(
  symbol: string,
  exchange: Exchange,
  segment: Segment,
  bseScrip?: number,
): Instrument {
  return {
    symbol,
    label: segment === "EQUITY" && symbol === WEALTH_EQUITY ? "Anand Rathi Wealth" : symbol,
    exchange,
    segment,
    nseType: exchange === "NSE" ? (segment === "INDEX" ? "Indices" : "Equity") : undefined,
    bseScrip,
  };
}

function isWealthEquity(symbol: string): boolean {
  const key = symbol.replace(/\s+/g, "").toUpperCase();
  return key === WEALTH_EQUITY || key === "ANANDRATHIWEALTH";
}

export async function loadUniverse(force = false): Promise<DeskUniverse> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const nse = await discoverNseBook();
  let bseIndexes: Instrument[] = [];
  let bseWealth: Instrument | null = null;

  try {
    const [indexes, stocks] = await Promise.all([
      discoverBseUnderlyings("IO"),
      discoverBseUnderlyings("SO").catch(() => []),
    ]);
    bseIndexes = indexes.map((row) =>
      asInstrument(row.symbol.replace(/\s+/g, ""), "BSE", "INDEX", row.scrip),
    );
    const wealth = stocks.find((row) => isWealthEquity(row.symbol));
    if (wealth) {
      const expiries = await getBseExpiries(wealth.scrip, "SO").catch(() => []);
      if (expiries.length > 0) {
        bseWealth = asInstrument(WEALTH_EQUITY, "BSE", "EQUITY", wealth.scrip);
      }
    }
  } catch (err) {
    if (!(err instanceof BseBlockedError)) {
      console.error("bse universe", err);
    }
    bseIndexes = listCachedBse().map((row) =>
      asInstrument(row.symbol, "BSE", "INDEX", row.scrip),
    );
  }

  const nseWealth = nse.equities.find((symbol) => isWealthEquity(symbol));
  const equities: Instrument[] = [];
  if (nseWealth) equities.push(asInstrument(WEALTH_EQUITY, "NSE", "EQUITY"));
  if (bseWealth) equities.push(bseWealth);

  const sensex =
    bseIndexes.find((item) => item.symbol.replace(/\s+/g, "").toUpperCase() === "SENSEX") ??
    asInstrument("SENSEX", "BSE", "INDEX", 1);

  const value: DeskUniverse = {
    indexes: DESK_INDEXES.map((item) =>
      item.symbol === "SENSEX" ? sensex : asInstrument(item.symbol, item.exchange, "INDEX"),
    ),
    equities,
    refreshedAt: new Date().toISOString(),
  };

  cache = { at: Date.now(), value };
  return value;
}

export async function resolveInstrument(
  symbol: string,
  exchange?: string,
  segment?: string,
): Promise<Instrument | undefined> {
  const book = await loadUniverse();
  const key = symbol.trim().toUpperCase().replace(/\s+/g, "");
  const normalized = isWealthEquity(key) ? WEALTH_EQUITY : key;
  const ex = exchange?.toUpperCase();
  const seg = segment?.toUpperCase();
  const all = [...book.indexes, ...book.equities];
  return (
    all.find(
      (item) =>
        item.symbol.toUpperCase() === normalized &&
        (!ex || item.exchange === ex) &&
        (!seg || item.segment === seg),
    ) ?? all.find((item) => item.symbol.toUpperCase() === normalized && (!ex || item.exchange === ex))
  );
}

export { WEALTH_EQUITY };
