"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { QuoteTick } from "@/lib/quotes";

export function TickerStrip({ items }: { items: QuoteTick[] }) {
  const motion = useReducedMotion();
  const [mediaReduce, setMediaReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMediaReduce(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const reduce = Boolean(motion) || mediaReduce;
  const rows = items.filter((item) => item.spot != null);
  if (rows.length === 0) return <div className="ticker-strip" data-testid="ticker" />;
  const loop = reduce ? rows : [...rows, ...rows];
  return (
    <div className={cn("ticker-strip", reduce && "is-still")} data-testid="ticker">
      <div className="ticker-track">
        {loop.map((item, index) => {
          const up = (item.change ?? 0) > 0;
          const down = (item.change ?? 0) < 0;
          return (
            <span key={`${item.name}-${index}`} className="ticker-item">
              <em>{item.name}</em>
              <strong>{formatNumber(item.spot, 2)}</strong>
              <b className={cn(up && "tone-up", down && "tone-down")}>
                {item.change != null && item.change !== 0 ? formatNumber(item.change, 2) : "—"}
              </b>
            </span>
          );
        })}
      </div>
    </div>
  );
}
