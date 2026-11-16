<template>
  <ModalPanel
    :open="true"
    :title="assignProductName ? t('menus.assignProductToMenus', { name: assignProductName }) : t('menus.choose')"
    :close-on-backdrop="!saving"
    @close="!saving && emit('close')"
  >
    <label class="mb-3 block">
      <span class="sr-only">{{ t("menus.searchMenus") }}</span>
      <input
        ref="searchInput"
        v-model="search"
        type="search"
        class="input"
        :placeholder="t('menus.searchMenus')"
      />
    </label>
    <p v-if="loading" role="status">{{ t("common.loading") }}</p>
    <p v-else-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-else-if="!options.length">{{ t("menus.empty") }}</p>
    <p v-else-if="assignProductName && !hasAssignableMenus" role="status">
      {{ t("menus.noAssignableMenus") }}
    </p>
    <p v-else-if="!rows.length" role="status">{{ t("menus.noMatchingMenus") }}</p>
    <div v-else class="space-y-1">
      <div
        v-for="{ menu, depth, active } in rows"
        :key="menu.id"
        class="flex items-center gap-2 rounded-lg py-1"
        :style="{ paddingInlineStart: `${Math.min(depth, 7) * 16}px` }"
      >
        <button
          v-if="parentIds.has(menu.id)"
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-cream"
          :aria-expanded="!collapsed.has(menu.id)"
          :aria-label="t('menus.submenusOf', { name: menuName(menu, locale) })"
          @click="toggleMenu(menu.id)"
        >
          <ChevronRight
            :size="16"
            aria-hidden="true"
            :class="{ 'rotate-90': !collapsed.has(menu.id) }"
          />
        </button>
        <span v-else class="size-8 shrink-0" aria-hidden="true"></span>
        <label class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-1">
          <input
            v-model="draft"
            type="checkbox"
            :value="menu.id"
            :disabled="saving || !menu.parentId || menu.source === 'pos' ||
              (!active && (!!assignProductName || !selectedIds.includes(menu.id)))"
          />
          <span>{{ menuName(menu, locale) }}</span>
          <span v-if="!menu.parentId" class="text-xs text-black/50">{{ t("menus.qrIdentityOnly") }}</span>
          <span v-else-if="menu.source === 'pos'" class="text-xs text-black/50">{{ t("menus.posManaged") }}</span>
          <span v-if="!active" class="text-xs text-black/50">{{ t("menus.hidden") }}</span>
        </label>
      </div>
    </div>
    <p v-if="saveError" class="mb-0 mt-3 text-sm text-red-700" role="alert">
      {{ saveError }}
    </p>
    <template #footer>
      <button
        type="button"
        class="btn-primary"
        :disabled="loading || !!error || saving || (!!assignProductName && !draft.length)"
        @click="save"
      >
        {{ t(saving ? "common.saving" : assignProductName ? "menus.assignMenus" : "common.save") }}
      </button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAdminStore } from "../stores/admin";
import { expandedMenuRows, menuName, menuTree, type MenuNode } from "../types/menu";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  selectedIds: string[];
  assignProductName?: string;
  rootId?: string;
  saving?: boolean;
  saveError?: string;
}>();
const emit = defineEmits<{ close: []; save: [ids: string[], localIds: string[]] }>();
const { t, locale } = useI18n();
const store = useAdminStore();
const options = ref<MenuNode[]>([]);
const draft = ref<string[]>([]);
const loading = ref(true);
const error = ref("");
const search = ref("");
const searchInput = ref<HTMLInputElement>();
const collapsed = reactive(new Set<string>());

const scopedTree = computed(() => {
  const tree = menuTree(options.value);
  if (!props.rootId) return tree;
  const sectionIds = new Set([props.rootId]);
  return tree.filter(({ menu }) => {
    if (menu.parentId && sectionIds.has(menu.parentId)) sectionIds.add(menu.id);
    return sectionIds.has(menu.id);
  });
});
const hasAssignableMenus = computed(
  () => scopedTree.value.some(({ menu, active }) => canAssign(menu, active)),
);
const matchingRows = computed(() => {
  const tree = scopedTree.value;
  const menusById = new Map(options.value.map((menu) => [menu.id, menu]));
  const term = search.value.trim().toLowerCase();
  const matchingIds = new Set<string>();
  for (const { menu, active } of tree) {
    if (menu.parentId && !props.selectedIds.includes(menu.id) && !canAssign(menu, active))
      continue;
    const lineage: MenuNode[] = [];
    for (let node: MenuNode | undefined = menu; node; node = menusById.get(node.parentId ?? ""))
      lineage.push(node);
    if (
      !term ||
      lineage.some(({ nameKm, nameEn, nameZh, slug }) =>
        [nameKm, nameEn, nameZh, slug].some((name) => name?.toLowerCase().includes(term)),
      )
    ) {
      for (const node of lineage) matchingIds.add(node.id);
    }
  }
  return tree.filter(({ menu }) => matchingIds.has(menu.id));
});
const parentIds = computed(() => new Set(matchingRows.value.map(({ menu }) => menu.parentId)));
const rows = computed(() => expandedMenuRows(matchingRows.value, collapsed));
watch(search, () => collapsed.clear());

function toggleMenu(id: string) {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
}

function canAssign(menu: MenuNode, active: boolean) {
  return Boolean(menu.parentId) && active && menu.source === "local";
}

function save() {
  if (props.saving || (props.assignProductName && !draft.value.length)) return;
  const localIds = new Set(
    options.value.filter((menu) => menu.parentId && menu.source === "local").map(({ id }) => id),
  );
  emit("save", draft.value, draft.value.filter((id) => localIds.has(id)));
}

onMounted(async () => {
  searchInput.value?.focus();
  try {
    const result = await store.request("/api/admin/menus");
    options.value = result.menus;
    const sectionIds = new Set(options.value.filter((menu) => menu.parentId).map(({ id }) => id));
    draft.value = props.selectedIds.filter((id) => sectionIds.has(id));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
});
</script>
