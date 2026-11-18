<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button variant="subtle" size="lg" type="button" class="shrink-0" @click="openNewPortion">
        <template #prefix><Plus :size="15" /></template>បន្ថែមតម្លៃតាមទំហំ
      </Button>
    </div>

    <div
      v-for="(portion, index) in model"
      :key="portion.id"
      class="flex items-center gap-2 rounded-2xl border border-black/[.08] bg-white p-3"
    >
      <Button
        variant="ghost" size="lg"
        type="button"
        class="admin-action-card !shrink min-w-0 flex-1 !p-1 text-start"
        @click="openEditPortion(index)"
      >
        <strong class="block truncate text-sm">{{ portion.labelKm }}</strong>
        <span class="mt-1 block text-xs font-bold text-black/40">
          {{ money(portion.priceCents) }} · {{ branchName(portion.branchId) }}
        </span>
      </Button>
      <Button variant="subtle" size="lg"
        type="button"
        class="shrink-0 !px-3 !py-2"
        aria-label="កែសម្រួលទំហំ"
        @click="openEditPortion(index)"
      >
        <template #prefix><Pencil :size="14" /></template>កែសម្រួល
      </Button>
      <Button variant="ghost"
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50"
        aria-label="លុបទំហំ"
        @click="model.splice(index, 1)"
      >
        <template #icon><Trash2 :size="15" /></template>
      </Button>
    </div>

    <div
      v-if="!model.length"
      class="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-xs text-black/35"
    >
      មិនទាន់មានទំហំបន្ថែមទេ។ មុខម្ហូបនេះនឹងប្រើតម្លៃធម្មតា។
    </div>

    <ModalPanel
      :open="dialogOpen"
      :close-on-backdrop="false"
      :title="editingIndex >= 0 ? 'កែសម្រួលទំហំ' : 'បន្ថែមទំហំ'"
      @close="closeDialog"
    >
      <form
        id="portion-editor-form"
        class="space-y-4"
        @submit.prevent="savePortion"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <label>
            <span class="label">ឈ្មោះ · ខ្មែរ</span>
            <TextInput size="lg" variant="outline"
              v-model.trim="draft.labelKm"
              lang="km"
              placeholder="ឧ. ចានតូច"
            />
          </label>
          <label v-if="enableEn">
            <span class="label">ឈ្មោះ · អង់គ្លេស (មិនចាំបាច់)</span>
            <TextInput size="lg" variant="outline"
              v-model.trim="draft.labelEn"
              placeholder="ឧ. ចានតូច"
            />
          </label>
          <label v-if="enableZh">
            <span class="label">ឈ្មោះ · ចិន (មិនចាំបាច់)</span>
            <TextInput size="lg" variant="outline"
              v-model.trim="draft.labelZh"
              lang="zh"
              placeholder="例如：小份"
            />
          </label>
          <label>
            <span class="label">តម្លៃ</span>
            <TextInput size="lg" variant="outline"
              v-model.number="draft.priceCents"
              type="number"
              min="0"
              :step="currency === 'USD' ? '0.01' : '1'"
            />
          </label>
          <label>
            <span class="label">{{ t("menus.branch") }}</span>
            <Select
              size="lg"
              variant="outline"
              :model-value="draft.branchId ?? ''"
              @update:model-value="draft.branchId = $event ? String($event) : null"
              :disabled="loadingBranches"
              :options="[
                { label: t('menus.allBranches'), value: '' },
                ...branchOptions.map(branch => ({ label: branch.name, value: branch.id })),
                ...(draft.branchId && !branchOptions.some((branch) => branch.id === draft.branchId) ? [{ label: draft.branchId, value: draft.branchId }] : []),
              ]"
            />
          </label>
        </div>

        <Alert v-if="branchLoadFailed" theme="red" :title="t('portions.branchLoadFailed')" class="m-4">
          <template #actions>
            <Button variant="subtle" size="lg" type="button" @click="loadBranches">{{ t("common.tryAgain") }}</Button>
          </template>
        </Alert>
        <Alert v-if="formError" theme="red" :title="formError" />
      </form>

      <template #footer>
        <Button variant="solid" size="lg"
          type="submit"
          form="portion-editor-form"
          class="w-full"
        >
          {{ editingIndex >= 0 ? "រក្សាទុកទំហំ" : "បន្ថែមទំហំ" }}
        </Button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { Alert, Button, Select, TextInput } from "frappe-ui";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
import { useAdminStore, type ProductPortion } from "../stores/admin";
import type { BranchOption } from "../types/menu";
import { formatCurrency } from "../utils/currency";

const model = defineModel<ProductPortion[]>({ required: true });
const props = defineProps<{
  enableEn: boolean | number;
  enableZh: boolean | number;
  currency: string;
}>();
const { t } = useI18n();
const admin = useAdminStore();
const branches = ref<BranchOption[]>([]);
const loadingBranches = ref(false);
const branchLoadFailed = ref(false);

const dialogOpen = ref(false);
const editingIndex = ref(-1);
const formError = ref("");
const draft = reactive<ProductPortion>(emptyPortion());
const branchOptions = computed(() => branches.value.filter((branch) => branch.isActive || branch.id === draft.branchId));

function branchName(branchId: string | null | undefined) {
  if (!branchId) return t("menus.allBranches");
  return branches.value.find((branch) => branch.id === branchId)?.name ?? branchId;
}

async function loadBranches() {
  loadingBranches.value = true;
  branchLoadFailed.value = false;
  try {
    const result = await admin.request("/api/admin/branches");
    branches.value = result.branches;
  } catch {
    branchLoadFailed.value = true;
  } finally {
    loadingBranches.value = false;
  }
}
onMounted(loadBranches);

function emptyPortion(): ProductPortion {
  return {
    id: `portion_${crypto.randomUUID().replaceAll("-", "")}`,
    labelKm: "",
    labelEn: "",
    labelZh: "",
    priceCents: 0,
    branchId: null,
    priceRule: "",
    unit: "",
  };
}

function openNewPortion() {
  editingIndex.value = -1;
  Object.assign(draft, emptyPortion());
  formError.value = "";
  dialogOpen.value = true;
}

function openEditPortion(index: number) {
  editingIndex.value = index;
  Object.assign(draft, emptyPortion(), { ...model.value[index] });
  formError.value = "";
  dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
  formError.value = "";
}

function savePortion() {
  if (!draft.labelKm.trim()) {
    formError.value = "សូមបញ្ចូលឈ្មោះទំហំជាភាសាខ្មែរ។";
    return;
  }
  if (
    !Number.isFinite(Number(draft.priceCents)) ||
    Number(draft.priceCents) < 0
  ) {
    formError.value = "សូមបញ្ចូលតម្លៃទំហំឱ្យបានត្រឹមត្រូវ។";
    return;
  }

  const saved = { ...draft, priceCents: Number(draft.priceCents) };
  if (editingIndex.value >= 0) model.value[editingIndex.value] = saved;
  else model.value.push(saved);
  closeDialog();
}

const money = (amount: number) => formatCurrency(amount, props.currency);
</script>
