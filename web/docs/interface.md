# Interface

## Navigation

- Sidebar tree: Indices and Equity, each split into NSE and BSE. Sections animate open and closed.
- Rows show last and change. NIFTY comes from the NSE index tape. SENSEX and Anand Rathi Wealth on NSE and BSE come from the live quote supplement, because those names are not on the NSE index tape.
- Pins and the last contract are stored in the browser.
- Command palette: Search contracts, or Ctrl/Cmd+K. Arrow keys and Enter select.
- Expiry menu groups Weekly and Monthly and shows days remaining.
- On narrow screens the tree starts closed and opens as a bottom sheet.

## Chrome

- Full-width terminal: left rail + stage, no page gutters.
- Floating sidebar control (`rail-fab`) that tracks open/collapsed state without covering the board.
- Toolbar: contract, spot, session, expiry, strike window, columns, theme. On a phone the name stays on the first row and the controls wrap onto a second row.

## Option chain

- Layout: **Calls | Strike | Puts**.
- Sticky dual header and sticky strike column; tabular figures; ATM / ITM tinting.
- Column names match the exchanges: OI, Chng in OI, Volume, IV, LTP, Chng, Bid Qty, Bid, Ask, Ask Qty, Strike.
- Default **Focus Columns**; **All Columns** reveals every non-empty field.
- Zero-volume strikes shaded; high/low volume last prices highlighted.
- Strike window controls are **Spot Focus** and **Entire Book** — never “ATM ±N”.
- Live cells flash without layout shift.

## Mobile

- On a phone, Focus is five columns that fit the screen: OI, LTP with the change under it, Strike, then the put side. All Columns still scrolls sideways inside the chain. The summary cards wrap onto two rows. The page itself does not scroll sideways.
- The strike stays in its column. It is not pinned to the left edge.
- The instrument list starts closed and opens as a sheet from the toolbar.
- Touch targets ≥ 44px.

## Copy rules

- Full words in chrome (Indices, Equity, Open Interest) except established derivatives terms (IV, NSE, BSE).
- No plus signs on gains — colour only.
- No disclaimer banners in the desk.
