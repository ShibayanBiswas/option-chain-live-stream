# UI plan

This is the build plan for the Anand Rathi Wealth option-chain desk. It covers the layout, colour, motion, and data behaviour implemented in `web/`. The exchange symbol list stays dynamic. Only the equity book is narrowed to Anand Rathi Wealth.

## What is wrong today

- The chain table is `width: 100%`, so columns stretch and leave wide gaps between figures. The strike cell is also `position: sticky` at `left: 50cqw`, which paints the strike away from its column and opens a hole.
- Collapsed mode is an automatic phone crop to Last and Change. There is no expanded state that reveals the full book, and no shared collapsed/expanded behaviour on the open-interest panel.
- The header is a rounded card inside the stage padding, so it does not run edge to edge. The sidebar toggle sits in that card and collides with the title when the toolbar wraps.
- The sidebar lists every NSE equity from the master quote (hundreds of names) and every BSE stock-option underlying.
- Phones keep the symbol rail open as a chip strip, clip the summary cards, and use 36px controls.
- There is no instrument tree, no command palette, no expiry grouping, no in-cell open-interest bars, no spot marker, and no design-system tokens.

## 1. Desk frame

The viewport is a locked grid. The page itself does not scroll.

```
[ header, full width, no radius, no max-width ]
[ ticker strip, full width ]
[ instrument rail | stage ]
[ mobile dock, phones and tablets only ]
```

- Header spans both grid columns, from the left edge of the viewport to the right edge.
- The sidebar toggle is the first flex item in that header. It is in normal flow, 44px on touch layouts, and never covers the symbol title.
- Closing the rail sets the rail track to 0. The header stays full width.
- Stage padding sits under the header. Summary cards, open interest, and the chain fill the remaining height. The chain is `flex: 1` and scrolls inside itself.
- Scrollbars are hidden. Wheel, trackpad, and touch scrolling stay active.
- Magnify collapses the rail, enlarges type, and gives the open-interest panel more height. The control remains `Magnify desk` / `Exit magnify`.

Breakpoints:

| Width | Rail | Chain columns | Open interest | Dock |
| --- | --- | --- | --- | --- |
| 1440 and 1280 | Open by default | Collapsed columns, tight to the strike | Collapsed | Hidden |
| 768, 390, 360 | Hidden until the instruments icon opens a bottom sheet | Collapsed, horizontal scroll inside the chain | Collapsed | Visible, 44px targets |

## 2. Instrument navigation

Two categories, each with exchange subsections. Sections animate open and closed (`grid-template-rows`) and respect reduced motion.

- **Indices**
  - **NSE**: every name in the exchange option-chain select (`NIFTY`, `BANKNIFTY`, `FINNIFTY`, `MIDCPNIFTY`, `NIFTYNXT50`, and whatever else the select publishes).
  - **BSE**: every index underlying from the exchange (`SENSEX`, `BANKEX`, `SX50`, and the rest).
- **Equity**
  - **NSE**: Anand Rathi Wealth, and only that name.
  - **BSE**: Anand Rathi Wealth when the stock-option underlying list contains it.

Rows show the exchange code, the long name when the index quote feed has one (`NIFTY 50`, `NIFTY BANK`, …), live spot, change coloured without a plus sign, and a sparkline built from the exchange’s previous close, open, and last. A pin control stores favourites in `localStorage`. The last selection is restored from `localStorage`. Arrow keys move, Enter selects.

The header search button and Ctrl/Cmd+K open a command palette with the same tree, a text filter, and keyboard selection. On a phone or tablet the same tree is a bottom sheet opened from the dock. Nothing in the sheet uses a horizontal page scroll.

Expiry is a native select (so it stays accessible) with two groups, Weekly and Monthly. Monthly is the last listed expiry in each calendar month. The option text includes the day count (`24 Nov 2026 · 2 days`) and does not use brackets or a plus/minus window. The view select stays **Spot Focus** and **Entire Book**.

## 3. Option chain

Three panes share one vertical scroller: calls, strike, puts. That keeps the strike column fixed in the centre without a sticky offset, so there is no gap and no hole.

Call columns read toward the strike. The important fields sit against it:

`Bid quantity · Bid · Ask · Ask quantity · Open interest · Interest change · Volume · IV · Change · Last · Strike`

Puts mirror that order, so Last sits against the strike on both sides.

