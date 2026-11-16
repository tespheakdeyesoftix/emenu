<template>
  <section class="min-w-0 space-y-4" :aria-busy="loading">
    <div class="card space-y-3 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="display m-0 text-xl [overflow-wrap:anywhere]">
            {{ menuName(menu, locale) }}
          </h2>
          <p class="m-0 mt-1 text-xs font-semibold text-black/50">
            {{
              t(catalogScope ? "menus.catalogProductCount" : "menus.productCount", {
                count: pagination.total,
              })
            }}
            <template v-if="!menu.parentId">
              · {{ t("menus.qrIdentityOnly") }}</template
            >
            <template v-else-if="menu.source === 'pos'">
              · {{ t("menus.posManaged") }}</template
            >
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a
            v-if="previewUrl"
            class="btn-soft"
            :href="previewUrl"
            target="_blank"
            rel="noopener"
          >
            <ExternalLink :size="16" aria-hidden="true" />
            {{ t("menus.preview") }}
          </a>
          <button
            v-if="canAssign"
            type="button"
            class="btn-primary"
            :disabled="saving"
            @click="openSelection('assign')"
          >
            <Plus :size="16" aria-hidden="true" />
            {{ t("menus.assignProducts") }}
          </button>
          <MenuActionPopover
            v-if="canSort || canStartBulkDelete"
            v-slot="{ close }"
            :label="t('menus.productActions')"
            :disabled="saving || loading"
          >
            <button v-if="canSort" type="button" @click="close(); $emit('sortProducts', menu)">
              <ListOrdered :size="16" aria-hidden="true" />
              {{ t("menus.sortProductOrder") }}
            </button>
            <button v-if="canAssign" type="button" @click="close(); openSelection('unassign')">
              <Unlink :size="16" aria-hidden="true" />
              {{ t("menus.unassignProducts") }}
            </button>
            <button
              v-if="canStartBulkDelete"
              type="button"
              class="text-red-700"
              :disabled="!!loadError"
              @click="close(); bulkDeleteSelecting = true"
            >
              <Trash2 :size="16" aria-hidden="true" />
              {{ t("bulkProductDelete.action") }}
            </button>
          </MenuActionPopover>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="relative min-w-40 flex-1 sm:max-w-80">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
            :size="16"
            aria-hidden="true"
          />
          <input
            v-model="query"
            type="search"
            class="input !py-2.5 !pl-9"
            :aria-label="t('menus.searchProducts')"
            :placeholder="t('menus.searchProducts')"
          />
        </label>
        <select
          v-model="categoryId"
          class="input !w-auto max-w-full !py-2.5 sm:max-w-64"
          :aria-label="t('pages.catalog.categoryFilterLabel')"
        >
          <option value="">{{ t("menus.allCategories") }}</option>
          <option
            v-for="category in categoryOptions"
            :key="category.id"
            :value="category.id"
          >
            {{ category.label }}
          </option>
        </select>
        <div class="ml-auto flex shrink-0 gap-1 rounded-xl bg-cream p-1">
          <button
            v-for="{ mode, icon, label } in views"
            :key="mode"
            type="button"
            class="grid size-9 place-items-center rounded-lg transition"
            :class="viewMode === mode ? 'bg-ink text-white' : 'hover:bg-white'"
            :aria-label="t(label)"
            :aria-pressed="viewMode === mode"
            @click="viewMode = mode"
          >
            <component :is="icon" :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p v-if="!menu.parentId" class="m-0 text-sm text-black/55">
        {{ t("menus.chooseSubmenuToManage") }}
      </p>
      <BulkProductDeleteActions
        v-if="canEditProducts"
        hide-trigger
        v-model:selecting="bulkDeleteSelecting"
        v-model:selected-ids="bulkDeleteIds"
        :page-product-ids="products.map(({ id }) => id)"
        :scope-key="productFilterParams().toString()"
        :fetch-matches="fetchMatchingMenuProductIds"
        :disabled="loading || saving || !!loadError"
        @saved="refreshProducts"
      />
    </div>

    <p v-if="editError" class="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
      {{ editError }}
    </p>
    <p
      v-if="!dialog && actionError"
      class="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-700"
      role="alert"
    >
      {{ actionError }}
    </p>
    <p
      v-if="loadError"
      class="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-700"
      role="alert"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="loading"
      class="card p-6 text-center text-sm text-black/55"
      role="status"
    >
      {{ t("common.loading") }}
    </p>
    <p
      v-else-if="!products.length"
      class="card p-6 text-center text-sm text-black/55"
    >
      {{
        t(
          query.trim() || categoryId || (quickFilter && quickFilter !== "all")
            ? "menus.noMatchingProducts"
            : catalogScope ? "menus.noCatalogProducts" : "menus.noAssignedProducts",
        )
      }}
    </p>
    <div
      v-else
      class="grid gap-3"
      :class="
        viewMode === 'grid'
          ? 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
          : 'grid-cols-1'
      "
    >
      <article
        v-for="product in products"
        :key="product.id"
        class="card relative min-w-0 overflow-hidden"
        :class="
          viewMode === 'list' ? 'flex items-center gap-3 p-3' : 'flex flex-col'
        "
      >
        <MenuProductThumbnail
          :src="product.imageUrl"
          :class="
            viewMode === 'list'
              ? 'size-16 rounded-xl sm:size-20'
              : 'aspect-[4/3] w-full'
          "
        />
        <div class="min-w-0 flex-1" :class="viewMode === 'grid' ? 'p-3' : ''">
          <div class="flex min-w-0 items-center gap-2">
            <label v-if="canEditProducts && bulkDeleteSelecting" class="grid size-6 shrink-0 place-items-center">
              <input
                v-model="bulkDeleteIds"
                type="checkbox"
                :value="product.id"
                class="size-4 accent-red-600"
                :aria-label="t('bulkProductDelete.selectProduct', { name: productName(product) })"
              />
            </label>
            <h3 class="m-0 min-w-0 text-sm font-bold leading-snug [overflow-wrap:anywhere]">
              <button
                v-if="canEditProducts && !bulkDeleteSelecting"
                type="button"
                class="block max-w-full text-start hover:underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ink"
                :class="{ 'animate-pulse': loadingProductId === product.id }"
                :aria-label="t('menus.editNamed', { name: productName(product) })"
                :aria-busy="loadingProductId === product.id"
                aria-haspopup="dialog"
                @click="openProductEditor(product.id)"
              >
                {{ productName(product) }}
              </button>
              <template v-else>{{ productName(product) }}</template>
            </h3>
          </div>
          <p
            v-if="product.categoryName || product.code"
            class="m-0 mt-1 text-xs text-black/55 [overflow-wrap:anywhere]"
          >
            {{
              [product.categoryName, product.code].filter(Boolean).join(" · ")
            }}
          </p>
          <p class="m-0 mt-2 text-sm font-bold">
            {{ formatCurrency(product.priceCents, admin.business.currency) }}
            <span v-if="product.unit" class="text-xs font-normal text-black/50">
              / {{ product.unit }}</span
            >
          </p>
          <p
            v-if="!product.isAvailable"
            class="m-0 mt-1 text-xs font-semibold text-black/50"
          >
            {{ t("menus.unpublishedProduct") }}
          </p>
        </div>
        <button
          v-if="!bulkDeleteSelecting && !admin.isReadOnly && (product.isAssigned ? menu.parentId : catalogScope)"
          type="button"
          class="relative z-10 flex shrink-0 items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold text-black/60 hover:bg-cream"
          :class="[
            viewMode === 'grid' ? 'border-t border-black/5' : 'min-h-9 min-w-9 rounded-xl border border-black/[.08] bg-cream',
            product.isAssigned ? 'hover:text-red-700' : 'hover:text-ink',
          ]"
          :disabled="saving"
          :aria-label="
            t(product.isAssigned ? 'menus.unassignProduct' : 'menus.assignProduct', {
              name: productName(product),
            })
          "
          :aria-haspopup="product.isAssigned || !canAssign ? 'dialog' : undefined"
          :title="t(product.isAssigned ? 'menus.unassign' : canAssign ? 'menus.assignHere' : 'menus.assignMenu')"
          @click="openCardAction(product)"
        >
          <component :is="product.isAssigned ? Unlink : Plus" :size="16" aria-hidden="true" />
          <span :class="viewMode === 'list' ? 'hidden lg:inline' : ''">{{
            t(product.isAssigned ? "menus.unassign" : canAssign ? "menus.assignHere" : "menus.assignMenu")
          }}</span>
        </button>
      </article>
    </div>
    <MenuProductPager
      :pagination="pagination"
      :disabled="loading || saving"
      @page="load"
    />
  </section>

  <ProductMenuPicker
    v-if="dialog === 'assign-card' && cardProduct"
    :selected-ids="[]"
    :assign-product-name="productName(cardProduct)"
    :root-id="menu.parentId ? undefined : menu.id"
    :saving="saving"
    :save-error="actionError"
    @close="closeDialog"
    @save="assignCardToMenus"
  />

  <ModalPanel
    :open="dialog === 'confirm-unassign' && !!cardProduct"
    :title="t('menus.unassign')"
    :close-on-backdrop="false"
    @close="closeDialog"
  >
    <p v-if="cardProduct" class="m-0 text-sm">
      {{
        t("menus.confirmUnassignProduct", {
          product: productName(cardProduct),
          menu: menuName(menu, locale),
        })
      }}
    </p>
    <p v-if="actionError" class="mb-0 mt-3 text-sm text-red-700" role="alert">
      {{ actionError }}
    </p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-soft" :disabled="saving" @click="closeDialog">
          {{ t("common.cancel") }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="saving"
          @click="cardProduct && changeAssignments('DELETE', [cardProduct.id])"
        >
          {{ t(saving ? "common.saving" : "menus.unassign") }}
        </button>
      </div>
    </template>
  </ModalPanel>

  <ModalPanel
    :open="dialog === 'assign' || dialog === 'unassign'"
    :title="selectionAction"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="!assignmentBusy"
    @close="closeDialog"
  >
    <div class="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
      <label class="relative block">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
          :size="16"
          aria-hidden="true"
        />
        <input
          v-model="candidateQuery"
          type="search"
          class="input !pl-9"
          :disabled="assignmentBusy"
          :aria-label="t('menus.searchProducts')"
          :placeholder="t('menus.searchProducts')"
        />
      </label>
      <select
        v-model="candidateCategoryId"
        class="input"
        :disabled="assignmentBusy"
        :aria-label="t('pages.catalog.categoryFilterLabel')"
      >
        <option value="">{{ t("menus.allCategories") }}</option>
        <option
          v-for="category in categoryOptions"
          :key="category.id"
          :value="category.id"
        >
          {{ category.label }}
        </option>
      </select>
    </div>
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        class="btn-soft !py-2"
        :disabled="
          assignmentBusy ||
          candidatesLoading ||
          Boolean(candidateError) ||
          !candidatePagination.total
        "
        @click="selectAllMatches"
      >
        {{ t(selectingAll ? "common.loading" : "menus.selectAll") }}
      </button>
      <button
        type="button"
        class="btn-soft !py-2"
        :disabled="assignmentBusy || !selectedIds.length"
        @click="selectedIds = []"
      >
        {{ t("menus.unselectAll") }}
      </button>
    </div>
    <p
      v-if="candidateError || actionError"
      class="text-sm text-red-700"
      role="alert"
    >
      {{ candidateError || actionError }}
    </p>
    <p
      v-if="candidatesLoading"
      class="py-4 text-sm text-black/55"
      role="status"
    >
      {{ t("common.loading") }}
    </p>
    <p
      v-else-if="!candidates.length && !candidateError"
      class="py-4 text-sm text-black/55"
    >
      {{
        t(
          candidateQuery.trim() || candidateCategoryId
            ? "menus.noMatchingProducts"
            : dialog === "unassign"
              ? "menus.noAssignedProducts"
              : "menus.noAvailableProducts",
        )
      }}
    </p>
    <div v-else class="mb-4 grid gap-2 sm:grid-cols-2">
      <label
        v-for="product in candidates"
        :key="product.id"
        class="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 p-2 hover:bg-cream"
      >
        <input
          v-model="selectedIds"
          type="checkbox"
          :value="product.id"
          :disabled="assignmentBusy"
          class="size-4 shrink-0 accent-black"
        />
        <MenuProductThumbnail
          :src="product.imageUrl"
          class="size-12 rounded-lg"
        />
        <span class="min-w-0 flex-1">
          <strong class="block truncate text-sm">{{
            productName(product)
          }}</strong>
          <small class="block truncate text-black/55">{{
            [product.categoryName, product.code].filter(Boolean).join(" · ")
          }}</small>
        </span>
      </label>
    </div>
    <MenuProductPager
      :pagination="candidatePagination"
      :disabled="candidatesLoading || assignmentBusy"
      @page="loadCandidates"
    />
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm font-bold text-black/55" aria-live="polite">{{
          t("menus.selected", { count: selectedIds.length })
        }}</span>
        <button
          type="button"
          class="btn-primary"
          :disabled="assignmentBusy || !selectedIds.length"
          @click="
            changeAssignments(
              dialog === 'unassign' ? 'DELETE' : 'POST',
              selectedIds,
            )
          "
        >
          {{ selectionAction }}
        </button>
      </div>
    </template>
  </ModalPanel>

  <ModalPanel
    :open="dialog === 'order'"
    :title="t('menus.sortProductOrder')"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="!saving"
    @close="closeDialog"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="m-0 text-sm text-black/55">{{ t("menus.orderHelp") }}</p>
      <label class="flex items-center gap-2 text-sm font-semibold">
        {{ t("menus.orderLayout") }}
        <select
          v-model.number="orderColumns"
          class="input !w-auto !py-2"
          :disabled="saving"
        >
          <option :value="1">{{ t("menus.listView") }}</option>
          <option v-for="count in [2, 3, 4, 5, 6]" :key="count" :value="count">
            {{ t("menus.gridColumns", { count }) }}
          </option>
        </select>
      </label>
    </div>
    <p v-if="actionError" class="text-sm text-red-700" role="alert">
      {{ actionError }}
    </p>
    <p v-if="orderLoading" class="py-4 text-sm text-black/55" role="status">
      {{ t("common.loading") }}
    </p>
    <p
      v-else-if="!orderProducts.length && !actionError"
      class="py-4 text-sm text-black/55"
    >
      {{ t("menus.noAssignedProducts") }}
    </p>
    <draggable
      v-else
      v-model="orderProducts"
      item-key="id"
      handle=".menu-sort-handle"
      :animation="150"
      :disabled="saving"
      class="grid grid-cols-[repeat(var(--phone-columns),minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(var(--tablet-columns),minmax(0,1fr))] lg:grid-cols-[repeat(var(--order-columns),minmax(0,1fr))]"
      :style="{
        '--phone-columns': Math.min(orderColumns, 2),
        '--tablet-columns': Math.min(orderColumns, 4),
        '--order-columns': orderColumns,
      }"
    >
      <template #item="{ element: product, index }">
        <div
          class="flex min-w-0 items-center rounded-xl border border-black/10 bg-white"
          :class="orderColumns === 1 ? 'gap-2 p-2 sm:gap-3' : 'gap-1.5 p-1.5'"
        >
          <span
            class="menu-sort-handle grid shrink-0 cursor-grab touch-none place-items-center rounded-lg bg-cream"
            :class="orderColumns === 1 ? 'size-8' : 'size-6'"
            aria-hidden="true"
          >
            <GripVertical :size="16" />
          </span>
          <MenuProductThumbnail
            :src="product.imageUrl"
            class="rounded-lg"
            :class="orderColumns === 1 ? 'size-10' : 'size-7 sm:size-8'"
          />
          <strong
            class="min-w-0 flex-1 truncate text-sm"
            :title="productName(product)"
          >
            {{ productName(product) }}
          </strong>
          <div
            class="flex shrink-0"
            :class="orderColumns === 1 ? 'gap-2' : 'flex-col'"
          >
            <button
              type="button"
              class="grid place-items-center rounded-lg hover:bg-cream disabled:opacity-30"
              :class="orderColumns === 1 ? 'size-8' : 'size-5'"
              :disabled="saving || index === 0"
              :aria-label="t('menus.moveUp', { name: productName(product) })"
              @click="move(index, -1)"
            >
              <ArrowUp :size="16" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="grid place-items-center rounded-lg hover:bg-cream disabled:opacity-30"
              :class="orderColumns === 1 ? 'size-8' : 'size-5'"
              :disabled="saving || index === orderProducts.length - 1"
              :aria-label="t('menus.moveDown', { name: productName(product) })"
              @click="move(index, 1)"
            >
              <ArrowDown :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>
      </template>
    </draggable>
    <template #footer>
      <button
        type="button"
        class="btn-primary w-full"
        :disabled="saving || orderLoading || !orderProducts.length"
        @click="saveOrder"
      >
        {{ t("menus.saveOrder") }}
      </button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import draggable from "vuedraggable";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  List,
  ListOrdered,
  Plus,
  Search,
  Trash2,
  Unlink,
} from "lucide-vue-next";
import {
  useAdminStore,
  type Category,
  type Product,
  type ProductPriceEntry,
} from "../stores/admin";
import {
  menuName,
  type MenuNode,
  type MenuProduct,
  type MenuProductCounts,
  type MenuProductFilter,
  type MenuProductPage,
} from "../types/menu";
import { formatCurrency } from "../utils/currency";
import BulkProductDeleteActions from "./BulkProductDeleteActions.vue";
import MenuActionPopover from "./MenuActionPopover.vue";
import MenuProductPager from "./MenuProductPager.vue";
import MenuProductThumbnail from "./MenuProductThumbnail.vue";
import ModalPanel from "./ModalPanel.vue";
import ProductMenuPicker from "./ProductMenuPicker.vue";

