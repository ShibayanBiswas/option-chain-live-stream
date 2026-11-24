# Option Chain Live Stream

Anand Rathi Wealth desk — live NSE / BSE option-chain streaming for Indian indexes (Nifty, Sensex, Bank Nifty, …) and equity F&O.

## Stack

- Next.js 15 (App Router) · TypeScript · Tailwind · Framer Motion
- NSE `option-chain-v3` + contract-info (cookie-primed server proxy)
- BSE Derivatives Option Chain API (Sensex / Bankex / SX50)
- SSE live stream (`/api/stream`) with REST fallback polling
- UI language aligned with **Primary SP Dashboard** (gold / maroon ARW brand)

## Features

- Continuous low-latency chain refresh with flash animations on ticks
- Expiry selector for every underlying
- PCR · Max Pain · ATM · Call/Put OI KPIs
- Auto-hides empty Bid / Ask / Bid Qty / Ask Qty / Chng columns
- Dark / light theme · mobile-friendly horizontal chain scroll

## Local

```bash
npm install
npm run dev
```

Open http://localhost:3000

```bash
npm run build
npm run start
npm run verify:accuracy   # with server running
```

## Deploy (Vercel)

Root directory: `web`  
Region: `bom1` (Mumbai)

```bash
npx vercel --prod
```

> **Note:** BSE’s Akamai edge often blocks non-browser cloud IPs. NSE indexes/equities stream from Vercel reliably. Sensex/Bankex work when the host can reach `api.bseindia.com` (local browser-class network or India VPS bridge).
