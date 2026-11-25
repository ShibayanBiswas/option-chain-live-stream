import { BseBlockedError, discoverBseUnderlyings } from "./bse";
import { listCachedBse } from "./bse-cache";
import { indexLabel } from "./index-match";
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

function asInstrument(
  symbol: string,
  exchange: Exchange,
  segment: Segment,
  bseScrip?: number,
): Instrument {
  const compact = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return {
    symbol: segment === "EQUITY" ? WEALTH_EQUITY : compact,
    label: indexLabel(compact),
    exchange,
    segment,
    nseType: exchange === "NSE" ? (segment === "INDEX" ? "Indices" : "Equity") : undefined,
    bseScrip,
  };
}

export function selectDesk(input: {
  nseIndexes: string[];
  nseEquities: string[];
  bseIndexes: Array<{ symbol: string; scrip: number }>;
  bseEquities: Array<{ symbol: string; scrip: number }>;
}): DeskUniverse {
  const indexes = [
    ...input.nseIndexes
      .filter((symbol) => symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "NIFTY")
      .map((symbol) => asInstrument(symbol, "NSE", "INDEX")),
    ...input.bseIndexes
      .filter((row) => row.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "SENSEX")
      .map((row) => asInstrument(row.symbol, "BSE", "INDEX", row.scrip)),
  ];
  const equities: Instrument[] = [];
  if (input.nseEquities.some((symbol) => isWealthEquity(symbol))) {
    equities.push(asInstrument(WEALTH_EQUITY, "NSE", "EQUITY"));
  }
  return { indexes, equities, refreshedAt: new Date().toISOString() };
}

function isWealthEquity(symbol: string): boolean {
  const key = symbol.replace(/\s+/g, "").toUpperCase();
  return key === WEALTH_EQUITY || key === "ANANDRATHIWEALTH";
}

export async function loadUniverse(force = false): Promise<DeskUniverse> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const nse = await discoverNseBook();
  let bseIndexes: Instrument[] = [];

  try {
    const indexes = await discoverBseUnderlyings("IO");
    bseIndexes = indexes.map((row) =>
      asInstrument(row.symbol.replace(/\s+/g, ""), "BSE", "INDEX", row.scrip),
    );
  } catch (err) {
    if (!(err instanceof BseBlockedError)) {
      console.error("bse universe", err);
    }
    bseIndexes = listCachedBse().map((row) =>
      asInstrument(row.symbol, "BSE", "INDEX", row.scrip),
    );
  }

  if (!bseIndexes.some((item) => item.symbol === "SENSEX")) {
    bseIndexes.push(asInstrument("SENSEX", "BSE", "INDEX", 1));
  }

  const value = selectDesk({
    nseIndexes: nse.indexes,
    nseEquities: nse.equities,
    bseIndexes: bseIndexes.map((item) => ({ symbol: item.symbol, scrip: item.bseScrip ?? 1 })),
    bseEquities: [],
  });

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
