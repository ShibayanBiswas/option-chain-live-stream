# Universe

Two groups: **Indices** and **Equity**.

## Indices

The desk lists two indexes: NIFTY 50 on NSE and SENSEX on BSE. Other discovered indexes are not shown.

If BSE blocks the request, SENSEX falls back to contract code `1` in `src/data/bse-cache.json`. That chain is marked stale.

## Equity

Anand Rathi Wealth only (`ANANDRATHI`), on NSE. It is not listed under BSE. Every other equity is dropped.

## Expiry

The server selects the nearest contract that is still live in Asia/Kolkata, with a 15:30 cutoff on expiry day. Past expiries stay out of the menu.

## Session

`/api/universe` includes the NSE market status: open, pre-open, closed, or holiday when the exchange text says so. A weekend, a trade date from a previous day, or a leftover Open outside 09:15–15:30 IST is closed. Pre-open stays Pre-Open. The client polls this every 60 seconds.
