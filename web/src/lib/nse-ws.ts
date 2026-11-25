import WebSocket from "ws";

import { findAtmStrike, percentChange } from "./analytics";
import type { CellTuple } from "./diff";
import type { OptionChainSnapshot, OptionQuote } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36";

const PRICE_FIELDS = ["lastPrice", "change", "bid", "bidQty", "ask", "askQty", "volume"] as const;

const FIELD_KEY: Record<(typeof PRICE_FIELDS)[number], CellTuple[2]> = {
  lastPrice: "ltp",
  change: "chng",
  bid: "bid",
  bidQty: "bidQty",
  ask: "ask",
  askQty: "askQty",
  volume: "volume",
};

export type OptionTick = {
  strike: number;
  timestamp: string | null;
  ce?: Partial<OptionQuote>;
  pe?: Partial<OptionQuote>;
};

type Leg = {
  lastPrice?: number;
  change?: number;
  buyPrice1?: number;
  buyQuantity1?: number;
  sellPrice1?: number;
  sellQuantity1?: number;
  totalTradedVolume?: number;
};

/** "2026-11-25 14:24:01" is IST. A date with no clock is not a tick time. */
export function istTickTime(raw: string | undefined): string | null {
  const match = raw?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  return `${match[1]}T${match[2]}+05:30`;
}

function mapLeg(leg?: Leg | null): Partial<OptionQuote> | undefined {
  if (!leg) return undefined;
  return {
    lastPrice: numberOrNull(leg.lastPrice),
    change: numberOrNull(leg.change),
    bid: numberOrNull(leg.buyPrice1),
    bidQty: numberOrNull(leg.buyQuantity1),
    ask: numberOrNull(leg.sellPrice1),
    askQty: numberOrNull(leg.sellQuantity1),
    volume: numberOrNull(leg.totalTradedVolume),
  };
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function paint(
  quote: OptionQuote,
  partial: Partial<OptionQuote> | undefined,
  strike: number,
  side: "ce" | "pe",
  cells: CellTuple[],
): OptionQuote {
  if (!partial) return quote;
  const next = { ...quote };
  for (const key of PRICE_FIELDS) {
    const value = partial[key];
    if (value == null || next[key] === value) continue;
    if (key === "volume" && next.volume != null && value < next.volume) continue;
    next[key] = value;
    cells.push([strike, side, FIELD_KEY[key], value]);
  }
  const pChange = percentChange(next.lastPrice, next.change);
  if (pChange != null && next.pChange !== pChange) {
    next.pChange = pChange;
    cells.push([strike, side, "pChg", pChange]);
  }
  return next;
}

/** Overlay a price tick. Open interest and IV stay on the quote the chain API supplied. */
export function applyOptionTick(
  snapshot: OptionChainSnapshot,
  tick: OptionTick,
): { snapshot: OptionChainSnapshot; cells: CellTuple[] } | null {
  if (tick.timestamp && tick.timestamp < snapshot.timestamp) return null;
  const index = snapshot.rows.findIndex((row) => row.strike === tick.strike);
  const row = snapshot.rows[index];
  if (!row) return null;
  const cells: CellTuple[] = [];
  const ce = paint(row.ce, tick.ce, tick.strike, "ce", cells);
  const pe = paint(row.pe, tick.pe, tick.strike, "pe", cells);
  if (cells.length === 0) return null;
  const rows = snapshot.rows.slice();
  rows[index] = { ...row, ce, pe };
  return {
    cells,
    snapshot: {
      ...snapshot,
      rows,
      feed: "websocket",
      timestamp:
        tick.timestamp && tick.timestamp > snapshot.timestamp ? tick.timestamp : snapshot.timestamp,
    },
  };
}

/** Copy open interest and IV from a chain refresh onto the book the socket is updating. */
export function overlayContractFields(current: OptionChainSnapshot, fresh: OptionChainSnapshot): OptionChainSnapshot {
  const incoming = new Map(fresh.rows.map((row) => [row.strike, row]));
  const spot = fresh.timestamp >= current.timestamp ? (fresh.spot ?? current.spot) : current.spot;
  return {
    ...current,
    marketOpen: fresh.marketOpen,
    totals: { ...fresh.totals, atm: findAtmStrike(spot, current.rows.map((row) => row.strike)) },
    spot,
    rows: current.rows.map((row) => {
      const next = incoming.get(row.strike);
      if (!next) return row;
      return {
        ...row,
        ce: { ...row.ce, oi: next.ce.oi, oiChg: next.ce.oiChg, iv: next.ce.iv },
        pe: { ...row.pe, oi: next.pe.oi, oiChg: next.pe.oiChg, iv: next.pe.iv },
      };
    }),
  };
}

export function openNseOptionSocket(
  symbol: string,
  expiry: string,
  onTick: (tick: OptionTick) => void,
  onStatus: (state: "open" | "closed" | "error", detail?: string) => void,
): WebSocket {
  const url =
    `wss://streamer.nseindia.com/streams/fo/mbp?symbol=${encodeURIComponent(symbol)}` +
    `&expiry=${encodeURIComponent(expiry)}`;
  const socket = new WebSocket(url, {
    headers: {
      Origin: "https://www.nseindia.com",
      "User-Agent": UA,
    },
    handshakeTimeout: 8000,
  });
  socket.on("open", () => onStatus("open"));
  socket.on("close", () => onStatus("closed"));
  socket.on("error", (err) => onStatus("error", err.message));
  socket.on("message", (raw) => {
    try {
      const data = JSON.parse(String(raw)) as {
        strikePrice?: number;
        timestamp?: string;
        CE?: Leg | null;
        PE?: Leg | null;
      };
      if (!data.strikePrice) return;
      onTick({
        strike: data.strikePrice,
        timestamp: istTickTime(data.timestamp),
        ce: mapLeg(data.CE),
        pe: mapLeg(data.PE),
      });
    } catch {
      /* ignore a malformed frame */
    }
  });
  return socket;
}
