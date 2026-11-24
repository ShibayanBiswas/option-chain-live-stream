# Option Chain Live Stream

Anand Rathi Wealth derivatives desk for NSE NIFTY, BSE SENSEX, and ANANDRATHI. The chain streams over server-sent events, and NSE names also merge the exchange websocket when the market is open. The desk is the summary strip and the option chain: Spot Focus or Entire Book, Focus or All Columns.

## Run

```bash
npm install
npm run typecheck
npm run build
npm run start
```

Open http://localhost:3000

With the server running:

```bash
npm run verify:accuracy
```

## Docs

- [Architecture](./docs/architecture.md)
- [Universe](./docs/universe.md)
- [Streaming](./docs/streaming.md)
- [Interface](./docs/interface.md)
- [Testing](./docs/testing.md)

## Deploy

Vercel project root is this `web` directory. Region intent is Mumbai (`bom1`).
