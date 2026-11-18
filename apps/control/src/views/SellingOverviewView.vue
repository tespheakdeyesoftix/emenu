<template>
  <PageHeader :title="t('nav.sellingOverview')">
    <div class="flex flex-wrap gap-2">
      <Button variant="subtle" size="lg"
        v-if="store.canAccessPage('posProfiles')"
        :route="{ name: 'posProfiles' }"
      >
        <template #prefix><SlidersHorizontal :size="16" /></template>{{ t("nav.posProfiles") }}
      </Button>
      <Button variant="solid" size="lg"
        v-if="store.canAccessPage('salesList')"
        :route="{ name: 'salesList' }"
      >
        <template #prefix><Receipt :size="16" /></template>{{ t("nav.salesList") }}
      </Button>
    </div>
  </PageHeader>
  <LoadingText v-if="loading" :text="t('common.loading')" role="status" class="card p-6" />
  <Alert v-else-if="error" theme="red" :title="error" class="m-4">
    <template #actions>
      <Button variant="subtle" size="lg" type="button" @click="load">
        {{ t("common.tryAgain") }}
      </Button>
    </template>
  </Alert>
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
import { LoadingText, Alert, Button } from "frappe-ui";
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
