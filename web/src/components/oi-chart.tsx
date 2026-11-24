"use client";

import { motion, useReducedMotion } from "framer-motion";

import { formatCompact } from "@/lib/format";
import type { OptionChainSnapshot } from "@/lib/types";

export function OpenInterestChart({
  snapshot,
  density = "focus",
  magnify = false,
}: {
  snapshot: OptionChainSnapshot;
  density?: "focus" | "full";
  magnify?: boolean;
}) {
  const reduce = useReducedMotion();
  const spot = snapshot.totals.atm;
  const window = density === "full" || magnify ? 16 : 9;
  const rows = (() => {
    if (spot == null) return snapshot.rows.slice(0, window * 2);
    const idx = snapshot.rows.findIndex((row) => row.strike === spot);
    if (idx < 0) return snapshot.rows.slice(0, window * 2);
    return snapshot.rows.slice(
      Math.max(0, idx - window),
      Math.min(snapshot.rows.length, idx + window + 1),
    );
  })();
  const max = Math.max(1, ...rows.flatMap((row) => [row.ce.oi ?? 0, row.pe.oi ?? 0]));
  const showDetail = density === "full";

  return (
    <div
      className="oi-chart"
      aria-label="Open interest by strike"
      data-density={density}
      data-magnify={magnify ? "on" : "off"}
    >
      <header className="oi-chart-title">
        <div>
          <p className="eyebrow">Open Interest</p>
          <h2>Strike Pressure</h2>
        </div>
        <div className="oi-legend">
          <span className="oi-legend-call">Calls</span>
          <span className="oi-legend-put">Puts</span>
        </div>
      </header>
      <div className="oi-chart-head">
        <span>{showDetail ? "Call interest" : "Calls"}</span>
        <span>Strike</span>
        <span>{showDetail ? "Put interest" : "Puts"}</span>
      </div>
      <div className="oi-chart-body">
        {rows.map((row, index) => {
          const call = ((row.ce.oi ?? 0) / max) * 100;
          const put = ((row.pe.oi ?? 0) / max) * 100;
          const atSpot = row.strike === spot;
          return (
            <motion.div
              key={row.strike}
              className={atSpot ? "oi-row is-spot" : "oi-row"}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.014 }}
            >
              <div className="oi-track call" title={formatCompact(row.ce.oi)}>
                <motion.span
                  className="oi-fill call"
                  initial={reduce ? false : { width: 0, opacity: 0.35 }}
                  animate={{ width: `${call}%`, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 130, damping: 18, delay: index * 0.01 }}
                />
                {showDetail ? <em className="oi-metric">{formatCompact(row.ce.oi)}</em> : null}
              </div>
              <span className="oi-strike">{row.strike.toLocaleString("en-IN")}</span>
              <div className="oi-track put" title={formatCompact(row.pe.oi)}>
                <motion.span
                  className="oi-fill put"
                  initial={reduce ? false : { width: 0, opacity: 0.35 }}
                  animate={{ width: `${put}%`, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 130, damping: 18, delay: index * 0.01 }}
                />
                {showDetail ? <em className="oi-metric">{formatCompact(row.pe.oi)}</em> : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
