"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OptionChainSnapshot } from "@/lib/types";

type Status = "idle" | "connecting" | "live" | "polling" | "error";

type Options = {
  symbol: string;
  expiry: string;
  exchange: "NSE" | "BSE";
  enabled?: boolean;
};

export function useOptionStream({ symbol, expiry, exchange, enabled = true }: Options) {
  const [snapshot, setSnapshot] = useState<OptionChainSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applySnapshot = useCallback((next: OptionChainSnapshot) => {
    setSnapshot(next);
    setUpdatedAt(Date.now());
    setError(null);
  }, []);

  const fetchOnce = useCallback(async () => {
    const qs = new URLSearchParams({
      symbol,
      exchange,
      ...(expiry ? { expiry } : {}),
    });
    const res = await fetch(`/api/chain?${qs}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch chain");
    applySnapshot(data as OptionChainSnapshot);
    return data as OptionChainSnapshot;
  }, [applySnapshot, exchange, expiry, symbol]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    let cancelled = false;
    setStatus("connecting");
    setError(null);

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPoll = () => {
      stopPoll();
      setStatus("polling");
      pollRef.current = setInterval(() => {
        fetchOnce().catch((err) => {
          if (!cancelled) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Poll failed");
          }
        });
      }, 1500);
    };

    const connectSse = () => {
      esRef.current?.close();
      const qs = new URLSearchParams({
        symbol,
        exchange,
        interval: "1500",
        ...(expiry ? { expiry } : {}),
      });
      const es = new EventSource(`/api/stream?${qs}`);
      esRef.current = es;

      es.addEventListener("chain", (evt) => {
        if (cancelled) return;
        try {
          applySnapshot(JSON.parse((evt as MessageEvent).data));
          setStatus("live");
        } catch {
          /* ignore parse */
        }
      });

      es.addEventListener("error", (evt) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((evt as MessageEvent).data);
          setError(payload.message || "Stream error");
        } catch {
          /* EventSource transport error */
        }
      });

      es.addEventListener("end", () => {
        if (cancelled) return;
        es.close();
        connectSse();
      });

      es.onerror = () => {
        if (cancelled) return;
        es.close();
        startPoll();
      };
    };

    fetchOnce()
      .then(() => {
        if (cancelled) return;
        connectSse();
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load");
        startPoll();
      });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      stopPoll();
    };
  }, [applySnapshot, enabled, exchange, expiry, fetchOnce, symbol]);

  return { snapshot, status, error, updatedAt, refresh: fetchOnce };
}
