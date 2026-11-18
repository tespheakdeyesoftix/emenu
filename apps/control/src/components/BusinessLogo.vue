<template>
  <Avatar
    :key="src"
    :image="src"
    :label="alt"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : true"
    shape="square"
    class="overflow-hidden bg-surface-gray-2 [&>div]:!bg-ink [&>div]:!text-mint [&>*]:!rounded-none"
  >
    <span class="font-bold">{{ businessInitials(name) }}</span>
  </Avatar>
</template>

<script setup lang="ts">
import { Avatar } from "frappe-ui";
import { businessInitials } from "../../../../shared/businessInitials";

withDefaults(defineProps<{ name?: string; src?: string; alt?: string }>(), { alt: "" });
</script>
