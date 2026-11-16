<template>
  <div class="flex items-center gap-3">
    <BusinessLogo
      v-if="title || logoUrl"
      :name="displayTitle"
      :src="logoUrl"
      :alt="compact ? displayTitle : ''"
      class="text-sm"
      :class="compact ? 'size-11 rounded-2xl shadow-sm' : 'size-10 rounded-xl'"
      :title="compact ? displayTitle : undefined"
    />
    <span
      v-else
      class="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-mint"
      aria-hidden="true"
    >
      <Utensils :size="19" />
    </span>
    <div v-if="!compact">
      <div class="display text-[1.15rem] leading-snug">
        {{ displayTitle }}
      </div>
      <div
        v-if="subtitle"
        class="mt-0.5 text-[11px] font-medium leading-4 tracking-normal text-black/45"
      >
        {{ subtitle }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { Utensils } from "lucide-vue-next";
import BusinessLogo from "./BusinessLogo.vue";

const props = defineProps<{
  subtitle?: string;
  title?: string;
  logoUrl?: string;
  compact?: boolean;
}>();
const displayTitle = computed(() => props.title?.trim() || "Angkor eMenu");
</script>
