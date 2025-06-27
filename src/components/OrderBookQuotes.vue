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
            ]"
        >
            <td class="relative" :class="isAsk ? 'text-bearish' : 'text-bullish'">
                <div class="relative z-10 p-2 font-semibold">
                    {{ parseFloat(quote.price).toLocaleString() }}
                </div>
            </td>
            <td class="p-2 border-b border-gray-700 relative z-10 text-text-primary">
                {{ parseFloat(quote.size).toLocaleString() }}
            </td>
            <td class="'p-2 border-b border-gray-700 relative z-10 text-text-primary',">
                <div
                    :class="[
                        'absolute inset-y-0 right-0 opacity-60 bg-bearish-bg',
                        isAsk ? 'bg-bearish-bg' : 'bg-bullish-bg',
                    ]"
                    :style="{ width: (quote.percent || 0) * 100 + '%' }"
                ></div>
                {{ parseFloat(quote.total).toLocaleString() }}
            </td>
        </tr>
    </tbody>
</template>
