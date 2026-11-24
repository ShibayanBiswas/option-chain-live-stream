# Streaming

## Snapshot

`GET /api/chain?symbol=NIFTY&exchange=NSE&segment=INDEX&expiry=26-Nov-2026`

Returns spot, expiries, rows, put-call ratio, max pain, at-the-money strike, at-the-money IV, open-interest change, latency, feed, and the put-call ratio series gathered in this server process.

`GET /api/oi` returns the same book reduced to open interest and the change in open interest per strike.

## Live channel

`GET /api/stream` uses server-sent events.

| Event | Payload |
| --- | --- |
| `chain` | Full snapshot. Sent on the first pull, and again when a refresh changes no strikes |
| `patch` | The strikes whose quotes changed, plus totals, spot, and feed |
| `socket` | `open`, `closed`, or `error` |
| `notice` | A short feed message |
| `end` | The function is rotating. The browser opens a new stream |
| heartbeat | A comment line every eight seconds |

The socket is the same address the exchange page uses. It opens only while the session phase is open. Outside that phase the streamer stays closed and the desk keeps publishing the REST book. During the session, ticks patch the open chain and the toolbar reads WebSocket.

NSE websocket URL:

`wss://streamer.nseindia.com/streams/fo/mbp?symbol={symbol}&expiry={expiry}`

Origin is `https://www.nseindia.com`. Frames are JSON with `strikePrice`, `CE`, and `PE`. The server patches the matching strike, recomputes totals, and pushes a patch. A REST refresh every four seconds keeps open interest aligned with the exchange.

BSE has no public tick socket on this desk. Those names refresh from the derivatives chain on the same interval.

If the browser cannot hold the event stream it polls `/api/chain` every 1.5 seconds.

## Latency

`latencyMs` on a snapshot is the time to build the REST book on the server. Websocket patches set it to zero because the frame is applied in memory. The toolbar shows the latest figure. End-to-end time, from the desk request to the response, is what `scripts/verify-accuracy.mjs` prints as `e2e`.

## Cache and rate limits

Identical chain requests are reused for two seconds. Exchange GETs retry on 429, 502, and 503 with backoff. If the upstream still fails, a snapshot from the last minute is returned with `stale: true` and the desk toasts `Feed interrupted`. A later live snapshot toasts `Feed restored`.
