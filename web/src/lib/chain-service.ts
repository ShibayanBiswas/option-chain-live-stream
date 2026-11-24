import { buildTotals } from "./analytics";
import { BseBlockedError, getBseOptionChain } from "./bse";
import { getBseCachedChain } from "./bse-cache";
import { chainCacheKey, readChainCache, readPcr, recordPcr, writeChainCache } from "./chain-cache";
import { isAnandRathiSymbol } from "./equity";
import { logEvent } from "./log";
import { getNseMarketStatus, getNseOptionChain } from "./nse";
import { assertChain } from "./schema";
import { resolveInstrument } from "./universe";
import type { OptionChainSnapshot } from "./types";

export function publicChainError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Chain unavailable";
  if (/curl|akamai|access denied|http \d|econn|blocked|timeout|rate/i.test(raw)) {
    return "Chain unavailable";
  }
  return raw;
}

function withSeries(snapshot: OptionChainSnapshot, key: string): OptionChainSnapshot {
  recordPcr(key, snapshot.totals.pcr);
  return { ...snapshot, pcrSeries: readPcr(key) };
}

export async function loadOptionChain(params: {
  symbol: string;
  expiry?: string;
  exchange?: string;
  segment?: string;
}): Promise<OptionChainSnapshot> {
  const key = chainCacheKey(params);
  const cached = readChainCache(key);
  if (cached.hit === "fresh" && cached.value) return cached.value;

  try {
    const snapshot = assertChain(await loadFresh(params));
    const next = withSeries(snapshot, key);
    writeChainCache(key, next);
    logEvent("info", "chain", {
      symbol: next.symbol,
      exchange: next.exchange,
      expiry: next.expiry,
      rows: next.rows.length,
      latencyMs: next.latencyMs,
    });
    return next;
  } catch (err) {
    if (cached.hit === "stale" && cached.value) {
      logEvent("warn", "chain stale", {
        symbol: params.symbol,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ...cached.value, stale: true };
    }
    throw err;
  }
}

async function loadFresh(params: {
  symbol: string;
  expiry?: string;
  exchange?: string;
  segment?: string;
}): Promise<OptionChainSnapshot> {
  const instrument = await resolveInstrument(params.symbol, params.exchange, params.segment);
  if (!instrument) {
    throw new Error(`No listed contract for ${params.symbol}`);
  }
  if (instrument.segment === "EQUITY" && !isAnandRathiSymbol(instrument.symbol)) {
    throw new Error(`No listed contract for ${params.symbol}`);
  }

  const market = await getNseMarketStatus().catch(() => null);

  if (instrument.exchange === "BSE") {
    if (!instrument.bseScrip) {
      throw new Error(`No contract code for ${instrument.symbol}`);
    }
    try {
      const live = await getBseOptionChain({
        symbol: instrument.symbol,
        scripCd: instrument.bseScrip,
        expiry: params.expiry,
        product: instrument.bseProduct ?? (instrument.segment === "EQUITY" ? "SO" : "IO"),
      });
      return { ...live, segment: instrument.segment, marketOpen: market?.open ?? false };
    } catch (err) {
      if (!(err instanceof BseBlockedError)) throw err;
      const cached = getBseCachedChain(instrument.symbol, params.expiry);
      if (!cached) throw new Error(`Chain unavailable for ${instrument.symbol}`);
      return { ...cached, segment: instrument.segment, marketOpen: market?.open ?? false, stale: true };
    }
  }

  const live = await getNseOptionChain({
    symbol: instrument.symbol,
    expiry: params.expiry,
    type: instrument.nseType ?? "Equity",
    segment: instrument.segment,
  });
  if (live.rows.length > 0) {
    live.totals = buildTotals(live.rows, live.spot);
  }
  return live;
}

export function openInterestView(snapshot: OptionChainSnapshot) {
  return {
    symbol: snapshot.symbol,
    exchange: snapshot.exchange,
    segment: snapshot.segment,
    expiry: snapshot.expiry,
    spot: snapshot.spot,
    timestamp: snapshot.timestamp,
    totals: snapshot.totals,
    pcrSeries: snapshot.pcrSeries ?? [],
    stale: snapshot.stale ?? false,
    strikes: snapshot.rows.map((row) => ({
      strike: row.strike,
      callOi: row.ce.oi,
      putOi: row.pe.oi,
      callOiChange: row.ce.oiChg,
      putOiChange: row.pe.oiChg,
      callVolume: row.ce.volume,
      putVolume: row.pe.volume,
    })),
  };
}
