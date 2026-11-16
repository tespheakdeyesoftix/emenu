<template>
  <div v-if="selecting || (!hideTrigger && pageProductIds.length)" class="flex flex-wrap items-center gap-2">
    <button
      v-if="!selecting"
      type="button"
      class="btn-soft"
      :disabled="disabled"
      @click="selecting = true"
    >
      <Trash2 :size="16" aria-hidden="true" />
      {{ t("bulkProductDelete.action") }}
    </button>
    <template v-else>
      <span class="mr-1 text-sm font-bold text-black/60" role="status">
        {{ t("bulkProductDelete.selected", { count: selectedIds.length }) }}
      </span>
      <button type="button" class="btn-soft" :disabled="disabled || selectingMatches || pageSelected" @click="selectPage">
        {{ t("bulkProductDelete.selectPage") }}
      </button>
      <button
        type="button"
        class="btn-soft"
        :disabled="disabled || selectingMatches || !pageProductIds.length"
        @click="selectAllMatches"
      >
        {{ t(selectingMatches ? "common.loading" : "menus.selectAll") }}
      </button>
      <button
        type="button"
        class="btn-soft"
        :disabled="!selectedIds.length && !selectingMatches"
        @click="clearSelection"
      >
        {{ t("menus.unselectAll") }}
      </button>
      <button type="button" class="btn-soft" @click="cancel">
        {{ t("common.cancel") }}
      </button>
      <button
        type="button"
        class="btn-soft text-red-700"
        :disabled="disabled || selectingMatches || !selectedIds.length"
        @click="openConfirmation"
      >
        <Trash2 :size="16" aria-hidden="true" />
        {{ t("bulkProductDelete.deleteSelected") }}
      </button>
    </template>
    <p v-if="selectionError" class="m-0 w-full text-sm text-red-700" role="alert">
      {{ selectionError }}
    </p>
  </div>
  <ConfirmDialog
    :open="pendingIds.length > 0"
    :title="t('bulkProductDelete.deleteSelected')"
    :message="t('bulkProductDelete.confirm', { count: pendingIds.length })"
    :busy="saving"
    :error="error"
    @close="pendingIds = []"
    @confirm="deleteSelected"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Trash2 } from "lucide-vue-next";
import { useAdminStore } from "../stores/admin";
import ConfirmDialog from "./ConfirmDialog.vue";

const props = defineProps<{
  pageProductIds: string[];
  scopeKey: string;
  fetchMatches: () => Promise<string[]>;
  disabled?: boolean;
  hideTrigger?: boolean;
}>();
const emit = defineEmits<{ saved: [] }>();
const selecting = defineModel<boolean>("selecting", { required: true });
const selectedIds = defineModel<string[]>("selectedIds", { required: true });
const { t } = useI18n();
const admin = useAdminStore();
const pendingIds = ref<string[]>([]);
const saving = ref(false);
const error = ref("");
const selectionError = ref("");
const selectingMatches = ref(false);
let selectionRequest = 0;
const pageSelected = computed(() => {
  const selected = new Set(selectedIds.value);
  return props.pageProductIds.every((id) => selected.has(id));
});

function selectPage() {
  selectedIds.value = [...new Set([...selectedIds.value, ...props.pageProductIds])];
}

function clearSelection() {
  selectionRequest++;
  selectingMatches.value = false;
  selectionError.value = "";
  selectedIds.value = [];
}

watch(() => props.scopeKey, () => {
  clearSelection();
  if (!saving.value) pendingIds.value = [];
});
onBeforeUnmount(() => { selectionRequest++; });

async function selectAllMatches() {
  if (props.disabled || selectingMatches.value) return;
  const request = ++selectionRequest;
  selectingMatches.value = true;
  selectionError.value = "";
  try {
    const ids = await props.fetchMatches();
    if (request === selectionRequest) selectedIds.value = ids;
  } catch (cause) {
    if (request === selectionRequest)
      selectionError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (request === selectionRequest) selectingMatches.value = false;
  }
}

function cancel() {
  clearSelection();
  selecting.value = false;
}

function openConfirmation() {
  error.value = "";
  pendingIds.value = [...selectedIds.value];
}

async function deleteSelected() {
  if (saving.value || !pendingIds.value.length) return;
  saving.value = true;
  error.value = "";
  try {
    const { deletedIds, protectedIds } = await admin.bulkDeleteProducts(pendingIds.value);
    const messages = [t("bulkProductDelete.deleted", { count: deletedIds.length })];
    if (protectedIds.length)
      messages.push(t("bulkProductDelete.protected", { count: protectedIds.length }));
    const unavailable = pendingIds.value.length - deletedIds.length - protectedIds.length;
    if (unavailable > 0)
      messages.push(t("bulkProductDelete.unavailable", { count: unavailable }));
    admin.notify(messages.join(" "));
    pendingIds.value = [];
    cancel();
    emit("saved");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}
</script>
