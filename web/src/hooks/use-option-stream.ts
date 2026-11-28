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
  const bookRef = useRef("");

  const applySnapshot = useCallback((next: OptionChainSnapshot) => {
    setSnapshot((current) => {
      if (
        current &&
        current.exchange === next.exchange &&
        current.symbol === next.symbol &&
        current.expiry === next.expiry &&
        next.timestamp < current.timestamp
      ) {
        console.warn("dropped older chain", next.symbol, next.timestamp, current.timestamp);
        return current;
      }
      return next;
    });
    setUpdatedAt(Date.now());
    setError(null);
  }, []);

  const applyIncomingPatch = useCallback((patch: ChainPatch) => {
    setSnapshot((current) => {
      if (!current) return current;
      if (patch.timestamp && patch.timestamp < current.timestamp) {
        console.warn("dropped older patch", patch.symbol, patch.timestamp, current.timestamp);
        return current;
      }
      return applyPatch(current, patch);
    });
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
    if (bookRef.current !== `${exchange}|${symbol}|${expiry}`) return data as OptionChainSnapshot;
    lastBeat.current = Date.now();
    setQuiet(false);
    applySnapshot(data as OptionChainSnapshot);
    return data as OptionChainSnapshot;
  }, [applySnapshot, exchange, expiry, segment, symbol]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    let cancelled = false;
    bookRef.current = `${exchange}|${symbol}|${expiry}`;
    setStatus("connecting");
    setSocketState("idle");
    setError(null);
    setSnapshot((current) => (current && (current.symbol !== symbol || current.exchange !== exchange) ? null : current));

    let link: Link = freshLink();
    let dropTimer: number | null = null;
    let retryTimer: number | null = null;
    let generation = 0;
    let awaitingStream = false;

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
        fetchOnce()
          .then(() => {
            if (!cancelled && pollRef.current) setStatus("polling");
          })
          .catch((err) => {
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
      const result = noteDelivery(link, Number.isFinite(id) ? id : 0);
      link = result.link;
      if (!result.apply) return false;
      awaitingStream = false;
      stopPoll();
      clearDrop();
      lastBeat.current = Date.now();
      setQuiet(false);
      setStatus("live");
      return true;
    };

    const connectSse = () => {
      generation += 1;
      const mine = generation;
      awaitingStream = true;
      link = { ...link, lastId: 0 };
      const previous = esRef.current;
      if (previous) {
        previous.onerror = null;
        previous.close();
      }
      const qs = new URLSearchParams({
        symbol,
        exchange,
        segment,
        ...(expiry ? { expiry } : {}),
      });
      const es = new EventSource(`/api/stream?${qs}`);
      esRef.current = es;
      const current = () => !cancelled && mine === generation;

      es.addEventListener("chain", (evt) => {
        if (!current() || !accept(evt)) return;
        try {
          applySnapshot(JSON.parse((evt as MessageEvent).data));
        } catch {
          /* ignore parse */
        }
      });

      es.addEventListener("patch", (evt) => {
        if (!current() || !accept(evt)) return;
        try {
          applyIncomingPatch(JSON.parse((evt as MessageEvent).data) as ChainPatch);
        } catch {
          /* ignore parse */
        }
      });

      es.addEventListener("socket", (evt) => {
        if (!current()) return;
        try {
          const payload = JSON.parse((evt as MessageEvent).data) as { state?: "open" | "closed" | "error" };
          if (payload.state) setSocketState(payload.state);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("notice", (evt) => {
        if (!current()) return;
        try {
          const payload = JSON.parse((evt as MessageEvent).data);
          setError(payload.message || "Stream interrupted");
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("heartbeat", (evt) => {
        if (!current() || !accept(evt)) return;
        lastBeat.current = Date.now();
      });

      es.addEventListener("rotate", () => {
        if (!current()) return;
        connectSse();
      });

      es.onerror = () => {
        if (!current()) return;
        awaitingStream = false;
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
        const previous = esRef.current;
        if (previous) {
          previous.onerror = null;
          previous.close();
        }
        awaitingStream = false;
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
      if (awaitingStream) return;
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
        connectSse();
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
