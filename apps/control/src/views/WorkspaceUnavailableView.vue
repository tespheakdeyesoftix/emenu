<template>
  <PageHeader :title="$t(connectionError ? 'shell.loadFailed' : 'shell.pageUnavailable')" />
  <section class="card grid min-h-80 place-items-center p-8 text-center">
    <div class="w-full max-w-lg text-start">
      <Alert :icon="connectionError ? 'lucide-wifi-off' : 'lucide-lock-keyhole'"
        :title="$t(connectionError ? 'shell.loadFailed' : 'shell.pageUnavailable')"
        :description="$t(connectionError ? 'shell.connectionFailed' : 'shell.pageUnavailableDetail')" />
      <Button v-if="connectionError" class="mt-4" variant="solid" @click="retry">
        {{ $t('common.tryAgain') }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Alert, Button } from "frappe-ui";
import PageHeader from "../components/PageHeader.vue";
const route = useRoute();
const router = useRouter();
const connectionError = computed(() => route.query.reason === "connection");
function retry() {
  const path = typeof route.query.retry === "string" ? route.query.retry : "/";
  void router.replace(path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/workspace-unavailable") ? path : "/");
}
</script>
