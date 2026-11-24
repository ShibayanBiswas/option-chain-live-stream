"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Gauge,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { OptionChainTable } from "@/components/option-chain-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOptionStream } from "@/hooks/use-option-stream";
import { cn } from "@/lib/cn";
import {
  formatCompact,
  formatNumber,
  formatPct,
  formatPrice,
} from "@/lib/format";
import { BSE_INDEXES, EQUITIES, NSE_INDEXES } from "@/lib/symbols";
import type { Instrument, MetaResponse } from "@/lib/types";

export function LiveDesk() {
  const reduce = useReducedMotion();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [instrument, setInstrument] = useState<Instrument>(NSE_INDEXES[0]!);
  const [expiry, setExpiry] = useState("");
  const [equityQuery, setEquityQuery] = useState("");
  const [strikeFilter, setStrikeFilter] = useState<"atm" | "all">("atm");

  const { snapshot, status, error, updatedAt, refresh } = useOptionStream({
    symbol: instrument.symbol,
    expiry,
    exchange: instrument.exchange,
  });

  useEffect(() => {
    fetch("/api/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: MetaResponse) => setMeta(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!snapshot?.expiries?.length) return;
    if (!expiry || !snapshot.expiries.includes(expiry)) {
      setExpiry(snapshot.expiries[0]!);
    }
  }, [expiry, snapshot?.expiries]);

  const equities = useMemo(() => {
    const q = equityQuery.trim().toUpperCase();
    const list = meta?.equities?.length ? meta.equities : EQUITIES;
    if (!q) return list.slice(0, 12);
    return list.filter((e) => e.symbol.includes(q)).slice(0, 12);
  }, [equityQuery, meta]);

  const liveLabel =
    status === "live" ? "LIVE" : status === "polling" ? "POLL" : status === "connecting" ? "SYNC" : status === "error" ? "ERR" : "IDLE";

  return (
    <div className="bg-mesh min-h-screen">
      <header className="desk-glass sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo />
            <div className="hidden min-w-0 sm:block">
              <p className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted">
                Anand Rathi Wealth
              </p>
              <h1 className="truncate text-lg font-semibold text-ink md:text-xl">
                Option Chain Live Stream
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-ui hidden items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs md:flex">
              <span
                className={cn(
                  "live-dot",
                  status === "live" || status === "polling"
                    ? ""
                    : status === "error"
                      ? "is-off"
                      : "is-stale",
                )}
              />
              <span className="font-semibold tracking-wide text-ink">{liveLabel}</span>
              <span className="text-muted">
                {snapshot?.latencyMs != null ? `${snapshot.latencyMs} ms` : "—"}
              </span>
            </div>
            <motion.button
              className="font-ui inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs text-ink hover:border-gold"
              onClick={() => refresh().catch(() => undefined)}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.96 }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </motion.button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
        <motion.section
          className="desk-panel p-4 md:p-5"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted">
                Underlying
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold text-ink md:text-3xl">
                  {instrument.label}
                </span>
                <span className="font-ui rounded-full bg-maroon/10 px-2 py-0.5 text-[11px] font-semibold text-maroon">
                  {instrument.exchange}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-muted">
                Spot
              </p>
              <p className="font-data text-2xl font-semibold text-gold-dark md:text-3xl">
                {formatPrice(snapshot?.spot ?? null)}
              </p>
              <p className="font-ui text-[11px] text-muted">
                {snapshot?.timestamp || meta?.market.message || "Awaiting feed"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...NSE_INDEXES, ...BSE_INDEXES].map((item) => {
              const active = instrument.symbol === item.symbol;
              return (
                <motion.button
                  key={item.symbol}
                  className={cn(
                    "font-ui shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-gold bg-gold/15 font-semibold text-ink shadow-sm"
                      : "border-border bg-panel text-muted hover:border-gold/60 hover:text-ink",
                  )}
                  onClick={() => {
                    setInstrument(item);
                    setExpiry("");
                  }}
                  type="button"
                  whileHover={reduce ? undefined : { y: -1 }}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                >
                  {item.symbol}
                </motion.button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="font-ui w-full rounded-xl border border-border bg-panel py-2.5 pl-10 pr-3 text-sm outline-none ring-gold/30 focus:ring-2"
                onChange={(e) => setEquityQuery(e.target.value)}
                placeholder="Search equity F&O — RELIANCE, TCS, HDFCBANK…"
                value={equityQuery}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {equities.map((eq) => (
                <button
                  key={eq.symbol}
                  className={cn(
                    "font-ui shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px]",
                    instrument.symbol === eq.symbol
                      ? "border-maroon bg-maroon/10 text-maroon"
                      : "border-border text-muted hover:text-ink",
                  )}
                  onClick={() => {
                    setInstrument(eq);
                    setExpiry("");
                    setEquityQuery(eq.symbol);
                  }}
                  type="button"
                >
                  {eq.symbol}
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi
            icon={Activity}
            label="PCR (OI)"
            value={snapshot?.totals.pcr != null ? snapshot.totals.pcr.toFixed(2) : "—"}
          />
          <Kpi
            icon={Gauge}
            label="Max Pain"
            value={formatNumber(snapshot?.totals.maxPain ?? null, 0)}
          />
          <Kpi
            icon={Zap}
            label="Call OI"
            value={formatCompact(snapshot?.totals.ceOi ?? null)}
          />
          <Kpi
            icon={Sparkles}
            label="Put OI"
            value={formatCompact(snapshot?.totals.peOi ?? null)}
          />
          <Kpi
            icon={Radio}
            label="ATM"
            value={formatNumber(snapshot?.totals.atm ?? null, 0)}
          />
        </section>

        <section className="desk-panel p-3 md:p-4">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {(snapshot?.expiries ?? []).map((ex) => (
                <button
                  key={ex}
                  className={cn(
                    "font-ui shrink-0 rounded-full border px-3 py-1.5 text-xs",
                    expiry === ex
                      ? "border-gold bg-gold/20 font-semibold text-ink"
                      : "border-border text-muted hover:text-ink",
                  )}
                  onClick={() => setExpiry(ex)}
                  type="button"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="font-ui flex items-center gap-2 text-xs text-muted">
              <button
                className={cn(
                  "rounded-full border px-3 py-1",
                  strikeFilter === "atm" ? "border-gold text-ink" : "border-border",
                )}
                onClick={() => setStrikeFilter("atm")}
                type="button"
              >
                ATM ±25
              </button>
              <button
                className={cn(
                  "rounded-full border px-3 py-1",
                  strikeFilter === "all" ? "border-gold text-ink" : "border-border",
                )}
                onClick={() => setStrikeFilter("all")}
                type="button"
              >
                All strikes
              </button>
              <span>
                {updatedAt
                  ? `Updated ${new Date(updatedAt).toLocaleTimeString("en-IN")}`
                  : "Waiting…"}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="err"
                className="mb-3 rounded-xl border border-orange-300/50 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-100"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {!snapshot ? (
            <div className="font-ui flex h-64 items-center justify-center text-muted">
              Connecting to exchange feed…
            </div>
          ) : (
            <OptionChainTable snapshot={snapshot} mode={strikeFilter} />
          )}

          <p className="font-ui mt-3 text-[11px] text-muted">
            Empty quote columns (Bid / Ask / Bid Qty / Ask Qty / Chng) auto-hide when the
            session has no values — typical after market close. Live ticks flash green/red.
            Market: {meta?.market.status ?? "—"} · {meta?.market.tradeDate ?? ""}
            {meta?.market.niftyLast != null
              ? ` · Nifty ${formatNumber(meta.market.niftyLast, 2)} (${formatPct(null)})`
              : ""}
          </p>
        </section>
      </main>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="desk-panel flex items-center gap-3 p-3"
      whileHover={reduce ? undefined : { y: -2 }}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="font-data text-lg font-semibold text-ink">{value}</p>
      </div>
    </motion.div>
  );
}
