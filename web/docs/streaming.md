# Streaming

## Transport

`/api/stream` is server-sent events.

1. The first `heartbeat` is sent after the first snapshot, then again every 10 seconds. It carries the session from that snapshot. A heartbeat does not move the data-age clock.
2. The first book is `chain`.
3. A changed cell is a `patch` of `[strike, side, field, value]` tuples. An unchanged book sends nothing.
4. Custom view uses `/api/stream/multi` for the extra expiries. Each frame is last price and change only, then a cell patch. It does not poll `/api/chain`.
5. `rotate` fires before the 60 second function limit, and the client reconnects.
6. Event ids increase. The browser is told `retry: 3000`. A client ignores an id older than the last one it applied.

While the market is open the stream asks the exchange again every 500ms when the exchange timestamp moved, and waits 3 seconds when it did not. A chain younger than 400ms is reused. While the market is closed the server keeps the chain it already sent and checks the session about once a minute. BSE uses the same 09:15–15:30 IST derivatives session when its payload has no market-status field.

NSE prices use `wss://streamer.nseindia.com/streams/fo/mbp`. On 25 Nov 2026, during market hours, that socket completed the handshake and sent a few hundred frames in about 12 seconds, with the timestamp moving every second. A frame carries the last price, change, bid, ask and volume. It does not carry open interest or IV, so those still come from the option-chain API about every 30 seconds. If the socket sends nothing, the stream falls back to that API. BSE has no equivalent socket here, so SENSEX stays on the BSE chain API. The chip says WebSocket only after a frame has updated the book.

## Client

`use-option-stream.ts` retries SSE at 1, 2 and 4 seconds. After the third failure it polls at 1.5s, then 3s, then 6s, and it keeps trying SSE every 15 seconds. A chain, patch, or heartbeat resets the failure count and stops the poll. Ten seconds without a stream event sets the status to error and the desk shows "Connection lost · retrying". A hidden tab pauses the stream; showing it again refetches the chain and reconnects. Twenty seconds without a heartbeat marks the chip Stale. A heartbeat does not change the data-age clock.

## Latency

`latencyMs` is the exchange request time. It stays in the chip tooltip and in `/api/health`. The chip itself shows the exchange time and how long ago that snapshot was. It says REST, Closed, Delayed, Waiting, Connecting, or Stale. It never says Live, and a cached BSE book shows Delayed. `/api/health` also returns `commit`, the Vercel git sha when the deployment has one.
