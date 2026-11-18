<template>
  <PageHeader :title="t('nav.salesList')">
    <form class="flex flex-wrap items-end gap-2" @submit.prevent="applyFilters">
      <DateFilter v-model="date" :label="t('selling.businessDate')" :disabled="loading" class="w-44" />
      <label>
        <span class="label">{{ t("pages.orders.status") }}</span>
        <Select
          size="lg"
          variant="outline"
          v-model="status"
          class="!w-auto"
          :disabled="loading"
          :options="[
            { label: t('pages.reports.all'), value: '' },
            ...statuses.map(value => ({ label: t(`selling.statuses.${value}`), value: value })),
          ]"
        />
      </label>
      <Button variant="subtle" size="lg" type="submit" :disabled="loading">
        {{ t("pages.reports.apply") }}
      </Button>
    </form>
    <Button variant="subtle" size="lg" type="button" @click="auditOpen = true">
      {{ t("shiftAudit.title") }}
    </Button>
  </PageHeader>
  <ShiftAuditDialog v-if="auditOpen" @close="auditOpen = false" />
  <section class="card overflow-hidden" :aria-busy="loading">
    <LoadingText v-if="loading" :text="t('common.loading')" role="status" class="p-6" />
    <Alert v-else-if="error" theme="red" :title="error" class="m-4" />
    <p v-else-if="!sales.length" class="p-6 text-sm text-black/55">
      {{ t("selling.noSales") }}
    </p>
    <ListView
      v-else
      :columns="saleColumns"
      :rows="sales"
      row-key="id"
      :options="saleListOptions"
      class="!w-full !min-w-[780px] p-2 [&_.cursor-pointer]:!cursor-default [&_.cursor-pointer:hover]:!bg-transparent"
    >
      <template #cell="{ column, row, item }">
        <span v-if="column.key === 'id'" class="block truncate font-mono text-sm" :title="row.id">{{ row.id }}</span>
        <div v-else-if="column.key === 'profile_name'">
          <p class="m-0 truncate text-base-medium" :title="row.profile_name">{{ row.profile_name }}</p>
          <p class="m-0 truncate text-sm text-ink-gray-5" :title="row.branch_name">{{ row.branch_name }}</p>
        </div>
        <div v-else-if="column.key === 'customer_name'">
          <p class="m-0 truncate text-base" :title="row.customer_name">{{ row.customer_name }}</p>
          <p v-if="row.table_label" class="m-0 truncate text-sm text-ink-gray-5" :title="row.table_label">{{ row.table_label }}</p>
        </div>
        <Badge v-else-if="column.key === 'status'" :label="t(`selling.statuses.${displaySaleStatus(row)}`)" />
        <span v-else-if="column.key === 'total_minor'" class="block text-right text-base-semibold tabular-nums">
          {{ formatPosAmount(row.total_minor, row.currency) }}
        </span>
        <ListRowItem v-else :column="column" :row="row" :item="item" :align="column.align" />
      </template>
    </ListView>
    <div
      v-if="page > 1 || hasMore"
      class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4"
    >
      <Button variant="subtle" size="lg"
        type="button"
        :disabled="loading || page === 1"
        @click="load(page - 1)"
      >
        {{ t("pages.orders.previous") }}
      </Button>
      <span class="text-sm text-black/60">{{
        t("pages.orders.page", { page })
      }}</span>
      <Button variant="subtle" size="lg"
        type="button"
        :disabled="loading || !hasMore"
        @click="load(page + 1)"
      >
        {{ t("pages.orders.next") }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ListRowItem, ListView } from "frappe-ui/experimental";
import { LoadingText, Alert, Badge, Button, Select } from "frappe-ui";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import DateFilter from "../components/DateFilter.vue";
import PageHeader from "../components/PageHeader.vue";
import ShiftAuditDialog from "../components/ShiftAuditDialog.vue";
import { useAdminStore } from "../stores/admin";
import { formatPosAmount, type SupportedCurrency } from "../utils/currency";

const statuses = ["open", "paid", "cancelled"] as const;
type SaleStatus = (typeof statuses)[number];
type Sale = {
  id: string;
  business_date: string;
  profile_name: string;
  branch_name: string;
  customer_name: string;
  table_label: string | null;
  status: SaleStatus;
  currency: SupportedCurrency;
  total_minor: number;
  reverses_sale_id: string | null;
  reversed_by_sale_id: string | null;
};

const { t } = useI18n();
const store = useAdminStore();
const auditOpen = ref(false);
const date = ref("");
const status = ref<SaleStatus | "">("");
const sales = ref<Sale[]>([]);
const saleColumns = computed(() => [
  { key: "id", label: t("pages.orders.reference"), width: "minmax(120px, 1fr)" },
  { key: "business_date", label: t("selling.businessDate"), width: "108px" },
  { key: "profile_name", label: t("selling.profile"), width: "minmax(124px, 1.15fr)" },
  { key: "customer_name", label: t("selling.customer"), width: "minmax(120px, 1fr)" },
  { key: "status", label: t("pages.orders.status"), width: "92px" },
  { key: "total_minor", label: t("pages.orders.total"), width: "minmax(95px, 0.8fr)", align: "end" },
]);
const saleListOptions = {
  selectable: false,
  rowHeight: 56,
  // A route resolver with no destination keeps ListView from rendering a button for each read-only row.
  getRowRoute: () => null,
};

function displaySaleStatus(sale: Sale) {
  if (sale.reverses_sale_id) return "reversal";
  if (sale.reversed_by_sale_id) return "reversed";
  return sale.status;
}

const page = ref(1);
const hasMore = ref(false);
const loading = ref(true);
const error = ref("");
const appliedFilters = new URLSearchParams();

function applyFilters() {
  appliedFilters.delete("business_date");
  appliedFilters.delete("status");
  if (date.value) appliedFilters.set("business_date", date.value);
  if (status.value) appliedFilters.set("status", status.value);
  void load(1);
}

async function load(nextPage: number) {
  const query = new URLSearchParams(appliedFilters);
  query.set("page", String(nextPage));
  loading.value = true;
  error.value = "";
  try {
    const result = await store.request(`/api/admin/pos/sales?${query}`);
    sales.value = result.sales;
    page.value = result.page;
    hasMore.value = result.has_more;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("selling.loadFailed");
  } finally {
    loading.value = false;
  }
}
onMounted(() => load(1));
</script>
