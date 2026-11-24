# Desk upgrade plan

Status: built on `fix/master-desk-audit`. Navigation, chain colour, motion, diff streaming, and the extra tests below are in the app. Session put/call ratio trend is accumulated in the browser because the exchanges do not publish that series.

This plan covers the follow-up on top of the Indices / Anand Rathi Wealth desk. Build order is the order below. Each slice has a check that must pass before the next slice starts.

## 9. Instrument navigation

**Goal:** one hierarchical book, reachable from the sidebar and from a header command palette.

- Sections: Indices, then Equity. Subsections: NSE, then BSE. Rows come only from `/api/universe` (dynamic discovery). Display names such as NIFTY 50 are presentation labels for known symbols; unknown symbols keep the exchange code.
- Each row shows the live last, signed change (colour, no plus), and a sparkline built from successive tape samples.
- Sections animate open and closed. Favourites are pinned in `localStorage`. The last selection is restored from `localStorage`.
- Header command palette (`Ctrl/Cmd+K` and a search button): type-ahead across the book, arrow keys, Enter to select.
- Expiry control groups Weekly and Monthly, and shows days to expiry. Monthly means the last Thursday of the month (or a late-month holiday shift). Everything else is weekly.
- At widths ≤ 980px the tree starts collapsed and opens as a bottom sheet from the sidebar button.

**Check:** Playwright opens a section, searches, selects with the keyboard, changes expiry, and opens the phone sheet.

## 10. Chain colour

**Goal:** a Zerodha / Groww reading of the book, in light and dark.

- Call zone stays a red tint, put zone a green tint.
- ITM calls (strike below spot) and ITM puts (strike above spot) get a stronger shade (`.is-itm`).
- Open interest and volume cells draw a horizontal depth bar scaled to the chain maximum. Calls use red, puts use green.
- Volume heat is continuous: zero is hatched grey, low is faint, high is strong. Existing `.vol-high` / `.vol-low` / `.vol-zero` classes stay so tests can find them.
- Change is green or red with no plus sign. Cells still flash on tick.
- A spot marker row sits between the strikes that bracket the underlying and the board scrolls it to centre.
- The strike with the highest call open interest, the highest put open interest, and the largest absolute price change are marked as support / resistance.

**Check:** unit tests for highlight selection; Playwright sees `.is-itm`, `.depth-bar`, `.spot-marker`.

## 11. Motion and chrome

**Goal:** one token set and consistent controls.

- Tokens in `globals.css`: colour, space, radius, shadow, motion duration.
- Button variants: primary, ghost, icon, toggle, segmented. Hover, press, focus-visible, disabled.
- Framer Motion for the sheet, palette, and section collapse. CSS sheen and bar growth stay. `prefers-reduced-motion` disables decorative animation.
- Header tape scrolls index lasts across the width. Session pill pulses while the market is open. Latency stays on the feed chip.
- Summary cards: put/call ratio, max pain, call interest, put interest, at-the-money IV.
- Charts: open interest by strike, change in open interest, and a session put/call ratio trend accumulated on the client (the exchanges do not publish an intraday put/call ratio series).
- Toasts for stream loss, restore, and expiry changes. Column headers expose a tooltip.

**Check:** Playwright toast on expiry change; reduced-motion emulation reports no running animation on the open-interest fill.

## 12. Data pipeline

**Goal:** the same snapshot shape, with safer edges.

- NSE fetch already retries on 401/403/reset. Add a short backoff between attempts.
- Zod schema checks the chain snapshot before it is returned. A bad shape becomes a 502.
- Stream sends a full `chain` first, then a `patch` of changed strikes when a later pull differs. Heartbeat stays. The client falls back to polling if SSE errors.
- Calculations covered by unit tests: put/call ratio, max pain, at-the-money strike, days to expiry, weekly/monthly bucket, highlight strikes.
- Market phase still comes from the exchange status payload (open, pre-open, closed, holiday).
- Universe cache TTL stays 10 minutes. Tape quotes are a separate short-lived fetch and never block the book.
- Health already reports upstream latency. Snapshots keep `latencyMs`. The feed chip shows it.

**Check:** `npm test` and `npm run test:api`.

## 13. Extra tests

- Playwright: tree, palette keyboard, expiry groups, colour classes, spot marker, phone sheet, reduced motion, light/dark.
- Visual snapshots at 1440 and 390 in light and dark, with the live table and chart masked so ticks do not fail the diff.
- Backend unit tests for every calculation above. API smoke already covers health, universe, NIFTY, Anand Rathi Wealth, and SENSEX.

## Out of scope

- Live broker orders.
- Inventing a full-day put/call ratio history the exchange does not send. The trend is the session the desk has observed.
- Hardcoding the index list. If an exchange omits a name, it is omitted.
