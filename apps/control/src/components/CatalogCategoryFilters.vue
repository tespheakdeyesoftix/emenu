<template>
  <Tree
    class="[--tree-indent:0.625rem] [&_.frappe-tree-row]:h-auto [&_.frappe-tree-row]:min-h-11"
    guides="lines"
    :aria-label="t('pages.catalog.categoryFilterLabel')"
    :nodes="nodes"
    :expanded="expandedIds"
    @update:expanded="$emit('update:expandedIds', $event.map(String))"
  >
    <template #item="{ node, level, hasChildren, expanded, toggle }">
      <div class="flex w-full min-w-0 items-center gap-1" @click.stop>
        <Button
          variant="ghost"
          v-if="hasChildren"
          type="button"
          class="grid shrink-0 place-items-center rounded-full text-black/60 transition hover:bg-cream hover:text-ink"
          :class="editable ? 'h-8 w-6' : 'size-11 bg-cream'"
          :aria-expanded="expanded"
          :aria-label="
            t('pages.catalog.subcategoriesLabel', { name: node.label })
          "
          @click="toggle"
        >
          <template #icon
            ><ChevronRight
              :size="17"
              class="transition-transform"
              :class="{ 'rotate-90': expanded }"
              aria-hidden="true"
          /></template>
        </Button>
        <span
          v-else
          class="shrink-0"
          :class="editable ? 'w-6' : 'w-11'"
          aria-hidden="true"
        />
        <Button
          :variant="
            selectedId === node.key ? 'solid' : editable ? 'ghost' : 'subtle'
          "
          type="button"
          class="admin-row-button !h-auto min-w-0 flex-1 !shrink !justify-start !whitespace-normal text-start"
          :class="level > 1 ? 'min-h-11 py-1.5' : 'min-h-14 py-2'"
          :aria-pressed="selectedId === String(node.key)"
          :title="node.label"
          @click="$emit('select', String(node.key))"
        >
          <FallbackImage
            v-if="level === 1"
            :src="categoryFromNode(node).imageUrl"
            alt=""
            loading="lazy"
            decoding="async"
            class="size-6 shrink-0 rounded-md object-cover"
          />
          <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <strong class="block text-sm leading-snug">
              {{ node.label }}
            </strong>
            <small
              v-if="
                (enableEn && categoryFromNode(node).nameEn) ||
                (enableZh && categoryFromNode(node).nameZh)
              "
              class="mt-0.5 block text-[11px] opacity-70"
            >
              <span v-if="enableEn">{{ categoryFromNode(node).nameEn }}</span>
              <span
                v-if="
                  enableEn &&
                  categoryFromNode(node).nameEn &&
                  enableZh &&
                  categoryFromNode(node).nameZh
                "
              >
                ·
              </span>
              <span v-if="enableZh">{{ categoryFromNode(node).nameZh }}</span>
            </small>
            <small
              v-if="
                categoryFromNode(node).isActive === 0 ||
                categoryFromNode(node).isActive === false
              "
              class="mt-0.5 block text-[11px] opacity-70"
            >
              {{ t("pages.catalog.categoryManager.hidden") }}
            </small>
          </span>
          <Badge :class="
              selectedId === String(node.key)
                ? 'bg-white/10'
                : 'bg-black/[.06] text-black/60'
            " class="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">{{ counts[String(node.key)] || 0 }}</Badge>
          <Check
            v-if="!editable && selectedId === String(node.key)"
            :size="16"
            class="shrink-0"
            aria-hidden="true"
          />
        </Button>
        <MenuActionPopover
          v-if="editable"
          v-slot="{ close }"
          compact
          :label="t('common.actionsFor', { name: node.label })"
        >
          <Button
            variant="ghost"
            type="button"
            @click="
              close();
              $emit('edit', categoryFromNode(node));
            "
          >
            <template #prefix><Pencil :size="16" aria-hidden="true" /></template
            >{{ t("common.edit") }}
          </Button>
          <Button
            variant="ghost"
            type="button"
            @click="
              close();
              $emit('addSubcategory', categoryFromNode(node));
            "
          >
            <template #prefix
              ><FolderPlus :size="16" aria-hidden="true" /></template
            >{{ t("pages.catalog.categoryManager.addSubcategory") }}
          </Button>
          <Button
            variant="ghost"
            type="button"
            class="text-red-700"
            :disabled="hasChildren || counts[String(node.key)] > 0"
            @click="
              close();
              $emit('delete', categoryFromNode(node));
            "
          >
            <template #prefix><Trash2 :size="16" aria-hidden="true" /></template
            >{{ t("pages.catalog.categoryManager.deleteAction") }}
          </Button>
          <p
            v-if="hasChildren || counts[String(node.key)] > 0"
            class="m-0 px-3 pb-2 text-xs text-black/60"
          >
            {{ t("pages.catalog.categoryManager.deleteEmptyOnly") }}
          </p>
        </MenuActionPopover>
      </div>
    </template>
  </Tree>
</template>

<script setup lang="ts">
import { Badge, Button, Tree } from "frappe-ui";
import { computed } from "vue";
import {
  Check,
  ChevronRight,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import type { Category } from "../stores/admin";
import { categoryFromNode, categoryTree } from "../utils/categoryTree";
import MenuActionPopover from "./MenuActionPopover.vue";

const props = defineProps<{
  categories: Category[];
  expandedIds: string[];
  counts: Record<string, number>;
  selectedId: string;
  enableEn?: boolean;
  enableZh?: boolean;
  editable?: boolean;
}>();

defineEmits<{
  select: [id: string];
  "update:expandedIds": [ids: string[]];
  edit: [category: Category];
  addSubcategory: [category: Category];
  delete: [category: Category];
}>();

const { t } = useI18n();
const nodes = computed(() => categoryTree(props.categories));
</script>
