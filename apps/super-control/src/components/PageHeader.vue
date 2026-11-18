<template>
  <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
    <h1 class="display m-0 text-3xl font-extrabold tracking-tight lg:text-4xl">
      {{ title }}
    </h1>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