const props = defineProps<{
  menu: MenuNode;
  hasSubmenus: boolean;
  categories: Category[];
  previewUrl?: string;
  quickFilter: MenuProductFilter | null;
  canEditProducts: boolean;
}>();
const emit = defineEmits<{
  counts: [counts: MenuProductCounts];
  sortProducts: [menu: MenuNode];
  editProduct: [product: Product, priceEntries: ProductPriceEntry[]];
}>();
const viewMode = defineModel<"grid" | "list">("viewMode", { required: true });
const { t, locale } = useI18n();
const admin = useAdminStore();
const loadingProductId = ref("");
const editError = ref("");
const endpoint = computed(() => `/api/admin/menus/${props.menu.id}/products`);
const canAssign = computed(() => Boolean(props.menu.parentId) && !admin.isReadOnly);
const canSort = computed(() => canAssign.value || (props.hasSubmenus && !admin.isReadOnly));
const views = [
  { mode: "grid", icon: LayoutGrid, label: "menus.gridView" },
  { mode: "list", icon: List, label: "menus.listView" },
] as const;
const dialog = ref<"" | "assign" | "unassign" | "order" | "assign-card" | "confirm-unassign">("");
const cardProduct = ref<MenuProduct>();
const selectionAction = computed(() =>
  t(
    dialog.value === "unassign"
      ? "menus.unassignProducts"
      : "menus.assignProducts",
  ),
);
const selectedIds = ref<string[]>([]);
const bulkDeleteSelecting = ref(false);
const bulkDeleteIds = ref<string[]>([]);
const selectingAll = ref(false);
const orderProducts = ref<MenuProduct[]>([]);
const orderColumns = ref(3);
const saving = ref(false);
const assignmentBusy = computed(() => saving.value || selectingAll.value);
const orderLoading = ref(false);
const actionError = ref("");
let active = true;
let orderRequest = 0;

