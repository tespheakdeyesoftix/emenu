<template>
  <ModalPanel
    :open="open"
    title="រៀបលំដាប់មុខម្ហូប"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="false"
    @close="!saving && $emit('close')"
  >
    <p class="mb-4 mt-0 text-sm text-black/50">
      ជ្រើសប្រភេទ រួចអូសមុខម្ហូបតាមលំដាប់ដែលអ្នកចង់ឱ្យភ្ញៀវឃើញ។
    </p>
    <label>
      <span class="label">ប្រភេទ</span>
      <Select
        size="lg"
        variant="outline"
        v-model="selectedCategoryId"
        :options="[...orderedCategories.map(item => ({ label: categoryLabel(item), value: item.id }))]"
      />
    </label>

    <SortableProductList
      v-model="items"
      label="រៀបលំដាប់មុខម្ហូប"
      :disabled="saving"
      row-class="!flex min-w-0 items-center gap-3 rounded-5 border border-outline-gray-1 bg-surface-gray-1 p-3"
      class="mt-5 space-y-2"
    >
      <template #item="{ product, index }">
        <Icon name="lucide-grip-vertical" class="size-5 shrink-0 cursor-grab touch-none text-ink-gray-6" data-sort-handle />
        <Badge :label="index + 1" />
        <MenuProductThumbnail
          :src="product.imageUrl || product.images?.[0]?.url || ''"
          class="size-12 rounded-xl"
        />
        <div class="min-w-0 flex-1">
          <strong class="block truncate text-sm">{{ displayName(product) }}</strong>
          <small v-if="product.code" class="block truncate text-ink-gray-6">{{ product.code }}</small>
        </div>
        <Button
          variant="ghost"
          icon="lucide-arrow-up"
          :aria-label="t('menus.moveUp', { name: displayName(product) })"
          :disabled="saving || index === 0"
          @click="move(index, -1)"
        />
        <Button
          variant="ghost"
          icon="lucide-arrow-down"
          :aria-label="t('menus.moveDown', { name: displayName(product) })"
          :disabled="saving || index === items.length - 1"
          @click="move(index, 1)"
        />
      </template>
    </SortableProductList>

    <p
      v-if="!items.length"
      class="mt-5 rounded-2xl bg-cream p-6 text-center text-sm text-black/40"
    >
      ប្រភេទនេះមិនមានមុខម្ហូបសម្រាប់រៀបលំដាប់ទេ។
    </p>
    <Alert v-if="error" theme="red" :title="error" class="mb-0 mt-4" />
    <template #footer>
      <Button variant="solid" size="lg"
        class="w-full"
        :disabled="saving || !selectedCategoryId || !items.length"
        @click="save"
      >
        <template #prefix><Save :size="16" /></template>{{
          saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកលំដាប់មុខម្ហូប"
        }}
      </Button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { Alert, Badge, Button, Icon, Select } from "frappe-ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Save } from "lucide-vue-next";
import MenuProductThumbnail from "./MenuProductThumbnail.vue";
import ModalPanel from "./ModalPanel.vue";
import SortableProductList from "./SortableProductList.vue";
import type { Category, Product, SortOrderItem } from "../stores/admin";

const props = defineProps<{
  open: boolean;
  categories: Category[];
  products: Product[];
  saving: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  close: [];
  save: [categoryId: string, items: SortOrderItem[]];
}>();

const { t } = useI18n();
const selectedCategoryId = ref("");
const items = ref<Product[]>([]);
const orderedCategories = computed(() =>
  [...props.categories].sort((a, b) => {
    if (Boolean(a.parentId) !== Boolean(b.parentId)) return a.parentId ? 1 : -1;
    return (
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      (a.nameKm || a.name).localeCompare(b.nameKm || b.name)
    );
  }),
);
const displayName = (item: Product) => item.nameKm || item.name;
const categoryLabel = (item: Category) => {
  const parent = item.parentId
    ? props.categories.find((category) => category.id === item.parentId)
    : null;
  return `${parent ? `${parent.nameKm || parent.name} / ` : ""}${item.nameKm || item.name}`;
};

function resetItems() {
  items.value = props.products
    .filter((item) => item.categoryId === selectedCategoryId.value)
    .sort(
      (a, b) =>
        Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
        displayName(a).localeCompare(displayName(b)),
    );
}

function move(index: number, offset: number) {
  const [product] = items.value.splice(index, 1);
  items.value.splice(index + offset, 0, product);
}

function save() {
  emit(
    "save",
    selectedCategoryId.value,
    items.value.map((item, index) => ({ id: item.id, sortOrder: index })),
  );
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    const currentExists = props.categories.some(
      (item) => item.id === selectedCategoryId.value,
    );
    if (!currentExists) {
      selectedCategoryId.value =
        props.categories.find((item) =>
          props.products.some((product) => product.categoryId === item.id),
        )?.id ||
        props.categories[0]?.id ||
        "";
    }
    resetItems();
  },
  { immediate: true },
);
watch(selectedCategoryId, resetItems);
</script>
