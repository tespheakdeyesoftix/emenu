<template>
  <ModalPanel
    :open="true"
    :title="
      assignProductName
        ? t('menus.assignProductToMenus', { name: assignProductName })
        : t('menus.choose')
    "
    :close-on-backdrop="!saving"
    @close="!saving && emit('close')"
  >
    <label class="mb-3 block">
      <span class="sr-only">{{ t("menus.searchMenus") }}</span>
      <TextInput
        size="lg"
        variant="outline"
        ref="searchInput"
        v-model="search"
        type="search"
        :placeholder="t('menus.searchMenus')"
      />
    </label>
    <LoadingText v-if="loading" :text="t('common.loading')" role="status" />
    <Alert v-else-if="error" theme="red" :title="error" />
    <p v-else-if="!options.length">{{ t("menus.empty") }}</p>
    <Alert v-else-if="assignProductName && !hasAssignableMenus" :title="t('menus.noAssignableMenus')" />
    <Alert v-else-if="!nodes.length" :title="t('menus.noMatchingMenus')" />
    <Tree
      v-else
      v-model:expanded="expanded"
      :nodes="nodes"
      guides="lines"
      :aria-label="t('menus.choose')"
    >
      <template #item-label="{ node }">
        <div @click.stop @keydown.space.stop @keydown.enter.stop>
          <Checkbox
            :label="node.label"
            :model-value="draft.includes(String(node.key))"
            :disabled="saving || Boolean(node.disabled)"
            @update:model-value="
              toggleAssignment(String(node.key), Boolean($event))
            "
          />
        </div>
      </template>
      <template #item-suffix="{ node }">
        <Badge v-if="node.badge" size="sm" :label="String(node.badge)" />
        <Badge
          v-if="!node.active"
          size="sm"
          theme="amber"
          :label="t('menus.hidden')"
        />
      </template>
    </Tree>
    <Alert v-if="saveError" theme="red" :title="saveError" class="mb-0 mt-3" />
    <template #footer>
      <Button
        variant="solid"
        size="lg"
        type="button"
        :disabled="
          loading || !!error || saving || (!!assignProductName && !draft.length)
        "
        @click="save"
      >
        {{
          t(
            saving
              ? "common.saving"
              : assignProductName
                ? "menus.assignMenus"
                : "common.save",
          )
        }}
      </Button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import {
  LoadingText,
  Alert,
  Badge,
  Button,
  Checkbox,
  TextInput,
  Tree,
  type TreeKey,
  type TreeNode,
} from "frappe-ui";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAdminStore } from "../stores/admin";
import { menuName, menuTree, type MenuNode } from "../types/menu";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  selectedIds: string[];
  assignProductName?: string;
  rootId?: string;
  saving?: boolean;
  saveError?: string;
}>();
const emit = defineEmits<{
  close: [];
  save: [ids: string[], localIds: string[]];
}>();
const { t, locale } = useI18n();
const store = useAdminStore();
const options = ref<MenuNode[]>([]);
const draft = ref<string[]>([]);
const loading = ref(true);
const error = ref("");
const search = ref("");
const searchInput = ref<InstanceType<typeof TextInput>>();
const collapsed = ref(new Set<string>());

const scopedTree = computed(() => {
  const tree = menuTree(options.value);
  if (!props.rootId) return tree;
  const sectionIds = new Set([props.rootId]);
  return tree.filter(({ menu }) => {
    if (menu.parentId && sectionIds.has(menu.parentId)) sectionIds.add(menu.id);
    return sectionIds.has(menu.id);
  });
});
const hasAssignableMenus = computed(() =>
  scopedTree.value.some(({ menu, active }) => canAssign(menu, active)),
);
const matchingRows = computed(() => {
  const tree = scopedTree.value;
  const menusById = new Map(options.value.map((menu) => [menu.id, menu]));
  const term = search.value.trim().toLowerCase();
  const matchingIds = new Set<string>();
  for (const { menu, active } of tree) {
    if (
      menu.parentId &&
      !props.selectedIds.includes(menu.id) &&
      !canAssign(menu, active)
    )
      continue;
    const lineage: MenuNode[] = [];
    for (
      let node: MenuNode | undefined = menu;
      node;
      node = menusById.get(node.parentId ?? "")
    )
      lineage.push(node);
    if (
      !term ||
      lineage.some(({ nameKm, nameEn, nameZh, slug }) =>
        [nameKm, nameEn, nameZh, slug].some((name) =>
          name?.toLowerCase().includes(term),
        ),
      )
    ) {
      for (const node of lineage) matchingIds.add(node.id);
    }
  }
  return tree.filter(({ menu }) => matchingIds.has(menu.id));
});
const nodes = computed(() => {
  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const { menu, active } of matchingRows.value) {
    const node: TreeNode = {
      key: menu.id,
      label: menuName(menu, locale.value),
      active,
      disabled:
        !menu.parentId ||
        menu.source === "pos" ||
        (!active &&
          (!!props.assignProductName || !props.selectedIds.includes(menu.id))),
      badge: !menu.parentId
        ? t("menus.qrIdentityOnly")
        : menu.source === "pos"
          ? t("menus.posManaged")
          : "",
      children: [],
    };
    byId.set(menu.id, node);
    const parent = menu.parentId ? byId.get(menu.parentId) : null;
    if (parent) parent.children?.push(node);
    else roots.push(node);
  }
  return roots;
});
const branchIds = computed(() =>
  matchingRows.value.flatMap(({ menu }) =>
    menu.parentId ? [menu.parentId] : [],
  ),
);
const expanded = computed<TreeKey[]>({
  get: () =>
    [...new Set(branchIds.value)].filter((id) => !collapsed.value.has(id)),
  set: (ids) => {
    collapsed.value = new Set(
      branchIds.value.filter((id) => !ids.includes(id)),
    );
  },
});

watch(search, () => collapsed.value.clear());

function toggleAssignment(id: string, checked: boolean) {
  if (checked && !draft.value.includes(id)) draft.value = [...draft.value, id];
  if (!checked)
    draft.value = draft.value.filter((selectedId) => selectedId !== id);
}

function canAssign(menu: MenuNode, active: boolean) {
  return Boolean(menu.parentId) && active && menu.source === "local";
}

function save() {
  if (props.saving || (props.assignProductName && !draft.value.length)) return;
  const localIds = new Set(
    options.value
      .filter((menu) => menu.parentId && menu.source === "local")
      .map(({ id }) => id),
  );
  emit(
    "save",
    draft.value,
    draft.value.filter((id) => localIds.has(id)),
  );
}

onMounted(async () => {
  searchInput.value?.focus();
  try {
    const result = await store.request("/api/admin/menus");
    options.value = result.menus;
    const sectionIds = new Set(
      options.value.filter((menu) => menu.parentId).map(({ id }) => id),
    );
    draft.value = props.selectedIds.filter((id) => sectionIds.has(id));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
});
</script>
