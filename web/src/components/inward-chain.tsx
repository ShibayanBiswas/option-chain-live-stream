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
  const callsRef = useRef<HTMLDivElement>(null);
  const putsRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const calls = callsRef.current;
    const puts = putsRef.current;
    const mid = midRef.current;
    if (!calls || !puts || !mid) return;
    const max = (el: HTMLElement) => Math.max(0, el.scrollWidth - el.clientWidth);
    let source: "calls" | "puts" | "mid" | null = null;
    let token = 0;
    let moved = false;
    const release = (mine: number) => {
      requestAnimationFrame(() => {
        if (token === mine) source = null;
      });
    };
    const park = () => {
      if (moved) return;
      source = "calls";
      const mine = ++token;
      calls.scrollLeft = max(calls);
      puts.scrollLeft = 0;
      release(mine);
    };
    const fromCalls = () => {
      if (source && source !== "calls") return;
      if (!source) moved = true;
      source = "calls";
      const mine = ++token;
      const cMax = max(calls);
      const pMax = max(puts);
      const revealed = cMax - calls.scrollLeft;
      puts.scrollLeft = cMax === 0 ? 0 : (revealed / cMax) * pMax;
      puts.scrollTop = calls.scrollTop;
      mid.scrollTop = calls.scrollTop;
      release(mine);
    };
    const fromPuts = () => {
      if (source && source !== "puts") return;
      if (!source) moved = true;
      source = "puts";
      const mine = ++token;
      const cMax = max(calls);
      const pMax = max(puts);
      calls.scrollLeft = pMax === 0 ? cMax : cMax - (puts.scrollLeft / pMax) * cMax;
      calls.scrollTop = puts.scrollTop;
      mid.scrollTop = puts.scrollTop;
      release(mine);
    };
    const fromMid = () => {
      if (source && source !== "mid") return;
      source = "mid";
      const mine = ++token;
      calls.scrollTop = mid.scrollTop;
      puts.scrollTop = mid.scrollTop;
      release(mine);
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

  const spotRow = (line: InwardRow, span: number, label: boolean) =>
    line.spot ? (
      <tr className="spot-marker" data-testid={label ? "spot-marker" : undefined}>
        <td colSpan={span}>{label ? <span>{line.spot}</span> : null}</td>
      </tr>
    ) : null;

  return (
    <div
      ref={hostRef}
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
