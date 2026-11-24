"use client";

import { formatCompact } from "@/lib/format";
import type { OptionChainSnapshot } from "@/lib/types";

export function PcrTrend({ points }: { points: number[] }) {
  const series = points.slice(-40);
  const max = Math.max(0.1, ...series, 1);
  const d =
    series.length < 2
      ? ""
      : series
          .map((value, index) => {
            const x = (index / (series.length - 1)) * 100;
            const y = 36 - (value / max) * 30;
            return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ");
  return (
    <section className="trend-card" aria-label="Put call ratio trend">
      <p className="eyebrow">Put Call Ratio</p>
      <h2>Session Trend</h2>
      <svg viewBox="0 0 100 40" className="trend-line" role="img">
        {d ? <path d={d} /> : null}
      </svg>
    </section>
  );
}

export function OiChangeChart({ snapshot }: { snapshot: OptionChainSnapshot }) {
  const spot = snapshot.totals.atm;
  const rows = (() => {
    if (spot == null) return snapshot.rows.slice(0, 12);
    const index = snapshot.rows.findIndex((row) => row.strike === spot);
    if (index < 0) return snapshot.rows.slice(0, 12);
    return snapshot.rows.slice(Math.max(0, index - 5), index + 6);
  })();
  const max = Math.max(1, ...rows.flatMap((row) => [Math.abs(row.ce.oiChg ?? 0), Math.abs(row.pe.oiChg ?? 0)]));
  return (
    <section className="trend-card" aria-label="Open interest change">
      <p className="eyebrow">Open Interest</p>
      <h2>Change by Strike</h2>
      <div className="oi-change">
        {rows.map((row) => (
          <div key={row.strike} className="oi-change-row" title={formatCompact(row.ce.oiChg)}>
            <span style={{ width: `${(Math.abs(row.ce.oiChg ?? 0) / max) * 100}%` }} className="call" />
            <em>{row.strike}</em>
            <span style={{ width: `${(Math.abs(row.pe.oiChg ?? 0) / max) * 100}%` }} className="put" />
          </div>
        ))}
      </div>
    </section>
  );
}
