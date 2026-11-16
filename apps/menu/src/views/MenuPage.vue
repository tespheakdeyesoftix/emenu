<template>
  <div class="menu-page-bottom-space min-h-screen">
    <PageHeader :title="text.menu" />
    <main class="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <h2 class="font-display m-0 text-3xl font-extrabold">
        {{ store.data.menu ? text.menuSections : text.categories }}
      </h2>
      <p class="mb-6 mt-2 text-base text-ink/50">{{ store.data.menu ? text.chooseSection : text.chooseCategory }}</p>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <RouterLink
          v-for="category in topCategories"
          :key="category.id"
          :to="menuLink(`${basePath}/category/${category.id}`)"
          class="menu-category-card group overflow-hidden rounded-[1.6rem] bg-surface shadow-[0_10px_34px_rgba(45,38,30,.07)]"
        >
          <MenuImage
            :src="category.imageUrl"
            :alt="store.nameFor(category)"
            class="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
          >
            <template #fallback>
              <div
                class="grid aspect-square place-items-center bg-[#eee9dd] text-black/20"
              >
                <Utensils :size="38" />
              </div>
            </template>
          </MenuImage>
          <div class="flex items-center gap-2 p-4">
            <div class="min-w-0 flex-1">
              <h3 class="font-display m-0 text-lg font-extrabold leading-6">
                {{ store.nameFor(category) }}
              </h3>
              <p class="mb-0 mt-1 text-sm text-ink/40">
                {{ productCount(category.id) }} {{ text.item }}
              </p>
            </div>
            <ChevronRight :size="20" class="shrink-0 text-ink/30" />
          </div>
        </RouterLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ChevronRight, Utensils } from "lucide-vue-next";
import MenuImage from "../components/MenuImage.vue";
import { useMenuLink } from "../composables/useMenuLink";
import PageHeader from "../components/PageHeader.vue";
import { displaySectionIds, useMenuStore, type MenuCategory } from "../stores/menu";
import { uiText } from "../uiText";

const store = useMenuStore();
const menuLink = useMenuLink();
const route = useRoute();
const slug = computed(() => String(route.params.slug || ""));
const basePath = computed(() =>
  route.meta.customDomain || !slug.value ? "" : `/${slug.value}`,
);
const text = computed(() => uiText(store.selectedLanguage));
const topCategories = computed(() =>
  store.data.categories.filter((category) => !category.parentId),
);
function descendantIds(categoryId: string) {
  const ids = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of store.data.categories as MenuCategory[]) {
      if (
        category.parentId &&
        ids.has(category.parentId) &&
        !ids.has(category.id)
      ) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}
const productCount = (categoryId: string) => {
  const ids = descendantIds(categoryId);
  return store.data.products.filter((product) => displaySectionIds(product).some((id) => ids.has(id)))
    .length;
};
</script>
