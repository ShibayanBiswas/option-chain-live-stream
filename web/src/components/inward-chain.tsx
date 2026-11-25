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
    const pane = row.closest(".inward-pane");
    if (!(pane instanceof HTMLElement)) return;
    const top = Math.max(
      0,
      row.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - pane.clientHeight / 2 + row.clientHeight / 2,
    );
    inward.querySelectorAll(".inward-pane").forEach((el) => {
      if (el instanceof HTMLElement) el.scrollTop = top;
    });
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
  const callsRef = useRef<HTMLDivElement>(null);
  const putsRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const bindHost = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    hostRef(node);
  }, [hostRef]);

  useLayoutEffect(() => {
    const calls = callsRef.current;
    const puts = putsRef.current;
    const mid = midRef.current;
    if (!calls || !puts || !mid) return;
    const max = (el: HTMLElement) => Math.max(0, el.scrollWidth - el.clientWidth);
    let writing = false;
    let moved = false;
    const at = { callsX: calls.scrollLeft, callsY: calls.scrollTop, putsX: puts.scrollLeft, putsY: puts.scrollTop, midY: mid.scrollTop };
    const write = (el: HTMLElement, left: number | null, top: number | null) => {
      if (left != null && Math.abs(el.scrollLeft - left) > 0.5) el.scrollLeft = left;
      if (top != null && Math.abs(el.scrollTop - top) > 0.5) el.scrollTop = top;
    };
    const remember = () => {
      at.callsX = calls.scrollLeft;
      at.callsY = calls.scrollTop;
      at.putsX = puts.scrollLeft;
      at.putsY = puts.scrollTop;
      at.midY = mid.scrollTop;
    };
    const park = () => {
      if (moved) return;
      writing = true;
      write(calls, max(calls), null);
      write(puts, 0, null);
      remember();
      writing = false;
    };
    const fromCalls = () => {
      if (writing) return;
      const dx = Math.abs(calls.scrollLeft - at.callsX) > 0.5;
      const dy = Math.abs(calls.scrollTop - at.callsY) > 0.5;
      if (!dx && !dy) return;
      writing = true;
      moved = true;
      if (dx) {
        const cMax = max(calls);
        const pMax = max(puts);
        const revealed = cMax - calls.scrollLeft;
        write(puts, cMax === 0 ? 0 : (revealed / cMax) * pMax, null);
      }
      if (dy) {
        write(puts, null, calls.scrollTop);
        write(mid, null, calls.scrollTop);
      }
      remember();
      writing = false;
    };
    const fromPuts = () => {
      if (writing) return;
      const dx = Math.abs(puts.scrollLeft - at.putsX) > 0.5;
      const dy = Math.abs(puts.scrollTop - at.putsY) > 0.5;
      if (!dx && !dy) return;
      writing = true;
      moved = true;
      if (dx) {
        const cMax = max(calls);
        const pMax = max(puts);
        write(calls, pMax === 0 ? cMax : cMax - (puts.scrollLeft / pMax) * cMax, null);
      }
      if (dy) {
        write(calls, null, puts.scrollTop);
        write(mid, null, puts.scrollTop);
      }
      remember();
      writing = false;
    };
    const fromMid = () => {
      if (writing) return;
      if (Math.abs(mid.scrollTop - at.midY) <= 0.5) return;
      writing = true;
      moved = true;
      write(calls, null, mid.scrollTop);
      write(puts, null, mid.scrollTop);
      remember();
      writing = false;
    };
    calls.addEventListener("scroll", fromCalls, { passive: true });
    puts.addEventListener("scroll", fromPuts, { passive: true });
    mid.addEventListener("scroll", fromMid, { passive: true });
    park();
    const watch = new ResizeObserver(park);
    watch.observe(calls);
    watch.observe(puts);
    const callTable = calls.querySelector("table");
    const putTable = puts.querySelector("table");
    if (callTable) watch.observe(callTable);
    if (putTable) watch.observe(putTable);
    return () => {
      calls.removeEventListener("scroll", fromCalls);
      puts.removeEventListener("scroll", fromPuts);
      mid.removeEventListener("scroll", fromMid);
      watch.disconnect();
    };
  }, [layoutKey]);

  const spotText = rows.find((line) => line.spot)?.spot ?? "";

  useLayoutEffect(() => {
    const host = rootRef.current;
    const mid = midRef.current;
    const label = host?.querySelector<HTMLElement>(".spot-float");
    if (!host || !mid || !label) return;
    const place = () => {
      const row = mid.querySelector(".spot-marker");
      if (!(row instanceof HTMLElement)) {
        label.style.visibility = "hidden";
        return;
      }
      label.style.visibility = "visible";
      label.style.transform = `translateY(${row.getBoundingClientRect().top - host.getBoundingClientRect().top}px)`;
    };
    place();
    mid.addEventListener("scroll", place, { passive: true });
    const watch = new ResizeObserver(place);
    watch.observe(mid);
    return () => {
      mid.removeEventListener("scroll", place);
      watch.disconnect();
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
      <div className="inward-panes">
        <div className="inward-pane calls" ref={callsRef}>
          <table className="chain-table">
            <thead>
              <tr className="column-head">{callHead}</tr>
            </thead>
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
        <div className="inward-pane mid" ref={midRef}>
          <table className="chain-table">
            <thead>
              <tr className="column-head">
                <th className="strike-cell" scope="col">Strike</th>
              </tr>
            </thead>
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
        <div className="inward-pane puts" ref={putsRef}>
          <table className="chain-table">
            <thead>
              <tr className="column-head">{putHead}</tr>
            </thead>
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
