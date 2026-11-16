<template>
  <draggable
    :model-value="displayedSiblings"
    item-key="id"
    :group="dragGroup"
    :handle="`[data-menu-drag-depth='${depth}']`"
    :disabled="busy || (!canDrag && !canReceive)"
    :animation="160"
    ghost-class="opacity-40"
    class="space-y-1"
    @update:model-value="reorder"
    @start="startDrag"
    @end="emit('drag', null)"
  >
    <template #item="{ element: menu }">
      <div>
        <div class="relative flex items-center gap-0.5">
          <button
            v-if="canDrag && (allSources || menu.source === 'local')"
            type="button"
            class="grid h-8 shrink-0 touch-none place-items-center rounded-lg"
            :class="[
              allSources ? 'w-7 bg-cream text-black/70 sm:w-9' : 'w-5 text-black/45',
              busy ? 'cursor-wait' : 'cursor-grab hover:bg-cream active:cursor-grabbing',
            ]"
            :data-menu-drag-depth="depth"
            :aria-disabled="busy"
            :aria-label="t('menus.reorderNamed', { name: menuName(menu, locale) })"
            :title="t('menus.dragToReorder')"
            @keydown.up.prevent="moveMenu(menu.id, -1, $event)"
            @keydown.down.prevent="moveMenu(menu.id, 1, $event)"
          >
            <GripVertical :size="16" aria-hidden="true" />
          </button>
          <slot :menu="menu" :depth="depth" :active="parentActive && !!menu.isActive" />
          <draggable
            v-if="allSources && canDropUnder(menu.id)"
            :model-value="[]"
            item-key="id"
            :group="{ pull: false, put: [dragGroupName] }"
            :data-menu-drop-target="menu.id"
            class="absolute inset-y-0 end-0 grid w-24 place-items-center overflow-hidden rounded-lg border border-dashed border-ink/35 bg-cream text-xs font-semibold has-[>[data-draggable]]:bg-ink has-[>[data-draggable]]:text-white [&>[data-draggable]]:absolute [&>[data-draggable]]:pointer-events-none [&>[data-draggable]]:opacity-0"
            :aria-label="t('menus.dropUnderMenu', { name: menuName(menu, locale) })"
            @update:model-value="dropUnder(menu.id, $event)"
          >
            <template #header>
              <span class="pointer-events-none">{{ t('menus.dropHere') }}</span>
            </template>
            <template #item><div /></template>
          </draggable>
        </div>
        <div
          v-if="showChildren(menu.id) || showDropZone(menu)"
          class="relative mt-1"
          :class="depth < (allSources ? 8 : 4) ? 'ms-1.5 border-s border-black/10 ps-1' : ''"
        >
          <MenuSidebarTree
            :children="children"
            :collapsed="collapsed"
            :parent-id="menu.id"
            :depth="depth + 1"
            :parent-active="parentActive && !!menu.isActive"
            :parent-local="menu.source === 'local'"
            :all-sources="allSources"
            :blocked-parents="blockedParents"
            :editable="editable"
            :busy="busy"
            :drop-zone="showDropZone(menu)"
            :dragged-submenu-id="menu.id === draggedSubmenuId ? null : draggedSubmenuId"
            :class="showDropZone(menu) ? 'min-h-9 rounded-lg border border-dashed border-ink/25 bg-cream' : ''"
            @reorder="(parent, menuIds, move) => emit('reorder', parent, menuIds, move)"
            @drag="emit('drag', $event)"
          >
            <template #default="row">
              <slot v-bind="row" />
            </template>
          </MenuSidebarTree>
          <span
            v-if="showDropZone(menu)"
            class="pointer-events-none absolute inset-0 grid place-items-center text-xs text-black/55"
          >
            {{ t("menus.dropSubmenuHere") }}
          </span>
        </div>
      </div>
    </template>
  </draggable>
</template>

