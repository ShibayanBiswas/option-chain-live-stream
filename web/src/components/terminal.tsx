"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Moon, PanelLeft, Search, Sun } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { CommandPalette } from "@/components/command-palette";
import { CustomLtpBoard, expiryChoices } from "@/components/custom-ltp-board";
import { ExpirySelect } from "@/components/expiry-select";
import { InstrumentTree } from "@/components/instrument-tree";
import { OptionChainTable } from "@/components/option-chain-table";
import { QuoteSheet } from "@/components/quote-sheet";
import { Toasts } from "@/components/toasts";
import { UpdatesDialog } from "@/components/updates-dialog";
import { useOptionStream } from "@/hooks/use-option-stream";
import { atmIv } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { displayName, upcomingExpiry, upcomingExpiries } from "@/lib/display";
import { formatCompact, formatNumber, formatPrice } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import type { ChainRow, Instrument, TapeQuote } from "@/lib/types";

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
  const { theme, toggle, mounted } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [expiry, setExpiry] = useState("");
  const [depth, setDepth] = useState<"near" | "full">("near");
  const [view, setView] = useState<"chain" | "custom">("chain");
  const [expiryCount, setExpiryCount] = useState(4);
  const [columnOverride, setColumnOverride] = useState<"focus" | "full" | null>(null);
  const [viewport, setViewport] = useState("laptop");
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const density = columnOverride ?? "focus";
  const [railOpen, setRailOpen] = useState(false);
  const [picked, setPicked] = useState<ChainRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const statusRef = useRef<"idle" | "connecting" | "live" | "polling" | "error">("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [tape, setTape] = useState<TapeQuote[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const pull = (first: boolean) => {
      fetch("/api/universe", { cache: "no-store" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Universe unavailable");
          return data as Book;
        })
        .then((data) => {
          if (cancelled) return;
          setBook((current) => (first || !current ? data : { ...current, market: data.market }));
          if (!first) return;
          const saved = window.localStorage.getItem("ocls-last");
          const all = [...data.indexes, ...data.equities];
          const remembered = all.find((item) => `${item.exchange}:${item.symbol}` === saved);
          const nifty = all.find((item) => item.symbol === "NIFTY" && item.exchange === "NSE");
          setSelected((current) => current ?? remembered ?? nifty ?? data.indexes[0] ?? data.equities[0] ?? null);
        })
        .catch((err) => {
          if (!cancelled && first) setLoadError(err instanceof Error ? err.message : "Universe unavailable");
        });
    };
    pull(true);
    const timer = window.setInterval(() => pull(false), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const { snapshot, status, error, quiet } = useOptionStream({
    symbol: selected?.symbol ?? "",
    expiry,
    exchange: selected?.exchange ?? "NSE",
    segment: selected?.segment ?? "INDEX",
    enabled: Boolean(selected),
  });

  useEffect(() => {
    if (!snapshot?.expiries?.length) return;
    const next = upcomingExpiry(snapshot.expiries, expiry);
    if (next !== expiry) setExpiry(next);
  }, [expiry, snapshot?.expiries]);

  useLayoutEffect(() => {
    if (window.matchMedia("(min-width: 981px)").matches) setRailOpen(true);
    const node = stageRef.current;
    if (!node) return;
    const apply = () => {
      const width = node.clientWidth;
      setViewport(width >= 1920 ? "tv" : width >= 1440 ? "desktop" : width >= 1100 ? "laptop" : width >= 701 ? "tablet" : "phone");
    };
    const watch = new ResizeObserver(apply);
    watch.observe(node);
    apply();
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 980px)").matches) setRailOpen(false);
    try {
      const stored = JSON.parse(window.localStorage.getItem("ocls-pins") || "[]");
      if (Array.isArray(stored)) setPins(stored.filter((item) => typeof item === "string"));
    } catch {
      setPins([]);
    }
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
    let stop = false;
    const pull = () => {
      fetch("/api/tape", { cache: "no-store" })
        .then((res) => res.json())
        .then((data: { quotes?: TapeQuote[] }) => {
          if (stop || !data.quotes) return;
          setTape(data.quotes);
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 20_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (updatesOpen) return;
    const bar = document.querySelector(".toolbar");
    if (bar instanceof HTMLElement) bar.scrollLeft = 0;
  }, [updatesOpen]);

  useEffect(() => {
    if (statusRef.current !== "error" && status === "error") pushToast("Connection lost");
    if (statusRef.current === "error" && (status === "live" || status === "polling")) {
      pushToast("Connection restored");
    }
    statusRef.current = status;
  }, [status]);

  function pushToast(message: string) {
    setToasts((current) => [...current, message].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item !== message));
    }, 3200);
  }

  function choose(item: Instrument) {
    setSelected(item);
    setExpiry("");
    setPicked(null);
    window.localStorage.setItem("ocls-last", `${item.exchange}:${item.symbol}`);
    if (window.matchMedia("(max-width: 980px)").matches) setRailOpen(false);
  }

  function togglePin(item: Instrument) {
    const key = `${item.exchange}:${item.symbol}`;
    setPins((current) => {
      const next = current.includes(key) ? current.filter((pin) => pin !== key) : [...current, key];
      window.localStorage.setItem("ocls-pins", JSON.stringify(next));
      return next;
    });
  }

  const instruments = useMemo(
    () => [...(book?.indexes ?? []), ...(book?.equities ?? [])],
    [book],
  );
  const session = book?.market?.message ?? (book?.market ? "Market Closed" : "Session");
  const marketOpen = book?.market?.open === true;
  const waiting = status === "connecting" || status === "polling";
  const delayed = Boolean(snapshot?.stale);
  const feed = delayed ? "Delayed" : !snapshot ? (waiting ? "Connecting" : "REST") : !marketOpen ? "Closed" : waiting ? "Waiting" : "REST";
  const feedTime = delayed && snapshot?.asOf ? snapshot.asOf : snapshot ? `${snapshot.latencyMs} ms` : "…";
  const expiryMenu = expiryChoices(Math.max(1, upcomingExpiries(snapshot?.expiries ?? [], 8).length));
  const shownExpiries = expiryMenu.includes(expiryCount) ? expiryCount : (expiryMenu[expiryMenu.length - 1] ?? 4);
  const strikeRange = snapshot?.rows.length
    ? `${formatNumber(snapshot.rows[0]?.strike ?? null, 0)} – ${formatNumber(snapshot.rows[snapshot.rows.length - 1]?.strike ?? null, 0)} · ${snapshot.rows.length} strikes`
    : "";

  return (
    <MotionConfig reducedMotion="user">
    <div className={cn("terminal bg-mesh", !railOpen && "rail-hidden")} data-viewport={viewport} ref={stageRef}>
      <motion.header
          className="toolbar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="toolbar-main">
          <button
            className="icon-btn"
            type="button"
            onClick={() => setRailOpen((open) => !open)}
            aria-label={railOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-pressed={railOpen}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button className="icon-btn" type="button" aria-label="Search contracts" onClick={() => setPaletteOpen(true)}>
            <Search className="h-4 w-4" />
          </button>
          <div className="identity">
            <h1>{selected ? displayName(selected.symbol, selected.label) : "Option Chain"}</h1>
            <LiveSpot value={snapshot?.spot ?? null} />
          </div>
          <button className="updates-btn" type="button" onClick={() => setUpdatesOpen(true)}>
            Updates
          </button>
          <button className="icon-btn" type="button" onClick={toggle} aria-label="Toggle theme">
            {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          </div>
          <div className="toolbar-tools">
          <div className="feed-chip" data-state={waiting ? "waiting" : quiet ? "waiting" : status} aria-live="polite">
            <span className={cn("live-dot", status === "error" && "is-off", (waiting || quiet) && "is-stale")} />
            <span>{quiet ? "Stale" : feed}</span>
            <em>{feedTime}</em>
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
          <select
            className="toolbar-select"
            aria-label="View"
            value={view}
            onChange={(event) => setView(event.target.value as "chain" | "custom")}
          >
            <option value="chain">Option Chain</option>
            <option value="custom">Custom</option>
          </select>
          {view === "chain" ? (
            <ExpirySelect
              expiries={snapshot?.expiries ?? []}
              value={expiry}
              onChange={(next) => {
                setExpiry(next);
                pushToast("Expiry updated");
              }}
            />
          ) : (
            <select
              className="toolbar-select"
              aria-label="Expiries"
              value={shownExpiries}
              onChange={(event) => setExpiryCount(Number(event.target.value))}
            >
              {expiryMenu.map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? "1 expiry" : `${count} expiries`}
                </option>
              ))}
            </select>
          )}
          <select
            className="toolbar-select"
            aria-label="Strikes"
            value={depth}
            onChange={(event) => setDepth(event.target.value as "near" | "full")}
          >
            <option value="near">Spot Focus</option>
            <option value="full">All Strikes</option>
          </select>
          {view === "chain" ? (
            <select
              className="toolbar-select"
              aria-label="Columns"
              value={density}
              onChange={(event) => setColumnOverride(event.target.value as "focus" | "full")}
              data-testid="density-select"
            >
              <option value="focus">Focus</option>
              <option value="full">All Columns</option>
            </select>
          ) : null}
          </div>
        </motion.header>
      <aside className={cn("rail", !railOpen && "is-collapsed", railOpen && "is-sheet")} aria-hidden={!railOpen}>
        <div className="rail-brand">
          <BrandLogo compact />
        </div>
        <button className="rail-back" type="button" onClick={() => setRailOpen(false)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {book ? (
          <InstrumentTree
            indexes={book.indexes}
            equities={book.equities}
            selected={selected}
            query={query}
            onQuery={setQuery}
            pins={pins}
            tape={tape}
            onSelect={choose}
            onTogglePin={togglePin}
          />
        ) : (
          <p className="rail-note">{loadError ?? "Loading contracts"}</p>
        )}
      </aside>

      <section className="stage">
        <div className="kpi-row">
          <Kpi index={0} label="PCR" value={snapshot?.totals.pcr != null ? snapshot.totals.pcr.toFixed(2) : "—"} />
          <Kpi index={1} label="Max Pain" value={formatNumber(snapshot?.totals.maxPain ?? null, 0)} />
          <Kpi index={2} label="Call OI" value={formatCompact(snapshot?.totals.ceOi ?? null)} />
          <Kpi index={3} label="Put OI" value={formatCompact(snapshot?.totals.peOi ?? null)} />
          <Kpi index={4} label="ATM IV" value={snapshot ? formatNumber(atmIv(snapshot.rows, snapshot.totals.atm), 2) : "—"} />
        </div>

        {error || loadError ? <p className="banner">{error || loadError}</p> : null}

        <div className="book-tools">
          <span className="range-label" aria-label="Strike range">{strikeRange}</span>
          <button className="icon-btn" type="button" onClick={() => {
            const row = document.getElementById(`strike-${snapshot?.totals.atm ?? ""}`);
            const scroller = row?.closest(".chain-scroll");
            if (!(row instanceof HTMLElement) || !(scroller instanceof HTMLElement)) return;
            const cell = row.querySelector(".strike-cell");
            const delta =
              cell instanceof HTMLElement
                ? cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left
                : 0;
            scroller.scrollTop = Math.max(0, row.offsetTop - scroller.clientHeight / 2);
            if (cell instanceof HTMLElement) {
              scroller.scrollLeft = Math.max(0, scroller.scrollLeft + delta - scroller.clientWidth / 2 + cell.clientWidth / 2);
            }
          }}>
            Jump to spot
          </button>
        </div>
        <div className="board">
          {snapshot && view === "custom" ? (
            <CustomLtpBoard
              symbol={selected?.symbol ?? snapshot.symbol}
              exchange={selected?.exchange ?? snapshot.exchange}
              segment={selected?.segment ?? snapshot.segment}
              expiries={snapshot.expiries}
              count={shownExpiries}
              depth={depth}
              primary={snapshot}
              onSelect={setPicked}
            />
          ) : snapshot ? (
            <OptionChainTable
              snapshot={snapshot}
              depth={depth}
              density={density}
              onSelect={setPicked}
            />
          ) : (
            <div className="board-wait">Opening the live book</div>
          )}
        </div>
      </section>
      <QuoteSheet row={picked} onClose={() => setPicked(null)} />
      <UpdatesDialog open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        instruments={instruments}
        onClose={() => setPaletteOpen(false)}
        onSelect={choose}
      />
      <Toasts messages={toasts} />
    </div>
    </MotionConfig>
  );
}

function LiveSpot({ value }: { value: number | null }) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState("");
  useEffect(() => {
    if (prev.current != null && value != null && value !== prev.current) {
      setFlash("");
      const next = value > prev.current ? "tick-up" : "tick-down";
      const frame = requestAnimationFrame(() => setFlash(next));
      const clear = window.setTimeout(() => setFlash(""), 600);
      prev.current = value;
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(clear);
      };
    }
    prev.current = value;
  }, [value]);
  return <strong className={cn("spot-inline", flash && `is-${flash}`)}>{formatPrice(value)}</strong>;
}

function Kpi({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <motion.article
      className="kpi"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, type: "spring", stiffness: 420, damping: 28 }}
      whileHover={{ y: -2 }}
    >
      <p>{label}</p>
      <strong key={value}>{value}</strong>
    </motion.article>
  );
}
