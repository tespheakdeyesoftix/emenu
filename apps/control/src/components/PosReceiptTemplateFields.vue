<template>
  <fieldset class="min-w-0 space-y-3 rounded-xl border border-black/10 p-3">
    <legend class="px-1 text-sm font-semibold">{{ t("selling.receipts.types." + template.type) }}</legend>
    <div class="flex flex-wrap items-end gap-2">
      <label class="min-w-0 flex-1">
        <span class="label">{{ t("selling.receipts.templateName") }}</span>
        <TextInput v-model.trim="template.name" required maxlength="120" variant="outline" size="lg" />
      </label>
      <Button type="button" variant="ghost" @click="$emit('remove')">
        {{ t("selling.receipts.removeTemplate") }}
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <label>
        <span class="label">{{ t("selling.receipts.language") }}</span>
        <Select v-model="template.language" variant="outline" :options="choices('languages', posReceiptLanguages)" />
      </label>
      <label>
        <span class="label">{{ t("selling.receipts.paperWidth") }}</span>
        <TextInput v-model.number="template.paper_width_mm" type="number" variant="outline"
          :min="limits.width.min" :max="limits.width.max" required />
      </label>
      <label>
        <span class="label">{{ t("selling.printCopies") }}</span>
        <TextInput v-model.number="template.print_copies" type="number" variant="outline"
          :min="limits.copies.min" :max="limits.copies.max" required />
      </label>
      <label>
        <span class="label">{{ t("selling.receipts.textSize") }}</span>
        <Select v-model="template.text_size" variant="outline" :options="choices('sizes', posReceiptTextSizes)" />
      </label>
      <label>
        <span class="label">{{ t("selling.receipts.headingAlignment") }}</span>
        <Select v-model="template.heading_alignment" variant="outline" :options="choices('alignments', posReceiptAlignments)" />
      </label>
      <label>
        <span class="label">{{ t("selling.receiptTitle") }}</span>
        <TextInput v-model.trim="template.title" maxlength="120" variant="outline" />
      </label>
      <label class="sm:col-span-2">
        <span class="label">{{ t("selling.receiptFooter") }}</span>
        <Textarea v-model.trim="template.footer" :rows="2" maxlength="500" variant="outline" />
      </label>
    </div>

    <fieldset v-if="template.type === 'qr_label'" class="min-w-0 space-y-3 rounded-lg border border-black/10 p-3">
      <legend class="px-1 text-sm font-semibold">{{ t("selling.receipts.qrSettings") }}</legend>
      <div class="grid gap-3 sm:grid-cols-2">
        <label>
          <span class="label">{{ t("selling.receipts.labelHeight") }}</span>
          <TextInput v-model.number="template.qr.label_height_mm" type="number" variant="outline"
            :min="limits.labelHeight.min" :max="limits.labelHeight.max" required />
        </label>
        <label>
          <span class="label">{{ t("selling.receipts.qrSize") }}</span>
          <TextInput v-model.number="template.qr.size_mm" type="number" variant="outline"
            :min="limits.qrSize.min"
            :max="Math.min(limits.qrSize.max, template.paper_width_mm, template.qr.label_height_mm)"
            required />
        </label>
        <label class="sm:col-span-2">
          <span class="label">{{ t("selling.receipts.qrTarget") }}</span>
          <Select v-model="template.qr.target" variant="outline" :options="choices('targets', posQrTargets)" />
        </label>
        <label v-if="template.qr.target === 'custom_url'" class="sm:col-span-2">
          <span class="label">{{ t("selling.receipts.customUrl") }}</span>
          <TextInput
            v-model.trim="template.qr.custom_url"
            type="url"
            pattern="https?://.+"
            maxlength="1000"
            placeholder="https://"
            variant="outline"
            required
          />
        </label>
        <label class="sm:col-span-2">
          <span class="label">{{ t("selling.receipts.qrCaption") }}</span>
          <TextInput v-model.trim="template.qr.caption" maxlength="120" variant="outline" />
        </label>
      </div>
    </fieldset>

    <fieldset class="min-w-0 space-y-2 rounded-lg border border-black/10 p-3">
      <legend class="px-1 text-sm font-semibold">{{ t("selling.receipts.fieldsTitle") }}</legend>
      <div class="grid gap-2 sm:grid-cols-2">
        <Checkbox
          v-for="field in posReceiptFields[template.type]"
          :key="field"
          :label="t('selling.receipts.fields.' + field)"
          :model-value="template.fields.includes(field)"
          @update:model-value="setField(field, $event === true)"
        />
      </div>
    </fieldset>
  </fieldset>
</template>

<script setup lang="ts">
import { Button, Checkbox, Select, TextInput, Textarea } from "frappe-ui";
import { useI18n } from "vue-i18n";
import {
  posQrTargets, posReceiptAlignments, posReceiptFields, posReceiptLanguages,
  posReceiptLimits as limits, posReceiptTextSizes,
  type PosReceiptField, type PosReceiptTemplate,
} from "../../../../shared/posReceipts";

const props = defineProps<{ template: PosReceiptTemplate }>();
defineEmits<{ remove: [] }>();
const { t } = useI18n();

function choices(group: "languages" | "sizes" | "alignments" | "targets", values: readonly string[]) {
  return values.map((value) => ({ value, label: t("selling.receipts." + group + "." + value) }));
}

function setField(field: PosReceiptField, enabled: boolean) {
  const chosen = new Set(props.template.fields);
  if (enabled) chosen.add(field);
  else chosen.delete(field);
  props.template.fields = [...chosen];
}
</script>
