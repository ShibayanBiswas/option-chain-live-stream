# Interface

## Navigation

- Sidebar tree: Indices and Equity, each split into NSE and BSE. Sections animate open and closed.
- Rows show last, change, and a sparkline from the session tape.
- Pins and the last contract are stored in the browser.
- Command palette: Search contracts, or Ctrl/Cmd+K. Arrow keys and Enter select.
- Expiry menu groups Weekly and Monthly and shows days remaining.
- On narrow screens the tree starts closed and opens as a bottom sheet.

## Chrome

- Full-width terminal: left rail + stage, no page gutters.
- Floating sidebar control (`rail-fab`) that tracks open/collapsed state without covering the board.
- Toolbar: identity, spot, session phase, expiry, strike window, column density, feed latency, magnify, refresh, theme.

## Option chain

- Layout: **Calls | Strike | Puts**.
- Sticky dual header and sticky strike column; tabular figures; ATM / ITM tinting.
- Important metrics sit against the strike (Last, Change).
- Default **Focus Columns**; **All Columns** reveals every non-empty field.
- Zero-volume strikes shaded; high/low volume last prices highlighted.
- Strike window controls are **Spot Focus** and **Entire Book** — never “ATM ±N”.
- Live cells flash without layout shift.

## Open interest

- Same focus / full density behaviour.
- Animated dual-sided bars with sheen, spot highlight, and optional metric labels in full density.
- Magnify raises the chart height with the board.

## Mobile

- Rail collapses into a horizontal symbol strip; toggle moves to a bottom FAB.
- Touch targets ≥ 44px.
- Tables scroll inside their panes; the page itself does not overflow horizontally.

## Copy rules

- Full words in chrome (Indices, Equity, Open Interest) except established derivatives terms (IV, NSE, BSE).
- No plus signs on gains — colour only.
- No disclaimer banners in the desk.
