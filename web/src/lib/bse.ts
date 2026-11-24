import { buildTotals } from "./analytics";
import { parseLooseNumber } from "./format";
import { httpsGet, httpsGetJson } from "./http";
import type { IndexQuote } from "./index-match";
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

/**
 * BSE publishes index codes on its own site: 16 SENSEX, 53 BANKEX, 134 Focused IT.
 * SENSEX 50 is resolved from the exchange index list when that list is reachable.
 */
const BSE_INDEX_CODES: Array<{ symbol: string; code: string; name: string }> = [
  { symbol: "SENSEX", code: "16", name: "BSE SENSEX" },
  { symbol: "BANKEX", code: "53", name: "BSE BANKEX" },
  { symbol: "BSEFOCUSEDIT", code: "134", name: "BSE Focused IT" },
];

export function readBseSeries(payload: unknown): { prevClose: number | null; points: number[] } | null {
  let prevClose: number | null = null;
  let series: unknown = payload;

  if (typeof payload === "string" && payload.includes("#@#")) {
    const [head, tail] = payload.split("#@#");
    try {
      const parsed = JSON.parse(head ?? "null") as unknown;
      const row = Array.isArray(parsed) ? parsed[0] : parsed;
      prevClose = parseLooseNumber((row as { PreClose?: unknown; PrevClose?: unknown })?.PreClose ?? (row as { PrevClose?: unknown })?.PrevClose);
    } catch {
      prevClose = null;
    }
    try {
      series = JSON.parse(tail ?? "null");
    } catch {
      series = null;
    }
  } else if (payload && typeof payload === "object") {
    const record = payload as { Data?: unknown; PrevClose?: unknown; PreClose?: unknown };
    prevClose = parseLooseNumber(record.PrevClose ?? record.PreClose);
    if (typeof record.Data === "string") {
      try {
        series = JSON.parse(record.Data);
      } catch {
        series = record.Data;
      }
    } else if (record.Data != null) {
      series = record.Data;
    }
  }

  const points = collectPrices(series);
  if (prevClose == null && points.length === 0) return null;
  return { prevClose, points };
}

function collectPrices(value: unknown): number[] {
  if (Array.isArray(value)) {
    const numbers = value.map((item) => {
      if (typeof item === "number") return item;
      if (Array.isArray(item)) return parseLooseNumber(item[item.length - 1]);
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return parseLooseNumber(row.ltp ?? row.LTP ?? row.close ?? row.Close ?? row.price ?? row.value ?? row.currvalue ?? row.IndexValue);
      }
      return parseLooseNumber(item);
    });
    return numbers.filter((item): item is number => item != null && item > 0);
  }
  return [];
}

export async function getBseIndexBoard(): Promise<IndexQuote[]> {
  const quotes: IndexQuote[] = [];
  const sensex = await readIndexPayload(`${BSE_API}/BseIndiaAPI/api/IndexSensexData1/w`).catch(() => null);
  if (sensex) quotes.push(toIndexQuote("SENSEX", "BSE SENSEX", sensex));

  let sensex50Code: string | null = null;
  try {
    const list = await bseGet<unknown>(`${BSE_API}/BseIndiaAPI/api/FillddlIndex/w?fmdt=&todt=`);
    sensex50Code = findSensex50Code(list);
  } catch {
    sensex50Code = null;
  }

  const graphs = [
    ...BSE_INDEX_CODES.filter((item) => item.symbol !== "SENSEX" || quotes.length === 0),
    ...(sensex50Code && sensex50Code !== "98" ? [{ symbol: "SX50", code: sensex50Code, name: "BSE SENSEX 50" }] : []),
    { symbol: "SX50", code: "98", name: "BSE SENSEX 50" },
  ];

  for (const item of graphs) {
    if (quotes.some((quote) => quote.name === item.name || compactName(quote.name) === compactName(item.symbol))) continue;
    const series = await readIndexPayload(
      `${BSE_API}/BseIndiaAPI/api/SensexGraphData/w?index=${item.code}&flag=0&sector=&seriesid=R&frd=null&tod=null`,
    ).catch(() => null);
    if (!series || (series.points.length === 0 && series.prevClose == null)) continue;
    quotes.push(toIndexQuote(item.symbol, item.name, series));
  }

  return quotes.filter((quote) => quote.last != null);
}

function compactName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function findSensex50Code(payload: unknown): string | null {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { Table?: unknown[] }).Table ?? Object.values(payload as object))
      : [];
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const label = String(record.Index_Name ?? record.indxnm ?? record.INDEX_NAME ?? record.name ?? "");
    if (!/SENSEX\s*50/i.test(label)) continue;
    const code = record.Index_Code ?? record.indxcode ?? record.code ?? record.INDEX_CODE;
    if (code != null && String(code).trim()) return String(code).trim();
  }
  return null;
}

async function readIndexPayload(url: string): Promise<{ prevClose: number | null; points: number[] } | null> {
  const data = await bseGet<unknown>(url);
  return readBseSeries(data);
}

function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => values[Math.round(index * step)]!);
}

function toIndexQuote(
  symbol: string,
  name: string,
  series: { prevClose: number | null; points: number[] },
): IndexQuote {
  const last = series.points.length ? series.points[series.points.length - 1]! : series.prevClose;
  const change = last != null && series.prevClose != null ? last - series.prevClose : null;
  const spark = downsample(series.points.length > 1 ? series.points : [series.prevClose, last].filter((value): value is number => value != null && value > 0), 32);
  return {
    group: "BSE",
    name: name || symbol,
    last,
    change,
    pChange: change != null && series.prevClose ? (change / series.prevClose) * 100 : null,
    previousClose: series.prevClose,
    open: series.points[0] ?? null,
    symbol,
    spark,
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

export async function getBseExpiries(scripCd: number, product: "IO" | "SO" = "IO"): Promise<string[]> {
  const data = await bseGet<{ Table?: ExpiryRow[] }>(
    `${BSE_API}/BseIndiaAPI/api/ddlExpiry/w?ProductType=${product}&scrip_cd=${scripCd}`,
  );
  return (data.Table ?? [])
    .map((r) => r.eXPIRY)
    .filter((v): v is string => Boolean(v));
}

export async function getBseOptionChain(params: {
  symbol: string;
  scripCd: number;
  expiry?: string;
  product?: "IO" | "SO";
}): Promise<OptionChainSnapshot> {
  const started = Date.now();
  const product = params.product ?? "IO";
  const expiries = await getBseExpiries(params.scripCd, product);
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
