"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { applyPatch, type ChainPatch } from "@/lib/diff";
import { freshLink, LOST_AFTER_MS, noteDelivery, noteDrop, noteLost, type Link } from "@/lib/stream-link";
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
  const [quiet, setQuiet] = useState(false);
  const lastBeat = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applySnapshot = useCallback((next: OptionChainSnapshot) => {
    setSnapshot(next);
    setUpdatedAt(Date.now());
    setError(null);
  }, []);

  const applyIncomingPatch = useCallback((patch: ChainPatch) => {
    setSnapshot((current) => (current ? applyPatch(current, patch) : current));
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
    lastBeat.current = Date.now();
    setQuiet(false);
    applySnapshot(data as OptionChainSnapshot);
    return data as OptionChainSnapshot;
  }, [applySnapshot, exchange, expiry, segment, symbol]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    let cancelled = false;
    setStatus("connecting");
    setSocketState("idle");
    setError(null);

    let link: Link = freshLink();
    let dropTimer: number | null = null;
    let retryTimer: number | null = null;

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPoll = () => {
      stopPoll();
      setStatus((current) => (current === "error" ? current : "polling"));
      pollRef.current = setInterval(() => {
        fetchOnce().catch((err) => {
          if (!cancelled) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Poll failed");
          }
        });
      }, link.pollMs);
    };

    const clearDrop = () => {
      if (dropTimer != null) {
        window.clearTimeout(dropTimer);
        dropTimer = null;
      }
    };

    const armLost = () => {
      if (dropTimer != null) return;
      dropTimer = window.setTimeout(() => {
        if (cancelled) return;
        link = noteLost(link);
        setStatus("error");
        setError("Connection lost · retrying");
      }, LOST_AFTER_MS);
    };

    const accept = (evt: Event) => {
      const id = Number((evt as MessageEvent).lastEventId);
      const wasPolling = link.polling;
      const result = noteDelivery(link, Number.isFinite(id) ? id : 0);
      link = result.link;
      if (!result.apply) return false;
      if (wasPolling) stopPoll();
      clearDrop();
      lastBeat.current = Date.now();
      setQuiet(false);
      setStatus("live");
      return true;
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
        if (cancelled || !accept(evt)) return;
        try {
          applySnapshot(JSON.parse((evt as MessageEvent).data));
        } catch {
          /* ignore parse */
        }
      });

      es.addEventListener("patch", (evt) => {
        if (cancelled || !accept(evt)) return;
        try {
          applyIncomingPatch(JSON.parse((evt as MessageEvent).data) as ChainPatch);
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

      es.addEventListener("heartbeat", (evt) => {
        if (cancelled || !accept(evt)) return;
        lastBeat.current = Date.now();
      });

      es.addEventListener("rotate", () => {
        if (cancelled) return;
        es.close();
        connectSse();
      });

      es.onerror = () => {
        if (cancelled) return;
        es.close();
        const dropped = noteDrop(link);
        link = dropped.link;
        armLost();
        if (dropped.startPoll) startPoll();
        if (retryTimer != null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          if (!cancelled) connectSse();
        }, dropped.retryMs);
      };
    };

    const onHide = () => {
      if (document.hidden) {
        esRef.current?.close();
        stopPoll();
        return;
      }
      fetchOnce()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) connectSse();
        });
    };
    document.addEventListener("visibilitychange", onHide);
    const staleTimer = window.setInterval(() => {
      if (lastBeat.current > 0 && Date.now() - lastBeat.current > 20_000) setQuiet(true);
    }, 5_000);

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
      document.removeEventListener("visibilitychange", onHide);
      window.clearInterval(staleTimer);
      if (retryTimer != null) window.clearTimeout(retryTimer);
      clearDrop();
      esRef.current?.close();
      esRef.current = null;
      stopPoll();
    };
  }, [applyIncomingPatch, applySnapshot, enabled, exchange, expiry, fetchOnce, segment, symbol]);

  return { snapshot, status, error, updatedAt, socketState, quiet, refresh: fetchOnce };
}
