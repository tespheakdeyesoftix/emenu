<template>
  <ModalPanel
    :open="open"
    title="រៀបលំដាប់ប្រភេទ"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="false"
    @close="!saving && $emit('close')"
  >
    <p class="mb-4 mt-0 text-sm text-ink-gray-6">
      អូសប្រភេទតាមលំដាប់ដែលអ្នកចង់ឱ្យភ្ញៀវឃើញ។
      ប្រភេទរងត្រូវបានរៀបក្នុងប្រភេទមេរបស់វា។
    </p>
    <Tree
      v-model:expanded="expanded"
      :nodes="nodes"
      :draggable="!saving"
      :disabled="saving"
      :move="canDrop"
      guides="lines"
      aria-label="រៀបលំដាប់ប្រភេទ"
      @drag-end="finishDrag"
    >
      <template #item="{ node, hasChildren, expanded: isExpanded, toggle }">
        <div class="flex w-full min-w-0 items-center gap-1" @click.stop>
          <Button
            v-if="hasChildren"
            variant="ghost"
            size="sm"
            icon="lucide-chevron-right"
            :aria-label="
              t('pages.catalog.subcategoriesLabel', { name: node.label })
            "
            :aria-expanded="isExpanded"
            :class="{ '[&>span]:rotate-90': isExpanded }"
            :disabled="saving"
            @click="toggle"
          />
          <span v-else class="w-7 shrink-0" aria-hidden="true" />
          <GripVertical
            :size="16"
            class="shrink-0 text-ink-gray-5"
            aria-hidden="true"
          />
          <span
            class="min-w-0 flex-1 py-2 text-sm font-medium [overflow-wrap:anywhere]"
          >
            {{ node.label }}
          </span>
          <Button
            v-for="step in steps"
            :key="step.offset"
            variant="ghost"
            size="sm"
            :icon="step.icon"
            :aria-label="t(step.label, { name: node.label })"
            :disabled="saving || !canMove(categoryFromNode(node), step.offset)"
            @click="moveBy(categoryFromNode(node), step.offset)"
          />
        </div>
      </template>
      <template #empty>
        <p
          class="rounded-5 bg-surface-gray-2 p-5 text-center text-sm text-ink-gray-6"
        >
          មិនទាន់មានប្រភេទមេទេ។
        </p>
      </template>
    </Tree>

    <Alert v-if="error" theme="red" :title="error" class="mb-0 mt-4" />
    <template #footer>
      <Button
        variant="solid"
        size="lg"
        class="w-full"
        icon-left="lucide-save"
        :loading="saving"
        :disabled="!draft.length"
        @click="save"
      >
        រក្សាទុកលំដាប់ប្រភេទ
      </Button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import {
  Alert,
  Button,
  Tree,
  type DropInfo,
  type MoveContext,
  type TreeKey,
} from "frappe-ui";
import { GripVertical } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Category, SortOrderItem } from "../stores/admin";
import { categoryFromNode, categoryTree } from "../utils/categoryTree";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  open: boolean;
  categories: Category[];
  saving: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  close: [];
  save: [items: SortOrderItem[]];
}>();

const { t } = useI18n();
const draft = ref<Category[]>([]);
const expanded = ref<TreeKey[]>([]);
const nodes = computed(() => categoryTree(draft.value));
const steps = [
  { offset: -1, icon: "lucide-arrow-up", label: "menus.moveUp" },
  { offset: 1, icon: "lucide-arrow-down", label: "menus.moveDown" },
] as const;

const parentOf = (item: Category) => item.parentId || null;
const siblingsOf = (item: Category) =>
  draft.value.filter((candidate) => parentOf(candidate) === parentOf(item));

function canDrop({ node, target, position }: MoveContext) {
  return (
    position !== "inside" &&
    parentOf(categoryFromNode(node)) === parentOf(categoryFromNode(target))
  );
}

function finishDrag(drop: DropInfo | null) {
  if (drop && drop.from === drop.to && drop.position !== "inside") {
    moveBy(categoryFromNode(drop.node), drop.newIndex - drop.oldIndex);
  }
}

function canMove(item: Category, offset: number) {
  const siblings = siblingsOf(item);
  const index = siblings.findIndex(({ id }) => id === item.id);
  const target = index + offset;
  return index >= 0 && target >= 0 && target < siblings.length;
}

function moveBy(item: Category, offset: number) {
  if (props.saving || !offset || !canMove(item, offset)) return;
  const siblings = siblingsOf(item);
  const index = siblings.findIndex(({ id }) => id === item.id);
  siblings.splice(index, 1);
  siblings.splice(index + offset, 0, item);
  let next = 0;
  draft.value = draft.value.map((candidate) =>
    parentOf(candidate) === parentOf(item) ? siblings[next++] : candidate,
  );
}

function save() {
  const positions = new Map<string | null, number>();
  emit(
    "save",
    draft.value.map((item) => {
      const parent = parentOf(item);
      const sortOrder = positions.get(parent) ?? 0;
      positions.set(parent, sortOrder + 1);
      return { id: item.id, sortOrder };
    }),
  );
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    draft.value = [...props.categories].sort(
      (a, b) =>
        Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
        (a.nameKm || a.name).localeCompare(b.nameKm || b.name),
    );
    expanded.value = [
      ...new Set(
        draft.value.flatMap((item) => (item.parentId ? [item.parentId] : [])),
      ),
    ];
  },
  { immediate: true },
);
</script>
