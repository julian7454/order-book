<script setup lang="ts">
import { ref, computed } from 'vue';
import IconArrowDown from './IconArrowDown.vue';

type TradeHistory = {
    price: number;
};

const lastPriceSocket = new WebSocket('wss://ws.btse.com/ws/futures');

lastPriceSocket.onopen = () => {
    lastPriceSocket.send(
        JSON.stringify({
            op: 'subscribe',
            args: ['tradeHistoryApi:BTCPFC'],
        }),
    );
};

lastPriceSocket.onmessage = (event) => {
    const raw = JSON.parse(event.data);
    const trades: TradeHistory[] = raw?.data;

    if (trades?.length > 0) {
        const newPrice = trades[0].price;

        if (lastPrice.value !== null) {
            prevPrice.value = lastPrice.value;
        }
        requestAnimationFrame(() => {
            lastPrice.value = newPrice;
        });
    }
};

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
</script>
<template>
    <tr class="text-center">
        <td colspan="3" class="py-2">
            <p
                class="p-3 rounded transition-colors duration-300 flex items-center justify-center gap-1 text-lg font-bold"
                :style="lastPriceClass"
            >
                {{ lastPrice?.toLocaleString() }}
                <IconArrowDown
                    :class="{
                        'rotate-180': lastPriceArrowColor === 'var(--color-bullish)',
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
</template>
