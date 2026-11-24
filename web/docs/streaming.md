# Streaming

## Transport

The desk prefers Server-Sent Events from `/api/stream`.

1. Initial snapshot from the chain service (NSE curl jar or BSE JSON).
2. While NSE capital market status is **open**, the server attaches to `wss://streamer.nseindia.com/streams/fo/mbp` and merges depth ticks into the book.
3. Heartbeats keep the SSE channel alive. Clients reconnect on expiry or symbol change.

Outside open hours (pre-open, closed, holiday) the stream still delivers REST snapshots; socket events are not expected.

## Latency

Each snapshot carries `latencyMs` from upstream fetch start to response. The toolbar feed chip shows Live / WebSocket / Rest and that latency. Accuracy checks live in `npm run verify:accuracy` and compare desk values to exchange pages when reachable.

## Failure modes

| Condition | Behaviour |
| --- | --- |
| NSE Node fetch blocked | Curl cookie jar transport |
| BSE 403 on edge | Cached index underlyings; equity SO probe skipped |
| Upstream timeout | 502 with a public error string |
| Rate pressure | In-memory universe TTL (10 minutes) reduces discovery chatter |
