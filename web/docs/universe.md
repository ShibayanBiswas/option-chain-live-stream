# Universe

Two categories. Indices come from the exchanges. Equity is only Anand Rathi Wealth.

## Indices

NSE index names are read from the option-chain page select `equity_optionchain_select` on each refresh. That is the exchange's own index-option list. Nothing in source code is a private copy of that list.

BSE index names and contract codes come from `ddlUnderlyingAsset` with product type `IO`. If the edge rejects the server, the desk uses the symbols and contract codes stored in `src/data/bse-cache.json`, which was captured from that same endpoint.

The rail shows the exchange's long name, such as NIFTY 50 or BSE SENSEX, with the trading code underneath. NSE spots, changes, and sparklines come from the NSE derivatives index board. BSE spots, changes, and sparklines come from BSE's own index graph (`IndexSensexData1` and `SensexGraphData` for SENSEX 16, BANKEX 53, and Focused IT 134). SENSEX 50 uses the code from BSE's index list when that list is reachable. The join in `src/lib/index-match.ts` only connects the option symbol to the exchange's published index name.

## Equity

NSE equity is included only when `option-chain-contract-info` for `ANANDRATHI` returns expiries. The desk does not call `/api/master-quote`, so the other equity names are never requested.

BSE equity is included only when the stock-option underlying list, product type `SO`, contains an Anand Rathi Wealth name. Other stock underlyings are discarded before the book is cached, and their chains are never requested. If that name is not in the list, the BSE equity section stays empty.

## Cache

The combined book is cached in server memory for ten minutes, then rebuilt. An empty index list is not cached. The browser loads the book from `/api/universe`.
