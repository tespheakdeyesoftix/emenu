<template>
  <div>
    <PageHeader :title="t('pages.reports.title')">
      <Button
        variant="subtle"
        size="lg"
        :disabled="loading || exporting"
        @click="exportCsv"
      >
        <template #prefix
          ><Spinner v-if="exporting" />
          <Download v-else :size="16" /></template
        >{{ t("pages.reports.export") }}
      </Button>
    </PageHeader>

    <section class="card mb-5 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <TabButtons
          :model-value="activePreset"
          :options="presets.map(({ days, label }) => ({ value: days, label }))"
          :aria-label="t('pages.reports.datePresets')"
          variant="subtle"
          @update:model-value="setPreset(Number($event))"
        />
        <DateFilter v-model="from" :label="t('pages.reports.from')" class="w-44" />
        <DateFilter v-model="to" :label="t('pages.reports.to')" class="w-44" />
        <label class="grid gap-1 text-xs-medium text-ink-gray-6">
          {{ t("pages.reports.language") }}
          <Select
            size="lg"
            variant="outline"
            v-model="language"
            :options="[
              { label: t('pages.reports.all'), value: '' },
              { label: 'ខ្មែរ', value: 'km' },
              { label: 'English', value: 'en' },
              { label: '中文', value: 'zh' },
            ]"
          />
        </label>
        <label class="grid gap-1 text-xs-medium text-ink-gray-6">
          {{ t("menus.branch") }}
          <Select
            size="lg"
            variant="outline"
            v-model="branchId"
            class="max-w-44"
            :options="[
              { label: t('menus.allBranches'), value: '' },
              ...branches.map((branch) => ({
                label: branch.name,
                value: branch.id,
              })),
            ]"
          />
        </label>
        <label class="grid gap-1 text-xs-medium text-ink-gray-6">
          {{ t("pages.reports.area") }}
          <Select
            size="lg"
            variant="outline"
            v-model="groupId"
            class="max-w-44"
            :options="[
              { label: t('pages.reports.all'), value: '' },
              ...groups.map((group) => ({
                label: group.name,
                value: group.id,
              })),
            ]"
          />
        </label>
        <label class="grid gap-1 text-xs-medium text-ink-gray-6">
          {{ t("pages.reports.table") }}
          <Select
            size="lg"
            variant="outline"
            v-model="tableId"
            class="max-w-44"
            :options="[
              { label: t('pages.reports.all'), value: '' },
              ...filteredTableOptions.map((table) => ({
                label: [table.groupName, ' · ', table.label].join(''),
                value: table.id,
              })),
            ]"
          />
        </label>
        <Button variant="solid" size="lg" :disabled="loading" @click="load">
          <template #prefix
            ><Spinner v-if="loading" />
            <RefreshCw v-else :size="16" /></template
          >{{ t("pages.reports.apply") }}
        </Button>
      </div>
      <Alert v-if="error" theme="red" :title="error" class="mb-0 mt-3" />
    </section>

    <template v-if="report">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article v-for="metric in metrics" :key="metric.label" class="card p-5">
          <p
            class="m-0 text-xs font-bold uppercase tracking-[.1em] text-black/40"
          >
            {{ metric.label }}
          </p>
          <div class="display mt-3 text-3xl">{{ metric.value }}</div>
          <p
            class="mb-0 mt-2 text-xs font-semibold"
            :class="metric.change >= 0 ? 'text-emerald-700' : 'text-red-600'"
          >
            {{ metric.change >= 0 ? "↑" : "↓" }}
            {{ Math.abs(metric.change).toFixed(1) }}%
            {{ t("pages.reports.previous") }}
          </p>
        </article>
      </section>

      <TabButtons
        class="my-5 overflow-x-auto"
        :model-value="tab"
        :options="tabs.map(({ id, label }) => ({ value: id, label }))"
        :aria-label="t('pages.reports.sections')"
        variant="subtle"
        @update:model-value="tab = String($event)"
      />

      <section
        v-if="tab === 'overview'"
        class="grid gap-5 xl:grid-cols-[1.5fr_.75fr]"
      >
        <article class="card h-80 min-w-0 p-5">
          <BarChart
            :title="t('pages.reports.dailyTrend')"
            :data="report.daily"
            x="date"
            y="menuSessions"
            :x-axis="{
              type: 'category',
              format: (value) => shortDate(String(value)),
            }"
            :y-axis="{ min: 0 }"
            :series-config="{
              menuSessions: { label: t('pages.reports.menuSessions') },
            }"
          >
            <template #empty><EmptyState /></template>
          </BarChart>
        </article>
        <div class="space-y-5">
          <ReportList
            :title="t('pages.reports.entryContext')"
            :rows="sourceRows"
          />
          <ReportList
            :title="t('pages.reports.languages')"
            :rows="languageRows"
          />
          <ReportList
            :title="t('pages.reports.contactActions')"
            :rows="actionRows"
          />
        </div>
      </section>

      <section
        v-else-if="tab === 'products'"
        class="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"
      >
        <ReportTable
          :title="t('pages.reports.productPerformance')"
          :empty-text="t('pages.reports.noData')"
          :columns="[
            t('pages.reports.product'),
            t('pages.reports.views'),
            t('pages.reports.sessions'),
            t('pages.reports.favourites'),
          ]"
          :rows="
            report.products.map((row) => [
              row.name,
              row.views,
              row.viewingSessions,
              row.favouriteAdds,
            ])
          "
        />
        <ReportTable
          :title="t('pages.reports.categories')"
          :empty-text="t('pages.reports.noData')"
          :columns="[
            t('pages.reports.category'),
            t('pages.reports.selections'),
            t('pages.reports.sessions'),
          ]"
          :rows="
            report.categories.map((row) => [
              row.name,
              row.selections,
              row.sessions,
            ])
          "
        />
      </section>

      <ReportTable
        v-else-if="tab === 'tables'"
        :title="t('pages.reports.tablePerformance')"
        :empty-text="t('pages.reports.noData')"
        :columns="[
          t('pages.reports.area'),
          t('pages.reports.table'),
          t('pages.reports.sessions'),
          t('pages.reports.engaged'),
          t('pages.reports.views'),
        ]"
        :rows="
          report.tables.map((row) => [
            row.groupName,
            `${row.label} (${row.code})`,
            row.menuSessions,
            row.engagedSessions,
            row.productViews,
          ])
        "
      />

      <ReportTable
        v-else-if="tab === 'searches'"
        :title="t('pages.reports.searchReport')"
        :empty-text="t('pages.reports.noData')"
        :columns="[
          t('pages.reports.searchTerm'),
          t('pages.reports.searches'),
          t('pages.reports.noResults'),
          t('pages.reports.maxResults'),
        ]"
        :rows="
          report.searches.map((row) => [
            row.term,
            row.searches,
            row.noResultSearches,
            row.maxResults,
          ])
        "
      />

      <ReportTable
        v-else
        :title="t('pages.reports.promotionReport')"
        :empty-text="t('pages.reports.noData')"
        :columns="[
          t('pages.reports.promotion'),
          t('pages.reports.impressions'),
          t('pages.reports.opens'),
          t('pages.reports.clicks'),
          'CTR',
        ]"
        :rows="
          report.promotions.map((row) => [
            row.title,
            row.impressions,
            row.opens,
            row.ctaClicks,
            percent(row.impressions ? row.ctaClicks / row.impressions : 0),
          ])
        "
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { Alert, Button, Select, TabButtons, Spinner } from "frappe-ui";
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { Download, RefreshCw } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import DateFilter from "../components/DateFilter.vue";
import PageHeader from "../components/PageHeader.vue";
import ReportTable from "../components/ReportDataTable.vue";
import { useAdminStore } from "../stores/admin";
import type { BranchOption } from "../types/menu";

