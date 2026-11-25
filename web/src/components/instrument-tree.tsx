"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pin, Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { displayName, matchTape } from "@/lib/display";
import { formatPrice, formatSigned } from "@/lib/format";
import type { Instrument, TapeQuote } from "@/lib/types";

export function InstrumentTree({
  indexes,
  equities,
  selected,
  query,
  onQuery,
  pins,
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
  const pinned = [...indexes, ...equities].filter((item) => {
    if (item.segment === "INDEX" && item.symbol !== "NIFTY" && item.symbol !== "SENSEX") return false;
    return pins.includes(`${item.exchange}:${item.symbol}`);
  });

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
                {group.blocks.map((block) => {
                  if (block.rows.length === 0) return null;
                  const pin = group.id === "indices" && block.title === "NSE"
                    ? "NIFTY"
                    : group.id === "indices" && block.title === "BSE"
                      ? "SENSEX"
                      : "";
                  const lead = pin ? block.rows.filter((item) => item.symbol === pin) : block.rows;
                  const row = (item: Instrument) => (
                    <Row
                      key={`${item.exchange}-${item.symbol}`}
                      item={item}
                      selected={selected}
                      tape={tape}
                      pinned={pins.includes(`${item.exchange}:${item.symbol}`)}
                      onSelect={onSelect}
                      onTogglePin={onTogglePin}
                    />
                  );
                  return (
                    <div key={block.title} className="tree-block">
                      <p className="tree-kicker">{block.title}</p>
                      {lead.map(row)}
                    </div>
                  );
                })}
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
  pinned,
  onSelect,
  onTogglePin,
}: {
  item: Instrument;
  selected: Instrument | null;
  tape: TapeQuote[];
  pinned: boolean;
  onSelect: (item: Instrument) => void;
  onTogglePin: (item: Instrument) => void;
}) {
  const quote = matchTape(item.symbol, tape, item.exchange);
  const last = quote?.last ?? item.last ?? null;
  const change = quote?.change ?? item.change ?? null;
  const active = selected?.symbol === item.symbol && selected.exchange === item.exchange;
  return (
    <div className={cn("symbol-item", active && "is-active")}>
      <button type="button" className="symbol-main" onClick={() => onSelect(item)}>
        <span>{displayName(item.symbol, item.label)}</span>
        <em className={change != null && change < 0 ? "tone-down" : "tone-up"}>{formatSigned(change, 1)}</em>
        <strong>{formatPrice(last)}</strong>
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
