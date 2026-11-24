export type Exchange = "NSE" | "BSE";
export type Segment = "INDEX" | "EQUITY";

export type OptionQuote = {
  lastPrice: number | null;
  change: number | null;
  pChange: number | null;
  iv: number | null;
  oi: number | null;
  oiChg: number | null;
  volume: number | null;
  bid: number | null;
  bidQty: number | null;
  ask: number | null;
  askQty: number | null;
};

export type ChainRow = {
  strike: number;
  ce: OptionQuote;
  pe: OptionQuote;
};

export type ChainTotals = {
  ceOi: number;
  peOi: number;
  ceOiChg: number;
  peOiChg: number;
  ceVolume: number;
  peVolume: number;
  pcr: number | null;
  maxPain: number | null;
  atm: number | null;
  atmIv: number | null;
};

export type OptionChainSnapshot = {
  exchange: Exchange;
  symbol: string;
  segment: Segment;
  expiry: string;
  expiries: string[];
  spot: number | null;
  timestamp: string;
  rows: ChainRow[];
  totals: ChainTotals;
  latencyMs: number;
  source: "nse" | "bse";
  marketOpen: boolean;
  feed: "websocket" | "rest";
  pcrSeries?: { t: string; pcr: number }[];
  stale?: boolean;
};

export type Instrument = {
  symbol: string;
  label: string;
  exchange: Exchange;
  segment: Segment;
  nseType?: "Indices" | "Equity";
  bseScrip?: number;
  bseProduct?: "IO" | "SO";
};

export type MetaResponse = {
  indexes: Instrument[];
  equities: Instrument[];
  market: {
    status: string;
    tradeDate: string;
    niftyLast: number | null;
    message: string;
  };
  serverTimeIst: string;
};

export type ColumnKey =
  | "oi"
  | "oiChg"
  | "volume"
  | "iv"
  | "ltp"
  | "chng"
  | "bidQty"
  | "bid"
  | "ask"
  | "askQty";
