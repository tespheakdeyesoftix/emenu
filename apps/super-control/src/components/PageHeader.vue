<template>
  <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p
        class="m-0 mb-2 text-xs font-bold uppercase tracking-[.18em] text-black/35"
      >
        {{ eyebrow }}
      </p>
      <h1
        class="display m-0 text-3xl font-extrabold tracking-tight lg:text-4xl"
      >
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="mb-0 mt-2 max-w-2xl text-sm leading-6 text-black/50"
      >
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; description?: string }>();
</script>
