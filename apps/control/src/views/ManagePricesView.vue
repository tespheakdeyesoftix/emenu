<template>
  <div>
    <PageHeader
      :eyebrow="$t('pages.managePrices.eyebrow')"
      :title="$t('pages.managePrices.title')"
      :description="$t('pages.managePrices.description')"
    />
    <div
      v-if="loadingProducts"
      class="card mb-5 p-8 text-center text-sm font-bold text-black/45"
    >
      កំពុងផ្ទុកមុខម្ហូបទាំងអស់…
    </div>
    <div
      v-else-if="loadError"
      class="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"
    >
      {{ loadError }}
    </div>
    <div
      v-if="!loadingProducts && !loadError"
      class="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_240px]"
    >
      <label
        ><span class="label">ស្វែងរកមុខម្ហូប</span
        ><input
          v-model="search"
          class="input"
          placeholder="ស្វែងរកតាមឈ្មោះ ឬកូដ"
      /></label>
      <label
        ><span class="label">ប្រភេទ</span
        ><select v-model="categoryId" class="input">
          <option value="">ប្រភេទទាំងអស់</option>
          <option
            v-for="category in store.categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.nameKm || category.name }}
          </option>
        </select></label
      >
    </div>
    <div v-if="!loadingProducts && !loadError" class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-left text-sm">
          <thead
            class="bg-cream text-xs uppercase tracking-[.08em] text-black/45"
          >
            <tr>
              <th class="sticky left-0 z-10 min-w-64 bg-cream px-4 py-4">
                មុខម្ហូប / ទំហំ
              </th>
              <th
                v-for="list in activeLists"
                :key="list.id"
                class="min-w-48 px-3 py-4"
              >
                <span class="block font-extrabold text-ink">{{
                  displayListName(list.name)
                }}</span>
                <small class="font-medium normal-case tracking-normal">{{
                  list.isNormal ? "ត្រូវបញ្ចូល" : "ទុកទទេដើម្បីប្រើតម្លៃធម្មតា"
                }}</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.key"
              class="border-t border-black/[.06]"
            >
              <th class="sticky left-0 z-10 bg-white px-4 py-3 font-bold">
                <span :class="row.portionId ? 'pl-5 text-black/60' : ''">{{
                  row.label
                }}</span>
                <small
                  v-if="row.portionId"
                  class="ml-2 font-medium text-black/30"
                  >ទំហំ</small
                >
              </th>
              <td
                v-for="list in activeLists"
                :key="list.id"
                class="px-3 py-2 align-top"
              >
                <div class="relative">
                  <input
                    v-model="drafts[cellKey(row, list.id)]"
                    type="number"
                    min="0"
                    :step="store.business.currency === 'USD' ? '0.01' : '1'"
                    class="input !rounded-xl !px-3 !py-2"
                    :class="
                      statuses[cellKey(row, list.id)] === 'error'
                        ? '!border-red-500'
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
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td
                :colspan="activeLists.length + 1"
                class="p-12 text-center text-black/40"
              >
                មិនមានមុខម្ហូបដែលត្រូវនឹងការស្វែងរកទេ។
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
