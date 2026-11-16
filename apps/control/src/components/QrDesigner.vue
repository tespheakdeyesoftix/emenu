<template>
  <ModalPanel
    :open="open"
    :title="draft.id ? 'កែសម្រួលការរចនា QR' : 'បង្កើតការរចនា QR'"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="false"
    @close="$emit('close')"
  >
    <div class="grid gap-6 xl:grid-cols-[390px_1fr]">
      <div class="space-y-5">
        <section class="rounded-3xl bg-cream p-5">
          <label
            ><span class="label">ឈ្មោះការរចនា</span
            ><input v-model="draft.name" class="input"
          /></label>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="preset in qrPresets"
              :key="preset.key"
              type="button"
              class="rounded-2xl border p-3 text-left transition"
              :class="
                draft.presetKey === preset.key
                  ? 'border-ink bg-ink text-white'
                  : 'border-black/10 bg-white'
              "
              @click="choosePreset(preset.key)"
            >
              <span class="text-xl">{{ preset.icon }}</span>
              <span class="mt-2 block text-xs font-extrabold">{{
                preset.name
              }}</span>
              <span class="mt-1 block text-[10px] opacity-55"
                >{{ preset.widthMm }} × {{ preset.heightMm }} mm</span
              >
            </button>
          </div>
        </section>

        <details
          open
          class="rounded-3xl border border-black/[.07] bg-white p-5"
        >
          <summary class="cursor-pointer font-extrabold">
            ខ្លឹមសារ និងគោលដៅ
          </summary>
          <div class="mt-4 space-y-4">
            <label
              ><span class="label">គោលដៅ QR</span
              ><select v-model="draft.targetType" class="input">
                <option value="menu">ម៉ឺនុយទូទៅ</option>
                <option value="table">ម៉ឺនុយសម្រាប់តុនីមួយៗ</option>
              </select></label
            >
            <div v-if="draft.targetType === 'table'" class="space-y-3">
              <label class="flex cursor-pointer items-center gap-3 text-sm font-bold">
                <input
                  v-model="draft.config.showTableGroup"
                  type="checkbox"
                  class="size-4 shrink-0 accent-black"
                />
                {{ t("pages.qrDesigns.showTableGroup") }}
              </label>
              <label class="block">
                <span class="label">{{ t("pages.qrDesigns.tablePrefix") }}</span>
                <input
                  v-model.trim="draft.config.tablePrefix"
                  class="input"
                  :maxlength="maxQrTablePrefixLength"
                />
              </label>
            </div>
            <label
              ><span class="label">ឈ្មោះអាជីវកម្ម</span
              ><select v-model="draft.config.businessNameMode" class="input">
                <option value="profile">យកតាមព័ត៌មានអាជីវកម្ម</option>
                <option value="custom">កំណត់អត្ថបទផ្ទាល់ខ្លួន</option>
              </select></label
            >
            <input
              v-if="draft.config.businessNameMode === 'custom'"
              v-model="draft.config.customBusinessName"
              class="input"
              maxlength="100"
              placeholder="ឈ្មោះអាជីវកម្ម"
            />
            <label
              ><span class="label">ពាក្យស្លោក</span
              ><select v-model="draft.config.taglineMode" class="input">
                <option value="profile">យកតាមព័ត៌មានអាជីវកម្ម</option>
                <option value="custom">កំណត់អត្ថបទផ្ទាល់ខ្លួន</option>
              </select></label
            >
            <input
              v-if="draft.config.taglineMode === 'custom'"
              v-model="draft.config.customTagline"
              class="input"
              maxlength="180"
              placeholder="ពាក្យស្លោករបស់អ្នក"
            />
            <label
              ><span class="label">អត្ថបទអំពាវនាវឱ្យចុច</span
              ><input
                v-model="draft.config.ctaText"
                class="input"
                maxlength="120"
            /></label>
            <label class="flex cursor-pointer items-center gap-3 text-sm font-bold">
              <input
                v-model="draft.config.showFooterText"
                type="checkbox"
                class="size-4 shrink-0 accent-black"
              />
              {{ t("pages.qrDesigns.showFooterText") }}
            </label>
            <label v-if="draft.config.showFooterText" class="block">
              <span class="label">{{ t("pages.qrDesigns.footerText") }}</span>
              <input
                v-model.trim="draft.config.footerText"
                class="input"
                :maxlength="maxQrFooterTextLength"
              />
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label
                class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
              >
                <input
                  v-model="draft.config.showLogo"
                  type="checkbox"
                  class="mt-0.5 size-4 shrink-0 accent-black"
                />
                <span>
                  បង្ហាញឡូហ្គោ
                  <small class="mt-1 block font-medium leading-5 text-black/45">
                    បិទដើម្បីផ្តល់កន្លែងបន្ថែមសម្រាប់ឈ្មោះ និង QR។
                  </small>
                </span>
              </label>
              <label
                class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
              >
                <input
                  v-model="draft.config.showBusinessName"
                  type="checkbox"
                  class="mt-0.5 size-4 shrink-0 accent-black"
                />
                <span>
                  បង្ហាញឈ្មោះអាជីវកម្ម
                  <small class="mt-1 block font-medium leading-5 text-black/45">
                    បិទនៅពេលឈ្មោះវែង ឬចង់បង្ហាញ QR ឱ្យស្អាតជាងមុន។
                  </small>
                </span>
              </label>
            </div>
          </div>
        </details>

        <details class="rounded-3xl border border-black/[.07] bg-white p-5">
          <summary class="cursor-pointer font-extrabold">
            ផ្ទៃខាងក្រោយ និងពណ៌
          </summary>
          <div class="mt-4 space-y-4">
            <label
              ><span class="label">ផ្ទៃខាងក្រោយ</span
              ><select v-model="draft.config.backgroundType" class="input">
                <option value="color">ពណ៌តែមួយ</option>
                <option value="image">រូបថតដែលបានបង្ហោះ</option>
              </select></label
            >
            <label
              v-if="draft.config.backgroundType === 'image'"
              class="btn-soft w-full cursor-pointer"
            >
              <ImageUp :size="16" />{{
                uploading
                  ? "កំពុងកែរូបភាព…"
                  : "ជ្រើសរើសផ្ទៃខាងក្រោយសម្រាប់បោះពុម្ព"
              }}
              <input
                class="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="uploading"
                @change="uploadBackground"
              />
            </label>
            <div
              v-if="draft.config.backgroundType === 'image'"
              class="grid grid-cols-2 gap-3"
            >
              <label
                ><span class="label">កាត់រូបផ្តេក</span
                ><input
                  v-model.number="draft.config.backgroundPositionX"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full"
              /></label>
              <label
                ><span class="label">កាត់រូបបញ្ឈរ</span
                ><input
                  v-model.number="draft.config.backgroundPositionY"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full"
              /></label>
              <label class="col-span-2"
                ><span class="label">កម្រិតស្រទាប់គ្រប</span
                ><input
                  v-model.number="draft.config.overlayOpacity"
                  type="range"
                  min="0"
                  max="90"
                  class="w-full"
              /></label>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <ColorField
                v-model="draft.config.backgroundColor"
                label="ផ្ទៃខាងក្រោយ"
              />
              <ColorField
                v-model="draft.config.overlayColor"
                label="ស្រទាប់គ្រប"
              />
              <ColorField v-model="draft.config.textColor" label="អត្ថបទ" />
              <ColorField v-model="draft.config.accentColor" label="ពណ៌រំលេច" />
              <ColorField
                v-model="draft.config.qrDarkColor"
                label="ពណ៌ QR ខាងមុខ"
              />
              <ColorField
                v-model="draft.config.qrLightColor"
                label="ផ្ទៃខាងក្រោយ QR"
              />
            </div>
          </div>
        </details>

        <details class="rounded-3xl border border-black/[.07] bg-white p-5">
          <summary class="cursor-pointer font-extrabold">អក្សរ និងទំហំ</summary>
          <div class="mt-4 space-y-4">
            <label
              ><span class="label">ពុម្ពអក្សរ</span
              ><select v-model="draft.config.fontFamily" class="input">
                <option>Manrope</option>
                <option>DM Sans</option>
                <option>Noto Sans Khmer</option>
                <option>Noto Sans SC</option>
              </select></label
            >
            <label
              ><span class="label">តម្រឹម</span
              ><select v-model="draft.config.alignment" class="input">
                <option value="left">ឆ្វេង</option>
                <option value="center">កណ្តាល</option>
                <option value="right">ស្តាំ</option>
              </select></label
            >
            <RangeField
              v-model="draft.config.headingSize"
              label="ទំហំចំណងជើង"
              :min="16"
              :max="72"
              suffix=" pt"
            />
            <RangeField
              v-model="draft.config.taglineSize"
              label="ទំហំពាក្យស្លោក"
              :min="8"
              :max="36"
              suffix=" pt"
            />
            <RangeField
              v-model="draft.config.ctaSize"
              label="ទំហំអត្ថបទអំពាវនាវ"
              :min="8"
              :max="36"
              suffix=" pt"
            />
            <RangeField
              v-model="draft.config.logoScale"
              label="ទំហំឡូហ្គោ"
              :min="8"
              :max="38"
              suffix="%"
            />
            <RangeField
              v-model="draft.config.qrScale"
              label="ទំហំ QR"
              :min="28"
              :max="62"
              suffix="%"
            />
            <RangeField
              v-model="draft.config.qrPositionY"
              label="ទីតាំង QR បញ្ឈរ"
              :min="42"
              :max="60"
              suffix="%"
            />
            <div
              v-if="draft.presetKey !== 'table-tent'"
              class="grid grid-cols-2 gap-3"
            >
              <label
                ><span class="label">ទទឹង (mm)</span
                ><input
                  v-model.number="draft.config.customWidthMm"
                  class="input"
                  type="number"
                  min="50"
                  max="420"
              /></label>
              <label
                ><span class="label">កម្ពស់ (mm)</span
                ><input
                  v-model.number="draft.config.customHeightMm"
                  class="input"
                  type="number"
                  min="50"
                  max="420"
              /></label>
            </div>
            <p v-else class="m-0 text-xs leading-5 text-black/45">
              កាតបត់រក្សាទំហំ A4 ផ្ដេក
              ដើម្បីឱ្យផ្ទៃទាំងពីរបោះពុម្ពបានត្រឹមត្រូវ។
            </p>
          </div>
        </details>
      </div>

      <aside class="min-w-0 xl:sticky xl:top-0 xl:self-start">
        <QrDesignPreview v-if="!menuRequired" :input="previewInput" />
        <p
          v-if="warning"
          class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"
        >
          <TriangleAlert :size="16" class="mr-2 inline" />{{ warning.message }}
        </p>
        <div class="mt-4 rounded-3xl border border-black/[.07] bg-white p-5">
          <div class="mb-4 grid gap-3 sm:grid-cols-2">
            <label><span class="label">{{ t('menus.branch') }}</span>
              <select v-model="draft.config.branchSlug" class="input" @change="selectFirstTable">
                <option value="">{{ t(draft.targetType === 'table' ? 'menus.allBranches' : 'menus.defaultBranch') }}</option>
                <option v-if="unavailableBranch" :value="draft.config.branchSlug" disabled>
                  {{ t("pages.qrDesigns.unavailableBranch") }}
                </option>
                <option v-for="branch in qrStore.activeBranches" :key="branch.id" :value="branch.slug">{{ branch.name }}</option>
              </select>
            </label>
            <label><span class="label">{{ t('nav.menus') }}</span>
              <select v-model="draft.config.menuSlug" class="input">
                <option value="" :disabled="!qrStore.allowCategoryBrowsing">
                  {{ t(qrStore.allowCategoryBrowsing ? 'menus.catalog' : 'pages.qrDesigns.chooseMenu') }}
                </option>
                <option v-if="unavailableMenu" :value="draft.config.menuSlug" disabled>
                  {{ t("pages.qrDesigns.unavailableMenu") }}
                </option>
                <option v-for="menu in menuRoots" :key="menu.id" :value="menu.slug">{{ menuName(menu, locale) }}</option>
              </select>
            </label>
          </div>
          <div v-if="draft.targetType === 'table'" class="space-y-3">
            <p class="label">ជ្រើសរើសតុសម្រាប់នាំចេញ</p>
            <select v-model="exportScope" class="input">
              <option value="single">មួយតុ</option>
              <option value="group">មួយក្រុមតុ</option>
              <option value="all">តុដែលកំពុងប្រើទាំងអស់</option>
            </select>
            <select
              v-if="exportScope === 'single'"
              v-model="selectedTableId"
              class="input"
            >
              <option
                v-for="table in availableTables"
                :key="table.id"
                :value="table.id"
              >
                {{ branchById.get(table.branchId)?.name }} · {{ table.groupName }} · {{ table.label }} ({{ table.code }})
              </option>
            </select>
            <select
              v-if="exportScope === 'group'"
              v-model="selectedGroupId"
              class="input"
            >
              <option
                v-for="group in availableGroups"
                :key="group.id"
                :value="group.id"
              >
                {{ branchById.get(group.branchId)?.name }} · {{ group.name }}
              </option>
            </select>
            <label class="block">
              <span class="label">{{ t("pages.qrDesigns.tableExport") }}</span>
              <select v-model="tableExport" class="input">
                <option value="separate">{{ t("pages.qrDesigns.separateTableFiles") }}</option>
                <option value="a4-pdf">{{ t("pages.qrDesigns.combinedA4Pdf") }}</option>
              </select>
            </label>
            <p v-if="combinedPdf || format === 'pdf'" class="m-0 text-xs leading-5 text-black/55">
              {{ t(combinedPdf ? "pages.qrDesigns.combinedA4Hint" : "pages.qrDesigns.tableA4Hint") }}
            </p>
          </div>
          <div class="mt-4 grid gap-3" :class="combinedPdf ? 'grid-cols-1' : 'grid-cols-2'">
            <label
              v-if="!combinedPdf"
              ><span class="label">ទម្រង់ឯកសារ</span
              ><select v-model="format" class="input">
                <option value="pdf">PDF សម្រាប់បោះពុម្ព</option>
                <option value="png">PNG កម្រិត 300 DPI</option>
              </select></label
            >
            <label
              ><span class="label">របៀបបោះពុម្ព</span
              ><select
                v-model="printMode"
                class="input"
                :disabled="!combinedPdf && format === 'png'"
              >
                <option value="home">នៅផ្ទះ / ទំហំពិត</option>
                <option value="print-shop">រោងពុម្ព + គែមកាត់</option>
              </select></label
            >
          </div>
          <p v-if="error" class="mb-0 mt-3 text-sm font-bold text-red-600">
            {{ error }}
          </p>
        </div>
      </aside>
    </div>

    <template #footer>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="btn-primary sm:min-w-52"
          :disabled="saving || menuRequired"
          @click="save"
        >
          <Save :size="16" />{{ saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកការរចនា" }}
        </button>
        <button
          type="button"
          class="btn-soft sm:min-w-40"
          :disabled="saving || exporting || Boolean(warning?.blocksExport)"
          @click="download"
        >
          <Download :size="16" />{{ exporting ? exportProgress : "ទាញយក" }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Download, ImageUp, Save, TriangleAlert } from "lucide-vue-next";
import {
  maxQrFooterTextLength,
  maxQrTablePrefixLength,
} from "../../../../shared/qrDesign";
import ModalPanel from "./ModalPanel.vue";
import QrDesignPreview from "./QrDesignPreview.vue";
import ColorField from "./qr/ColorField.vue";
import RangeField from "./qr/RangeField.vue";
import { useAdminStore, type Business } from "../stores/admin";
import { useQrDesignStore } from "../stores/qrDesigns";
import { menuName } from "../types/menu";
import {
  defaultQrConfig,
  presetFor,
  qrPresets,
  type QrDesign,
  type QrPresetKey,
} from "../types/qrDesign";
import {
  createBulkQrZip,
  createQrExport,
  createTableQrPdf,
  downloadBlob,
  exportFileName,
  qrPrintWarning,
  safeFileName,
  type ExportFormat,
  type PrintMode,
  type QrRenderInput,
} from "../utils/qrRenderer";

const props = defineProps<{
  open: boolean;
  design: QrDesign | null;
  business: Business;
  menuUrl: string;
}>();
const emit = defineEmits<{ close: []; notify: [message: string] }>();
const admin = useAdminStore();
const qrStore = useQrDesignStore();
const { t, locale } = useI18n();
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const freshDesign = (): QrDesign => ({
  id: "",
  name: "ការរចនា QR ថ្មី",
  presetKey: "table-card",
  targetType: "menu",
  config: defaultQrConfig(),
  backgroundMediaId: "",
  isDefault: false,
});
const draft = reactive<QrDesign>(freshDesign());
const selectedTableId = ref("");
const selectedGroupId = ref("");
const exportScope = ref<"single" | "group" | "all">("single");
const tableExport = ref<"separate" | "a4-pdf">("separate");
const format = ref<ExportFormat>("pdf");
const printMode = ref<PrintMode>("home");
const saving = ref(false);
const uploading = ref(false);
const exporting = ref(false);
const exportProgress = ref("កំពុងរៀបចំ…");
const error = ref("");
const menuRoots = computed(() => qrStore.menus.filter((menu) => !menu.parentId && menu.isActive));
const branchById = computed(() => new Map(qrStore.branches.map((branch) => [branch.id,branch])));
const matchesBranch = (id: string) => !draft.config.branchSlug || branchById.value.get(id)?.slug === draft.config.branchSlug;
const availableTables = computed(() => qrStore.activeTables.filter((table) => matchesBranch(table.branchId)));
const availableGroups = computed(() => qrStore.activeGroups.filter((group) => matchesBranch(group.branchId)));
const combinedPdf = computed(() => draft.targetType === "table" && tableExport.value === "a4-pdf");
const menuRequired = computed(() => !qrStore.allowCategoryBrowsing && !draft.config.menuSlug);
const unavailableMenu = computed(() =>
  Boolean(draft.config.menuSlug) && !menuRoots.value.some((menu) => menu.slug === draft.config.menuSlug),
);
const unavailableBranch = computed(() =>
  Boolean(draft.config.branchSlug) && !qrStore.activeBranches.some((branch) => branch.slug === draft.config.branchSlug),
);

function selectFirstTable() {
  selectedTableId.value = availableTables.value[0]?.id || "";
  selectedGroupId.value = availableGroups.value[0]?.id || "";
}

watch(
  () => [props.open, props.design] as const,
  () => {
    if (!props.open) return;
    const design = props.design || freshDesign();
    Object.assign(draft, {
      ...design,
      config: { ...defaultQrConfig(), ...design.config },
    });
    selectFirstTable();
    error.value = "";
  },
  { immediate: true },
);

const exportTables = computed(() => {
  if (draft.targetType !== "table") return [];
  const tables = availableTables.value;
  if (exportScope.value === "single")
    return tables.filter((table) => table.id === selectedTableId.value);
  if (exportScope.value === "group")
    return tables.filter((table) => table.groupId === selectedGroupId.value);
  return tables;
});
const previewInput = computed<QrRenderInput>(() => ({
  design: draft,
  business: props.business,
  menuUrl: props.menuUrl,
  branchSlug: branchById.value.get(exportTables.value[0]?.branchId ?? "")?.slug,
  table: exportTables.value[0],
}));
const warning = computed(() => {
  if (menuRequired.value)
    return { message: t("pages.qrDesigns.menuRequired"), blocksExport: true };
  if (unavailableBranch.value || unavailableMenu.value)
    return {
      message: t(unavailableBranch.value ? "pages.qrDesigns.chooseActiveBranch" : "pages.qrDesigns.chooseActiveMenu"),
      blocksExport: true,
    };
  if (draft.targetType === "table" && !exportTables.value.length)
    return {
      message: "គ្មានតុដែលកំពុងប្រើត្រូវនឹងជម្រើសនាំចេញនេះទេ។",
      blocksExport: true,
    };
  return qrPrintWarning(draft);
});

function choosePreset(key: QrPresetKey) {
  draft.presetKey = key;
  const preset = presetFor(key);
  draft.config.customWidthMm = preset.widthMm;
  draft.config.customHeightMm = preset.heightMm;
}

async function uploadBackground(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  error.value = "";
  try {
    const uploaded = await admin.uploadMedia(file, "print");
    draft.backgroundMediaId = uploaded.id;
    draft.config.backgroundImageUrl = `${API.replace(/\/$/, "")}/media/${encodeURIComponent(uploaded.id)}`;
    draft.config.backgroundType = "image";
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? caught.message
        : "មិនអាចបង្ហោះរូបផ្ទៃខាងក្រោយបានទេ";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

async function save() {
  if (saving.value || menuRequired.value) return;
  saving.value = true;
  error.value = "";
  try {
    if (draft.id) await qrStore.updateDesign(JSON.parse(JSON.stringify(draft)));
    else
      draft.id = await qrStore.createDesign(JSON.parse(JSON.stringify(draft)));
    emit("notify", "បានរក្សាទុកការរចនា QR");
  } catch (caught) {
    error.value =
      caught instanceof Error ? caught.message : "មិនអាចរក្សាទុកការរចនាបានទេ";
  } finally {
    saving.value = false;
  }
}

function exportInputs() {
  const base = {
    ...previewInput.value,
    design: { ...draft, config: { ...draft.config } },
  };
  if (draft.targetType === "menu") return [base];
  return exportTables.value.map((table) => ({
    ...base,
    table,
    branchSlug: branchById.value.get(table.branchId)?.slug,
    group: qrStore.groups.find((group) => group.id === table.groupId),
  }));
}

async function download() {
  if (saving.value || exporting.value || warning.value?.blocksExport) return;
  const inputs = exportInputs();
  const combineTables = combinedPdf.value;
  const exportFormat = format.value;
  const mode = printMode.value;
  const onProgress = (done: number, total: number) => {
    exportProgress.value = `${done}/${total}`;
  };
  exporting.value = true;
  error.value = "";
  try {
    if (!inputs[0].design.config.menuSlug) {
      await qrStore.refreshCategoryBrowsing();
      if (!qrStore.allowCategoryBrowsing) return;
    }
    if (combineTables) {
      const pdf = await createTableQrPdf(inputs, mode, onProgress);
      downloadBlob(
        pdf,
        `${safeFileName(inputs[0].business.name)}-${safeFileName(inputs[0].design.name)}-tables-a4.pdf`,
      );
    } else if (inputs.length === 1) {
      const blob = await createQrExport(
        inputs[0],
        exportFormat,
        mode,
      );
      downloadBlob(blob, exportFileName(inputs[0], exportFormat));
    } else {
      const zip = await createBulkQrZip(
        inputs,
        exportFormat,
        mode,
        onProgress,
      );
      downloadBlob(
        zip,
        `${safeFileName(inputs[0].business.name)}-${safeFileName(inputs[0].design.name)}-tables.zip`,
      );
    }
    let readinessSyncFailed = false;
    try {
      await admin.markQrDownloaded();
    } catch {
      readinessSyncFailed = true;
    }
    emit(
      "notify",
      inputs.length === 1
        ? "បានទាញយកការរចនា QR"
        : `បានទាញយកការរចនាសម្រាប់តុចំនួន ${inputs.length}`,
    );
    if (readinessSyncFailed) {
      error.value =
        "បានទាញយកឯកសារ QR ប៉ុន្តែមិនអាចធ្វើសមកាលកម្មវឌ្ឍនភាពរៀបចំបានទេ។ សូមភ្ជាប់អ៊ីនធឺណិត រួចទាញយកម្តងទៀត។";
    }
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? caught.message
        : "មិនអាចបង្កើតឯកសារសម្រាប់ទាញយកបានទេ";
  } finally {
    exporting.value = false;
    exportProgress.value = "កំពុងរៀបចំ…";
  }
}
</script>
