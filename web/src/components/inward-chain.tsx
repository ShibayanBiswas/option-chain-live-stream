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

export function centerBook(strike: number | null) {
  if (strike == null) return;
  const row = document.getElementById(`strike-${strike}`);
  if (!(row instanceof HTMLElement)) return;
  const inward = row.closest(".inward");
  if (inward instanceof HTMLElement) {
    const pane = inward.querySelector(".inward-panes");
    if (!(pane instanceof HTMLElement)) return;
    const top = Math.max(
      0,
      row.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - pane.clientHeight / 2 + row.clientHeight / 2,
    );
    pane.scrollTop = top;
    return;
  }
  const scroller = row.closest(".chain-scroll");
  if (!(scroller instanceof HTMLElement)) return;
  const top = row.offsetTop - scroller.clientHeight / 2 + row.clientHeight / 2;
  const cell = row.querySelector(".strike-cell");
  const delta =
    cell instanceof HTMLElement ? cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left : 0;
  const left =
    cell instanceof HTMLElement
      ? scroller.scrollLeft + delta - scroller.clientWidth / 2 + cell.clientWidth / 2
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

  const spotText = rows.find((line) => line.spot)?.spot ?? "";

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
    const label = root.querySelector<HTMLElement>(".spot-float");
    if (!callsHead || !callsBody || !putsHead || !putsBody || !callsPane || !putsPane) return;

    const span = (el: HTMLElement) => Math.max(0, el.offsetWidth - (el.parentElement?.clientWidth ?? 0));
    let callsShift = 0;
    let dragged = false;
    let contentY = 0;
    let paneY = 0;

    const lockColumns = (head: HTMLElement, body: HTMLElement) => {
      const bodyRow = body.querySelector<HTMLElement>("tbody tr:not(.spot-marker)");
      const headRow = head.querySelector<HTMLElement>("thead tr");
      if (!bodyRow || !headRow) return;
      const bodyCells = [...bodyRow.children] as HTMLElement[];
      const headCells = [...headRow.children] as HTMLElement[];
      if (bodyCells.length === 0 || bodyCells.length !== headCells.length) return;
      const widths = bodyCells.map((cell) => cell.getBoundingClientRect().width);
      if (widths.some((width) => width < 2)) return;
      const settled = headCells.every((cell, index) => Math.abs(parseFloat(cell.style.width) - widths[index]) < 0.5);
      if (settled) return;
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

    const park = () => {
      const heads = root.querySelector<HTMLElement>(".inward-heads");
      if (heads) heads.style.paddingRight = `${Math.max(0, scroll.offsetWidth - scroll.clientWidth)}px`;
      lockColumns(callsHead, callsBody);
      lockColumns(putsHead, putsBody);
      if (!dragged) callsShift = -span(callsBody);
      applyX();
    };

    const measureSpot = () => {
      const row = scroll.querySelector<HTMLElement>(".mid .spot-marker");
      if (!row || !label) {
        if (label) label.style.visibility = "hidden";
        return;
      }
      contentY = row.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      paneY = scroll.getBoundingClientRect().top - root.getBoundingClientRect().top;
      label.style.visibility = "visible";
      label.style.transform = `translate3d(0, ${paneY + contentY - scroll.scrollTop}px, 0)`;
    };

    const onScroll = () => {
      if (!label) return;
      label.style.transform = `translate3d(0, ${paneY + contentY - scroll.scrollTop}px, 0)`;
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

    park();
    measureSpot();
    scroll.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("pointerdown", start);
    root.addEventListener("wheel", onWheel, { passive: false });
    let framing = false;
    const watch = new ResizeObserver(() => {
      if (framing) return;
      framing = true;
      park();
      measureSpot();
      requestAnimationFrame(() => {
        framing = false;
      });
    });
    watch.observe(callsPane);
    watch.observe(putsPane);
    return () => {
      watch.disconnect();
      end();
      scroll.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointerdown", start);
      root.removeEventListener("wheel", onWheel);
    };
  }, [layoutKey, spotText]);

  const spotRow = (line: InwardRow, span: number, label: boolean) =>
    line.spot ? (
      <tr className="spot-marker" data-testid={label ? "spot-marker" : undefined}>
        <td colSpan={span}>{label ? <span>{line.spot}</span> : null}</td>
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
      {rows.some((line) => line.spot) ? (
        <div className="spot-float" aria-hidden="true">
          <span>{rows.find((line) => line.spot)?.spot}</span>
        </div>
      ) : null}
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
                  {spotRow(line, callSpan, false)}
                  <tr
                    className={line.className}
                    data-volume={line.volume}
                    onClick={line.onClick}
                  >
                    {line.call}
                  </tr>
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
                  {spotRow(line, 1, true)}
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
                  {spotRow(line, putSpan, false)}
                  <tr
                    className={line.className}
                    data-volume={line.volume}
                    onClick={line.onClick}
                  >
                    {line.put}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
