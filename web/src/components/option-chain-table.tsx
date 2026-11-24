"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode, type TdHTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { columnLabel, columnTip, columnsFor, putColumns, quoteField } from "@/lib/columns";
import { chainMarks, depthPercent, heatIntensity, volumeBands, volumeClass, windowRows } from "@/lib/depth";
import { cn } from "@/lib/cn";
import { formatCompact, formatNumber, formatPrice, formatSigned, isEmptyValue } from "@/lib/format";
import type { ChainRow, ColumnKey, OptionChainSnapshot, OptionQuote } from "@/lib/types";

function renderValue(key: ColumnKey, value: number | null) {
  if (isEmptyValue(value)) return "—";
  if (key === "ltp" || key === "bid" || key === "ask" || key === "iv") return formatPrice(value);
  if (key === "chng" || key === "oiChg") return formatSigned(value, key === "chng" ? 2 : 0);
  if (key === "oi" || key === "volume") return formatCompact(value);
  return formatNumber(value, 0);
}

function FlashCell({
  value,
  children,
  className,
  ...rest
}: {
  value: number | null;
  children: ReactNode;
  className?: string;
} & TdHTMLAttributes<HTMLTableCellElement>) {
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
    <td ref={ref} className={className} {...rest}>
      {children}
    </td>
  );
}

type ViewLine =
  | { kind: "spot"; price: number }
  | { kind: "strike"; row: ChainRow };

function viewLines(rows: ChainRow[], spot: number | null): ViewLine[] {
  const lines: ViewLine[] = [];
  let placed = false;
  for (const row of rows) {
    if (!placed && spot != null && row.strike > spot) {
      lines.push({ kind: "spot", price: spot });
      placed = true;
    }
    lines.push({ kind: "strike", row });
  }
  if (!placed && spot != null) lines.push({ kind: "spot", price: spot });
  return lines;
}

