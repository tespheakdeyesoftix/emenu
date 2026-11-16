<template>
  <main
    class="mx-auto grid min-h-screen max-w-xl place-items-center px-6 py-12 text-center"
  >
    <section>
      <div
        class="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-surface text-tomato shadow-[0_18px_55px_rgba(27,27,25,.1)]"
      >
        <QrCode :size="36" stroke-width="2.2" />
      </div>
      <p
        class="mb-0 mt-8 text-xs font-extrabold uppercase tracking-[.18em] text-tomato"
      >
        Angkor eMenu
      </p>
      <h1
        class="font-display mb-0 mt-3 text-3xl font-extrabold leading-tight text-ink sm:text-4xl"
      >
        {{
          mode === "unavailable"
            ? "This QR menu is unavailable"
            : "We couldn't load the menu"
        }}
      </h1>
      <p class="mx-auto mb-0 mt-4 max-w-md text-sm leading-6 text-ink/50">
        {{
          mode === "unavailable"
            ? "This menu link has expired or the business has disabled it. Please ask a staff member for help."
            : "Please check your internet connection and try loading the menu again."
        }}
      </p>
      <button
        type="button"
        class="mx-auto mt-7 inline-flex items-center gap-2 rounded-full bg-action px-6 py-3.5 text-sm font-extrabold text-on-action shadow-lg transition hover:-translate-y-0.5"
        @click="$emit('retry')"
      >
        <RefreshCw :size="17" />Try again
      </button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { QrCode, RefreshCw } from "lucide-vue-next";

withDefaults(defineProps<{ mode?: "unavailable" | "error" }>(), {
  mode: "unavailable",
});
defineEmits<{ retry: [] }>();
</script>
