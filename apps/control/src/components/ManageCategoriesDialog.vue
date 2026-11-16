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
    <div
      v-if="error"
      role="alert"
      class="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
    >
      {{ error }}
    </div>
    <div v-if="topCategories.length" class="space-y-3">
      <section
        v-for="parent in topCategories"
        :key="parent.id"
        class="overflow-hidden rounded-2xl border border-black/[.08] bg-white"
      >
        <CategoryManagerRow
          :category="parent"
          :count="counts[parent.id] || 0"
          :enable-en="enableEn"
          :enable-zh="enableZh"
          :saving="savingCategoryId === parent.id"
          @edit="$emit('edit', parent)"
          @toggle="$emit('toggle', parent, $event)"
        />
        <div
          v-if="childrenFor(parent.id).length"
          class="border-t border-black/[.07] bg-cream/60 py-1 pl-5"
        >
          <div
            v-for="child in childrenFor(parent.id)"
            :key="child.id"
            class="border-l border-black/10 pl-3"
          >
            <CategoryManagerRow
              :category="child"
              :count="counts[child.id] || 0"
              :enable-en="enableEn"
              :enable-zh="enableZh"
              :saving="savingCategoryId === child.id"
              :hidden-by-parent="!isActive(parent)"
              compact
              @edit="$emit('edit', child)"
              @toggle="$emit('toggle', child, $event)"
            />
          </div>
        </div>
      </section>
    </div>
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
        <button
          type="button"
          class="btn-soft min-h-11"
          :disabled="Boolean(savingCategoryId) || !categories.length"
          @click="$emit('reorder')"
        >
          <ArrowUpDown :size="17" />{{
            t("pages.catalog.categoryManager.reorder")
          }}
        </button>
        <button
          type="button"
          class="btn-primary min-h-11"
          :disabled="Boolean(savingCategoryId)"
          @click="$emit('add')"
        >
          <Plus :size="17" />{{ t("pages.catalog.categoryManager.add") }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowUpDown, FolderOpen, Plus } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
import CategoryManagerRow from "./CategoryManagerRow.vue";
import type { Category } from "../stores/admin";

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
const topCategories = computed(() =>
  sorted(props.categories.filter((item) => !item.parentId)),
);
const childrenFor = (parentId: string) =>
  sorted(props.categories.filter((item) => item.parentId === parentId));
</script>
