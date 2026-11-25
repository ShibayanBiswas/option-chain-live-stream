# Architecture

Next.js 15 App Router desk in `web/`, deployed on Vercel as **option-chain-live-stream**.

## Layers

| Layer | Role |
| --- | --- |
| `src/components/terminal.tsx` | Header, sidebar, summary cards, range label |
| `src/components/option-chain-table.tsx` | One table: calls, strike, puts |
| `src/hooks/use-option-stream.ts` | SSE client. Backs off, then polls, and pauses while the tab is hidden |
| `src/lib/universe.ts` | Keeps NIFTY and SENSEX. Equity is Anand Rathi Wealth only |
| `src/lib/chain-service.ts` | NSE or BSE snapshot, with a short in-memory cache |
| `src/lib/http.ts` | Pooled fetch, then curl if the exchange resets Node |
| `src/app/api/stream/route.ts` | One chain, then patches and heartbeats |

## Data path

1. The browser loads `/api/universe` and refreshes the session every 60 seconds.
2. `/api/stream` sends one `chain`. Later events are `patch` for changed strikes, `heartbeat` every 10 seconds, and `rotate` before the function limit.
3. A closed market does not refetch the book every few seconds.
4. There is no exchange websocket. The chip says REST, Closed, Delayed, Waiting, Connecting, or Stale. It does not say Live while the market is closed.
5. `src/data/bse-cache.json` is used only when BSE blocks the request, and that snapshot is marked `stale`.
6. The chain cache and PCR series live in the function instance. A cold start clears them.

## Chain

The chain header has a Calls and Puts row, then one column row with a single Strike heading. The strike sits flush against the call last price. A spot line sits between the two strikes that bracket the live price. There is no second Strike heading, no gold underline on a round strike, and no support or resistance badge.
