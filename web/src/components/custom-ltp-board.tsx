"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { centerBook, chainOverflows, InwardChain, useChainWidth } from "@/components/inward-chain";
import { describeExpiry, focusStrikes, upcomingExpiries } from "@/lib/display";
import { formatNumber, formatPrice } from "@/lib/format";
import { applyLtpPatch, type LtpPatch, type LtpSlice } from "@/lib/ltp-slice";
import { cn } from "@/lib/cn";
import type { ChainRow, Exchange, OptionChainSnapshot, Segment } from "@/lib/types";

export function expiryChoices(available: number): number[] {
  const count = Math.max(1, Math.floor(available) || 1);
  return Array.from({ length: count }, (_, index) => index + 1);
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
  const [extra, setExtra] = useState<Record<string, LtpSlice>>({});
  const wanted = useMemo(
    () => chosen.filter((expiry) => expiry !== primary?.expiry).join(","),
    [chosen, primary?.expiry],
  );

  useEffect(() => {
    if (!symbol || !wanted) return;
    const qs = new URLSearchParams({ symbol, exchange, segment, expiries: wanted });
    const es = new EventSource(`/api/stream/multi?${qs}`);
    const take = (evt: Event, apply: (slice: LtpSlice) => void) => {
      try {
        apply(JSON.parse((evt as MessageEvent).data) as LtpSlice);
      } catch {
        /* the next event replaces a bad frame */
      }
    };
    es.addEventListener("slice", (evt) => {
      take(evt, (slice) => {
        if (!slice.expiry) return;
        setExtra((current) => ({ ...current, [slice.expiry]: slice }));
      });
    });
    es.addEventListener("patch", (evt) => {
      take(evt, (patch) => {
        const update = patch as unknown as LtpPatch;
        setExtra((current) => {
          const slice = current[update.expiry];
          if (!slice) return current;
          return { ...current, [update.expiry]: applyLtpPatch(slice, update) };
        });
      });
    });
    return () => es.close();
  }, [exchange, segment, symbol, wanted]);

  const columns = chosen.map((expiry) => ({
    expiry,
    book: primary?.expiry === expiry ? primary : extra[expiry] ?? null,
  }));
  const loaded = columns.flatMap((column) => (column.book ? [column.book] : []));
  const spot = primary?.spot ?? loaded[0]?.spot ?? null;
  const atm = primary?.totals.atm ?? loaded.find(isChain)?.totals.atm ?? null;
  const callCols = [...columns].reverse();
  const strikes = focusStrikes(
    [...new Set(loaded.flatMap((book) => book.rows.map((row) => row.strike)))].sort((a, b) => a - b),
    spot,
    depth,
    atm,
    segment,
  );
  const span = columns.length * 2 + 1;

  const { ref: hostRef, width } = useChainWidth();
  const pin = chainOverflows(width, columns.length * 2, "custom");

  useEffect(() => {
    centerBook(atm);
  }, [atm, chosen, symbol, pin]);

  if (loaded.length === 0) return <div className="board-wait">Opening the expiries</div>;

  const customRows = strikes.map((strike, index) => {
    const previous = strikes[index - 1];
    const showSpot = spot != null && previous != null && previous < spot && strike > spot;
    const nearest = columns.map((column) => chainRow(column.book, strike)).find((row) => row != null) ?? null;
    return { strike, showSpot, nearest };
  });

  if (pin) {
    return (
      <InwardChain
        hostRef={hostRef}
        density="custom"
        callSpan={callCols.length}
        putSpan={columns.length}
        layoutKey={`${symbol}:${chosen.join(",")}:${strikes.length}`}
        callHead={callCols.map((column) => (
          <th key={`ce-${column.expiry}`} scope="col" className="ce-zone">{shortExpiry(column.expiry)}</th>
        ))}
        putHead={columns.map((column) => (
          <th key={`pe-${column.expiry}`} scope="col" className="pe-zone">{shortExpiry(column.expiry)}</th>
        ))}
        rows={customRows.map(({ strike, showSpot, nearest }) => ({
          key: String(strike),
          id: `strike-${strike}`,
          className: cn("chain-row", strike === atm && "is-atm"),
          onClick: () => {
            if (nearest) onSelect(nearest);
          },
          spot: showSpot ? `Spot ${formatPrice(spot)}` : null,
          strike: formatNumber(strike, 0),
          call: callCols.map((column) => (
            <PriceCell
              key={`ce-${strike}-${column.expiry}`}
              side="ce"
              resetKey={`${symbol}:${column.expiry}`}
              value={quoteOf(column.book, strike, "ce").last}
              itm={spot != null && strike < spot}
              onClick={() => {
                const row = chainRow(column.book, strike);
                if (row) onSelect(row);
              }}
            />
          )),
          put: columns.map((column) => (
            <PriceCell
              key={`pe-${strike}-${column.expiry}`}
              side="pe"
              resetKey={`${symbol}:${column.expiry}`}
              value={quoteOf(column.book, strike, "pe").last}
              itm={spot != null && strike > spot}
              onClick={() => {
                const row = chainRow(column.book, strike);
                if (row) onSelect(row);
              }}
            />
          )),
        }))}
      />
    );
  }

  return (
    <div ref={hostRef} className="chain-scroll" data-density="custom">
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
            const nearest = columns.map((column) => chainRow(column.book, strike)).find((row) => row != null) ?? null;
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
                      value={quoteOf(column.book, strike, "ce").last}
                      itm={spot != null && strike < spot}
                      onClick={() => {
                        const row = chainRow(column.book, strike);
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
                      value={quoteOf(column.book, strike, "pe").last}
                      itm={spot != null && strike > spot}
                      onClick={() => {
                        const row = chainRow(column.book, strike);
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
      <span className="quote-num">{formatPrice(value)}</span>
    </td>
  );
}

function isChain(book: OptionChainSnapshot | LtpSlice): book is OptionChainSnapshot {
  return "totals" in book;
}

function quoteOf(
  book: OptionChainSnapshot | LtpSlice | null,
  strike: number,
  side: "ce" | "pe",
): { last: number | null; change: number | null } {
  const row = book?.rows.find((item) => item.strike === strike);
  if (!row) return { last: null, change: null };
  if ("ce" in row) {
    const quote = side === "ce" ? row.ce : row.pe;
    return { last: quote.lastPrice, change: quote.change };
  }
  return side === "ce" ? { last: row.ceLtp, change: row.ceChg } : { last: row.peLtp, change: row.peChg };
}

function chainRow(book: OptionChainSnapshot | LtpSlice | null, strike: number): ChainRow | null {
  const row = book?.rows.find((item) => item.strike === strike);
  if (!row || !("ce" in row)) return null;
  return row;
}

function shortExpiry(raw: string): string {
  const info = describeExpiry(raw);
  if (!info) return raw;
  return info.label.split(" · ")[0]?.replace(/ \d{4}$/, "") || raw;
}
