<template>
  <div>
    <PageHeader :title="t('pages.orders.title')">
      <OrderFilterFields class="hidden md:contents" v-model="filters" :options="filterOptions" :status-options="statusOptions" />
      <Button
        class="hidden md:inline-flex"
        variant="subtle" size="lg"
        type="button"
        :disabled="loading"
        @click="loadOrders(1)"
      >
        <template #prefix><RefreshCw :size="16" /></template>{{ t("pages.orders.refresh") }}
      </Button>
      <Button
        id="orders-filter-button"
        class="md:hidden"
        :variant="filtersActive ? 'solid' : 'outline'"
        size="lg"
        icon="lucide-list-filter"
        :aria-label="t('pages.orders.filters')"
        aria-haspopup="dialog"
        :aria-expanded="filterSheetOpen"
        :aria-controls="filterSheetOpen ? 'orders-filter-options' : undefined"
        @click="openFilters"
      />
    </PageHeader>

    <BottomSheet v-model:open="filterSheetOpen" :title="t('pages.orders.filters')" @after-leave="restoreFilterFocus">
      <div id="orders-filter-options" data-no-sheet-drag class="px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <OrderFilterFields v-model="draftFilters" :options="filterOptions" :status-options="statusOptions" in-sheet />
        <div class="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" :label="t('pages.orders.clearFilters')" @click="draftFilters = emptyFilters()" />
          <Button variant="solid" size="lg" :label="t('pages.orders.applyFilters')" @click="applyFilters" />
        </div>
      </div>
    </BottomSheet>

    <Alert
      v-if="filterOptionsError"
      theme="amber"
      :title="t('pages.orders.filterOptionsFailed')"
      :primary-action="{ label: t('common.tryAgain'), onClick: loadFilterOptions }"
      class="mb-4"
    />

    <Alert v-if="telegramAlert && !telegramAlert.telegramOrder" :title="t('pages.orders.telegramTest')" class="mb-4" />

    <section class="card overflow-hidden" :aria-busy="loading">
      <LoadingText v-if="loading" :text="t('common.loading')" role="status" class="p-6" />
      <Alert v-else-if="listError" theme="red" :title="t('pages.orders.loadFailed')" class="m-4" />
      <p v-else-if="!orders.length" class="m-0 p-6 text-sm text-black/55">
        {{ t(filtersActive ? "pages.orders.noMatchingOrders" : "pages.orders.empty") }}
      </p>
      <ListView
        v-else
        :columns="orderColumns"
        :rows="orders"
        row-key="id"
        :options="orderListOptions"
        class="!w-full !min-w-[780px] p-2 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:-outline-offset-2 [&_button:focus-visible]:outline-outline-gray-4"
      >
        <template #cell="{ column, row, item }">
          <span v-if="column.key === 'reference'" class="block truncate font-mono text-sm" :title="row.orderNumber || row.id">
            {{ row.orderNumber || row.id }}
          </span>
          <div v-else-if="column.key === 'tableLabel'">
            <p class="m-0 truncate text-base-medium" :title="row.tableLabel">{{ row.tableLabel }}</p>
            <p class="m-0 truncate text-sm text-ink-gray-5" :title="orderTableContext(row)">{{ orderTableContext(row) }}</p>
          </div>
          <Badge v-else-if="column.key === 'status'" :theme="statusThemes[row.status as OrderStatus]" :label="t(`pages.orders.statuses.${row.status}`)" />
          <span v-else-if="column.key === 'totalAmount'" class="block text-right text-base-semibold tabular-nums">
            {{ formatCurrency(row.totalAmount, row.currency) }}
          </span>
          <span v-else-if="column.key === 'items'" class="flex items-center justify-end gap-1.5 whitespace-nowrap text-sm-medium text-ink-gray-8">
            {{ t("pages.orders.viewItems") }}
            <ArrowRight :size="14" aria-hidden="true" />
          </span>
          <ListRowItem v-else :column="column" :row="row" :item="item" :align="column.align" />
        </template>
      </ListView>
      <div
        v-if="!listError && (page > 1 || hasMore)"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4"
      >
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="loading || page === 1"
          @click="loadOrders(page - 1)"
        >
          {{ t("pages.orders.previous") }}
        </Button>
        <span class="text-sm text-black/60">{{
          t("pages.orders.page", { page })
        }}</span>
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="loading || !hasMore"
          @click="loadOrders(page + 1)"
        >
          {{ t("pages.orders.next") }}
        </Button>
      </div>
    </section>

    <ModalPanel
      v-if="detailOpen"
      :open="true"
      :title="t('pages.orders.items')"
      size="large"
      @close="closeOrder"
    >
      <div
        v-if="selectedOrder"
        class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream p-4 text-sm"
      >
        <div>
          <p class="m-0 font-bold">
            {{ selectedOrder.branchName }} · {{ selectedOrder.groupName }} · {{ selectedOrder.tableLabel }}
          </p>
          <p class="mb-0 mt-1 break-all text-xs text-black/60">
            {{ selectedOrder.postingDate }} ·
            {{ selectedOrder.orderNumber || selectedOrder.id }}
          </p>
          <p class="mb-0 mt-1 text-xs font-bold">
            {{ t(`pages.orders.statuses.${selectedOrder.status}`) }}
          </p>
        </div>
        <p class="m-0 font-bold">
          {{ t("pages.orders.total") }}
          {{
            formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)
          }}
        </p>
      </div>
      <p
        v-if="selectedOrder?.note"
        class="mb-4 mt-0 whitespace-pre-wrap break-words rounded-xl bg-black/5 p-4 text-sm"
      >
        <strong>{{ t("pages.orders.orderNote") }}</strong> {{ selectedOrder.note }}
      </p>
      <LoadingText v-if="itemsLoading" :text="t('common.loading')" role="status" />
      <Alert v-else-if="itemsError" theme="red" :title="t('pages.orders.itemsLoadFailed')" />
      <p v-else-if="!products.length" class="text-sm text-black/55">
        {{ t("pages.orders.noItems") }}
      </p>
      <List divider="none" v-else-if="selectedOrder" class="m-0 list-none space-y-3 p-0">
        <ListRow
          v-for="product in products"
          :key="product.lineNumber"
          class="!block rounded-xl border border-black/10 p-4 text-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <h3 class="m-0 min-w-0 break-words font-bold">
                {{
                  (locale === "en" && product.nameEn) ||
                  product.name ||
                  `${t("pages.orders.productId")} ${product.productId}`
                }}
              </h3>
              <Badge v-if="product.status" :theme="productStatusThemes[product.status]" :label="t(`pages.orders.statuses.${product.status}`)" />
            </div>
            <strong class="shrink-0">{{
              formatCurrency(product.totalAmount, selectedOrder.currency)
            }}</strong>
          </div>
          <p v-if="product.portionName" class="mb-0 mt-1 text-black/65">
            {{ product.portionName }}
          </p>
          <p class="mb-0 mt-1 text-black/65">
            {{ t("pages.orders.quantity") }} {{ product.quantity }} ·
            {{ t("pages.orders.unitPrice") }}
            {{ formatCurrency(product.price, selectedOrder.currency) }}
          </p>
          <p
            v-if="product.priceList"
            class="mb-0 mt-1 break-words text-black/65"
          >
            {{ t("pages.orders.priceList") }}
            {{ product.priceListName || product.priceList }}
          </p>
          <p v-if="product.modifiers.length" class="mb-0 mt-2 break-words">
            <strong>{{ t("pages.orders.modifiers") }}</strong>
            {{
              product.modifiers
                .map(
                  (option) =>
                    (locale === "en" && option.labelEn) ||
                    option.labelKm ||
                    option.labelEn ||
                    option.id,
                )
                .join(", ")
            }}
          </p>
          <p
            v-if="product.note"
            class="mb-0 mt-2 whitespace-pre-wrap break-words"
          >
            <strong>{{ t("pages.orders.note") }}</strong> {{ product.note }}
          </p>
        </ListRow>
      </List>
      <template #footer>
        <Alert v-if="statusError" theme="red" :title="t('pages.orders.statusFailed')" class="mb-3 mt-0" />
        <div
          v-if="
            selectedOrder &&
            !itemsLoading &&
            !itemsError &&
            !admin.isReadOnly &&
            (selectedOrder.status === 'submitted' ||
              selectedOrder.status === 'accepted')
          "
          class="flex flex-wrap items-center justify-end gap-2"
        >
          <template v-if="confirmingAction">
            <p class="m-0 mr-auto text-sm font-semibold">
              {{ t(confirmingAction === 'accepted' ? 'pages.orders.acceptPrompt' : 'pages.orders.cancelPrompt') }}
            </p>
            <Button variant="subtle" size="lg"
              type="button"
              :disabled="statusUpdating"
              @click="confirmingAction = null"
            >
              {{ t(confirmingAction === 'accepted' ? 'pages.orders.backToOrder' : 'pages.orders.keepOrder') }}
            </Button>
            <Button size="lg"
              type="button"
              :variant="confirmingAction === 'accepted' ? 'solid' : 'subtle'" :theme="confirmingAction === 'accepted' ? 'gray' : 'red'"
              :disabled="statusUpdating"
              @click="confirmingAction && changeStatus(confirmingAction)"
            >
              {{ t(confirmingAction === 'accepted' ? 'pages.orders.acceptOrder' : 'pages.orders.cancelOrder') }}
            </Button>
          </template>
          <template v-else>
            <Button variant="subtle" size="lg"
              type="button"
              class="text-red-700"
              :disabled="statusUpdating"
              @click="confirmingAction = 'cancelled'"
            >
              {{ t("pages.orders.cancelOrder") }}
            </Button>
            <Button variant="solid" size="lg"
              v-if="selectedOrder.status === 'submitted'"
              type="button"
              :disabled="statusUpdating"
              @click="changeStatus('accepted')"
            >
              {{ t("pages.orders.acceptOrder") }}
            </Button>
            <Button variant="solid" size="lg"
              v-else
              type="button"
              :disabled="statusUpdating"
              @click="changeStatus('completed')"
            >
              {{ t("pages.orders.completeOrder") }}
            </Button>
          </template>
        </div>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { List, ListRow } from "frappe-ui/list";
