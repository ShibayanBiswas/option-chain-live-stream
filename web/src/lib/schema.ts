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
  feed: z.enum(["rest", "polling"]),
  stale: z.boolean().optional(),
  asOf: z.string().nullable().optional(),
  expiryIso: z.string().nullable().optional(),
});

export function assertBookShape(input: {
  strikes: number[];
  spot: number | null;
  expiry: string;
  expiries: string[];
  segment: "INDEX" | "EQUITY";
}) {
  for (let i = 1; i < input.strikes.length; i += 1) {
    if (input.strikes[i]! <= input.strikes[i - 1]!) {
      throw new Error("strikes are not monotonic");
    }
  }
  if (input.segment === "INDEX" && (input.spot == null || !Number.isFinite(input.spot))) {
    throw new Error("index spot is null");
  }
  if (input.expiry && input.expiries.length > 0 && !input.expiries.includes(input.expiry)) {
    throw new Error("expiry is not listed");
  }
}

export function assertChainSnapshot(value: unknown) {
  return chainSnapshotSchema.parse(value);
}
