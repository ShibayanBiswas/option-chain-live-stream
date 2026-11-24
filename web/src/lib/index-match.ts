export type IndexQuote = {
  group: string;
  name: string;
  last: number | null;
  change: number | null;
  pChange: number | null;
  previousClose: number | null;
  open: number | null;
  symbol?: string;
  spark?: number[];
};

/**
 * The option symbol and the cash-index name are both published by the exchange,
 * but they are not the same string. This crosswalk joins them.
 * An option symbol with no entry still renders; it just has no quote until the chain loads.
 */
const OPTION_INDEX_NAMES: Record<string, string[]> = {
  NIFTY: ["NIFTY 50"],
  NIFTYNXT50: ["NIFTY NEXT 50"],
  BANKNIFTY: ["NIFTY BANK"],
  FINNIFTY: ["NIFTY FIN SERVICE", "NIFTY FINANCIAL SERVICES"],
  MIDCPNIFTY: ["NIFTY MID SELECT", "NIFTY MIDCAP SELECT"],
  NIFTYFPI: ["NIFTY FPI 150"],
  SENSEX: ["SENSEX", "BSE SENSEX"],
  BANKEX: ["BANKEX", "BSE BANKEX"],
  SX50: ["SENSEX 50", "BSE SENSEX 50", "SX50"],
  BSEFOCUSEDIT: ["BSE FOCUSED IT", "BSEFOCUSEDIT"],
};

function compact(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchIndexQuote(symbol: string, quotes: IndexQuote[]): IndexQuote | undefined {
  const names = OPTION_INDEX_NAMES[symbol.toUpperCase()] ?? [symbol];
  const wanted = new Set(names.map(compact));
  return quotes.find((quote) => wanted.has(compact(quote.name)));
}

export function indexDisplayName(symbol: string, quotes: IndexQuote[]): string {
  return matchIndexQuote(symbol, quotes)?.name ?? symbol;
}
