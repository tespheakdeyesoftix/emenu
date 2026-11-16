<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <button type="button" class="btn-soft shrink-0" @click="openNewGroup">
        <Plus :size="15" />បន្ថែមក្រុមជម្រើស
      </button>
    </div>

    <div
      v-for="(group, groupIndex) in model"
      :key="group.id"
      class="flex items-center gap-2 rounded-2xl border border-black/[.08] bg-white p-3"
    >
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="openEditGroup(groupIndex)"
      >
        <strong class="block truncate text-sm">{{ group.labelKm }}</strong>
        <span class="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
          <span class="rounded-full bg-cream px-2 py-1">
            {{ group.options.length }} ជម្រើស
          </span>
          <span v-if="group.required" class="rounded-full bg-cream px-2 py-1">
            តម្រូវឱ្យជ្រើស
          </span>
          <span v-if="group.multiple" class="rounded-full bg-cream px-2 py-1">
            ជ្រើសបានច្រើន
          </span>
        </span>
      </button>
      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full hover:bg-cream"
        aria-label="កែសម្រួលក្រុមជម្រើស"
        @click="openEditGroup(groupIndex)"
      >
        <Pencil :size="15" />
      </button>
      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50"
        aria-label="លុបក្រុមជម្រើស"
        @click="model.splice(groupIndex, 1)"
      >
        <Trash2 :size="15" />
      </button>
    </div>

    <div
      v-if="!model.length"
      class="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-xs text-black/35"
    >
      មិនទាន់មានក្រុមជម្រើសទេ។
    </div>

    <ModalPanel
      :open="dialogOpen"
      :close-on-backdrop="false"
      :title="editingIndex >= 0 ? 'កែសម្រួលក្រុមជម្រើស' : 'បន្ថែមក្រុមជម្រើស'"
      @close="closeDialog"
    >
      <form
        id="modifier-group-form"
        class="space-y-4"
        @submit.prevent="saveGroup"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <label>
            <span class="label">ឈ្មោះក្រុម · ខ្មែរ</span>
            <input
              v-model.trim="draft.labelKm"
              class="input"
              lang="km"
              placeholder="ឧ. កម្រិតហឹរ"
            />
          </label>
          <label v-if="enableEn">
            <span class="label">ឈ្មោះក្រុម · អង់គ្លេស (មិនចាំបាច់)</span>
            <input
              v-model.trim="draft.labelEn"
              class="input"
              placeholder="ឧ. កម្រិតហឹរ"
            />
          </label>
          <label v-if="enableZh">
            <span class="label">ឈ្មោះក្រុម · ចិន (មិនចាំបាច់)</span>
            <input
              v-model.trim="draft.labelZh"
              class="input"
              lang="zh"
              placeholder="例如：辣度"
            />
          </label>
        </div>

        <div class="flex flex-wrap gap-3">
          <label
            class="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-bold"
          >
            <input
              v-model="draft.required"
              type="checkbox"
              class="size-4 accent-black"
            />
            តម្រូវឱ្យជ្រើស
          </label>
          <label
            class="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-bold"
          >
            <input
              v-model="draft.multiple"
              type="checkbox"
              class="size-4 accent-black"
            />
            អនុញ្ញាតឱ្យជ្រើសច្រើន
          </label>
        </div>

        <div class="space-y-3 border-t border-black/[.08] pt-4">
          <div class="flex items-center justify-between">
            <span class="label !mb-0">ជម្រើស</span>
            <button type="button" class="btn-soft" @click="addOption">
              <Plus :size="14" />បន្ថែមជម្រើស
            </button>
          </div>
          <div
            v-for="(option, optionIndex) in draft.options"
            :key="option.id"
            class="rounded-2xl bg-cream p-3"
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <label>
                <span class="label">ឈ្មោះជម្រើស · ខ្មែរ</span>
                <input v-model.trim="option.labelKm" class="input" lang="km" />
              </label>
              <label v-if="enableEn">
                <span class="label">ឈ្មោះជម្រើស · អង់គ្លេស (មិនចាំបាច់)</span>
                <input v-model.trim="option.labelEn" class="input" />
              </label>
              <label v-if="enableZh">
                <span class="label">ឈ្មោះជម្រើស · ចិន (មិនចាំបាច់)</span>
                <input v-model.trim="option.labelZh" class="input" lang="zh" />
              </label>
              <label>
                <span class="label">ការកែតម្លៃ (មិនចាំបាច់)</span>
                <input
                  v-model.number="option.priceCents"
                  type="number"
                  :step="currency === 'USD' ? '0.01' : '1'"
                  class="input"
                  placeholder="0"
                />
              </label>
            </div>
            <button
              type="button"
              class="mt-2 flex items-center gap-1 text-xs font-bold text-red-600"
              @click="draft.options.splice(optionIndex, 1)"
            >
              <Trash2 :size="13" />លុបជម្រើស
            </button>
          </div>
          <p
            v-if="!draft.options.length"
            class="m-0 rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-black/35"
          >
            សូមបន្ថែមយ៉ាងតិចមួយជម្រើសក្នុងក្រុមនេះ។
          </p>
        </div>

        <p v-if="formError" class="m-0 text-xs font-bold text-red-600">
          {{ formError }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="modifier-group-form"
          class="btn-primary w-full"
        >
          {{ editingIndex >= 0 ? "រក្សាទុកក្រុម" : "បន្ថែមក្រុម" }}
        </button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
import type {
  ProductModifierGroup,
  ProductModifierOption,
} from "../stores/admin";

const model = defineModel<ProductModifierGroup[]>({ required: true });
defineProps<{
  enableEn: boolean | number;
  enableZh: boolean | number;
  currency: string;
}>();

const dialogOpen = ref(false);
const editingIndex = ref(-1);
const formError = ref("");
const draft = reactive<ProductModifierGroup>(emptyGroup());

function emptyGroup(): ProductModifierGroup {
  return {
    id: `group_${crypto.randomUUID().replaceAll("-", "")}`,
    labelKm: "",
    labelEn: "",
    labelZh: "",
    required: false,
    multiple: false,
    options: [],
  };
}

function cloneGroup(group: ProductModifierGroup): ProductModifierGroup {
  return {
    ...group,
    options: group.options.map((option) => ({ ...option })),
  };
}

function openNewGroup() {
  editingIndex.value = -1;
  Object.assign(draft, emptyGroup());
  formError.value = "";
  dialogOpen.value = true;
}

function openEditGroup(index: number) {
  editingIndex.value = index;
  Object.assign(draft, cloneGroup(model.value[index]));
  formError.value = "";
  dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
  formError.value = "";
}

function addOption() {
  const option: ProductModifierOption = {
    id: `option_${crypto.randomUUID().replaceAll("-", "")}`,
    labelKm: "",
    labelEn: "",
    labelZh: "",
    priceCents: null,
  };
  draft.options.push(option);
}

function saveGroup() {
  const invalidOption = draft.options.some(
    (option) =>
      !option.labelKm.trim() ||
      (option.priceCents != null && !Number.isFinite(Number(option.priceCents))),
  );
  if (!draft.labelKm.trim()) {
    formError.value = "សូមបញ្ចូលឈ្មោះក្រុមជម្រើសជាភាសាខ្មែរ។";
    return;
  }
  if (!draft.options.length || invalidOption) {
    formError.value =
      "សូមបន្ថែមយ៉ាងតិចមួយជម្រើសដែលមានឈ្មោះជាភាសាខ្មែរ និងតម្លៃត្រឹមត្រូវ។";
    return;
  }

  const saved = cloneGroup(draft);
  if (editingIndex.value >= 0) model.value[editingIndex.value] = saved;
  else model.value.push(saved);
  closeDialog();
}
</script>
