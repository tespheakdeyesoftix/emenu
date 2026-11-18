<template>
  <div>
    <PageHeader :title="$t('pages.managePrices.title')" />
    <div
      v-if="loadingProducts"
      class="card mb-5 p-8 text-center text-sm font-bold text-black/45"
    >
      កំពុងផ្ទុកមុខម្ហូបទាំងអស់…
    </div>
    <Alert v-else-if="loadError" theme="red" :title="loadError" class="mb-5" />
    <div
      v-if="!loadingProducts && !loadError"
      class="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_240px]"
    >
      <label
        ><span class="label">ស្វែងរកមុខម្ហូប</span
        ><TextInput
          size="lg"
          variant="outline"
          v-model="search"
          placeholder="ស្វែងរកតាមឈ្មោះ ឬកូដ"
      /></label>
      <label
        ><span class="label">ប្រភេទ</span
        ><Select
          size="lg"
          variant="outline"
          v-model="categoryId"
          :options="[
            { label: 'ប្រភេទទាំងអស់', value: '' },
            ...store.categories.map((category) => ({
              label: category.nameKm || category.name,
              value: category.id,
            })),
          ]"
      /></label>
    </div>
    <div v-if="!loadingProducts && !loadError" class="card overflow-hidden">
      <div class="overflow-x-auto">
        <List
          class="w-full [--list-gap:0px]"
          :columns="priceColumns"
          :style="{ minWidth: 16 + activeLists.length * 12 + 'rem' }"
        >
          <ListHeader
            class="!h-auto min-h-9 bg-surface-gray-1 py-2 text-ink-gray-7"
          >
            <ListHeaderCell
              class="sticky start-0 z-10 self-stretch bg-surface-gray-1 px-4"
            >
              មុខម្ហូប / ទំហំ
            </ListHeaderCell>
            <ListHeaderCell
              v-for="list in activeLists"
              :key="list.id"
              class="px-2"
            >
              <span class="block font-extrabold text-ink">{{
                displayListName(list.name)
              }}</span>
              <small class="font-medium normal-case tracking-normal">{{
                list.isNormal ? "ត្រូវបញ្ចូល" : "ទុកទទេដើម្បីប្រើតម្លៃធម្មតា"
              }}</small>
            </ListHeaderCell>
          </ListHeader>

          <ListRow v-for="row in rows" :key="row.key">
            <ListCell
              role="rowheader"
              class="sticky start-0 z-10 self-stretch bg-surface-base px-4 font-semibold"
            >
              <span :class="row.portionId ? 'pl-5 text-black/60' : ''">{{
                row.label
              }}</span>
              <small v-if="row.portionId" class="ml-2 font-medium text-black/30"
                >ទំហំ</small
              >
            </ListCell>
            <ListCell
              v-for="list in activeLists"
              :key="list.id"
              class="!block px-2 py-2"
            >
              <div class="relative">
                <TextInput
                  size="lg"
                  variant="outline"
                  v-model.number="drafts[cellKey(row, list.id)]"
                  type="number"
                  min="0"
                  :step="store.business.currency === 'USD' ? '0.01' : '1'"
                  class="!rounded-xl !px-3 !py-2"
                  :class="
                    statuses[cellKey(row, list.id)] === 'error'
                      ? '[&_[data-slot=control]]:!border-outline-red-3'
                      : ''
                  "
                  :placeholder="list.isNormal ? '' : String(normalPrice(row))"
                  @input="queueSave(row, list)"
                  @blur="saveNow(row, list)"
                />
                <p
                  class="mb-0 mt-1 h-4 text-[10px] font-bold"
                  :class="statusClass(cellKey(row, list.id))"
                >
                  {{ statusText(row, list) }}
                </p>
              </div>
            </ListCell>
          </ListRow>
        </List>
        <p
          v-if="!rows.length"
          class="p-10 text-center text-base text-ink-gray-5"
        >
          មិនមានមុខម្ហូបដែលត្រូវនឹងការស្វែងរកទេ។
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  List,
  ListCell,
  ListHeader,
  ListHeaderCell,
  ListRow,
} from "frappe-ui/list";
import { Alert, Select, TextInput } from "frappe-ui";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import PageHeader from "../components/PageHeader.vue";
import { useAdminStore, type PriceList } from "../stores/admin";

type PriceRow = {
  key: string;
  productId: string;
  portionId: string | null;
  label: string;
  normalFallback: number;
};
const store = useAdminStore();
const search = ref("");
const categoryId = ref("");
const drafts = reactive<Record<string, string>>(Object.create(null));
const statuses = reactive<Record<string, "saving" | "saved" | "error" | "">>(
  Object.create(null),
);
const errors = reactive<Record<string, string>>(Object.create(null));
const timers = new Map<string, number>();
const inflight = new Set<string>();
const dirty = new Set<string>();
const loadingProducts = ref(true);
const loadError = ref("");

