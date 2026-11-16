<template>
  <PageHeader
    :eyebrow="t('nav.groups.selling')"
    :title="t('nav.sellingOverview')"
  >
    <div class="flex flex-wrap gap-2">
      <RouterLink
        v-if="store.canAccessPage('posProfiles')"
        :to="{ name: 'posProfiles' }"
        class="btn-soft"
      >
        <SlidersHorizontal :size="16" />{{ t("nav.posProfiles") }}
      </RouterLink>
      <RouterLink
        v-if="store.canAccessPage('salesList')"
        :to="{ name: 'salesList' }"
        class="btn-primary"
      >
        <Receipt :size="16" />{{ t("nav.salesList") }}
      </RouterLink>
    </div>
  </PageHeader>
  <p v-if="loading" class="card p-6 text-sm text-black/55" role="status">
    {{ t("common.loading") }}
  </p>
  <div v-else-if="error" class="card p-6" role="alert">
    <p class="mb-3 text-sm text-red-700">{{ error }}</p>
    <button type="button" class="btn-soft" @click="load">
      {{ t("common.tryAgain") }}
    </button>
  </div>
  <template v-else-if="overview">
    <p class="mb-3 text-sm font-semibold text-black/60">
      {{ t("selling.businessDate") }} · {{ overview.business_date }}
    </p>
    <div class="grid gap-4 sm:grid-cols-3">
      <section class="card p-5">
        <h2 class="text-sm font-semibold text-black/65">
          {{ t("selling.completed") }}
        </h2>
        <p class="display mt-2 text-3xl">{{ completed }}</p>
      </section>
      <section class="card p-5">
        <h2 class="text-sm font-semibold text-black/65">
          {{ t("selling.openBills") }}
        </h2>
        <p class="display mt-2 text-3xl">{{ openBills }}</p>
      </section>
      <section class="card p-5">
        <h2 class="text-sm font-semibold text-black/65">
          {{ t("selling.netSales") }}
        </h2>
        <p
          v-for="total in totals"
          :key="total.currency"
          class="display mt-2 text-3xl"
        >
          {{ formatPosAmount(total.net_minor, total.currency) }}
        </p>
      </section>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Receipt, SlidersHorizontal } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import { useAdminStore } from "../stores/admin";
import {
  formatPosAmount,
  normalizeCurrency,
  type SupportedCurrency,
} from "../utils/currency";

type CurrencyTotals = {
  currency: SupportedCurrency;
  completed_count: number;
  open_count: number;
  net_minor: number;
};

const { t } = useI18n();
const store = useAdminStore();
const loading = ref(true);
const error = ref("");
const overview = ref<{ business_date: string; currencies: CurrencyTotals[] }>();
const completed = computed(
  () =>
    overview.value?.currencies.reduce(
      (sum, row) => sum + row.completed_count,
      0,
    ) ?? 0,
);
const openBills = computed(
  () =>
    overview.value?.currencies.reduce((sum, row) => sum + row.open_count, 0) ??
    0,
);
const totals = computed(() =>
  overview.value?.currencies.length
    ? overview.value.currencies
    : [{ currency: normalizeCurrency(store.business.currency), net_minor: 0 }],
);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    overview.value = await store.request("/api/admin/pos/overview");
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("selling.loadFailed");
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
