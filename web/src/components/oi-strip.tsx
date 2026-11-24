"use client";

import type { ChainRow } from "@/lib/types";

/** About 15 strikes around spot. Calls grow left, puts grow right. */
export function OiStrip({ rows, atm }: { rows: ChainRow[]; atm: number | null }) {
  const index = atm == null ? -1 : rows.findIndex((row) => row.strike === atm);
  const start = index < 0 ? 0 : Math.max(0, index - 7);
  const window = rows.slice(start, start + 15);
  const max = Math.max(1, ...window.flatMap((row) => [row.ce.oi ?? 0, row.pe.oi ?? 0]));
  return (
    <div className="oi-strip" aria-label="Open interest by strike">
      {window.map((row) => (
        <div className="oi-strip-row" key={row.strike}>
          <i className="oi-strip-bar call" style={{ width: `${((row.ce.oi ?? 0) / max) * 100}%` }} />
          <span>{row.strike.toLocaleString("en-IN")}</span>
          <i className="oi-strip-bar put" style={{ width: `${((row.pe.oi ?? 0) / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
