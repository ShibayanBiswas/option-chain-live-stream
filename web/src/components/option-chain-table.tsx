"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { columnLabel, visibleColumns } from "@/lib/columns";
import { cn } from "@/lib/cn";
import {
  formatCompact,
  formatNumber,
  formatPrice,
  formatSigned,
  isEmptyValue,
} from "@/lib/format";
import type { ChainRow, ColumnKey, OptionChainSnapshot, OptionQuote } from "@/lib/types";

function readField(q: OptionQuote, key: ColumnKey): number | null {
  switch (key) {
    case "oi":
      return q.oi;
    case "oiChg":
      return q.oiChg;
    case "volume":
      return q.volume;
    case "iv":
      return q.iv;
    case "ltp":
      return q.lastPrice;
    case "chng":
      return q.change;
    case "bidQty":
      return q.bidQty;
    case "bid":
      return q.bid;
    case "ask":
      return q.ask;
    case "askQty":
      return q.askQty;
  }
}

function renderValue(key: ColumnKey, value: number | null) {
  if (isEmptyValue(value)) return "—";
  if (key === "ltp" || key === "bid" || key === "ask" || key === "iv") {
    return formatPrice(value);
  }
  if (key === "chng" || key === "oiChg") return formatSigned(value, key === "chng" ? 2 : 0);
  if (key === "oi" || key === "volume") return formatCompact(value);
  return formatNumber(value, 0);
}

function OiBar({ value, max, side }: { value: number | null; max: number; side: "ce" | "pe" }) {
  if (!value || !max) return null;
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <span
      className="oi-bar"
      style={{
        width: `${pct}%`,
        background: side === "ce" ? "rgba(22,163,74,0.55)" : "rgba(194,65,12,0.55)",
      }}
    />
  );
}

function FlashCell({
  cellKey,
  value,
  children,
  className,
}: {
  cellKey: string;
  value: number | null;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prev.current !== null && value !== null && prev.current !== value) {
      const up = value > prev.current;
      el.classList.remove("cell-flash-up", "cell-flash-down");
      // force reflow
      void el.offsetWidth;
      el.classList.add(up ? "cell-flash-up" : "cell-flash-down");
    }
    prev.current = value;
  }, [value, cellKey]);

  return (
    <td ref={ref} className={className}>
      {children}
    </td>
  );
}

export function OptionChainTable({
  snapshot,
  mode = "atm",
}: {
  snapshot: OptionChainSnapshot;
  mode?: "atm" | "all";
}) {
  const reduce = useReducedMotion();
  const cols = useMemo(() => visibleColumns(snapshot.rows), [snapshot.rows]);
  const atm = snapshot.totals.atm;
  const maxOi = useMemo(() => {
    let m = 1;
    for (const row of snapshot.rows) {
      m = Math.max(m, row.ce.oi ?? 0, row.pe.oi ?? 0);
    }
    return m;
  }, [snapshot.rows]);

  const focusRows = useMemo(() => {
    if (mode === "all" || !atm) return snapshot.rows;
    const idx = snapshot.rows.findIndex((r) => r.strike === atm);
    if (idx < 0) return snapshot.rows;
    const start = Math.max(0, idx - 25);
    const end = Math.min(snapshot.rows.length, idx + 26);
    return snapshot.rows.slice(start, end);
  }, [atm, mode, snapshot.rows]);

  useEffect(() => {
    const el = document.getElementById(`strike-${atm}`);
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [atm, reduce, snapshot.expiry, snapshot.symbol]);

  return (
    <motion.div
      className="chain-scroll"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <table className="chain-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={`ce-h-${c}`} className="ce-zone text-right">
                {columnLabel(c)}
              </th>
            ))}
            <th className="strike-cell">Strike</th>
            {cols.map((c) => (
              <th key={`pe-h-${c}`} className="pe-zone text-right">
                {columnLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {focusRows.map((row) => (
            <ChainTr
              key={row.strike}
              row={row}
              cols={cols}
              atm={atm}
              maxOi={maxOi}
            />
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}

function ChainTr({
  row,
  cols,
  atm,
  maxOi,
}: {
  row: ChainRow;
  cols: ColumnKey[];
  atm: number | null;
  maxOi: number;
}) {
  const isAtm = atm === row.strike;
  return (
    <tr id={`strike-${row.strike}`} className={cn(isAtm && "is-atm")}>
      {cols.map((c) => {
        const value = readField(row.ce, c);
        const tone =
          c === "chng" || c === "oiChg"
            ? value && value > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : value && value < 0
                ? "text-orange-700 dark:text-orange-300"
                : ""
            : "";
        return (
          <FlashCell
            key={`ce-${row.strike}-${c}`}
            cellKey={`ce-${row.strike}-${c}`}
            value={value}
            className={cn("ce-zone", tone)}
          >
            <span className="inline-flex items-center justify-end gap-1">
              {renderValue(c, value)}
              {c === "oi" ? <OiBar value={value} max={maxOi} side="ce" /> : null}
            </span>
          </FlashCell>
        );
      })}
      <td className="strike-cell">{formatNumber(row.strike, 0)}</td>
      {cols.map((c) => {
        const value = readField(row.pe, c);
        const tone =
          c === "chng" || c === "oiChg"
            ? value && value > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : value && value < 0
                ? "text-orange-700 dark:text-orange-300"
                : ""
            : "";
        return (
          <FlashCell
            key={`pe-${row.strike}-${c}`}
            cellKey={`pe-${row.strike}-${c}`}
            value={value}
            className={cn("pe-zone", tone)}
          >
            <span className="inline-flex items-center justify-end gap-1">
              {renderValue(c, value)}
              {c === "oi" ? <OiBar value={value} max={maxOi} side="pe" /> : null}
            </span>
          </FlashCell>
        );
      })}
    </tr>
  );
}