export function OptionChainTable({
  snapshot,
  depth,
  density,
  onSelect,
}: {
  snapshot: OptionChainSnapshot;
  depth: "near" | "full";
  density: "collapsed" | "expanded";
  onSelect: (row: ChainRow) => void;
}) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const callHead = useRef<HTMLDivElement>(null);
  const putHead = useRef<HTMLDivElement>(null);
  const callBody = useRef<HTMLDivElement>(null);
  const putBody = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => windowRows(snapshot.rows, snapshot.totals.atm, depth),
    [depth, snapshot.rows, snapshot.totals.atm],
  );
  const callCols = useMemo(() => columnsFor(rows, density), [density, rows]);
  const peCols = useMemo(() => putColumns(callCols), [callCols]);
  const lines = useMemo(() => viewLines(rows, snapshot.spot), [rows, snapshot.spot]);
  const marks = useMemo(() => chainMarks(rows), [rows]);
  const bands = useMemo(
    () => volumeBands(rows.flatMap((row) => [row.ce.volume ?? 0, row.pe.volume ?? 0])),
    [rows],
  );
  const volumeValues = useMemo(
    () => rows.flatMap((row) => [row.ce.volume ?? 0, row.pe.volume ?? 0]),
    [rows],
  );
  const maxOi = useMemo(
    () => ({
      ce: Math.max(1, ...rows.map((row) => row.ce.oi ?? 0)),
      pe: Math.max(1, ...rows.map((row) => row.pe.oi ?? 0)),
    }),
    [rows],
  );
  const maxVol = useMemo(
    () => ({
      ce: Math.max(1, ...rows.map((row) => row.ce.volume ?? 0)),
      pe: Math.max(1, ...rows.map((row) => row.pe.volume ?? 0)),
    }),
    [rows],
  );

  useEffect(() => {
    const pairs: Array<[HTMLDivElement | null, HTMLDivElement | null]> = [
      [callBody.current, callHead.current],
      [putBody.current, putHead.current],
    ];
    const align = (body: HTMLDivElement | null, head: HTMLDivElement | null, fromEnd: boolean) => {
      if (!body || !head || body.clientWidth < 40) return;
      const min = 64;
      const count = Math.max(1, Math.floor(body.clientWidth / min));
      const width = body.clientWidth / count;
      body.style.setProperty("--col", `${width}px`);
      head.style.setProperty("--col", `${width}px`);
      const columns = head.querySelectorAll("tr:last-child [data-col]").length;
      const offset = fromEnd ? Math.max(0, columns - count) * width : 0;
      body.scrollLeft = offset;
      head.scrollLeft = offset;
    };
    const alignBoth = () => {
      align(callBody.current, callHead.current, true);
      align(putBody.current, putHead.current, false);
    };
    alignBoth();
    const frame = requestAnimationFrame(alignBoth);
    const stops: Array<() => void> = [() => cancelAnimationFrame(frame)];
    for (const [body, head] of pairs) {
      if (!body || !head) continue;
      const sync = () => {
        head.scrollLeft = body.scrollLeft;
      };
      sync();
      body.addEventListener("scroll", sync, { passive: true });
      stops.push(() => body.removeEventListener("scroll", sync));
    }
    return () => stops.forEach((stop) => stop());
  }, [callCols, peCols, rows.length]);

  useEffect(() => {
    const root = scroller.current;
    const marker = root?.querySelector(".spot-marker");
    if (!root || !(marker instanceof HTMLElement)) return;
    const top = marker.offsetTop - root.clientHeight / 2 + marker.clientHeight / 2;
    root.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }, [reduce, snapshot.expiry, snapshot.symbol, snapshot.spot]);

  const span =
    rows.length > 0
      ? `Strikes ${formatNumber(rows[0]!.strike, 0)} to ${formatNumber(rows[rows.length - 1]!.strike, 0)}`
      : "No strikes";

  return (
    <div className="chain-frame" data-density={density}>
      <div className="chain-toolbar">
        <p className="chain-span">{span}</p>
        <span className="heat-legend">
          <i className="swatch high" /> High volume
          <i className="swatch low" /> Low volume
          <i className="swatch zero" /> No volume
        </span>
      </div>
      <motion.div
        ref={scroller}
        className="chain-scroll"
        data-density={density}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {rows.length === 0 ? <p className="board-wait">No strikes in this expiry</p> : null}
        <div className="chain-head" data-testid="chain-head">
          <div className="chain-split">
            <div className="chain-pane calls">
              <div className="side-banner call-banner">Calls</div>
              <div className="chain-pane-scroll" ref={callHead}>
                <table className="chain-table">
                  <thead>
                    <tr>
                      {callCols.map((key) => (
                        <th key={key} className="ce-zone" data-col={key} title={columnTip(key)}>
                          {columnLabel(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
            </div>
            <div className="chain-pane strike">
              <table className="chain-table strike-table">
                <thead>
                  <tr>
                    <th className="strike-cell">Strike</th>
                  </tr>
                  <tr>
                    <th className="strike-cell">Price</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="chain-pane puts">
              <div className="side-banner put-banner">Puts</div>
              <div className="chain-pane-scroll" ref={putHead}>
                <table className="chain-table">
                  <thead>
                    <tr>
                      {peCols.map((key) => (
                        <th key={key} className="pe-zone" data-col={key} title={columnTip(key)}>
                          {columnLabel(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="chain-split chain-body">
          <div className="chain-pane calls" ref={callBody}>
            <table className="chain-table">
              <caption className="sr-only">Call contracts</caption>
              <tbody>
                {lines.map((line) =>
                  line.kind === "spot" ? (
                    <tr key="spot" className="spot-marker">
                      <td colSpan={callCols.length} />
                    </tr>
                  ) : (
                    <SideRow
                      key={line.row.strike}
                      row={line.row}
                      side="ce"
                      cols={callCols}
                      spot={snapshot.spot}
                      bands={bands}
                      volumeValues={volumeValues}
                      maxOi={maxOi.ce}
                      maxVol={maxVol.ce}
                      onSelect={onSelect}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div className="chain-pane strike">
            <table className="chain-table strike-table">
              <tbody>
                {lines.map((line) =>
                  line.kind === "spot" ? (
                    <tr key="spot" className="spot-marker">
                      <td className="strike-cell spot-marker-label">{formatPrice(line.price)}</td>
                    </tr>
                  ) : (
                    <tr
                      key={line.row.strike}
                      id={`strike-${line.row.strike}`}
                      data-strike={line.row.strike}
                      className={cn("chain-row", line.row.strike === snapshot.totals.atm && "is-atm")}
                      onClick={() => onSelect(line.row)}
                    >
                      <td
                        className="strike-cell"
                        data-call-wall={marks.callWall === line.row.strike ? "true" : undefined}
                        data-put-wall={marks.putWall === line.row.strike ? "true" : undefined}
                        data-move={marks.moveStrike === line.row.strike ? "true" : undefined}
                        title={strikeTitle(line.row.strike, marks)}
                      >
                        {formatNumber(line.row.strike, 0)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div className="chain-pane puts" ref={putBody}>
            <table className="chain-table">
              <caption className="sr-only">Put contracts</caption>
              <tbody>
                {lines.map((line) =>
                  line.kind === "spot" ? (
                    <tr key="spot" className="spot-marker">
                      <td colSpan={peCols.length} />
                    </tr>
                  ) : (
                    <SideRow
                      key={line.row.strike}
                      row={line.row}
                      side="pe"
                      cols={peCols}
                      spot={snapshot.spot}
                      bands={bands}
                      volumeValues={volumeValues}
                      maxOi={maxOi.pe}
                      maxVol={maxVol.pe}
                      onSelect={onSelect}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function strikeTitle(strike: number, marks: ReturnType<typeof chainMarks>): string | undefined {
  const notes: string[] = [];
  if (marks.callWall === strike) notes.push("Highest call open interest");
  if (marks.putWall === strike) notes.push("Highest put open interest");
  if (marks.moveStrike === strike) notes.push("Largest price change");
  return notes.length ? notes.join(". ") : undefined;
}

function SideRow({
  row,
  side,
  cols,
  spot,
  bands,
  volumeValues,
  maxOi,
  maxVol,
  onSelect,
}: {
  row: ChainRow;
  side: "ce" | "pe";
  cols: ColumnKey[];
  spot: number | null;
  bands: { high: number; low: number };
  volumeValues: number[];
  maxOi: number;
  maxVol: number;
  onSelect: (row: ChainRow) => void;
}) {
  const quote = side === "ce" ? row.ce : row.pe;
  const quiet = !quote.volume && !(side === "ce" ? row.pe.volume : row.ce.volume);
  const itm = spot != null && (side === "ce" ? row.strike < spot : row.strike > spot);
  return (
    <tr
      data-strike={row.strike}
      data-volume={!row.ce.volume && !row.pe.volume ? "zero" : "traded"}
      className={cn("chain-row", quiet && "is-zero")}
      onClick={() => onSelect(row)}
    >
      {cols.map((key) => (
        <SideCell
          key={`${side}-${row.strike}-${key}`}
          side={side}
          field={key}
          quote={quote}
          itm={itm}
          bands={bands}
          volumeValues={volumeValues}
          maxOi={maxOi}
          maxVol={maxVol}
        />
      ))}
    </tr>
  );
}

function SideCell({
  side,
  field,
  quote,
  itm,
  bands,
  volumeValues,
  maxOi,
  maxVol,
}: {
  side: "ce" | "pe";
  field: ColumnKey;
  quote: OptionQuote;
  itm: boolean;
  bands: { high: number; low: number };
  volumeValues: number[];
  maxOi: number;
  maxVol: number;
}) {
  const value = quoteField(quote, field);
  const tone =
    field === "chng" || field === "oiChg" ? (value && value > 0 ? "tone-up" : value && value < 0 ? "tone-down" : "") : "";
  const heat = field === "ltp" ? volumeClass(quote.volume, bands) : null;
  const intensity = field === "ltp" ? heatIntensity(quote.volume, volumeValues) : 0;
  const depth =
    field === "oi" ? depthPercent(value, maxOi) : field === "volume" ? depthPercent(value, maxVol) : 0;
  const zone = side === "ce" ? "ce-zone call-side" : "pe-zone put-side";

  return (
    <FlashCell
      value={value}
      data-col={field}
      className={cn(zone, tone, itm && "is-itm", heat === "zero" && field === "ltp" && "vol-zero", heat && heat !== "zero" && field === "ltp" && `vol-${heat}`)}
      style={field === "ltp" && heat && heat !== "zero" ? ({ "--heat": String(intensity) } as CSSProperties) : undefined}
    >
      {depth > 0 ? (
        <span className="depth">
          <span className={cn("depth-bar", side === "ce" ? "call" : "put")} style={{ width: `${depth}%` }} />
          <span className="depth-val">{renderValue(field, value)}</span>
        </span>
      ) : (
        renderValue(field, value)
      )}
    </FlashCell>
  );
}
