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

/** Exchange strings such as `26-Nov-2026` and `26 Nov 2026`. */
export function parseExpiryDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2]!.slice(0, 3).toLowerCase()];
  const year = Number(match[3]);
  if (month == null || day < 1 || day > 31 || year < 2000) return null;
  return new Date(Date.UTC(year, month, day));
}

function istDayUtc(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = parts.split("-").map(Number);
  return Date.UTC(year!, (month ?? 1) - 1, day ?? 1);
}

export function daysToExpiry(value: string, now = new Date()): number | null {
  const expiry = parseExpiryDate(value);
  if (!expiry) return null;
  return Math.round((expiry.getTime() - istDayUtc(now)) / 86_400_000);
}

export function formatDaysToExpiry(days: number | null): string {
  if (days == null) return "";
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function formatExpiryOption(value: string, now = new Date()): string {
  const days = formatDaysToExpiry(daysToExpiry(value, now));
  return days ? `${value} · ${days}` : value;
}

/**
 * The last listed expiry in a calendar month is the monthly contract.
 * Earlier expiries in that month are weekly. Order follows the exchange list.
 */
export function groupExpiries(expiries: string[]): { weekly: string[]; monthly: string[] } {
  const dated = expiries
    .map((expiry) => ({ expiry, date: parseExpiryDate(expiry) }))
    .filter((item): item is { expiry: string; date: Date } => item.date != null);

  const byMonth = new Map<string, { expiry: string; date: Date }[]>();
  for (const item of dated) {
    const key = `${item.date.getUTCFullYear()}-${item.date.getUTCMonth()}`;
    const list = byMonth.get(key) ?? [];
    list.push(item);
    byMonth.set(key, list);
  }

  const monthly = new Set<string>();
  for (const list of byMonth.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    monthly.add(list[list.length - 1]!.expiry);
  }

  const weekly: string[] = [];
  const monthlyList: string[] = [];
  for (const expiry of expiries) {
    if (monthly.has(expiry)) monthlyList.push(expiry);
    else weekly.push(expiry);
  }
  return { weekly, monthly: monthlyList };
}
