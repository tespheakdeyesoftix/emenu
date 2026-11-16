<template>
  <div class="no-scrollbar mb-5 overflow-x-auto">
    <div
      role="tablist"
      aria-orientation="horizontal"
      :aria-label="label"
      class="inline-flex min-w-full gap-1 rounded-2xl border border-black/[.06] bg-white p-1.5 shadow-sm"
    >
      <button
        v-for="(tab, index) in tabs"
        :id="`${idPrefix}-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="modelValue === tab.id"
        :aria-controls="`${idPrefix}-panel-${tab.id}`"
        :tabindex="modelValue === tab.id ? 0 : -1"
        class="min-h-11 min-w-[148px] flex-1 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        :class="
          modelValue === tab.id
            ? 'bg-ink text-white shadow-sm'
            : 'text-black/50 hover:bg-cream hover:text-ink'
        "
        @click="selectTab(tab.id)"
        @keydown="handleKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue";

type SettingsTab = {
  id: string;
  label: string;
};

const props = defineProps<{
  tabs: SettingsTab[];
  modelValue: string;
  label: string;
  idPrefix: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function selectTab(id: string, focus = false) {
  emit("update:modelValue", id);
  if (focus) {
    void nextTick(() =>
      document.getElementById(`${props.idPrefix}-tab-${id}`)?.focus(),
    );
  }
}

function handleKeydown(event: KeyboardEvent, index: number) {
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight") nextIndex = (index + 1) % props.tabs.length;
  if (event.key === "ArrowLeft") {
    nextIndex = (index - 1 + props.tabs.length) % props.tabs.length;
  }
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = props.tabs.length - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  const tab = props.tabs[nextIndex];
  if (tab) selectTab(tab.id, true);
}
</script>
