import { loadOptionChain } from "@/lib/chain-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const expiry = url.searchParams.get("expiry")?.trim() || undefined;
  const exchange = url.searchParams.get("exchange")?.trim() || undefined;
  const intervalMs = Math.max(
    1000,
    Math.min(5000, Number(url.searchParams.get("interval") || 1500)),
  );

  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const started = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 10000);

      try {
        while (!closed && Date.now() - started < 55_000) {
          try {
            const snapshot = await loadOptionChain({ symbol, expiry, exchange });
            send("chain", snapshot);
          } catch (err) {
            send("error", {
              message: err instanceof Error ? err.message : "stream error",
            });
          }
          await new Promise((r) => setTimeout(r, intervalMs));
        }
        send("end", { reason: "rotation" });
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
