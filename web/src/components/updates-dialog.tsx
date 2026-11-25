"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const SHADES = [
  { swatch: "high", name: "High volume", detail: "LTP in the top 20% of contracts traded on this chain." },
  { swatch: "low", name: "Low volume", detail: "LTP in the bottom 20% of contracts that actually traded." },
  { swatch: "zero", name: "Zero volume", detail: "No contracts traded. The whole strike is grey." },
  { swatch: "up", name: "Tick up", detail: "LTP or OI just increased. The cell flashes green." },
  { swatch: "down", name: "Tick down", detail: "LTP or OI just decreased. The cell flashes red." },
  { swatch: "itm", name: "ITM", detail: "In the money. Calls below spot, puts above spot." },
] as const;

export function UpdatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <motion.section
            className="updates-card"
            role="dialog"
            aria-label="Volume shades"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>Updates</p>
                <h2>Volume shades</h2>
              </div>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close updates">
                <X className="h-4 w-4" />
              </button>
            </header>
            <ul>
              {SHADES.map((item, index) => (
                <motion.li
                  key={item.name}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * index }}
                >
                  <i className={`shade shade-${item.swatch}`} />
                  <span>
                    <strong>{item.name}</strong>
                    <em>{item.detail}</em>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
