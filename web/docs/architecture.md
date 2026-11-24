# Architecture

Next.js 15 App Router desk in `web/`, deployed on Vercel as **option-chain-live-stream**.

## Layers

| Layer | Role |
| --- | --- |
| `src/app/page.tsx` | Shell that mounts the terminal |
| `src/components/terminal.tsx` | Desk chrome: sidebar, toolbar, KPIs, live chip, theme |
| `src/components/option-chain-table.tsx` | Calls \| Strike \| Puts board with focus/full density |
| `src/components/quote-sheet.tsx` | Strike detail sheet |
| `src/hooks/use-option-stream.ts` | SSE client with REST fallback |
| `src/lib/chain-service.ts` | Resolves instrument → NSE/BSE snapshot |
| `src/lib/universe.ts` | Every discovered index, equity limited to Anand Rathi Wealth |
| `src/lib/nse.ts` / `bse.ts` | Exchange transports. The unverified NSE websocket client was removed |
| `src/app/api/*` | Universe, chain, stream, tape, health |

## Data path

1. Browser loads `/api/universe`, then refreshes the session every 60 seconds.
2. Selecting a contract opens `/api/stream`. The server sends one `chain`, then `patch` events for changed strikes and a `heartbeat` every 10 seconds. While the market is closed it does not poll the book every few seconds. The stream rotates before the 60 second function limit.
3. There is no websocket feed. Live ticks on `wss://streamer.nseindia.com/streams/fo/mbp` have not been captured during market hours, so the chip says REST, Closed, or Delayed.
4. A bundled BSE snapshot is served only when BSE blocks the request, and it is marked `stale`.
5. The chain cache and the PCR series are in memory on each function instance. They do not survive a cold start.

## Density model

- **Focus** (default): OI, Volume, IV, Chng, LTP against the strike.
- **All Columns**: every non-empty book field, including interest change and bid/ask when the exchange publishes them.
- **Spot Focus / Entire Book**: strike window around ATM versus the full ladder (no “ATM ±N” labels).

## Layout rules

- Full-bleed terminal grid (sidebar + stage). No centered `max-width` gutters.
- The sidebar button sits in the toolbar.
- Scrollbars are hidden. On a phone, Focus fits the width and All Columns scrolls inside the chain. The strike stays in its row.

## Theme

Light and dark tokens live in `globals.css`. The theme toggle flips `html.dark`.
