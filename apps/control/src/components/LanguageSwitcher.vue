<template>
  <div
    class="inline-flex items-center rounded-xl border border-black/[0.08] bg-white p-1 shadow-sm"
    role="group"
    :aria-label="t('language.label')"
  >
    <Languages :size="15" class="mx-1.5 text-black/40" aria-hidden="true" />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-lg px-2.5 py-1.5 text-xs font-bold transition"
      :class="
        locale === option.value
          ? 'bg-ink text-white'
          : 'text-black/50 hover:bg-black/[0.04] hover:text-ink'
      "
      :aria-pressed="locale === option.value"
      @click="selectLocale(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Languages } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { CONTROL_LOCALE_KEY, type ControlLocale } from "../i18n";

const { locale, t } = useI18n();
const options: Array<{ value: ControlLocale; label: string }> = [
  { value: "en", label: "EN" },
  { value: "km", label: "ខ្មែរ" },
];

function selectLocale(value: ControlLocale) {
  locale.value = value;
  localStorage.setItem(CONTROL_LOCALE_KEY, value);
  document.documentElement.lang = value;
}
</script>
