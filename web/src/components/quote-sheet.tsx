"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { daysToExpiry } from "@/lib/expiry";
import { formatCompact, formatNumber, formatPrice, formatSigned } from "@/lib/format";
import { blackScholes, deltaFromIv } from "@/lib/greeks";
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
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 28, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
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
  const days = daysToExpiry(expiry);
  const kind = tone === "call" ? "call" : "put";
  const delta = deltaFromIv({ spot, strike, ivPercent: quote.iv, days, type: kind });
  const theta = blackScholes({
    spot: spot ?? 0,
    strike,
    rate: 0.065,
    sigma: (quote.iv ?? 0) / 100,
    timeYears: (days ?? 0) / 365,
    type: kind,
  })?.theta;
  const items = [
    ["LTP", formatPrice(quote.lastPrice)],
    ["Chng", formatSigned(quote.change, 2)],
    ["% Chng", formatNumber(quote.pChange, 2)],
    ["IV", formatPrice(quote.iv)],
    ["OI", formatCompact(quote.oi)],
    ["Chng in OI", formatSigned(quote.oiChg, 0)],
    ["Volume", formatCompact(quote.volume)],
    ["Bid Qty", formatNumber(quote.bidQty, 0)],
    ["Bid", formatPrice(quote.bid)],
    ["Ask", formatPrice(quote.ask)],
    ["Ask Qty", formatNumber(quote.askQty, 0)],
    ["Delta", formatNumber(delta, 2)],
    ["Theta", formatNumber(theta ?? null, 2)],
  ] as const;

  return (
    <section className={`quote-card ${tone}`}>
      <h3>{title}</h3>
      <p className="quote-ltp">{formatPrice(quote.lastPrice)}</p>
      <dl>
        {items.map(([label, value], index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * index }}
          >
            <dt>{label}</dt>
            <dd>{value}</dd>
          </motion.div>
        ))}
      </dl>
    </section>
  );
}
