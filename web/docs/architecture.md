# Architecture

Option Chain Live Stream is a Next.js desk. The browser never calls the exchanges. Every quote, expiry, and symbol list comes from a server route so cookies, redirects, and websocket headers stay on the server.

## Surfaces

| Route | Role |
| --- | --- |
| `/` | Full-width trading terminal |
| `/api/universe` | Index books for NSE and BSE, plus Anand Rathi Wealth equities, and the session phase |
| `/api/chain` | One normalised option-chain snapshot |
| `/api/oi` | Open interest, the change in open interest, totals, and the put-call ratio series |
| `/api/quotes` | Spot, change, and a short spark for the rail and the ticker |
| `/api/stream` | Server-sent events. The first event is the full chain. Later events are patches of the strikes that changed |
| `/api/meta` | The same book plus session status |
| `/api/health` | Exchange reachability, session phase, and chain-cache age |

## Data path

1. `loadUniverse` reads the NSE option-chain select for index names. It confirms Anand Rathi Wealth with that symbol's contract info and does not download the equity master list. BSE index names come from the exchange underlying list with product type `IO`. BSE equity names come from product type `SO` and are kept only when the name is Anand Rathi Wealth. If the BSE edge blocks the server, the last captured index book in `src/data/bse-cache.json` is used.
2. `loadOptionChain` resolves the symbol against that book, then calls NSE `option-chain-v3` or the BSE derivatives chain. Equity chains on BSE use product type `SO` for the expiry list. The snapshot is checked with zod before it is cached.
3. A repeat request for the same contract is served from memory for two seconds. If the exchange then fails or rate-limits, the last good snapshot is served for up to a minute and marked stale.
4. `/api/stream` publishes the snapshot, then keeps a websocket to `wss://streamer.nseindia.com/streams/fo/mbp` while the cash session is open. Ticks patch last, change, bid, ask, interest, and volume and are forwarded as a `patch` event. A full refresh still runs every few seconds. The browser merges patches and opens a new stream when the function rotates. If the event stream drops, the desk polls `/api/chain`.

## Session

Market Open, Pre-Open, Market Closed, and Market Holiday come from the NSE capital-market status payload. The desk does not infer them from a clock. The websocket opens only while the phase is open.

## Calculations

Put-call ratio, max pain, at-the-money strike, at-the-money implied volatility, and open-interest change are computed from the rows in `src/lib/analytics.ts`. Days to expiry and the weekly or monthly grouping are in `src/lib/expiry.ts`. Delta in the quote sheet uses Black-Scholes in `src/lib/greeks.ts` with the exchange IV. The discount rate used for that display delta is 6.5 percent.
