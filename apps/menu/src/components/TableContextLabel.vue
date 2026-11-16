<template>
  <p class="m-0 flex items-center gap-2 text-sm leading-5">
    <Armchair :size="16" class="shrink-0 text-tomato" aria-hidden="true" />
    <span class="min-w-0 break-words">
      <strong>{{ text.tableNumber(table.code) }}</strong>
      <span v-if="table.groupName">{{ ` · ${table.groupName}` }}</span>
    </span>
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Armchair } from "lucide-vue-next";
import { useMenuStore, type TableContext } from "../stores/menu";
import { uiText } from "../uiText";

defineProps<{ table: TableContext }>();
const store = useMenuStore();
const text = computed(() => uiText(store.selectedLanguage));
</script>
