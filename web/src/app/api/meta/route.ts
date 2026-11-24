import { NextResponse } from "next/server";

import { getNseMarketStatus } from "@/lib/nse";
import { EQUITIES, listIndexes } from "@/lib/symbols";
import type { MetaResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const market = await getNseMarketStatus().catch(() => ({
    status: "Unknown",
    tradeDate: "",
    niftyLast: null,
    message: "Market status unavailable",
    open: false,
  }));

  const payload: MetaResponse = {
    indexes: listIndexes(),
    equities: EQUITIES,
    market: {
      status: market.status,
      tradeDate: market.tradeDate,
      niftyLast: market.niftyLast,
      message: market.message,
    },
    serverTimeIst: new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    }),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
