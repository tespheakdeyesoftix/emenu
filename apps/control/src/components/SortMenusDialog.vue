<template>
  <ModalPanel
    open
    size="large"
    fixed-height
    :title="t('menus.sortOrder')"
    :close-on-backdrop="false"
    @close="!saving && $emit('close')"
  >
    <div v-if="movingMenu">
      <h3 class="m-0 text-base font-bold [overflow-wrap:anywhere]">
        {{ t("menus.moveMenuTo", { name: menuName(movingMenu, locale) }) }}
      </h3>
      <p class="mb-3 mt-1 text-sm text-black/55">
        {{ t("menus.moveMenuHelp") }}
      </p>
      <TextInput
        size="lg"
        variant="outline"
        ref="parentSearch"
        v-model="parentQuery"
        type="search"
        :placeholder="t('menus.searchMenus')"
        :aria-label="t('menus.searchMenus')"
      />
      <List divider="none" v-if="parentOptions.length" class="mb-0 mt-3 list-none space-y-1 p-0">
        <ListRow v-for="{ id, label } in parentOptions" :key="id" class="!block">
          <Button
            variant="outline"
            type="button"
            class="!h-auto min-h-11 w-full !justify-start !whitespace-normal text-start"
            @click="moveTo(id)"
          >
            <template #prefix><Folder :size="16" aria-hidden="true" /></template>
            <span class="min-w-0 [overflow-wrap:anywhere]">{{ label }}</span>
          </Button>
        </ListRow>
      </List>
      <Alert v-else :title="t('menus.noParentOptions')" class="my-4" />
    </div>
    <template v-else>
      <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
        <p class="m-0 max-w-xl text-sm text-black/60">
          {{ t("menus.sortTreeHelp") }}
        </p>
        <Button
          variant="outline"
          v-if="expandableIds.length"
          type="button"
          size="lg"
          :disabled="saving || !!draggedSubmenuId"
          @click="toggleAll"
        >
          {{
            t(hasCollapsedBranches ? "menus.expandAll" : "menus.collapseAll")
          }}
        </Button>
      </div>
      <Alert v-if="moveNotice" :title="moveNotice" class="mb-3 mt-0" />
      <MenuSidebarTree
        v-slot="{ menu }"
        :children="draftChildren"
        :collapsed="collapsed"
        :busy="saving"
        editable
        all-sources
        @reorder="reorder"
        @toggle="toggle"
        @drag="draggedSubmenuId = $event"
      >
        <span
          :id="rowId(menu.id)"
          tabindex="-1"
          class="min-w-0 flex-1 rounded-lg px-2 py-2 text-sm font-semibold [overflow-wrap:anywhere]"
          :class="menu.id === focusedMenuId ? 'bg-ink text-white' : 'bg-cream'"
          >{{ menuName(menu, locale) }}</span
        >
        <Button
          variant="ghost"
          v-if="menu.parentId"
          type="button"
          class="min-h-9 !gap-1 !px-1.5 sm:!px-2"
          :disabled="saving"
          :aria-label="t('menus.moveMenuTo', { name: menuName(menu, locale) })"
          :title="t('menus.moveTo')"
          @click="openParentPicker(menu)"
        >
          <template #prefix><FolderInput :size="16" aria-hidden="true" /></template>
          <span class="hidden sm:inline">{{ t("menus.moveTo") }}</span>
        </Button>
        <Button
          variant="ghost"
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-cream disabled:opacity-25 sm:size-9"
          :disabled="saving || !neighbor(menu, -1)"
          :aria-label="t('menus.moveUp', { name: menuName(menu, locale) })"
          :title="t('common.moveUp')"
          @click="move(menu, -1)"
        >
          <template #icon><ArrowUp :size="16" aria-hidden="true" /></template>
        </Button>
        <Button
          variant="ghost"
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-cream disabled:opacity-25 sm:size-9"
          :disabled="saving || !neighbor(menu, 1)"
          :aria-label="t('menus.moveDown', { name: menuName(menu, locale) })"
          :title="t('common.moveDown')"
          @click="move(menu, 1)"
        >
          <template #icon><ArrowDown :size="16" aria-hidden="true" /></template>
        </Button>
      </MenuSidebarTree>
    </template>
    <Alert v-if="error" theme="red" :title="error" class="mb-0 mt-4" />
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          variant="subtle"
          size="lg"
          v-if="movingMenu"
          type="button"
          @click="closeParentPicker"
        >
          {{ t("menus.backToSorting") }}
        </Button>
        <template v-else>
          <Button
            variant="subtle"
            size="lg"
            type="button"
            :disabled="saving"
            @click="$emit('close')"
          >
            {{ t("common.cancel") }}
          </Button>
          <Button
            variant="solid"
            size="lg"
            type="button"
            :disabled="saving || !updates.length"
            @click="$emit('save', updates)"
          >
            {{ t(saving ? "common.saving" : "menus.saveOrder") }}
          </Button>
        </template>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { List, ListRow } from "frappe-ui/list";
