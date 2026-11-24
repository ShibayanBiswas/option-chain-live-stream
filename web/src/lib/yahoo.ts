import { httpsGetJson } from "./http";
import { parseLooseNumber } from "./format";

const YAHOO: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  FINNIFTY: "NIFTY_FIN_SERVICE.NS",
};

export async function getYahooSpot(symbol: string): Promise<number | null> {
  const ysym = YAHOO[symbol.toUpperCase()];
  if (!ysym) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=1m&range=1d`;
    const { data } = await httpsGetJson<{
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
        }>;
      };
    }>(url, {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
    });
    return parseLooseNumber(data.chart?.result?.[0]?.meta?.regularMarketPrice);
  } catch {
    return null;
  }
}
