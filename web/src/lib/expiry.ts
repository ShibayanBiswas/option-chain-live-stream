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

const MONTH_NAME = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type CalendarDate = { year: number; month: number; day: number };

export function parseExpiryDate(value: string): CalendarDate | null {
  const match = value.trim().match(/(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{2,4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2]!.slice(0, 3).toLowerCase()];
  let year = Number(match[3]);
  if (month == null || day < 1 || day > 31) return null;
  if (year < 100) year += 2000;
  return { year, month: month + 1, day };
}

export function istClock(now = new Date()): CalendarDate & { minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag: Record<string, string> = {};
  for (const part of parts) bag[part.type] = part.value;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    minutes: hour * 60 + Number(bag.minute),
  };
}

function keyOf(date: CalendarDate): number {
  return date.year * 10_000 + date.month * 100 + date.day;
}

/** A contract is live through 15:30 IST on expiry day, then it is past. */
export function isListedExpiryLive(value: string, now = new Date()): boolean {
  const expiry = parseExpiryDate(value);
  if (!expiry) return true;
  const clock = istClock(now);
  const expiryKey = keyOf(expiry);
  const todayKey = keyOf(clock);
  if (expiryKey < todayKey) return false;
  if (expiryKey === todayKey && clock.minutes >= 15 * 60 + 30) return false;
  return true;
}

/** Years from now until 15:30 IST on expiry, with a one-minute floor. Zero after the close. */
export function yearFractionToExpiry(value: string, now = new Date()): number {
  const iso = expiryIso(value);
  if (!iso) return 0;
  const close = Date.parse(`${iso}T15:30:00+05:30`);
  if (!Number.isFinite(close)) return 0;
  const remain = close - now.getTime();
  if (remain <= 0) return 0;
  return Math.max(remain, 60_000) / (365 * 86_400_000);
}

export function daysToExpiry(value: string, now = new Date()): number | null {
  const expiry = parseExpiryDate(value);
  if (!expiry) return null;
  const clock = istClock(now);
  const expiryUtc = Date.UTC(expiry.year, expiry.month - 1, expiry.day);
  const todayUtc = Date.UTC(clock.year, clock.month - 1, clock.day);
  return Math.round((expiryUtc - todayUtc) / 86_400_000);
}

export function expiryIso(value: string): string | null {
  const date = parseExpiryDate(value);
  if (!date) return null;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

export function expiryLabel(value: string, now = new Date()): string {
  const iso = expiryIso(value);
  const date = parseExpiryDate(value);
  const shown = date ? `${String(date.day).padStart(2, "0")} ${MONTH_NAME[date.month - 1]} ${date.year}` : value;
  const days = daysToExpiry(value, now);
  if (!isListedExpiryLive(value, now) || days == null || days < 0) return iso ?? shown;
  if (days === 0) return `${shown} · today`;
  if (days === 1) return `${shown} · 1 day`;
  return `${shown} · ${days} days`;
}

/** Exchange clocks are IST. Always emit an offset timestamp. */
export function toIstIso(value: string, fallback = new Date()): string {
  const match = value.trim().match(
    /(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{2,4})(?:[ T|]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const clock = istClock(parsed);
      const month = String(clock.month).padStart(2, "0");
      const day = String(clock.day).padStart(2, "0");
      const hour = String(Math.floor(clock.minutes / 60)).padStart(2, "0");
      const minute = String(clock.minutes % 60).padStart(2, "0");
      return `${clock.year}-${month}-${day}T${hour}:${minute}:00+05:30`;
    }
    return toIstIso(fallback.toISOString());
  }
  const date = parseExpiryDate(match[0]);
  if (!date) return toIstIso(fallback.toISOString());
  const hour = String(Number(match[4] ?? 0)).padStart(2, "0");
  const minute = String(Number(match[5] ?? 0)).padStart(2, "0");
  const second = String(Number(match[6] ?? 0)).padStart(2, "0");
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
}

export function istClockLabel(value: string): string {
  const iso = toIstIso(value);
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]} IST` : value;
}
