"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Moon, PanelLeft, Search, Sun } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { CommandPalette } from "@/components/command-palette";
import { ExpirySelect } from "@/components/expiry-select";
import { InstrumentTree } from "@/components/instrument-tree";
import { OptionChainTable } from "@/components/option-chain-table";
import { QuoteSheet } from "@/components/quote-sheet";
import { Toasts } from "@/components/toasts";
import { useOptionStream } from "@/hooks/use-option-stream";
import { atmIv } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { canonicalTapeSymbol, displayName, upcomingExpiry } from "@/lib/display";
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
  const [density, setDensity] = useState<"focus" | "full">("focus");
  const [railOpen, setRailOpen] = useState(false);
  const [picked, setPicked] = useState<ChainRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const statusRef = useRef<"idle" | "connecting" | "live" | "polling" | "error">("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [tape, setTape] = useState<TapeQuote[]>([]);
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [toasts, setToasts] = useState<string[]>([]);

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
        const saved = window.localStorage.getItem("ocls-last");
        const all = [...data.indexes, ...data.equities];
        const remembered = all.find((item) => `${item.exchange}:${item.symbol}` === saved);
        const nifty = all.find((item) => item.symbol === "NIFTY" && item.exchange === "NSE");
        setSelected((current) => current ?? remembered ?? nifty ?? data.indexes[0] ?? data.equities[0] ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Universe unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { snapshot, status, error } = useOptionStream({
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
          setHistory((current) => {
            const next = { ...current };
            for (const quote of data.quotes ?? []) {
              if (quote.last == null) continue;
              const key = `NSE:${canonicalTapeSymbol(quote.symbol)}`;
              const series = next[key] ?? [];
              next[key] = [...series, quote.last].slice(-24);
            }
            return next;
          });
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
    if (statusRef.current !== "error" && status === "error") pushToast("Connection lost");
    if (statusRef.current === "error" && (status === "live" || status === "polling")) {
      pushToast("Connection restored");
    }
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!selected || snapshot?.spot == null) return;
    const key = `${selected.exchange}:${selected.symbol}`;
    const spot = snapshot.spot;
    setHistory((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), spot].slice(-24),
    }));
  }, [selected, snapshot?.spot, snapshot?.timestamp]);

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

  return (
    <div className={cn("terminal bg-mesh", !railOpen && "rail-hidden")}>
      <aside className={cn("rail", !railOpen && "is-collapsed", railOpen && "is-sheet")} aria-hidden={!railOpen}>
        <div className="rail-brand">
          <BrandLogo compact />
        </div>
        {book ? (
          <InstrumentTree
            indexes={book.indexes}
            equities={book.equities}
            selected={selected}
            query={query}
            onQuery={setQuery}
            pins={pins}
            history={history}
            tape={tape}
            onSelect={choose}
            onTogglePin={togglePin}
          />
        ) : (
          <p className="rail-note">{loadError ?? "Loading contracts"}</p>
        )}
      </aside>

      <section className="stage">
        <header className="toolbar">
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
            <strong className="spot-inline">{formatPrice(snapshot?.spot ?? null)}</strong>
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
          <ExpirySelect
            expiries={snapshot?.expiries ?? []}
            value={expiry}
            onChange={(next) => {
              setExpiry(next);
              pushToast("Expiry updated");
            }}
          />
          <select
            className="toolbar-select"
            aria-label="Strikes"
            value={depth}
            onChange={(event) => setDepth(event.target.value as "near" | "full")}
          >
            <option value="near">Spot Focus</option>
            <option value="full">Entire Book</option>
          </select>
          <select
            className="toolbar-select"
            aria-label="Columns"
            value={density}
            onChange={(event) => setDensity(event.target.value as "focus" | "full")}
            data-testid="density-select"
          >
            <option value="focus">Focus</option>
            <option value="full">All Columns</option>
          </select>
          <button className="icon-btn" type="button" onClick={toggle} aria-label="Toggle theme">
            {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <div className="kpi-row">
          <Kpi label="PCR" value={snapshot?.totals.pcr != null ? snapshot.totals.pcr.toFixed(2) : "—"} />
          <Kpi label="Max Pain" value={formatNumber(snapshot?.totals.maxPain ?? null, 0)} />
          <Kpi label="Call OI" value={formatCompact(snapshot?.totals.ceOi ?? null)} />
          <Kpi label="Put OI" value={formatCompact(snapshot?.totals.peOi ?? null)} />
          <Kpi label="ATM IV" value={snapshot ? formatNumber(atmIv(snapshot.rows, snapshot.totals.atm), 2) : "—"} />
        </div>

        {error || loadError ? <p className="banner">{error || loadError}</p> : null}

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
        </div>
      </section>
      <QuoteSheet row={picked} onClose={() => setPicked(null)} />
      <CommandPalette
        open={paletteOpen}
        instruments={instruments}
        onClose={() => setPaletteOpen(false)}
        onSelect={choose}
      />
      <Toasts messages={toasts} />
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
