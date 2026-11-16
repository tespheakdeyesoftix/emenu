<template>
  <span
    class="price-display inline-flex flex-col items-end whitespace-nowrap leading-tight"
    :class="[
      { 'price-display--inherit': inheritColor },
      `price-display--${align}`,
      `price-display--${layout}`,
    ]"
  >
    <span class="price-display__primary font-extrabold">
      <span v-if="prefix">{{ prefix }} </span>{{ primaryPrice
      }}<small v-if="unit" class="font-medium opacity-60"> / {{ unit }}</small>
    </span>
    <small
      v-if="secondaryPrice"
      class="price-display__secondary mt-1 font-semibold leading-none"
    >
      ≈ {{ secondaryPrice }}
    </small>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMenuStore } from "../stores/menu";
import { formatCurrency } from "../utils/currency";

const props = withDefaults(
  defineProps<{
    amount: number;
    prefix?: string;
    unit?: string | null;
    inheritColor?: boolean;
    align?: "start" | "end";
    layout?: "stacked" | "inline";
  }>(),
  {
    prefix: "",
    unit: "",
    inheritColor: false,
    align: "end",
    layout: "stacked",
  },
);

const store = useMenuStore();
const primaryPrice = computed(() =>
  formatCurrency(props.amount, store.data.business.currency),
);
const secondaryPrice = computed(() => {
  const business = store.data.business;
  const rate = Number(business.secondaryExchangeRate);
  if (
    !business.showSecondaryCurrency ||
    business.secondaryCurrency === business.currency ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return "";
  }
  return formatCurrency(props.amount * rate, business.secondaryCurrency);
});
</script>

<style scoped>
.price-display__primary {
  color: rgb(var(--menu-price-primary-rgb));
  font-size: var(--menu-price-primary-size);
}

.price-display__secondary {
  color: rgb(var(--menu-price-secondary-rgb));
  font-size: var(--menu-price-secondary-size);
}

.price-display--start {
  align-items: flex-start;
}

.price-display--inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem;
}

.price-display--inline .price-display__secondary {
  margin-top: 0;
  border-left: 1px solid rgb(var(--menu-text-rgb) / 0.12);
  padding-left: 0.75rem;
}

.price-display--inherit .price-display__primary,
.price-display--inherit .price-display__secondary {
  color: inherit;
}
</style>
