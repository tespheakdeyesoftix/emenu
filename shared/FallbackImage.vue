<template>
  <img
    v-if="imageSrc"
    :key="imageSrc"
    v-bind="$attrs"
    :src="imageSrc"
    @error="handleError"
  />
  <slot v-else name="fallback" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ src?: string | null; fallbackSrc?: string | null }>();
const failed = ref(false);
const fallbackFailed = ref(false);
const imageSrc = computed(() => {
  if (props.src && !failed.value) return props.src;
  if (!fallbackFailed.value && props.fallbackSrc !== props.src)
    return props.fallbackSrc;
});

function handleError() {
  if (imageSrc.value === props.src) failed.value = true;
  else fallbackFailed.value = true;
}

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
watch(
  () => props.fallbackSrc,
  () => {
    fallbackFailed.value = false;
  },
);
</script>