const categoryOptions = computed(() => {
  const children = new Map<string | null, Category[]>();
  for (const category of props.categories) {
    const parentId = category.parentId || null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(category);
    children.set(parentId, siblings);
  }
  function visit(
    parentId: string | null,
    depth: number,
  ): { id: string; label: string }[] {
    return (children.get(parentId) ?? []).flatMap((category) => {
      const name =
        (locale.value === "en" ? category.nameEn : category.nameKm) ||
        category.name;
      return [
        { id: category.id, label: "\u00a0\u00a0".repeat(depth) + name },
        ...visit(category.id, depth + 1),
      ];
    });
  }
  return visit(null, 0);
});

function productName(product: MenuProduct) {
  return (
    (locale.value === "en" ? product.nameEn : product.nameKm) ||
    product.name ||
    product.nameEn ||
    product.nameZh ||
    product.id
  );
}

function useProductsPage({
  unassigned = (): boolean => false,
  filter = (): MenuProductFilter => "all",
  includeCounts = false,
  catalogBrowsing = false,
} = {}) {
  const query = ref("");
  const categoryId = ref("");
  const catalogScope = computed(
    () => catalogBrowsing && (
      props.quickFilter !== null || Boolean(props.menu.parentId && !props.hasSubmenus && categoryId.value)
    ),
  );
  const products = ref<MenuProduct[]>([]);
  const pagination = ref({ page: 1, pageSize: 48, total: 0 });
  const loading = ref(true);
  const error = ref("");
  let requestId = 0;
  let timer = 0;

  function filterParams() {
    const params = new URLSearchParams({
      query: query.value.trim(),
    });
    if (categoryId.value) params.set("categoryId", categoryId.value);
    if (catalogScope.value) params.set("catalog", "1");
    else if (catalogBrowsing && props.menu.parentId && props.hasSubmenus) params.set("includeDescendants", "1");
    if (unassigned()) params.set("unassigned", "1");
    const quickFilter = filter();
    if (quickFilter !== "all") params.set("filter", quickFilter);
    return params;
  }

  async function load(page = 1): Promise<void> {
    window.clearTimeout(timer);
    const id = ++requestId;
    const params = filterParams();
    params.set("page", String(page));
    if (includeCounts) params.set("includeCounts", "1");
    loading.value = true;
    error.value = "";
    try {
      const data = (await admin.request(
        `${endpoint.value}?${params}`,
      )) as MenuProductPage;
      if (id !== requestId) return;
      if (data.counts) emit("counts", data.counts);
      const last = Math.max(
        1,
        Math.ceil(data.pagination.total / data.pagination.pageSize),
      );
      if (page > last) return await load(last);
      products.value = data.products;
      pagination.value = data.pagination;
    } catch (cause) {
      if (id === requestId)
        error.value = String(cause instanceof Error ? cause.message : cause);
    } finally {
      if (id === requestId) loading.value = false;
    }
  }
  watch([query, categoryId], () => {
    window.clearTimeout(timer);
    requestId++;
    loading.value = true;
    timer = window.setTimeout(() => void load(), 250);
  });
  onBeforeUnmount(() => {
    window.clearTimeout(timer);
    requestId++;
  });
  return {
    query,
    categoryId,
    catalogScope,
    products,
    pagination,
    loading,
    error,
    load,
    filterParams,
  };
}

