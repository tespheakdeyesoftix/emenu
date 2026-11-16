<template>
  <section class="card grid min-h-80 place-items-center p-8 text-center">
    <div>
      <LockKeyhole :size="32" class="mx-auto text-black/35" />
      <h1 class="display mb-2 mt-4 text-2xl font-extrabold">
        {{ $t("shell.pageUnavailable") }}
      </h1>
      <p class="m-0 text-sm text-black/55">{{ $t("shell.pageUnavailableDetail") }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { LockKeyhole } from "lucide-vue-next";
</script>
