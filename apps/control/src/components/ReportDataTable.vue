<template>
  <article class="card overflow-hidden">
    <h2
      class="border-b border-outline-gray-1 p-4 text-lg-semibold text-ink-gray-9"
    >
      {{ title }}
    </h2>
    <div
      v-if="rows.length"
      ref="viewport"
      class="overflow-auto"
      :class="{ 'max-h-[32rem]': virtual }"
    >
      <List
        :columns="columnWidths"
        :row-height="ROW_HEIGHT"
        :aria-rowcount="rows.length + 1"
        :style="{ minWidth: `${columns.length * 112 + 40}px` }"
      >
        <ListHeader class="sticky top-0 z-10 !h-10 bg-surface-gray-1">
          <ListHeaderCell
            v-for="(column, index) in columns"
            :key="index"
            :class="{ 'justify-end': index > 0 }"
          >
            {{ column }}
          </ListHeaderCell>
        </ListHeader>
        <ListRows v-slot="{ item, index }" :items="rows" :virtual="virtual">
          <ListRow :aria-rowindex="index + 2">
            <ListCell
              v-for="(cell, cellIndex) in item"
              :key="cellIndex"
              class="whitespace-nowrap"
              :class="
                cellIndex === 0
                  ? 'font-medium text-ink-gray-9'
                  : 'justify-end tabular-nums text-ink-gray-7'
              "
            >
              {{ cell ?? "—" }}
            </ListCell>
          </ListRow>
        </ListRows>
      </List>
    </div>
    <p v-else class="p-8 text-center text-base text-ink-gray-5">
      {{ emptyText }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  List,
  ListCell,
  ListHeader,
  ListHeaderCell,
  ListRow,
  ListRows,
} from "frappe-ui/list";

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

const ROW_HEIGHT = 44;
const viewport = ref<HTMLElement | null>(null);
const virtual = computed(() => props.rows.length >= props.virtualThreshold);
const columnWidths = computed(() =>
  props.columns.map((_, index) =>
    index === 0 ? "minmax(8rem,2fr)" : "minmax(7rem,1fr)",
  ),
);

watch(
  () => props.rows,
  () => {
    if (viewport.value) viewport.value.scrollTop = 0;
  },
  { flush: "post" },
);
</script>
