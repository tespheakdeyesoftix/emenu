<template>
  <FrappePageHeader class="min-h-[71px] !border-0 !px-0 py-3">
    <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3">
      <h1 class="min-w-0 pl-11 text-2xl-semibold text-ink-gray-9 [overflow-wrap:anywhere] lg:pl-0">{{ title }}</h1>
      <div v-if="$slots.default" :inert="actionsDisabled" class="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
        <slot />
      </div>
    </div>
  </FrappePageHeader>
</template>

<script setup lang="ts">
import { PageHeader as FrappePageHeader } from "frappe-ui";
import { inject } from "vue";
import { workspaceActionsDisabled } from "../utils/workspaceHeader";

defineProps<{ title: string }>();
const actionsDisabled = inject(workspaceActionsDisabled);
</script>
