import { buildTotals } from "./analytics";
import { parseLooseNumber } from "./format";
import { httpsGet, httpsGetJson } from "./http";
import type { ChainRow, OptionChainSnapshot, OptionQuote } from "./types";

const BSE_WWW = "https://www.bseindia.com";
const BSE_API = "https://api.bseindia.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36";

export class BseBlockedError extends Error {
  constructor(message = "Chain unavailable") {
    super(message);
    this.name = "BseBlockedError";
  }
}

let primedAt = 0;
let cookie = "";

function headers(json = true): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: json
      ? "application/json, text/plain, */*"
      : "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${BSE_WWW}/markets/Derivatives/DeriReports/DeriOptionchain`,
    Origin: BSE_WWW,
  };
}

async function prime() {
  if (Date.now() - primedAt < 5 * 60 * 1000 && cookie) return;
  const res = await httpsGet(
    `${BSE_WWW}/markets/Derivatives/DeriReports/DeriOptionchain`,
    headers(false),
    cookie,
  );
  cookie = res.cookies;
  primedAt = Date.now();
}

async function bseGet<T>(url: string): Promise<T> {
  await prime();
  try {
    const res = await httpsGetJson<T>(url, headers(true), cookie);
    cookie = res.cookies;
    return res.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/HTTP 401|HTTP 403|Access Denied/i.test(msg)) {
      throw new BseBlockedError(msg);
    }
    throw err;
  }
}

type ExpiryRow = { eXPIRY?: string; End_TimeStamp?: string };
type ChainApiRow = Record<string, string | number | null | undefined>;

function mapCe(row: ChainApiRow): OptionQuote {
  return {
    lastPrice: parseLooseNumber(row.C_Last_Trd_Price),
    change: parseLooseNumber(row.C_NetChange),
    pChange: null,
    iv: parseLooseNumber(row.C_IV),
    oi: parseLooseNumber(row.C_Open_Interest),
    oiChg: parseLooseNumber(row.C_Absolute_Change_OI),
    volume: parseLooseNumber(row.C_Vol_Traded),
    bid: parseLooseNumber(row.C_BidPrice),
    bidQty: parseLooseNumber(row.C_BIdQty),
    ask: parseLooseNumber(row.C_OfferPrice),
    askQty: parseLooseNumber(row.C_OfferQty),
  };
}

function mapPe(row: ChainApiRow): OptionQuote {
  return {
    lastPrice: parseLooseNumber(row.Last_Trd_Price),
    change: parseLooseNumber(row.NetChange),
    pChange: null,
    iv: parseLooseNumber(row.IV),
    oi: parseLooseNumber(row.Open_Interest),
    oiChg: parseLooseNumber(row.Absolute_Change_OI),
    volume: parseLooseNumber(row.Vol_Traded),
    bid: parseLooseNumber(row.BidPrice),
    bidQty: parseLooseNumber(row.BIdQty),
    ask: parseLooseNumber(row.OfferPrice),
    askQty: parseLooseNumber(row.OfferQty),
  };
}

export async function discoverBseUnderlyings(
  product: "IO" | "SO",
): Promise<Array<{ symbol: string; scrip: number }>> {
  const data = await bseGet<{
    Table?: Array<{ UlaCODE?: string; scrip_cd?: number }>;
  }>(
    `${BSE_API}/BseIndiaAPI/api/ddlUnderlyingAsset/w?ProductType=${product}&scrip_cd=0`,
  );
  return (data.Table ?? [])
    .map((row) => ({
      symbol: String(row.UlaCODE ?? "")
        .trim()
        .replace(/\s+/g, " "),
      scrip: Number(row.scrip_cd ?? 0),
    }))
    .filter((row) => row.symbol && row.scrip > 0);
}

export async function getBseExpiries(scripCd: number): Promise<string[]> {
  const data = await bseGet<{ Table?: ExpiryRow[] }>(
    `${BSE_API}/BseIndiaAPI/api/ddlExpiry/w?ProductType=IO&scrip_cd=${scripCd}`,
  );
  return (data.Table ?? [])
    .map((r) => r.eXPIRY)
    .filter((v): v is string => Boolean(v));
}

export async function getBseOptionChain(params: {
  symbol: string;
  scripCd: number;
  expiry?: string;
}): Promise<OptionChainSnapshot> {
  const started = Date.now();
  const expiries = await getBseExpiries(params.scripCd);
  const expiry =
    params.expiry && expiries.includes(params.expiry)
      ? params.expiry
      : (expiries[0] ?? "");
  if (!expiry) throw new Error(`No BSE expiries for ${params.symbol}`);

  const data = await bseGet<{
    Table?: ChainApiRow[];
    ASON?: { DT_TM?: string };
  }>(
    `${BSE_API}/BseIndiaAPI/api/DerivOptionChain_IV/w?Expiry=${encodeURIComponent(expiry)}&scrip_cd=${params.scripCd}&strprice=0`,
  );

  const rows: ChainRow[] = (data.Table ?? [])
    .map((row) => {
      const strike = parseLooseNumber(row.Strike_Price1 ?? row.Strike_Price);
      if (strike === null) return null;
      return { strike, ce: mapCe(row), pe: mapPe(row) };
    })
    .filter((r): r is ChainRow => r !== null)
    .sort((a, b) => a.strike - b.strike);

  const spot = parseLooseNumber(data.Table?.[0]?.UlaValue);

  return {
    exchange: "BSE",
    symbol: params.symbol,
    segment: "INDEX",
    expiry,
    expiries,
    spot,
    timestamp: data.ASON?.DT_TM?.trim() || new Date().toISOString(),
    rows,
    totals: buildTotals(rows, spot),
    latencyMs: Date.now() - started,
    source: "bse",
    marketOpen: false,
    feed: "rest",
  };
}
