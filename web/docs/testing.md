# Testing

## Local

```bash
cd web
npm install
npx playwright install chromium
npm run typecheck
npm run build
npm run start
npm run verify:accuracy
npm run test:e2e
```

`verify:accuracy` checks sorted strikes, expiry membership, open-interest totals, and put-call ratio against the rows for Nifty, Bank Nifty, Fin Nifty, Reliance, and Sensex.

`test:e2e` runs Playwright against the local server on desktop, tablet, and phone. It checks:

- live book load and Market Open / Market Closed
- Spot Focus and Entire Book
- zero-volume shading plus high and low volume marks
- Last and Change sitting against the strike
- quote sheet open and close
- magnify mode
- open-interest motion and price-flash animation
- equity search for Anand Rathi
- light and dark theme
- stream channel events
- no page overflow and chain scrolling inside the desk

## What to click

1. Indexes, then Equities. Confirm the list changes and search finds a live symbol such as the wealth name returned by the exchange book.
2. Switch NSE and BSE. BSE indexes must load a chain.
3. Change expiry from the dropdown and confirm the strike book changes.
4. Switch Spot Focus and Entire Book.
5. Toggle Magnify. The rail should collapse and the desk should enlarge.
6. Click a strike. The quote sheet opens and closes.
7. Toggle dark mode. Gold, ink, and the chain must stay readable.
8. Watch the feed chip. During the cash session it should read WebSocket after the socket opens. Outside the session the socket stays quiet while the snapshot still loads.

## Session

`/api/health` returns the exchange status string. The toolbar must say Market Open only when that status is open, and Market Closed otherwise.

## Production

After deploy, open the Vercel URL and repeat the click path above on a laptop and a phone. Confirm `/api/health`, `/api/universe`, and a Nifty chain load without protection walls.
