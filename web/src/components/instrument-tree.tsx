"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pin, Search } from "lucide-react";

import { isAnandRathiSymbol } from "@/lib/equity";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { QuoteTick } from "@/lib/quotes";
import type { Exchange, Instrument } from "@/lib/types";

export function instrumentKey(item: Pick<Instrument, "exchange" | "symbol">): string {
  return `${item.exchange}:${item.symbol}`;
}

export function InstrumentTree({
  indexes,
  equities,
  quotes,
  selected,
  pins,
  query,
  onQuery,
  onTogglePin,
  onSelect,
}: {
  indexes: Instrument[];
  equities: Instrument[];
  quotes: QuoteTick[];
  selected: Instrument | null;
  pins: string[];
  query: string;
  onQuery: (value: string) => void;
  onTogglePin: (key: string) => void;
  onSelect: (item: Instrument) => void;
}) {
  const quoteFor = (item: Instrument) =>
    quotes.find((quote) => quote.symbol === item.symbol && quote.exchange === item.exchange);

  const q = query.trim().toUpperCase();
  const match = (item: Instrument) => {
    if (!q) return true;
    const quote = quoteFor(item);
    return item.symbol.toUpperCase().includes(q) || (quote?.name.toUpperCase().includes(q) ?? false);
  };

  const pinned = [...indexes, ...equities].filter((item) => pins.includes(instrumentKey(item)) && match(item));

  return (
    <div className="tree" data-testid="instrument-tree">
      <label className="search-box">
        <Search className="h-4 w-4" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Find an instrument"
          aria-label="Find an instrument"
        />
      </label>
      <div
        className="symbol-list"
        role="tree"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".symbol-item")];
          const index = buttons.findIndex((button) => button === document.activeElement);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            buttons[Math.min(buttons.length - 1, index + 1)]?.focus();
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            buttons[Math.max(0, index < 0 ? 0 : index - 1)]?.focus();
          }
        }}
      >
        {pinned.length > 0 ? (
          <Section title="Pinned" defaultOpen>
            {pinned.map((item) => (
              <SymbolRow
                key={`pin-${instrumentKey(item)}`}
                item={item}
                quote={quoteFor(item)}
                active={selected?.symbol === item.symbol && selected.exchange === item.exchange}
                pinned
                onTogglePin={onTogglePin}
                onSelect={onSelect}
              />
            ))}
          </Section>
        ) : null}
        <Section title="Indices" defaultOpen>
          <ExchangeGroup title="NSE" items={indexes.filter((item) => item.exchange === "NSE" && match(item))} quoteFor={quoteFor} selected={selected} pins={pins} onTogglePin={onTogglePin} onSelect={onSelect} />
          <ExchangeGroup title="BSE" items={indexes.filter((item) => item.exchange === "BSE" && match(item))} quoteFor={quoteFor} selected={selected} pins={pins} onTogglePin={onTogglePin} onSelect={onSelect} />
        </Section>
        <Section title="Equity" defaultOpen>
          <ExchangeGroup title="NSE" items={equities.filter((item) => item.exchange === "NSE" && match(item) && isAnandRathiSymbol(item.symbol))} quoteFor={quoteFor} selected={selected} pins={pins} onTogglePin={onTogglePin} onSelect={onSelect} />
          <ExchangeGroup title="BSE" items={equities.filter((item) => item.exchange === "BSE" && match(item) && isAnandRathiSymbol(item.symbol))} quoteFor={quoteFor} selected={selected} pins={pins} onTogglePin={onTogglePin} onSelect={onSelect} />
        </Section>
        {indexes.length === 0 && equities.length === 0 ? <p className="rail-note">Loading contracts</p> : null}
      </div>
    </div>
  );
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const reduce = useReducedMotion();
  return (
    <div className="tree-section">
      <button className="tree-section-btn" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {title}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="tree-section-body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ExchangeGroup({
  title,
  items,
  quoteFor,
  selected,
  pins,
  onTogglePin,
  onSelect,
}: {
  title: Exchange;
  items: Instrument[];
  quoteFor: (item: Instrument) => QuoteTick | undefined;
  selected: Instrument | null;
  pins: string[];
  onTogglePin: (key: string) => void;
  onSelect: (item: Instrument) => void;
}) {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();
  return (
    <div className="tree-exchange">
      <button className="tree-exchange-btn" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {title}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }}>
            {items.length === 0 ? <p className="rail-note">No contracts in this view</p> : null}
            {items.map((item) => (
              <SymbolRow
                key={instrumentKey(item)}
                item={item}
                quote={quoteFor(item)}
                active={selected?.symbol === item.symbol && selected.exchange === item.exchange}
                pinned={pins.includes(instrumentKey(item))}
                onTogglePin={onTogglePin}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SymbolRow({
  item,
  quote,
  active,
  pinned,
  onTogglePin,
  onSelect,
}: {
  item: Instrument;
  quote?: QuoteTick;
  active: boolean;
  pinned: boolean;
  onTogglePin: (key: string) => void;
  onSelect: (item: Instrument) => void;
}) {
  const name = quote?.name && quote.name !== item.symbol ? quote.name : isAnandRathiSymbol(item.symbol) ? "Anand Rathi Wealth" : item.symbol;
  const up = (quote?.change ?? 0) > 0;
  const down = (quote?.change ?? 0) < 0;
  return (
    <div className={cn("symbol-row", active && "is-active")}>
      <button
        type="button"
        className="symbol-item"
        aria-label={`${item.symbol} ${item.exchange}`}
        onClick={() => onSelect(item)}
      >
        <span className="symbol-copy">
          <strong>{item.symbol}</strong>
          <em>{name === item.symbol ? item.exchange : name}</em>
        </span>
        <span className={cn("symbol-quote", up && "tone-up", down && "tone-down")}>
          <b>{quote?.spot != null ? formatNumber(quote.spot, quote.spot >= 1000 ? 2 : 2) : "—"}</b>
          <small>{quote?.change != null && quote.change !== 0 ? formatNumber(quote.change, 2) : ""}</small>
        </span>
        <Spark points={quote?.spark ?? []} up={!down} />
      </button>
      <button
        className={cn("pin-btn", pinned && "is-on")}
        type="button"
        aria-label={pinned ? `Unpin ${item.symbol}` : `Pin ${item.symbol}`}
        aria-pressed={pinned}
        onClick={() => onTogglePin(instrumentKey(item))}
      >
        <Pin className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Spark({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return <span className="spark spark-empty" aria-hidden />;
  const width = 56;
  const height = 18;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const poly = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((point - min) / (max - min)) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={cn("spark", up ? "up" : "down")} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={poly} />
    </svg>
  );
}
