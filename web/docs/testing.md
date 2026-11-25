# Testing

From `web/`:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Unit tests cover column sets, expiry cutoff, session text, the Anand Rathi filter, Greeks, and the stream rule that an unchanged book sends no second chain.

## API

Start the app, then:

```bash
npm run test:api
npm run verify:accuracy
```

`test:api` checks health, the discovered index list (NIFTY and SENSEX must be present, equities must be Anand Rathi Wealth only), a live NIFTY chain with an unexpired expiry and an IST timestamp, the Anand Rathi Wealth chain, and SENSEX when BSE answers.

`verify:accuracy` compares the desk with the exchange for the contracts it can reach. A BSE block is reported as the cached book, not as a live print.

## Browser

```bash
npm run build
npm run start
npm run test:e2e
```

Projects: desktop 1440, laptop 1280, tablet 768, phone 390, phone-narrow 360.

The chain test checks one header row, no gap between the call last price and the strike, no spot-marker row, and no strike badges.
