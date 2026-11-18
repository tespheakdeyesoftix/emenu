<template>
  <DatePicker
    v-model="value"
    :label="label"
    :disabled="disabled"
    :placeholder="t('common.selectDate')"
    size="lg"
    variant="outline"
    format="DD/MM/YYYY"
  >
    <template #prefix><Icon name="lucide-calendar-days" class="size-4" /></template>
    <template #actions="{ selected, clear }">
      <Button variant="ghost" :label="t('common.clear')" :disabled="!selected" @click="clear" />
    </template>
  </DatePicker>
</template>

<script setup lang="ts">
import { Button, DatePicker, Icon } from "frappe-ui";
import { useI18n } from "vue-i18n";

defineProps<{ label: string; disabled?: boolean }>();
const value = defineModel<string>({ required: true });
const { t } = useI18n();
</script>
