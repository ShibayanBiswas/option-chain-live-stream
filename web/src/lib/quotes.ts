import { getBseIndexBoard, getBseOptionChain } from "./bse";
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
  const [book, nseBoard, bseBoard] = await Promise.all([
    loadUniverse(),
    getNseIndexBoard().catch(() => [] as IndexQuote[]),
    getBseIndexBoard().catch(() => [] as IndexQuote[]),
  ]);

  const items: QuoteTick[] = [...book.indexes, ...book.equities].map((item) => {
    const matched =
      item.segment === "INDEX"
        ? item.exchange === "BSE"
          ? bseBoard.find((quote) => quote.symbol === item.symbol) ?? matchIndexQuote(item.symbol, bseBoard)
          : matchIndexQuote(item.symbol, nseBoard)
        : undefined;
    const name = isAnandRathiSymbol(item.symbol) ? "Anand Rathi Wealth" : (matched?.name ?? item.symbol);
    return {
      symbol: item.symbol,
      exchange: item.exchange,
      segment: item.segment,
      name,
      spot: matched?.last ?? null,
      change: matched?.change ?? null,
      pChange: matched?.pChange ?? null,
      spark: matched?.spark?.length ? matched.spark : sparkFrom(matched, matched?.last ?? null),
    };
  });

  await fillBseSpotsFromChain(book.indexes, items);

  const ticker: QuoteTick[] = [
    ...nseBoard.map((quote) => tick("NSE", quote)),
    ...bseBoard.filter((quote) => quote.last != null).map((quote) => tick("BSE", quote)),
  ];

  return { items, ticker };
}

async function fillBseSpotsFromChain(indexes: Instrument[], items: QuoteTick[]) {
  const missing = items.filter((item) => item.exchange === "BSE" && item.segment === "INDEX" && item.spot == null);
  await Promise.all(
    missing.map(async (item) => {
      const listed = indexes.find((index) => index.symbol === item.symbol && index.bseScrip);
      if (!listed?.bseScrip) return;
      try {
        const chain = await getBseOptionChain({
          symbol: listed.symbol,
          scripCd: listed.bseScrip,
          product: "IO",
        });
        if (chain.spot == null) return;
        item.spot = chain.spot;
        item.spark = item.spark.length > 1 ? item.spark : [chain.spot];
      } catch {
        /* The index graph is the primary feed. A missing chain leaves the row blank. */
      }
    }),
  );
}

function tick(exchange: Exchange, quote: IndexQuote): QuoteTick {
  return {
    symbol: quote.symbol ?? quote.name,
    exchange,
    segment: "INDEX",
    name: quote.name,
    spot: quote.last,
    change: quote.change,
    pChange: quote.pChange,
    spark: quote.spark?.length ? quote.spark : sparkFrom(quote, quote.last),
  };
}
