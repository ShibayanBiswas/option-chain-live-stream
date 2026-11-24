# Interface

The terminal is one full-width trading desk. The plan for the layout is in [UI_PLAN.md](./UI_PLAN.md).

## Frame

The page does not scroll. The header and the ticker run from the left edge of the viewport to the right edge. The sidebar toggle is the first control in the header, in normal flow, so it does not cover the symbol. Closing the rail zeroes its track. The header stays full width.

On a phone or tablet the rail is not rendered. An icon in the header or the bottom dock opens the same tree as a bottom sheet. Dock targets are at least 44px. Tables scroll inside the chain and the open-interest panel.

## Instrument tree

Indices and Equity, each with NSE and BSE subsections. Sections animate open and closed. A row shows the full index name, then the trading code and exchange. The name truncates with an ellipsis when the rail is narrow, and it does not run into the price, sparkline, or pin. Spot and change come from the exchange index feed. Pins and the last selection are stored in the browser. Ctrl or Cmd+K opens the same list as a command palette with keyboard selection. Arrow keys move through the rail.

Expiry options are grouped into Weekly and Monthly. Monthly is the last listed expiry in each calendar month. The option text includes the day count.

Spot Focus keeps a window around the at-the-money strike. Entire Book shows every strike. The labels do not use a plus or minus window. The chain footer states the visible span as `Strikes A to B`.

## Chain

Calls, strike, and puts are three panes in one vertical scroller. Columns are content-sized and packed against the strike, so spare width sits outside the figures. The call pane scrolls outward from the strike. The strike pane stays put. Headers stick to the top of the scroller.

Collapsed, the default, shows open interest, the change in open interest, volume, IV, change, and last, dropping any of those that are mostly empty. Expanded shows every column that has data, including bid and ask when the book actually quotes them.

In-the-money calls, strikes below spot, use a red tint. In-the-money puts, strikes above spot, use a green tint. The at-the-money strike is gold. Open interest and volume sit on a depth bar, red on the call side and green on the put side. Last price heat follows volume rank: hatched grey when there is no volume, faint blue when volume is low, gold when volume is high. A spot line sits between the strikes that bracket the underlying. The highest call open interest, the highest put open interest, and the largest price change are marked on the strike.

A tick flashes the cell green or red without changing the row height.

## Open interest

Collapsed is the histogram around spot. The ratio, max pain, and interest totals stay in the summary cards above the chart. Expanded adds the full strike book, the change in open interest, and the put-call ratio path collected during the session. Bars grow in on load. The row under the pointer shows a crosshair readout.

Summary cards above the panel count the ratio, max pain, call interest, put interest, interest change, and at-the-money IV.

## Chrome

The feed chip reads Live, Delayed, or Closed once a book has arrived, and Connecting only before that. Magnify collapses the rail and enlarges the book. Scrollbars are hidden. Light and dark themes share the same tokens. Toasts report a lost feed, a restored feed, an expiry change, and a refresh. The quote sheet is the strike popup and includes delta when IV, spot, and time are present. Positive numbers are not prefixed with a plus sign.
