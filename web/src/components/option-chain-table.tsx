"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { columnLabel, putColumns, visibleColumns } from "@/lib/columns";
import { cn } from "@/lib/cn";
import { formatCompact, formatNumber, formatPrice, formatSigned, isEmptyValue } from "@/lib/format";
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
  if (key === "ltp" || key === "bid" || key === "ask" || key === "iv") return formatPrice(value);
  if (key === "chng" || key === "oiChg") return formatSigned(value, key === "chng" ? 2 : 0);
  if (key === "oi" || key === "volume") return formatCompact(value);
  return formatNumber(value, 0);
}

function volumeBand(value: number | null, high: number, low: number): "high" | "low" | "mid" | null {
  if (!value) return null;
  if (value >= high) return "high";
  if (value <= low) return "low";
  return "mid";
}

function FlashCell({
  value,
  children,
  className,
}: {
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
      el.classList.remove("cell-flash-up", "cell-flash-down");
      void el.offsetWidth;
      el.classList.add(value > prev.current ? "cell-flash-up" : "cell-flash-down");
    }
    prev.current = value;
  }, [value]);

  return (
    <td ref={ref} className={className}>
      {children}
    </td>
  );
}

export function OptionChainTable({
  snapshot,
  depth,
  density,
  onSelect,
}: {
  snapshot: OptionChainSnapshot;
  depth: "near" | "full";
  density: "focus" | "full";
  onSelect: (row: ChainRow) => void;
}) {
  const reduce = useReducedMotion();
  const callCols = useMemo(
    () => visibleColumns(snapshot.rows, density),
    [density, snapshot.rows],
  );
  const peCols = useMemo(() => putColumns(callCols), [callCols]);
  const spotStrike = snapshot.totals.atm;

  const rows = useMemo(() => {
    if (depth === "full" || spotStrike == null) return snapshot.rows;
    const idx = snapshot.rows.findIndex((row) => row.strike === spotStrike);
    if (idx < 0) return snapshot.rows;
    return snapshot.rows.slice(Math.max(0, idx - 18), Math.min(snapshot.rows.length, idx + 19));
  }, [depth, snapshot.rows, spotStrike]);

  const bands = useMemo(() => {
    const volumes = rows
      .flatMap((row) => [row.ce.volume ?? 0, row.pe.volume ?? 0])
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    if (volumes.length < 4) return { high: Number.POSITIVE_INFINITY, low: 0 };
    return {
      high: volumes[Math.floor(volumes.length * 0.8)] ?? Number.POSITIVE_INFINITY,
      low: volumes[Math.floor(volumes.length * 0.2)] ?? 0,
    };
  }, [rows]);

  useEffect(() => {
    const row = document.getElementById(`strike-${spotStrike}`);
    const scroller = row?.closest(".chain-scroll");
    if (!row || !(scroller instanceof HTMLElement)) return;
    const top = row.offsetTop - scroller.clientHeight / 2 + row.clientHeight / 2;
    scroller.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }, [reduce, snapshot.expiry, snapshot.symbol, spotStrike]);

  return (
    <motion.div
      className="chain-scroll"
      data-density={density}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <table className="chain-table">
        <thead>
          <tr>
            <th colSpan={callCols.length} className="side-banner call-banner">
              Calls
            </th>
            <th className="strike-cell">Strike</th>
            <th colSpan={peCols.length} className="side-banner put-banner">
              Puts
            </th>
          </tr>
          <tr>
            {callCols.map((key) => (
              <th key={`ce-${key}`} className="ce-zone">
                {columnLabel(key)}
              </th>
            ))}
            <th className="strike-cell">Price</th>
            {peCols.map((key) => (
              <th key={`pe-${key}`} className="pe-zone">
                {columnLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const atSpot = row.strike === spotStrike;
            const callQuiet = !row.ce.volume;
            const putQuiet = !row.pe.volume;
            const itmCall = snapshot.spot != null && row.strike < snapshot.spot;
            const itmPut = snapshot.spot != null && row.strike > snapshot.spot;
            return (
              <tr
                key={row.strike}
                id={`strike-${row.strike}`}
                data-volume={callQuiet && putQuiet ? "zero" : "traded"}
                className={cn(
                  "chain-row",
                  atSpot && "is-atm",
                  callQuiet && putQuiet && "is-zero",
                  itmCall && "is-itm-call",
                  itmPut && "is-itm-put",
                )}
                onClick={() => onSelect(row)}
              >
                {callCols.map((key) => (
                  <SideCell
                    key={`ce-${row.strike}-${key}`}
                    side="ce"
                    field={key}
                    quote={row.ce}
                    high={bands.high}
                    low={bands.low}
                  />
                ))}
                <td className="strike-cell">{formatNumber(row.strike, 0)}</td>
                {peCols.map((key) => (
                  <SideCell
                    key={`pe-${row.strike}-${key}`}
                    side="pe"
                    field={key}
                    quote={row.pe}
                    high={bands.high}
                    low={bands.low}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
}

function SideCell({
  side,
  field,
  quote,
  high,
  low,
}: {
  side: "ce" | "pe";
  field: ColumnKey;
  quote: OptionQuote;
  high: number;
  low: number;
}) {
  const value = readField(quote, field);
  const tone =
    field === "chng" || field === "oiChg"
      ? value && value > 0
        ? "tone-up"
        : value && value < 0
          ? "tone-down"
          : ""
      : "";
  const quiet = !quote.volume;
  const heat = !quiet && field === "ltp" ? volumeBand(quote.volume, high, low) : null;

  return (
    <FlashCell
      value={value}
      className={cn(side === "ce" ? "ce-zone" : "pe-zone", tone, quiet && "vol-zero", heat && `vol-${heat}`)}
    >
      {renderValue(field, value)}
    </FlashCell>
  );
}
