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
    let leader: HTMLElement | null = null;
    let silent = false;
    let moved = false;
    const same = (a: number, b: number) => Math.abs(a - b) <= 1;
    const mirrorX = (source: HTMLElement) => {
      if (source === mid) return;
      const other = source === calls ? puts : calls;
      const sourceMax = max(source);
      const otherMax = max(other);
      const next = source === calls
        ? (sourceMax === 0 ? 0 : ((sourceMax - source.scrollLeft) / sourceMax) * otherMax)
        : (sourceMax === 0 ? otherMax : otherMax - (source.scrollLeft / sourceMax) * otherMax);
      if (!same(other.scrollLeft, next)) other.scrollLeft = next;
    };
    const follow = (source: HTMLElement) => {
      if (silent || (leader && leader !== source)) return;
      leader = source;
      silent = true;
      const top = source.scrollTop;
      for (const pane of [calls, puts, mid]) {
        if (pane !== source && !same(pane.scrollTop, top)) pane.scrollTop = top;
      }
      mirrorX(source);
      silent = false;
      moved = true;
    };
    const park = () => {
      if (moved) return;
      silent = true;
      const callsMax = max(calls);
      if (!same(calls.scrollLeft, callsMax)) calls.scrollLeft = callsMax;
      if (!same(puts.scrollLeft, 0)) puts.scrollLeft = 0;
      silent = false;
    };
    const claim = (event: Event) => {
      const pane = event.currentTarget;
      if (pane instanceof HTMLElement) leader = pane;
    };
    const onCalls = () => follow(calls);
    const onPuts = () => follow(puts);
    const onMid = () => follow(mid);
    calls.addEventListener("scroll", onCalls, { passive: true });
    puts.addEventListener("scroll", onPuts, { passive: true });
    mid.addEventListener("scroll", onMid, { passive: true });
    for (const pane of [calls, puts, mid]) {
      pane.addEventListener("pointerdown", claim);
      pane.addEventListener("wheel", claim, { passive: true });
      pane.addEventListener("touchstart", claim, { passive: true });
    }
    park();
    const watch = new ResizeObserver(park);
    watch.observe(calls);
    watch.observe(puts);
    return () => {
      watch.disconnect();
      calls.removeEventListener("scroll", onCalls);
      puts.removeEventListener("scroll", onPuts);
      mid.removeEventListener("scroll", onMid);
      for (const pane of [calls, puts, mid]) {
        pane.removeEventListener("pointerdown", claim);
        pane.removeEventListener("wheel", claim);
        pane.removeEventListener("touchstart", claim);
      }
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
