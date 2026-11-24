# Architecture

Next.js 15 App Router desk in `web/`, deployed on Vercel as **option-chain-live-stream**.

## Layers

| Layer | Role |
| --- | --- |
| `src/app/page.tsx` | Shell that mounts the terminal |
| `src/components/terminal.tsx` | Desk chrome: sidebar, toolbar, KPIs, magnify, theme |
| `src/components/option-chain-table.tsx` | Calls \| Strike \| Puts board with focus/full density |
| `src/components/oi-chart.tsx` | Animated open-interest pressure chart |
| `src/components/quote-sheet.tsx` | Strike detail sheet |
| `src/hooks/use-option-stream.ts` | SSE client with REST fallback |
| `src/lib/chain-service.ts` | Resolves instrument → NSE/BSE snapshot |
| `src/lib/universe.ts` | Dynamic indices + Anand Rathi Wealth equity lock |
| `src/lib/nse.ts` / `bse.ts` / `nse-ws.ts` | Exchange transports |
| `src/app/api/*` | Universe, chain, stream, health, meta |

## Data path

1. Browser loads `/api/universe` once.
2. Selecting a contract opens `/api/stream` (SSE). The server pushes `chain` snapshots and, when the NSE market is open, mirrors WebSocket ticks.
3. REST `/api/chain` remains available for one-shot refresh and smoke tests.

## Density model

- **Focus Columns** (default): open interest, volume, IV, change, last — the metrics that sit against the strike.
- **All Columns**: every non-empty book field, including interest change and bid/ask when the exchange publishes them.
- **Spot Focus / Entire Book**: strike window around ATM versus the full ladder (no “ATM ±N” labels).

## Layout rules

- Full-bleed terminal grid (sidebar + stage). No centered `max-width` gutters.
- Sidebar toggle is a floating control that never sits on top of table cells.
- Magnify collapses the rail, enlarges the board and OI chart, and restores the prior rail state on exit.
- Scrollbars are visually hidden; scroll still works inside the chain and OI panes.

## Theme

Light and dark tokens live in `globals.css`. The theme toggle flips `html.dark`.
