"use client";

import { useEffect, useMemo, useState } from "react";

import { describeExpiry, upcomingExpiries } from "@/lib/display";
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
  const atm = primary?.totals.atm ?? loaded[0]?.totals.atm ?? null;
  const allStrikes = [...new Set(loaded.flatMap((book) => book.rows.map((row) => row.strike)))].sort((a, b) => a - b);
  const atmIdx = atm == null ? -1 : allStrikes.findIndex((strike) => strike === atm);
  const strikes =
    depth === "full" || atmIdx < 0
      ? allStrikes
      : allStrikes.slice(Math.max(0, atmIdx - 18), Math.min(allStrikes.length, atmIdx + 19));

  if (loaded.length === 0) return <div className="board-wait">Opening the expiries</div>;

  return (
    <div className="chain-scroll ltp-scroll">
      <table className="ltp-table">
        <thead>
          <tr>
            <th className="strike-cell" scope="col">Strike</th>
            {columns.map((column) => (
              <th key={column.expiry} scope="col">
                <span className="ltp-expiry">{shortExpiry(column.expiry)}</span>
                <span className="ltp-side">Call · Put</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strikes.map((strike) => (
            <tr key={strike} id={`strike-${strike}`} className={cn("chain-row", strike === atm && "is-atm")}>
              <td className="strike-cell">{formatNumber(strike, 0)}</td>
              {columns.map((column) => {
                const row = column.book?.rows.find((item) => item.strike === strike);
                return (
                  <td key={column.expiry} className="ltp-cell">
                    {row ? (
                      <button type="button" className="ltp-pair" onClick={() => onSelect(row)}>
                        <span className="tone-up">{formatPrice(row.ce.lastPrice)}</span>
                        <span className="tone-down">{formatPrice(row.pe.lastPrice)}</span>
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shortExpiry(raw: string): string {
  const info = describeExpiry(raw);
  if (!info) return raw;
  return info.label.split(" · ")[0]?.replace(/ \d{4}$/, "") || raw;
}
