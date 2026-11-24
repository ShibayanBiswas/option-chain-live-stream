import { NextRequest, NextResponse } from "next/server";

import { loadOptionChain, openInterestView, publicChainError } from "@/lib/chain-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const expiry = req.nextUrl.searchParams.get("expiry")?.trim() || undefined;
  const exchange = req.nextUrl.searchParams.get("exchange")?.trim() || undefined;
  const segment = req.nextUrl.searchParams.get("segment")?.trim() || undefined;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const snapshot = await loadOptionChain({ symbol, expiry, exchange, segment });
    return NextResponse.json(openInterestView(snapshot), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = publicChainError(err);
    const status = message === "Chain unavailable" ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
