<template>
  <div class="space-y-2">
    <div
      class="flex items-center justify-between gap-2 text-sm-medium text-ink-gray-7"
    >
      <span>{{ label }}</span>
      <span class="tabular-nums">{{ model }}{{ suffix }}</span>
    </div>
    <Slider
      :model-value="[model]"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-label="label"
      @update:model-value="update"
    />
  </div>
</template>

<script setup lang="ts">
import { Slider } from "frappe-ui";

defineProps<{
  label: string;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}>();

const model = defineModel<number>({ required: true });

function update(values: number[] | undefined) {
  const value = values?.[0];
  if (value !== undefined) model.value = value;
}
</script>
