<template>
  <label>
    <span class="label">{{ label }}</span>
    <div class="flex gap-2">
      <input
        :value="modelValue"
        type="color"
        class="h-12 w-12 shrink-0 rounded-xl border border-black/10 bg-white p-1"
        @input="update"
      />
      <input
        :value="modelValue"
        class="input min-w-0 px-3"
        pattern="#[0-9a-fA-F]{6}"
        @input="update"
      />
    </div>
  </label>
</template>
<script setup lang="ts">
defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
function update(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>
