<template>
  <article class="card overflow-hidden">
    <h2 class="display m-0 border-b border-black/[0.06] p-5 text-xl">
      {{ title }}
    </h2>
    <div
      v-if="rows.length"
      ref="viewport"
      class="overflow-auto"
      :class="virtual ? 'max-h-[32rem]' : ''"
      @scroll="onScroll"
    >
      <table class="w-full text-left text-sm" :aria-rowcount="rows.length + 1">
        <thead
          class="sticky top-0 z-10 bg-cream text-xs uppercase tracking-wide text-black/40 shadow-[0_1px_0_rgba(0,0,0,.06)]"
        >
          <tr>
            <th
              v-for="column in columns"
              :key="column"
              class="px-5 py-3 font-bold"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/[0.06]">
          <tr v-if="topPadding" aria-hidden="true">
            <td
              :colspan="columns.length"
              class="p-0"
              :style="spacer(topPadding)"
            ></td>
          </tr>
          <tr
            v-for="(row, index) in visibleRows"
            :key="`${startIndex + index}-${String(row[0])}`"
            :aria-rowindex="startIndex + index + 2"
            class="h-[49px]"
          >
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              class="whitespace-nowrap px-5 py-3"
              :class="
                cellIndex === 0 ? 'font-semibold' : 'tabular-nums text-black/60'
              "
            >
              {{ cell ?? "—" }}
            </td>
          </tr>
          <tr v-if="bottomPadding" aria-hidden="true">
            <td
              :colspan="columns.length"
              class="p-0"
              :style="spacer(bottomPadding)"
            ></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="m-0 p-8 text-center text-sm text-black/40">
      {{ emptyText }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    columns: string[];
    rows: unknown[][];
    emptyText: string;
    virtualThreshold?: number;
  }>(),
  { virtualThreshold: 80 },
);

const ROW_HEIGHT = 49;
const VIEWPORT_HEIGHT = 512;
const OVERSCAN = 8;
const viewport = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const virtual = computed(() => props.rows.length >= props.virtualThreshold);
const startIndex = computed(() =>
  virtual.value
    ? Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
    : 0,
);
const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
const endIndex = computed(() =>
  virtual.value
    ? Math.min(props.rows.length, startIndex.value + visibleCount)
    : props.rows.length,
);
const visibleRows = computed(() =>
  props.rows.slice(startIndex.value, endIndex.value),
);
const topPadding = computed(() =>
  virtual.value ? startIndex.value * ROW_HEIGHT : 0,
);
const bottomPadding = computed(() =>
  virtual.value ? (props.rows.length - endIndex.value) * ROW_HEIGHT : 0,
);

function onScroll(event: Event) {
  if (virtual.value)
    scrollTop.value = (event.currentTarget as HTMLElement).scrollTop;
}

function spacer(height: number) {
  return { height: `${height}px` };
}

watch(
  () => props.rows,
  async () => {
    scrollTop.value = 0;
    await nextTick();
    if (viewport.value) viewport.value.scrollTop = 0;
  },
);
</script>
