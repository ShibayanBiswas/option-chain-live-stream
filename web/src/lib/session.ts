export type SessionPhase = "open" | "pre-open" | "closed" | "holiday";

export type SessionInfo = {
  phase: SessionPhase;
  open: boolean;
  label: string;
};

/**
 * Classify an exchange status string. The words come from the exchange payload
 * (open, pre-open, close, holiday). Nothing here is a clock or a holiday table.
 */
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