import { ListRowItem, ListView } from "frappe-ui/experimental";
import { Alert, Badge, BottomSheet, Button, LoadingText } from "frappe-ui";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, RefreshCw } from "lucide-vue-next";
import ModalPanel from "../components/ModalPanel.vue";
import OrderFilterFields, { type OrderFilterOptions, type OrderFilters } from "../components/OrderFilterFields.vue";
import PageHeader from "../components/PageHeader.vue";
import { useAdminStore } from "../stores/admin";
import { formatCurrency } from "../utils/currency";
import { telegramOrderQuery, type TelegramOrderAction } from "../utils/telegramOrderLink";

type OrderStatus = "submitted" | "accepted" | "completed" | "cancelled";
type OrderProductStatus = "submitted" | "accepted" | "rejected";
type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  postingDate: string;
  tableCode: string;
  tableLabel: string;
  groupName: string;
  branchName: string;
  totalAmount: number;
  currency: string;
  note?: string;
};

type OrderProduct = {
  lineNumber: number;
  productId: string;
  status?: OrderProductStatus;
  name: string | null;
  nameEn: string | null;
  quantity: number;
  price: number;
  portionName: string;
  priceList: string;
  priceListName: string | null;
  modifiers: { id: string; labelKm?: string; labelEn?: string }[];
  totalAmount: number;
  note: string;
};

