"use client";

import { Fragment, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type InwardRow = {
  key: string;
  id?: string;
  className?: string;
  tabIndex?: number;
  volume?: "zero" | "traded";
  onClick?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTableRowElement>) => void;
  spot?: string | null;
  spotAfter?: string | null;
  call: ReactNode;
  strike: ReactNode;
  put: ReactNode;
};

export function useChainWidth() {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const watch = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.current = watch;
    watch.observe(node);
    setWidth(node.clientWidth);
  }, []);
  return { ref, width };
}

/** Pin the strike once the call and put columns no longer fit beside it. */
export function chainOverflows(width: number, columns: number, density: string) {
  if (density !== "full" && density !== "custom") return false;
  if (width <= 0) return false;
  return columns * 72 + 88 > width;
}

function nearestStrike(strike: number | null): HTMLElement | null {
  if (strike == null) return null;
  const exact = document.getElementById(`strike-${strike}`);
  if (exact instanceof HTMLElement) return exact;
  let best: HTMLElement | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  document.querySelectorAll<HTMLElement>("[id^='strike-']").forEach((row) => {
    const value = Number(row.id.slice("strike-".length));
    if (!Number.isFinite(value)) return;
    const dist = Math.abs(value - strike);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  });
  return best;
}

/** Scroll the spot bar into the middle. An index book omits the raw at-the-money strike when it is not a 100-point row. */
export function centerBook(strike: number | null) {
  const marker = document.querySelector("[data-testid=spot-marker]");
  const row = (marker instanceof HTMLElement ? marker : null) ?? nearestStrike(strike);
  if (!(row instanceof HTMLElement)) return;
  const pane = row.closest(".inward-panes");
  if (pane instanceof HTMLElement) {
    pane.scrollTop = Math.max(
      0,
      row.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - pane.clientHeight / 2 + row.clientHeight / 2,
    );
    return;
  }
  const scroller = row.closest(".chain-scroll");
  if (!(scroller instanceof HTMLElement)) return;
  const top =
    row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - scroller.clientHeight / 2 + row.clientHeight / 2;
  const cell = row.querySelector(".strike-cell") ?? scroller.querySelector(".strike-cell");
  const left =
    cell instanceof HTMLElement
      ? scroller.scrollLeft +
        (cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left) -
        scroller.clientWidth / 2 +
        cell.clientWidth / 2
      : scroller.scrollLeft;
  scroller.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "auto" });
}

