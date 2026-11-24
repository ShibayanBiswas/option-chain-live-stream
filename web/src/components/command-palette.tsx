"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { displayName } from "@/lib/display";
import type { Instrument } from "@/lib/types";

export function CommandPalette({
  open,
  instruments,
  onClose,
  onSelect,
}: {
  open: boolean;
  instruments: Instrument[];
  onClose: () => void;
  onSelect: (item: Instrument) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    return instruments
      .filter((item) => {
        if (!q) return true;
        return (
          item.symbol.includes(q) ||
          displayName(item.symbol, item.label).toUpperCase().includes(q) ||
          item.exchange.includes(q)
        );
      })
      .slice(0, 12);
  }, [instruments, query]);

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
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="palette"
            role="dialog"
            aria-label="Contract search"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              placeholder="Search indices and equity"
              aria-label="Search indices and equity"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((value) => Math.min(results.length - 1, value + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((value) => Math.max(0, value - 1));
                } else if (event.key === "Enter" && results[cursor]) {
                  onSelect(results[cursor]!);
                  onClose();
                } else if (event.key === "Escape") {
                  onClose();
                }
              }}
            />
            <ul>
              {results.map((item, index) => (
                <li key={`${item.exchange}-${item.symbol}`}>
                  <button
                    type="button"
                    className={index === cursor ? "is-active" : undefined}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <span>{displayName(item.symbol, item.label)}</span>
                    <em>
                      {item.segment === "INDEX" ? "Index" : "Equity"} · {item.exchange}
                    </em>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
