<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button type="button" class="btn-soft shrink-0" @click="openNewPortion">
        <Plus :size="15" />បន្ថែមតម្លៃតាមទំហំ
      </button>
    </div>

    <div
      v-for="(portion, index) in model"
      :key="portion.id"
      class="flex items-center gap-2 rounded-2xl border border-black/[.08] bg-white p-3"
    >
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="openEditPortion(index)"
      >
        <strong class="block truncate text-sm">{{ portion.labelKm }}</strong>
        <span class="mt-1 block text-xs font-bold text-black/40">
          {{ money(portion.priceCents) }} · {{ branchName(portion.branchId) }}
        </span>
      </button>
      <button
        type="button"
        class="btn-soft shrink-0 !px-3 !py-2"
        aria-label="កែសម្រួលទំហំ"
        @click="openEditPortion(index)"
      >
        <Pencil :size="14" />កែសម្រួល
      </button>
      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50"
        aria-label="លុបទំហំ"
        @click="model.splice(index, 1)"
      >
        <Trash2 :size="15" />
      </button>
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
            <input
              v-model.trim="draft.labelKm"
              class="input"
              lang="km"
              placeholder="ឧ. ចានតូច"
            />
          </label>
          <label v-if="enableEn">
            <span class="label">ឈ្មោះ · អង់គ្លេស (មិនចាំបាច់)</span>
            <input
              v-model.trim="draft.labelEn"
              class="input"
              placeholder="ឧ. ចានតូច"
            />
          </label>
          <label v-if="enableZh">
            <span class="label">ឈ្មោះ · ចិន (មិនចាំបាច់)</span>
            <input
              v-model.trim="draft.labelZh"
              class="input"
              lang="zh"
              placeholder="例如：小份"
            />
          </label>
          <label>
            <span class="label">តម្លៃ</span>
            <input
              v-model.number="draft.priceCents"
              type="number"
              min="0"
              :step="currency === 'USD' ? '0.01' : '1'"
              class="input"
            />
          </label>
          <label>
            <span class="label">{{ t("menus.branch") }}</span>
            <select v-model="draft.branchId" class="input" :disabled="loadingBranches">
              <option :value="null">{{ t("menus.allBranches") }}</option>
              <option v-for="branch in branchOptions" :key="branch.id" :value="branch.id">
                {{ branch.name }}
              </option>
              <option v-if="draft.branchId && !branchOptions.some((branch) => branch.id === draft.branchId)" :value="draft.branchId">
                {{ draft.branchId }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="branchLoadFailed" class="flex flex-wrap items-center gap-2 text-sm" role="alert">
          <span>{{ t("portions.branchLoadFailed") }}</span>
          <button type="button" class="btn-soft" @click="loadBranches">{{ t("common.tryAgain") }}</button>
        </div>
        <p v-if="formError" class="m-0 text-xs font-bold text-red-600">
          {{ formError }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="portion-editor-form"
          class="btn-primary w-full"
        >
          {{ editingIndex >= 0 ? "រក្សាទុកទំហំ" : "បន្ថែមទំហំ" }}
        </button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
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
