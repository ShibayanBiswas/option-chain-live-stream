/**
 * Display names for option symbols. This map never decides which instruments exist.
 * Discovery in universe.ts is the only source of the book.
 */
const LABELS: Record<string, string> = {
  NIFTY: "NIFTY 50",
  BANKNIFTY: "NIFTY BANK",
  FINNIFTY: "NIFTY FIN SERVICE",
  MIDCPNIFTY: "NIFTY MID SELECT",
  NIFTYNXT50: "NIFTY NEXT 50",
  NIFTYFPI: "NIFTY FPI",
  SENSEX: "SENSEX",
  BANKEX: "BANKEX",
  SX50: "SENSEX 50",
  SENSEX50: "SENSEX 50",
  BSEFOCUSEDIT: "BSE Focused IT",
  ANANDRATHI: "Anand Rathi Wealth",
};

export function indexLabel(symbol: string, fallback?: string): string {
  const key = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return LABELS[key] ?? fallback ?? symbol;
}
