<template>
  <div
    class="flex min-h-16 items-center gap-2 p-2"
    :class="compact ? 'bg-transparent' : 'bg-white'"
  >
    <Button
      variant="ghost"
      type="button"
      class="admin-row-button !h-auto min-h-12 min-w-0 flex-1 !shrink !justify-start !whitespace-normal !px-1 text-start"
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
    </Button>
    <Switch
      :model-value="active"
      :aria-label="t('pages.catalog.categoryManager.toggleLabel', { name: displayName })"
      :aria-busy="saving"
      :disabled="saving"
      @update:model-value="$emit('toggle', Boolean($event))"
    />
  </div>
</template>
<script setup lang="ts">
import { Button, Switch } from "frappe-ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Folder, Pencil } from "lucide-vue-next";
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
