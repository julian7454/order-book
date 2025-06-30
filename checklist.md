Task:

- Show max 8 quotes for both buy and sell.
- Quote total formula:
    - Sell quotes: sum up quote size from lowest price quote to the highest
    - Buy quotes: sum up quote size from highest price quote to the lowest
- Accumulative total size percentage bar formula:
    - Current quote accumulative total size / Total quote size of buy or sell.
- The first response received will be a snapshot of the current order book (this is indicated in the type field with value snapshot) Incremental updates will be sent in subsequent packets with type delta .
- Re-subscribe topic to get new snapshot if prevSeqNum of new data doesn’t match last data’s seqNum.
- The size sent will be the new updated size for the price.
- If a value of 0 is sent, the price should be removed from the local copy of the orderbook.
- If crossed orderbook ever occurs when the best bid higher or equal to the best ask, please unsubscribe and re-subscribe to the topic again.

Styles:

- Format number with commas as thousands separators.
- Add hover background color on whole row when mouse hover on the quote.
- Last price color style:
    - If current last price > previous last price: `#00b15d` for text color, `rgba(16, 186, 104, 0.12)` for background color
    - If current last price < previous last price: `#FF5B5A` for text color, `rgba(255, 90, 90, 0.12)` for background color
    - If price is the same: `#F0F4F8` for text color , `rgba(134, 152, 170, 0.12)` for background color
- Quote highlight animation:
    - When new quote appear(price hasn't shown on the order book before), add highlight animation on whole quote row. Red background color for sell quote. Green background color for buy quote.
    - When quote size change, add highlight animation on size cell. Green background color if size increase. Red background color if size decrease.

Colors:

- Background color: #131B29
- Default text color: #F0F4F8
- Quote table head text color: #8698aa
- Buy quote price text color: #00b15d
- Sell quote price text color: #FF5B5A
- Quote row hover background color: #1E3059
- Buy quote accumulative total size bar color: rgba(16, 186, 104, 0.12)
- Sell quote accumulative total size bar color: rgba(255, 90, 90, 0.12)
- Animation flash green background color: rgba(0, 177, 93, 0.5)
- Animation flash red background color: rgba(255, 91, 90, 0.5)
