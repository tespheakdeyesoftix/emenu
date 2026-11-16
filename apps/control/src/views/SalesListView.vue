<template>
  <PageHeader :eyebrow="t('nav.groups.selling')" :title="t('nav.salesList')">
    <form class="flex flex-wrap items-end gap-2" @submit.prevent="applyFilters">
      <label>
        <span class="label">{{ t("selling.businessDate") }}</span>
        <input
          v-model="date"
          type="date"
          class="input !w-auto"
          :disabled="loading"
        />
      </label>
      <label>
        <span class="label">{{ t("pages.orders.status") }}</span>
        <select v-model="status" class="input !w-auto" :disabled="loading">
          <option value="">{{ t("pages.reports.all") }}</option>
          <option v-for="value in statuses" :key="value" :value="value">
            {{ t(`selling.statuses.${value}`) }}
          </option>
        </select>
      </label>
      <button type="submit" class="btn-soft" :disabled="loading">
        {{ t("pages.reports.apply") }}
      </button>
    </form>
  </PageHeader>
  <section class="card overflow-hidden" :aria-busy="loading">
    <p v-if="loading" class="p-6 text-sm text-black/55" role="status">
      {{ t("common.loading") }}
    </p>
    <p v-else-if="error" class="p-6 text-sm text-red-700" role="alert">
      {{ error }}
    </p>
    <p v-else-if="!sales.length" class="p-6 text-sm text-black/55">
      {{ t("selling.noSales") }}
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-cream text-xs text-black/65">
          <tr>
            <th scope="col" class="px-4 py-3">
              {{ t("pages.orders.reference") }}
            </th>
            <th scope="col" class="px-4 py-3">
              {{ t("selling.businessDate") }}
            </th>
            <th scope="col" class="px-4 py-3">{{ t("selling.profile") }}</th>
            <th scope="col" class="px-4 py-3">{{ t("selling.customer") }}</th>
            <th scope="col" class="px-4 py-3">
              {{ t("pages.orders.status") }}
            </th>
            <th scope="col" class="px-4 py-3 text-right">
              {{ t("pages.orders.total") }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/10">
          <tr v-for="sale in sales" :key="sale.id">
            <td class="max-w-40 break-all px-4 py-3 font-mono text-xs">
              {{ sale.id }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              {{ sale.business_date }}
            </td>
            <td class="px-4 py-3">
              <div class="font-semibold">{{ sale.profile_name }}</div>
              <div class="text-xs text-black/55">{{ sale.branch_name }}</div>
            </td>
            <td class="px-4 py-3">
              {{ sale.customer_name }}
              <div v-if="sale.table_label" class="text-xs text-black/55">
                {{ sale.table_label }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="whitespace-nowrap rounded-full bg-cream px-2.5 py-1 text-xs font-semibold"
              >
                {{
                  t(
                    `selling.statuses.${sale.reverses_sale_id ? "reversal" : sale.reversed_by_sale_id ? "reversed" : sale.status}`,
                  )
                }}
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right font-semibold">
              {{ formatPosAmount(sale.total_minor, sale.currency) }}
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
        @click="load(page - 1)"
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
        @click="load(page + 1)"
      >
        {{ t("pages.orders.next") }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import PageHeader from "../components/PageHeader.vue";
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
const date = ref("");
const status = ref<SaleStatus | "">("");
const sales = ref<Sale[]>([]);
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
