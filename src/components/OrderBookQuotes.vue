<script setup lang="ts">
import { defineProps } from 'vue';

type Level = {
    price: string;
    size: string;
    total: number;
    percent?: number;
};

defineProps<{
    quotes: Level[];
    isAsk?: boolean;
    highlights: Record<string, { newPrice?: boolean; sizeChanged?: 'up' | 'down' }>;
}>();
</script>

<template>
    <tbody>
        <tr
            v-for="quote in isAsk ? quotes.slice().reverse() : quotes"
            :key="quote.price"
            :class="[
                'transition-colors duration-150 relative hover:bg-row-hover',
                isAsk ? 'bg-bearish-bg' : 'bg-bullish-bg',
                highlights[quote.price]?.newPrice &&
                    (isAsk ? 'animate-flash-red' : 'animate-flash-green'),
            ]"
        >
            <td class="relative" :class="isAsk ? 'text-bearish' : 'text-bullish'">
                <div class="relative z-10 p-2 font-semibold">
                    {{ parseFloat(quote.price).toLocaleString() }}
                </div>
            </td>
            <td
                class="p-2 border-b border-gray-700 relative z-10 text-text-primary"
                :class="{
                    'animate-flash-green': highlights[quote.price]?.sizeChanged === 'up',
                    'animate-flash-red': highlights[quote.price]?.sizeChanged === 'down',
                }"
            >
                {{ parseFloat(quote.size).toLocaleString() }}
            </td>
            <td class="'p-2 border-b border-gray-700 relative z-10 text-text-primary',">
                <div
                    :class="[
                        'absolute inset-y-0 right-0 opacity-60',
                        isAsk ? 'bg-bearish-bg' : 'bg-bullish-bg',
                    ]"
                    :style="{ width: (quote.percent || 0) * 100 + '%' }"
                ></div>
                {{ quote.total.toLocaleString() }}
            </td>
        </tr>
    </tbody>
</template>
