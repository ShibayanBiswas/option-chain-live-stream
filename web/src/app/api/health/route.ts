import { NextResponse } from "next/server";

import { chainCacheStats } from "@/lib/chain-cache";
import { logEvent } from "@/lib/log";
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
    });
  } catch (err) {
    logEvent("error", "health", { error: err instanceof Error ? err.message : "health failed" });
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - started,
        error: "Health check failed",
        cache: chainCacheStats(),
      },
      { status: 503 },
    );
  }
}
