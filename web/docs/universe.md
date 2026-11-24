# Universe

Two categories only: **Indices** and **Equity**.

## Indices

Every Indian index that publishes an option chain on NSE or BSE is discovered at runtime.

- **NSE** index names come from the option-chain page select `equity_optionchain_select` on each refresh. That is the exchange’s own index-option list (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, NIFTYNXT50, and any others the exchange lists).
- **BSE** index names and contract codes come from `ddlUnderlyingAsset` with product type `IO` (SENSEX, BANKEX, SENSEX50, and peers). If the edge rejects the server, the desk falls back to symbols and contract codes stored in `src/data/bse-cache.json`, which was captured from that same endpoint.

Nothing in this list is hardcoded in the UI. The sidebar renders whatever `/api/universe` returns under `indexes`.

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
