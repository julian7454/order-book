<script setup lang="ts">
import { ref, computed } from 'vue';
import OrderBookQuotes from './components/OrderBookQuotes.vue';
import IconArrowDown from './components/IconArrowDown.vue';

type Level = {
    price: string;
    size: string;
    total: number;
    percent?: number;
};

type RawLevel = [string, string];

type OrderBook = {
    bids: Level[];
    asks: Level[];
};

type OrderbookData = {
    data: {
        bids: RawLevel[];
        asks: RawLevel[];
        seqNum: number;
        prevSeqNum: number;
        type: string;
    };
};

type HighlightInfo = {
    newPrice?: boolean;
    sizeChanged?: 'up' | 'down';
};

type HighlightMap = Record<string, HighlightInfo>;

type TradeHistory = {
    price: number;
};

const orderBookSocket = new WebSocket('wss://ws.btse.com/ws/oss/futures');
const lastPriceSocket = new WebSocket('wss://ws.btse.com/ws/futures');
let lastSeqNum: number | null = null;

const orderBook = ref<OrderBook>({ bids: [], asks: [] });
const bidHighlights = ref<HighlightMap>({});
const askHighlights = ref<HighlightMap>({});
const lastPrice = ref<number | null>(null);
const prevPrice = ref<number | null>(null);

const lastPriceArrowColor = computed(() => {
    if (prevPrice.value === null || lastPrice.value === null) return '';
    if (lastPrice.value > prevPrice.value) return 'var(--color-bullish)';
    if (lastPrice.value < prevPrice.value) return 'var(--color-bearish)';
    return '';
});

const lastPriceClass = computed(() => {
    if (prevPrice.value === null || lastPrice.value === null) {
        return {
            color: 'var(--color-text-primary)',
            backgroundColor: 'var(--color-neutral-bg)',
        };
    }
    if (lastPrice.value > prevPrice.value) {
        return {
            color: 'var(--color-bullish)',
            backgroundColor: 'var(--color-bullish-bg)',
        };
    } else if (lastPrice.value < prevPrice.value) {
        return {
            color: 'var(--color-bearish)',
            backgroundColor: 'var(--color-bearish-bg)',
        };
    }
    return {
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-neutral-bg)',
    };
});

function detectHighlightChanges(oldLevels: Level[], newLevels: Level[]): HighlightMap {
    const oldMap = new Map(oldLevels.map((l) => [l.price, Number(l.size)]));
    const result: HighlightMap = {};

    for (const level of newLevels) {
        const oldSize = oldMap.get(level.price);
        const size = Number(level.size);
        if (oldSize === undefined) {
            result[level.price] = { newPrice: true };
        } else if (size > oldSize) {
            result[level.price] = { sizeChanged: 'up' };
        } else if (size < oldSize) {
            result[level.price] = { sizeChanged: 'down' };
        }
    }

    return result;
}

function sortAndTrim(levels: RawLevel[], sort: 'asc' | 'desc'): RawLevel[] {
    return levels
        .slice()
        .sort(([p1], [p2]) => (sort === 'desc' ? Number(p2) - Number(p1) : Number(p1) - Number(p2)))
        .slice(0, 8);
}

function addQuoteTotal(levels: RawLevel[]): Level[] {
    let cumulative = 0;
    return levels.map(([price, size]) => {
        cumulative += Number(size);
        return { price, size, total: cumulative };
    });
}

function addPercent(levels: Level[]): Level[] {
    const totalSize = levels.length ? levels[levels.length - 1].total : 0;
    return levels.map((level) => ({
        ...level,
        percent: totalSize ? level.total / totalSize : 0,
    }));
}

function addTotalsAndPercents(levels: RawLevel[]): Level[] {
    const withTotal = addQuoteTotal(levels);
    const withPercent = addPercent(withTotal);
    return withPercent;
}

function updateLevelsWithDelta(
    oldLevels: Level[],
    deltaLevels: RawLevel[],
    sort: 'asc' | 'desc',
): RawLevel[] {
    const map = new Map<string, string>();

    for (const { price, size } of oldLevels) {
        map.set(price, size);
    }

    for (const [price, size] of deltaLevels) {
        if (Number(size) === 0) {
            map.delete(price);
        } else {
            map.set(price, size);
        }
    }

    return sortAndTrim(Array.from(map.entries()), sort);
}

function processSnapshot(raw: OrderbookData): OrderBook {
    return {
        bids: addTotalsAndPercents(sortAndTrim(raw.data.bids, 'desc')),
        asks: addTotalsAndPercents(sortAndTrim(raw.data.asks, 'asc')),
    };
}

