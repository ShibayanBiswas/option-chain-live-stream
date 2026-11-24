# Testing

## Unit

```bash
npm test
```

Node’s built-in test runner (with TypeScript strip types) covers:

- Focus vs full column sets and put-side mirroring (`columns.test.ts`)
- Signed formatting without plus signs (`format.test.ts`)
- Wealth equity symbol lock (`universe.test.ts`)

## API smoke

With the app running on port 3000:

```bash
npm run test:api
```

Probes `/api/health`, `/api/universe` (indices present, equities = ANANDRATHI only), NIFTY chain, Anand Rathi Wealth NSE chain, and SENSEX when BSE is reachable.

## Playwright

```bash
npm run build
npm run start
npm run test:e2e
```

Projects: desktop 1440, laptop 1280, tablet 768, phone 390, phone-narrow 360.

Coverage includes live feed / motion, focus vs full density for chain and OI, zero-volume shading, sidebar toggle, full-width chrome, magnify, light/dark, mobile collapsed rail, index list presence, and Anand Rathi Wealth as the only equity.

Screenshots land in `docs/screenshots/`.

## Production gates

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:api
npm run test:e2e
```

All of the above must pass before merge.
