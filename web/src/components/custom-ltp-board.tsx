"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { describeExpiry, focusStrikes, upcomingExpiries } from "@/lib/display";
import { formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ChainRow, Exchange, OptionChainSnapshot, Segment } from "@/lib/types";

const COUNTS = [2, 3, 4, 5, 6, 8];

export function expiryChoices(available: number): number[] {
  const choices = COUNTS.filter((count) => count <= available);
  return choices.length > 0 ? choices : [Math.max(1, available)];
}

export function CustomLtpBoard({
  symbol,
  exchange,
  segment,
  expiries,
  count,
  depth,
  primary,
  onSelect,
}: {
  symbol: string;
  exchange: Exchange;
  segment: Segment;
  expiries: string[];
  count: number;
  depth: "near" | "full";
  primary: OptionChainSnapshot | null;
  onSelect: (row: ChainRow) => void;
}) {
  const chosen = useMemo(() => upcomingExpiries(expiries, count), [count, expiries]);
  const [extra, setExtra] = useState<Record<string, OptionChainSnapshot>>({});

  useEffect(() => {
    if (!symbol || chosen.length === 0) return;
    let stop = false;
    const pull = async () => {
      await Promise.all(
        chosen.map(async (expiry) => {
          try {
            const qs = new URLSearchParams({ symbol, exchange, segment, expiry });
            const res = await fetch(`/api/chain?${qs}`, { cache: "no-store" });
            if (!res.ok || stop) return;
            const data = (await res.json()) as OptionChainSnapshot;
            if (stop || !data.expiry) return;
            setExtra((current) => ({ ...current, [data.expiry]: data }));
          } catch {
            /* the next pass retries this expiry */
          }
        }),
      );
    };
    pull().catch(() => undefined);
    const timer = window.setInterval(() => {
      pull().catch(() => undefined);
    }, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [chosen, exchange, segment, symbol]);

  const columns = chosen.map((expiry) => ({
    expiry,
    book: primary?.expiry === expiry ? primary : extra[expiry] ?? null,
  }));
  const loaded = columns.flatMap((column) => (column.book ? [column.book] : []));
  const spot = primary?.spot ?? loaded[0]?.spot ?? null;
  const atm = primary?.totals.atm ?? loaded[0]?.totals.atm ?? null;
  const callCols = [...columns].reverse();
  const strikes = focusStrikes(
    [...new Set(loaded.flatMap((book) => book.rows.map((row) => row.strike)))].sort((a, b) => a - b),
    spot,
    depth,
  );
  const span = columns.length * 2 + 1;

  useEffect(() => {
    const row = document.getElementById(`strike-${atm ?? ""}`);
    const scroller = row?.closest(".chain-scroll");
    if (!row || !(scroller instanceof HTMLElement)) return;
    const top = row.offsetTop - scroller.clientHeight / 2 + row.clientHeight / 2;
    const cell = row.querySelector(".strike-cell");
    const delta =
      cell instanceof HTMLElement ? cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left : 0;
    const left =
      cell instanceof HTMLElement
        ? scroller.scrollLeft + delta - scroller.clientWidth / 2 + cell.clientWidth / 2
        : scroller.scrollLeft;
    scroller.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: "auto" });
  }, [atm, chosen, symbol]);

  if (loaded.length === 0) return <div className="board-wait">Opening the expiries</div>;

  return (
    <div className="chain-scroll" data-density="custom">
      <table className="chain-table">
        <thead>
          <tr className="side-labels">
            <th className="ce-zone" colSpan={columns.length} scope="colgroup">Calls</th>
            <th className="strike-cell" scope="col" />
            <th className="pe-zone" colSpan={columns.length} scope="colgroup">Puts</th>
          </tr>
          <tr className="column-head">
            {callCols.map((column) => (
              <th key={`ce-${column.expiry}`} scope="col" className="ce-zone">{shortExpiry(column.expiry)}</th>
            ))}
            <th className="strike-cell" scope="col">Strike</th>
            {columns.map((column) => (
              <th key={`pe-${column.expiry}`} scope="col" className="pe-zone">{shortExpiry(column.expiry)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strikes.map((strike, index) => {
            const previous = strikes[index - 1];
            const showSpot = spot != null && previous != null && previous < spot && strike > spot;
            const nearest = columns.find((column) => column.book?.rows.some((row) => row.strike === strike))?.book?.rows.find((row) => row.strike === strike) ?? null;
            return (
              <Fragment key={strike}>
                {showSpot ? (
                  <tr className="spot-marker" data-testid="spot-marker">
                    <td colSpan={span}>
                      <span>Spot {formatPrice(spot)}</span>
                    </td>
                  </tr>
                ) : null}
                <tr
                  id={`strike-${strike}`}
                  className={cn("chain-row", strike === atm && "is-atm")}
                  onClick={() => {
                    if (nearest) onSelect(nearest);
                  }}
                >
                  {callCols.map((column) => (
                    <PriceCell
                      key={`ce-${strike}-${column.expiry}`}
                      side="ce"
                      resetKey={`${symbol}:${column.expiry}`}
                      value={column.book?.rows.find((row) => row.strike === strike)?.ce.lastPrice ?? null}
                      itm={spot != null && strike < spot}
                      onClick={() => {
                        const row = column.book?.rows.find((item) => item.strike === strike);
                        if (row) onSelect(row);
                      }}
                    />
                  ))}
                  <td className="strike-cell">{formatNumber(strike, 0)}</td>
                  {columns.map((column) => (
                    <PriceCell
                      key={`pe-${strike}-${column.expiry}`}
                      side="pe"
                      resetKey={`${symbol}:${column.expiry}`}
                      value={column.book?.rows.find((row) => row.strike === strike)?.pe.lastPrice ?? null}
                      itm={spot != null && strike > spot}
                      onClick={() => {
                        const row = column.book?.rows.find((item) => item.strike === strike);
                        if (row) onSelect(row);
                      }}
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

function PriceCell({
  side,
  value,
  resetKey,
  itm,
  onClick,
}: {
  side: "ce" | "pe";
  value: number | null;
  resetKey: string;
  itm: boolean;
  onClick: () => void;
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
    <td
      ref={ref}
      className={cn(side === "ce" ? "ce-zone" : "pe-zone", itm && "is-itm")}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {formatPrice(value)}
    </td>
  );
}

function shortExpiry(raw: string): string {
  const info = describeExpiry(raw);
  if (!info) return raw;
  return info.label.split(" · ")[0]?.replace(/ \d{4}$/, "") || raw;
}
