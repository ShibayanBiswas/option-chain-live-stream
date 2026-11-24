import { BseBlockedError, discoverBseUnderlyings } from "./bse";
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

function asInstrument(
  symbol: string,
  exchange: Exchange,
  segment: Segment,
  bseScrip?: number,
): Instrument {
  return {
    symbol,
    label: symbol,
    exchange,
    segment,
    nseType: exchange === "NSE" ? (segment === "INDEX" ? "Indices" : "Equity") : undefined,
    bseScrip,
  };
}

export async function loadUniverse(force = false): Promise<DeskUniverse> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const nse = await discoverNseBook();
  let bseIndexes: Instrument[] = [];
  let bseEquities: Instrument[] = [];

  try {
    const [indexes, stocks] = await Promise.all([
      discoverBseUnderlyings("IO"),
      discoverBseUnderlyings("SO").catch(() => []),
    ]);
    bseIndexes = indexes.map((row) =>
      asInstrument(row.symbol.replace(/\s+/g, ""), "BSE", "INDEX", row.scrip),
    );
    bseEquities = stocks.map((row) =>
      asInstrument(row.symbol.replace(/\s+/g, ""), "BSE", "EQUITY", row.scrip),
    );
  } catch (err) {
    if (!(err instanceof BseBlockedError)) {
      console.error("bse universe", err);
    }
    bseIndexes = listCachedBse().map((row) =>
      asInstrument(row.symbol, "BSE", "INDEX", row.scrip),
    );
  }

  const value: DeskUniverse = {
    indexes: [
      ...nse.indexes.map((symbol) => asInstrument(symbol, "NSE", "INDEX")),
      ...bseIndexes,
    ],
    equities: [
      ...nse.equities.map((symbol) => asInstrument(symbol, "NSE", "EQUITY")),
      ...bseEquities,
    ],
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
  const key = symbol.trim().toUpperCase();
  const ex = exchange?.toUpperCase();
  const seg = segment?.toUpperCase();
  const all = [...book.indexes, ...book.equities];
  return (
    all.find(
      (item) =>
        item.symbol.toUpperCase() === key &&
        (!ex || item.exchange === ex) &&
        (!seg || item.segment === seg),
    ) ?? all.find((item) => item.symbol.toUpperCase() === key && (!ex || item.exchange === ex))
  );
}
