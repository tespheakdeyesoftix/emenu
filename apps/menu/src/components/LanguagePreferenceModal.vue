<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-preference-title"
      aria-describedby="language-preference-description"
    >
      <section
        class="w-full max-w-md rounded-[2rem] bg-cream p-5 text-ink shadow-2xl sm:p-7"
      >
        <div
          class="mx-auto grid size-16 place-items-center rounded-2xl bg-surface text-tomato shadow-sm"
        >
          <Languages :size="30" stroke-width="2.2" />
        </div>
        <p
          class="mb-0 mt-5 text-center text-xs font-extrabold uppercase tracking-[.16em] text-tomato"
        >
          Angkor eMenu
        </p>
        <h1
          id="language-preference-title"
          class="font-display mb-0 mt-2 text-center text-2xl font-extrabold leading-tight text-ink sm:text-3xl"
        >
          <span lang="km">ជ្រើសរើសភាសា</span>
          <span class="mt-1 block text-base text-ink/40" lang="en"
            >Choose your language</span
          >
          <span class="mt-1 block text-base text-ink/40" lang="zh"
            >选择您的语言</span
          >
        </h1>
        <p
          id="language-preference-description"
          class="mx-auto mb-0 mt-4 max-w-sm text-center text-sm leading-6 text-ink/50"
        >
          Your selection will be remembered for your next visit.
        </p>

        <div class="mt-6 grid gap-3">
          <button
            v-for="language in languages"
            :key="language.code"
            type="button"
            class="flex w-full items-center gap-4 rounded-2xl border border-ink/[.08] bg-surface px-4 py-3.5 text-left font-extrabold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-tomato/30 hover:shadow-md active:translate-y-0"
            @click="$emit('select', language.code)"
          >
            <img
              :src="language.flag"
              alt=""
              class="h-8 w-12 rounded-md object-cover shadow-sm"
            />
            <span class="flex-1 text-lg">{{ language.label }}</span>
            <ChevronRight :size="20" class="text-ink/25" />
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ChevronRight, Languages } from "lucide-vue-next";
import type { MenuLanguage } from "../stores/menu";

defineProps<{
  open: boolean;
  languages: Array<{ code: MenuLanguage; label: string; flag: string }>;
}>();

defineEmits<{ select: [language: MenuLanguage] }>();
</script>
