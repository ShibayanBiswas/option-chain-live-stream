import { NextRequest, NextResponse } from "next/server";

import { loadOptionChain } from "@/lib/chain-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const expiry = req.nextUrl.searchParams.get("expiry")?.trim() || undefined;
  const exchange = req.nextUrl.searchParams.get("exchange")?.trim() || undefined;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const snapshot = await loadOptionChain({ symbol, expiry, exchange });
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load option chain";
    const status = /blocked|Akamai/i.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
