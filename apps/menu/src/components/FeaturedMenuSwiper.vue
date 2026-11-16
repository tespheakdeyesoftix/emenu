<template>
  <section
    v-if="featuredProducts.length"
    class="mb-8"
    aria-labelledby="featured-menu-title"
  >
    <div class="mb-5 flex items-end justify-between gap-4">
      <div>
        <div class="mb-2 flex items-center gap-2 text-tomato">
          <Sparkles :size="17" />
          <span class="text-xs font-extrabold uppercase tracking-[.16em]">
            {{ t("menu.featuredLabel") }}
          </span>
        </div>
        <h2
          id="featured-menu-title"
          class="menu-category-title font-display m-0 font-extrabold leading-tight"
        >
          {{ t("menu.featuredTitle") }}
        </h2>
      </div>
      <p
        class="m-0 hidden max-w-xs text-right text-sm leading-6 text-ink/40 sm:block"
      >
        {{ t("menu.featuredSubtitle") }}
      </p>
    </div>

    <Swiper
      class="featured-menu-swiper"
      :modules="[A11y, Pagination]"
      slides-per-view="auto"
      :space-between="12"
      :grab-cursor="true"
      :watch-overflow="true"
      :pagination="{ clickable: true }"
    >
      <SwiperSlide
        v-for="product in featuredProducts"
        :key="product.id"
        class="featured-menu-slide h-auto pb-10"
      >
        <ProductCard :product="product" view-mode="grid" class="h-full" />
      </SwiperSlide>
    </Swiper>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Sparkles } from "lucide-vue-next";
import { A11y, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/vue";
import "swiper/css";
import "swiper/css/pagination";
import ProductCard from "./ProductCard.vue";
import { useMenuStore } from "../stores/menu";

const store = useMenuStore();
const { t } = useI18n();
const featuredProducts = computed(() => store.featured.slice(0, 5));
</script>

<style scoped>
.featured-menu-swiper {
  --swiper-pagination-bottom: 0;
  --swiper-pagination-color: #1b1b19;
  --swiper-pagination-bullet-inactive-color: #1b1b19;
  --swiper-pagination-bullet-inactive-opacity: 0.2;
  overflow: hidden;
}

.featured-menu-swiper :deep(.swiper-wrapper) {
  align-items: stretch;
}

.featured-menu-slide {
  width: 280px;
}

@media (min-width: 640px) {
  .featured-menu-slide {
    width: 320px;
  }
}
</style>
