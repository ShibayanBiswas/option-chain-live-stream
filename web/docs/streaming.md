# Streaming

## Snapshot

`GET /api/chain?symbol=NIFTY&exchange=NSE&segment=INDEX&expiry=01-Dec-2026`

Returns spot, expiries, rows, put-call ratio, max pain, at-the-money strike, latency, session, and `feed`.

## Live channel

`GET /api/stream` uses server-sent events.

| Event | Payload |
| --- | --- |
| `chain` | Full snapshot. `feed` is `rest` until a websocket tick lands, then `websocket` |
| `socket` | `open`, `closed`, or `error` |
| `end` | The function is rotating; the browser opens a new stream |
| `error` | Message only |

The socket is the same address the exchange page uses. While the cash session is closed the streamer accepts the connection and then closes it, and the desk keeps publishing the REST book. During the session, ticks patch the open chain and the toolbar reads WebSocket.

NSE websocket URL:

`wss://streamer.nseindia.com/streams/fo/mbp?symbol={symbol}&expiry={expiry}`

Origin is `https://www.nseindia.com`. Frames are JSON with `strikePrice`, `CE`, and `PE`. The server patches the matching strike and pushes the snapshot again. A REST refresh every four seconds recomputes totals so a quiet socket cannot freeze open interest.

BSE has no public tick socket on this desk. Those names refresh from the derivatives chain endpoint on the same stream interval.

## Latency

`latencyMs` is the time to build the REST snapshot on the server. Websocket patches set it to zero because the frame is applied in memory. The toolbar shows the latest figure.
