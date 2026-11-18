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
        <Spinner class="!size-[30px] mx-auto text-black/30" />
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
          <TextInput size="lg" variant="outline"
            v-model.trim="query"
            type="search"
            :placeholder="t('pages.catalog.bulkEdit.searchPlaceholder')"
            :aria-label="t('pages.catalog.bulkEdit.searchLabel')">
            <template #prefix>
              <Search :size="16" aria-hidden="true" />
            </template>
          </TextInput>
        </label>
        <label>
          <span class="sr-only">{{
            t("pages.catalog.bulkEdit.categoryFilter")
          }}</span>
          <Select
            size="lg"
            variant="outline"
            v-model="selectedCategory"
            :options="[
              { label: t('pages.catalog.bulkEdit.allCategories'), value: '' },
              ...categoryOptions.map(category => ({ label: categoryPath(category), value: category.id })),
            ]"
          />
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
        <List class="w-full [--list-gap:0px]" :columns="productColumns" :style="{ minWidth: (42 + (Number(enableEn) + Number(enableZh)) * 12) + 'rem' }">
          <ListHeader class="!h-auto min-h-9 bg-surface-gray-1 py-2 text-ink-gray-7">

              <ListHeaderCell class="px-2">មុខម្ហូប</ListHeaderCell>
              <ListHeaderCell class="px-2">
                {{ t("pages.catalog.bulkEdit.itemCode") }}
              </ListHeaderCell>
              <ListHeaderCell class="px-2">ឈ្មោះ · ខ្មែរ</ListHeaderCell>
              <ListHeaderCell v-if="enableEn" class="px-2">Name · English</ListHeaderCell>
              <ListHeaderCell v-if="enableZh" class="px-2">名称 · 中文</ListHeaderCell>
              <ListHeaderCell class="px-2">ឯកតា</ListHeaderCell>

          </ListHeader>

            <ListRow v-for="row in filteredRows" :key="row.id" :class="isChanged(row) ? 'bg-amber-50/55' : 'bg-white'">
              <ListCell class="!block px-2 py-2">
                <strong class="block truncate">{{ row.originalName }}</strong>
              </ListCell>
              <ListCell class="!block px-2 py-2">
                <TextInput size="lg" variant="outline"
                  v-model="row.code"
                  maxlength="64"
                  :aria-label="`${t('pages.catalog.bulkEdit.itemCode')} ${row.originalName}`"
                />
              </ListCell>
              <ListCell class="!block px-2 py-2">
                <TextInput size="lg" variant="outline"
                  v-model="row.nameKm"
                  maxlength="240"
                  required
                  lang="km"
                  :aria-label="`ឈ្មោះខ្មែររបស់ ${row.originalName}`"
                />
              </ListCell>
              <ListCell v-if="enableEn" class="!block px-2 py-2">
                <TextInput size="lg" variant="outline"
                  v-model="row.nameEn"
                  maxlength="240"
                  :aria-label="`English name for ${row.originalName}`"
                />
              </ListCell>
              <ListCell v-if="enableZh" class="!block px-2 py-2">
                <TextInput size="lg" variant="outline"
                  v-model="row.nameZh"
                  maxlength="240"
                  lang="zh"
                  :aria-label="`中文名称 ${row.originalName}`"
                />
              </ListCell>
              <ListCell class="!block px-2 py-2">
                <TextInput size="lg" variant="outline"
                  v-model="row.unit"
                  maxlength="40"
                  placeholder="ចាន / កែវ"
                  :aria-label="`ឯកតារបស់ ${row.originalName}`"
                />
              </ListCell>
            </ListRow>

        </List>
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
              <TextInput size="lg" variant="outline" v-model="row.code" maxlength="64" />
            </label>
            <label>
              <span class="label">ឈ្មោះមុខម្ហូប · ខ្មែរ</span>
              <TextInput size="lg" variant="outline"
                v-model="row.nameKm"
                maxlength="240"
                required
                lang="km"
              />
            </label>
            <label v-if="enableEn">
              <span class="label">Product name · English</span>
              <TextInput size="lg" variant="outline" v-model="row.nameEn" maxlength="240" />
            </label>
            <label v-if="enableZh">
              <span class="label">产品名称 · 中文</span>
              <TextInput size="lg" variant="outline"
                v-model="row.nameZh"
                maxlength="240"
                lang="zh"
              />
            </label>
            <label>
              <span class="label">ឯកតា</span>
              <TextInput size="lg" variant="outline"
                v-model="row.unit"
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
      <Alert v-if="validationError" theme="red" :title="validationError" class="mb-0 mt-4" />
      <Alert v-if="error" theme="red" :title="error" class="mb-0 mt-4" />
    </template>

    <template v-if="!loading" #footer>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="saving"
          @click="requestClose"
        >
          បោះបង់
        </Button>
        <Button variant="solid" size="lg"
          type="button"
          :disabled="saving || !changedRows.length || Boolean(validationError)"
          @click="save"
        >
          <template #prefix><Spinner v-if="saving" />
          <Save v-else :size="16" /></template>
          {{ saving ? "កំពុងរក្សាទុក…" : `រក្សាទុក ${changedRows.length} មុខ` }}
        </Button>
      </div>
    </template>
  </ModalPanel>

  <ModalPanel
    :open="discardPromptOpen"
    :title="t('pages.catalog.bulkEdit.unsavedTitle')"
    :close-on-backdrop="false"
    @close="dismissDiscard"
  >
    <Alert theme="amber" :title="t('pages.catalog.bulkEdit.unsavedMessage')" />

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="subtle" size="lg" class="sm:min-w-32" @click="dismissDiscard">
          {{ t("pages.catalog.bulkEdit.keepEditing") }}
        </Button>
        <Button
          variant="solid" theme="red" size="lg" type="button"
          class="sm:min-w-36"
          @click="discardChanges"
        >
          {{ t("pages.catalog.bulkEdit.discardChanges") }}
        </Button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { List, ListCell, ListHeader, ListHeaderCell, ListRow } from "frappe-ui/list";
import { Alert, Button, Select, TextInput, Spinner } from "frappe-ui";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Save, Search } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import ModalPanel from "./ModalPanel.vue";
import type { BulkProductInfoUpdate, Category, Product } from "../stores/admin";

type EditableRow = BulkProductInfoUpdate & {
  categoryId: string;
  originalName: string;
};

const productColumns = computed(() => ["minmax(12rem,1.2fr)", "9rem", "minmax(12rem,1fr)", ...(props.enableEn ? ["minmax(12rem,1fr)"] : []), ...(props.enableZh ? ["minmax(12rem,1fr)"] : []), "9rem"]);
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
let discardDecision: Promise<boolean> | undefined;
let resolveDiscard: ((confirmed: boolean) => void) | undefined;

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

function confirmDiscard() {
  discardPromptOpen.value = true;
  discardDecision ??= new Promise<boolean>((resolve) => {
    resolveDiscard = resolve;
  });
  return discardDecision;
}

function settleDiscard(confirmed: boolean) {
  discardPromptOpen.value = false;
  resolveDiscard?.(confirmed);
  resolveDiscard = undefined;
  discardDecision = undefined;
}

function dismissDiscard() {
  settleDiscard(false);
}

function discardChanges() {
  settleDiscard(true);
  emit("close");
}

defineExpose({ confirmDiscard });
onBeforeUnmount(dismissDiscard);

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
      dismissDiscard();
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
