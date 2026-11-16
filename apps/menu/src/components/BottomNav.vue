<template>
  <nav
    class="menu-bottom-nav"
    :data-style="bottomNavStyle"
    aria-label="Primary navigation"
  >
    <div
      class="menu-bottom-nav__surface grid"
      :style="{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }"
    >
      <RouterLink
        v-for="item in items"
        :key="item.section"
        :to="menuLink(item.to)"
        class="menu-bottom-nav__item relative flex min-w-0 flex-col items-center gap-1 px-1 py-1.5 text-[13px] font-bold leading-5 transition"
        :data-active="activeSection === item.section"
      >
        <span
          class="menu-bottom-nav__icon relative grid size-8 place-items-center"
        >
          <component :is="item.icon" :size="20" stroke-width="2.3" />
          <span
            v-if="item.section === 'order' && store.cartCount"
            class="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-tomato px-1 text-[10px] leading-5 text-on-primary"
          >
            {{ store.cartCount > 99 ? "99+" : store.cartCount }}
          </span>
        </span>
        <span class="w-full truncate text-center">{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useMenuLink } from "../composables/useMenuLink";
import {
  Heart,
  House,
  Search,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-vue-next";
import { useMenuStore } from "../stores/menu";
import { uiText } from "../uiText";

const store = useMenuStore();
const route = useRoute();
const menuLink = useMenuLink();
const slug = computed(() => String(route.params.slug || store.currentSlug));
const basePath = computed(() =>
  route.meta.customDomain ? "" : `/${slug.value}`,
);
const text = computed(() => uiText(store.selectedLanguage));
const activeSection = computed(() => String(route.meta.section || "home"));
const bottomNavStyle = computed(
  () => store.data.business.menuTheme.bottomNavStyle || "modern",
);
const items = computed(() => {
  const navigation = [
    {
      section: "home",
      label: text.value.home,
      icon: House,
      to: basePath.value || "/",
    },
    {
      section: "menu",
      label: text.value.menu,
      icon: UtensilsCrossed,
      to: `${basePath.value}/menu`,
    },
    {
      section: "search",
      label: text.value.search,
      icon: Search,
      to: `${basePath.value}/search`,
    },
    {
      section: "favourites",
      label: text.value.favourites,
      icon: Heart,
      to: `${basePath.value}/favourites`,
    },
    {
      section: "order",
      label: text.value.myOrder,
      icon: ShoppingBag,
      to: `${basePath.value}/order`,
    },
  ];
  return navigation.filter(
    (item) =>
      (item.section !== "search" ||
        store.data.business.menuTheme.showSearchNav !== false) &&
      (item.section !== "order" || store.orderingEnabled),
  );
});
</script>
