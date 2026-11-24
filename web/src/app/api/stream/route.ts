import { loadOptionChain, publicChainError } from "@/lib/chain-service";
import { nextStreamEvent } from "@/lib/diff";
import type { OptionChainSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The NSE fo/mbp websocket has not been proven in a market-hours capture.
 * This stream is REST polling. It does not invent a websocket feed.
 * The in-memory chain cache is per function instance.
 */

function publicMessage(err: unknown) {
  return publicChainError(err);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const expiry = url.searchParams.get("expiry")?.trim() || undefined;
  const exchange = url.searchParams.get("exchange")?.trim() || undefined;
  const segment = url.searchParams.get("segment")?.trim() || undefined;

  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol is required" }), {
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
        controller.enqueue(
          encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let snapshot: OptionChainSnapshot | null = null;
      let marketOpen = false;
      const started = Date.now();
      let lastSessionCheck = 0;

      const beat = () => {
        send("heartbeat", {
          ts: new Date().toISOString(),
          session: marketOpen ? "open" : "closed",
          latencyMs: snapshot?.latencyMs ?? null,
        });
      };

      const pull = async (full: boolean) => {
        const next = await loadOptionChain({ symbol, expiry, exchange, segment });
        next.feed = "polling";
        marketOpen = next.marketOpen;
        const event = nextStreamEvent(snapshot, next, full);
        snapshot = next;
        if (event.type === "chain") send("chain", event.snapshot);
        if (event.type === "patch") send("patch", event.patch);
        return next;
      };

      const heartbeat = setInterval(beat, 10_000);

      try {
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        await pull(true);
        lastSessionCheck = Date.now();

        while (!closed && Date.now() - started < 50_000) {
          await new Promise((resolve) => setTimeout(resolve, marketOpen ? 2_000 : 10_000));
          if (closed) break;
          if (!marketOpen && Date.now() - lastSessionCheck < 60_000) continue;
          await pull(false).catch((err) => {
            send("notice", { message: publicMessage(err) });
          });
          lastSessionCheck = Date.now();
        }
        send("rotate", { reason: "maxDuration", afterMs: Date.now() - started });
      } catch (err) {
        send("notice", { message: publicMessage(err) });
      } finally {
        clearInterval(heartbeat);
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
