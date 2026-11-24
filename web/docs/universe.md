# Universe

Two books, two exchanges.

## Indexes

NSE index names are read from the option-chain page select `equity_optionchain_select` on each refresh. That is the exchange's own index-option list.

BSE index names and contract codes come from `ddlUnderlyingAsset` with product type `IO`. If the edge rejects the server, the desk uses the symbols and contract codes stored in `src/data/bse-cache.json`, which was captured from that same endpoint.

## Equities

NSE equity option underlyings are the array from `/api/master-quote`. The exchange publishes this list for the option-chain symbol dropdown. It includes the Anand Rathi Wealth listed name when the exchange includes it. The desk does not keep a private copy of that list in source code.

BSE equity option underlyings are requested with product type `SO` from the same underlying endpoint. They appear under Equities with exchange BSE when the endpoint returns them.

## Cache

The combined book is cached in server memory for ten minutes, then rebuilt. The browser loads it from `/api/universe`.
