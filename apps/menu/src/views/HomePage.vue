<template>
  <div>
    <BusinessHero />
    <main
      class="menu-page-bottom-space mx-auto max-w-6xl px-4 pt-7 sm:px-6 sm:pt-9"
    >
      <FeaturedMenuSwiper />
      <CategoryRail :category-in-view="categoryInView" />
      <div class="mt-5 flex items-center justify-end gap-2">
        <span class="text-sm font-bold text-ink/40">{{ t("menu.view") }}</span>
        <div
          class="menu-view-switch flex rounded-xl border border-ink/[.08] bg-surface p-1 shadow-sm"
        >
          <button
            type="button"
            class="grid size-11 place-items-center rounded-lg transition"
            :aria-label="t('menu.gridView')"
            :aria-pressed="productView === 'grid'"
            @click="setProductView('grid')"
          >
            <LayoutGrid :size="20" />
          </button>
          <button
            type="button"
            class="grid size-11 place-items-center rounded-lg transition"
            :aria-label="t('menu.listView')"
            :aria-pressed="productView === 'list'"
            @click="setProductView('list')"
          >
            <List :size="21" />
          </button>
        </div>
      </div>

      <section
        v-for="group in visibleGroups"
        :id="`category-${group.category.id}`"
        :key="group.category.id"
        :data-menu-category="group.category.id"
        class="mt-7 scroll-mt-36"
      >
        <div class="mb-5 flex items-end justify-between gap-4">
          <h2
            class="menu-category-title font-display m-0 font-extrabold leading-tight"
          >
            {{ store.nameFor(group.category) }}
          </h2>
          <span class="text-sm font-bold text-ink/40">
            {{ t("menu.dishes", { count: group.total }) }}
          </span>
        </div>
        <div
          class="grid gap-3 sm:gap-5"
          :class="
            productView === 'list'
              ? 'grid-cols-1'
              : 'grid-cols-2 lg:grid-cols-3'
          "
        >
          <ProductCard
            v-for="product in group.products"
            :key="product.id"
            :product="product"
            :view-mode="productView"
          />
        </div>
      </section>

      <div
        v-if="!store.loading && !store.filtered.length"
        class="py-20 text-center text-sm text-ink/40"
      >
        {{ t("menu.noItems") }}
      </div>
      <button
        v-if="hasMoreProducts"
        ref="loadMoreTrigger"
        type="button"
        class="mx-auto mt-10 block rounded-full border border-ink/[.08] bg-surface px-5 py-3 text-sm font-bold text-ink/50 shadow-sm"
        @click="loadMoreProducts"
      >
        {{ t("menu.loadMore") }}
      </button>
      <footer class="mt-14 border-t border-ink/[.08] py-8 text-center">
        <div class="font-display font-extrabold">
          {{ store.data.business.name }}
        </div>
        <p class="text-xs text-ink/40">{{ t("footer.powered") }}</p>
      </footer>
    </main>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <button
        v-if="showBackToTop"
        type="button"
        class="menu-floating-bottom fixed right-4 z-30 grid size-11 place-items-center rounded-full bg-action text-on-action shadow-xl sm:right-6"
        aria-label="Back to top"
        @click="scrollToTop"
      >
        <ArrowUp :size="19" stroke-width="2.5" />
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { ArrowUp, LayoutGrid, List } from "lucide-vue-next";
import BusinessHero from "../components/BusinessHero.vue";
import FeaturedMenuSwiper from "../components/FeaturedMenuSwiper.vue";
import CategoryRail from "../components/CategoryRail.vue";
import ProductCard from "../components/ProductCard.vue";
import { displaySectionIds, orderMenuProducts, useMenuStore } from "../stores/menu";

