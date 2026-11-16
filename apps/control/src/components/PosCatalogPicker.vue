<template>
  <fieldset class="rounded-xl border border-black/10 p-3">
    <legend class="px-1 text-sm font-semibold">
      {{ t("selling.catalogSelection") }}
    </legend>
    <p class="mb-2 text-sm text-black/60">
      {{ t("selling.catalogSelectionHelp") }}
    </p>
    <ul class="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain">
      <li
        v-for="{ node, depth, inherited, hasChildren } in rows"
        :key="node.id"
        class="flex min-h-8 items-center gap-1.5 rounded-lg hover:bg-cream"
        :style="{ paddingInlineStart: `${Math.min(depth, 10)}rem` }"
      >
        <button
          v-if="hasChildren"
          type="button"
          class="grid size-7 shrink-0 place-items-center rounded text-black/65 hover:text-ink"
          :aria-label="
            t(
              collapsed.has(node.id)
                ? 'selling.expandCatalogNode'
                : 'selling.collapseCatalogNode',
              { name: node.name },
            )
          "
          :aria-expanded="!collapsed.has(node.id)"
          @click="toggleBranch(node.id)"
        >
          <ChevronRight
            v-if="collapsed.has(node.id)"
            :size="16"
            aria-hidden="true"
          />
          <ChevronDown v-else :size="16" aria-hidden="true" />
        </button>
        <span v-else class="w-7 shrink-0" aria-hidden="true" />
        <label class="flex min-w-0 flex-1 items-center gap-2 py-1 text-sm">
          <input
            type="checkbox"
            class="shrink-0"
            :checked="inherited || selected.has(node.id)"
            :disabled="inherited"
            @change="
              toggleSelection(
                node.id,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <span class="break-words">{{ node.name }}</span>
        </label>
      </li>
      <li
        v-for="id in missingIds"
        :key="id"
        class="px-2 py-1 text-sm text-amber-800"
      >
        <label class="flex items-center gap-2">
          <input type="checkbox" checked @change="toggleSelection(id, false)" />
          {{ t("selling.unavailableSelection", { id }) }}
        </label>
      </li>
    </ul>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import type { CatalogOption } from "../types/posProfile";

const props = defineProps<{ items: CatalogOption[] }>();
const selectedIds = defineModel<string[]>({ required: true });
const { t } = useI18n();
const collapsed = ref(new Set<string>());
const selected = computed(() => new Set(selectedIds.value));
const missingIds = computed(() => {
  const available = new Set(props.items.map(({ id }) => id));
  return selectedIds.value.filter((id) => !available.has(id));
});
const children = computed(() => {
  const byParent = new Map<string | null, CatalogOption[]>();
  for (const node of props.items) {
    const siblings = byParent.get(node.parent_id) ?? [];
    siblings.push(node);
    byParent.set(node.parent_id, siblings);
  }
  return byParent;
});
const rows = computed(() => {
  const result: Array<{
    node: CatalogOption;
    depth: number;
    inherited: boolean;
    hasChildren: boolean;
  }> = [];
  function visit(parentId: string | null, depth: number, inherited: boolean) {
    for (const node of children.value.get(parentId) ?? []) {
      const hasChildren = children.value.has(node.id);
      result.push({ node, depth, inherited, hasChildren });
      if (hasChildren && !collapsed.value.has(node.id))
        visit(node.id, depth + 1, inherited || selected.value.has(node.id));
    }
  }
  visit(null, 0, false);
  return result;
});

function toggleBranch(id: string) {
  if (collapsed.value.has(id)) collapsed.value.delete(id);
  else collapsed.value.add(id);
}

function toggleSelection(id: string, checked: boolean) {
  const next = new Set(selected.value);
  function clearBranch(nodeId: string) {
    next.delete(nodeId);
    for (const child of children.value.get(nodeId) ?? []) clearBranch(child.id);
  }
  clearBranch(id);
  // The POS API expands selected parents, including children added later.
  if (checked) next.add(id);
  selectedIds.value = [...next];
}
</script>
