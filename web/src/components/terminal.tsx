"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Columns2, Maximize2, Minimize2, Moon, PanelLeft, RefreshCw, Search, Sun } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { OpenInterestChart } from "@/components/oi-chart";
import { OptionChainTable } from "@/components/option-chain-table";
import { QuoteSheet } from "@/components/quote-sheet";
import { useOptionStream } from "@/hooks/use-option-stream";
import { cn } from "@/lib/cn";
import { formatCompact, formatNumber, formatPrice } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import type { ChainRow, Instrument } from "@/lib/types";

type Book = {
  indexes: Instrument[];
  equities: Instrument[];
  market: {
    status: string;
    tradeDate: string;
    open: boolean;
    phase?: string;
    message: string;
  } | null;
};

export function Terminal() {
  const reduce = useReducedMotion();
  const { theme, toggle, mounted } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [segment, setSegment] = useState<"INDEX" | "EQUITY">("INDEX");
  const [exchange, setExchange] = useState<"ALL" | "NSE" | "BSE">("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [expiry, setExpiry] = useState("");
  const [depth, setDepth] = useState<"near" | "full">("near");
  const [density, setDensity] = useState<"focus" | "full">("focus");
  const [railOpen, setRailOpen] = useState(true);
  const [railBeforeMagnify, setRailBeforeMagnify] = useState(true);
  const [magnify, setMagnify] = useState(false);
  const [picked, setPicked] = useState<ChainRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/universe", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Universe unavailable");
        return data as Book;
      })
      .then((data) => {
        if (cancelled) return;
        setBook(data);
        setSelected((current) => current ?? data.indexes[0] ?? data.equities[0] ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Universe unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { snapshot, status, error, updatedAt, socketState, refresh } = useOptionStream({
    symbol: selected?.symbol ?? "",
    expiry,
    exchange: selected?.exchange ?? "NSE",
    segment: selected?.segment ?? "INDEX",
    enabled: Boolean(selected),
  });

  useEffect(() => {
    if (!snapshot?.expiries?.length) return;
    if (!expiry || !snapshot.expiries.includes(expiry)) setExpiry(snapshot.expiries[0]!);
  }, [expiry, snapshot?.expiries]);

  const list = useMemo(() => {
    const source = segment === "INDEX" ? book?.indexes ?? [] : book?.equities ?? [];
    const q = query.trim().toUpperCase();
    return source.filter((item) => {
      if (exchange !== "ALL" && item.exchange !== exchange) return false;
      if (!q) return true;
      return item.symbol.includes(q) || item.label.toUpperCase().includes(q);
    });
  }, [book, exchange, query, segment]);

  const session = book?.market?.message ?? (book?.market ? "Market Closed" : "Session");
  const feed =
    socketState === "open" || snapshot?.feed === "websocket"
      ? "WebSocket"
      : status === "live"
        ? "Live"
        : status === "connecting"
          ? "Connecting"
          : "Rest";

  return (
    <div className={cn("terminal bg-mesh", magnify && "is-magnified", !railOpen && "rail-hidden")}>
      <button
        className="rail-fab icon-btn"
        type="button"
        onClick={() => setRailOpen((open) => !open)}
        aria-label={railOpen ? "Collapse sidebar" : "Expand sidebar"}
        aria-pressed={railOpen}
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <aside className={cn("rail", !railOpen && "is-collapsed")} aria-hidden={!railOpen}>
        <div className="rail-brand">
          <BrandLogo compact />
        </div>
        <div className="segmented">
          {(["INDEX", "EQUITY"] as const).map((item) => (
            <button
              key={item}
              className={cn(segment === item && "is-on")}
              type="button"
              onClick={() => {
                setSegment(item);
                setQuery("");
                const next =
                  item === "INDEX"
                    ? book?.indexes.find((row) => exchange === "ALL" || row.exchange === exchange)
                    : book?.equities.find((row) => exchange === "ALL" || row.exchange === exchange);
                if (next) {
                  setSelected(next);
                  setExpiry("");
                  setPicked(null);
                }
              }}
            >
              {item === "INDEX" ? "Indices" : "Equity"}
            </button>
          ))}
        </div>
        <div className="segmented slim">
          {(["ALL", "NSE", "BSE"] as const).map((item) => (
            <button
              key={item}
              className={cn(exchange === item && "is-on")}
              type="button"
              onClick={() => setExchange(item)}
            >
              {item === "ALL" ? "Both" : item}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={segment === "INDEX" ? "Find an index" : "Find Anand Rathi Wealth"}
          />
        </label>
        <div className="symbol-list">
          <AnimatePresence initial={false}>
            {list.map((item) => {
              const active = selected?.symbol === item.symbol && selected.exchange === item.exchange;
              return (
                <motion.button
                  key={`${item.exchange}-${item.symbol}`}
                  type="button"
                  className={cn("symbol-item", active && "is-active")}
                  onClick={() => {
                    setSelected(item);
                    setExpiry("");
                    setPicked(null);
                  }}
                  layout
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span>{item.label}</span>
                  <em>{item.exchange}</em>
                </motion.button>
              );
            })}
          </AnimatePresence>
          {!book && !loadError ? <p className="rail-note">Loading contracts</p> : null}
          {book && list.length === 0 ? <p className="rail-note">No contracts in this view</p> : null}
        </div>
      </aside>

      <section className="stage">
        <header className="toolbar">
          <div className="identity">
            <p className="eyebrow">{selected ? (selected.segment === "INDEX" ? "Index" : "Equity") : "Desk"}</p>
            <h1>{selected?.label ?? selected?.symbol ?? "Option Chain"}</h1>
          </div>
          <div className="spot-block">
            <p className="eyebrow">Spot</p>
            <strong>{formatPrice(snapshot?.spot ?? null)}</strong>
          </div>
          <span
            className={cn(
              "session-pill",
              book?.market?.open
                ? "is-open"
                : book?.market?.phase === "preopen"
                  ? "is-preopen"
                  : "is-closed",
            )}
          >
            {session}
          </span>
          <label className="field">
            <span>Expiry</span>
            <select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
              {(snapshot?.expiries ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Strikes</span>
            <select value={depth} onChange={(event) => setDepth(event.target.value as "near" | "full")}>
              <option value="near">Spot Focus</option>
              <option value="full">Entire Book</option>
            </select>
          </label>
          <label className="field">
            <span>Columns</span>
            <select
              value={density}
              onChange={(event) => setDensity(event.target.value as "focus" | "full")}
              data-testid="density-select"
            >
              <option value="focus">Focus Columns</option>
              <option value="full">All Columns</option>
            </select>
          </label>
          <div className="feed-chip">
            <span className={cn("live-dot", status === "error" && "is-off", status === "connecting" && "is-stale")} />
            <span>{feed}</span>
            <em>{snapshot ? `${snapshot.latencyMs} ms` : ""}</em>
          </div>
          <button
            className={cn("icon-btn", density === "full" && "is-on")}
            type="button"
            onClick={() => setDensity((value) => (value === "focus" ? "full" : "focus"))}
            aria-label={density === "focus" ? "Show all columns" : "Show focus columns"}
            aria-pressed={density === "full"}
            data-testid="density-toggle"
          >
            <Columns2 className="h-4 w-4" />
          </button>
          <button
            className={cn("icon-btn", magnify && "is-on")}
            type="button"
            onClick={() => {
              setMagnify((value) => {
                if (value) {
                  setRailOpen(railBeforeMagnify);
                  return false;
                }
                setRailBeforeMagnify(railOpen);
                setRailOpen(false);
                return true;
              });
            }}
            aria-label={magnify ? "Exit magnify" : "Magnify desk"}
            aria-pressed={magnify}
          >
            {magnify ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button className="icon-btn" type="button" onClick={() => refresh().catch(() => undefined)} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="icon-btn" type="button" onClick={toggle} aria-label="Toggle theme">
            {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <div className="kpi-row">
          <Kpi label="Put Call Ratio" value={snapshot?.totals.pcr != null ? snapshot.totals.pcr.toFixed(2) : "—"} />
          <Kpi label="Max Pain" value={formatNumber(snapshot?.totals.maxPain ?? null, 0)} />
          <Kpi label="Call Interest" value={formatCompact(snapshot?.totals.ceOi ?? null)} />
          <Kpi label="Put Interest" value={formatCompact(snapshot?.totals.peOi ?? null)} />
          <Kpi label="At the Money" value={formatNumber(snapshot?.totals.atm ?? null, 0)} />
        </div>

        {error || loadError ? <p className="banner">{error || loadError}</p> : null}

        {snapshot ? (
          <OpenInterestChart snapshot={snapshot} density={density} magnify={magnify} />
        ) : (
          <div className="chart-skeleton" />
        )}

        <div className="board">
          {snapshot ? (
            <OptionChainTable
              snapshot={snapshot}
              depth={depth}
              density={density}
              onSelect={setPicked}
            />
          ) : (
            <div className="board-wait">Opening the live book</div>
          )}
          <p className="board-meta">
            {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString("en-IN")}` : "Waiting for the book"}
            {book?.market?.tradeDate ? ` · ${book.market.tradeDate}` : ""}
            <span className="heat-legend">
              <i className="swatch high" /> High volume
              <i className="swatch low" /> Low volume
              <i className="swatch zero" /> No volume
            </span>
          </p>
        </div>
      </section>
      <QuoteSheet row={picked} onClose={() => setPicked(null)} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <motion.article className="kpi" whileHover={{ y: -2 }}>
      <p>{label}</p>
      <strong>{value}</strong>
    </motion.article>
  );
}
