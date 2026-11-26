import { BseBlockedError, discoverBseUnderlyings } from "./bse";
import { listCachedBse } from "./bse-cache";
import { deskScope, type DeskScope } from "./config";
import { indexLabel } from "./index-match";
import { discoverNseBook } from "./nse";
import type { Exchange, Instrument, Segment } from "./types";

export type DeskUniverse = {
  indexes: Instrument[];
  equities: Instrument[];
  refreshedAt: string;
  stale?: boolean;
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

export function splitPinned<T extends { symbol: string }>(rows: T[], pin: string): { lead: T[]; more: T[] } {
  return {
    lead: rows.filter((row) => row.symbol === pin),
    more: rows.filter((row) => row.symbol !== pin),
  };
}

function pinFirst(rows: Instrument[], pin: string): Instrument[] {
  return [...rows].sort((a, b) => {
    if (a.symbol === pin) return -1;
    if (b.symbol === pin) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function selectDesk(
  input: {
    nseIndexes: string[];
    nseEquities: string[];
    bseIndexes: Array<{ symbol: string; scrip: number }>;
    bseEquities: Array<{ symbol: string; scrip: number }>;
  },
  scope: DeskScope = deskScope(),
): DeskUniverse {
  const nse = input.nseIndexes.map((symbol) => asInstrument(symbol, "NSE", "INDEX"));
  const bse = input.bseIndexes.map((row) => asInstrument(row.symbol, "BSE", "INDEX", row.scrip));
  const indexes = [
    ...pinFirst(scope === "core" ? nse.filter((item) => item.symbol === "NIFTY") : nse, "NIFTY"),
    ...pinFirst(scope === "core" ? bse.filter((item) => item.symbol === "SENSEX") : bse, "SENSEX"),
  ];
  const equities: Instrument[] = [];
  if (input.nseEquities.some((symbol) => isWealthEquity(symbol))) {
    equities.push(asInstrument(WEALTH_EQUITY, "NSE", "EQUITY"));
  }
  const bseWealth = input.bseEquities.find((row) => isWealthEquity(row.symbol));
  if (bseWealth) equities.push(asInstrument(WEALTH_EQUITY, "BSE", "EQUITY", bseWealth.scrip));
  return { indexes, equities, refreshedAt: new Date().toISOString() };
}

function isWealthEquity(symbol: string): boolean {
  const key = symbol.replace(/\s+/g, "").toUpperCase();
  return key === WEALTH_EQUITY || key === "ANANDRATHIWEALTH";
}

export async function loadUniverse(force = false): Promise<DeskUniverse> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const nse = await discoverNseBook();
  let stale = false;
  let bseIndexes: Array<{ symbol: string; scrip: number }> = [];
  let bseEquities: Array<{ symbol: string; scrip: number }> = [];

  try {
    bseIndexes = (await discoverBseUnderlyings("IO")).map((row) => ({
      symbol: row.symbol.replace(/\s+/g, ""),
      scrip: row.scrip,
    }));
  } catch (err) {
    if (!(err instanceof BseBlockedError)) console.error("bse universe", err);
    stale = true;
    bseIndexes = listCachedBse().map((row) => ({ symbol: row.symbol, scrip: row.scrip }));
  }

  try {
    bseEquities = (await discoverBseUnderlyings("SO"))
      .filter((row) => isWealthEquity(row.symbol))
      .map((row) => ({ symbol: row.symbol.replace(/\s+/g, ""), scrip: row.scrip }));
  } catch (err) {
    if (!(err instanceof BseBlockedError)) console.error("bse equity", err);
    stale = true;
  }

  const value = selectDesk({
    nseIndexes: nse.indexes,
    nseEquities: nse.equities,
    bseIndexes,
    bseEquities,
  });
  value.stale = stale;

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