export function InwardChain({
  hostRef,
  density,
  compact,
  callHead,
  putHead,
  callSpan,
  putSpan,
  rows,
  layoutKey,
}: {
  hostRef: (node: HTMLDivElement | null) => void;
  density: string;
  compact?: boolean;
  callHead: ReactNode;
  putHead: ReactNode;
  callSpan: number;
  putSpan: number;
  rows: InwardRow[];
  layoutKey: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bindHost = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    hostRef(node);
  }, [hostRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroll = root?.querySelector<HTMLElement>(".inward-panes");
    if (!root || !scroll) return;
    const table = (scope: string) => root.querySelector<HTMLElement>(scope);
    const callsHead = table(".inward-heads .calls table");
    const callsBody = table(".inward-panes .calls table");
    const putsHead = table(".inward-heads .puts table");
    const putsBody = table(".inward-panes .puts table");
    const callsPane = root.querySelector<HTMLElement>(".inward-panes .calls");
    const putsPane = root.querySelector<HTMLElement>(".inward-panes .puts");
    if (!callsHead || !callsBody || !putsHead || !putsBody || !callsPane || !putsPane) return;

    const span = (el: HTMLElement) => Math.max(0, el.offsetWidth - (el.parentElement?.clientWidth ?? 0));
    let callsShift = 0;
    let dragged = false;

    const lockColumns = (head: HTMLElement, body: HTMLElement, fresh: boolean) => {
      const bodyRow = body.querySelector<HTMLElement>("tbody tr:not(.spot-marker)");
      const headRow = head.querySelector<HTMLElement>("thead tr");
      if (!bodyRow || !headRow) return;
      const bodyCells = [...bodyRow.children] as HTMLElement[];
      const headCells = [...headRow.children] as HTMLElement[];
      if (bodyCells.length === 0 || bodyCells.length !== headCells.length) return;
      const settled = bodyCells.every((cell, index) => {
        const locked = parseFloat(headCells[index].style.width);
        return locked >= 2 && Math.abs(cell.getBoundingClientRect().width - locked) < 0.5;
      });
      if (!fresh && settled) return;
      // An old lock squeezes added columns to zero and clips prices that arrived later, so measure a clean table.
      for (const sheet of [head, body]) {
        sheet.style.tableLayout = "";
        sheet.style.width = "";
        sheet.style.minWidth = "";
        sheet.querySelectorAll<HTMLElement>("th, td").forEach((cell) => {
          cell.style.width = "";
          cell.style.minWidth = "";
        });
      }
      const widths = bodyCells.map((cell, index) =>
        Math.max(cell.getBoundingClientRect().width, headCells[index].getBoundingClientRect().width),
      );
      if (widths.some((width) => width < 2)) return;
      const total = widths.reduce((sum, width) => sum + width, 0);
      for (const sheet of [head, body]) {
        sheet.style.tableLayout = "fixed";
        sheet.style.width = `${total}px`;
        sheet.style.minWidth = `${total}px`;
      }
      headCells.forEach((cell, index) => {
        cell.style.width = `${widths[index]}px`;
        cell.style.minWidth = `${widths[index]}px`;
      });
      bodyCells.forEach((cell, index) => {
        cell.style.width = `${widths[index]}px`;
        cell.style.minWidth = `${widths[index]}px`;
      });
    };

    const applyX = () => {
      const maxCalls = span(callsBody);
      const maxPuts = span(putsBody);
      callsShift = Math.min(0, Math.max(-maxCalls, callsShift));
      const putsShift = maxCalls === 0 ? 0 : -((callsShift + maxCalls) / maxCalls) * maxPuts;
      const calls = `translate3d(${callsShift}px, 0, 0)`;
      const puts = `translate3d(${putsShift}px, 0, 0)`;
      callsHead.style.transform = calls;
      callsBody.style.transform = calls;
      putsHead.style.transform = puts;
      putsBody.style.transform = puts;
    };

    const park = (fresh: boolean) => {
      const heads = root.querySelector<HTMLElement>(".inward-heads");
      if (heads) heads.style.paddingRight = `${Math.max(0, scroll.offsetWidth - scroll.clientWidth)}px`;
      lockColumns(callsHead, callsBody, fresh);
      lockColumns(putsHead, putsBody, fresh);
      if (!dragged) callsShift = -span(callsBody);
      applyX();
    };

    let active = false;
    let axis: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let startShift = 0;
    const down = (event: PointerEvent) => {
      active = true;
      axis = null;
      startX = event.clientX;
      startY = event.clientY;
      startShift = callsShift;
    };
    const move = (event: PointerEvent) => {
      if (!active) return;
      if (event.pointerType === "mouse" && event.buttons === 0) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!axis) {
        if (Math.hypot(dx, dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "x") scroll.style.overflowY = "hidden";
      }
      if (axis !== "x") return;
      dragged = true;
      callsShift = startShift + dx;
      applyX();
    };
    const up = () => {
      active = false;
      axis = null;
      scroll.style.overflowY = "";
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      dragged = true;
      callsShift += event.deltaX;
      applyX();
    };

    const end = () => {
      up();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    const start = (event: PointerEvent) => {
      if (active) return;
      down(event);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };

    park(true);
    root.addEventListener("pointerdown", start);
    root.addEventListener("wheel", onWheel, { passive: false });
    let framing = false;
    const watch = new ResizeObserver(() => {
      if (framing) return;
      framing = true;
      park(false);
      requestAnimationFrame(() => {
        framing = false;
      });
    });
    watch.observe(callsPane);
    watch.observe(putsPane);
    return () => {
      watch.disconnect();
      end();
      root.removeEventListener("pointerdown", start);
      root.removeEventListener("wheel", onWheel);
    };
  }, [layoutKey]);

  const spotRow = (text: string | null | undefined, span: number, label: boolean) =>
    text ? (
      <tr className="spot-marker" data-testid={label ? "spot-marker" : undefined}>
        <td colSpan={span}>{label ? <span>{text}</span> : null}</td>
      </tr>
    ) : null;

  return (
    <div
      ref={bindHost}
      className="chain-scroll inward"
      data-density={density}
      data-inward="true"
      data-compact={compact ? "true" : undefined}
    >
      <div className="inward-captions side-labels">
        <span className="ce-zone">Calls</span>
        <span className="strike-gap" />
        <span className="pe-zone">Puts</span>
      </div>
      <div className="inward-heads">
        <div className="inward-pane calls">
          <table className="chain-table">
            <thead>
              <tr className="column-head">{callHead}</tr>
            </thead>
          </table>
        </div>
        <div className="inward-pane mid">
          <table className="chain-table">
            <thead>
              <tr className="column-head">
                <th className="strike-cell" scope="col">Strike</th>
              </tr>
            </thead>
          </table>
        </div>
        <div className="inward-pane puts">
          <table className="chain-table">
            <thead>
              <tr className="column-head">{putHead}</tr>
            </thead>
          </table>
        </div>
      </div>
      <div className="inward-panes">
        <div className="inward-pane calls">
          <table className="chain-table">
            <tbody>
              {rows.map((line) => (
                <Fragment key={line.key}>
                  {spotRow(line.spot, callSpan, false)}
                  <tr
                    className={line.className}
                    data-volume={line.volume}
                    onClick={line.onClick}
                  >
                    {line.call}
                  </tr>
                  {spotRow(line.spotAfter, callSpan, false)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inward-pane mid">
          <table className="chain-table">
            <tbody>
              {rows.map((line) => (
                <Fragment key={line.key}>
                  {spotRow(line.spot, 1, true)}
                  <tr
                    id={line.id}
                    tabIndex={line.tabIndex}
                    className={line.className}
                    data-volume={line.volume}
                    onClick={line.onClick}
                    onKeyDown={line.onKeyDown}
                  >
                    <td className="strike-cell">{line.strike}</td>
                  </tr>
                  {spotRow(line.spotAfter, 1, true)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inward-pane puts">
          <table className="chain-table">
            <tbody>
              {rows.map((line) => (
                <Fragment key={line.key}>
                  {spotRow(line.spot, putSpan, false)}
                  <tr
                    className={line.className}
                    data-volume={line.volume}
                    onClick={line.onClick}
                  >
                    {line.put}
                  </tr>
                  {spotRow(line.spotAfter, putSpan, false)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
