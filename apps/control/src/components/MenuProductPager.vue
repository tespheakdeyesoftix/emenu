<template>
  <nav
    v-if="pagination.total > pagination.pageSize"
    class="flex items-center justify-center gap-3"
    :aria-label="t('menus.productPages')"
  >
    <Button variant="subtle" size="lg"
      type="button"
      class="!p-2.5"
      :aria-label="t('menus.previousPage')"
      :disabled="disabled || pagination.page <= 1"
      @click="$emit('page', pagination.page - 1)"
    >
      <template #icon><ChevronLeft :size="16" aria-hidden="true" /></template>
    </Button>
    <span class="text-sm font-bold text-black/50">
      {{ pagination.page }} /
      {{ Math.ceil(pagination.total / pagination.pageSize) }}
    </span>
    <Button variant="subtle" size="lg"
      type="button"
      class="!p-2.5"
      :aria-label="t('menus.nextPage')"
      :disabled="
        disabled || pagination.page * pagination.pageSize >= pagination.total
      "
      @click="$emit('page', pagination.page + 1)"
    >
      <template #icon><ChevronRight :size="16" aria-hidden="true" /></template>
    </Button>
  </nav>
</template>

<script setup lang="ts">
import { Button } from "frappe-ui";
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
