import { httpsGetJson } from "./http";
import { parseLooseNumber } from "./format";

const YAHOO: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  FINNIFTY: "NIFTY_FIN_SERVICE.NS",
  ANANDRATHI: "ANANDRATHI.NS",
};

const BOOK_SPOTS: Array<{ symbol: string; exchange: "NSE" | "BSE"; yahoo: string }> = [
  { symbol: "SENSEX", exchange: "BSE", yahoo: "^BSESN" },
  { symbol: "ANANDRATHI", exchange: "NSE", yahoo: "ANANDRATHI.NS" },
  { symbol: "ANANDRATHI", exchange: "BSE", yahoo: "ANANDRATHI.BO" },
];

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
    }>;
  };
};

async function readYahoo(ysym: string): Promise<{ last: number | null; change: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=1m&range=1d`;
    const { data } = await httpsGetJson<YahooChart>(url, {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json",
    });
    const meta = data.chart?.result?.[0]?.meta;
    const last = parseLooseNumber(meta?.regularMarketPrice);
    const prev = parseLooseNumber(meta?.chartPreviousClose ?? meta?.previousClose);
    const change = last != null && prev != null ? Math.round((last - prev) * 100) / 100 : null;
    return { last, change };
  } catch {
    return { last: null, change: null };
  }
}

export async function getSupplementSpots(): Promise<
  Array<{ symbol: string; exchange: "NSE" | "BSE"; last: number | null; change: number | null }>
> {
  const rows = await Promise.all(
    BOOK_SPOTS.map(async (item) => ({
      symbol: item.symbol,
      exchange: item.exchange,
      delayed: true,
      ...(await readYahoo(item.yahoo)),
    })),
  );
  return rows.filter((row) => row.last != null);
}

export async function getYahooSpot(symbol: string): Promise<number | null> {
  const ysym = YAHOO[symbol.toUpperCase()];
  if (!ysym) return null;
  return (await readYahoo(ysym)).last;
}
