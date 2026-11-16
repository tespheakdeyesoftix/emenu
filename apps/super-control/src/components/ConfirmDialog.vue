<template>
  <ModalPanel :open="open" :title="title" @close="!busy && $emit('close')">
    <p class="mt-0 text-sm leading-6 text-black/60">{{ message }}</p>
    <div class="mt-6 flex justify-end gap-3">
      <button
        type="button"
        class="btn-soft"
        :disabled="busy"
        @click="$emit('close')"
      >
        Cancel
      </button>
      <button
        type="button"
        :class="danger ? 'btn-danger' : 'btn-primary'"
        :disabled="busy"
        @click="$emit('confirm')"
      >
        <LoaderCircle v-if="busy" :size="17" class="animate-spin" />
        {{ busy ? "Working…" : confirmLabel }}
      </button>
    </div>
  </ModalPanel>
</template>

<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  danger?: boolean;
}>();
defineEmits<{ close: []; confirm: [] }>();
</script>
