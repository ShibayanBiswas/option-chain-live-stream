import { daysToExpiry, isListedExpiryLive } from "./expiry";
import { indexLabel } from "./index-match";

export function displayName(symbol: string, fallback?: string): string {
  return indexLabel(symbol, fallback);
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export type ExpiryInfo = {
  raw: string;
  date: Date;
  days: number;
  bucket: "weekly" | "monthly";
  label: string;
};

function isLastThursday(date: Date): boolean {
  if (date.getDay() !== 4) return false;
  const next = new Date(date);
  next.setDate(date.getDate() + 7);
  return next.getMonth() !== date.getMonth();
}

export function describeExpiry(raw: string, now = new Date()): ExpiryInfo | null {
  const match = raw.trim().match(/(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2]!.toLowerCase()];
  if (month == null || !Number.isFinite(day)) return null;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const date = new Date(year, month, day);
  const days = daysToExpiry(raw, now) ?? 0;
  const lateShift = date.getDay() !== 4 && date.getDate() >= 24;
  const bucket: ExpiryInfo["bucket"] = isLastThursday(date) || lateShift ? "monthly" : "weekly";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pretty = `${String(day).padStart(2, "0")} ${names[month]} ${year}`;
  const when =
    !isListedExpiryLive(raw, now) || days < 0
      ? ""
      : days === 0
        ? "today"
        : days === 1
          ? "1 day"
          : `${days} days`;
  return {
    raw,
    date,
    days,
    bucket,
    label: when ? `${pretty} · ${when}` : raw,
  };
}

const TAPE_ALIASES: Record<string, string> = {
  NIFTY50: "NIFTY",
  NIFTYBANK: "BANKNIFTY",
  NIFTYFINSERVICE: "FINNIFTY",
  NIFTYMIDSELECT: "MIDCPNIFTY",
  NIFTYNEXT50: "NIFTYNXT50",
  NIFTYFPI150: "NIFTYFPI",
  MIDCAPNIFTY: "MIDCPNIFTY",
  SNSX50: "SENSEX50",
  SX50: "SENSEX50",
  SENSEX50: "SX50",
};

export function canonicalTapeSymbol(symbol: string): string {
  const key = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return TAPE_ALIASES[key] ?? key;
}

export function matchTape<T extends { symbol: string; exchange?: string }>(
  symbol: string,
  quotes: T[],
  exchange?: string,
): T | undefined {
  const key = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hits = quotes.filter((quote) => {
    const compact = quote.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return compact === key || TAPE_ALIASES[compact] === key;
  });
  if (!exchange) return hits[0];
  return hits.find((quote) => quote.exchange === exchange) ?? hits.find((quote) => !quote.exchange);
}

/**
 * Monthly is the last listed expiry of each calendar month.
 * Anything more than 120 days out is Long dated, even when it is that month's last expiry.
 */
export function groupExpiries(expiries: string[], now = new Date()) {
  const weekly: ExpiryInfo[] = [];
  const monthly: ExpiryInfo[] = [];
  const longDated: ExpiryInfo[] = [];
  const other: string[] = [];
  const live = expiries
    .map((raw) => {
      const info = describeExpiry(raw, now);
      if (!info) other.push(raw);
      return info;
    })
    .filter((info): info is ExpiryInfo => info != null && isListedExpiryLive(info.raw, now))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const near = live.filter((info) => info.days <= 120);
  const lastOfMonth = new Set<string>();
  const seen = new Map<string, string>();
  for (const info of near) {
    seen.set(`${info.date.getFullYear()}-${info.date.getMonth()}`, info.raw);
  }
  for (const raw of seen.values()) lastOfMonth.add(raw);
  for (const info of live) {
    if (info.days > 120) longDated.push(info);
    else if (lastOfMonth.has(info.raw)) monthly.push(info);
    else weekly.push(info);
  }
  return { weekly, monthly, longDated, other };
}

export function upcomingExpiry(expiries: string[], current: string, now = new Date()): string {
  const pool = liveExpiries(expiries, now);
  if (current && pool.includes(current)) return current;
  return pool[0] ?? "";
}

/** Spot Focus is 18 strikes below the at-the-money strike and 18 above it. Indexes step by 100. Equity keeps the listed strikes. */
export function focusStrikes(
  strikes: number[],
  spot: number | null,
  depth: "near" | "full",
  atm?: number | null,
  segment: "INDEX" | "EQUITY" = "INDEX",
): number[] {
  if (depth === "full" || strikes.length === 0) return strikes;
  const stepped = segment === "INDEX" ? strikes.filter((strike) => strike % 100 === 0) : strikes;
  const book = stepped.length > 0 ? stepped : strikes;
  const anchor = atm ?? spot;
  if (anchor == null) return book;
  let idx = book.indexOf(anchor);
  if (idx < 0) {
    idx = book.reduce(
      (best, strike, index) => (Math.abs(strike - anchor) < Math.abs(book[best]! - anchor) ? index : best),
      0,
    );
  }
  return book.slice(Math.max(0, idx - 18), Math.min(book.length, idx + 19));
}

export function upcomingExpiries(expiries: string[], count: number, now = new Date()): string[] {
  const pool = liveExpiries(expiries, now);
  const n = Math.max(1, Math.min(Math.floor(count) || 1, pool.length));
  return pool.slice(0, n);
}

function liveExpiries(expiries: string[], now: Date): string[] {
  const live = expiries.filter((raw) => isListedExpiryLive(raw, now));
  const pool = (live.length > 0 ? live : expiries).slice();
  pool.sort((a, b) => {
    const da = describeExpiry(a, now)?.date.getTime() ?? 0;
    const db = describeExpiry(b, now)?.date.getTime() ?? 0;
    return da - db;
  });
  return pool;
}
