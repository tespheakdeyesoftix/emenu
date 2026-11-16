<template>
  <RouterView v-if="route.meta.booking" />
  <div
    v-else
    class="menu-theme min-h-screen text-ink"
    :style="[
      themeVariables,
      { '--menu-table-strip-height': `${tableStripHeight}px` },
    ]"
    :data-theme-mode="theme.mode"
    :data-card-style="theme.cardStyle"
    :data-corner-style="theme.cornerStyle"
    :data-image-ratio="theme.imageRatio"
    :data-header-style="theme.headerStyle"
    :data-category-style="theme.categoryStyle"
    :data-bottom-nav-visible="theme.showBottomNav ? 'true' : 'false'"
    :data-bottom-nav-style="theme.bottomNavStyle"
    :data-background-type="theme.backgroundType"
    :data-background-pattern="theme.backgroundPattern"
    :data-background-pattern-kind="backgroundPatternKind"
    :data-background-fit="theme.backgroundImageFit"
  >
    <div
      v-if="store.loading"
      class="grid min-h-screen place-items-center bg-cream"
      role="status"
      aria-label="Loading menu"
    >
      <LoaderCircle :size="36" class="animate-spin text-tomato" />
    </div>
    <MenuUnavailable v-else-if="store.menuUnavailable" @retry="retry" />
    <MenuUnavailable v-else-if="store.loadError" mode="error" @retry="retry" />
    <template v-else-if="store.connected">
      <RouterView v-slot="{ Component, route: viewRoute }">
        <KeepAlive :max="10">
          <component :is="Component" :key="viewRoute.fullPath.split('#')[0]" />
        </KeepAlive>
      </RouterView>
      <ProductDrawer />
      <LanguagePreferenceModal
        :open="store.languagePreferenceRequired"
        :languages="store.availableLanguages"
        @select="store.setLanguage"
      />
      <LocationPermissionModal
        v-if="locationPrompt"
        :mode="locationPrompt"
        :language="store.selectedLanguage"
        @allow="store.allowOrderLocation"
        @dismiss="store.orderLocationPrompt = ''"
      />
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-3 scale-95 opacity-0"
        leave-active-class="transition duration-200 ease-in"
        leave-to-class="translate-y-3 scale-95 opacity-0"
        mode="out-in"
      >
        <div
          v-if="store.cartToast"
          :key="store.cartToastId"
          class="menu-floating-bottom fixed left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-action px-4 py-3 text-sm font-bold text-on-action shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-ink"
          >
            <CircleCheck :size="19" />
          </span>
          <span class="min-w-0 flex-1">{{ store.cartToast }}</span>
        </div>
      </Transition>
      <div
        v-if="theme.showBottomNav || store.tableContext"
        class="menu-bottom-dock"
        :data-nav-style="theme.showBottomNav ? theme.bottomNavStyle : undefined"
      >
        <div v-if="store.tableContext" ref="tableStrip" class="menu-table-strip">
          <TableContextLabel
            :table="store.tableContext"
            class="justify-center px-3 py-2 text-center"
          />
        </div>
        <BottomNav v-if="theme.showBottomNav" />
      </div>
    </template>
    <dialog
      ref="orderSubmissionDialog"
      class="m-auto w-11/12 max-w-xs rounded-[2rem] bg-surface p-6 text-center text-ink shadow-2xl backdrop:bg-black/60"
      aria-labelledby="order-submission-title"
      @cancel.prevent
    >
      <LoaderCircle :size="32" class="mx-auto text-tomato motion-safe:animate-spin" aria-hidden="true" />
      <p id="order-submission-title" class="mb-0 mt-3 font-bold">
        {{ uiText(store.selectedLanguage).submittingOrder }}
      </p>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CircleCheck, LoaderCircle } from "lucide-vue-next";
import BottomNav from "./components/BottomNav.vue";
import LanguagePreferenceModal from "./components/LanguagePreferenceModal.vue";
import LocationPermissionModal from "./components/LocationPermissionModal.vue";
import MenuUnavailable from "./components/MenuUnavailable.vue";
import ProductDrawer from "./components/ProductDrawer.vue";
import TableContextLabel from "./components/TableContextLabel.vue";
import {
  PRODUCT_DRAWER_HISTORY_STATE,
  productIdFromHash,
} from "./composables/useProductDrawerNavigation";
import { useMenuStore } from "./stores/menu";
import { uiText } from "./uiText";
import { isCustomMenuHostname } from "./utils/menuHost";
import { defaultMenuTheme, menuThemeVariables } from "./theme";
import { isCulturalMenuPattern } from "../../../shared/menuPatterns";
import { menuKhmerFontFamily } from "../../../shared/menuFonts";

