import { NextResponse } from "next/server";

import { logEvent } from "@/lib/log";
import { loadQuoteBoard } from "@/lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await loadQuoteBoard();
    return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logEvent("error", "quotes", { error: err instanceof Error ? err.message : "quotes failed" });
    return NextResponse.json({ error: "Quotes unavailable" }, { status: 502 });
  }
}
