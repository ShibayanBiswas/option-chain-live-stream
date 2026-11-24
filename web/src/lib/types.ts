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
  ceVolume: number;
  peVolume: number;
  pcr: number | null;
  maxPain: number | null;
  atm: number | null;
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
};

export type Instrument = {
  symbol: string;
  label: string;
  exchange: Exchange;
  segment: Segment;
  nseType?: "Indices" | "Equity";
  bseScrip?: number;
  last?: number | null;
  change?: number | null;
};

export type TapeQuote = {
  symbol: string;
  last: number | null;
  change: number | null;
  exchange?: Exchange;
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