import { Alert, Button, TextInput } from "frappe-ui";
import { ArrowDown, ArrowUp, Folder, FolderInput } from "lucide-vue-next";
import { computed, nextTick, onMounted, reactive, ref, useId } from "vue";
import { useI18n } from "vue-i18n";
import {
  menuChildren,
  menuName,
  menuTree,
  type MenuNode,
  type MenuPlacement,
  type MenuTreeMove,
} from "../types/menu";
import MenuSidebarTree from "./MenuSidebarTree.vue";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  menus: MenuNode[];
  selectedId: string;
  saving: boolean;
  error: string;
}>();
defineEmits<{ close: []; save: [updates: MenuPlacement[]] }>();
const { t, locale } = useI18n();
const instanceId = useId();
const rowId = (id: string) => `${instanceId}-${id}`;
const focusedMenuId = ref(props.selectedId);
const originalChildren = menuChildren(props.menus);
const draft = ref([...props.menus]);
const draftChildren = computed(() => menuChildren(draft.value));
const draftById = computed(
  () => new Map(draft.value.map((menu) => [menu.id, menu])),
);
const draggedSubmenuId = ref<string | null>(null);
const movingMenuId = ref("");
const movingMenu = computed(() => draftById.value.get(movingMenuId.value));
const parentQuery = ref("");
const parentSearch = ref<InstanceType<typeof TextInput>>();
const moveNotice = ref("");
const blockedParents = computed(() => {
  const id = draggedSubmenuId.value ?? movingMenuId.value;
  const blocked = id ? branchIds(draftChildren.value, id) : new Set<string>();
  const parentId = draftById.value.get(id)?.parentId;
  if (parentId) blocked.add(parentId);
  return blocked;
});
const parentOptions = computed(() => {
  if (!movingMenu.value) return [];
  const paths = new Map<string, string>();
  const options: { id: string; label: string }[] = [];
  const query = parentQuery.value.trim().toLocaleLowerCase();
  for (const { menu } of menuTree(draft.value)) {
    const parent = menu.parentId ? paths.get(menu.parentId) : "";
    const name = menuName(menu, locale.value);
    const label = parent ? `${parent} / ${name}` : name;
    paths.set(menu.id, label);
    if (
      !blockedParents.value.has(menu.id) &&
      label.toLocaleLowerCase().includes(query)
    )
      options.push({ id: menu.id, label });
  }
  return options;
});

const expanded = branchIds(originalChildren, props.selectedId);
const originalById = new Map(props.menus.map((menu) => [menu.id, menu]));
let parentId = originalById.get(props.selectedId)?.parentId;
while (parentId && !expanded.has(parentId)) {
  expanded.add(parentId);
  parentId = originalById.get(parentId)?.parentId;
}
const collapsed = reactive(
  new Set(
    props.menus.filter(({ id }) => !expanded.has(id)).map(({ id }) => id),
  ),
);
const expandableIds = computed(() =>
  [...draftChildren.value.keys()].filter((id): id is string => id !== null),
);
const hasCollapsedBranches = computed(() =>
  expandableIds.value.some((id) => collapsed.has(id)),
);