const activeLists = computed(() =>
  store.priceLists.filter((list) => !list.isArchived),
);
const priceColumns = computed(() => [
  "minmax(16rem,1.2fr)",
  ...activeLists.value.map(() => "minmax(12rem,1fr)"),
]);
const rows = computed<PriceRow[]>(() => {
  const needle = search.value.trim().toLowerCase();
  return store.products
    .filter(
      (product) => !categoryId.value || product.categoryId === categoryId.value,
    )
    .filter((product) =>
      `${product.nameKm || product.name} ${product.nameEn || ""} ${product.code || ""}`
        .toLowerCase()
        .includes(needle),
    )
    .flatMap((product): PriceRow[] => {
      const portionRows: PriceRow[] = (product.portions || []).map(
        (portion) => ({
          key: `${product.id}:${portion.id}`,
          productId: product.id,
          portionId: portion.id,
          label: `${product.nameKm || product.name} · ${portion.labelKm}`,
          normalFallback: portion.priceCents,
        }),
      );
      return portionRows.length
        ? portionRows
        : [
            {
              key: `${product.id}:base`,
              productId: product.id,
              portionId: null,
              label: product.nameKm || product.name,
              normalFallback: product.priceCents,
            },
          ];
    });
});

function cellKey(row: PriceRow, priceListId: string) {
  return `${row.productId}:${row.portionId || "base"}:${priceListId}`;
}
function displayListName(name: string) {
  return name === "Normal Rate" ? "តម្លៃធម្មតា" : name;
}
function entryFor(row: PriceRow, priceListId: string) {
  return store.priceEntries.find(
    (entry) =>
      entry.productId === row.productId &&
      entry.priceListId === priceListId &&
      entry.portionId === row.portionId,
  );
}
function normalPrice(row: PriceRow) {
  const normal = activeLists.value.find((list) => list.isNormal);
  return normal
    ? (entryFor(row, normal.id)?.priceCents ?? row.normalFallback)
    : row.normalFallback;
}
function syncDrafts() {
  for (const row of rows.value)
    for (const list of activeLists.value) {
      const key = cellKey(row, list.id);
      if (inflight.has(key) || dirty.has(key)) continue;
      const entry = entryFor(row, list.id);
      drafts[key] = entry
        ? String(entry.priceCents)
        : list.isNormal
          ? String(row.normalFallback)
          : "";
    }
}
watch([rows, activeLists, () => store.priceEntries], syncDrafts, {
  immediate: true,
  deep: true,
});

function queueSave(row: PriceRow, list: PriceList) {
  const key = cellKey(row, list.id);
  dirty.add(key);
  statuses[key] = "";
  errors[key] = "";
  const existing = timers.get(key);
  if (existing) window.clearTimeout(existing);
  timers.set(
    key,
    window.setTimeout(() => void persist(row, list), 650),
  );
}
function saveNow(row: PriceRow, list: PriceList) {
  const key = cellKey(row, list.id);
  const existing = timers.get(key);
  if (existing) window.clearTimeout(existing);
  timers.delete(key);
  if (dirty.has(key)) void persist(row, list);
}
async function persist(row: PriceRow, list: PriceList) {
  const key = cellKey(row, list.id);
  if (inflight.has(key)) return;
  const raw = String(drafts[key] ?? "").trim();
  if (list.isNormal && raw === "") {
    statuses[key] = "error";
    errors[key] = "ត្រូវបញ្ចូលតម្លៃធម្មតា។";
    return;
  }
  const amount = raw === "" ? null : Number(raw);
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    statuses[key] = "error";
    errors[key] = "សូមបញ្ចូលតម្លៃឱ្យបានត្រឹមត្រូវ។";
    return;
  }
  dirty.delete(key);
  inflight.add(key);
  statuses[key] = "saving";
  try {
    await store.saveProductPrice({
      productId: row.productId,
      priceListId: list.id,
      portionId: row.portionId,
      priceCents: amount,
    });
    statuses[key] = "saved";
    window.setTimeout(() => {
      if (statuses[key] === "saved") statuses[key] = "";
    }, 1500);
  } catch (caught) {
    statuses[key] = "error";
    errors[key] =
      caught instanceof Error ? caught.message : "មិនអាចរក្សាទុកបានទេ។";
  } finally {
    inflight.delete(key);
    if (dirty.has(key)) void persist(row, list);
  }
}
function statusText(row: PriceRow, list: PriceList) {
  const key = cellKey(row, list.id);
  if (statuses[key] === "saving") return "កំពុងរក្សាទុក…";
  if (statuses[key] === "saved") return "បានរក្សាទុក";
  if (statuses[key] === "error") return errors[key] || "មិនអាចរក្សាទុកបានទេ។";
  return !list.isNormal && String(drafts[key] ?? "") === ""
    ? `ប្រើតម្លៃ ${normalPrice(row)}`
    : "";
}
function statusClass(key: string) {
  return statuses[key] === "error"
    ? "text-red-600"
    : statuses[key] === "saved"
      ? "text-emerald-600"
      : "text-black/35";
}
onBeforeUnmount(() => timers.forEach((timer) => window.clearTimeout(timer)));
onMounted(async () => {
  try {
    await store.loadAllProducts();
  } catch (error) {
    loadError.value =
      error instanceof Error
        ? error.message
        : "មិនអាចផ្ទុកមុខម្ហូបទាំងអស់បានទេ។";
  } finally {
    loadingProducts.value = false;
  }
});
</script>
