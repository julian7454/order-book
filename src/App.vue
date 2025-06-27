<script setup lang="ts">
import { ref } from 'vue';

type Level = {
    price: string;
    size: string;
    total: number;
    percent?: number;
};

type RawLevel = [string, string];

type OrderBookLevels = Level[];
type OrderBookRawLevels = RawLevel[];

type OrderBook = {
    bids: OrderBookLevels;
    asks: OrderBookLevels;
};

type SnapshotData = {
    data: {
        bids: OrderBookRawLevels;
        asks: OrderBookRawLevels;
        seqNum: number;
        type: string;
    };
};

type DeltaData = {
    data: {
        bids: OrderBookRawLevels;
        asks: OrderBookRawLevels;
        seqNum: number;
        prevSeqNum: number;
        type: string;
    };
};

const socket = new WebSocket('wss://ws.btse.com/ws/oss/futures');
const orderBook = ref<OrderBook>({ bids: [], asks: [] });
let lastSeqNum: number | null = null;

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

function processSnapshot(raw: SnapshotData): OrderBook {
    return {
        bids: addTotalsAndPercents(sortAndTrim(raw.data.bids, 'desc')),
        asks: addTotalsAndPercents(sortAndTrim(raw.data.asks, 'asc')),
    };
}

function applyDelta(orderBook: OrderBook, raw: DeltaData): OrderBook {
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

socket.onopen = () => {
    console.log('WebSocket connected');

    const payload = {
        op: 'subscribe',
        args: ['update:BTCPFC'],
    };

    socket.send(JSON.stringify(payload));
};

socket.onmessage = (event: MessageEvent) => {
    const raw = JSON.parse(event.data);
    const data = raw.data;

    if (!data || !data.type) return;

    if (data.type === 'snapshot') {
        orderBook.value = processSnapshot(raw);
        lastSeqNum = data.seqNum;
    }
    if (data.type === 'delta') {
        if (data.prevSeqNum !== lastSeqNum) {
            resubscribe(socket);
            return;
        }

        orderBook.value = applyDelta(orderBook.value, raw);
        lastSeqNum = data.seqNum;

        if (hasCrossedOrderBook(orderBook.value)) {
            resubscribe(socket);
        }
    }
    console.log(orderBook.value);
};
</script>

<template>
    <div class="max-w-2xl mx-auto mt-8 p-4 rounded-lg font-mono bg-bg-primary text-text-primary">
        <h1 class="text-center mb-6 text-2xl font-semibold text-text-primary">
            Order Book - BTCPFC
        </h1>

        <div class="overflow-hidden rounded-lg">
            <table class="w-full border-collapse text-sm">
                <thead>
                    <tr class="bg-gray-800/50">
                        <th
                            class="text-left p-3 border-b-2 border-gray-600 font-semibold text-text-secondary"
                        >
                            Price (USD)
                        </th>
                        <th
                            class="text-right p-3 border-b-2 border-gray-600 font-semibold text-text-secondary"
                        >
                            Size
                        </th>
                        <th
                            class="text-right p-3 border-b-2 border-gray-600 font-semibold text-text-secondary"
                        >
                            Total
                        </th>
                    </tr>
                </thead>

                <!-- Sell quotes (asks) -->
                <tbody>
                    <tr
                        v-for="ask in orderBook.asks.slice().reverse()"
                        :key="ask.price"
                        class="transition-colors duration-150 relative hover:bg-row-hover bg-bearish-bg"
                    >
                        <!-- Progress bar for accumulative total -->
                        <td class="relative">
                            <div
                                class="absolute inset-0 opacity-60 bg-bearish-bg"
                                :style="{ width: (ask.percent || 0) * 100 + '%' }"
                            ></div>
                            <div class="relative z-10 text-left p-2 font-semibold text-bearish">
                                ${{ parseFloat(ask.price).toLocaleString() }}
                            </div>
                        </td>
                        <td
                            class="text-right p-2 border-b border-gray-700 relative z-10 text-text-primary"
                        >
                            {{ ask.size }}
                        </td>
                        <td
                            class="text-right p-2 border-b border-gray-700 relative z-10 text-text-primary"
                        >
                            {{ ask.total.toFixed(2) }}
                        </td>
                    </tr>
                </tbody>

                <!-- Separator -->
                <tbody>
                    <tr class="bg-gray-800/50 border-t-2 border-b-2 border-gray-600">
                        <td colspan="3" class="text-center p-3">
                            <div class="font-semibold text-yellow-400">
                                <span v-if="orderBook.asks.length && orderBook.bids.length">
                                    Spread: ${{
                                        (
                                            parseFloat(orderBook.asks[0]?.price || '0') -
                                            parseFloat(orderBook.bids[0]?.price || '0')
                                        ).toLocaleString()
                                    }}
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody>

                <!-- Buy quotes (bids) -->
                <tbody>
                    <tr
                        v-for="bid in orderBook.bids"
                        :key="bid.price"
                        class="transition-colors duration-150 relative hover:bg-row-hover bg-bullish-bg"
                    >
                        <!-- Progress bar for accumulative total -->
                        <td class="relative">
                            <div
                                class="absolute inset-0 opacity-60 bg-bullish-bg"
                                :style="{ width: (bid.percent || 0) * 100 + '%' }"
                            ></div>
                            <div class="relative z-10 text-left p-2 font-semibold text-bullish">
                                ${{ parseFloat(bid.price).toLocaleString() }}
                            </div>
                        </td>
                        <td
                            class="text-right p-2 border-b border-gray-700 relative z-10 text-text-primary"
                        >
                            {{ bid.size }}
                        </td>
                        <td
                            class="text-right p-2 border-b border-gray-700 relative z-10 text-text-primary"
                        >
                            {{ bid.total.toFixed(2) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
