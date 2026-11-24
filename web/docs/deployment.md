# Deployment

The Vercel project root is this `web` directory. `vercel.json` pins the functions to Mumbai (`bom1`) and sends `Cache-Control: no-store` on `/api/*`. Routes use the Node.js runtime. Streaming does not need the edge runtime.

A pull request opened against `main` builds a preview deployment when the GitHub repository is connected to Vercel, which it is. Merging that pull request to `main` promotes the production deployment when the project's production branch is `main` and automatic production deployments are on. Confirm both on the project's Git settings if a merge does not deploy.

After a deploy, open the URL and repeat the click path in [testing.md](./testing.md) on a laptop and a phone. `/api/health` should return `ok: true` with a session phase. `/api/universe` should list the index book and only Anand Rathi Wealth under equities. A NIFTY chain and a SENSEX chain should return rows.

Exchange calls can be rate-limited. The server retries and then serves the last snapshot for up to a minute. The health route reports how many chain entries are cached and how old the oldest one is.
