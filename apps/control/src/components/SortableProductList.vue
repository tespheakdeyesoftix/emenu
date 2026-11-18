<template>
  <List divider="none" :aria-label="label">
    <draggable
      v-model="items"
      item-key="id"
      handle="[data-sort-handle]"
      :animation="150"
      :disabled="disabled"
      ghost-class="opacity-30"
      role="presentation"
      v-bind="$attrs"
    >
      <template #item="{ element, index }">
        <div role="presentation" class="min-w-0">
          <ListRow :value="element.id" :class="rowClass" class="h-full">
            <slot name="item" :product="element" :index="index" />
          </ListRow>
        </div>
      </template>
    </draggable>
  </List>
</template>

<script setup lang="ts" generic="Product extends { id: string }">
import { List, ListRow } from "frappe-ui/list";
import draggable from "vuedraggable";

defineOptions({ inheritAttrs: false });
defineProps<{ label: string; disabled?: boolean; rowClass: string }>();
defineSlots<{ item(props: { product: Product; index: number }): unknown }>();
const items = defineModel<Product[]>({ required: true });
</script>
