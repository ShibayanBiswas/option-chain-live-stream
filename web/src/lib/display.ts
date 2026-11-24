const LABELS: Record<string, string> = {
  NIFTY: "NIFTY 50",
  BANKNIFTY: "BANK NIFTY",
  FINNIFTY: "FIN NIFTY",
  MIDCPNIFTY: "MIDCAP NIFTY",
  NIFTYNXT50: "NIFTY NEXT 50",
  SENSEX: "SENSEX",
  BANKEX: "BANKEX",
  SENSEX50: "SENSEX 50",
  SX50: "SENSEX 50",
  ANANDRATHI: "Anand Rathi Wealth",
};

export function displayName(symbol: string, fallback?: string): string {
  const key = symbol.replace(/\s+/g, "").toUpperCase();
  return LABELS[key] ?? fallback ?? symbol;
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
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  const lateShift = date.getDay() !== 4 && date.getDate() >= 24;
  const bucket: ExpiryInfo["bucket"] = isLastThursday(date) || lateShift ? "monthly" : "weekly";
  const when = days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
  return {
    raw,
    date,
    days,
    bucket,
    label: `${raw} · ${when}`,
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

export function matchTape<T extends { symbol: string }>(symbol: string, quotes: T[]): T | undefined {
  const key = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return quotes.find((quote) => {
    const compact = quote.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return compact === key || TAPE_ALIASES[compact] === key;
  });
}

export function groupExpiries(expiries: string[], now = new Date()) {
  const weekly: ExpiryInfo[] = [];
  const monthly: ExpiryInfo[] = [];
  const other: string[] = [];
  for (const raw of expiries) {
    const info = describeExpiry(raw, now);
    if (!info) {
      other.push(raw);
      continue;
    }
    (info.bucket === "monthly" ? monthly : weekly).push(info);
  }
  return { weekly, monthly, other };
}