<script setup lang="ts">
import { GripVertical } from "lucide-vue-next";
import { computed, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import draggable from "vuedraggable";
import { menuName, type MenuNode, type MenuTreeMove } from "../types/menu";

const props = withDefaults(defineProps<{
  children: ReadonlyMap<string | null, MenuNode[]>;
  collapsed: ReadonlySet<string>;
  parentId?: string | null;
  depth?: number;
  parentActive?: boolean;
  parentLocal?: boolean;
  allSources?: boolean;
  blockedParents?: ReadonlySet<string>;
  editable: boolean;
  busy: boolean;
  dropZone?: boolean;
  draggedSubmenuId: string | null;
}>(), { parentId: null, depth: 0, parentActive: true });
const emit = defineEmits<{
  reorder: [parentId: string | null, menuIds: string[], move?: MenuTreeMove];
  drag: [submenuId: string | null];
}>();
defineSlots<{ default(row: { menu: MenuNode; depth: number; active: boolean }): unknown }>();

const { t, locale } = useI18n();
const siblings = computed(() => props.children.get(props.parentId) ?? []);
const displayedSiblings = computed(() => props.dropZone ? [] : siblings.value);
const sortableSiblings = computed(() =>
  props.allSources ? siblings.value : siblings.value.filter(({ source }) => source === "local"),
);
const canDrag = computed(
  () => props.editable && sortableSiblings.value.length > (props.parentId ? 0 : 1),
);
const canReceive = computed(() => props.editable && !props.allSources && props.parentLocal &&
  !!props.parentId && !props.blockedParents?.has(props.parentId),
);
const dragGroupName = computed(() => props.allSources ? "sort-modal-submenus" : "menu-submenus");
const dragGroup = computed(() => {
  const name = dragGroupName.value;
  return props.parentId
    ? { name, pull: true, put: canReceive.value ? [name] : false }
    : { pull: false, put: false };
});

function showChildren(id: string) {
  return props.children.has(id) && !props.collapsed.has(id);
}

function showDropZone(menu: MenuNode) {
  return !props.allSources && menu.source === "local" && canDropUnder(menu.id) && !showChildren(menu.id);
}

function canDropUnder(id: string) {
  return !!props.draggedSubmenuId && id !== props.draggedSubmenuId && !props.blockedParents?.has(id);
}

function dropUnder(parentId: string, [menu]: MenuNode[]) {
  if (props.busy || !menu?.parentId || !canDropUnder(parentId)) return;
  const menuIds = (props.children.get(parentId) ?? []).map(({ id }) => id);
  emit("reorder", parentId, [...menuIds, menu.id], { id: menu.id, fromParentId: menu.parentId });
}

function startDrag({ oldDraggableIndex }: { oldDraggableIndex?: number }) {
  if (props.parentId && oldDraggableIndex !== undefined)
    emit("drag", displayedSiblings.value[oldDraggableIndex]?.id ?? null);
}

function reorder(ordered: MenuNode[]) {
  if (props.busy || ordered.length < displayedSiblings.value.length) return;
  const moved = ordered.find((menu) => menu.parentId !== props.parentId);
  const destination = props.dropZone ? [...siblings.value, ...ordered] : ordered;
  const menuIds = destination.filter(({ source }) => props.allSources || source === "local").map(({ id }) => id);
  if (moved?.parentId && canReceive.value) {
    emit("reorder", props.parentId, menuIds, { id: moved.id, fromParentId: moved.parentId });
  } else if (canDrag.value && menuIds.some((id, index) => id !== sortableSiblings.value[index]?.id)) {
    emit("reorder", props.parentId, menuIds);
  }
}

function moveMenu(id: string, offset: number, event: KeyboardEvent) {
  const ordered = [...siblings.value];
  const index = ordered.findIndex((menu) => menu.id === id);
  const siblingIndex = sortableSiblings.value.findIndex((menu) => menu.id === id);
  const neighbor = sortableSiblings.value[siblingIndex + offset];
  if (index < 0 || !neighbor) return;
  const target = ordered.indexOf(neighbor);
  const [menu] = ordered.splice(index, 1);
  ordered.splice(target, 0, menu);
  reorder(ordered);
  const handle = event.currentTarget as HTMLButtonElement;
  void nextTick(() => handle.focus());
}
</script>
