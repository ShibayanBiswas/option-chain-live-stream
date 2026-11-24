import { NextResponse } from "next/server";

import { chainCacheStats } from "@/lib/chain-cache";
import { hostBreaker } from "@/lib/http";
import { getNseMarketStatus } from "@/lib/nse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const market = await getNseMarketStatus();
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      nse: market,
      cache: chainCacheStats(),
      breakers: {
        nse: hostBreaker("www.nseindia.com"),
        bse: hostBreaker("api.bseindia.com"),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : "health failed",
      },
      { status: 503 },
    );
  }
}