const store = useMenuStore();
const route = useRoute();
const router = useRouter();
const fallbackDocumentTitle = "Angkor eMenu";
const orderSubmissionDialog = ref<HTMLDialogElement | null>(null);
const tableStrip = ref<HTMLElement | null>(null);
const tableStripHeight = ref(0);
const locationPrompt = computed(
  () => (store.languagePreferenceRequired ? "" : store.orderLocationPrompt),
);
const documentScrollLocked = computed(
  () =>
    !route.meta.booking && (Boolean(store.selected) ||
    store.languagePreferenceRequired ||
    store.submittingOrder ||
    Boolean(locationPrompt.value)),
);
const theme = computed(
  () =>
    store.data.business.menuTheme ||
    defaultMenuTheme(store.data.business.themeColor),
);
const themeVariables = computed(() => menuThemeVariables(theme.value));
watch(
  () => route.meta.booking ? undefined : theme.value.khmerFont,
  (font, _, onCleanup) => {
    if (!font) return;
    const style = document.documentElement.style;
    style.setProperty("--menu-font-khmer", menuKhmerFontFamily(font));
    onCleanup(() => style.removeProperty("--menu-font-khmer"));
  },
  { immediate: true },
);
const backgroundPatternKind = computed(() =>
  isCulturalMenuPattern(theme.value.backgroundPattern) ? "cultural" : "css",
);
let lockedScrollY = 0;
let cartExpiryTimer = 0;
let previousHtmlOverflow = "";
let previousBodyStyles = { overflow: "", position: "", top: "", width: "" };

function scopeParam(key: "branch" | "menu") {
  if (!(key in route.query)) return null;
  const value = route.query[key];
  return typeof value === "string" ? value : "";
}

function retry() {
  const hostname = window.location.hostname;
  void store.load(
    isCustomMenuHostname(hostname) ? "" : String(route.params.slug || ""),
    String(route.query.table || ""),
    { force: true, hostname, tableId: String(route.query.table_id || ""), branch: scopeParam("branch"), menu: scopeParam("menu") },
  );
}

function scheduleCartExpiry() {
  window.clearTimeout(cartExpiryTimer);
  const nextDay = new Date();
  nextDay.setHours(24, 0, 0, 0);
  cartExpiryTimer = window.setTimeout(
    () => {
      store.expireCartIfNeeded();
      scheduleCartExpiry();
    },
    Math.max(1000, nextDay.getTime() - Date.now() + 250),
  );
}

function refreshDailyCart() {
  store.expireCartIfNeeded();
  scheduleCartExpiry();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") refreshDailyCart();
}

function setDocumentScrollLocked(locked: boolean) {
  if (locked) {
    lockedScrollY = window.scrollY;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = "100%";
    return;
  }
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.overflow = previousBodyStyles.overflow;
  document.body.style.position = previousBodyStyles.position;
  document.body.style.top = previousBodyStyles.top;
  document.body.style.width = previousBodyStyles.width;
  window.scrollTo(0, lockedScrollY);
}

watch(
  [
    () =>
      isCustomMenuHostname(window.location.hostname)
        ? ""
        : String(route.params.slug || ""),
    () => String(route.query.table || ""),
    () => String(route.query.table_id || ""),
    () => scopeParam("branch"),
    () => scopeParam("menu"),
    () => Boolean(route.meta.booking),
  ],
  ([slug, tableToken, tableId, branch, menu, booking]) => {
    if (booking) return;
    void store.load(slug, tableToken, {
      hostname: window.location.hostname,
      tableId,
      branch,
      menu,
    });
  },
  { immediate: true },
);
watch(
  [() => store.connected, () => route.fullPath, () => store.data.products],
  ([connected]) => {
    if (!connected || route.meta.booking) return;
    const hash = route.hash;
    const productId = productIdFromHash(hash);
    const product = productId
      ? store.data.products.find((item) => item.id === productId)
      : undefined;
    const clearHash = Boolean(productId && !product);
    const slug = route.params.slug;
    const replaceSlug = typeof slug === "string" && store.currentSlug && slug !== store.currentSlug;
    const defaultMenu = scopeParam("menu") === null ? store.currentMenuSlug : null;
    if (route.name && (replaceSlug || defaultMenu !== null || clearHash)) {
      void router.replace({
        name: route.name,
        params: replaceSlug ? { ...route.params, slug: store.currentSlug } : route.params,
        query: defaultMenu === null ? route.query : { ...route.query, menu: defaultMenu },
        hash: clearHash ? "" : hash,
        state: clearHash ? { [PRODUCT_DRAWER_HISTORY_STATE]: false } : undefined,
      });
    }
    if (!product) {
      if (store.selected) store.closeProductSelection();
      return;
    }
    if (store.selected?.id !== product.id) store.openProduct(product);
  },
  { immediate: true },
);
watch(
  tableStrip,
  (strip, _, onCleanup) => {
    if (!strip) {
      tableStripHeight.value = 0;
      return;
    }
    const measure = () => {
      tableStripHeight.value = Math.ceil(strip.getBoundingClientRect().height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    onCleanup(() => observer.disconnect());
  },
  { flush: "post" },
);
watch(documentScrollLocked, setDocumentScrollLocked);
watch(() => store.submittingOrder, (submitting) => {
  if (submitting) orderSubmissionDialog.value?.showModal();
  else orderSubmissionDialog.value?.close();
}, { flush: "post" });
watch(
  () => store.data.business.name,
  (businessName) => {
    if (!route.meta.booking) document.title = businessName.trim() || fallbackDocumentTitle;
  },
  { immediate: true },
);
onMounted(() => {
  scheduleCartExpiry();
  document.addEventListener("visibilitychange", handleVisibilityChange);
});
onBeforeUnmount(() => {
  window.clearTimeout(cartExpiryTimer);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  if (documentScrollLocked.value) setDocumentScrollLocked(false);
});
</script>
