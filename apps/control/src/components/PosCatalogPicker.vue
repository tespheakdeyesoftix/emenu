<template>
  <fieldset class="rounded-xl border border-black/10 p-3">
    <legend class="px-1 text-sm font-semibold">
      {{ t("selling.catalogSelection") }}
    </legend>
    <p class="mb-2 text-sm text-black/60">
      {{ t(flat ? "selling.menuSelectionHelp" : "selling.catalogSelectionHelp") }}
    </p>
    <p v-if="flat && missingIds.length" class="mb-2 text-sm text-black/60">
      {{ t("selling.savedSubmenuLimits") }}
    </p>
    <div class="max-h-64 overflow-y-auto overscroll-contain">
      <ul v-if="flat" class="space-y-1">
        <li v-for="menu in items" :key="menu.id">
          <Checkbox
            :label="menu.name"
            :model-value="selected.has(menu.id)"
            @update:model-value="toggleSelection(menu.id, Boolean($event))"
          />
        </li>
      </ul>
      <Tree
        v-else
        v-model:expanded="expanded"
        :nodes="nodes"
        guides="lines"
        :aria-label="t('selling.catalogSelection')"
      >
        <template #item-label="{ node }">
          <div @click.stop @keydown.space.stop @keydown.enter.stop>
            <Checkbox
              :label="node.label"
              :model-value="
                Boolean(node.inherited) || selected.has(String(node.key))
              "
              :disabled="Boolean(node.inherited)"
              @update:model-value="
                toggleSelection(String(node.key), Boolean($event))
              "
            />
          </div>
        </template>
      </Tree>
      <Checkbox
        v-for="id in flat ? [] : missingIds"
        :key="id"
        :model-value="true"
        :label="t('selling.unavailableSelection', { id })"
        class="my-1"
        @update:model-value="toggleSelection(id, false)"
      />
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { Checkbox, Tree, type TreeKey, type TreeNode } from "frappe-ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { CatalogOption } from "../types/posProfile";

const props = defineProps<{ items: CatalogOption[]; flat?: boolean }>();
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
const branchIds = computed(() =>
  props.items.filter(({ id }) => children.value.has(id)).map(({ id }) => id),
);
const expanded = computed<TreeKey[]>({
  get: () => branchIds.value.filter((id) => !collapsed.value.has(id)),
  set: (ids) => {
    collapsed.value = new Set(
      branchIds.value.filter((id) => !ids.includes(id)),
    );
  },
});
const nodes = computed(() => {
  function build(parentId: string | null, inherited: boolean): TreeNode[] {
    return (children.value.get(parentId) ?? []).map((item) => ({
      key: item.id,
      label: item.name,
      inherited,
      children: build(item.id, inherited || selected.value.has(item.id)),
    }));
  }
  return build(null, false);
});

function toggleSelection(id: string, checked: boolean) {
  const next = new Set(selected.value);
  if (props.flat) {
    for (const unavailable of missingIds.value) next.delete(unavailable);
  }
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
