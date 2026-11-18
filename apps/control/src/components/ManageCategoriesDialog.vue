<template>
  <ModalPanel
    :open="open"
    :title="t('pages.catalog.categoryManager.title')"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="false"
    @close="!savingCategoryId && $emit('close')"
  >
    <p class="mb-5 mt-0 text-sm leading-6 text-black/50">
      {{ t("pages.catalog.categoryManager.description") }}
    </p>
    <Alert v-if="error" theme="red" :title="error" class="mb-4" />
    <Tree
      v-if="nodes.length"
      class="[&_.frappe-tree-row]:h-auto [&_.frappe-tree-row]:min-h-16"
      v-model:expanded="expanded"
      :nodes="nodes"
      :aria-label="t('pages.catalog.categoryManager.title')"
      guides="lines"
    >
      <template
        #item="{ node, level, hasChildren, expanded: isExpanded, toggle }"
      >
        <div class="flex w-full min-w-0 items-center gap-1" @click.stop>
          <Button
            v-if="hasChildren"
            variant="ghost"
            size="sm"
            icon="lucide-chevron-right"
            class="shrink-0 [&>span]:transition-transform"
            :class="{ '[&>span]:rotate-90': isExpanded }"
            :aria-label="
              t('pages.catalog.subcategoriesLabel', { name: node.label })
            "
            :aria-expanded="isExpanded"
            @click="toggle"
          />
          <span v-else class="w-7 shrink-0" aria-hidden="true" />
          <CategoryManagerRow
            class="min-w-0 flex-1"
            :category="categoryFromNode(node)"
            :count="counts[String(node.key)] || 0"
            :enable-en="enableEn"
            :enable-zh="enableZh"
            :saving="savingCategoryId === node.key"
            :hidden-by-parent="isHiddenByParent(categoryFromNode(node))"
            :compact="level > 1"
            @edit="$emit('edit', categoryFromNode(node))"
            @toggle="$emit('toggle', categoryFromNode(node), $event)"
          />
        </div>
      </template>
    </Tree>
    <div
      v-else
      class="grid min-h-60 place-items-center rounded-3xl border border-dashed border-black/15 bg-cream px-6 text-center"
    >
      <div>
        <span
          class="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-black/35"
          ><FolderOpen :size="24"
        /></span>
        <h3 class="mb-1 mt-4 text-lg font-extrabold">
          {{ t("pages.catalog.categoryManager.emptyTitle") }}
        </h3>
        <p class="m-0 text-sm text-black/45">
          {{ t("pages.catalog.categoryManager.emptyDescription") }}
        </p>
      </div>
    </div>
    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <Button
          variant="subtle"
          size="lg"
          type="button"
          class="min-h-11"
          :disabled="Boolean(savingCategoryId) || !categories.length"
          @click="$emit('reorder')"
        >
          <template #prefix><ArrowUpDown :size="17" /></template
          >{{ t("pages.catalog.categoryManager.reorder") }}
        </Button>
        <Button
          variant="solid"
          size="lg"
          type="button"
          class="min-h-11"
          :disabled="Boolean(savingCategoryId)"
          @click="$emit('add')"
        >
          <template #prefix><Plus :size="17" /></template
          >{{ t("pages.catalog.categoryManager.add") }}
        </Button>
      </div>
    </template>
  </ModalPanel>
</template>
<script setup lang="ts">
import { Alert, Button, Tree, type TreeKey } from "frappe-ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowUpDown, FolderOpen, Plus } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
import CategoryManagerRow from "./CategoryManagerRow.vue";
import type { Category } from "../stores/admin";
import { categoryFromNode, categoryTree } from "../utils/categoryTree";

const props = withDefaults(
  defineProps<{
    open: boolean;
    categories: Category[];
    counts: Record<string, number>;
    enableEn: boolean;
    enableZh: boolean;
    savingCategoryId?: string;
    error?: string;
  }>(),
  { savingCategoryId: "", error: "" },
);

defineEmits<{
  close: [];
  add: [];
  edit: [category: Category];
  reorder: [];
  toggle: [category: Category, active: boolean];
}>();

const { t } = useI18n();
const isActive = (category: Category) =>
  category.isActive !== 0 && category.isActive !== false;
const sorted = (categories: Category[]) =>
  [...categories].sort(
    (a, b) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      (a.nameKm || a.name).localeCompare(b.nameKm || b.name),
  );
const nodes = computed(() => categoryTree(sorted(props.categories)));
const categoriesById = computed(
  () => new Map(props.categories.map((entry) => [entry.id, entry])),
);
const expanded = ref<TreeKey[]>([]);

function isHiddenByParent(category: Category) {
  const seen = new Set<string>();
  let ancestorId = category.parentId;
  while (ancestorId && !seen.has(ancestorId)) {
    seen.add(ancestorId);
    const ancestor = categoriesById.value.get(ancestorId);
    if (!ancestor) return false;
    if (!isActive(ancestor)) return true;
    ancestorId = ancestor.parentId;
  }
  return false;
}

watch(
  () => props.open,
  (open) => {
    if (open)
      expanded.value = [
        ...new Set(
          props.categories.flatMap((item) =>
            item.parentId ? [item.parentId] : [],
          ),
        ),
      ];
  },
  { immediate: true },
);
</script>
