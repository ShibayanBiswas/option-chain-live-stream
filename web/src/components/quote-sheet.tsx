"use client";

import { AnimatePresence, motion } from "framer-motion";

import { formatCompact, formatNumber, formatPrice, formatSigned } from "@/lib/format";
import type { ChainRow, OptionQuote } from "@/lib/types";

export function QuoteSheet({
  row,
  onClose,
}: {
  row: ChainRow | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {row ? (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="quote-sheet"
            role="dialog"
            aria-label={`Strike ${row.strike}`}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sheet-head">
              <div>
                <p className="eyebrow">Strike</p>
                <h2>{formatNumber(row.strike, 0)}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={onClose}>
                Close
              </button>
            </header>
            <div className="sheet-grid">
              <QuoteCard title="Call" quote={row.ce} tone="call" />
              <QuoteCard title="Put" quote={row.pe} tone="put" />
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function QuoteCard({
  title,
  quote,
  tone,
}: {
  title: string;
  quote: OptionQuote;
  tone: "call" | "put";
}) {
  const items = [
    ["Last", formatPrice(quote.lastPrice)],
    ["Change", formatSigned(quote.change, 2)],
    ["IV", formatPrice(quote.iv)],
    ["Open Interest", formatCompact(quote.oi)],
    ["Interest Change", formatSigned(quote.oiChg, 0)],
    ["Volume", formatCompact(quote.volume)],
    ["Bid", formatPrice(quote.bid)],
    ["Ask", formatPrice(quote.ask)],
  ] as const;

  const visible = items.filter(([, value]) => value !== "—");
  const rows = visible.length > 0 ? visible : ([["Last", "—"]] as const);

  return (
    <section className={`quote-card ${tone}`}>
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