const { t, locale } = useI18n();
const admin = useAdminStore();
const route = useRoute();
const router = useRouter();
const telegramAlert = computed(() => telegramOrderQuery(route.query));
const orders = ref<Order[]>([]);
const orderColumns = computed(() => [
  { key: "reference", label: t("pages.orders.reference"), width: "minmax(100px, 1fr)" },
  { key: "tableLabel", label: t("pages.orders.table"), width: "minmax(160px, 1.6fr)" },
  { key: "postingDate", label: t("pages.orders.postingDate"), width: "100px" },
  { key: "status", label: t("pages.orders.status"), width: "100px" },
  { key: "totalAmount", label: t("pages.orders.total"), width: "minmax(92px, 0.8fr)", align: "end" },
  { key: "items", label: "", width: "110px" },
]);
const orderListOptions = { selectable: false, rowHeight: 56, onRowClick: (order: Order) => void viewOrder(order) };

function orderTableContext(order: Order) {
  const context = [order.branchName, order.groupName];
  if (order.tableCode !== order.tableLabel) context.push(order.tableCode);
  return context.join(" · ");
}

const emptyFilters = (): OrderFilters => ({ dateRange: [], branchId: "", status: "", tableId: "" });
const filters = ref(emptyFilters());
const draftFilters = ref(emptyFilters());
const filterOptions = ref<OrderFilterOptions>({ branches: [], tables: [] });
const filterOptionsError = ref(false);
const filterSheetOpen = ref(false);
const compactFilters = window.matchMedia("(max-width: 767px)");
const filtersActive = computed(() => {
  const { dateRange, branchId, status, tableId } = filters.value;
  return Boolean(dateRange.length || branchId || status || tableId);
});
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const listError = ref(false);
const selectedOrder = ref<Order | null>(null);
const detailOpen = ref(false);
const products = ref<OrderProduct[]>([]);
const itemsLoading = ref(false);
const itemsError = ref(false);
const statusUpdating = ref(false);
const statusError = ref(false);
const confirmingAction = ref<"accepted" | "cancelled" | null>(null);
const statusThemes = {
  submitted: "amber",
  accepted: "blue",
  completed: "green",
  cancelled: "red",
} as const satisfies Record<OrderStatus, string>;

const statusOptions = computed(() => [
  { label: t("pages.orders.allStatuses"), value: "" },
  ...Object.keys(statusThemes).map(status => ({
    label: t("pages.orders.statuses." + status),
    value: status,
  })),
]);

function openFilters() {
  draftFilters.value = { ...filters.value };
  filterSheetOpen.value = true;
}

function applyFilters() {
  filters.value = { ...draftFilters.value };
  filterSheetOpen.value = false;
}

