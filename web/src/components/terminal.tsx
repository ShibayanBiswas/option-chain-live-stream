"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Columns3, Maximize2, Minimize2, Moon, PanelLeft, RefreshCw, Search, Sun } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { CommandPalette } from "@/components/command-palette";
import { InstrumentTree } from "@/components/instrument-tree";
import { OpenInterestChart } from "@/components/oi-chart";
import { OptionChainTable } from "@/components/option-chain-table";
import { QuoteSheet } from "@/components/quote-sheet";
import { SummaryCards } from "@/components/summary-cards";
import { TickerStrip } from "@/components/ticker-strip";
import { useOptionStream } from "@/hooks/use-option-stream";
import { cn } from "@/lib/cn";
import { daysToExpiry, formatExpiryOption, groupExpiries } from "@/lib/expiry";
import { formatPrice } from "@/lib/format";
import type { QuoteTick } from "@/lib/quotes";
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
    label?: string;
    message: string;
  } | null;
};

const PINS_KEY = "option-chain-pins";
const LAST_KEY = "option-chain-last";

export function Terminal() {
  const reduce = useReducedMotion();
  const { theme, toggle, mounted } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [expiry, setExpiry] = useState("");
  const [depth, setDepth] = useState<"near" | "full">("near");
  const [railOpen, setRailOpen] = useState(true);
  const [railBeforeMagnify, setRailBeforeMagnify] = useState(true);
  const [magnify, setMagnify] = useState(false);
  const [picked, setPicked] = useState<ChainRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chainDensity, setChainDensity] = useState<"collapsed" | "expanded">("collapsed");
  const [oiExpanded, setOiExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<{ items: QuoteTick[]; ticker: QuoteTick[] }>({ items: [], ticker: [] });
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-3), { id, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 4200);
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PINS_KEY) || "[]");
      if (Array.isArray(stored)) setPins(stored.filter((item) => typeof item === "string"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        setSelected((current) => {
          if (current) return current;
          const last = localStorage.getItem(LAST_KEY);
          const all = [...data.indexes, ...data.equities];
          const remembered = last ? all.find((item) => `${item.exchange}:${item.symbol}:${item.segment}` === last) : undefined;
          return remembered ?? data.indexes.find((item) => item.symbol === "NIFTY") ?? data.indexes[0] ?? data.equities[0] ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Universe unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/quotes", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data?.items) setQuotes(data);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const { snapshot, status, updatedAt, socketState, refresh } = useOptionStream({
    symbol: selected?.symbol ?? "",
    expiry,
    exchange: selected?.exchange ?? "NSE",
    segment: selected?.segment ?? "INDEX",
    enabled: Boolean(selected),
  });

  useEffect(() => {
    if (!snapshot?.expiries?.length) return;
    if (!expiry || !snapshot.expiries.includes(expiry)) {
      const upcoming = snapshot.expiries.find((item) => (daysToExpiry(item) ?? -1) >= 0);
      setExpiry(upcoming ?? snapshot.expiries[0]!);
    }
  }, [expiry, snapshot?.expiries]);

  const previousStatus = useRef(status);
  useEffect(() => {
    if (status === "error") pushToast("Feed interrupted");
    if (previousStatus.current === "error" && status === "live") pushToast("Feed restored");
    previousStatus.current = status;
  }, [pushToast, status]);

  useEffect(() => {
    if (loadError) pushToast(loadError);
  }, [loadError, pushToast]);

  const groups = useMemo(() => groupExpiries(snapshot?.expiries ?? []), [snapshot?.expiries]);
  const session = book?.market?.label ?? (book?.market ? "Market Closed" : "Session");
  const phase = book?.market?.phase ?? (book?.market?.open ? "open" : book?.market ? "closed" : "closed");
  const feed =
    socketState === "open" || snapshot?.feed === "websocket"
      ? "WebSocket"
      : status === "live"
        ? "Live"
        : status === "connecting"
          ? "Connecting"
          : "Rest";

  const choose = (item: Instrument) => {
    setSelected(item);
    setExpiry("");
    setPicked(null);
    localStorage.setItem(LAST_KEY, `${item.exchange}:${item.symbol}:${item.segment}`);
    setSheetOpen(false);
  };

  const toggleNav = () => {
    if (narrow) setSheetOpen((open) => !open);
    else setRailOpen((open) => !open);
  };

  const togglePin = (key: string) => {
    setPins((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      localStorage.setItem(PINS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const tree = (
    <InstrumentTree
      indexes={book?.indexes ?? []}
      equities={book?.equities ?? []}
      quotes={quotes.items}
      selected={selected}
      pins={pins}
      query={query}
      onQuery={setQuery}
      onTogglePin={togglePin}
      onSelect={choose}
    />
  );

  return (
    <div className={cn("terminal", magnify && "is-magnified", !railOpen && "rail-hidden", narrow && "is-narrow")}>
      <header className="desk-header" data-testid="desk-header">
        <button className="btn-icon" type="button" onClick={toggleNav} aria-label="Toggle sidebar" aria-expanded={narrow ? sheetOpen : railOpen}>
          <PanelLeft className="h-4 w-4" />
        </button>
        <BrandLogo compact />
        <div className="identity">
          <p className="eyebrow">{selected ? (selected.segment === "INDEX" ? "Index" : "Equity") : "Desk"}</p>
          <h1>{selected?.symbol ?? "Option Chain"}</h1>
        </div>
        <div className="spot-block">
          <p className="eyebrow">Spot</p>
          <strong>{formatPrice(snapshot?.spot ?? null)}</strong>
        </div>
        <span className={cn("session-pill", `is-${phase}`, book?.market?.open && "is-open")}>{session}</span>
        <label className="field">
          <span>Expiry</span>
          <select
            aria-label="Expiry"
            value={expiry}
            onChange={(event) => {
              setExpiry(event.target.value);
              pushToast("Expiry updated");
            }}
          >
            {groups.weekly.length > 0 ? (
              <optgroup label="Weekly">
                {groups.weekly.map((item) => (
                  <option key={item} value={item}>
                    {formatExpiryOption(item)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {groups.monthly.length > 0 ? (
              <optgroup label="Monthly">
                {groups.monthly.map((item) => (
                  <option key={item} value={item}>
                    {formatExpiryOption(item)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label className="field">
          <span>View</span>
          <select aria-label="View" value={depth} onChange={(event) => setDepth(event.target.value as "near" | "full")}>
            <option value="near">Spot Focus</option>
            <option value="full">Entire Book</option>
          </select>
        </label>
        <div className="feed-chip">
          <span className={cn("live-dot", status === "error" && "is-off", (status === "connecting" || status === "polling") && "is-stale")} />
          <span>{feed}</span>
          <em>{snapshot ? `${snapshot.latencyMs} ms` : ""}</em>
        </div>
        <button className="btn-icon" type="button" onClick={() => setPaletteOpen(true)} aria-label="Search instruments">
          <Search className="h-4 w-4" />
        </button>
        <button
          className={cn("btn-icon", chainDensity === "expanded" && "is-on")}
          type="button"
          aria-pressed={chainDensity === "expanded"}
          aria-label={chainDensity === "collapsed" ? "Expand columns" : "Collapse columns"}
          onClick={() => setChainDensity((value) => (value === "collapsed" ? "expanded" : "collapsed"))}
        >
          <Columns3 className="h-4 w-4" />
        </button>
        <button
          className={cn("btn-icon", magnify && "is-on")}
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
        <button className="btn-icon" type="button" onClick={() => refresh().then(() => pushToast("Book refreshed")).catch(() => pushToast("Refresh failed"))} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button className="btn-icon" type="button" onClick={toggle} aria-label="Toggle theme">
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      <TickerStrip items={quotes.ticker} />

      {!narrow ? (
        <aside className={cn("rail", !railOpen && "is-collapsed")}>
          <div className="rail-brand">
            <p className="eyebrow">Book</p>
          </div>
          {tree}
        </aside>
      ) : null}

      <section className={cn("stage", oiExpanded && "is-oi-expanded")}>
        <SummaryCards snapshot={snapshot} />
        {snapshot ? (
          <OpenInterestChart
            snapshot={snapshot}
            magnify={magnify}
            expanded={oiExpanded}
            onToggle={() => setOiExpanded((value) => !value)}
          />
        ) : (
          <div className="chart-skeleton skeleton" />
        )}
        <div className="board">
          {snapshot ? (
            <OptionChainTable snapshot={snapshot} depth={depth} density={chainDensity} onSelect={setPicked} />
          ) : (
            <div className="board-wait skeleton">Opening the live book</div>
          )}
          <p className="board-meta">
            {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString("en-IN")}` : "Waiting for the book"}
            {book?.market?.tradeDate ? ` · ${book.market.tradeDate}` : ""}
            {snapshot ? ` · ${snapshot.latencyMs} ms from the exchange` : ""}
          </p>
        </div>
      </section>

      <nav className="mobile-dock" aria-label="Desk tools">
        <button className="btn-icon" type="button" onClick={toggleNav} aria-label="Toggle sidebar">
          <PanelLeft className="h-4 w-4" />
        </button>
        <button className="btn-icon" type="button" onClick={() => setChainDensity((value) => (value === "collapsed" ? "expanded" : "collapsed"))} aria-label={chainDensity === "collapsed" ? "Expand columns" : "Collapse columns"}>
          <Columns3 className="h-4 w-4" />
        </button>
        <button className="btn-icon" type="button" onClick={() => setOiExpanded((value) => !value)} aria-label={oiExpanded ? "Collapse open interest" : "Expand open interest"}>
          <span className="dock-label">OI</span>
        </button>
        <button className="btn-icon" type="button" onClick={() => setMagnify((value) => !value)} aria-label={magnify ? "Exit magnify" : "Magnify desk"}>
          {magnify ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button className="btn-icon" type="button" onClick={toggle} aria-label="Toggle theme">
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </nav>

      <AnimatePresence>
        {narrow && sheetOpen ? (
          <motion.div className="sheet-backdrop" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} onClick={() => setSheetOpen(false)}>
            <motion.div
              className="instrument-sheet"
              role="dialog"
              aria-label="Instruments"
              initial={reduce ? false : { y: 24 }}
              animate={{ y: 0 }}
              exit={reduce ? undefined : { y: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              {tree}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        indexes={book?.indexes ?? []}
        equities={book?.equities ?? []}
        quotes={quotes.items}
        onClose={() => setPaletteOpen(false)}
        onSelect={choose}
      />

      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.p key={toast.id} className="toast" role="status" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }}>
              {toast.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      <QuoteSheet row={picked} spot={snapshot?.spot ?? null} expiry={snapshot?.expiry ?? expiry} onClose={() => setPicked(null)} />
    </div>
  );
}
