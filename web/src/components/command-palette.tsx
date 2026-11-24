"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { isAnandRathiSymbol } from "@/lib/equity";
import type { QuoteTick } from "@/lib/quotes";
import type { Instrument } from "@/lib/types";

import { instrumentKey } from "./instrument-tree";

export function CommandPalette({
  open,
  indexes,
  equities,
  quotes,
  onClose,
  onSelect,
}: {
  open: boolean;
  indexes: Instrument[];
  equities: Instrument[];
  quotes: QuoteTick[];
  onClose: () => void;
  onSelect: (item: Instrument) => void;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const items = useMemo(() => {
    const q = query.trim().toUpperCase();
    return [...indexes, ...equities].filter((item) => {
      if (item.segment === "EQUITY" && !isAnandRathiSymbol(item.symbol)) return false;
      if (!q) return true;
      const quote = quotes.find((row) => row.symbol === item.symbol && row.exchange === item.exchange);
      return item.symbol.includes(q) || (quote?.name.toUpperCase().includes(q) ?? false);
    });
  }, [equities, indexes, query, quotes]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="palette-backdrop"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="palette"
            role="dialog"
            aria-label="Instrument search"
            data-testid="command-palette"
            initial={reduce ? false : { y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 8, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              placeholder="Search indices and Anand Rathi Wealth"
              aria-label="Filter instruments"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((value) => Math.min(items.length - 1, value + 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((value) => Math.max(0, value - 1));
                }
                if (event.key === "Enter" && items[cursor]) {
                  onSelect(items[cursor]!);
                  onClose();
                }
              }}
            />
            <ul>
              {items.map((item, index) => {
                const quote = quotes.find((row) => row.symbol === item.symbol && row.exchange === item.exchange);
                return (
                  <li key={instrumentKey(item)}>
                    <button
                      type="button"
                      className={index === cursor ? "is-active" : undefined}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                    >
                      <span>{item.segment === "INDEX" ? "Indices" : "Equity"}</span>
                      <strong>{item.symbol}</strong>
                      <em>{quote?.name ?? item.exchange}</em>
                      <em>{item.exchange}</em>
                    </button>
                  </li>
                );
              })}
              {items.length === 0 ? <li className="rail-note">No contracts in this view</li> : null}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
