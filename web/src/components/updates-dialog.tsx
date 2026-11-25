"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const CUSTOM = [
  { swatch: "price", name: "Last price", detail: "Each cell is the last price, shown to two decimals." },
  { swatch: "change", name: "Change", detail: "The figure under the price is today's change. Green is up, red is down." },
  { swatch: "expiry", name: "Expiries", detail: "Calls sit on the left, far date to near. Puts sit on the right, near date to far. The nearest expiry is against the strike." },
  { swatch: "atm", name: "At the money", detail: "The strike nearest the live price is outlined in gold. A spot line sits between the two surrounding strikes." },
  { swatch: "quote", name: "Quote", detail: "Click a price to open Calls and Puts for that strike." },
] as const;

const SHADES = [
  { swatch: "high", name: "High volume", detail: "LTP in the top 20% of contracts traded on this chain." },
  { swatch: "low", name: "Low volume", detail: "LTP in the bottom 20% of contracts that actually traded." },
  { swatch: "zero", name: "Zero volume", detail: "No contracts traded. The whole strike is grey." },
  { swatch: "up", name: "Tick up", detail: "LTP or OI just increased. The cell flashes green." },
  { swatch: "down", name: "Tick down", detail: "LTP or OI just decreased. The cell flashes red." },
  { swatch: "itm", name: "ITM", detail: "In the money. Calls below spot, puts above spot." },
] as const;

export function UpdatesDialog({
  open,
  view,
  onClose,
}: {
  open: boolean;
  view: "custom" | "chain";
  onClose: () => void;
}) {
  const custom = view === "custom";
  const items = custom ? CUSTOM : SHADES;
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
            aria-label={custom ? "Custom board" : "Volume shades"}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>{custom ? "Custom" : "Option chain"}</p>
                <h2>{custom ? "Reading the board" : "Volume shades"}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close updates">
                <X className="h-4 w-4" />
              </button>
            </header>
            <ul>
              {items.map((item, index) => (
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
