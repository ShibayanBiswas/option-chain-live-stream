import { buildTotals } from "./analytics";
import { upcomingExpiry } from "./display";
import { expiryIso, toIstIso } from "./expiry";
import { assertBookShape } from "./schema";
import { parseLooseNumber } from "./format";
import { httpsGet, httpsGetJson } from "./http";
import type {
  ChainRow,
  OptionChainSnapshot,
  OptionQuote,
  Segment,
} from "./types";

const NSE_BASE = "https://www.nseindia.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type CookieJar = { cookie: string; primedAt: number };

let jar: CookieJar | null = null;
const COOKIE_TTL_MS = 10 * 60 * 1000;
const expiryCache = new Map<string, { expiries: string[]; at: number }>();
const EXPIRY_TTL_MS = 5 * 60 * 1000;

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${NSE_BASE}/option-chain`,
    ...extra,
  };
}

async function primeSession(force = false): Promise<string> {
  if (!force && jar && Date.now() - jar.primedAt < COOKIE_TTL_MS) {
    return jar.cookie;
  }
  const res = await httpsGet(
    `${NSE_BASE}/option-chain`,
    baseHeaders({ Accept: "text/html,application/xhtml+xml" }),
  );
  jar = { cookie: res.cookies, primedAt: Date.now() };
  return jar.cookie;
}

async function fetchJson<T>(path: string, attempt = 0): Promise<T> {
  await primeSession(attempt > 0);
  try {
    const res = await httpsGetJson<T>(`${NSE_BASE}${path}`, baseHeaders());
    if (jar) {
      jar.cookie = res.cookies;
      jar.primedAt = Date.now();
    }
    return res.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if ((/HTTP 401|HTTP 403/.test(msg) || /ECONNRESET/.test(msg)) && attempt < 2) {
      jar = null;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      return fetchJson<T>(path, attempt + 1);
    }
    throw err;
  }
}

type NseOptionLeg = {
  lastPrice?: number;
  change?: number;
  pChange?: number;
  impliedVolatility?: number;
  openInterest?: number;
  changeinOpenInterest?: number;
  totalTradedVolume?: number;
  buyPrice1?: number;
  buyQuantity1?: number;
  sellPrice1?: number;
  sellQuantity1?: number;
  strikePrice?: number;
  expiryDate?: string;
  underlyingValue?: number;
};

type NseRow = {
  strikePrice?: number;
  expiryDates?: string;
  expiryDate?: string;
  CE?: NseOptionLeg;
  PE?: NseOptionLeg;
};

type NseChainResponse = {
  records?: {
    data?: NseRow[];
    expiryDates?: string[];
    underlyingValue?: number;
    timestamp?: string;
  };
  filtered?: {
    data?: NseRow[];
  };
};

type NseContractInfo = {
  expiryDates?: string[];
};

function mapLeg(leg?: NseOptionLeg): OptionQuote {
  return {
    lastPrice: parseLooseNumber(leg?.lastPrice),
    change: parseLooseNumber(leg?.change),
    pChange: parseLooseNumber(leg?.pChange),
    iv: parseLooseNumber(leg?.impliedVolatility),
    oi: parseLooseNumber(leg?.openInterest),
    oiChg: parseLooseNumber(leg?.changeinOpenInterest),
    volume: parseLooseNumber(leg?.totalTradedVolume),
    bid: parseLooseNumber(leg?.buyPrice1),
    bidQty: parseLooseNumber(leg?.buyQuantity1),
    ask: parseLooseNumber(leg?.sellPrice1),
    askQty: parseLooseNumber(leg?.sellQuantity1),
  };
}

function rowExpiry(row: NseRow): string {
  return String(
    row.expiryDates || row.expiryDate || row.CE?.expiryDate || row.PE?.expiryDate || "",
  );
}

export async function getNseContractInfo(symbol: string): Promise<string[]> {
  const cached = expiryCache.get(symbol);
  if (cached && Date.now() - cached.at < EXPIRY_TTL_MS) return cached.expiries;
  const data = await fetchJson<NseContractInfo>(
    `/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`,
  );
  const expiries = data.expiryDates ?? [];
  expiryCache.set(symbol, { expiries, at: Date.now() });
  return expiries;
}

export async function discoverNseBook(): Promise<{
  indexes: string[];
  equities: string[];
}> {
  const [page, equities] = await Promise.all([
    (async () => {
      await primeSession();
      const res = await httpsGet(
        `${NSE_BASE}/option-chain`,
        baseHeaders({ Accept: "text/html,application/xhtml+xml" }),
      );
      return res.body;
    })(),
    fetchJson<string[]>("/api/master-quote"),
  ]);

  const readSelect = (id: string) => {
    const block = page.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`, "i"));
    if (!block?.[1]) return [];
    return [...block[1].matchAll(/<option[^>]*value="([A-Z0-9&-]+)"/g)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value));
  };
  const indexSelect = readSelect("index_optionchain_select");
  const listedSelect = readSelect("equity_optionchain_select");
  const indexes = indexSelect.length > 0 ? indexSelect : listedSelect.length <= 20 ? listedSelect : [];
  if (indexes.length === 0) {
    throw new Error("NSE index list was empty");
  }

  return {
    indexes,
    equities: (equities ?? []).map((s) => String(s).trim()).filter(Boolean),
  };
}

