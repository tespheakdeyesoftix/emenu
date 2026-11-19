<template>
  <FrappeUIProvider>
    <RouterView v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
      <main v-else class="grid min-h-screen place-items-center bg-surface-gray-1 p-6"
        role="status" aria-live="polite">
        <div class="flex items-center gap-3 text-base text-ink-gray-6">
          <Spinner class="!size-6" />
          {{ $t('shell.loadingWorkspace') }}
        </div>
      </main>
    </RouterView>
  </FrappeUIProvider>
</template>

<script setup lang="ts">
import { FrappeUIProvider, Spinner } from "frappe-ui";
</script>
