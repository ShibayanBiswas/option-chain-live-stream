# Interface

The terminal is one full-width trading desk. There are no secondary product tabs.

## Layout

The viewport is locked to the desk. The page itself does not scroll. The left rail, toolbar, open-interest panel, and option chain share the full horizontal width. Scrollbars are hidden; panels still scroll with trackpad or touch.

## Sidebar

- Indexes or Equities
- Both exchanges, NSE, or BSE
- Search
- The contract list is the live book from `/api/universe`

On phones and tablets the rail collapses into a horizontal chip strip so symbols stay reachable without eating the chain.

## Toolbar

- Sidebar toggle
- Selected symbol and spot
- Session pill from the exchange status
- Expiry dropdown
- View dropdown: **Spot Focus** or **Entire Book**
- Feed chip: WebSocket when ticks are merging, otherwise Live or Rest, plus the last snapshot latency
- Magnify, refresh, and theme

### Spot Focus and Entire Book

Spot Focus centres the chain on the at-the-money strike and keeps a tight window around spot. Entire Book shows every listed strike. The labels never mention plus or minus windows.

### Magnify

Magnify enlarges the stage, deepens the open-interest window, and enlarges the chain type so the desk reads like a professional chart board. Magnify also collapses the rail so the book can use the full width.

## Key figures

Put Call Ratio, Max Pain, Call Interest, Put Interest, and At the Money sit in one row across the desk.

## Open interest

The Strike Pressure panel is a mirrored call and put histogram. Bars spring in, the spot row is washed in gold, and a soft sheen runs across the panel. Call bars grow toward the centre from the left. Put bars grow toward the centre from the right.

## Chain

Calls sit on the left. Puts sit on the right. The strike column is centred.

### Column order

Important quote columns sit against the strike. Quiet book columns sit farther away.

Call side, reading toward the strike:

Open Interest → Interest Change → Volume → IV → Bid Quantity → Bid → Ask → Ask Quantity → Change → Last → Strike

Put side mirrors that order so Last sits against the strike on both sides.

Empty bid and ask columns stay hidden when the whole book has no quotes.

### Volume heat

- Gold wash on Last: high traded volume
- Blue wash on Last: low traded volume among strikes that actually traded
- Grey shade: no volume on that side, or on the whole strike when both sides are quiet

A price tick flashes green or red.

Click a strike to open the quote sheet. The sheet only renders fields that have a value. On phones the sheet rises from the bottom of the screen.

## Themes

Light is the default. Dark is stored in `option-chain-live-theme` and applied before paint so the first frame matches the last choice.
