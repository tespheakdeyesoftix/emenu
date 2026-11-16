<template>
  <div
    class="flex min-h-16 items-center gap-2 p-2"
    :class="compact ? 'bg-transparent' : 'bg-white'"
  >
    <button
      type="button"
      class="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left transition hover:bg-black/[.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      :aria-label="
        t('pages.catalog.categoryManager.editLabel', { name: displayName })
      "
      @click="$emit('edit')"
    >
      <FallbackImage
        :src="category.imageUrl"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-11 shrink-0 rounded-xl object-cover"
      >
        <template #fallback>
          <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-cream text-black/35" aria-hidden="true">
            <Folder :size="18" />
          </span>
        </template>
      </FallbackImage>
      <span class="min-w-0 flex-1">
        <strong class="block text-sm leading-snug [overflow-wrap:anywhere]">{{ displayName }}</strong>
        <small
          v-if="secondaryNames.length"
          class="block text-xs text-black/55 [overflow-wrap:anywhere]"
          >{{ secondaryNames.join(" · ") }}</small
        >
        <small
          class="mt-1 block text-[11px] font-bold"
          :class="
            hiddenByParent || !active ? 'text-amber-700' : 'text-black/35'
          "
        >
          {{ statusText }} ·
          {{ t("pages.catalog.categoryManager.itemCount", { count }) }}
        </small>
      </span>
      <Pencil :size="15" class="shrink-0 text-black/30" />
    </button>
    <button
      type="button"
      role="switch"
      :aria-checked="active"
      :aria-label="
        t('pages.catalog.categoryManager.toggleLabel', { name: displayName })
      "
      :disabled="saving"
      class="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-wait disabled:opacity-60"
      @click="$emit('toggle', !active)"
    >
      <LoaderCircle v-if="saving" :size="20" class="animate-spin" />
      <span
        v-else
        class="relative block h-6 w-11 rounded-full transition"
        :class="active ? 'bg-emerald-600' : 'bg-black/20'"
      >
        <span
          class="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition"
          :class="active ? 'left-[22px]' : 'left-0.5'"
        />
      </span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Folder, LoaderCircle, Pencil } from "lucide-vue-next";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import type { Category } from "../stores/admin";

const props = withDefaults(
  defineProps<{
    category: Category;
    count: number;
    enableEn: boolean;
    enableZh: boolean;
    saving?: boolean;
    compact?: boolean;
    hiddenByParent?: boolean;
  }>(),
  { saving: false, compact: false, hiddenByParent: false },
);

defineEmits<{ edit: []; toggle: [active: boolean] }>();
const { t } = useI18n();
const displayName = computed(
  () => props.category.nameKm || props.category.name,
);
const active = computed(
  () => props.category.isActive !== 0 && props.category.isActive !== false,
);
const secondaryNames = computed(() =>
  [
    props.enableEn ? props.category.nameEn : "",
    props.enableZh ? props.category.nameZh : "",
  ].filter(Boolean),
);
const statusText = computed(() =>
  props.hiddenByParent
    ? t("pages.catalog.categoryManager.hiddenByParent")
    : active.value
      ? t("pages.catalog.categoryManager.visible")
      : t("pages.catalog.categoryManager.hidden"),
);
</script>
