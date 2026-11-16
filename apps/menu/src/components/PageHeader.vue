<template>
  <header
    class="border-b border-ink/[.06] bg-surface/95 px-4 py-5 shadow-sm backdrop-blur-xl sm:px-6"
    :class="sticky ? 'sticky top-0 z-30' : ''"
  >
    <div class="mx-auto flex max-w-6xl items-center gap-3">
      <button
        v-if="backTo"
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full bg-cream"
        :aria-label="text.back"
        @click="router.push(menuLink(backTo))"
      >
        <ArrowLeft :size="21" />
      </button>
      <div class="min-w-0">
        <p class="m-0 truncate text-sm font-bold text-tomato">
          {{ store.data.business.name }}
          <template v-if="store.data.branch && !store.data.branch.isDefault"> · {{ store.data.branch.name }}</template>
        </p>
        <h1
          class="font-display m-0 mt-1 truncate text-2xl font-extrabold sm:text-3xl"
          :class="titleClass"
        >
          {{ title }}
        </h1>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useMenuLink } from "../composables/useMenuLink";
import { ArrowLeft } from "lucide-vue-next";
import { useMenuStore } from "../stores/menu";
import { uiText } from "../uiText";

defineProps<{
  title: string;
  backTo?: string;
  sticky?: boolean;
  titleClass?: string;
}>();
const store = useMenuStore();
const router = useRouter();
const menuLink = useMenuLink();
const text = computed(() => uiText(store.selectedLanguage));
</script>
