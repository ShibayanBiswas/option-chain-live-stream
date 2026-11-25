import { istClock, parseExpiryDate } from "./expiry";

export type SessionPhase = "open" | "pre-open" | "closed" | "holiday";

export type SessionInfo = {
  phase: SessionPhase;
  open: boolean;
  label: string;
};

/** Words come from the exchange payload. This is not a local holiday calendar. */
export function classifySession(status: string, message = ""): SessionInfo {
  const statusText = status.trim().toLowerCase();
  const blob = `${statusText} ${message}`.toLowerCase();
  if (blob.includes("holiday")) {
    return { phase: "holiday", open: false, label: "Market Holiday" };
  }
  if (/pre[\s-]*open/.test(blob)) {
    return { phase: "pre-open", open: false, label: "Pre-Open" };
  }
  if (statusText === "open" || statusText === "opening") {
    return { phase: "open", open: true, label: "Market Open" };
  }
  return { phase: "closed", open: false, label: "Market Closed" };
}

const CLOSED: SessionInfo = { phase: "closed", open: false, label: "Market Closed" };

/**
 * The exchange sometimes keeps yesterday's "Open" after the close.
 * Cash hours are 09:15–15:30 IST. A trade date before today is not this session.
 */
export function gateSession(info: SessionInfo, tradeDate: string, now = new Date()): SessionInfo {
  if (info.phase === "holiday") return info;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
  if (weekday === "Sat" || weekday === "Sun") return CLOSED;
  const clock = istClock(now);
  const listed = parseExpiryDate(tradeDate);
  const previousDay =
    listed != null &&
    (listed.year < clock.year ||
      (listed.year === clock.year && listed.month < clock.month) ||
      (listed.year === clock.year && listed.month === clock.month && listed.day < clock.day));
  if (previousDay) return CLOSED;
  if (info.open && (clock.minutes < 9 * 60 + 15 || clock.minutes >= 15 * 60 + 30)) return CLOSED;
  return info;
}
