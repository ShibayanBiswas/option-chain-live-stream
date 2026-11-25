"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

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
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </header>
            <div className="sheet-grid">
              <QuoteCard title="Calls" quote={row.ce} tone="call" />
              <QuoteCard title="Puts" quote={row.pe} tone="put" />
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
    ["LTP", formatPrice(quote.lastPrice)],
    ["Chng", formatSigned(quote.change, 2)],
    ["IV", formatPrice(quote.iv)],
    ["OI", formatCompact(quote.oi)],
    ["Chng in OI", formatSigned(quote.oiChg, 0)],
    ["Volume", formatCompact(quote.volume)],
    ["Bid", formatPrice(quote.bid)],
    ["Ask", formatPrice(quote.ask)],
  ] as const;

  const visible = items.filter(([, value]) => value !== "—");
  const rows = visible.length > 0 ? visible : ([["LTP", "—"]] as const);

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