const {
  query,
  categoryId,
  catalogScope,
  products,
  pagination,
  loading,
  error: loadError,
  load,
  filterParams: productFilterParams,
} = useProductsPage({
  filter: () => props.quickFilter ?? "all",
  includeCounts: true,
  catalogBrowsing: true,
});
watch(() => props.quickFilter, () => void load());

const canStartBulkDelete = computed(
  () => props.canEditProducts && !bulkDeleteSelecting.value && products.value.length > 0,
);

async function fetchProductIds(params: URLSearchParams, mode: "1" | "matches") {
  params.set("ids", mode);
  const { productIds } = (await admin.request(`${endpoint.value}?${params}`)) as {
    productIds: string[];
  };
  return productIds;
}

function fetchMatchingMenuProductIds() {
  return fetchProductIds(productFilterParams(), "matches");
}

function refreshProducts() {
  return load(pagination.value.page);
}

function clearCategory() {
  categoryId.value = "";
}

async function openProductEditor(productId: string) {
  if (!props.canEditProducts || saving.value || loadingProductId.value || dialog.value)
    return;
  editError.value = "";
  loadingProductId.value = productId;
  try {
    const { product, priceEntries } = await admin.fetchCatalogProduct(productId);
    if (!active || !props.canEditProducts || dialog.value) return;
    if (product) emit("editProduct", product, priceEntries);
    else editError.value = t("menus.productNotFound");
  } catch (cause) {
    if (active) editError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loadingProductId.value = "";
  }
}
const {
  query: candidateQuery,
  categoryId: candidateCategoryId,
  products: candidates,
  pagination: candidatePagination,
  loading: candidatesLoading,
  error: candidateError,
  load: loadCandidates,
  filterParams: candidateFilterParams,
} = useProductsPage({
  unassigned: () => dialog.value === "assign",
  filter: () =>
    dialog.value === "unassign" && props.quickFilter !== "unassigned-menu"
      ? props.quickFilter ?? "all"
      : "all",
});

