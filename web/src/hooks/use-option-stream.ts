"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { applyPatch, type ChainPatch } from "@/lib/diff";
import type { OptionChainSnapshot } from "@/lib/types";

type Status = "idle" | "connecting" | "live" | "polling" | "error";

type Options = {
  symbol: string;
  expiry: string;
  exchange: "NSE" | "BSE";
  segment: "INDEX" | "EQUITY";
  enabled?: boolean;
};

export function useOptionStream({ symbol, expiry, exchange, segment, enabled = true }: Options) {
  const [snapshot, setSnapshot] = useState<OptionChainSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [socketState, setSocketState] = useState<"idle" | "open" | "closed" | "error">("idle");
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
      segment,
      ...(expiry ? { expiry } : {}),
    });
    const res = await fetch(`/api/chain?${qs}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch chain");
    applySnapshot(data as OptionChainSnapshot);
    return data as OptionChainSnapshot;
  }, [applySnapshot, exchange, expiry, segment, symbol]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    let cancelled = false;
    setStatus("connecting");
    setSocketState("idle");
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
        segment,
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

      es.addEventListener("patch", (evt) => {
        if (cancelled) return;
        try {
          const patch = JSON.parse((evt as MessageEvent).data) as ChainPatch;
          setSnapshot((current) => (current ? applyPatch(current, patch) : current));
          setUpdatedAt(Date.now());
          setStatus("live");
        } catch {
          /* ignore parse */
        }
      });

      es.addEventListener("socket", (evt) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((evt as MessageEvent).data) as { state?: "open" | "closed" | "error" };
          if (payload.state) setSocketState(payload.state);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("notice", (evt) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((evt as MessageEvent).data);
          setError(payload.message || "Stream interrupted");
        } catch {
          /* ignore */
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
  }, [applySnapshot, enabled, exchange, expiry, fetchOnce, segment, symbol]);

  return { snapshot, status, error, updatedAt, socketState, refresh: fetchOnce };
}