let marketCache: {
  at: number;
  value: Awaited<ReturnType<typeof readMarketStatus>>;
} | null = null;

async function readMarketStatus() {
  type MarketStatus = {
    marketState?: Array<{
      market?: string;
      marketStatus?: string;
      tradeDate?: string;
      last?: number | string;
      marketStatusMessage?: string;
    }>;
  };
  const data = await fetchJson<MarketStatus>("/api/marketStatus");
  const capital =
    data.marketState?.find((m) => m.market === "Capital Market") ??
    data.marketState?.[0];
  const status = capital?.marketStatus ?? "Unknown";
  const statusKey = String(status).toLowerCase().replace(/\s+/g, "");
  const open = statusKey === "open";
  let phase: "open" | "preopen" | "closed" | "holiday" | "unknown" = "unknown";
  if (statusKey === "open") phase = "open";
  else if (statusKey.includes("preopen") || statusKey.includes("pre-open")) phase = "preopen";
  else if (statusKey.includes("holiday")) phase = "holiday";
  else if (statusKey === "close" || statusKey === "closed") phase = "closed";
  const message =
    phase === "open"
      ? "Market Open"
      : phase === "preopen"
        ? "Pre Open"
        : phase === "holiday"
          ? "Market Holiday"
          : capital?.marketStatusMessage?.includes("Closed")
            ? "Market Closed"
            : capital?.marketStatusMessage || "Market Closed";
  return {
    status,
    tradeDate: capital?.tradeDate ?? "",
    niftyLast: parseLooseNumber(capital?.last),
    message,
    open,
    phase,
  };
}

export async function getNseMarketStatus(): Promise<{
  status: string;
  tradeDate: string;
  niftyLast: number | null;
  message: string;
  open: boolean;
  phase: "open" | "preopen" | "closed" | "holiday" | "unknown";
}> {
  if (marketCache && Date.now() - marketCache.at < 15_000) return marketCache.value;
  const value = await readMarketStatus();
  marketCache = { at: Date.now(), value };
  return value;
}

export async function getNseOptionChain(params: {
  symbol: string;
  expiry?: string;
  type: "Indices" | "Equity";
  segment: Segment;
}): Promise<OptionChainSnapshot> {
  const started = Date.now();
  const expiries = await getNseContractInfo(params.symbol);
  const expiry = upcomingExpiry(expiries, params.expiry ?? "");

  if (!expiry) {
    throw new Error(`No expiries available for ${params.symbol}`);
  }

  const path =
    `/api/option-chain-v3?type=${encodeURIComponent(params.type)}` +
    `&symbol=${encodeURIComponent(params.symbol)}` +
    `&expiry=${encodeURIComponent(expiry)}`;

  const raw = await fetchJson<NseChainResponse>(path);
  const all = raw.records?.data ?? [];
  const filtered = (raw.filtered?.data?.length ? raw.filtered.data : all).filter(
    (row) => {
      const ex = rowExpiry(row);
      return (
        !ex ||
        ex === expiry ||
        ex.replace(/-/g, "") === expiry.replace(/-/g, "")
      );
    },
  );

  const byStrike = new Map<number, ChainRow>();
  for (const row of filtered) {
    const strike = parseLooseNumber(
      row.strikePrice ?? row.CE?.strikePrice ?? row.PE?.strikePrice,
    );
    if (strike === null) continue;
    const existing = byStrike.get(strike) ?? {
      strike,
      ce: mapLeg(),
      pe: mapLeg(),
    };
    if (row.CE) existing.ce = mapLeg(row.CE);
    if (row.PE) existing.pe = mapLeg(row.PE);
    byStrike.set(strike, existing);
  }

  const rows = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);
  const spot = parseLooseNumber(raw.records?.underlyingValue);
  const market = await getNseMarketStatus().catch(() => null);
  const marketOpen = market?.open ?? false;
  assertBookShape({
    strikes: rows.map((row) => row.strike),
    spot,
    expiry,
    expiries,
    segment: params.segment,
  });

  return {
    exchange: "NSE",
    symbol: params.symbol,
    segment: params.segment,
    expiry,
    expiryIso: expiryIso(expiry),
    expiries,
    spot,
    timestamp: toIstIso(raw.records?.timestamp || ""),
    rows,
    totals: buildTotals(rows, spot),
    latencyMs: Date.now() - started,
    source: "nse",
    marketOpen,
    stale: false,
    feed: "rest",
  };
}

export async function getNseTape(): Promise<Array<{ symbol: string; last: number | null; change: number | null }>> {
  const data = await fetchJson<{ data?: Array<Record<string, unknown>> }>("/api/allIndices");
  return (data.data ?? [])
    .map((row) => ({
      symbol: String(row.indexSymbol ?? row.index ?? ""),
      last: parseLooseNumber(row.last),
      change: parseLooseNumber(row.variation ?? row.change),
    }))
    .filter((row) => row.symbol);
}
