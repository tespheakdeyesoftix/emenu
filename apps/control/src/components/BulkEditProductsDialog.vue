<template>
  <ModalPanel
    :open="open"
    :title="t('pages.catalog.bulkEdit.title')"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="false"
    @close="requestClose"
  >
    <p class="mb-5 mt-0 text-sm leading-6 text-black/50">
      {{ t("pages.catalog.bulkEdit.description") }}
    </p>

    <div
      v-if="loading"
      class="grid min-h-72 place-items-center rounded-2xl bg-cream text-center"
    >
      <div>
        <LoaderCircle :size="30" class="mx-auto animate-spin text-black/30" />
        <p class="mb-0 mt-3 text-sm font-bold text-black/45">
          កំពុងផ្ទុកមុខម្ហូបទាំងអស់…
        </p>
      </div>
    </div>

    <template v-else>
      <div
        class="sticky top-0 z-10 -mx-2 mb-4 grid gap-3 bg-white/95 px-2 pb-3 backdrop-blur md:grid-cols-[minmax(220px,1fr)_minmax(190px,260px)_auto] md:items-center"
      >
        <label class="relative block">
          <Search
            :size="16"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
          />
          <input
            v-model.trim="query"
            type="search"
            class="input !pl-9"
            :placeholder="t('pages.catalog.bulkEdit.searchPlaceholder')"
            :aria-label="t('pages.catalog.bulkEdit.searchLabel')"
          />
        </label>
        <label>
          <span class="sr-only">{{
            t("pages.catalog.bulkEdit.categoryFilter")
          }}</span>
          <select v-model="selectedCategory" class="input">
            <option value="">
              {{ t("pages.catalog.bulkEdit.allCategories") }}
            </option>
            <option
              v-for="category in categoryOptions"
              :key="category.id"
              :value="category.id"
            >
              {{ categoryPath(category) }}
            </option>
          </select>
        </label>
        <div class="flex items-center gap-2 text-xs font-bold">
          <span class="rounded-full bg-cream px-3 py-2 text-black/45">
            {{ filteredRows.length }} / {{ rows.length }} មុខ
          </span>
          <span
            class="rounded-full px-3 py-2"
            :class="
              changedRows.length
                ? 'bg-ink text-white'
                : 'bg-cream text-black/35'
            "
          >
            {{ changedRows.length }} បានកែ
          </span>
        </div>
      </div>

      <div
        class="hidden overflow-x-auto rounded-2xl border border-black/[.07] md:block"
      >
        <table class="w-full min-w-[900px] border-collapse text-sm">
          <thead
            class="sticky top-[76px] z-[1] bg-cream text-left text-xs text-black/50"
          >
            <tr>
              <th class="w-52 p-3">មុខម្ហូប</th>
              <th class="w-36 min-w-32 p-3">
                {{ t("pages.catalog.bulkEdit.itemCode") }}
              </th>
              <th class="min-w-48 p-3">ឈ្មោះ · ខ្មែរ</th>
              <th v-if="enableEn" class="min-w-48 p-3">Name · English</th>
              <th v-if="enableZh" class="min-w-48 p-3">名称 · 中文</th>
              <th class="w-36 min-w-32 p-3">ឯកតា</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredRows"
              :key="row.id"
              class="border-t border-black/[.06] align-top"
              :class="isChanged(row) ? 'bg-amber-50/55' : 'bg-white'"
            >
              <td class="p-3">
                <strong class="block truncate">{{ row.originalName }}</strong>
              </td>
              <td class="p-2">
                <input
                  v-model="row.code"
                  class="input"
                  maxlength="64"
                  :aria-label="`${t('pages.catalog.bulkEdit.itemCode')} ${row.originalName}`"
                />
              </td>
              <td class="p-2">
                <input
                  v-model="row.nameKm"
                  class="input"
                  maxlength="240"
                  required
                  lang="km"
                  :aria-label="`ឈ្មោះខ្មែររបស់ ${row.originalName}`"
                />
              </td>
              <td v-if="enableEn" class="p-2">
                <input
                  v-model="row.nameEn"
                  class="input"
                  maxlength="240"
                  :aria-label="`English name for ${row.originalName}`"
                />
              </td>
              <td v-if="enableZh" class="p-2">
                <input
                  v-model="row.nameZh"
                  class="input"
                  maxlength="240"
                  lang="zh"
                  :aria-label="`中文名称 ${row.originalName}`"
                />
              </td>
              <td class="p-2">
                <input
                  v-model="row.unit"
                  class="input"
                  maxlength="40"
                  placeholder="ចាន / កែវ"
                  :aria-label="`ឯកតារបស់ ${row.originalName}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="space-y-3 md:hidden">
        <article
          v-for="row in filteredRows"
          :key="row.id"
          class="rounded-2xl border p-4"
          :class="
            isChanged(row)
              ? 'border-amber-300 bg-amber-50/55'
              : 'border-black/[.07] bg-white'
          "
        >
          <div class="mb-4 min-w-0">
            <strong class="block truncate text-sm">{{
              row.originalName
            }}</strong>
          </div>
          <div class="grid gap-3">
            <label>
              <span class="label">{{
                t("pages.catalog.bulkEdit.itemCode")
              }}</span>
              <input v-model="row.code" class="input" maxlength="64" />
            </label>
            <label>
              <span class="label">ឈ្មោះមុខម្ហូប · ខ្មែរ</span>
              <input
                v-model="row.nameKm"
                class="input"
                maxlength="240"
                required
                lang="km"
              />
            </label>
            <label v-if="enableEn">
              <span class="label">Product name · English</span>
              <input v-model="row.nameEn" class="input" maxlength="240" />
            </label>
            <label v-if="enableZh">
              <span class="label">产品名称 · 中文</span>
              <input
                v-model="row.nameZh"
                class="input"
                maxlength="240"
                lang="zh"
              />
            </label>
            <label>
              <span class="label">ឯកតា</span>
              <input
                v-model="row.unit"
                class="input"
                maxlength="40"
                placeholder="ចាន / កែវ"
              />
            </label>
          </div>
        </article>
      </div>

      <p
        v-if="!filteredRows.length"
        class="rounded-2xl bg-cream p-8 text-center text-sm text-black/40"
      >
        មិនមានមុខម្ហូបត្រូវនឹងការស្វែងរកទេ។
      </p>
      <p
        v-if="validationError"
        class="mb-0 mt-4 text-xs font-bold text-red-600"
      >
        {{ validationError }}
      </p>
      <p v-if="error" class="mb-0 mt-4 text-xs font-bold text-red-600">
        {{ error }}
      </p>
    </template>

    <template v-if="!loading" #footer>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="btn-soft"
          :disabled="saving"
          @click="requestClose"
        >
          បោះបង់
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="saving || !changedRows.length || Boolean(validationError)"
          @click="save"
        >
          <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
          <Save v-else :size="16" />
          {{ saving ? "កំពុងរក្សាទុក…" : `រក្សាទុក ${changedRows.length} មុខ` }}
        </button>
      </div>
    </template>
  </ModalPanel>

  <ModalPanel
    :open="discardPromptOpen"
    :title="t('pages.catalog.bulkEdit.unsavedTitle')"
    :close-on-backdrop="false"
    @close="discardPromptOpen = false"
  >
    <div role="alertdialog" aria-modal="true">
      <div class="flex gap-4 rounded-2xl bg-amber-50 p-4 text-amber-950">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
        >
          <TriangleAlert :size="20" />
        </span>
        <p class="m-0 text-sm leading-6">
          {{ t("pages.catalog.bulkEdit.unsavedMessage") }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button class="btn-soft sm:min-w-32" @click="discardPromptOpen = false">
          {{ t("pages.catalog.bulkEdit.keepEditing") }}
        </button>
        <button
          class="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-red-700 sm:min-w-36"
          @click="discardChanges"
        >
          {{ t("pages.catalog.bulkEdit.discardChanges") }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LoaderCircle, Save, Search, TriangleAlert } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import ModalPanel from "./ModalPanel.vue";
import type { BulkProductInfoUpdate, Category, Product } from "../stores/admin";

type EditableRow = BulkProductInfoUpdate & {
  categoryId: string;
  originalName: string;
};

const { locale, t } = useI18n();

const props = defineProps<{
  open: boolean;
  products: Product[];
  categories: Category[];
  enableEn: boolean;
  enableZh: boolean;
  loading: boolean;
  saving: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [items: BulkProductInfoUpdate[]];
  dirtyChange: [dirty: boolean];
}>();

const query = ref("");
const selectedCategory = ref("");
const rows = ref<EditableRow[]>([]);
const initialValues = ref(new Map<string, BulkProductInfoUpdate>());
const discardPromptOpen = ref(false);

const normalize = (value: string) => value.trim();
const comparable = (row: BulkProductInfoUpdate) => ({
  code: normalize(row.code),
  nameKm: normalize(row.nameKm),
  nameEn: normalize(row.nameEn),
  nameZh: normalize(row.nameZh),
  unit: normalize(row.unit),
});

function isChanged(row: EditableRow) {
  const initial = initialValues.value.get(row.id);
  if (!initial) return false;
  return (
    JSON.stringify(comparable(row)) !== JSON.stringify(comparable(initial))
  );
}

const changedRows = computed(() => rows.value.filter(isChanged));
const categoryOptions = computed(() =>
  [...props.categories].sort(
    (a, b) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      categoryName(a).localeCompare(categoryName(b)),
  ),
);

function categoryName(category: Category) {
  if (locale.value === "en")
    return category.nameEn || category.nameKm || category.name;
  return category.nameKm || category.name || category.nameEn || "";
}

function categoryPath(category: Category) {
  const parent = category.parentId
    ? props.categories.find((item) => item.id === category.parentId)
    : null;
  return parent
    ? `${categoryName(parent)} / ${categoryName(category)}`
    : categoryName(category);
}

const filteredRows = computed(() => {
  const needle = query.value.toLocaleLowerCase().trim();
  return rows.value
    .filter(
      (row) =>
        !selectedCategory.value || row.categoryId === selectedCategory.value,
    )
    .filter(
      (row) =>
        !needle ||
        [row.code, row.nameKm, row.nameEn, row.nameZh, row.unit]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle),
    );
});
const duplicateCode = computed(() => {
  const codes = new Set<string>();
  for (const row of rows.value) {
    const code = normalize(row.code).toLocaleLowerCase();
    if (!code) continue;
    if (codes.has(code)) return row.code.trim();
    codes.add(code);
  }
  return "";
});
const validationError = computed(() =>
  changedRows.value.length > 500
    ? "អាចរក្សាទុកការកែសម្រួលបានអតិបរមា 500 មុខក្នុងមួយដង។"
    : changedRows.value.some((row) => !row.nameKm.trim())
      ? "ឈ្មោះមុខម្ហូបជាភាសាខ្មែរមិនអាចទទេបានទេ។"
      : duplicateCode.value
        ? t("pages.catalog.bulkEdit.duplicateCode", {
            code: duplicateCode.value,
          })
        : "",
);

