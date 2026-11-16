<template>
  <a
    href="#"
    class="inline-flex items-center gap-3 text-inherit no-underline"
    aria-label="អង្គរ អ៊ីមេនុយ"
  >
    <span
      class="grid size-10 place-items-center rounded-t-[1.25rem] rounded-b-lg bg-primary text-sage shadow-[inset_0_0_0_1px_rgba(232,210,164,.35)]"
    >
      <Landmark :size="19" />
    </span>
    <span class="display text-lg font-extrabold tracking-tight">
      អង្គរ អ៊ីមេនុយ<span class="text-secondary">.</span>
    </span>
  </a>
</template>

<script setup lang="ts">
import { Landmark } from "lucide-vue-next";
</script>
