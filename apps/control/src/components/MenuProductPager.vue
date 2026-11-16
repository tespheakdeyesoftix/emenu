<template>
  <nav
    v-if="pagination.total > pagination.pageSize"
    class="flex items-center justify-center gap-3"
    :aria-label="t('menus.productPages')"
  >
    <button
      type="button"
      class="btn-soft !p-2.5"
      :aria-label="t('menus.previousPage')"
      :disabled="disabled || pagination.page <= 1"
      @click="$emit('page', pagination.page - 1)"
    >
      <ChevronLeft :size="16" aria-hidden="true" />
    </button>
    <span class="text-sm font-bold text-black/50">
      {{ pagination.page }} /
      {{ Math.ceil(pagination.total / pagination.pageSize) }}
    </span>
    <button
      type="button"
      class="btn-soft !p-2.5"
      :aria-label="t('menus.nextPage')"
      :disabled="
        disabled || pagination.page * pagination.pageSize >= pagination.total
      "
      @click="$emit('page', pagination.page + 1)"
    >
      <ChevronRight :size="16" aria-hidden="true" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import type { MenuProductPage } from "../types/menu";

defineProps<{
  pagination: MenuProductPage["pagination"];
  disabled?: boolean;
}>();
defineEmits<{ page: [page: number] }>();
const { t } = useI18n();
</script>
