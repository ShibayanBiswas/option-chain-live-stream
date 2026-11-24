import { BseBlockedError, getBseOptionChain } from "./bse";
import { getBseCachedChain } from "./bse-cache";
import { getNseOptionChain } from "./nse";
import { getInstrument } from "./symbols";
import type { OptionChainSnapshot } from "./types";

export async function loadOptionChain(params: {
  symbol: string;
  expiry?: string;
  exchange?: string;
}): Promise<OptionChainSnapshot> {
  const instrument = getInstrument(params.symbol);
  if (!instrument) throw new Error("Unknown symbol");

  const exchange =
    (params.exchange?.toUpperCase() as "NSE" | "BSE") || instrument.exchange;

  if (exchange === "BSE") {
    if (!instrument.bseScrip) {
      throw new Error(`${instrument.symbol} is not a BSE index option underlying`);
    }
    try {
      return await getBseOptionChain({
        symbol: instrument.symbol,
        scripCd: instrument.bseScrip,
        expiry: params.expiry,
      });
    } catch (err) {
      if (err instanceof BseBlockedError) {
        const cached = getBseCachedChain(instrument.symbol, params.expiry);
        if (cached) {
          return {
            ...cached,
            timestamp: `${cached.timestamp} · cached (BSE edge blocked live)`,
          };
        }
        throw new Error(
          "BSE live API is blocked from this server (Akamai) and no Sensex/Bankex cache is available.",
        );
      }
      throw err;
    }
  }

  return getNseOptionChain({
    symbol: instrument.symbol,
    expiry: params.expiry,
    type: instrument.nseType ?? "Equity",
    segment: instrument.segment,
  });
}
