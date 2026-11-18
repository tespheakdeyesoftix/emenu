<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button variant="subtle" size="lg" type="button" class="shrink-0" @click="openNewGroup">
        <template #prefix><Plus :size="15" /></template>បន្ថែមក្រុមជម្រើស
      </Button>
    </div>

    <div
      v-for="(group, groupIndex) in model"
      :key="group.id"
      class="flex items-center gap-2 rounded-2xl border border-black/[.08] bg-white p-3"
    >
      <Button
        variant="ghost" size="lg"
        type="button"
        class="admin-action-card !shrink min-w-0 flex-1 !p-1 text-start"
        @click="openEditGroup(groupIndex)"
      >
        <strong class="block truncate text-sm">{{ group.labelKm }}</strong>
        <span class="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
          <Badge>{{ group.options.length }} ជម្រើស</Badge>
          <Badge v-if="group.required">តម្រូវឱ្យជ្រើស</Badge>
          <Badge v-if="group.multiple">ជ្រើសបានច្រើន</Badge>
        </span>
      </Button>
      <Button variant="ghost"
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full hover:bg-cream"
        aria-label="កែសម្រួលក្រុមជម្រើស"
        @click="openEditGroup(groupIndex)"
      >
        <template #icon><Pencil :size="15" /></template>
      </Button>
      <Button variant="ghost"
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50"
        aria-label="លុបក្រុមជម្រើស"
        @click="model.splice(groupIndex, 1)"
      >
        <template #icon><Trash2 :size="15" /></template>
      </Button>
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
            <TextInput size="lg" variant="outline"
              v-model.trim="draft.labelKm"
              lang="km"
              placeholder="ឧ. កម្រិតហឹរ"
            />
          </label>
          <label v-if="enableEn">
            <span class="label">ឈ្មោះក្រុម · អង់គ្លេស (មិនចាំបាច់)</span>
            <TextInput size="lg" variant="outline"
              v-model.trim="draft.labelEn"
              placeholder="ឧ. កម្រិតហឹរ"
            />
          </label>
          <label v-if="enableZh">
            <span class="label">ឈ្មោះក្រុម · ចិន (មិនចាំបាច់)</span>
            <TextInput size="lg" variant="outline"
              v-model.trim="draft.labelZh"
              lang="zh"
              placeholder="例如：辣度"
            />
          </label>
        </div>

        <div class="flex flex-wrap gap-3">
          <label
            class="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-bold"
          >
            <Checkbox
              v-model="draft.required"
              type="checkbox"
              class="size-4 accent-black"
            />
            តម្រូវឱ្យជ្រើស
          </label>
          <label
            class="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-bold"
          >
            <Checkbox
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
            <Button variant="subtle" size="lg" type="button" @click="addOption">
              <template #prefix><Plus :size="14" /></template>បន្ថែមជម្រើស
            </Button>
          </div>
          <div
            v-for="(option, optionIndex) in draft.options"
            :key="option.id"
            class="rounded-2xl bg-cream p-3"
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <label>
                <span class="label">ឈ្មោះជម្រើស · ខ្មែរ</span>
                <TextInput size="lg" variant="outline" v-model.trim="option.labelKm" lang="km" />
              </label>
              <label v-if="enableEn">
                <span class="label">ឈ្មោះជម្រើស · អង់គ្លេស (មិនចាំបាច់)</span>
                <TextInput size="lg" variant="outline" v-model.trim="option.labelEn" />
              </label>
              <label v-if="enableZh">
                <span class="label">ឈ្មោះជម្រើស · ចិន (មិនចាំបាច់)</span>
                <TextInput size="lg" variant="outline" v-model.trim="option.labelZh" lang="zh" />
              </label>
              <label>
                <span class="label">ការកែតម្លៃ (មិនចាំបាច់)</span>
                <TextInput size="lg" variant="outline"
                  :model-value="option.priceCents ?? ''"
                  @update:model-value="option.priceCents = $event === '' ? null : Number($event)"
                  type="number"
                  :step="currency === 'USD' ? '0.01' : '1'"
                  placeholder="0"
                />
              </label>
            </div>
            <Button
              variant="ghost" theme="red" size="sm"
              type="button"
              class="mt-2"
              @click="draft.options.splice(optionIndex, 1)"
            >
              <template #prefix><Trash2 :size="13" aria-hidden="true" /></template>លុបជម្រើស
            </Button>
          </div>
          <p
            v-if="!draft.options.length"
            class="m-0 rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-black/35"
          >
            សូមបន្ថែមយ៉ាងតិចមួយជម្រើសក្នុងក្រុមនេះ។
          </p>
        </div>

        <Alert v-if="formError" theme="red" :title="formError" />
      </form>

      <template #footer>
        <Button variant="solid" size="lg"
          type="submit"
          form="modifier-group-form"
          class="w-full"
        >
          {{ editingIndex >= 0 ? "រក្សាទុកក្រុម" : "បន្ថែមក្រុម" }}
        </Button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { Badge, Alert, Button, Checkbox, TextInput } from "frappe-ui";
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
