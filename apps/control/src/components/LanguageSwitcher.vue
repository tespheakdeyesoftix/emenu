<template>
  <Dropdown v-if="compact" :options="languageOptions" side="right" align="end" :offset="8">
    <template #trigger>
      <Button
        variant="ghost"
        size="md"
        class="!h-9 !w-full"
        icon="lucide-languages"
        :aria-label="t('language.label')"
        :tooltip="t('language.label')"
      />
    </template>
  </Dropdown>
  <div v-else
    class="inline-flex items-center rounded-xl border border-black/[0.08] bg-white p-1 shadow-sm"
    role="group"
    :aria-label="t('language.label')"
  >
    <Languages :size="15" class="mx-1.5 text-black/40" aria-hidden="true" />
    <Button
      size="sm"
      :variant="locale === option.value ? 'solid' : 'ghost'"
      v-for="option in options"
      :key="option.value"
      type="button"
      class="!text-xs"
      :aria-pressed="locale === option.value"
      @click="selectLocale(option.value)"
    >
      {{ option.label }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button, Dropdown } from "frappe-ui";
import { computed } from "vue";
import { Languages } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { CONTROL_LOCALE_KEY, type ControlLocale } from "../i18n";

defineProps<{ compact?: boolean }>();
const { locale, t } = useI18n();
const options: Array<{ value: ControlLocale; label: string }> = [
  { value: "en", label: "EN" },
  { value: "km", label: "ខ្មែរ" },
];

const languageOptions = computed(() => options.map(({ value }) => ({
  label: t(value === "en" ? "language.english" : "language.khmer"),
  selected: locale.value === value,
  onClick: () => selectLocale(value),
})));

function selectLocale(value: ControlLocale) {
  locale.value = value;
  localStorage.setItem(CONTROL_LOCALE_KEY, value);
  document.documentElement.lang = value;
}
</script>