function openCardAction(product: MenuProduct) {
  if (saving.value || admin.isReadOnly) return;
  actionError.value = "";
  if (!product.isAssigned && canAssign.value) {
    void changeAssignments("POST", [product.id]);
    return;
  }
  cardProduct.value = product;
  dialog.value = product.isAssigned ? "confirm-unassign" : "assign-card";
}

function assignCardToMenus(menuIds: string[]) {
  if (cardProduct.value && menuIds.length)
    return saveProductChanges("/api/admin/menus/assign-product", "POST", {
      productId: cardProduct.value.id,
      menuIds,
    });
}

function openSelection(mode: "assign" | "unassign") {
  actionError.value = "";
  selectedIds.value = [];
  dialog.value = mode;
  const initialQuery = mode === "unassign" ? query.value : "";
  if (
    candidateQuery.value !== initialQuery ||
    candidateCategoryId.value !== categoryId.value
  ) {
    candidateQuery.value = initialQuery;
    candidateCategoryId.value = categoryId.value;
  } else void loadCandidates();
}

async function selectAllMatches() {
  if (assignmentBusy.value || candidatesLoading.value) return;
  selectingAll.value = true;
  actionError.value = "";
  try {
    const productIds = await fetchProductIds(candidateFilterParams(), "1");
    if (active)
      selectedIds.value = [
        ...new Set([...selectedIds.value, ...productIds]),
      ];
  } catch (cause) {
    if (active)
      actionError.value = String(
        cause instanceof Error ? cause.message : cause,
      );
  } finally {
    selectingAll.value = false;
  }
}

