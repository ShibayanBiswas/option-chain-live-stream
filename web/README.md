# Option Chain Live Stream

Anand Rathi Wealth derivatives desk for NSE and BSE. Indexes and equities are loaded from the exchanges. The chain streams over server-sent events, and NSE names also merge the exchange websocket. The desk is full width, Spot Focus or Entire Book, with magnify and an animated Strike Pressure open-interest panel.

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
