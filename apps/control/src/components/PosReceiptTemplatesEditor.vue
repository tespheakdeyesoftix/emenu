<template>
  <div class="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
    <section class="min-w-0 space-y-4">
      <div class="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label class="min-w-0">
          <span class="label">{{ t("selling.receipts.template") }}</span>
          <Select
            size="lg"
            variant="outline"
            v-model="selectedId"
            :options="templateChoices"
            :disabled="!templates.length"
          />
        </label>
        <Select
          size="lg"
          variant="outline"
          model-value=""
          :aria-label="t('selling.receipts.addTemplate')"
          :options="addChoices"
          @update:model-value="createTemplate"
        />
      </div>

      <fieldset class="min-w-0 space-y-2 rounded-xl border border-black/10 p-3">
        <legend class="px-1 text-sm font-semibold">{{ t("selling.receipts.defaults") }}</legend>
        <label
          v-for="type in posReceiptTypes"
          :key="type"
          class="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span>{{ t("selling.receipts.defaultNames." + type) }}</span>
          <Select
            variant="outline"
            :model-value="defaults[type] ?? ''"
            :options="defaultChoices[type]"
            :disabled="defaultChoices[type].length === 1"
            @update:model-value="defaults[type] = $event ? String($event) : null"
          />
        </label>
      </fieldset>

      <div
        v-for="template in templates"
        v-show="template.id === selectedId"
        :key="template.id"
        :data-receipt-template-id="template.id"
      >
        <PosReceiptTemplateFields :template="template" @remove="removeTemplate(template)" />
      </div>
      <slot name="current-register" />
    </section>

    <section class="min-w-0 rounded-xl border border-black/10 bg-cream p-4 lg:sticky lg:top-0">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-semibold">{{ t("selling.receipts.preview") }}</h3>
        <span v-if="activeTemplate" class="text-xs text-black/60">{{ dimensions }}</span>
      </div>
      <PosReceiptPreview v-if="activeTemplate" :template="activeTemplate" />
      <p v-else class="py-8 text-center text-sm text-black/60">{{ t("selling.receipts.empty") }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Select } from "frappe-ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  posReceiptFields,
  posReceiptTypes,
  type PosReceiptDefaults,
  type PosReceiptTemplate,
} from "../../../../shared/posReceipts";
import PosReceiptPreview from "./PosReceiptPreview.vue";
import PosReceiptTemplateFields from "./PosReceiptTemplateFields.vue";

const templates = defineModel<PosReceiptTemplate[]>({ required: true });
const defaults = defineModel<PosReceiptDefaults>("defaults", { required: true });
const { locale, t } = useI18n();
const selectedId = ref(defaults.value.receipt ?? templates.value[0]?.id ?? "");
const activeTemplate = computed(() => templates.value.find(({ id }) => id === selectedId.value));
const templateLabel = (template: PosReceiptTemplate) =>
  template.name || t("selling.receipts.types." + template.type);
const templateChoices = computed(() =>
  templates.value.length
    ? templates.value.map((template) => ({
        value: template.id,
        label: templateLabel(template) + " · " + t("selling.receipts.types." + template.type),
      }))
    : [{ label: t("selling.receipts.noTemplates"), value: "" }],
);
const addChoices = computed(() => [
  { label: t("selling.receipts.addTemplate"), value: "", disabled: true },
  ...posReceiptTypes.map((type) => ({
    label: t("selling.receipts.types." + type),
    value: type,
  })),
]);
const defaultChoices = computed(() => Object.fromEntries(posReceiptTypes.map((type) => [
  type,
  [
    { label: t("selling.receipts.noDefault"), value: "" },
    ...templates.value
      .filter((template) => template.type === type)
      .map((template) => ({ label: templateLabel(template), value: template.id })),
  ],
])) as Record<PosReceiptTemplate["type"], { label: string; value: string }[]>);
const dimensions = computed(() => {
  const template = activeTemplate.value;
  if (!template) return "";
  return template.type === "qr_label"
    ? template.paper_width_mm + " × " + template.qr.label_height_mm + " mm"
    : template.paper_width_mm + " mm";
});

function createTemplate(value: unknown) {
  const type = posReceiptTypes.find((type) => type === value);
  if (!type) return;
  const label = t("selling.receipts.types." + type);
  let number = 1;
  while (templates.value.some(({ name }) => name === label + " " + number)) number++;
  const base = {
    id: "receipt_" + crypto.randomUUID().replaceAll("-", ""),
    name: label + " " + number,
    language: locale.value === "km" ? "km" as const : "en" as const,
    paper_width_mm: type === "qr_label" ? 58 : 80,
    print_copies: 1,
    title: "",
    footer: "",
    text_size: "normal" as const,
    heading_alignment: "center" as const,
    fields: posReceiptFields[type].filter((field) =>
      !["signature", "highlight_notes", "show_link", "item_codes"].includes(field),
    ),
  };
  const template: PosReceiptTemplate = type === "qr_label"
    ? { ...base, type, qr: { label_height_mm: 50, size_mm: 28, target: "table_menu", custom_url: "", caption: "" } }
    : { ...base, type };
  templates.value = [...templates.value, template];
  selectedId.value = template.id;
}

function removeTemplate(template: PosReceiptTemplate) {
  templates.value = templates.value.filter(({ id }) => id !== template.id);
  if (defaults.value[template.type] === template.id) defaults.value[template.type] = null;
  selectedId.value = templates.value[0]?.id ?? "";
}

function selectTemplate(id: string) {
  selectedId.value = id;
}

defineExpose({ selectTemplate });
</script>
