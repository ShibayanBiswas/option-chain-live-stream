"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { applyPatch, mergeChain, type ChainPatch } from "@/lib/diff";
import { freshLink, LOST_AFTER_MS, noteDelivery, noteDrop, noteLost, takeSseEvents, type Link } from "@/lib/stream-link";
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
  const esRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applySnapshot = useCallback((next: OptionChainSnapshot) => {
    setSnapshot((current) => {
      if (
        current &&
        current.symbol === next.symbol &&
        current.expiry === next.expiry &&
        next.timestamp < current.timestamp
      ) {
        console.warn("dropped older chain", next.symbol, next.timestamp, current.timestamp);
        return current;
      }
      return current ? mergeChain(current, next) : next;
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
      awaitingStream = false;
      if (wasPolling) stopPoll();
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
      esRef.current?.abort();
      const controller = new AbortController();
      esRef.current = controller;
      const current = () => !cancelled && mine === generation;
      const qs = new URLSearchParams({
        symbol,
        exchange,
        segment,
        ...(expiry ? { expiry } : {}),
      });
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      if (link.lastId > 0) headers["Last-Event-ID"] = String(link.lastId);

      const fail = () => {
        if (!current()) return;
        awaitingStream = false;
        const dropped = noteDrop(link);
        link = dropped.link;
        armLost();
        if (dropped.startPoll) startPoll();
        if (retryTimer != null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          if (!cancelled) connectSse();
        }, dropped.retryMs);
      };

      void (async () => {
        try {
          const res = await fetch(`/api/stream?${qs}`, { headers, signal: controller.signal, cache: "no-store" });
          if (!res.ok || !res.body) throw new Error("stream");
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (current()) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parsed = takeSseEvents(buf);
            buf = parsed.rest;
            const frames: Array<{ kind: "chain"; snapshot: OptionChainSnapshot } | { kind: "patch"; patch: ChainPatch }> = [];
            let rotated = false;
            for (const evt of parsed.events) {
              if (!current()) return;
              const message = { lastEventId: evt.id } as MessageEvent;
              if (evt.event === "chain") {
                if (!accept(message)) continue;
                frames.push({ kind: "chain", snapshot: JSON.parse(evt.data) as OptionChainSnapshot });
              } else if (evt.event === "patch") {
                if (!accept(message)) continue;
                frames.push({ kind: "patch", patch: JSON.parse(evt.data) as ChainPatch });
              } else if (evt.event === "heartbeat") {
                if (!accept(message)) continue;
                lastBeat.current = Date.now();
              } else if (evt.event === "socket") {
                const payload = JSON.parse(evt.data) as { state?: "open" | "closed" | "error" };
                if (payload.state) setSocketState(payload.state);
              } else if (evt.event === "notice") {
                const payload = JSON.parse(evt.data) as { message?: string };
                setError(payload.message || "Stream interrupted");
              } else if (evt.event === "rotate") {
                rotated = true;
                break;
              }
            }
            if (frames.length > 0) {
              setSnapshot((current) => {
                let next = current;
                for (const frame of frames) {
                  if (frame.kind === "chain") {
                    const incoming = frame.snapshot;
                    if (
                      next &&
                      next.symbol === incoming.symbol &&
                      next.expiry === incoming.expiry &&
                      incoming.timestamp < next.timestamp
                    ) {
                      continue;
                    }
                    next = next ? mergeChain(next, incoming) : incoming;
                  } else if (next) {
                    if (frame.patch.timestamp && frame.patch.timestamp < next.timestamp) continue;
                    next = applyPatch(next, frame.patch);
                  }
                }
                return next;
              });
              setUpdatedAt(Date.now());
              setError(null);
            }
            if (rotated) {
              connectSse();
              return;
            }
          }
          if (current()) fail();
        } catch {
          if (controller.signal.aborted || !current()) return;
          fail();
        }
      })();
    };

    const onHide = () => {
      if (document.hidden) {
        esRef.current?.abort();
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
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHide);
      window.clearInterval(staleTimer);
      if (retryTimer != null) window.clearTimeout(retryTimer);
      clearDrop();
      esRef.current?.abort();
      esRef.current = null;
      stopPoll();
    };
  }, [applySnapshot, enabled, exchange, expiry, fetchOnce, segment, symbol]);

  return { snapshot, status, error, updatedAt, socketState, quiet, refresh: fetchOnce };
}
