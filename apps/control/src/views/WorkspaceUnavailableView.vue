<template>
  <PageHeader :title="$t('shell.pageUnavailable')" />
  <section class="card grid min-h-80 place-items-center p-8 text-center">
    <div class="w-full max-w-lg text-start">
      <Alert
        icon="lucide-lock-keyhole"
        :title="$t('shell.pageUnavailable')"
        :description="$t('shell.pageUnavailableDetail')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Alert } from "frappe-ui";
import PageHeader from "../components/PageHeader.vue";
</script>
