<template>
  <ModalPanel
    :open="open"
    title="រៀបលំដាប់ប្រភេទ"
    size="large"
    mobile-fullscreen
    :close-on-backdrop="false"
    @close="!saving && $emit('close')"
  >
    <p class="mb-5 mt-0 text-sm text-black/50">
      អូសប្រភេទតាមលំដាប់ដែលអ្នកចង់ឱ្យភ្ញៀវឃើញ។
      ប្រភេទរងត្រូវបានរៀបក្នុងប្រភេទមេរបស់វា។
    </p>

    <div class="grid gap-5 lg:grid-cols-2">
      <section>
        <h3 class="mb-2 mt-0 text-sm font-extrabold">ប្រភេទមេ</h3>
        <draggable
          v-model="topItems"
          item-key="id"
          handle=".drag-handle"
          :animation="180"
          ghost-class="opacity-30"
          class="space-y-2"
        >
          <template #item="{ element, index }">
            <div
              class="flex items-center gap-3 rounded-2xl border border-black/[.08] bg-cream p-3"
            >
              <button
                type="button"
                class="drag-handle grid size-9 shrink-0 cursor-grab place-items-center rounded-xl bg-white active:cursor-grabbing"
                :aria-label="`អូស ${displayName(element)}`"
              >
                <GripVertical :size="18" />
              </button>
              <span
                class="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white"
              >
                {{ index + 1 }}
              </span>
              <FallbackImage
                v-if="element.imageUrl"
                :src="element.imageUrl"
                alt=""
                loading="lazy"
                decoding="async"
                class="size-10 shrink-0 rounded-xl object-cover"
              >
                <template #fallback>
                  <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-black/35" aria-hidden="true">
                    <Folder :size="18" />
                  </span>
                </template>
              </FallbackImage>
              <div class="min-w-0 flex-1">
                <strong class="block truncate text-sm">{{
                  displayName(element)
                }}</strong>
                <small
                  v-if="element.nameEn"
                  class="block truncate text-black/40"
                  >{{ element.nameEn }}</small
                >
              </div>
            </div>
          </template>
        </draggable>
        <p
          v-if="!topItems.length"
          class="rounded-2xl bg-cream p-5 text-center text-sm text-black/40"
        >
          មិនទាន់មានប្រភេទមេទេ។
        </p>
      </section>

      <section class="space-y-4">
        <div v-for="group in childGroups" :key="group.parent.id">
          <h3 class="mb-2 mt-0 text-sm font-extrabold">
            ប្រភេទរងរបស់ {{ displayName(group.parent) }}
          </h3>
          <draggable
            v-model="group.items"
            item-key="id"
            handle=".drag-handle"
            :animation="180"
            ghost-class="opacity-30"
            class="space-y-2"
          >
            <template #item="{ element, index }">
              <div
                class="flex items-center gap-3 rounded-2xl border border-black/[.08] bg-cream p-3"
              >
                <button
                  type="button"
                  class="drag-handle grid size-9 shrink-0 cursor-grab place-items-center rounded-xl bg-white active:cursor-grabbing"
                  :aria-label="`អូស ${displayName(element)}`"
                >
                  <GripVertical :size="18" />
                </button>
                <span
                  class="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold"
                >
                  {{ index + 1 }}
                </span>
                <strong class="min-w-0 flex-1 truncate text-sm">{{
                  displayName(element)
                }}</strong>
              </div>
            </template>
          </draggable>
        </div>
        <p
          v-if="!childGroups.length"
          class="rounded-2xl bg-cream p-5 text-center text-sm text-black/40"
        >
          មិនមានប្រភេទរងសម្រាប់រៀបលំដាប់ទេ។
        </p>
      </section>
    </div>

    <p v-if="error" class="mb-0 mt-4 text-xs font-bold text-red-600">
      {{ error }}
    </p>
    <template #footer>
      <button
        class="btn-primary w-full"
        :disabled="saving || !categories.length"
        @click="save"
      >
        <Save :size="16" />{{
          saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកលំដាប់ប្រភេទ"
        }}
      </button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import draggable from "vuedraggable";
import { Folder, GripVertical, Save } from "lucide-vue-next";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import ModalPanel from "./ModalPanel.vue";
import type { Category, SortOrderItem } from "../stores/admin";

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

const topItems = ref<Category[]>([]);
const childGroups = ref<Array<{ parent: Category; items: Category[] }>>([]);
const sortItems = (items: Category[]) =>
  [...items].sort(
    (a, b) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      (a.nameKm || a.name).localeCompare(b.nameKm || b.name),
  );
const displayName = (item: Category) => item.nameKm || item.name;

function resetLists() {
  topItems.value = sortItems(props.categories.filter((item) => !item.parentId));
  childGroups.value = sortItems(props.categories)
    .map((parent) => ({
      parent,
      items: sortItems(
        props.categories.filter((item) => item.parentId === parent.id),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function save() {
  emit("save", [
    ...topItems.value.map((item, index) => ({ id: item.id, sortOrder: index })),
    ...childGroups.value.flatMap((group) =>
      group.items.map((item, index) => ({ id: item.id, sortOrder: index })),
    ),
  ]);
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetLists();
  },
  { immediate: true },
);
</script>
