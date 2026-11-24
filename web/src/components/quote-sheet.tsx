"use client";

import { AnimatePresence, motion } from "framer-motion";

import { daysToExpiry } from "@/lib/expiry";
import { formatCompact, formatNumber, formatPrice, formatSigned } from "@/lib/format";
import { deltaFromIv } from "@/lib/greeks";
import type { ChainRow, OptionQuote } from "@/lib/types";

export function QuoteSheet({
  row,
  spot,
  expiry,
  onClose,
}: {
  row: ChainRow | null;
  spot: number | null;
  expiry: string;
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
              <QuoteCard title="Call" quote={row.ce} tone="call" strike={row.strike} spot={spot} expiry={expiry} />
              <QuoteCard title="Put" quote={row.pe} tone="put" strike={row.strike} spot={spot} expiry={expiry} />
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
  strike,
  spot,
  expiry,
}: {
  title: string;
  quote: OptionQuote;
  tone: "call" | "put";
  strike: number;
  spot: number | null;
  expiry: string;
}) {
  const delta = deltaFromIv({
    spot,
    strike,
    ivPercent: quote.iv,
    days: daysToExpiry(expiry),
    type: tone === "call" ? "call" : "put",
  });
  const items = [
    ["Last", formatPrice(quote.lastPrice)],
    ["Change", formatSigned(quote.change, 2)],
    ["IV", formatPrice(quote.iv)],
    ["Delta", delta == null ? "—" : formatNumber(delta, 2)],
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
