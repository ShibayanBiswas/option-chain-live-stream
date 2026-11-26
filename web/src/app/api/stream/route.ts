import { loadOptionChain, publicChainError } from "@/lib/chain-service";
import { coalescePatches, mergeChain, nextStreamEvent, type ChainPatch } from "@/lib/diff";
import { applyOptionTick, openNseOptionSocket, overlayContractFields } from "@/lib/nse-ws";
import type { OptionChainSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * NSE prices come from wss://streamer.nseindia.com/streams/fo/mbp when that socket sends frames.
 * Open interest and IV still come from the option-chain API. BSE stays on that API.
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
      let stamp = "";
      let marketOpen = false;
      const started = Date.now();
      let lastSessionCheck = 0;
      let pending: ChainPatch | null = null;
      let flushTimer: ReturnType<typeof setTimeout> | undefined;

      const emitPending = () => {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = undefined;
        }
        if (!pending) return;
        const patch = pending;
        pending = null;
        send("patch", patch);
      };

      const queuePatch = (patch: ChainPatch) => {
        pending = coalescePatches(pending, patch);
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
          flushTimer = undefined;
          emitPending();
        }, 200);
      };

      const beat = () => {
        send("heartbeat", {
          ts: new Date().toISOString(),
          session: marketOpen ? "open" : "closed",
          latencyMs: snapshot?.latencyMs ?? null,
        });
      };

      const pull = async (full: boolean) => {
        const loaded = await loadOptionChain({ symbol, expiry, exchange, segment });
        loaded.feed = "polling";
        const next = snapshot ? mergeChain(snapshot, loaded) : loaded;
        marketOpen = loaded.marketOpen;
        const event = nextStreamEvent(snapshot, next, full);
        snapshot = next;
        stamp = next.timestamp;
        if (event.type === "chain") send("chain", event.snapshot);
        if (event.type === "patch") send("patch", event.patch);
        return next;
      };

      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let socket: ReturnType<typeof openNseOptionSocket> | null = null;
      let usingSocket = false;
      try {
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        const first = await pull(true);
        snapshot = first;
        lastSessionCheck = Date.now();
        beat();
        heartbeat = setInterval(beat, 10_000);

        const nse = (exchange ?? "NSE").toUpperCase() !== "BSE";
        if (nse && marketOpen && first) {
          const expiryForSocket = first.expiry;
          socket = openNseOptionSocket(
            symbol,
            expiryForSocket,
            (tick) => {
              if (closed || !snapshot) return;
              const applied = applyOptionTick(snapshot, tick);
              if (!applied) return;
              usingSocket = true;
              queuePatch({
                symbol: applied.snapshot.symbol,
                expiry: applied.snapshot.expiry,
                spot: applied.snapshot.spot,
                timestamp: applied.snapshot.timestamp,
                latencyMs: applied.snapshot.latencyMs,
                feed: "websocket",
                totals: applied.snapshot.totals,
                cells: applied.cells,
              });
              snapshot = applied.snapshot;
              stamp = applied.snapshot.timestamp;
            },
            (state) => {
              if (state === "error" || state === "closed") usingSocket = false;
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 2_500));
          if (!usingSocket) {
            socket.close();
            socket = null;
          }
        }

        let lastContractPull = Date.now();
        while (!closed && Date.now() - started < 50_000) {
          if (usingSocket && snapshot) {
            if (Date.now() - lastContractPull >= 30_000) {
              const fresh = await loadOptionChain({ symbol, expiry, exchange, segment }).catch(() => null);
              if (fresh && snapshot) {
                const merged = overlayContractFields(snapshot, fresh);
                merged.feed = "websocket";
                const event = nextStreamEvent(snapshot, merged, false);
                snapshot = merged;
                marketOpen = fresh.marketOpen;
                if (event.type === "patch") queuePatch(event.patch);
              }
              lastContractPull = Date.now();
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          const previousStamp = stamp;
          if (!marketOpen && Date.now() - lastSessionCheck < 60_000) {
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            continue;
          }
          if (closed) break;
          await pull(false).catch((err) => {
            send("notice", { message: publicMessage(err) });
          });
          lastSessionCheck = Date.now();
          const unchanged = previousStamp !== "" && stamp === previousStamp;
          await new Promise((resolve) => setTimeout(resolve, marketOpen ? (unchanged ? 3_000 : 500) : 10_000));
        }
        emitPending();
        send("rotate", { reason: "maxDuration", afterMs: Date.now() - started });
      } catch (err) {
        send("notice", { message: publicMessage(err) });
      } finally {
        emitPending();
        socket?.close();
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
