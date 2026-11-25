# Option Chain Live Stream

Anand Rathi Wealth desk for every NSE and BSE index that lists options, especially NIFTY and SENSEX. Equity is only Anand Rathi Wealth. The chain is one table: calls, one strike column, puts. Quotes arrive by server-sent events from the exchange REST feeds.

## Run

```bash
npm install
npm test
npm run typecheck
npm run build
npm run start
```

Open http://localhost:3000

With the server running:

```bash
npm run test:api
npm run verify:accuracy
```

## Docs

- [Architecture](./docs/architecture.md)
- [Universe](./docs/universe.md)
- [Streaming](./docs/streaming.md)
- [Interface](./docs/interface.md)
- [Testing](./docs/testing.md)

## Deploy

Vercel project root is this `web` directory. Region is Mumbai (`bom1`). Merging to `main` deploys production.
