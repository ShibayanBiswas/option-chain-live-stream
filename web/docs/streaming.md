# Streaming

## Transport

`/api/stream` is server-sent events.

1. The first event is `chain`.
2. A changed strike is a `patch`. An unchanged book sends nothing.
3. `heartbeat` every 10 seconds carries the session and latency.
4. `rotate` fires before the 60 second function limit, and the client reconnects.
5. Event ids increase. The browser is told `retry: 3000`.

While the market is open the stream asks the exchange again every 500ms and reuses a chain younger than 400ms. While the market is closed the server keeps the chain it already sent and checks the session about once a minute.

The NSE websocket `wss://streamer.nseindia.com/streams/fo/mbp` was removed. It was never observed during market hours. The feed is REST polling.

## Client

`use-option-stream.ts` retries SSE at 1, 2, 4 and 8 seconds, capped at 30 seconds. After three failures it polls, then tries SSE again after 60 seconds. A hidden tab pauses the stream. Twenty seconds without a heartbeat marks the chip Stale.

## Latency

`latencyMs` is the exchange request time. The chip shows that number. It says REST, Closed, Delayed, Waiting, Connecting, or Stale. It never shows Live while the session is closed, and a cached BSE book shows Delayed.
