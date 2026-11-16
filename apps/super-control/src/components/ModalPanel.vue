<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      @click.self="$emit('close')"
    >
      <section
        class="max-h-[100dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-7"
      >
        <header class="mb-6 flex items-start justify-between gap-4">
          <div>
            <p
              class="m-0 text-xs font-bold uppercase tracking-[.15em] text-black/35"
            >
              Super control
            </p>
            <h2 class="display m-0 mt-1 text-2xl font-extrabold">
              {{ title }}
            </h2>
          </div>
          <button
            type="button"
            class="grid size-9 place-items-center rounded-full bg-canvas"
            aria-label="Close"
            @click="$emit('close')"
          >
            <X :size="18" />
          </button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from "lucide-vue-next";
defineProps<{ open: boolean; title: string }>();
defineEmits<{ close: [] }>();
</script>
