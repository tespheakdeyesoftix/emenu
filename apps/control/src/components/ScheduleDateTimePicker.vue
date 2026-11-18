<template>
  <DateTimePicker
    v-model="pickerValue"
    :label="label"
    :placeholder="t('common.selectDateTime')"
    size="lg"
    variant="outline"
    format="DD/MM/YYYY HH:mm"
    required
  />
</template>

<script setup lang="ts">
import { DateTimePicker } from "frappe-ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

defineProps<{ label: string }>();
const value = defineModel<string>({ required: true });
const { t } = useI18n();

// Schedule APIs use local time at minute precision with a T separator.
const pickerValue = computed({
  get: () => value.value.replace("T", " "),
  set: (dateTime: string) => {
    value.value = dateTime.slice(0, 16).replace(" ", "T");
  },
});
</script>
