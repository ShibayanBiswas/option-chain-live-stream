import { BseBlockedError, getBseOptionChain } from "./bse";
import { derivativesSessionOpen } from "./session";
import { getBseCachedChain } from "./bse-cache";
import { chainCacheKey, coalesceChain, readChainCache, recordPcr, writeChainCache } from "./chain-cache";
import { getNseOptionChain } from "./nse";
import { resolveInstrument } from "./universe";
import type { OptionChainSnapshot } from "./types";

export function publicChainError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Chain unavailable";
  if (/curl|akamai|access denied|http \d|econn|blocked|timeout/i.test(raw)) {
    return "Chain unavailable";
  }
  return raw;
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

  if (instrument.exchange === "BSE") {
    if (!instrument.bseScrip) {
      throw new Error(`No contract code for ${instrument.symbol}`);
    }
    try {
      const live = await getBseOptionChain({
        symbol: instrument.symbol,
        scripCd: instrument.bseScrip,
        expiry: params.expiry,
        segment: instrument.segment,
      });
      return { ...live, segment: instrument.segment, marketOpen: live.marketOpen, stale: false };
    } catch (err) {
      if (!(err instanceof BseBlockedError)) throw err;
      const cached = getBseCachedChain(instrument.symbol, params.expiry);
      if (!cached) throw new Error(`Chain unavailable for ${instrument.symbol}`);
      return {
        ...cached,
        segment: instrument.segment,
        stale: true,
        marketOpen: derivativesSessionOpen(),
      };
    }
  }

  return getNseOptionChain({
    symbol: instrument.symbol,
    expiry: params.expiry,
    type: instrument.nseType ?? "Equity",
    segment: instrument.segment,
  });
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
  return coalesceChain(key, async () => {
    try {
      const live = await loadFresh(params);
      writeChainCache(key, live);
      recordPcr(key, live.totals.pcr);
      return live;
    } catch (err) {
      if (cached.value) return { ...cached.value, stale: true };
      throw err;
    }
  });
}
