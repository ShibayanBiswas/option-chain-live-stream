"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { columnHint, columnLabel, putColumns, visibleColumns } from "@/lib/columns";
import { focusStrikes } from "@/lib/display";
import { daysToExpiry } from "@/lib/expiry";
import { blackScholes, deltaFromIv } from "@/lib/greeks";
import { centerBook, chainOverflows, InwardChain, useChainWidth } from "@/components/inward-chain";
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
    case "pChg":
      return q.pChange;
    case "delta":
    case "theta":
      return null;
  }
}

function renderValue(key: ColumnKey, value: number | null) {
  if (isEmptyValue(value)) return "—";
  if (key === "iv") return formatNumber(value, 2);
  if (key === "ltp" || key === "bid" || key === "ask") return formatPrice(value);
  if (key === "chng" || key === "oiChg") return formatSigned(value, key === "chng" ? 1 : 0);
  if (key === "oi" || key === "volume") return formatCompact(value);
  if (key === "delta" || key === "theta" || key === "pChg") return formatNumber(value, 2);
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
  resetKey,
}: {
  value: number | null;
  children: ReactNode;
  className?: string;
  resetKey: string;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const prev = useRef<number | null>(null);
  const prevKey = useRef(resetKey);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sameBook = prevKey.current === resetKey;
    if (sameBook && prev.current !== null && value !== null && prev.current !== value) {
      el.classList.remove("cell-flash-up", "cell-flash-down");
      void el.offsetWidth;
      el.classList.add(value > prev.current ? "cell-flash-up" : "cell-flash-down");
    }
    prev.current = value;
    prevKey.current = resetKey;
  }, [resetKey, value]);

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
  const narrow = useNarrow();
  const callCols = useMemo(() => {
    const cols = visibleColumns(snapshot.rows, density, { marketOpen: snapshot.marketOpen });
    if (narrow && density === "focus") return cols.filter((key) => key === "oi" || key === "ltp");
    return cols;
  }, [density, narrow, snapshot.marketOpen, snapshot.rows]);
  const peCols = useMemo(() => putColumns(callCols), [callCols]);
  const spotStrike = snapshot.totals.atm;

  const rows = useMemo(() => {
    const allowed = new Set(
      focusStrikes(
        snapshot.rows.map((row) => row.strike),
        snapshot.spot,
        depth,
        snapshot.totals.atm,
      ),
    );
    return snapshot.rows.filter((row) => allowed.has(row.strike));
  }, [depth, snapshot.rows, snapshot.spot, snapshot.totals.atm]);

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

  const { ref: hostRef, width } = useChainWidth();
  const pin = chainOverflows(width, callCols.length + peCols.length, density);

  useEffect(() => {
    centerBook(spotStrike);
  }, [density, snapshot.expiry, snapshot.symbol, spotStrike, pin]);

  const lineProps = (row: ChainRow, index: number) => {
    const previous = rows[index - 1];
    const spot = snapshot.spot;
    const showSpot = spot != null && previous != null && previous.strike < spot && row.strike > spot;
    const atSpot = row.strike === spotStrike;
    const callQuiet = !row.ce.volume;
    const putQuiet = !row.pe.volume;
    const itmCall = spot != null && row.strike < spot;
    const itmPut = spot != null && row.strike > spot;
    return { previous, spot, showSpot, atSpot, callQuiet, putQuiet, itmCall, itmPut };
  };

  if (pin) {
    return (
      <InwardChain
        hostRef={hostRef}
        density={density}
        callSpan={callCols.length}
        putSpan={peCols.length}
        layoutKey={`${snapshot.symbol}:${snapshot.expiry}:${callCols.length}:${rows.length}`}
        callHead={callCols.map((key) => (
          <th key={`ce-${key}`} scope="col" className={cn("ce-zone", `col-${key}`)} title={columnHint(key)}>
            {columnLabel(key)}
          </th>
        ))}
        putHead={peCols.map((key) => (
          <th key={`pe-${key}`} scope="col" className={cn("pe-zone", `col-${key}`)} title={columnHint(key)}>
            {columnLabel(key)}
          </th>
        ))}
        rows={rows.map((row, index) => {
          const { spot, showSpot, atSpot, callQuiet, putQuiet, itmCall, itmPut } = lineProps(row, index);
          return {
            key: String(row.strike),
            id: `strike-${row.strike}`,
            className: cn(
              "chain-row",
              atSpot && "is-atm",
              callQuiet && putQuiet && "is-zero",
              itmCall && "is-itm-call",
              itmPut && "is-itm-put",
            ),
            tabIndex: 0,
            volume: callQuiet && putQuiet ? "zero" : "traded",
            onClick: () => onSelect(row),
            onKeyDown: (event) => {
              if (event.key === "Enter") onSelect(row);
            },
            spot: showSpot ? `Spot ${formatPrice(spot)}` : null,
            strike: formatNumber(row.strike, 0),
            call: callCols.map((key) => (
              <SideCell
                key={`ce-${row.strike}-${key}`}
                resetKey={`${snapshot.symbol}:${snapshot.expiry}`}
                side="ce"
                field={key}
                quote={row.ce}
                strike={row.strike}
                spot={spot}
                expiry={snapshot.expiry}
                high={bands.high}
                low={bands.low}
                scale={key === "oi" || key === "volume" ? (key === "oi" ? scales.oi : scales.volume) : 0}
                itm={itmCall}
              />
            )),
            put: peCols.map((key) => (
              <SideCell
                key={`pe-${row.strike}-${key}`}
                resetKey={`${snapshot.symbol}:${snapshot.expiry}`}
                side="pe"
                field={key}
                quote={row.pe}
                strike={row.strike}
                spot={spot}
                expiry={snapshot.expiry}
                high={bands.high}
                low={bands.low}
                scale={key === "oi" || key === "volume" ? (key === "oi" ? scales.oi : scales.volume) : 0}
                itm={itmPut}
              />
            )),
          };
        })}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className="chain-scroll"
      data-density={density}
      data-compact={narrow && density === "focus" ? "true" : undefined}
    >
      <table className="chain-table">
        <thead>
          <tr className="side-labels">
            <th className="ce-zone" colSpan={callCols.length} scope="colgroup">
              Calls
            </th>
            <th className="strike-cell" scope="col" />
            <th className="pe-zone" colSpan={peCols.length} scope="colgroup">
              Puts
            </th>
          </tr>
          <tr className="column-head">
            {callCols.map((key) => (
              <th key={`ce-${key}`} scope="col" className={cn("ce-zone", `col-${key}`)} title={columnHint(key)}>
                {columnLabel(key)}
              </th>
            ))}
            <th className="strike-cell" scope="col">Strike</th>
            {peCols.map((key) => (
              <th key={`pe-${key}`} scope="col" className={cn("pe-zone", `col-${key}`)} title={columnHint(key)}>
                {columnLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const previous = rows[index - 1];
            const spot = snapshot.spot;
            const showSpot = spot != null && previous != null && previous.strike < spot && row.strike > spot;
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
                  tabIndex={0}
                  data-volume={callQuiet && putQuiet ? "zero" : "traded"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSelect(row);
                  }}
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
                      resetKey={`${snapshot.symbol}:${snapshot.expiry}`}
                      side="ce"
                      field={key}
                      quote={row.ce}
                      strike={row.strike}
                      spot={spot}
                      expiry={snapshot.expiry}
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
                      resetKey={`${snapshot.symbol}:${snapshot.expiry}`}
                      side="pe"
                      field={key}
                      quote={row.pe}
                      strike={row.strike}
                      spot={spot}
                      expiry={snapshot.expiry}
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
    </div>
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
  strike,
  spot,
  expiry,
  resetKey,
}: {
  side: "ce" | "pe";
  field: ColumnKey;
  quote: OptionQuote;
  high: number;
  low: number;
  scale: number;
  itm: boolean;
  strike: number;
  spot: number | null;
  expiry: string;
  resetKey: string;
}) {
  const days = daysToExpiry(expiry);
  const kind = side === "ce" ? "call" : "put";
  const value =
    field === "delta"
      ? deltaFromIv({ spot, strike, ivPercent: quote.iv, days, type: kind })
      : field === "theta"
        ? blackScholes({
            spot: spot ?? 0,
            strike,
            rate: 0.065,
            sigma: (quote.iv ?? 0) / 100,
            timeYears: (days ?? 0) / 365,
            type: kind,
          })?.theta ?? null
        : readField(quote, field);
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
      resetKey={resetKey}
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
          {formatSigned(quote.change, 1)}
        </span>
      ) : null}
    </FlashCell>
  );
}
