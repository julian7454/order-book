<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue';
import TheWelcome from './components/TheWelcome.vue';

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
let orderBook: OrderBook = { bids: [], asks: [] };
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

    const sorted = Array.from(map.entries()).sort(([p1], [p2]) => {
        return sort === 'desc' ? Number(p2) - Number(p1) : Number(p1) - Number(p2);
    });

    return sorted.slice(0, 8);
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
        orderBook = processSnapshot(raw);
        lastSeqNum = data.seqNum;
    }
    if (data.type === 'delta') {
        if (data.prevSeqNum !== lastSeqNum) {
            resubscribe(socket);
            return;
        }

        orderBook = applyDelta(orderBook, raw);
        lastSeqNum = data.seqNum;

        if (hasCrossedOrderBook(orderBook)) {
            resubscribe(socket);
        }
    }
    console.log(orderBook);
};
</script>

<template>
    <header>
        <img alt="Vue logo" class="logo" src="./assets/logo.svg" width="125" height="125" />

        <div class="wrapper">
            <HelloWorld msg="You did it!" />
        </div>
    </header>

    <main>
        <TheWelcome />
    </main>
</template>

<style scoped>
header {
    line-height: 1.5;
}

.logo {
    display: block;
    margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
    header {
        display: flex;
        place-items: center;
        padding-right: calc(var(--section-gap) / 2);
    }

    .logo {
        margin: 0 2rem 0 0;
    }

    header .wrapper {
        display: flex;
        place-items: flex-start;
        flex-wrap: wrap;
    }
}
</style>
