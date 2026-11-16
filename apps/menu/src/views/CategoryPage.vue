<template>
  <div class="menu-page-bottom-space min-h-screen">
    <PageHeader
      :title="category ? store.nameFor(category) : text.categories"
      :back-to="`${basePath}/menu`"
      title-class="menu-category-title"
      sticky
    />
    <main class="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <section v-if="children.length" class="mb-8">
        <h2 class="font-display mb-4 mt-0 text-xl font-extrabold">
          {{ store.data.menu ? text.menuSections : text.subcategories }}
        </h2>
        <div class="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          <RouterLink
            v-for="child in children"
            :key="child.id"
            :to="menuLink(`${basePath}/category/${child.id}`)"
            class="menu-category-card min-w-[132px] overflow-hidden rounded-2xl border border-ink/[.06] bg-surface p-2 shadow-sm"
          >
            <MenuImage
              :src="child.imageUrl"
              :alt="store.nameFor(child)"
              class="h-24 w-full rounded-xl object-cover"
            >
              <template #fallback>
                <div
                  class="grid h-24 place-items-center rounded-xl bg-cream text-ink/20"
                >
                  <Utensils :size="25" />
                </div>
              </template>
            </MenuImage>
            <span
              class="menu-category-filter mt-2 block text-center font-bold leading-5"
              >{{ store.nameFor(child) }}</span
            >
          </RouterLink>
        </div>
      </section>

      <div class="mb-5 flex items-end justify-between gap-4">
        <h2 class="menu-category-title font-display m-0 font-extrabold">
          {{ category ? store.nameFor(category) : text.menu }}
        </h2>
        <span class="text-sm font-bold text-ink/40"
          >{{ products.length }} {{ text.item }}</span
        >
      </div>
      <div class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        <ProductCard
          v-for="product in visibleProducts"
          :key="product.id"
          :product="product"
        />
      </div>
      <div
        v-if="!products.length"
        class="rounded-3xl bg-surface px-5 py-16 text-center text-ink/45"
      >
        {{ text.chooseCategory }}
      </div>
      <button
        v-if="visibleProducts.length < products.length"
        ref="loadMoreTrigger"
        class="mx-auto mt-8 block rounded-full bg-surface px-6 py-3 font-bold shadow-sm"
        @click="visibleLimit += 24"
      >
        {{ t("menu.loadMore") }}
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Utensils } from "lucide-vue-next";
import MenuImage from "../components/MenuImage.vue";
import { useMenuLink } from "../composables/useMenuLink";
import PageHeader from "../components/PageHeader.vue";
import ProductCard from "../components/ProductCard.vue";
import { displaySectionIds, orderMenuProducts, useMenuStore, type MenuCategory } from "../stores/menu";
import { uiText } from "../uiText";

const store = useMenuStore();
const menuLink = useMenuLink();
const router = useRouter();
const props = defineProps<{ slug: string; categoryId: string }>();
const basePath = computed(() => (props.slug ? `/${props.slug}` : ""));
const { t } = useI18n();
const text = computed(() => uiText(store.selectedLanguage));
const category = computed(() =>
  (store.data.categories as MenuCategory[]).find(
    (item) => item.id === props.categoryId,
  ),
);
const children = computed(() =>
  (store.data.categories as MenuCategory[]).filter(
    (item) => item.parentId === props.categoryId,
  ),
);
const descendantIds = computed(() => {
  const ids = new Set([props.categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of store.data.categories as MenuCategory[]) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
    }
  }
  return ids;
});
const products = computed(() => {
  const matches = store.data.products.filter((product) =>
    displaySectionIds(product).some((id) => descendantIds.value.has(id)),
  );
  return store.data.menu
    ? orderMenuProducts(matches, [...descendantIds.value])
    : matches;
});
const visibleLimit = ref(24);
const visibleProducts = computed(() =>
  products.value.slice(0, visibleLimit.value),
);
const loadMoreTrigger = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
function activatePage() {
  deactivatePage();
  if (props.categoryId === store.data.menu?.id) {
    void router.replace(menuLink(`${basePath.value}/menu`));
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting))
        visibleLimit.value += 24;
    },
    { rootMargin: "400px" },
  );
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value);
}
function deactivatePage() {
  observer?.disconnect();
  observer = null;
}
onActivated(activatePage);
onDeactivated(deactivatePage);
watch(loadMoreTrigger, (element) => {
  observer?.disconnect();
  if (element) observer?.observe(element);
});
onBeforeUnmount(deactivatePage);
</script>
