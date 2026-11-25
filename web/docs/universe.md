# Universe

Two groups: **Indices** and **Equity**.

## Indices

Every NSE and BSE index with listed options is discovered at runtime. The list is not hard-coded. NIFTY and SENSEX are always part of that discovered book. Names such as NIFTY 50 and NIFTY BANK come from a display map and do not decide which symbols exist.

If BSE blocks the request, SENSEX falls back to contract code `1` in `src/data/bse-cache.json`. That chain is marked stale.

## Equity

Anand Rathi Wealth only (`ANANDRATHI`), on NSE and on BSE when BSE lists stock options for it. Every other equity is dropped.

## Expiry

The server selects the nearest contract that is still live in Asia/Kolkata, with a 15:30 cutoff on expiry day. Past expiries stay out of the menu.

## Session

`/api/universe` includes the NSE market status: open, pre-open, closed, or holiday when the exchange text says so. A trade date from a previous day, a weekend, or a clock outside 09:15–15:30 IST is closed even if the payload still says Open. The client polls this every 60 seconds.
