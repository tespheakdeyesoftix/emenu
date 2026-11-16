<template>
  <section>
    <div class="mb-4 flex items-center justify-between gap-4">
      <h2 class="font-display m-0 text-2xl font-extrabold">{{ title }}</h2>
      <slot name="action" />
    </div>
    <div class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import ProductCard from "./ProductCard.vue";
import type { MenuProduct } from "../stores/menu";

defineProps<{
  title: string;
  products: MenuProduct[];
}>();
</script>
