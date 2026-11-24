"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pin, Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { displayName, matchTape } from "@/lib/display";
import { formatPrice, formatSigned } from "@/lib/format";
import type { Instrument, TapeQuote } from "@/lib/types";

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <svg className="spark" viewBox="0 0 64 18" aria-hidden />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 64;
      const y = 16 - ((value - min) / span) * 14;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 64 18" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function InstrumentTree({
  indexes,
  equities,
  selected,
  query,
  onQuery,
  pins,
  history,
  tape,
  onSelect,
  onTogglePin,
}: {
  indexes: Instrument[];
  equities: Instrument[];
  selected: Instrument | null;
  query: string;
  onQuery: (value: string) => void;
  pins: string[];
  history: Record<string, number[]>;
  tape: TapeQuote[];
  onSelect: (item: Instrument) => void;
  onTogglePin: (item: Instrument) => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState({ indices: true, equity: true });
  const q = query.trim().toUpperCase();
  const groups = useMemo(() => {
    const matches = (item: Instrument) => {
      if (!q) return true;
      const name = displayName(item.symbol, item.label).toUpperCase();
      return item.symbol.includes(q) || name.includes(q);
    };
    return [
      {
        id: "indices" as const,
        title: "Indices",
        blocks: [
          { title: "NSE", rows: indexes.filter((item) => item.exchange === "NSE" && matches(item)) },
          { title: "BSE", rows: indexes.filter((item) => item.exchange === "BSE" && matches(item)) },
        ],
      },
      {
        id: "equity" as const,
        title: "Equity",
        blocks: [
          { title: "NSE", rows: equities.filter((item) => item.exchange === "NSE" && matches(item)) },
          { title: "BSE", rows: equities.filter((item) => item.exchange === "BSE" && matches(item)) },
        ],
      },
    ];
  }, [equities, indexes, q]);
  const pinned = [...indexes, ...equities].filter((item) => pins.includes(`${item.exchange}:${item.symbol}`));

  return (
    <div className="tree">
      <label className="search-box">
        <Search className="h-4 w-4" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Find a contract"
          aria-label="Find a contract"
        />
      </label>
      {pinned.length > 0 ? (
        <div className="tree-block">
          <p className="tree-kicker">Pinned</p>
          {pinned.map((item) => (
            <Row
              key={`pin-${item.exchange}-${item.symbol}`}
              item={item}
              selected={selected}
              tape={tape}
              history={history}
              pinned
              onSelect={onSelect}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      ) : null}
      {groups.map((group) => (
        <section key={group.id} className="tree-section">
          <button
            className="tree-section-btn"
            type="button"
            aria-expanded={open[group.id]}
            onClick={() => setOpen((state) => ({ ...state, [group.id]: !state[group.id] }))}
          >
            {group.title}
          </button>
          <AnimatePresence initial={false}>
            {open[group.id] ? (
              <motion.div
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduce ? undefined : { height: 0, opacity: 0 }}
                className="tree-body"
              >
                {group.blocks.map((block) => (
                  <div key={block.title} className="tree-block">
                    <p className="tree-kicker">{block.title}</p>
                    {block.rows.map((item) => (
                      <Row
                        key={`${item.exchange}-${item.symbol}`}
                        item={item}
                        selected={selected}
                        tape={tape}
                        history={history}
                        pinned={pins.includes(`${item.exchange}:${item.symbol}`)}
                        onSelect={onSelect}
                        onTogglePin={onTogglePin}
                      />
                    ))}
                    {block.rows.length === 0 ? <p className="rail-note">None</p> : null}
                  </div>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      ))}
    </div>
  );
}

function Row({
  item,
  selected,
  tape,
  history,
  pinned,
  onSelect,
  onTogglePin,
}: {
  item: Instrument;
  selected: Instrument | null;
  tape: TapeQuote[];
  history: Record<string, number[]>;
  pinned: boolean;
  onSelect: (item: Instrument) => void;
  onTogglePin: (item: Instrument) => void;
}) {
  const quote = matchTape(item.symbol, tape);
  const last = quote?.last ?? item.last ?? null;
  const change = quote?.change ?? item.change ?? null;
  const active = selected?.symbol === item.symbol && selected.exchange === item.exchange;
  const key = `${item.exchange}:${item.symbol}`;
  return (
    <div className={cn("symbol-item", active && "is-active")}>
      <button type="button" className="symbol-main" onClick={() => onSelect(item)}>
        <span>{displayName(item.symbol, item.label)}</span>
        <em className={change != null && change < 0 ? "tone-down" : "tone-up"}>{formatSigned(change, 2)}</em>
        <strong>{formatPrice(last)}</strong>
        <Spark points={history[key] ?? (last != null ? [last] : [])} />
      </button>
      <button
        className={cn("pin-btn", pinned && "is-on")}
        type="button"
        aria-label={pinned ? `Unpin ${item.symbol}` : `Pin ${item.symbol}`}
        onClick={() => onTogglePin(item)}
      >
        <Pin className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
