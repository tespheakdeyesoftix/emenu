<template>
  <div
    v-for="row in rows"
    :key="row.item.id"
    class="flex items-center gap-1"
    :class="{ 'border-s border-black/10 ps-1': row.depth > 0 }"
    :style="{ marginInlineStart: `${Math.min(row.depth, 4) * 0.625}rem` }"
  >
    <button
      v-if="row.hasChildren"
      type="button"
      class="grid shrink-0 place-items-center rounded-full text-black/60 transition hover:bg-cream hover:text-ink"
      :class="editable ? 'h-8 w-6' : 'size-11 bg-cream'"
      :aria-expanded="row.expanded"
      :aria-label="t('pages.catalog.subcategoriesLabel', { name: row.item.nameKm || row.item.name })"
      @click="$emit('toggle', row.item.id)"
    >
      <ChevronRight
        :size="17"
        class="transition-transform"
        :class="{ 'rotate-90': row.expanded }"
        aria-hidden="true"
      />
    </button>
    <span v-else class="shrink-0" :class="editable ? 'w-6' : 'w-11'" aria-hidden="true" />
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-start transition"
      :class="[
        row.depth ? 'min-h-11 py-1.5' : 'min-h-14 py-2',
        {
          'bg-ink text-white': selectedId === row.item.id,
          'hover:bg-cream': selectedId !== row.item.id && editable,
          'bg-cream hover:bg-ink/10': selectedId !== row.item.id && !editable,
        },
      ]"
      :aria-pressed="selectedId === row.item.id"
      :title="row.item.nameKm || row.item.name"
      @click="$emit('select', row.item.id)"
    >
      <FallbackImage
        v-if="!row.depth"
        :src="row.item.imageUrl"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-6 shrink-0 rounded-md object-cover"
      />
      <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <strong class="block text-sm leading-snug">
          {{ row.item.nameKm || row.item.name }}
        </strong>
        <small
          v-if="(enableEn && row.item.nameEn) || (enableZh && row.item.nameZh)"
          class="mt-0.5 block text-[11px] opacity-70"
        >
          <span v-if="enableEn">{{ row.item.nameEn }}</span>
          <span v-if="enableEn && row.item.nameEn && enableZh && row.item.nameZh"> · </span>
          <span v-if="enableZh">{{ row.item.nameZh }}</span>
        </small>
        <small
          v-if="row.item.isActive === 0 || row.item.isActive === false"
          class="mt-0.5 block text-[11px] opacity-70"
        >
          {{ t("pages.catalog.categoryManager.hidden") }}
        </small>
      </span>
      <span
        class="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
        :class="selectedId === row.item.id ? 'bg-white/10' : 'bg-black/[.06] text-black/60'"
      >
        {{ counts[row.item.id] || 0 }}
      </span>
      <Check
        v-if="!editable && selectedId === row.item.id"
        :size="16"
        class="shrink-0"
        aria-hidden="true"
      />
    </button>
    <MenuActionPopover
      v-if="editable"
      v-slot="{ close }"
      compact
      :label="t('common.actionsFor', { name: row.item.nameKm || row.item.name })"
    >
      <button type="button" @click="close(); $emit('edit', row.item)">
        <Pencil :size="16" aria-hidden="true" />{{ t("common.edit") }}
      </button>
      <button type="button" @click="close(); $emit('addSubcategory', row.item)">
        <FolderPlus :size="16" aria-hidden="true" />{{ t("pages.catalog.categoryManager.addSubcategory") }}
      </button>
      <button
        type="button"
        class="text-red-700"
        :disabled="row.hasChildren || counts[row.item.id] > 0"
        @click="close(); $emit('delete', row.item)"
      >
        <Trash2 :size="16" aria-hidden="true" />{{ t("pages.catalog.categoryManager.deleteAction") }}
      </button>
      <p v-if="row.hasChildren || counts[row.item.id] > 0" class="m-0 px-3 pb-2 text-xs text-black/60">
        {{ t("pages.catalog.categoryManager.deleteEmptyOnly") }}
      </p>
    </MenuActionPopover>
  </div>
</template>

<script setup lang="ts">
import { Check, ChevronRight, FolderPlus, Pencil, Trash2 } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import type { Category } from "../stores/admin";
import MenuActionPopover from "./MenuActionPopover.vue";

defineProps<{
  rows: {
    item: Category;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
  }[];
  counts: Record<string, number>;
  selectedId: string;
  enableEn?: boolean;
  enableZh?: boolean;
  editable?: boolean;
}>();

defineEmits<{
  select: [id: string];
  toggle: [id: string];
  edit: [category: Category];
  addSubcategory: [category: Category];
  delete: [category: Category];
}>();

const { t } = useI18n();
</script>
