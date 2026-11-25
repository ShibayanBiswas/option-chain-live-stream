# Architecture

Next.js 15 App Router desk in `web/`, deployed on Vercel as **option-chain-live-stream**.

## Layers

| Layer | Role |
| --- | --- |
| `src/components/terminal.tsx` | Header, sidebar, summary cards, range label |
| `src/components/custom-ltp-board.tsx` | Calls, strike and puts across every live expiry |
| `src/components/inward-chain.tsx` | Fixed strike, with the two sides scrolling toward it |
| `src/components/option-chain-table.tsx` | One expiry: calls, strike, puts |
| `src/hooks/use-option-stream.ts` | SSE client. Backs off, then polls, and pauses while the tab is hidden |
| `src/lib/universe.ts` | Keeps NIFTY and SENSEX. Equity is Anand Rathi Wealth only |
| `src/lib/chain-service.ts` | NSE or BSE snapshot, with a short in-memory cache |
| `src/lib/http.ts` | Pooled fetch, then curl if the exchange resets Node |
| `src/app/api/stream/route.ts` | One chain, then patches and heartbeats |

## Data path

1. The browser loads `/api/universe` and refreshes the session every 60 seconds.
2. `/api/stream` sends one `chain`. Later events are `patch` for changed strikes, `heartbeat` every 10 seconds, and `rotate` before the function limit.
3. A closed market does not refetch the book every few seconds.
4. NSE prices use the exchange websocket when it is sending frames. The chip then says WebSocket. Otherwise it says REST, Closed, Delayed, Waiting, Connecting, or Stale. It does not say Live. BSE stays on the chain API.
5. `src/data/bse-cache.json` is used only when BSE blocks the request, and that snapshot is marked `stale`.
6. The chain cache and PCR series live in the function instance. A cold start clears them.

## Chain

The chain header has a Calls and Puts row, then one column row with a single Strike heading. The strike sits flush against the call last price. A spot line sits between the two strikes that bracket the live price. There is no second Strike heading, no gold underline on a round strike, and no support or resistance badge.

Spot Focus is the 18 strikes below the at-the-money strike and the 18 above it. Custom uses that same window, shows the last price and the change for each live expiry, and offers every live expiry in the count menu. When the columns are wider than the screen, the strike stays fixed and the call and put columns scroll inward.