const store = useMenuStore();
const { t } = useI18n();
const categoryInView = ref("");
const showBackToTop = ref(false);
type ProductView = "grid" | "list";
const savedProductView = localStorage.getItem("angkor_emenu_product_view");
const productView = ref<ProductView>(
  savedProductView === "list" || savedProductView === "grid"
    ? savedProductView
    : store.data.business.menuTheme.defaultProductView,
);
const productsPerPage = 24;
const visibleProductLimit = ref(productsPerPage);
const loadMoreTrigger = ref<HTMLElement | null>(null);
let loadMoreObserver: IntersectionObserver | null = null;
let categoryScrollFrame: number | null = null;

const productGroups = computed(() =>
  store.data.categories
    .map((category) => ({
      category,
      products: orderMenuProducts(
        store.filtered.filter((product) => displaySectionIds(product).includes(category.id)),
        [category.id],
      ),
    }))
    .filter((group) => group.products.length > 0),
);
const visibleGroups = computed(() => {
  let remaining = visibleProductLimit.value;
  return productGroups.value
    .map((group) => {
      const products = group.products.slice(0, Math.max(remaining, 0));
      remaining -= products.length;
      return { ...group, products, total: group.products.length };
    })
    .filter((group) => group.products.length > 0);
});
const hasMoreProducts = computed(
  () => visibleProductLimit.value < productGroups.value.reduce((total,group) => total + group.products.length,0),
);

function loadMoreProducts() {
  visibleProductLimit.value += productsPerPage;
}
function setProductView(view: ProductView) {
  productView.value = view;
  localStorage.setItem("angkor_emenu_product_view", view);
}
function updateCategoryInView() {
  categoryScrollFrame = null;
  showBackToTop.value = window.scrollY > 600;
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-menu-category]"),
  );
  const rail = document.querySelector<HTMLElement>("[data-category-rail]");
  const activationLine = (rail?.getBoundingClientRect().bottom || 0) + 16;
  let currentCategory = "";
  for (const section of sections) {
    if (section.getBoundingClientRect().top > activationLine) break;
    currentCategory = section.dataset.menuCategory || "";
  }
  categoryInView.value = currentCategory;
}
function scheduleCategoryUpdate() {
  if (categoryScrollFrame !== null) return;
  categoryScrollFrame = window.requestAnimationFrame(updateCategoryInView);
}
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function scrollSelectedMenuIntoView(categoryId: string) {
  window.requestAnimationFrame(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-menu-category]"),
    );
    const target =
      sections.find((section) => section.dataset.menuCategory === categoryId) ||
      sections[0];
    if (!target) return;
    const rail = document.querySelector<HTMLElement>("[data-category-rail]");
    const stickyOffset = (rail?.offsetHeight || 0) + 16;
    const top = Math.max(
      0,
      window.scrollY + target.getBoundingClientRect().top - stickyOffset,
    );
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  });
}

function activatePage() {
  deactivatePage();
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (
        entries.some((entry) => entry.isIntersecting) &&
        hasMoreProducts.value
      )
        loadMoreProducts();
    },
    { rootMargin: "500px 0px" },
  );
  if (loadMoreTrigger.value) loadMoreObserver.observe(loadMoreTrigger.value);
  scheduleCategoryUpdate();
  window.addEventListener("scroll", scheduleCategoryUpdate, { passive: true });
  window.addEventListener("resize", scheduleCategoryUpdate);
}

function deactivatePage() {
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
  window.removeEventListener("scroll", scheduleCategoryUpdate);
  window.removeEventListener("resize", scheduleCategoryUpdate);
  if (categoryScrollFrame !== null) {
    window.cancelAnimationFrame(categoryScrollFrame);
    categoryScrollFrame = null;
  }
}

onActivated(activatePage);
onDeactivated(deactivatePage);
watch(loadMoreTrigger, (element) => {
  loadMoreObserver?.disconnect();
  if (element) loadMoreObserver?.observe(element);
});
watch(
  () => store.activeCategory,
  async (categoryId) => {
    visibleProductLimit.value = productsPerPage;
    categoryInView.value = "";
    await nextTick();
    scrollSelectedMenuIntoView(categoryId);
    scheduleCategoryUpdate();
  },
);
onBeforeUnmount(deactivatePage);
</script>
