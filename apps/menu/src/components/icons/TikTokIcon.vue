<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      d="M15.42 3c.2 1.54 1.05 2.89 2.32 3.76a6.1 6.1 0 0 0 3.26 1v3.08a9.2 9.2 0 0 1-5.53-1.79v6.17a6.22 6.22 0 1 1-5.36-6.16v3.12a3.13 3.13 0 1 0 2.25 3V3h3.06Z"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 });
</script>