const BarChart = defineAsyncComponent(() =>
  import("frappe-ui/charts").then(({ BarChart }) => BarChart),
);

type Row = Record<string, any>;
type Report = {
  summary: Row;
  previous: Row;
  daily: Row[];
  hourly: Row[];
  products: Row[];
  categories: Row[];
  tables: Row[];
  searches: Row[];
  promotions: Row[];
  actions: Row[];
  languages: Row[];
  sources: Row[];
};

const EmptyState = defineComponent({
  setup: () => () =>
    h(
      "p",
      { class: "m-0 p-8 text-center text-sm text-black/40" },
      t("pages.reports.noData"),
    ),
});
const ReportList = defineComponent({
  props: {
    title: { type: String, required: true },
    rows: { type: Array as PropType<Row[]>, required: true },
  },
  setup(props) {
    return () =>
      h("article", { class: "card p-5" }, [
        h("h2", { class: "display m-0 text-lg" }, props.title),
        props.rows.length
          ? h(
              "div",
              { class: "mt-4 space-y-3" },
              props.rows.map((row) =>
                h(
                  "div",
                  { class: "flex items-center justify-between gap-3 text-sm" },
                  [
                    h("span", { class: "text-black/55" }, row.label),
                    h("strong", String(row.value)),
                  ],
                ),
              ),
            )
          : h(EmptyState),
      ]);
  },
});

