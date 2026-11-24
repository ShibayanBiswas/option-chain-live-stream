import { z } from "zod";

const nullableNumber = z.number().nullable();

const quoteSchema = z.object({
  lastPrice: nullableNumber,
  change: nullableNumber,
  pChange: nullableNumber,
  iv: nullableNumber,
  oi: nullableNumber,
  oiChg: nullableNumber,
  volume: nullableNumber,
  bid: nullableNumber,
  bidQty: nullableNumber,
  ask: nullableNumber,
  askQty: nullableNumber,
});

export const chainSnapshotSchema = z.object({
  exchange: z.enum(["NSE", "BSE"]),
  symbol: z.string().min(1),
  segment: z.enum(["INDEX", "EQUITY"]),
  expiry: z.string(),
  expiries: z.array(z.string()),
  spot: nullableNumber,
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
    ceVolume: z.number(),
    peVolume: z.number(),
    pcr: nullableNumber,
    maxPain: nullableNumber,
    atm: nullableNumber,
  }),
  latencyMs: z.number(),
  source: z.enum(["nse", "bse"]),
  marketOpen: z.boolean(),
  feed: z.enum(["websocket", "rest"]),
});

export function assertChainSnapshot(value: unknown) {
  return chainSnapshotSchema.parse(value);
}
