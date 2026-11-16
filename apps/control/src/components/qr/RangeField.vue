<template>
  <label>
    <span class="label flex justify-between"
      ><span>{{ label }}</span
      ><span>{{ modelValue }}{{ suffix }}</span></span
    >
    <input
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      class="w-full accent-black"
      @input="update"
    />
  </label>
</template>
<script setup lang="ts">
defineProps<{
  modelValue: number;
  label: string;
  min: number;
  max: number;
  suffix?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();
function update(event: Event) {
  emit("update:modelValue", Number((event.target as HTMLInputElement).value));
}
</script>
