<template>
  <Tree
    class="[--tree-indent:0.625rem] [&_.frappe-tree-row]:h-auto [&_.frappe-tree-row]:min-h-11"
    guides="lines"
    :aria-label="t('nav.menus')"
    :nodes="nodes"
    :expanded="expanded"
    :draggable="editable && !busy"
    :move="canDrop"
    @update:expanded="updateExpanded"
    @dragstart.capture="guardDrag"
    @drag-start="emit('drag', String($event.key))"
    @drag-end="finishDrag"
  >
    <template #item="{ node, level, expanded, hasChildren, toggle }">
      <div class="flex w-full min-w-0 items-center gap-0.5" @click.stop>
        <Button
          v-if="canDrag(menuFor(node))"
          variant="ghost"
          icon="lucide-grip-vertical"
          class="!w-6 cursor-grab active:cursor-grabbing"
          data-menu-draggable
          :disabled="busy"
          :aria-label="t('menus.reorderNamed', { name: node.label })"
          :tooltip="t('menus.dragToReorder')"
          @keydown.up.stop.prevent="moveBy(menuFor(node), -1, $event)"
          @keydown.down.stop.prevent="moveBy(menuFor(node), 1, $event)"
        />
        <Button
          v-if="hasChildren"
          variant="ghost"
          icon="lucide-chevron-right"
          class="!w-6"
          :class="{ '[&>span]:rotate-90': expanded }"
          :aria-expanded="expanded"
          :aria-label="t('menus.submenusOf', { name: node.label })"
          @click="toggle"
        />
        <span v-else class="w-6 shrink-0" aria-hidden="true" />
        <slot
          :menu="menuFor(node)"
          :depth="level - 1"
          :active="Boolean(node.active)"
        />
      </div>
    </template>
  </Tree>
</template>

<script setup lang="ts">
import {
  Button,
  Tree,
  type DropInfo,
  type MoveContext,
  type TreeKey,
  type TreeNode,
} from "frappe-ui";
import { computed, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { menuName, type MenuNode, type MenuTreeMove } from "../types/menu";

const props = defineProps<{
  children: ReadonlyMap<string | null, MenuNode[]>;
  collapsed: ReadonlySet<string>;
  allSources?: boolean;
  editable: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{
  reorder: [parentId: string | null, menuIds: string[], move?: MenuTreeMove];
  drag: [id: string | null];
  toggle: [id: string];
}>();
defineSlots<{
  default(row: { menu: MenuNode; depth: number; active: boolean }): unknown;
}>();

const { t, locale } = useI18n();
const menusById = computed(
  () =>
    new Map([...props.children.values()].flat().map((menu) => [menu.id, menu])),
);

const expanded = computed(() =>
  [...props.children.keys()].filter(
    (id): id is string => id !== null && !props.collapsed.has(id),
  ),
);
const nodes = computed(() => {
  function branch(parentId: string | null, parentActive: boolean): TreeNode[] {
    return (props.children.get(parentId) ?? []).map((menu) => {
      const active = parentActive && !!menu.isActive;
      return {
        key: menu.id,
        label: menuName(menu, locale.value),
        active,
        children: branch(menu.id, active),
      };
    });
  }
  return branch(null, true);
});

function menuFor(node: TreeNode) {
  // The tree keys are built from the same menu map.
  return menusById.value.get(String(node.key))!;
}

function updateExpanded(keys: TreeKey[]) {
  const next = new Set(keys);
  for (const id of props.children.keys()) {
    if (id !== null && next.has(id) === props.collapsed.has(id))
      emit("toggle", id);
  }
}

function canSort(menu: MenuNode) {
  return props.allSources || menu.source === "local";
}

function canDrag(menu: MenuNode) {
  return (
    props.editable &&
    canSort(menu) &&
    (menu.parentId !== null ||
      (props.children.get(null) ?? []).filter(canSort).length > 1)
  );
}

function guardDrag(event: DragEvent) {
  if (!(event.target instanceof Element)) return;
  if (
    event.target
      .closest('[data-slot="row"]')
      ?.querySelector("[data-menu-draggable]:not(:disabled)")
  )
    return;
  event.preventDefault();
  event.stopPropagation();
}

function canDrop({ node, target, position }: MoveContext) {
  const menu = menuFor(node);
  const destination = menuFor(target);
  const parentId =
    position === "inside" ? destination.id : destination.parentId;
  if (props.busy || !canDrag(menu)) return false;
  if (parentId === menu.parentId) return true;
  return !!(
    parentId &&
    menu.parentId &&
    (props.allSources || menusById.value.get(parentId)?.source === "local")
  );
}

function finishDrag(drop: DropInfo | null) {
  emit("drag", null);
  if (!drop || props.busy) return;
  const menu = menuFor(drop.node);
  const parentId = drop.to === null ? null : String(drop.to);
  const siblings = props.children.get(parentId) ?? [];
  const ordered = siblings.filter(({ id }) => id !== menu.id);
  ordered.splice(drop.newIndex, 0, menu);
  const ids = ordered.filter(canSort).map(({ id }) => id);
  const move =
    menu.parentId && parentId !== menu.parentId
      ? { id: menu.id, fromParentId: menu.parentId }
      : undefined;
  const sortableSiblings = siblings.filter(canSort);
  if (move || ids.some((id, i) => id !== sortableSiblings[i]?.id))
    emit("reorder", parentId, ids, move);
}

function moveBy(menu: MenuNode, offset: number, event: KeyboardEvent) {
  if (props.busy) return;
  const siblings = (props.children.get(menu.parentId) ?? []).filter(canSort);
  const index = siblings.findIndex(({ id }) => id === menu.id);
  const neighbor = siblings[index + offset];
  if (!neighbor) return;
  const ids = siblings.map(({ id }) =>
    id === menu.id ? neighbor.id : id === neighbor.id ? menu.id : id,
  );
  emit("reorder", menu.parentId, ids);
  const handle = event.currentTarget as HTMLElement;
  void nextTick(() => handle.focus());
}
</script>