function resetRows() {
  rows.value = props.products.map((product) => ({
    id: product.id,
    code: product.code || "",
    categoryId: product.categoryId,
    originalName: product.nameKm || product.name,
    nameKm: product.nameKm || product.name,
    nameEn: product.nameEn || "",
    nameZh: product.nameZh || "",
    unit: product.unit || "",
  }));
  initialValues.value = new Map(
    rows.value.map((row) => [
      row.id,
      {
        id: row.id,
        code: row.code,
        nameKm: row.nameKm,
        nameEn: row.nameEn,
        nameZh: row.nameZh,
        unit: row.unit,
      },
    ]),
  );
}

function save() {
  if (validationError.value || !changedRows.value.length) return;
  emit(
    "save",
    changedRows.value.map((row) => ({ id: row.id, ...comparable(row) })),
  );
}

function requestClose() {
  if (props.saving) return;
  if (changedRows.value.length) {
    discardPromptOpen.value = true;
    return;
  }
  emit("close");
}

function discardChanges() {
  discardPromptOpen.value = false;
  emit("close");
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!props.open || props.saving || !changedRows.value.length) return;
  event.preventDefault();
  event.returnValue = "";
}

onMounted(() => window.addEventListener("beforeunload", warnBeforeUnload));
onBeforeUnmount(() =>
  window.removeEventListener("beforeunload", warnBeforeUnload),
);

watch(
  () => changedRows.value.length > 0,
  (dirty) => emit("dirtyChange", dirty),
  { immediate: true },
);

watch(
  () => [props.open, props.loading, props.products] as const,
  ([open, loading]) => {
    if (!open) {
      discardPromptOpen.value = false;
      emit("dirtyChange", false);
      return;
    }
    if (loading) return;
    query.value = "";
    selectedCategory.value = "";
    resetRows();
  },
  { immediate: true },
);
</script>