const admin = useAdminStore();
const { t, locale } = useI18n();
const report = ref<Report | null>(null);
const loading = ref(false);
const exporting = ref(false);
const error = ref("");
const tab = ref("overview");
const language = ref("");
const branches = ref<BranchOption[]>([]);
const branchId = ref("");
const groupId = ref("");
const tableId = ref("");
const today = businessToday();
const from = ref(shiftDay(today, -29));
const to = ref(today);
const presets = computed(() =>
  [7, 30, 90].map((days) => ({
    days,
    label: t("pages.reports.days", { count: days }),
  })),
);
const activePreset = computed(() =>
  to.value === today
    ? presets.value.find(
        ({ days }) => from.value === shiftDay(today, -(days - 1)),
      )?.days
    : undefined,
);
const tabs = computed(() => [
  { id: "overview", label: t("pages.reports.tabs.overview") },
  { id: "products", label: t("pages.reports.tabs.products") },
  { id: "tables", label: t("pages.reports.tabs.tables") },
  { id: "searches", label: t("pages.reports.tabs.searches") },
  { id: "promotions", label: t("pages.reports.tabs.promotions") },
]);
const groups = computed(() => {
  const seen = new Map<string, string>();
  for (const table of report.value?.tables || [])
    if (table.groupId && (!branchId.value || table.branchId === branchId.value))
      seen.set(table.groupId, table.groupName);
  return [...seen].map(([id, name]) => ({ id, name }));
});
const filteredTableOptions = computed(() =>
  (report.value?.tables || []).filter(
    (item) =>
      (!branchId.value || item.branchId === branchId.value) &&
      (!groupId.value || item.groupId === groupId.value),
  ),
);
const metrics = computed(() =>
  report.value
    ? [
        metric(
          t("pages.reports.menuOpens"),
          report.value.summary.menuOpens,
          report.value.previous.menuOpens,
        ),
        metric(
          t("pages.reports.menuSessions"),
          report.value.summary.menuSessions,
          report.value.previous.menuSessions,
        ),
        metric(
          t("pages.reports.engagementRate"),
          report.value.summary.engagementRate,
          report.value.previous.engagementRate,
          true,
        ),
        metric(
          t("pages.reports.productViews"),
          report.value.summary.productViews,
          report.value.previous.productViews,
        ),
        metric(
          t("pages.reports.viewsPerSession"),
          report.value.summary.averageProductViews,
          report.value.previous.averageProductViews,
          false,
          1,
        ),
      ]
    : [],
);
const sourceRows = computed(() =>
  (report.value?.sources || []).map((row) => ({
    label:
      row.source === "table"
        ? t("pages.reports.tableLink")
        : t("pages.reports.generalLink"),
    value: row.menuSessions,
  })),
);
const languageRows = computed(() =>
  (report.value?.languages || []).map((row) => ({
    label:
      ({ km: "ខ្មែរ", en: "English", zh: "中文" } as Row)[row.language] ||
      row.language,
    value: row.menuSessions,
  })),
);
const actionRows = computed(() =>
  (report.value?.actions || []).map((row) => ({
    label: t(`pages.reports.actions.${row.action}`),
    value: row.actions,
  })),
);

function localDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
function businessToday() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: admin.business.timezone || "Asia/Phnom_Penh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function shiftDay(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return localDay(date);
}
function setPreset(days: number) {
  to.value = today;
  from.value = shiftDay(today, -(days - 1));
  void load();
}
function params() {
  return new URLSearchParams({
    from: from.value,
    to: to.value,
    ...(language.value ? { language: language.value } : {}),
    ...(branchId.value ? { branchId: branchId.value } : {}),
    ...(groupId.value ? { groupId: groupId.value } : {}),
    ...(tableId.value ? { tableId: tableId.value } : {}),
  });
}
function percent(value: number) {
  return new Intl.NumberFormat(locale.value === "km" ? "km-KH" : "en", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value || 0);
}
function metric(
  label: string,
  value: number,
  previous: number,
  asPercent = false,
  digits = 0,
) {
  return {
    label,
    value: asPercent
      ? percent(value)
      : Number(value || 0).toLocaleString(
          locale.value === "km" ? "km-KH" : "en",
          { maximumFractionDigits: digits },
        ),
    change: previous ? ((value - previous) / previous) * 100 : value ? 100 : 0,
  };
}
function shortDate(value: string) {
  return new Intl.DateTimeFormat(locale.value === "km" ? "km-KH" : "en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    report.value = (await admin.request(
      `/api/admin/reports/menu-analytics?${params()}`,
    )) as Report;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("pages.reports.loadFailed");
  } finally {
    loading.value = false;
  }
}
async function exportCsv() {
  exporting.value = true;
  error.value = "";
  try {
    const dataset = (
      {
        overview: "daily",
        products: "products",
        tables: "tables",
        searches: "searches",
        promotions: "promotions",
      } as Row
    )[tab.value];
    const token = localStorage.getItem("mf_token");
    const api = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
    const query = params();
    query.set("dataset", dataset);
    const response = await fetch(
      `${api}/api/admin/reports/menu-analytics.csv?${query}`,
      { headers: token ? { authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) throw new Error(t("pages.reports.exportFailed"));
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `menu-analytics-${dataset}-${from.value}-to-${to.value}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("pages.reports.exportFailed");
  } finally {
    exporting.value = false;
  }
}

watch(branchId, () => {
  groupId.value = "";
  tableId.value = "";
});
watch(groupId, () => {
  if (
    tableId.value &&
    !filteredTableOptions.value.some((item) => item.id === tableId.value)
  )
    tableId.value = "";
});
onMounted(() => {
  void load();
  void admin
    .request("/api/admin/branches")
    .then((result) => {
      branches.value = result.branches;
    })
    .catch(() => {});
});
</script>
