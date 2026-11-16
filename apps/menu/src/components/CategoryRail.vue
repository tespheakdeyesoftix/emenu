<template>
  <section
    data-category-rail
    class="sticky top-0 z-30 -mx-4 border-b border-ink/[.06] bg-cream/95 px-4 py-2 shadow-[0_8px_24px_rgba(45,38,30,.05)] backdrop-blur-xl sm:mx-0 sm:px-0"
  >
    <div
      ref="rail"
      class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <button
        data-category-chip=""
        :data-active="!activeChipId"
        class="menu-category-chip menu-category-filter group min-w-[116px] rounded-[1rem] border p-1.5 transition"
        :class="
          !activeChipId
            ? 'border-tomato bg-tomato text-on-primary'
            : 'border-ink/[.06] bg-surface'
        "
        @click="store.selectCategory('')"
      >
        <span
          class="menu-category-image grid h-16 w-full place-items-center rounded-[0.7rem]"
          :class="activeChipId ? 'bg-surface/15 text-on-primary' : 'bg-cream'"
        >
          <LayoutGrid :size="22" />
        </span>
        <span class="mt-1.5 block truncate px-1 font-bold leading-5">
          {{ t("category.all") }}
        </span>
      </button>
      <button
        v-for="cat in store.data.categories"
        :key="cat.id"
        :data-category-chip="cat.id"
        :data-active="activeChipId === cat.id"
        class="menu-category-chip menu-category-filter group min-w-[116px] rounded-[1rem] border p-1.5 transition"
        :class="
          activeChipId === cat.id
            ? 'border-tomato bg-tomato text-on-primary'
            : 'border-ink/[.06] bg-surface'
        "
        @click="store.selectCategory(cat.id)"
      >
        <MenuImage
          :src="cat.imageUrl"
          alt=""
          loading="lazy"
          decoding="async"
          class="menu-category-image h-16 w-full rounded-[0.7rem] object-cover transition group-hover:scale-[1.02]"
        >
          <template #fallback>
            <span
              class="menu-category-image grid h-16 w-full place-items-center rounded-[0.7rem] bg-cream text-ink/20"
            >
              <Utensils :size="21" />
            </span>
          </template>
        </MenuImage>
        <span class="mt-1.5 block truncate px-1 font-bold leading-5">{{
          store.nameFor(cat)
        }}</span>
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { LayoutGrid, Utensils } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import MenuImage from "./MenuImage.vue";
import { useMenuStore } from "../stores/menu";
const props = defineProps<{ categoryInView?: string }>();
const store = useMenuStore();
const { t } = useI18n();
const rail = ref<HTMLElement | null>(null);
const activeChipId = computed(
  () => store.activeCategory || props.categoryInView,
);

watch(activeChipId, async (categoryId) => {
  await nextTick();
  const chip = Array.from(
    rail.value?.querySelectorAll<HTMLElement>("[data-category-chip]") || [],
  ).find((item) => item.dataset.categoryChip === categoryId);
  chip?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center",
  });
});
</script>
