<template>
  <Dialog
    v-if="open"
    :open="true"
    :title="title"
    :size="size === 'large' ? '5xl' : 'lg'"
    :dismissible="closeOnBackdrop"
    :show-close-button="false"
    @close="$emit('close')"
  >
    <template #title="{ close }">
      <div class="flex items-center justify-between gap-3">
        <h2 class="min-w-0 text-xl-semibold text-ink-gray-9">{{ title }}</h2>
        <Button
          variant="ghost"
          icon="lucide-x"
          :aria-label="t('common.close')"
          @click="close"
        />
      </div>
    </template>
    <div
      class="admin-modal-body"
      :class="{
        'admin-modal-body--fixed': fixedHeight,
        'admin-modal-body--fullscreen': mobileFullscreen,
      }"
    >
      <slot />
    </div>
    <template v-if="$slots.footer" #actions>
      <slot name="footer" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog } from "frappe-ui";
import { useI18n } from "vue-i18n";

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    closeOnBackdrop?: boolean;
    size?: "default" | "large";
    mobileFullscreen?: boolean;
    fixedHeight?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
    size: "default",
  },
);
defineEmits<{ close: [] }>();
const { t } = useI18n();
</script>
