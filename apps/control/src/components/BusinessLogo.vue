<template>
  <span class="block shrink-0 overflow-hidden bg-cream">
    <FallbackImage :src="src" :alt="alt" class="size-full object-cover">
      <template #fallback>
        <span
          class="grid size-full place-items-center bg-ink font-bold text-mint"
          :aria-hidden="!alt"
          :role="alt ? 'img' : undefined"
          :aria-label="alt || undefined"
        >
          {{ businessInitials(name) }}
        </span>
      </template>
    </FallbackImage>
  </span>
</template>

<script setup lang="ts">
import FallbackImage from "../../../../shared/FallbackImage.vue";
import { businessInitials } from "../../../../shared/businessInitials";

withDefaults(
  defineProps<{ name?: string; src?: string; alt?: string }>(),
  { alt: "" },
);
</script>
