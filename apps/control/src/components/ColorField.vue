<template>
  <div class="space-y-1.5">
    <FormLabel :id="hexId" :label="label" />
    <div class="flex items-center gap-2">
      <Popover align="start" :offset="6">
        <template #trigger>
          <Button
            size="lg"
            variant="outline"
            class="!w-12 shrink-0"
            :aria-label="t('colorPicker.open', { label })"
            :disabled="disabled"
            data-color-picker-trigger
          >
            <template #icon>
              <span
                class="size-6 rounded-3 ring-1 ring-inset ring-black/15"
                :style="{ backgroundColor: color }"
                aria-hidden="true"
              />
            </template>
          </Button>
        </template>

        <template #default="{ close }">
          <div class="w-64 max-w-[calc(100vw-2rem)] space-y-3 p-3" data-color-picker>
            <div class="flex items-center justify-between gap-2">
              <h3 class="m-0 min-w-0 text-base-semibold text-ink-gray-9">{{ label }}</h3>
              <Badge :label="color" class="shrink-0 font-mono" />
            </div>
            <div
              class="h-10 rounded-4 ring-1 ring-inset ring-black/15"
              :style="{ backgroundColor: color }"
              aria-hidden="true"
            />
            <div class="grid grid-cols-7 gap-1" role="group" :aria-label="t('colorPicker.presets')">
              <Button
                v-for="swatch in swatches"
                :key="swatch"
                size="xs"
                variant="outline"
                class="!w-full !p-0"
                :aria-label="swatch"
                :aria-pressed="color === swatch"
                :class="{ '!border-outline-gray-4 ring-1 ring-outline-gray-4': color === swatch }"
                :disabled="disabled"
                @click="model = swatch"
              >
                <template #icon>
                  <span
                    class="size-4 rounded-2 ring-1 ring-inset ring-black/15"
                    :style="{ backgroundColor: swatch }"
                    aria-hidden="true"
                  />
                </template>
              </Button>
            </div>
            <Divider />
            <div v-for="(channel, index) in channels" :key="channel" class="space-y-0.5">
              <div class="flex items-center justify-between text-sm text-ink-gray-6" aria-hidden="true">
                <span>{{ t(`colorPicker.${channel}`) }}</span>
                <span class="tabular-nums">{{ rgb[index] }}</span>
              </div>
              <Slider
                :model-value="[rgb[index]]"
                :max="255"
                :aria-label="t(`colorPicker.${channel}`)"
                :disabled="disabled"
                @update:model-value="updateChannel(index, $event)"
              />
            </div>
            <div class="flex justify-end">
              <Button variant="subtle" :label="t('common.close')" @click="close" />
            </div>
          </div>
        </template>
      </Popover>
      <TextInput
        :id="hexId"
        v-model="model"
        size="lg"
        variant="outline"
        :disabled="disabled"
        class="min-w-0 flex-1 [&_input]:uppercase"
        maxlength="7"
        pattern="#[0-9a-fA-F]{6}"
        spellcheck="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge, Button, Divider, FormLabel, Popover, Slider, TextInput } from "frappe-ui";
import { computed, useId } from "vue";
import { useI18n } from "vue-i18n";

defineProps<{ label: string; disabled?: boolean }>();
const model = defineModel<string>({ required: true });
const hexId = useId();
const { t } = useI18n();

const swatches = [
  "#FFFFFF", "#F5F5F5", "#D4D4D4", "#737373", "#404040", "#171717", "#000000",
  "#DE3C2F", "#EA580C", "#CA8A04", "#16A34A", "#0D9488", "#2563EB", "#9333EA",
];
const channels = ["red", "green", "blue"] as const;
const color = computed(() =>
  /^#[0-9a-f]{6}$/i.test(model.value) ? model.value.toUpperCase() : "#000000",
);
const rgb = computed(() =>
  [1, 3, 5].map((offset) => Number.parseInt(color.value.slice(offset, offset + 2), 16)),
);

function updateChannel(index: number, values: number[] | undefined) {
  const value = values?.[0];
  if (value === undefined) return;
  const next = [...rgb.value];
  next[index] = value;
  model.value = `#${next.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
</script>
