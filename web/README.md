# Option Chain Live Stream

Anand Rathi Wealth derivatives desk. Indices are every NSE and BSE name the exchanges publish for options. Equity is only Anand Rathi Wealth, on NSE and on BSE when the exchange lists it. The chain streams over server-sent events, and NSE names also merge the exchange websocket while the session is open.

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
npm run verify:accuracy
npm run test:e2e
```

## Docs

- [UI plan](./docs/UI_PLAN.md)
- [Architecture](./docs/architecture.md)
- [Universe](./docs/universe.md)
- [Streaming](./docs/streaming.md)
- [Interface](./docs/interface.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)

## Deploy

Vercel project root is this `web` directory. Region intent is Mumbai (`bom1`).
