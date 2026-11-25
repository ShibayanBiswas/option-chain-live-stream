# Universe

Two groups: **Indices** and **Equity**.

## Indices

`DESK_SCOPE` in `src/lib/config.ts` is the only switch. `all` (the default) lists every NSE index option book and every BSE index option book. NIFTY 50 is first under NSE and SENSEX is first under BSE. The rest sit under More NSE indices and More BSE indices. `core` keeps only NIFTY and SENSEX.

If BSE discovery fails, the last cached index list is served and the universe is marked stale. There is no hard-coded SENSEX contract code.

## Equity

Anand Rathi Wealth only (`ANANDRATHI`), on NSE and on BSE when BSE lists stock options for it. Every other equity is dropped.

## Expiry

The server selects the nearest contract that is still live in Asia/Kolkata, with a 15:30 cutoff on expiry day. Past expiries stay out of the menu.

## Session

`/api/universe` includes the NSE market status: open, pre-open, closed, or holiday when the exchange text says so. A weekend, a trade date from a previous day, or a leftover Open outside 09:15–15:30 IST is closed. Pre-open stays Pre-Open. The client polls this every 60 seconds.