const updates = computed<MenuPlacement[]>(() => {
  const placements: MenuPlacement[] = [];
  for (const [parentId, siblings] of draftChildren.value) {
    const original = originalChildren.get(parentId) ?? [];
    if (
      siblings.length === original.length &&
      siblings.every(({ id }, index) => id === original[index].id)
    )
      continue;
    for (const [sortOrder, { id }] of siblings.entries())
      placements.push({ id, parentId, sortOrder });
  }
  return placements;
});

function branchIds(
  children: ReadonlyMap<string | null, MenuNode[]>,
  rootId: string,
) {
  const ids = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const child of children.get(id) ?? []) pending.push(child.id);
  }
  return ids;
}

function toggle(id: string) {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
}

function toggleAll() {
  if (hasCollapsedBranches.value) {
    collapsed.clear();
  } else {
    for (const id of expandableIds.value) collapsed.add(id);
  }
}

function reveal(id: string, focus = false) {
  focusedMenuId.value = id;
  let ancestorId = draftById.value.get(id)?.parentId;
  while (ancestorId) {
    collapsed.delete(ancestorId);
    ancestorId = draftById.value.get(ancestorId)?.parentId;
  }
  void nextTick(() => {
    const row = document.getElementById(rowId(id));
    row?.scrollIntoView({ block: "nearest" });
    if (focus) row?.focus({ preventScroll: true });
  });
}

function openParentPicker(menu: MenuNode) {
  movingMenuId.value = menu.id;
  parentQuery.value = "";
  void nextTick(() => parentSearch.value?.focus());
}

function closeParentPicker() {
  const id = movingMenuId.value;
  movingMenuId.value = "";
  reveal(id, true);
}

function moveTo(parentId: string) {
  const menu = movingMenu.value;
  const destination = parentOptions.value.find(({ id }) => id === parentId);
  if (!menu?.parentId || !destination || props.saving) return;
  const menuIds = (draftChildren.value.get(parentId) ?? []).map(({ id }) => id);
  reorder(parentId, [...menuIds, menu.id], {
    id: menu.id,
    fromParentId: menu.parentId,
  });
  closeParentPicker();
}

function reorder(
  parentId: string | null,
  menuIds: string[],
  move?: MenuTreeMove,
) {
  if (
    props.saving ||
    (move && (!parentId || blockedParents.value.has(parentId)))
  )
    return;
  const positions = new Map(menuIds.map((id, index) => [id, index]));
  draft.value = draft.value
    .map((menu) => {
      const sortOrder = positions.get(menu.id);
      return sortOrder === undefined ? menu : { ...menu, parentId, sortOrder };
    })
    .sort((first, second) => first.sortOrder - second.sortOrder);
  if (move && parentId) {
    const menu = draftById.value.get(move.id);
    const parent = draftById.value.get(parentId);
    if (menu && parent)
      moveNotice.value = t("menus.moveMenuPending", {
        name: menuName(menu, locale.value),
        parent: menuName(parent, locale.value),
      });
    if (!movingMenuId.value) reveal(move.id);
  }
}

function neighbor(menu: MenuNode, offset: number) {
  const siblings = draftChildren.value.get(menu.parentId) ?? [];
  return siblings[siblings.findIndex(({ id }) => id === menu.id) + offset];
}

function move(menu: MenuNode, offset: number) {
  const sibling = neighbor(menu, offset);
  if (!sibling) return;
  const menuIds = (draftChildren.value.get(menu.parentId) ?? []).map(
    ({ id }) =>
      id === menu.id ? sibling.id : id === sibling.id ? menu.id : id,
  );
  reorder(menu.parentId, menuIds);
}

onMounted(() => reveal(props.selectedId));
</script>
