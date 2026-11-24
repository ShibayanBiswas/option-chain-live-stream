import { NextResponse } from "next/server";

import { getNseMarketStatus } from "@/lib/nse";
import { loadUniverse } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [book, market] = await Promise.all([
    loadUniverse(),
    getNseMarketStatus().catch(() => null),
  ]);

  return NextResponse.json(
    {
      indexes: book.indexes,
      equities: book.equities,
      market: {
        status: market?.status ?? "Unknown",
        tradeDate: market?.tradeDate ?? "",
        niftyLast: market?.niftyLast ?? null,
        message: market?.open ? "Market Open" : "Market Closed",
      },
      serverTimeIst: new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
