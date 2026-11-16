<template>
  <ModalPanel
    :open="open"
    :title="title"
    :close-on-backdrop="false"
    @close="requestClose"
  >
    <div role="alertdialog" aria-modal="true" :aria-busy="busy">
      <div class="flex gap-4 rounded-2xl bg-red-50 p-4 text-red-950">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600"
        >
          <TriangleAlert :size="20" />
        </span>
        <div>
          <p class="m-0 font-bold">{{ t("common.irreversible") }}</p>
          <p class="mb-0 mt-1 text-sm leading-6 text-red-900/65">
            {{ message }}
          </p>
        </div>
      </div>

      <slot />

      <p v-if="error" class="mb-0 mt-4 text-sm font-bold text-red-600">
        {{ error }}
      </p>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="btn-soft sm:min-w-28"
          :disabled="busy"
          @click="requestClose"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-36"
          :disabled="busy"
          @click="$emit('confirm')"
        >
          <LoaderCircle v-if="busy" class="animate-spin" :size="16" />
          <Trash2 v-else :size="16" />
          {{ busy ? t("common.deleting") : confirmLabel || t("common.delete") }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { LoaderCircle, Trash2, TriangleAlert } from "lucide-vue-next";
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
