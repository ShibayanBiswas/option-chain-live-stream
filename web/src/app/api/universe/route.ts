import { NextResponse } from "next/server";

import { publicChainError } from "@/lib/chain-service";
import { getNseMarketStatus } from "@/lib/nse";
import { loadUniverse } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [book, market] = await Promise.all([
      loadUniverse(),
      getNseMarketStatus().catch(() => null),
    ]);
    return NextResponse.json(
      {
        ...book,
        market: market
          ? {
              status: market.status,
              tradeDate: market.tradeDate,
              open: market.open,
              phase: market.phase,
              label: market.label,
              message: market.label,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("universe", err);
    return NextResponse.json(
      { error: publicChainError(err) },
      { status: 502 },
    );
  }
}
