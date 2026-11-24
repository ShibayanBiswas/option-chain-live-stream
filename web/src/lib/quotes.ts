import { isAnandRathiSymbol } from "./equity";
import { matchIndexQuote, type IndexQuote } from "./index-match";
import { getNseIndexBoard } from "./nse";
import type { Exchange, Instrument } from "./types";
import { loadUniverse } from "./universe";

export type QuoteTick = {
  symbol: string;
  exchange: Exchange;
  segment: Instrument["segment"];
  name: string;
  spot: number | null;
  change: number | null;
  pChange: number | null;
  spark: number[];
};

function sparkFrom(quote: IndexQuote | undefined, spot: number | null): number[] {
  const points = [quote?.previousClose ?? null, quote?.open ?? null, spot];
  return points.filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
}

export async function loadQuoteBoard(): Promise<{ items: QuoteTick[]; ticker: QuoteTick[] }> {
  const [book, board] = await Promise.all([
    loadUniverse(),
    getNseIndexBoard().catch(() => [] as IndexQuote[]),
  ]);

  const items: QuoteTick[] = [...book.indexes, ...book.equities].map((item) => {
    const matched = item.exchange === "NSE" && item.segment === "INDEX" ? matchIndexQuote(item.symbol, board) : undefined;
    const name = isAnandRathiSymbol(item.symbol) ? "Anand Rathi Wealth" : (matched?.name ?? item.symbol);
    return {
      symbol: item.symbol,
      exchange: item.exchange,
      segment: item.segment,
      name,
      spot: matched?.last ?? null,
      change: matched?.change ?? null,
      pChange: matched?.pChange ?? null,
      spark: sparkFrom(matched, matched?.last ?? null),
    };
  });

  const ticker: QuoteTick[] = board.map((quote) => ({
    symbol: quote.name,
    exchange: "NSE" as const,
    segment: "INDEX" as const,
    name: quote.name,
    spot: quote.last,
    change: quote.change,
    pChange: quote.pChange,
    spark: sparkFrom(quote, quote.last),
  }));

  return { items, ticker };
}
