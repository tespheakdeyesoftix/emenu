<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-semibold">{{ t("selling.taxRules.title") }}</h3>
      <Button type="button" variant="subtle" @click="addRule">
        <template #prefix><Plus :size="16" aria-hidden="true" /></template>
        {{ t("selling.taxRules.add") }}
      </Button>
    </div>

    <p v-if="!rules.length" class="text-sm text-black/60">
      {{ t("selling.taxRules.empty") }}
    </p>
    <label class="block sm:max-w-md">
      <span class="label">{{ t("selling.taxRules.defaultRule") }}</span>
      <Select
        size="lg"
        variant="outline"
        :model-value="defaultRuleId ?? ''"
        :options="defaultRuleOptions"
        :disabled="defaultRuleOptions.length === 1"
        @update:model-value="defaultRuleId = $event ? String($event) : null"
      />
    </label>
    <fieldset
      v-for="(rule, index) in rules"
      :key="rule.id"
      class="min-w-0 space-y-3 rounded-xl border border-black/10 p-3"
    >
      <legend class="px-1 text-sm font-semibold">
        {{ t("selling.taxRules.rule", { number: index + 1 }) }}
      </legend>
      <div class="flex flex-wrap items-end gap-3">
        <label class="min-w-0 flex-1">
          <span class="label">{{ t("selling.taxRules.name") }}</span>
          <TextInput v-model.trim="rule.tax_name" required maxlength="120" />
        </label>
        <label>
          <span class="label">{{ t("selling.taxMode") }}</span>
          <Select v-model="rule.tax_mode" :options="modeOptions" />
        </label>
        <Button type="button" variant="ghost" @click="removeRule(rule.id)">
          {{ t("selling.taxRules.remove") }}
        </Button>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <fieldset
          v-for="(level, index) in levels"
          :key="level.name"
          class="min-w-0 space-y-2 rounded-lg border border-black/10 p-3"
        >
          <legend class="px-1 text-sm font-semibold">
            {{ t("selling.taxRules.level", { number: index + 1 }) }}
          </legend>
          <label class="block">
            <span class="label">{{ t("selling.taxRules.levelName") }}</span>
            <TextInput v-model.trim="rule[level.name]" maxlength="120" />
          </label>
          <label class="block">
            <span class="label">{{ t("selling.taxRate") }}</span>
            <TextInput
              v-model.number="rule[level.rate]"
              type="number"
              min="0"
              max="100"
              step="any"
              required
            />
          </label>
          <Checkbox
            v-model="rule[level.afterDiscount]"
            :label="t('selling.taxRules.afterDiscount')"
          />
          <Checkbox
            v-for="{ field, number } in level.includes"
            :key="field"
            v-model="rule[field]"
            :label="t('selling.taxRules.includeTax', { number })"
          />
        </fieldset>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { Button, Checkbox, Select, TextInput } from "frappe-ui";
import { Plus } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { posTaxModes, type PosTaxRule } from "../../../../shared/posProfile";

const rules = defineModel<PosTaxRule[]>({ required: true });
const defaultRuleId = defineModel<string | null>("defaultRuleId", { required: true });
const { t } = useI18n();
const modeOptions = computed(() =>
  posTaxModes.map((mode) => ({
    label: t("selling.modes." + mode),
    value: mode,
  })),
);
const defaultRuleOptions = computed(() => [
  { label: t("selling.taxRules.noDefaultRule"), value: "" },
  ...rules.value.filter(({ tax_name }) => tax_name).map(({ id, tax_name }) => ({
    label: tax_name,
    value: id,
  })),
]);
const levels = [
  {
    name: "tax_1_name",
    rate: "tax_1_rate",
    afterDiscount: "calculate_tax_1_after_discount",
    includes: [],
  },
  {
    name: "tax_2_name",
    rate: "tax_2_rate",
    afterDiscount: "calculate_tax_2_after_discount",
    includes: [{ field: "calculate_tax_2_after_adding_tax_1", number: 1 }],
  },
  {
    name: "tax_3_name",
    rate: "tax_3_rate",
    afterDiscount: "calculate_tax_3_after_discount",
    includes: [
      { field: "calculate_tax_3_after_adding_tax_1", number: 1 },
      { field: "calculate_tax_3_after_adding_tax_2", number: 2 },
    ],
  },
] as const;

function addRule() {
  rules.value = [
    ...rules.value,
    {
      id: "tax_" + crypto.randomUUID().replaceAll("-", ""),
      tax_name: "",
      tax_mode: "disabled",
      tax_1_name: "",
      tax_1_rate: 0,
      calculate_tax_1_after_discount: true,
      tax_2_name: "",
      tax_2_rate: 0,
      calculate_tax_2_after_adding_tax_1: false,
      calculate_tax_2_after_discount: true,
      tax_3_name: "",
      tax_3_rate: 0,
      calculate_tax_3_after_adding_tax_1: false,
      calculate_tax_3_after_adding_tax_2: false,
      calculate_tax_3_after_discount: true,
    },
  ];
}

function removeRule(id: string) {
  rules.value = rules.value.filter((rule) => rule.id !== id);
  if (defaultRuleId.value === id) defaultRuleId.value = null;
}
</script>
