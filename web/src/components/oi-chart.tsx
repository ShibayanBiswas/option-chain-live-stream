"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { formatCompact, formatNumber } from "@/lib/format";
import { windowRows } from "@/lib/depth";
import type { OptionChainSnapshot } from "@/lib/types";

export function OpenInterestChart({
  snapshot,
  magnify = false,
  expanded = false,
  onToggle,
}: {
  snapshot: OptionChainSnapshot;
  magnify?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const reduce = useReducedMotion();
  const spot = snapshot.totals.atm;
  const rows = expanded ? snapshot.rows : windowRows(snapshot.rows, spot, "near").slice(0, magnify ? 21 : 15);
  const maxOi = Math.max(1, ...rows.flatMap((row) => [row.ce.oi ?? 0, row.pe.oi ?? 0]));
  const maxChg = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.ce.oiChg ?? 0), Math.abs(row.pe.oiChg ?? 0)]));
  const [hover, setHover] = useState<number | null>(null);
  const active = rows.find((row) => row.strike === hover) ?? null;
  const series = snapshot.pcrSeries;
  const pcrPath = useMemo(() => sparkPath((series ?? []).map((point) => point.pcr), 220, 48), [series]);

  return (
    <section className="oi-chart" aria-label="Open interest by strike" data-density={expanded ? "expanded" : "collapsed"} data-magnify={magnify ? "on" : "off"}>
      <header className="oi-chart-title">
        <div>
          <p className="eyebrow">Open Interest</p>
          <h2>Strike Pressure</h2>
        </div>
        <div className="oi-title-actions">
          <div className="oi-legend">
            <span className="oi-legend-call">Calls</span>
            <span className="oi-legend-put">Puts</span>
          </div>
          <button className="btn-icon" type="button" onClick={onToggle} aria-pressed={expanded} aria-label={expanded ? "Collapse open interest" : "Expand open interest"}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </header>

      <div className="oi-chart-head">
        <span>Call interest</span>
        <span>Strike</span>
        <span>Put interest</span>
      </div>
      <div className="oi-chart-body" onMouseLeave={() => setHover(null)}>
        {rows.map((row, index) => {
          const call = ((row.ce.oi ?? 0) / maxOi) * 100;
          const put = ((row.pe.oi ?? 0) / maxOi) * 100;
          const atSpot = row.strike === spot;
          return (
            <motion.div
              key={row.strike}
              className={atSpot ? "oi-row is-spot" : "oi-row"}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : Math.min(index, 18) * 0.015 }}
              onMouseEnter={() => setHover(row.strike)}
            >
              <div className="oi-track call" title={formatCompact(row.ce.oi)}>
                <motion.span
                  className="oi-fill call"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${call}%` }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20 }}
                />
              </div>
              <span className="oi-strike">{formatNumber(row.strike, 0)}</span>
              <div className="oi-track put" title={formatCompact(row.pe.oi)}>
                <motion.span
                  className="oi-fill put"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${put}%` }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20 }}
                />
              </div>
            </motion.div>
          );
        })}
        {active ? (
          <p className="oi-crosshair">
            {formatNumber(active.strike, 0)} · Call {formatCompact(active.ce.oi)} · Put {formatCompact(active.pe.oi)}
          </p>
        ) : null}
      </div>

      {expanded ? (
        <div className="oi-extra">
          <div>
            <p className="eyebrow">Change in open interest</p>
            <div className="oi-chart-body">
              {rows.map((row) => {
                const call = (Math.abs(row.ce.oiChg ?? 0) / maxChg) * 100;
                const put = (Math.abs(row.pe.oiChg ?? 0) / maxChg) * 100;
                return (
                  <div key={`chg-${row.strike}`} className="oi-row">
                    <div className="oi-track call" title={formatCompact(row.ce.oiChg)}>
                      <span className="oi-fill call" style={{ width: `${call}%` }} />
                    </div>
                    <span className="oi-strike">{formatNumber(row.strike, 0)}</span>
                    <div className="oi-track put" title={formatCompact(row.pe.oiChg)}>
                      <span className="oi-fill put" style={{ width: `${put}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pcr-card">
            <p className="eyebrow">Put call ratio through the session</p>
            {(series?.length ?? 0) > 1 ? (
              <svg className="pcr-spark" viewBox="0 0 220 48" role="img" aria-label="Put call ratio trend">
                <polyline points={pcrPath} />
              </svg>
            ) : (
              <p className="rail-note">The ratio path builds as the book streams</p>
            )}
            {active ? <span className="oi-crosshair">Crosshair on {formatNumber(active.strike, 0)}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function sparkPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