async function openOrder() {
  if (!canAssign.value || saving.value) return;
  const id = ++orderRequest;
  actionError.value = "";
  orderProducts.value = [];
  dialog.value = "order";
  orderLoading.value = true;
  try {
    const data = (await admin.request(
      `${endpoint.value}/order`,
    )) as MenuProductPage;
    if (id === orderRequest) orderProducts.value = data.products;
  } catch (cause) {
    if (id === orderRequest)
      actionError.value = String(
        cause instanceof Error ? cause.message : cause,
      );
  } finally {
    if (id === orderRequest) orderLoading.value = false;
  }
}

function closeDialog() {
  if (assignmentBusy.value) return;
  orderRequest++;
  dialog.value = "";
  cardProduct.value = undefined;
  actionError.value = "";
}

function move(index: number, offset: number) {
  const [product] = orderProducts.value.splice(index, 1);
  orderProducts.value.splice(index + offset, 0, product);
}

async function saveProductChanges(path: string, method: "POST" | "DELETE" | "PUT", body: object) {
  if (saving.value || admin.isReadOnly) return;
  saving.value = true;
  actionError.value = "";
  try {
    await admin.request(path, { method, body: JSON.stringify(body) });
    if (!active) return;
    dialog.value = "";
    cardProduct.value = undefined;
    await refreshProducts();
    admin.notify(t("menus.productsSaved"));
  } catch (cause) {
    if (active)
      actionError.value = String(
        cause instanceof Error ? cause.message : cause,
      );
  } finally {
    saving.value = false;
  }
}

function changeAssignments(method: "POST" | "DELETE", productIds: string[]) {
  if (productIds.length)
    return saveProductChanges(endpoint.value, method, { productIds });
}

function saveOrder() {
  const productIds = orderProducts.value.map(({ id }) => id);
  if (productIds.length)
    return saveProductChanges(`${endpoint.value}/order`, "PUT", { productIds });
}
onMounted(() => void load());
onBeforeUnmount(() => {
  active = false;
  orderRequest++;
});
defineExpose({
  refreshProducts,
  clearCategory,
  openAssign: () => { if (canAssign.value) openSelection("assign"); },
  openOrder,
});
</script>
