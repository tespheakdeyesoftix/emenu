<template>
  <div class="menu-page-bottom-space min-h-screen">
    <PageHeader :title="t('search.title')" />
    <main class="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <div
        class="relative rounded-[1.5rem] bg-surface p-2 shadow-[0_10px_34px_rgba(45,38,30,.08)]"
      >
        <Search
          :size="22"
          class="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-ink/35"
        />
        <input
          v-model="rawQuery"
          type="search"
          inputmode="search"
          autocomplete="off"
          :placeholder="t('search.placeholder')"
          class="h-14 w-full rounded-[1.1rem] border-0 bg-cream py-3 pl-14 pr-14 text-base font-semibold text-ink outline-none ring-tomato/20 placeholder:font-normal placeholder:text-ink/35 focus:ring-4"
        />
        <button
          v-if="rawQuery"
          type="button"
          class="absolute right-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink/45 transition hover:bg-ink/[.06] hover:text-ink"
          :aria-label="t('search.clear')"
          @click="clearSearch"
        >
          <X :size="20" />
        </button>
      </div>

      <section v-if="hasInput" class="mt-7" aria-live="polite">
        <div class="mb-5 flex min-h-8 items-center justify-between gap-3">
          <h2 class="font-display m-0 text-xl font-extrabold sm:text-2xl">
            {{ t("search.results") }}
          </h2>
          <span
            v-if="isDebouncing"
            class="inline-flex items-center gap-2 text-sm font-bold text-ink/45"
          >
            <LoaderCircle :size="17" class="animate-spin" />
            {{ t("search.searching") }}
          </span>
          <span v-else-if="!isTooShort" class="text-sm font-bold text-ink/45">
            {{ t("search.resultCount", { count: results.length }) }}
          </span>
        </div>

        <div
          v-if="isTooShort"
          class="rounded-[2rem] bg-surface px-6 py-12 text-center text-sm font-semibold text-ink/50 shadow-sm"
        >
          {{ t("search.minCharacters") }}
        </div>
        <div
          v-else-if="!isDebouncing && results.length"
          class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
        >
          <ProductCard
            v-for="product in results"
            :key="product.id"
            :product="product"
          />
        </div>
        <div
          v-else-if="!isDebouncing && debouncedQuery"
          class="rounded-[2rem] bg-surface px-6 py-16 text-center shadow-sm"
        >
          <SearchX class="mx-auto mb-4 text-ink/20" :size="48" />
          <h3 class="font-display m-0 text-xl font-extrabold">
            {{ t("search.noResults", { query: debouncedQuery }) }}
          </h3>
          <p class="mx-auto mb-0 mt-2 max-w-md text-sm leading-6 text-ink/50">
            {{ t("search.noResultsHint") }}
          </p>
        </div>
      </section>

      <template v-else>
        <section v-if="topCategories.length" class="mt-8">
          <h2 class="font-display m-0 text-2xl font-extrabold">
            {{ t("search.categories") }}
          </h2>
          <div class="mt-4 flex flex-wrap gap-2.5">
            <RouterLink
              v-for="category in topCategories"
              :key="category.id"
              :to="menuLink(`${basePath}/category/${category.id}`)"
              class="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-extrabold shadow-sm transition hover:-translate-y-0.5"
            >
              {{ store.nameFor(category) }}
              <span class="text-xs text-ink/35">
                {{ productCount(category.id) }}
              </span>
            </RouterLink>
          </div>
        </section>

        <ProductSection
          v-if="recentProducts.length"
          class="mt-9"
          :title="t('search.recent')"
          :products="recentProducts"
        />

        <ProductSection
          v-if="favouriteProducts.length"
          class="mt-9"
          :title="t('search.favourites')"
          :products="favouriteProducts"
        >
          <template #action>
            <RouterLink
              :to="menuLink(`${basePath}/favourites`)"
              class="text-sm font-extrabold text-tomato"
            >
              {{ t("search.viewAll") }}
            </RouterLink>
          </template>
        </ProductSection>

        <ProductSection
          v-if="showDiscovery && discoveryProducts.length"
          class="mt-9"
          :title="t('search.discover')"
          :products="discoveryProducts"
        />

        <div
          v-if="!store.data.products.length"
          class="mt-8 rounded-[2rem] bg-surface px-6 py-16 text-center text-ink/50 shadow-sm"
        >
          {{ t("menu.noItems") }}
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { LoaderCircle, Search, SearchX, X } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import ProductCard from "../components/ProductCard.vue";
import ProductSection from "../components/ProductSection.vue";
import { useMenuLink } from "../composables/useMenuLink";
import { trackAnalytics } from "../analytics";
import {
  displaySectionIds,
  useMenuStore,
  type MenuCategory,
  type MenuProduct,
} from "../stores/menu";