function applyDelta(orderBook: OrderBook, raw: OrderbookData): OrderBook {
    const { data } = raw;
    const bidsMerged = updateLevelsWithDelta(orderBook.bids, data.bids, 'desc');
    const asksMerged = updateLevelsWithDelta(orderBook.asks, data.asks, 'asc');
    return {
        bids: addTotalsAndPercents(bidsMerged),
        asks: addTotalsAndPercents(asksMerged),
    };
}

function hasCrossedOrderBook(orderBook: OrderBook): boolean {
    const bestBid = orderBook.bids?.[0]?.price;
    const bestAsk = orderBook.asks?.[0]?.price;

    if (!bestBid || !bestAsk) return false;

    return Number(bestBid) >= Number(bestAsk);
}

function resubscribe(socket: WebSocket): void {
    socket.send(JSON.stringify({ op: 'unsubscribe', args: ['update:BTCPFC'] }));
    socket.send(JSON.stringify({ op: 'subscribe', args: ['update:BTCPFC'] }));
}

orderBookSocket.onopen = () => {
    console.log('WebSocket connected');

    const payload = {
        op: 'subscribe',
        args: ['update:BTCPFC'],
    };

    orderBookSocket.send(JSON.stringify(payload));
};

lastPriceSocket.onopen = () => {
    lastPriceSocket.send(
        JSON.stringify({
            op: 'subscribe',
            args: ['tradeHistoryApi:BTCPFC'],
        }),
    );
};

orderBookSocket.onmessage = (event: MessageEvent) => {
    const raw: OrderbookData = JSON.parse(event.data);
    const data = raw.data;

    if (!data) return;

    if (data.type === 'snapshot') {
        orderBook.value = processSnapshot(raw);
        lastSeqNum = data.seqNum;
    }
    if (data.type === 'delta') {
        if (data.prevSeqNum !== lastSeqNum) {
            resubscribe(orderBookSocket);
            return;
        }

        const newOrderBook: OrderBook = applyDelta(orderBook.value, raw);

        requestAnimationFrame(() => {
            bidHighlights.value = detectHighlightChanges(orderBook.value.bids, newOrderBook.bids);
            askHighlights.value = detectHighlightChanges(orderBook.value.asks, newOrderBook.asks);
            orderBook.value = newOrderBook;
        });

        lastSeqNum = data.seqNum;

        if (hasCrossedOrderBook(orderBook.value)) {
            resubscribe(orderBookSocket);
        }
    }
};

lastPriceSocket.onmessage = (event) => {
    const raw = JSON.parse(event.data);
    const trades: TradeHistory[] = raw?.data;

    if (trades.length > 0) {
        const newPrice = trades[0].price;

        if (lastPrice.value !== null) {
            prevPrice.value = lastPrice.value;
        }
        requestAnimationFrame(() => {
            lastPrice.value = newPrice;
        });
    }
};
</script>

<template>
    <div class="max-w-2xl mx-auto rounded-lg font-mono bg-bg-primary text-text-primary">
        <h1 class="pl-4 py-2 text-2xl font-semibold text-text-primary border-b-1 border-gray-600">
            Order Book
        </h1>
        <div class="overflow-hidden rounded-lg">
            <table class="w-full border-collapse text-sm table-fixed text-right">
                <thead>
                    <tr class="font-semibold text-text-secondary">
                        <th class="p-3 text-left">Price (USD)</th>
                        <th class="p-3">Size</th>
                        <th class="p-3">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Sell quotes (asks) -->
                    <OrderBookQuotes
                        v-if="orderBook.asks.length"
                        :quotes="orderBook.asks"
                        isAsk
                        :highlights="askHighlights"
                    ></OrderBookQuotes>

                    <!-- Last Price -->
                    <tr class="text-center">
                        <td colspan="3" class="py-2">
                            <p
                                class="p-3 rounded transition-colors duration-300 flex items-center justify-center gap-1 text-lg font-bold"
                                :style="lastPriceClass"
                            >
                                {{ lastPrice?.toLocaleString() }}
                                <IconArrowDown
                                    :class="{
                                        'rotate-180':
                                            lastPriceArrowColor === 'var(--color-bullish)',
                                    }"
                                    :style="{
                                        color: lastPriceArrowColor,
                                        width: '1.2em',
                                        height: '1.2em',
                                    }"
                                />
                            </p>
                        </td>
                    </tr>
                </tbody>
                <!-- Buy quotes (bids) -->
                <OrderBookQuotes
                    v-if="orderBook.bids.length"
                    :quotes="orderBook.bids"
                    :isAsk="false"
                    :highlights="bidHighlights"
                ></OrderBookQuotes>
            </table>
        </div>
    </div>
</template>
