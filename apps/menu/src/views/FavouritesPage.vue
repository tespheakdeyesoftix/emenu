<template>
  <div class="menu-page-bottom-space min-h-screen">
    <PageHeader :title="text.favourites" />
    <main class="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <div
        v-if="store.favouriteProducts.length"
        class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
      >
        <ProductCard
          v-for="product in store.favouriteProducts"
          :key="product.id"
          :product="product"
        />
      </div>
      <div
        v-else
        class="rounded-[2rem] bg-surface px-6 py-20 text-center shadow-sm"
      >
        <Heart class="mx-auto mb-4 text-ink/20" :size="48" />
        <p class="m-0 text-base text-ink/50">{{ text.noFavourites }}</p>
        <RouterLink
          :to="menuLink(`${basePath}/menu`)"
          class="mt-6 inline-flex rounded-full bg-action px-6 py-3 font-bold text-on-action"
        >
          {{ text.browseMenu }}
        </RouterLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Heart } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import ProductCard from "../components/ProductCard.vue";
import { useMenuStore } from "../stores/menu";
import { uiText } from "../uiText";
import { useMenuLink } from "../composables/useMenuLink";

const store = useMenuStore();
const menuLink = useMenuLink();
const route = useRoute();
const slug = computed(() => String(route.params.slug || ""));
const basePath = computed(() =>
  route.meta.customDomain || !slug.value ? "" : `/${slug.value}`,
);
const text = computed(() => uiText(store.selectedLanguage));
</script>