const store = useMenuStore();
const menuLink = useMenuLink();
const route = useRoute();
const { t } = useI18n();
const rawQuery = ref("");
const debouncedQuery = ref("");
const isDebouncing = ref(false);
let debounceTimer = 0;

const slug = computed(() => String(route.params.slug || ""));
const basePath = computed(() =>
  route.meta.customDomain || !slug.value ? "" : `/${slug.value}`,
);
const hasInput = computed(() => Boolean(rawQuery.value.trim()));
const isTooShort = computed(
  () => hasInput.value && [...normalize(rawQuery.value)].length < 2,
);
const topCategories = computed(() =>
  (store.data.categories as MenuCategory[]).filter(
    (category) => !category.parentId,
  ),
);
const recentProducts = computed(() => store.recentProducts.slice(0, 8));
const favouriteProducts = computed(() => store.favouriteProducts.slice(0, 8));
const showDiscovery = computed(
  () => !recentProducts.value.length && !favouriteProducts.value.length,
);
const discoveryProducts = computed(() => {
  const featured = store.data.products.filter((product) => product.isFeatured);
  return (featured.length ? featured : store.data.products).slice(0, 8);
});

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim();
}

const categoryById = computed(
  () =>
    new Map(
      (store.data.categories as MenuCategory[]).map((category) => [
        category.id,
        category,
      ]),
    ),
);

function searchableText(product: MenuProduct) {
  const categoryNames: unknown[] = [];
  const visited = new Set<string>();
  for (const id of displaySectionIds(product)) {
    let category = categoryById.value.get(id);
    while (category && !visited.has(category.id)) {
      visited.add(category.id);
      categoryNames.push(category.name, category.nameKm, category.nameEn, category.nameZh);
      category = category.parentId ? categoryById.value.get(category.parentId) : undefined;
    }
  }
  return normalize(
    [
      product.code,
      product.name,
      product.nameKm,
      product.nameEn,
      product.nameZh,
      product.description,
      ...categoryNames,
    ].join(" "),
  );
}

const allResults = computed(() => {
  const tokens = normalize(debouncedQuery.value).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return store.data.products.filter((product) => {
    const text = searchableText(product);
    return tokens.every((token) => text.includes(token));
  });
});
const results = computed(() => allResults.value.slice(0, 20));

watch([debouncedQuery, allResults], ([query, matches]) => {
  const term = normalize(query).replace(/\s+/g, " ");
  if ([...term].length < 2) return;
  trackAnalytics(
    "search",
    { searchTerm: term, resultCount: matches.length },
    `search:${term}`,
  );
});

watch(rawQuery, (query) => {
  window.clearTimeout(debounceTimer);
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) {
    debouncedQuery.value = "";
    isDebouncing.value = false;
    return;
  }
  if ([...normalizedQuery].length < 2) {
    debouncedQuery.value = "";
    isDebouncing.value = false;
    return;
  }
  isDebouncing.value = true;
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = normalizedQuery;
    isDebouncing.value = false;
  }, 700);
});

function clearSearch() {
  window.clearTimeout(debounceTimer);
  rawQuery.value = "";
  debouncedQuery.value = "";
  isDebouncing.value = false;
}

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

function productCount(categoryId: string) {
  const ids = descendantIds(categoryId);
  return store.data.products.filter((product) => displaySectionIds(product).some((id) => ids.has(id)))
    .length;
}

onBeforeUnmount(() => window.clearTimeout(debounceTimer));
</script>
