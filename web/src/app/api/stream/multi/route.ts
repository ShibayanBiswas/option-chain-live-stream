import { loadOptionChain, publicChainError } from "@/lib/chain-service";
import { diffLtpSlice, toLtpSlice, type LtpSlice } from "@/lib/ltp-slice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One stream for Custom view. Each expiry is a last-price slice, then a cell patch.
 * The client no longer polls a full chain per expiry.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const exchange = url.searchParams.get("exchange")?.trim() || undefined;
  const segment = url.searchParams.get("segment")?.trim() || undefined;
  const expiries = (url.searchParams.get("expiries") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!symbol || expiries.length === 0) {
    return new Response(JSON.stringify({ error: "symbol and expiries are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let id = Number(req.headers.get("last-event-id") || "0") || 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        id += 1;
        controller.enqueue(encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const books = new Map<string, LtpSlice>();
      const started = Date.now();
      let cursor = 0;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const pull = async (expiry: string) => {
        const next = toLtpSlice(await loadOptionChain({ symbol, expiry, exchange, segment }));
        const prev = books.get(expiry);
        books.set(expiry, next);
        if (!prev) send("slice", next);
        else {
          const patch = diffLtpSlice(prev, next);
          if (patch) send("patch", patch);
        }
      };

      try {
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        for (const expiry of expiries) {
          if (closed) return;
          await pull(expiry);
        }
        send("heartbeat", { ts: new Date().toISOString() });
        heartbeat = setInterval(() => send("heartbeat", { ts: new Date().toISOString() }), 10_000);
        while (!closed && Date.now() - started < 50_000) {
          await new Promise((resolve) => setTimeout(resolve, 3_000));
          if (closed) break;
          const expiry = expiries[cursor % expiries.length]!;
          cursor += 1;
          await pull(expiry).catch((err) => {
            send("notice", { message: publicChainError(err) });
          });
        }
        send("rotate", { reason: "maxDuration" });
      } catch (err) {
        send("notice", { message: publicChainError(err) });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
