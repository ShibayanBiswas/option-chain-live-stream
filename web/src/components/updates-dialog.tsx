"use client";

import { useLayoutEffect, useRef } from "react";
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
  view,
  onClose,
}: {
  open: boolean;
  view: "custom" | "chain";
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const card = cardRef.current;
      const button = document.querySelector(".updates-btn");
      if (!card || !(button instanceof HTMLElement)) return;
      const toolbar = button.closest(".toolbar");
      const bar = (toolbar instanceof HTMLElement ? toolbar : button).getBoundingClientRect();
      const btn = button.getBoundingClientRect();
      const narrow = window.innerWidth <= 700;
      const width = narrow ? Math.min(window.innerWidth - 16, 420) : 248;
      let top = bar.bottom + 8;
      let left = narrow ? 8 : btn.right - width;
      if (left < 8) left = 8;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
      const height = card.offsetHeight;
      if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
      card.style.right = "auto";
      card.style.top = `${Math.round(top)}px`;
      card.style.left = `${Math.round(left)}px`;
      card.style.width = `${Math.round(width)}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

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
            ref={cardRef}
            className="updates-card"
            role="dialog"
            aria-label="Updates"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>{view === "custom" ? "Custom updates" : "Chain updates"}</h2>
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
