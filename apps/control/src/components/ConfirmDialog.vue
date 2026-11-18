<template>
  <ModalPanel
    :open="open"
    :title="title"
    :close-on-backdrop="false"
    @close="requestClose"
  >
    <div :aria-busy="busy">
      <Alert
        theme="red"
        icon="lucide-triangle-alert"
        :title="t('common.irreversible')"
        :description="message"
      />

      <slot />

      <Alert v-if="error" theme="red" :title="error" class="mb-0 mt-4" />
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="subtle" size="lg"
          type="button"
          class="sm:min-w-28"
          :disabled="busy"
          @click="requestClose"
        >
          {{ t("common.cancel") }}
        </Button>
        <Button
          variant="solid"
          theme="red"
          size="lg"
          icon-left="lucide-trash-2"
          :label="confirmLabel || t('common.delete')"
          :loading="busy"
          :loading-text="t('common.deleting')"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { Alert, Button } from "frappe-ui";
import { useI18n } from "vue-i18n";
import ModalPanel from "./ModalPanel.vue";
const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    busy?: boolean;
    error?: string;
  }>(),
  {
    confirmLabel: "",
    busy: false,
    error: "",
  },
);

const emit = defineEmits<{ close: []; confirm: [] }>();

function requestClose() {
  if (!props.busy) emit("close");
}
</script>
