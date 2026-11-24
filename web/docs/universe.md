# Universe

Two categories only: **Indices** and **Equity**.

## Indices

The book is two index contracts:

- **NIFTY** on NSE
- **SENSEX** on BSE

Discovery still reads the exchange lists so the BSE contract code for SENSEX stays current. Every other index is dropped before `/api/universe` responds. If the BSE edge is blocked, SENSEX falls back to contract code `1` from `src/data/bse-cache.json`.

## Equity

**Anand Rathi Wealth only** (`ANANDRATHI`).

- On NSE, the desk filters the master-quote equity option list down to that symbol.
- On BSE, the desk probes stock options (`ProductType=SO`), keeps Anand Rathi Wealth when expiries exist, and drops every other equity.

No other equity symbols are returned by `/api/universe` or fetched by the chain/stream routes through the normal desk path.

## Expiries

Every chain response includes the full `expiries` array from the exchange. The toolbar expiry control switches among them; the stream reconnects when the selected expiry changes.

## Market session

`/api/universe` includes a `market` object from NSE market status:

| Phase | Message |
| --- | --- |
| open | Market Open |
| preopen | Pre Open |
| closed | Market Closed |
| holiday | Market Holiday |

The session pill and stream behaviour use this state.

## Cache

The combined book is cached in server memory for ten minutes, then rebuilt. Force refresh by restarting the server process. The browser loads the book from `/api/universe` with `Cache-Control: no-store`.
