import { BseBlockedError, getBseOptionChain } from "./bse";
import { getBseCachedChain } from "./bse-cache";
import { getNseMarketStatus, getNseOptionChain } from "./nse";
import { resolveInstrument } from "./universe";
import type { OptionChainSnapshot } from "./types";

export function publicChainError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Chain unavailable";
  if (/curl|akamai|access denied|http \d|econn|blocked|timeout/i.test(raw)) {
    return "Chain unavailable";
  }
  return raw;
}

export async function loadOptionChain(params: {
  symbol: string;
  expiry?: string;
  exchange?: string;
  segment?: string;
}): Promise<OptionChainSnapshot> {
  const instrument = await resolveInstrument(params.symbol, params.exchange, params.segment);
  if (!instrument) {
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
      });
      return { ...live, segment: instrument.segment, marketOpen: market?.open ?? false };
    } catch (err) {
      if (!(err instanceof BseBlockedError)) throw err;
      const cached = getBseCachedChain(instrument.symbol, params.expiry);
      if (!cached) throw new Error(`Chain unavailable for ${instrument.symbol}`);
      return { ...cached, segment: instrument.segment, marketOpen: market?.open ?? false };
    }
  }

  return getNseOptionChain({
    symbol: instrument.symbol,
    expiry: params.expiry,
    type: instrument.nseType ?? "Equity",
    segment: instrument.segment,
  });
}
