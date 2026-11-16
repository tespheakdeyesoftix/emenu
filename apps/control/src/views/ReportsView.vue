<template>
  <div>
    <PageHeader
      :eyebrow="t('pages.reports.eyebrow')"
      :title="t('pages.reports.title')"
      :description="t('pages.reports.description')"
    >
      <button
        class="btn-soft"
        :disabled="loading || exporting"
        @click="exportCsv"
      >
        <LoaderCircle v-if="exporting" :size="16" class="animate-spin" />
        <Download v-else :size="16" />{{ t("pages.reports.export") }}
      </button>
    </PageHeader>

    <section class="card mb-5 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in presets"
            :key="preset.days"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold"
            :class="
              activePreset === preset.days
                ? 'bg-ink text-white'
                : 'bg-cream text-ink'
            "
            @click="setPreset(preset.days)"
          >
            {{ preset.label }}
          </button>
        </div>
        <label class="text-xs font-bold text-black/45">
          {{ t("pages.reports.from") }}
          <input
            v-model="from"
            type="date"
            class="mt-1 block rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <label class="text-xs font-bold text-black/45">
          {{ t("pages.reports.to") }}
          <input
            v-model="to"
            type="date"
            class="mt-1 block rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <label class="text-xs font-bold text-black/45">
          {{ t("pages.reports.language") }}
          <select
            v-model="language"
            class="mt-1 block rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">{{ t("pages.reports.all") }}</option>
            <option value="km">ខ្មែរ</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label class="text-xs font-bold text-black/45">
          {{ t('menus.branch') }}
          <select v-model="branchId" class="mt-1 block max-w-44 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink">
            <option value="">{{ t('menus.allBranches') }}</option>
            <option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
          </select>
        </label>
        <label class="text-xs font-bold text-black/45">
          {{ t("pages.reports.area") }}
          <select
            v-model="groupId"
            class="mt-1 block max-w-44 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">{{ t("pages.reports.all") }}</option>
            <option v-for="group in groups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </label>
        <label class="text-xs font-bold text-black/45">
          {{ t("pages.reports.table") }}
          <select
            v-model="tableId"
            class="mt-1 block max-w-44 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">{{ t("pages.reports.all") }}</option>
            <option
              v-for="table in filteredTableOptions"
              :key="table.id"
              :value="table.id"
            >
              {{ table.groupName }} · {{ table.label }}
            </option>
          </select>
        </label>
        <button class="btn-primary" :disabled="loading" @click="load">
          <LoaderCircle v-if="loading" :size="16" class="animate-spin" />
          <RefreshCw v-else :size="16" />{{ t("pages.reports.apply") }}
        </button>
      </div>
      <p v-if="error" class="mb-0 mt-3 text-sm font-semibold text-red-600">
        {{ error }}
      </p>
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

      <nav
        class="my-5 flex gap-2 overflow-x-auto"
        :aria-label="t('pages.reports.sections')"
      >
        <button
          v-for="item in tabs"
          :key="item.id"
          class="shrink-0 rounded-full px-4 py-2.5 text-sm font-bold"
          :class="
            tab === item.id ? 'bg-ink text-white' : 'bg-white text-black/55'
          "
          @click="tab = item.id"
        >
          {{ item.label }}
        </button>
      </nav>

      <section
        v-if="tab === 'overview'"
        class="grid gap-5 xl:grid-cols-[1.5fr_.75fr]"
      >
        <article class="card p-5">
          <h2 class="display m-0 text-xl">
            {{ t("pages.reports.dailyTrend") }}
          </h2>
          <div
            v-if="report.daily.length"
            class="mt-6 flex h-56 items-end gap-1 overflow-x-auto border-b border-black/10"
          >
            <div
              v-for="day in report.daily"
              :key="day.date"
              class="group flex min-w-5 flex-1 flex-col items-center justify-end"
            >
              <span
                class="mb-1 hidden text-[10px] font-bold group-hover:block"
                >{{ day.menuSessions }}</span
              >
              <div
                class="w-full min-w-3 rounded-t bg-ink/80"
                :style="{ height: `${barHeight(day.menuSessions, maxDaily)}%` }"
              ></div>
              <span class="mt-2 text-[9px] text-black/35">{{
                shortDate(day.date)
              }}</span>
            </div>
          </div>
          <EmptyState v-else />
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
import {
  computed,
  defineComponent,
  h,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { Download, LoaderCircle, RefreshCw } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import PageHeader from "../components/PageHeader.vue";
import ReportTable from "../components/ReportDataTable.vue";
import { useAdminStore } from "../stores/admin";
import type { BranchOption } from "../types/menu";

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
const activePreset = ref(30);
const presets = computed(() =>
  [7, 30, 90].map((days) => ({
    days,
    label: t("pages.reports.days", { count: days }),
  })),
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
    if (table.groupId && (!branchId.value || table.branchId === branchId.value)) seen.set(table.groupId, table.groupName);
  return [...seen].map(([id, name]) => ({ id, name }));
});
const filteredTableOptions = computed(() =>
  (report.value?.tables || []).filter(
    (item) => (!branchId.value || item.branchId === branchId.value) && (!groupId.value || item.groupId === groupId.value),
  ),
);
const maxDaily = computed(() =>
  Math.max(
    1,
    ...(report.value?.daily || []).map((row) => Number(row.menuSessions || 0)),
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
  activePreset.value = days;
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
function barHeight(value: number, maximum: number) {
  return Math.max(2, (Number(value || 0) / maximum) * 100);
}
function shortDate(value: string) {
  return new Intl.DateTimeFormat(locale.value === "km" ? "km-KH" : "en", {
    month: "short",
    day: "numeric",
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

watch(branchId, () => { groupId.value = ""; tableId.value = ""; });
watch(groupId, () => {
  if (
    tableId.value &&
    !filteredTableOptions.value.some((item) => item.id === tableId.value)
  )
    tableId.value = "";
});
onMounted(() => {
  void load();
  void admin.request("/api/admin/branches").then((result) => { branches.value = result.branches; }).catch(() => {});
});
</script>
