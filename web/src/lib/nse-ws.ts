import WebSocket from "ws";

import type { OptionQuote } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type OptionTick = {
  strike: number;
  expiry: string;
  ce?: Partial<OptionQuote>;
  pe?: Partial<OptionQuote>;
  timestamp?: string;
};

type Leg = {
  lastPrice?: number;
  change?: number;
  buyPrice1?: number;
  buyQuantity1?: number;
  sellPrice1?: number;
  sellQuantity1?: number;
  impliedVolatility?: number;
  openInterest?: number;
  totalTradedVolume?: number;
};

function mapLeg(leg?: Leg): Partial<OptionQuote> | undefined {
  if (!leg) return undefined;
  return {
    lastPrice: numberOrNull(leg.lastPrice),
    change: numberOrNull(leg.change),
    bid: numberOrNull(leg.buyPrice1),
    bidQty: numberOrNull(leg.buyQuantity1),
    ask: numberOrNull(leg.sellPrice1),
    askQty: numberOrNull(leg.sellQuantity1),
    iv: numberOrNull(leg.impliedVolatility),
    oi: numberOrNull(leg.openInterest),
    volume: numberOrNull(leg.totalTradedVolume),
  };
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
        expiryDates?: string;
        timestamp?: string;
        CE?: Leg;
        PE?: Leg;
      };
      if (!data.strikePrice) return;
      onTick({
        strike: data.strikePrice,
        expiry: String(data.expiryDates ?? expiry),
        timestamp: data.timestamp,
        ce: mapLeg(data.CE),
        pe: mapLeg(data.PE),
      });
    } catch {
      /* ignore malformed frames */
    }
  });

  return socket;
}
