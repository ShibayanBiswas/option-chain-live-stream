import { buildTotals } from "@/lib/analytics";
import { loadOptionChain, publicChainError } from "@/lib/chain-service";
import { rowsChanged, toPatch } from "@/lib/diff";
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
  if (!row) return null;
  mergeLeg(row.ce, tick.ce);
  mergeLeg(row.pe, tick.pe);
  snapshot.feed = "websocket";
  if (tick.timestamp) snapshot.timestamp = tick.timestamp;
  snapshot.latencyMs = 0;
  snapshot.totals = buildTotals(snapshot.rows, snapshot.spot);
  return row;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const expiry = url.searchParams.get("expiry")?.trim() || undefined;
  const exchange = url.searchParams.get("exchange")?.trim() || undefined;
  const segment = url.searchParams.get("segment")?.trim() || undefined;
  const maxMs = Number(process.env.STREAM_MAX_MS || 50_000);
  const waitMs = Number(process.env.STREAM_WAIT_MS || 4_000);

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
      }, 8_000);

      const pull = async () => {
        const next = await loadOptionChain({ symbol, expiry, exchange, segment });
        if (snapshot?.feed === "websocket") next.feed = "websocket";
        if (!snapshot) {
          snapshot = next;
          send("chain", snapshot);
          return next;
        }
        const diff = rowsChanged(snapshot.rows, next.rows);
        snapshot = next;
        if (diff.rows.length > 0 || diff.removedStrikes.length > 0) {
          send("patch", toPatch(next, diff.rows, diff.removedStrikes));
        } else {
          send("chain", next);
        }
        return next;
      };

      try {
        const first = await pull();
        if (first.exchange === "NSE" && first.marketOpen) {
          socket = openNseOptionSocket(
            first.symbol,
            first.expiry,
            (tick) => {
              if (!snapshot) return;
              const row = applyTick(snapshot, tick);
              if (row) send("patch", toPatch(snapshot, [row]));
            },
            (state, detail) => {
              send("socket", { state, detail: detail ?? null });
            },
          );
        }

        while (!closed && Date.now() - started < maxMs) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          if (closed) break;
          if (Date.now() - started >= maxMs) break;
          await pull().catch((err) => {
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
          try {
            controller.close();
          } catch {
            /* already closed */
          }
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