function restoreFilterFocus() {
  if (compactFilters.matches) document.getElementById("orders-filter-button")?.focus();
}

function closeFiltersOnWideScreen(event: MediaQueryListEvent) {
  if (!event.matches) filterSheetOpen.value = false;
}

async function loadFilterOptions() {
  filterOptionsError.value = false;
  try {
    filterOptions.value = await admin.request("/api/admin/orders/filters/options", {
      signal: AbortSignal.timeout(12_000),
    }) as OrderFilterOptions;
  } catch {
    filterOptionsError.value = true;
  }
}

const productStatusThemes = {
  submitted: "amber",
  accepted: "green",
  rejected: "red",
} as const satisfies Record<OrderProductStatus, string>;

let listRequest: AbortController | undefined;
let detailRequest: AbortController | undefined;

async function loadOrders(nextPage: number) {
  listRequest?.abort();
  const request = new AbortController();
  listRequest = request;
  loading.value = true;
  listError.value = false;
  try {
    const { dateRange, branchId, status, tableId } = filters.value;
    const query = new URLSearchParams({ page: String(nextPage), branchId });
    if (status) query.set("status", status);
    if (tableId) query.set("tableId", tableId);
    if (dateRange.length) {
      const [from, to] = dateRange;
      query.set("from", from);
      query.set("to", to);
    }
    const result = (await admin.request(`/api/admin/orders?${query}`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    })) as { orders: Order[]; hasMore: boolean };
    if (request.signal.aborted) return;
    orders.value = result.orders;
    hasMore.value = result.hasMore;
    page.value = nextPage;
  } catch {
    if (!request.signal.aborted) listError.value = true;
  } finally {
    if (!request.signal.aborted) loading.value = false;
  }
}

function closeOrder() {
  detailRequest?.abort();
  selectedOrder.value = null;
  detailOpen.value = false;
  if (telegramAlert.value?.telegramOrder) {
    const query = { ...route.query };
    delete query.telegramAction;
    delete query.telegramOrder;
    void router.replace({ query });
  }
}

async function viewOrder(order: Order | string, action?: TelegramOrderAction) {
  const orderId = typeof order === "string" ? order : order.id;
  detailRequest?.abort();
  const request = new AbortController();
  detailRequest = request;
  detailOpen.value = true;
  selectedOrder.value = typeof order === "string" ? null : order;
  products.value = [];
  itemsLoading.value = true;
  itemsError.value = false;
  statusError.value = false;
  confirmingAction.value = null;
  try {
    const result = (await admin.request(
      `/api/admin/orders/${encodeURIComponent(orderId)}`,
      {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
      },
    )) as { order: Order; products: OrderProduct[] };
    if (request.signal.aborted) return;
    selectedOrder.value = result.order;
    syncStatus(orderId, result.order.status);
    products.value = result.products;
    if (action === "accept" && result.order.status === "submitted") confirmingAction.value = "accepted";
    if (action === "cancel" && (result.order.status === "submitted" || result.order.status === "accepted"))
      confirmingAction.value = "cancelled";
  } catch {
    if (!request.signal.aborted) itemsError.value = true;
  } finally {
    if (!request.signal.aborted) itemsLoading.value = false;
  }
}

function syncStatus(orderId: string, status: OrderStatus) {
  const row = orders.value.find((order) => order.id === orderId);
  if (row && filters.value.status && filters.value.status !== status) {
    void loadOrders(1);
  } else if (row) {
    row.status = status;
  }
  if (selectedOrder.value?.id === orderId) selectedOrder.value.status = status;
}

async function changeStatus(status: Exclude<OrderStatus, "submitted">) {
  const order = selectedOrder.value;
  if (!order || statusUpdating.value) return;
  statusUpdating.value = true;
  statusError.value = false;
  try {
    const result = (await admin.request(
      `/api/admin/orders/${encodeURIComponent(order.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
        signal: AbortSignal.timeout(12_000),
      },
    )) as { status: OrderStatus };
    syncStatus(order.id, result.status);
    if (selectedOrder.value?.id === order.id) confirmingAction.value = null;
  } catch {
    if (selectedOrder.value?.id === order.id) {
      await viewOrder(order);
      if (selectedOrder.value?.id === order.id) statusError.value = true;
    }
  } finally {
    statusUpdating.value = false;
  }
}

watch(filters, () => loadOrders(1), { immediate: true });
onMounted(() => {
  compactFilters.addEventListener("change", closeFiltersOnWideScreen);
  void loadFilterOptions();
});
watch(telegramAlert, (alert) => {
  if (alert?.telegramOrder) void viewOrder(alert.telegramOrder, alert.telegramAction);
}, { immediate: true });
onBeforeUnmount(() => {
  compactFilters.removeEventListener("change", closeFiltersOnWideScreen);
  listRequest?.abort();
  detailRequest?.abort();
});
</script>
