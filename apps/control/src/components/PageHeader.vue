<template>
  <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="eyebrow mb-2">
        {{ eyebrow }}
      </p>
      <h1 class="display m-0 max-w-3xl text-[1.75rem] lg:text-[2.15rem]">
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="mb-0 mt-2.5 max-w-2xl text-[15px] leading-7 text-black/55"
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
