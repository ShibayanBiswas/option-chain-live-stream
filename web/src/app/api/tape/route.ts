import { NextResponse } from "next/server";

import { getNseTape } from "@/lib/nse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { at: number; quotes: Awaited<ReturnType<typeof getNseTape>> } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > 20_000) {
      cache = { at: Date.now(), quotes: await getNseTape() };
    }
    return NextResponse.json(
      { quotes: cache.quotes, refreshedAt: new Date(cache.at).toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("tape", err);
    return NextResponse.json({ quotes: [], refreshedAt: null });
  }
}
