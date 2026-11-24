import { z } from "zod";

import type { OptionChainSnapshot } from "./types";

const quoteSchema = z.object({
  lastPrice: z.number().nullable(),
  change: z.number().nullable(),
  pChange: z.number().nullable(),
  iv: z.number().nullable(),
  oi: z.number().nullable(),
  oiChg: z.number().nullable(),
  volume: z.number().nullable(),
  bid: z.number().nullable(),
  bidQty: z.number().nullable(),
  ask: z.number().nullable(),
  askQty: z.number().nullable(),
});

export const chainSchema = z.object({
  exchange: z.enum(["NSE", "BSE"]),
  symbol: z.string().min(1),
  segment: z.enum(["INDEX", "EQUITY"]),
  expiry: z.string().min(1),
  expiries: z.array(z.string()).min(1),
  spot: z.number().nullable(),
  timestamp: z.string(),
  rows: z.array(
    z.object({
      strike: z.number(),
      ce: quoteSchema,
      pe: quoteSchema,
    }),
  ),
  totals: z.object({
    ceOi: z.number(),
    peOi: z.number(),
    ceOiChg: z.number(),
    peOiChg: z.number(),
    ceVolume: z.number(),
    peVolume: z.number(),
    pcr: z.number().nullable(),
    maxPain: z.number().nullable(),
    atm: z.number().nullable(),
    atmIv: z.number().nullable(),
  }),
  latencyMs: z.number(),
  source: z.enum(["nse", "bse"]),
  marketOpen: z.boolean(),
  feed: z.enum(["websocket", "rest"]),
  pcrSeries: z.array(z.object({ t: z.string(), pcr: z.number() })).optional(),
  stale: z.boolean().optional(),
});

export function assertChain(value: OptionChainSnapshot): OptionChainSnapshot {
  return chainSchema.parse(value) as OptionChainSnapshot;
}
