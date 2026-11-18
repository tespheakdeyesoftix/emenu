<template>
  <Button
    variant="subtle"
    size="lg"
    icon-left="lucide-upload"
    :label="label"
    :loading="loading"
    :loading-text="loadingText"
    v-bind="$attrs"
    @click="picker?.inputElement?.click()"
  />
  <TextInput
    ref="picker"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    :multiple="multiple"
    :disabled="loading"
    class="!hidden"
    tabindex="-1"
    @change="$emit('select', $event)"
  />
</template>

<script setup lang="ts">
import { Button, TextInput } from "frappe-ui";
import { useTemplateRef } from "vue";

defineOptions({ inheritAttrs: false });
defineProps<{
  label: string;
  loadingText?: string;
  loading?: boolean;
  multiple?: boolean;
}>();
defineEmits<{ select: [event: Event] }>();
const picker = useTemplateRef<InstanceType<typeof TextInput>>("picker");
</script>