- **Collapsed (default):** the important set only: open interest, interest change, volume, IV, change, last. Any of those that are mostly empty are omitted.
- **Expanded:** every column that actually has data. Bid, ask, and the quantity columns stay hidden when fewer than five percent of the cells are filled. The same rule hides Change when the book has no changes.
- Columns are content-sized and packed against the strike. Spare width stays in the outer pane, not between figures. Figures use tabular numerals.
- The call pane uses `direction: rtl` so the last price stays next to the strike and the outer columns scroll outward.
- Header rows stick to the top of the chain scroller. The strike pane does not move horizontally.
- ATM strike: gold strike cell. In-the-money calls (strike below spot) get a red tint. In-the-money puts (strike above spot) get a green tint. Same idea in dark theme with lighter text so contrast holds.
- Open-interest and volume cells carry a depth bar scaled to the maximum on that side of the book. Call bars are red. Put bars are green.
- Last price heat: zero volume is grey and hatched; low volume is a faint blue wash; high volume is a strong gold wash. Intensity follows the volume rank.
- A spot marker row sits between the strikes that bracket the underlying, and the book scrolls so that marker is centred on load.
- The highest call open interest, the highest put open interest, and the strike with the largest absolute price change are marked as the call wall, the put wall, and the active strike.
- A tick flashes the cell green or red. The flash changes background only, so the row height does not move.
- Column headers expose a tooltip with the full name.

Spot Focus keeps a window around the at-the-money strike without an “ATM ± N” label. The footer states the visible span as `Strikes 24,000 to 25,000`. Entire Book shows every strike.

## 4. Open interest

The panel has the same two densities.

- **Collapsed:** put-call ratio, max pain, call interest, put interest, and a short mirrored histogram around spot.
- **Expanded:** the full strike book (open interest and the change in open interest) plus the put-call ratio path collected during this server process. Bars grow in on load. A crosshair and tooltip follow the pointer.

The panel is a fixed compact height when collapsed and shares the stage when expanded. Both states scroll inside the panel.

Summary cards above the panel count put-call ratio, max pain, call interest, put interest, interest change, and at-the-money IV. Counters ease toward the new value unless reduced motion is on.

## 5. Design system

Tokens live in `globals.css`: colour, spacing, radius, shadow, type, and motion durations. Dark and light each redefine the colour tokens.

Buttons:

| Class | Use |
| --- | --- |
| `btn-primary` | Commit actions inside the palette |
| `btn-ghost` | Secondary text actions |
| `btn-icon` | Header and dock icons |
| `btn-toggle` | Pressed state for magnify, density, pins |
| `segmented` | Indices / Equity and Both / NSE / BSE |

Every button has hover, pressed, focus-visible, and disabled styles. Focus is a gold ring. Panels are glassy: translucent surface, hairline border, soft shadow, and a slight glow on the active symbol. Motion uses Framer Motion for the palette, the sheet, and the histogram, and CSS for flashes and the ticker. `prefers-reduced-motion: reduce` cuts animation and ticker travel to nothing.

The header ticker scrolls the derivative index quotes across the full width and pauses on hover. The session pill reads Market Open, Pre-Open, Market Closed, or Market Holiday, with a pulse only while the session is open. The feed chip shows WebSocket, Live, or Rest plus the latest latency.

Toasts announce a lost feed, a restored feed, an expiry change, and a failed refresh. They do not shift the chain. The quote sheet remains the strike popup and adds delta when IV, spot, and time are present. No disclaimer copy, no bracketed asides, and no plus signs on positive numbers. Options terms stay short: LTP, IV, OI, PCR. Surrounding labels use full words (Indices, Equity, Open Interest, Put Call Ratio, At the Money).

## 6. Data behaviour the UI depends on

- `GET /api/universe` returns `indexes`, `equities`, and `market.phase` / `market.label`. Equities contain only Anand Rathi Wealth.
- `GET /api/chain` returns the normalised snapshot: spot, expiries, rows, totals, latency, feed, session.
- `GET /api/oi` returns the same book reduced to open interest, the change in open interest, totals, and the put-call ratio series.
- `GET /api/quotes` returns spot, change, and a three-point spark for the rail and the ticker.
- `GET /api/stream` sends one full `chain` event, then `patch` events for the strikes that changed, plus a heartbeat. The browser merges patches and reconnects when the function rotates or the socket drops. If the browser cannot hold an event stream it falls back to polling `/api/chain`.
- `GET /api/health` reports the session phase and cache age.

The chain cache serves a repeat request for two seconds and, if the exchange then fails, the last snapshot for up to a minute. The screen keeps the last good book instead of collapsing.

## 7. How this will be proven

- Unit tests for put-call ratio, max pain, at-the-money, IV inputs, Black-Scholes delta, day count, weekly/monthly grouping, column sets, depth and heat, session phase, the Anand Rathi filter, chain diffs, and zod validation.
- API tests for `/api/universe`, `/api/chain`, `/api/oi`, `/api/quotes`, `/api/health`, `/api/meta`, and `/api/stream`, including a missing symbol, an upstream failure, and a rate-limit path.
- Playwright on desktop 1440, laptop 1280, tablet 768, phone 390, and phone 360.
- Playwright also covers the tree, the command palette, keyboard selection, expiry groups, ITM classes, depth bars, volume heat, the spot marker, the tick flash, the sidebar toggle, the full-width header, magnify, both themes, the mobile sheet, and reduced motion.
- Visual snapshots at each breakpoint in light and dark, using a frozen fixture so the shots do not depend on the live book.
- One live smoke test still loads the real book and checks that the equity list is only Anand Rathi Wealth and that the index list includes NIFTY and SENSEX.
