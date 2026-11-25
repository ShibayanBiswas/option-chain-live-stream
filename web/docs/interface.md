# Interface

## Navigation

The sidebar has Indices and Equity, then NSE and BSE. Pins and the last contract stay in the browser. Search, or Ctrl/Cmd+K, opens the same list. Back closes search, the strike sheet, and the phone list.

The expiry menu groups Weekly and Monthly and shows the days left. Past expiries are hidden.

## Header

The header spans the width of the desk, above the sidebar. It opens on Custom. Option Chain is the single-expiry book. Updates on Custom explains the board. Updates on Option Chain opens the volume key. The feed chip says REST, Closed, Delayed, Waiting, Connecting, or Stale. It does not say Live while the market is closed.

Custom uses the same Calls, Strike and Puts layout, the same price and change format, the spot line, and Jump to spot. Each column is one upcoming expiry. The count runs from one expiry through every live expiry. The nearest expiry sits against the strike.

## Option chain

One table. The top header row reads Calls, then the strike column, then Puts. The row under it is the column names, with one Strike heading. The last price sits against the strike. There is no gap between that last-price cell and the strike. A gold line between the two strikes around the live price reads Spot, and the at-the-money strike is outlined.

The columns read toward the strike: Bid Quantity, Bid, Ask, Ask Quantity, Vega, Gamma, Theta, Delta, IV, Volume, OI Change, OI, % Change, Change, LTP. Bid and ask columns appear when the book has a quote. Greeks appear in All Columns. When that book is wider than the screen, the strike stays fixed and the call and put columns scroll inward, with the last price against the strike. Focus shows Volume, OI Change, OI, Change and LTP. A phone in Focus shows OI and LTP. Every screen starts on Custom and Spot Focus.

Gold is high volume, blue is low volume, grey is zero volume. A green flash is a higher print and a red flash is a lower print. There is no gold line under a round strike. Clicking a strike opens a card with Calls on one side and Puts on the other.

Spot Focus keeps the 18 strikes below the at-the-money strike and the 18 above it. All Strikes shows the whole book. Strike numbers sit in the centre of the column. Premiums, bids, asks, changes and the spot show two decimals. A real zero is `0.00`. A missing value is an em dash. Open interest and volume stay in lakh and crore. Jump to spot scrolls Custom and the option chain. The page itself does not scroll.

The feed chip reads the exchange timestamp: `Updated HH:MM:SS IST · Ns ago`. It turns amber after 45 seconds while the market is open and red after 120 seconds. The tooltip keeps the fetch time. The label is an exchange snapshot that refreshes about every 30 seconds.

## Mobile

Focus fits the width. On a phone the chain fills the screen under a header that wraps, so the contract, feed, session, and every menu are fully visible. Jump to spot sits under the book, so it does not cover a price. The summary tiles stay off that screen. The strike stays in the row. When Custom has more expiries than fit, or Option Chain is on All Columns, the strike column stays fixed in the centre. Call columns scroll on the left and put columns on the right, starting with the nearest column against the strike. The contract list opens from the header and closes with Back.
