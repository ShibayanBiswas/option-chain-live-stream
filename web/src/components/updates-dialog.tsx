"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const ROWS = [
  { swatch: "high", name: "High volume" },
  { swatch: "low", name: "Low volume" },
  { swatch: "zero", name: "Zero volume" },
  { swatch: "up", name: "Tick up" },
  { swatch: "down", name: "Tick down" },
] as const;

export function UpdatesDialog({
  open,
  onClose,
}: {
  open: boolean;
  view: "custom" | "chain";
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="updates-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <section
            className="updates-card"
            role="dialog"
            aria-label="Updates"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>Updates</h2>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close updates">
                <X className="h-4 w-4" />
              </button>
            </header>
            <ul>
              {ROWS.map((item) => (
                <li key={item.name}>
                  <i className={`shade shade-${item.swatch}`} />
                  <span>{item.name}</span>
                </li>
              ))}
            </ul>
          </section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
