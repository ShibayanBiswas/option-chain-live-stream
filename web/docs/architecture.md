# Architecture

Option Chain Live Stream is a Next.js desk. The browser never calls the exchanges directly. Every quote, expiry, and symbol list comes from a server route so cookies, redirects, and websocket headers stay on the server.

## Surfaces

| Route | Role |
| --- | --- |
| `/` | Full-width trading terminal with Spot Focus / Entire Book, magnify, and Strike Pressure |
| `/api/universe` | Live index and equity books for NSE and BSE |
| `/api/chain` | One option-chain snapshot |
| `/api/stream` | Server-sent events. NSE also opens the exchange websocket and merges ticks into the snapshot |
| `/api/meta` | Same book plus session status |
| `/api/health` | Exchange reachability |

The desk never hardcodes the contract list. Indexes and equities come from the exchanges. Column order puts Last and Change against the strike on both sides.

## Data path

1. `loadUniverse` reads the NSE option-chain page for index names and `/api/master-quote` for the equity future-and-options book. BSE names come from the exchange underlying list. If that edge blocks the server, the last captured BSE book in `src/data/bse-cache.json` is used. Nothing in the sidebar is a handwritten symbol list.
2. `loadOptionChain` resolves the clicked symbol against that book, then calls NSE `option-chain-v3` or the BSE derivatives chain.
3. `/api/stream` publishes the snapshot, then keeps a websocket to `wss://streamer.nseindia.com/streams/fo/mbp` for the selected NSE symbol and expiry. Ticks patch last, change, bid, ask, interest, and volume. A full snapshot refresh still runs every few seconds so open interest and totals stay aligned with the exchange.

## Session

Market open and market closed follow the NSE capital-market status payload. The label is `Market Open` or `Market Closed`. It is not inferred from a clock hardcoded in the interface.
