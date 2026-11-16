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
      <select v-model="selectedCategoryId" class="input">
        <option
          v-for="item in orderedCategories"
          :key="item.id"
          :value="item.id"
        >
          {{ categoryLabel(item) }}
        </option>
      </select>
    </label>

    <draggable
      v-model="items"
      item-key="id"
      handle=".drag-handle"
      :animation="180"
      ghost-class="opacity-30"
      class="mt-5 space-y-2"
    >
      <template #item="{ element, index }">
        <div
          class="flex items-center gap-3 rounded-2xl border border-black/[.08] bg-cream p-3"
        >
          <button
            type="button"
            class="drag-handle grid size-10 shrink-0 cursor-grab place-items-center rounded-xl bg-white active:cursor-grabbing"
            :aria-label="`អូស ${displayName(element)}`"
          >
            <GripVertical :size="19" />
          </button>
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white"
          >
            {{ index + 1 }}
          </span>
          <MenuProductThumbnail
            :src="element.imageUrl || element.images?.[0]?.url || ''"
            class="size-12 rounded-xl"
          />
          <div class="min-w-0 flex-1">
            <strong class="block truncate text-sm">{{
              displayName(element)
            }}</strong>
            <small v-if="element.code" class="block truncate text-black/40">{{
              element.code
            }}</small>
          </div>
        </div>
      </template>
    </draggable>

    <p
      v-if="!items.length"
      class="mt-5 rounded-2xl bg-cream p-6 text-center text-sm text-black/40"
    >
      ប្រភេទនេះមិនមានមុខម្ហូបសម្រាប់រៀបលំដាប់ទេ។
    </p>
    <p v-if="error" class="mb-0 mt-4 text-xs font-bold text-red-600">
      {{ error }}
    </p>
    <template #footer>
      <button
        class="btn-primary w-full"
        :disabled="saving || !selectedCategoryId || !items.length"
        @click="save"
      >
        <Save :size="16" />{{
          saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកលំដាប់មុខម្ហូប"
        }}
      </button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import draggable from "vuedraggable";
import { GripVertical, Save } from "lucide-vue-next";
import MenuProductThumbnail from "./MenuProductThumbnail.vue";
import ModalPanel from "./ModalPanel.vue";
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
