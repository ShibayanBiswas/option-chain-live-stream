"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { chainHighlights } from "@/lib/analytics";
import { columnHint, columnLabel, putColumns, visibleColumns } from "@/lib/columns";
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
  const narrow = useNarrow();
  const callCols = useMemo(() => {
    const cols = visibleColumns(snapshot.rows, density);
    if (narrow && density === "focus") return cols.filter((key) => key === "oi" || key === "ltp");
    return cols;
  }, [density, narrow, snapshot.rows]);
  const peCols = useMemo(() => putColumns(callCols), [callCols]);
  const spotStrike = snapshot.totals.atm;

  const rows = useMemo(() => {
    if (depth === "full" || spotStrike == null) return snapshot.rows;
    const idx = snapshot.rows.findIndex((row) => row.strike === spotStrike);
    if (idx < 0) return snapshot.rows;
    return snapshot.rows.slice(Math.max(0, idx - 18), Math.min(snapshot.rows.length, idx + 19));
  }, [depth, snapshot.rows, spotStrike]);

  const highlights = useMemo(() => chainHighlights(rows), [rows]);
  const scales = useMemo(() => {
    const oi = Math.max(1, ...rows.flatMap((row) => [row.ce.oi ?? 0, row.pe.oi ?? 0]));
    const volume = Math.max(1, ...rows.flatMap((row) => [row.ce.volume ?? 0, row.pe.volume ?? 0]));
    return { oi, volume };
  }, [rows]);

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
    const cell = row.querySelector(".strike-cell");
    const delta =
      cell instanceof HTMLElement
        ? cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left
        : 0;
    const left =
      cell instanceof HTMLElement
        ? scroller.scrollLeft + delta - scroller.clientWidth / 2 + cell.clientWidth / 2
        : scroller.scrollLeft;
    scroller.scrollTo({
      top: Math.max(0, top),
      left: Math.max(0, left),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [reduce, snapshot.expiry, snapshot.symbol, spotStrike]);

  return (
    <motion.div
      className="chain-scroll"
      data-density={density}
      data-compact={narrow && density === "focus" ? "true" : undefined}
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
              <th key={`ce-${key}`} className={cn("ce-zone", `col-${key}`)} title={columnHint(key)}>
                {columnLabel(key)}
              </th>
            ))}
            <th className="strike-cell">Strike</th>
            {peCols.map((key) => (
              <th key={`pe-${key}`} className={cn("pe-zone", `col-${key}`)} title={columnHint(key)}>
                {columnLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const previous = rows[index - 1];
            const spot = snapshot.spot;
            const showSpot =
              spot != null &&
              previous != null &&
              previous.strike < spot &&
              row.strike > spot;
            const atSpot = row.strike === spotStrike;
            const callQuiet = !row.ce.volume;
            const putQuiet = !row.pe.volume;
            const itmCall = spot != null && row.strike < spot;
            const itmPut = spot != null && row.strike > spot;
            const span = callCols.length + peCols.length + 1;
            return (
              <Fragment key={row.strike}>
                {showSpot ? (
                  <tr className="spot-marker" data-testid="spot-marker">
                    <td colSpan={span}>
                      <span>Spot {formatPrice(spot)}</span>
                    </td>
                  </tr>
                ) : null}
                <tr
                  id={`strike-${row.strike}`}
                  data-volume={callQuiet && putQuiet ? "zero" : "traded"}
                  data-highlight={
                    row.strike === highlights.maxCallOi
                      ? "call-oi"
                      : row.strike === highlights.maxPutOi
                        ? "put-oi"
                        : row.strike === highlights.maxMove
                          ? "move"
                          : undefined
                  }
                  className={cn(
                    "chain-row",
                    atSpot && "is-atm",
                    callQuiet && putQuiet && "is-zero",
                    itmCall && "is-itm-call",
                    itmPut && "is-itm-put",
                    row.strike === highlights.maxCallOi && "is-call-wall",
                    row.strike === highlights.maxPutOi && "is-put-wall",
                    row.strike === highlights.maxMove && "is-move",
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
                      scale={key === "oi" || key === "volume" ? (key === "oi" ? scales.oi : scales.volume) : 0}
                      itm={itmCall}
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
                      scale={key === "oi" || key === "volume" ? (key === "oi" ? scales.oi : scales.volume) : 0}
                      itm={itmPut}
                    />
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
}

function useNarrow() {
  const [matches, setMatches] = useState(false);
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return matches;
}

function SideCell({
  side,
  field,
  quote,
  high,
  low,
  scale,
  itm,
}: {
  side: "ce" | "pe";
  field: ColumnKey;
  quote: OptionQuote;
  high: number;
  low: number;
  scale: number;
  itm: boolean;
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
  const depth = scale > 0 && value ? Math.max(6, Math.min(100, (value / scale) * 100)) : 0;

  return (
    <FlashCell
      value={value}
      className={cn(
        side === "ce" ? "ce-zone" : "pe-zone",
        `col-${field}`,
        "depth-cell",
        tone,
        itm && "is-itm",
        quiet && "vol-zero",
        heat && `vol-${heat}`,
      )}
    >
      {depth > 0 ? (
        <i className={cn("depth-bar", side === "ce" ? "call" : "put")} style={{ width: `${depth}%` }} />
      ) : null}
      <span className="quote-num">{renderValue(field, value)}</span>
      {field === "ltp" ? (
        <span className={cn("ltp-chng", quote.change != null && quote.change < 0 ? "tone-down" : "tone-up")}>
          {formatSigned(quote.change, 2)}
        </span>
      ) : null}
    </FlashCell>
  );
}
