<template>
  <Tabs
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', String($event))"
  >
    <div class="mb-5 overflow-x-auto pb-1">
      <TabList variant="underline" size="md" :aria-label="label">
        <TabTrigger
          v-for="tab in tabs"
          :key="tab.id"
          :value="tab.id"
          :label="tab.label"
        />
      </TabList>
    </div>

    <slot />
  </Tabs>
</template>

<script setup lang="ts">
import { TabList, Tabs, TabTrigger } from "frappe-ui";

defineProps<{
  tabs: { id: string; label: string }[];
  modelValue: string;
  label: string;
}>();

defineEmits<{ "update:modelValue": [value: string] }>();
</script>
