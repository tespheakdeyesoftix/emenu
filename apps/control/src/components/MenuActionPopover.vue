<template>
  <Popover align="end" :offset="6">
    <template #trigger>
      <Button
        :variant="compact ? 'ghost' : 'subtle'"
        size="md"
        class="shrink-0"
        icon="lucide-ellipsis"
        :aria-label="label"
        :tooltip="label"
        :disabled="disabled"
      />
    </template>
    <template #default="{ close }">
      <div class="w-56 max-w-[calc(100vw-2rem)] p-1">
        <slot :close="close" />
      </div>
    </template>
  </Popover>
</template>

<script setup lang="ts">
import { Button, Popover } from "frappe-ui";

defineProps<{ label: string; compact?: boolean; disabled?: boolean }>();
</script>

<style scoped>
:slotted(button) {
  @apply flex w-full items-center justify-start gap-2 rounded-4 px-3 py-2 text-start text-sm-medium hover:bg-surface-gray-2 disabled:opacity-50;
}

:slotted(button) :deep(svg) {
  flex-shrink: 0;
}
</style>
