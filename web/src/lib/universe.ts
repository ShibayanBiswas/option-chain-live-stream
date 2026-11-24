import { deskBook } from "./book";
import { BseBlockedError, discoverBseUnderlyings } from "./bse";
import { listCachedBse } from "./bse-cache";
import { isAnandRathiSymbol } from "./equity";
import { logEvent } from "./log";
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
  bseProduct?: "IO" | "SO",
): Instrument {
  return {
    symbol,
    label: symbol,
    exchange,
    segment,
    nseType: exchange === "NSE" ? (segment === "INDEX" ? "Indices" : "Equity") : undefined,
    bseScrip,
    bseProduct,
  };
}

export function clearUniverseCache() {
  cache = null;
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
      asInstrument(row.symbol.replace(/\s+/g, ""), "BSE", "INDEX", row.scrip, "IO"),
    );
    bseEquities = stocks
      .filter((row) => isAnandRathiSymbol(row.symbol))
      .map((row) => asInstrument(row.symbol.replace(/\s+/g, ""), "BSE", "EQUITY", row.scrip, "SO"));
  } catch (err) {
    if (!(err instanceof BseBlockedError)) {
      logEvent("error", "bse universe", { error: err instanceof Error ? err.message : String(err) });
    }
    bseIndexes = listCachedBse().map((row) =>
      asInstrument(row.symbol, "BSE", "INDEX", row.scrip, "IO"),
    );
  }

  const shaped = deskBook(
    [
      ...nse.indexes.map((symbol) => asInstrument(symbol, "NSE", "INDEX")),
      ...bseIndexes,
    ],
    [
      ...nse.equities.filter(isAnandRathiSymbol).map((symbol) => asInstrument(symbol, "NSE", "EQUITY")),
      ...bseEquities,
    ],
  );
  const value: DeskUniverse = {
    ...shaped,
    refreshedAt: new Date().toISOString(),
  };

  if (value.indexes.length > 0) cache = { at: Date.now(), value };
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
