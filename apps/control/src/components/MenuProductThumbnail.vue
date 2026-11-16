<template>
  <div class="relative shrink-0 overflow-hidden bg-cream">
    <FallbackImage
      :src="src"
      alt=""
      loading="lazy"
      decoding="async"
      class="absolute inset-0 size-full object-cover"
    >
      <template #fallback>
        <span
          class="absolute inset-0 grid place-items-center text-black/25"
          aria-hidden="true"
        >
          <PackageOpen :size="24" />
        </span>
      </template>
    </FallbackImage>
  </div>
</template>

<script setup lang="ts">
import { PackageOpen } from "lucide-vue-next";
import FallbackImage from "../../../../shared/FallbackImage.vue";

defineProps<{ src: string }>();
</script>
