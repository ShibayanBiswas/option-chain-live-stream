import { loadOptionChain, publicChainError } from "@/lib/chain-service";
import { diffChain } from "@/lib/diff";
import { openNseOptionSocket, type OptionTick } from "@/lib/nse-ws";
import type { OptionChainSnapshot, OptionQuote } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicMessage(err: unknown) {
  return publicChainError(err);
}

function mergeLeg(target: OptionQuote, patch?: Partial<OptionQuote>) {
  if (!patch) return;
  (Object.keys(patch) as Array<keyof OptionQuote>).forEach((key) => {
    const value = patch[key];
    if (value !== undefined && value !== null) target[key] = value;
  });
}

function applyTick(snapshot: OptionChainSnapshot, tick: OptionTick) {
  const row = snapshot.rows.find((item) => item.strike === tick.strike);
  if (!row) return false;
  mergeLeg(row.ce, tick.ce);
  mergeLeg(row.pe, tick.pe);
  snapshot.feed = "websocket";
  if (tick.timestamp) snapshot.timestamp = tick.timestamp;
  snapshot.latencyMs = 0;
  return true;
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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let snapshot: OptionChainSnapshot | null = null;
      let socket: ReturnType<typeof openNseOptionSocket> | null = null;
      const started = Date.now();

      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 8000);

      const pull = async (full: boolean) => {
        const next = await loadOptionChain({ symbol, expiry, exchange, segment });
        if (snapshot?.feed === "websocket") next.feed = "websocket";
        const patch = !full && snapshot ? diffChain(snapshot, next) : null;
        snapshot = next;
        if (patch) send("patch", patch);
        else send("chain", snapshot);
        return next;
      };

      try {
        const first = await pull(true);
        if (first.exchange === "NSE" && first.marketOpen) {
          socket = openNseOptionSocket(
            first.symbol,
            first.expiry,
            (tick) => {
              if (!snapshot) return;
              if (applyTick(snapshot, tick)) send("chain", snapshot);
            },
            (state, detail) => {
              send("socket", { state, detail: detail ?? null });
            },
          );
        }

        while (!closed && Date.now() - started < 50_000) {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          if (closed) break;
          await pull(false).catch((err) => {
            send("notice", { message: publicMessage(err) });
          });
        }
        send("end", { reason: "rotation" });
      } catch (err) {
        send("notice", { message: publicMessage(err) });
      } finally {
        clearInterval(heartbeat);
        socket?.close();
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
