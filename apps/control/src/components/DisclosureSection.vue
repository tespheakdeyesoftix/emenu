<template>
  <Accordion
    :items="[{ value: 'section', title, icon }]"
    :default-value="initiallyOpen ? 'section' : undefined"
  >
    <template #item-label>
      <slot name="label">{{ title }}</slot>
    </template>
    <template #item-content>
      <slot />
    </template>
  </Accordion>
</template>

<script setup lang="ts">
import { Accordion } from "frappe-ui/experimental";

defineProps<{ title: string; icon?: string; initiallyOpen?: boolean }>();
</script>
