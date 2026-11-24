# Testing

## Unit and API

```bash
cd web
npm test
```

Vitest covers put-call ratio, max pain, at-the-money, implied volatility, Black-Scholes delta, day count, weekly and monthly grouping, collapsed and expanded columns, depth bars, volume heat, chain diffs, the chain cache, session phase, the Anand Rathi filter, zod validation, and every API route including a missing symbol, an upstream 429, and the event stream.

## Browser

```bash
npx playwright install chromium
npm run build
npm run start
npm run test:e2e
```

Playwright runs against the local server on desktop 1440, laptop 1280, tablet 768, phone 390, and phone 360.

The fixture suite checks:

- collapsed and expanded column sets for the chain and the open-interest panel
- in-the-money colour, depth bars, volume heat, the spot marker, and the call and put walls
- no gap between adjacent chain cells
- sidebar toggle, full-width header, magnify, and theme
- instrument sections, keyboard movement, and the command palette
- expiry groups
- the mobile bottom sheet, 44px dock targets, and no page overflow
- reduced motion
- light and dark screenshots at each width

`e2e/live.spec.ts` runs on desktop against the exchanges. It checks that the index book includes NIFTY, BANKNIFTY, and SENSEX, that every equity is Anand Rathi Wealth, that NIFTY and SENSEX chains return rows, and that the stream emits a chain event.

## Accuracy

With the server running:

```bash
npm run verify:accuracy
```

The script walks every index from `/api/universe` and every Anand Rathi Wealth listing. It checks sorted strikes, expiry membership, open-interest totals, and put-call ratio, and prints server latency and end-to-end latency.

## Session

`/api/health` returns the exchange status and phase. The toolbar says Market Open only when that phase is open, Pre-Open during pre-open, Market Holiday when the exchange text says holiday, and Market Closed otherwise.
