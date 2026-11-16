<template>
  <button
    ref="trigger"
    type="button"
    class="grid shrink-0 place-items-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
    :class="compact
      ? 'size-9 bg-transparent text-black/60 hover:text-ink'
      : 'size-11 border border-black/[.08] bg-cream text-ink hover:bg-black/[.08]'"
    :popovertarget="panelId"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
  >
    <MoreHorizontal :size="compact ? 16 : 20" aria-hidden="true" />
  </button>
  <div
    :id="panelId"
    ref="panel"
    popover="auto"
    class="fixed m-0 hidden w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-black/[.08] bg-white p-1 text-ink shadow-xl"
    @beforetoggle="position"
    @toggle="trackViewport"
  >
    <slot :close="close" />
  </div>
</template>

<script setup lang="ts">
import { MoreHorizontal } from "lucide-vue-next";
import { onBeforeUnmount, ref, useId } from "vue";

defineProps<{ label: string; compact?: boolean; disabled?: boolean }>();
const panelId = useId();
const trigger = ref<HTMLButtonElement>();
const panel = ref<HTMLDivElement>();

function close() {
  panel.value?.hidePopover();
}

function position(event: ToggleEvent) {
  if (event.newState !== "open" || !trigger.value || !panel.value) return;
  const anchor = trigger.value.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = document.documentElement.clientWidth;
  const below = window.innerHeight - anchor.bottom - margin * 2;
  const above = anchor.top - margin * 2;
  const placeBelow = below >= 180 || below >= above;
  const width = Math.min(224, viewportWidth - margin * 2);
  Object.assign(panel.value.style, {
    left: `${Math.max(margin, anchor.right - width)}px`,
    right: "auto",
    top: placeBelow ? `${anchor.bottom + margin}px` : "auto",
    bottom: placeBelow ? "auto" : `${window.innerHeight - anchor.top + margin}px`,
    maxHeight: `${placeBelow ? below : above}px`,
  });
}

function closeOnScroll(event: Event) {
  if (!(event.target instanceof Node) || !panel.value?.contains(event.target)) close();
}

function stopTrackingViewport() {
  window.removeEventListener("scroll", closeOnScroll, true);
  window.removeEventListener("resize", close);
}

function trackViewport(event: ToggleEvent) {
  if (event.newState === "open") {
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", close);
  } else {
    stopTrackingViewport();
  }
}

onBeforeUnmount(stopTrackingViewport);
</script>

<style scoped>
[popover]:popover-open {
  display: block;
}

:slotted(button) {
  @apply flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-semibold hover:bg-cream disabled:opacity-50;
}

:slotted(button) :deep(svg) {
  flex-shrink: 0;
}
</style>
