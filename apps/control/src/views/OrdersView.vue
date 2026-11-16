<template>
  <div>
    <PageHeader
      :eyebrow="t('pages.orders.eyebrow')"
      :title="t('pages.orders.title')"
      :description="t('pages.orders.description')"
    >
      <select v-model="branchId" class="input !w-auto" :aria-label="t('menus.branch')" :disabled="loading" @change="loadOrders(1)">
        <option value="">{{ t('menus.allBranches') }}</option>
        <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
      </select>
      <button
        class="btn-soft"
        type="button"
        :disabled="loading"
        @click="loadOrders(1)"
      >
        <RefreshCw :size="16" />{{ t("pages.orders.refresh") }}
      </button>
    </PageHeader>

    <p v-if="telegramAlert && !telegramAlert.telegramOrder" class="card mb-4 p-4 text-sm text-black/65" role="status">
      {{ t('pages.orders.telegramTest') }}
    </p>

    <section class="card overflow-hidden" :aria-busy="loading">
      <p v-if="loading" class="m-0 p-6 text-sm text-black/55" role="status">
        {{ t("common.loading") }}
      </p>
      <p
        v-else-if="listError"
        class="m-0 p-6 text-sm text-red-600"
        role="alert"
      >
        {{ t("pages.orders.loadFailed") }}
      </p>
      <p v-else-if="!orders.length" class="m-0 p-6 text-sm text-black/55">
        {{ t("pages.orders.empty") }}
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-cream text-xs text-black/60">
            <tr>
              <th scope="col" class="px-4 py-3">
                {{ t("pages.orders.reference") }}
              </th>
              <th scope="col" class="px-4 py-3">
                {{ t("pages.orders.table") }}
              </th>
              <th scope="col" class="px-4 py-3">
                {{ t("pages.orders.postingDate") }}
              </th>
              <th scope="col" class="px-4 py-3">
                {{ t("pages.orders.status") }}
              </th>
              <th scope="col" class="px-4 py-3 text-right">
                {{ t("pages.orders.total") }}
              </th>
              <th scope="col" class="sr-only">{{ t("pages.orders.items") }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-black/10">
            <tr v-for="order in orders" :key="order.id">
              <td class="break-all px-4 py-4 font-mono text-xs">
                {{ order.orderNumber || order.id }}
              </td>
              <td class="px-4 py-4">
                <div class="font-bold">{{ order.tableLabel }}</div>
                <div class="text-xs text-black/60">
                  {{ order.branchName }} · {{ order.groupName
                  }}<template v-if="order.tableCode !== order.tableLabel">
                    · {{ order.tableCode }}</template
                  >
                </div>
              </td>
              <td class="whitespace-nowrap px-4 py-4">
                {{ order.postingDate }}
              </td>
              <td class="px-4 py-4">
                <span
                  class="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                  :class="statusColors[order.status]"
                >
                  {{ t(`pages.orders.statuses.${order.status}`) }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-4 text-right font-bold">
                {{ formatCurrency(order.totalAmount, order.currency) }}
              </td>
              <td class="px-4 py-4 text-right">
                <button
                  type="button"
                  class="btn-soft whitespace-nowrap"
                  @click="viewOrder(order)"
                >
                  {{ t("pages.orders.viewItems") }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="page > 1 || hasMore"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4"
      >
        <button
          type="button"
          class="btn-soft"
          :disabled="loading || page === 1"
          @click="loadOrders(page - 1)"
        >
          {{ t("pages.orders.previous") }}
        </button>
        <span class="text-sm text-black/60">{{
          t("pages.orders.page", { page })
        }}</span>
        <button
          type="button"
          class="btn-soft"
          :disabled="loading || !hasMore"
          @click="loadOrders(page + 1)"
        >
          {{ t("pages.orders.next") }}
        </button>
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
      <p v-if="itemsLoading" role="status">{{ t("common.loading") }}</p>
      <p v-else-if="itemsError" class="text-sm text-red-600" role="alert">
        {{ t("pages.orders.itemsLoadFailed") }}
      </p>
      <p v-else-if="!products.length" class="text-sm text-black/55">
        {{ t("pages.orders.noItems") }}
      </p>
      <ul v-else-if="selectedOrder" class="m-0 list-none space-y-3 p-0">
        <li
          v-for="product in products"
          :key="product.lineNumber"
          class="rounded-xl border border-black/10 p-4 text-sm"
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
              <span
                v-if="product.status"
                class="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
                :class="productStatusColors[product.status]"
              >
                {{ t(`pages.orders.statuses.${product.status}`) }}
              </span>
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
        </li>
      </ul>
      <template #footer>
        <p
          v-if="statusError"
          class="mb-3 mt-0 text-sm text-red-600"
          role="alert"
        >
          {{ t("pages.orders.statusFailed") }}
        </p>
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
            <button
              type="button"
              class="btn-soft"
              :disabled="statusUpdating"
              @click="confirmingAction = null"
            >
              {{ t(confirmingAction === 'accepted' ? 'pages.orders.backToOrder' : 'pages.orders.keepOrder') }}
            </button>
            <button
              type="button"
              :class="confirmingAction === 'accepted' ? 'btn-primary' : 'btn-soft text-red-700'"
              :disabled="statusUpdating"
              @click="confirmingAction && changeStatus(confirmingAction)"
            >
              {{ t(confirmingAction === 'accepted' ? 'pages.orders.acceptOrder' : 'pages.orders.cancelOrder') }}
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="btn-soft text-red-700"
              :disabled="statusUpdating"
              @click="confirmingAction = 'cancelled'"
            >
              {{ t("pages.orders.cancelOrder") }}
            </button>
            <button
              v-if="selectedOrder.status === 'submitted'"
              type="button"
              class="btn-primary"
              :disabled="statusUpdating"
              @click="changeStatus('accepted')"
            >
              {{ t("pages.orders.acceptOrder") }}
            </button>
            <button
              v-else
              type="button"
              class="btn-primary"
              :disabled="statusUpdating"
              @click="changeStatus('completed')"
            >
              {{ t("pages.orders.completeOrder") }}
            </button>
          </template>
        </div>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { RefreshCw } from "lucide-vue-next";
import ModalPanel from "../components/ModalPanel.vue";
import PageHeader from "../components/PageHeader.vue";
import { useAdminStore } from "../stores/admin";
import { formatCurrency } from "../utils/currency";
import { telegramOrderQuery, type TelegramOrderAction } from "../utils/telegramOrderLink";
import type { BranchOption } from "../types/menu";

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
const branches = ref<BranchOption[]>([]);
const branchId = ref("");
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
const statusColors: Record<OrderStatus, string> = {
  submitted: "bg-amber-100 text-amber-900",
  accepted: "bg-sky-100 text-sky-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
};
const productStatusColors: Record<OrderProductStatus, string> = {
  submitted: statusColors.submitted,
  accepted: statusColors.completed,
  rejected: statusColors.cancelled,
};
let detailRequest: AbortController | undefined;

async function loadOrders(nextPage: number) {
  if (loading.value) return;
  loading.value = true;
  listError.value = false;
  try {
    const query = new URLSearchParams({ page: String(nextPage), branchId: branchId.value });
    const result = (await admin.request(`/api/admin/orders?${query}`, {
      signal: AbortSignal.timeout(12_000),
    })) as { orders: Order[]; hasMore: boolean };
    orders.value = result.orders;
    hasMore.value = result.hasMore;
    page.value = nextPage;
  } catch {
    listError.value = true;
  } finally {
    loading.value = false;
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
  if (row) row.status = status;
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

onMounted(() => {
  void loadOrders(1);
  void admin.request("/api/admin/branches").then((result) => { branches.value = result.branches; }).catch(() => {});
});
watch(telegramAlert, (alert) => {
  if (alert?.telegramOrder) void viewOrder(alert.telegramOrder, alert.telegramAction);
}, { immediate: true });
onBeforeUnmount(() => detailRequest?.abort());
</script>
