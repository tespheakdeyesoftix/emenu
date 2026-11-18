<template>
  <fieldset class="rounded-xl border border-black/10 p-3">
    <legend class="px-1 text-sm font-semibold">
      {{ t("selling.tableGroups") }}
    </legend>
    <p
      v-if="!groups.length && !selectedIds.length"
      class="text-sm text-black/60"
    >
      {{ t("selling.noTableGroups") }}
    </p>
    <template v-else>
      <p class="mb-2 text-sm text-black/60">
        {{ t("selling.tableGroupsHelp") }}
      </p>
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <Button variant="subtle" size="lg"
          v-if="groups.length"
          type="button"
          class="!px-3 !py-1.5"
          @click="selectAll"
        >
          {{ t("selling.selectAllTableGroups") }}
        </Button>
        <Button variant="subtle" size="lg"
          v-if="selectedIds.length"
          type="button"
          class="!px-3 !py-1.5"
          @click="selectedIds = []"
        >
          {{ t("selling.useBranchTableOrder") }}
        </Button>
      </div>
      <List divider="none"
        class="max-h-60 divide-y divide-black/10 overflow-y-auto overscroll-contain"
      >
        <ListRow
          v-for="{ id, name, position } in choices"
          :key="id"
          class="!flex min-h-10 items-center justify-between gap-2"
        >
          <label class="flex min-w-0 flex-1 items-center gap-2 py-2 text-sm">
            <Checkbox
              type="checkbox"
              class="shrink-0"
              :model-value="position !== -1"
              @change="toggle(id)"
            />
            <span class="break-words">{{ name }}</span>
          </label>
          <div v-if="position !== -1" class="flex shrink-0 items-center gap-1">
            <Button variant="ghost"
              type="button"
              class="grid size-8 place-items-center rounded-lg hover:bg-cream disabled:opacity-30"
              :aria-label="t('menus.moveUp', { name })"
              :disabled="position === 0"
              @click="move(position, -1)"
            >
              <template #icon><ArrowUp :size="16" aria-hidden="true" /></template>
            </Button>
            <Button variant="ghost"
              type="button"
              class="grid size-8 place-items-center rounded-lg hover:bg-cream disabled:opacity-30"
              :aria-label="t('menus.moveDown', { name })"
              :disabled="position === selectedIds.length - 1"
              @click="move(position, 1)"
            >
              <template #icon><ArrowDown :size="16" aria-hidden="true" /></template>
            </Button>
          </div>
        </ListRow>
      </List>
    </template>
  </fieldset>
</template>

<script setup lang="ts">
import { List, ListRow } from "frappe-ui/list";
import { Button, Checkbox } from "frappe-ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowDown, ArrowUp } from "lucide-vue-next";
import type { PosTableGroup } from "../types/posProfile";

const props = defineProps<{ groups: PosTableGroup[] }>();
const selectedIds = defineModel<string[]>({ required: true });
const { t } = useI18n();
const groupsById = computed(
  () => new Map(props.groups.map((group) => [group.id, group])),
);
const choices = computed(() => {
  const selected = new Set(selectedIds.value);
  return [
    ...selectedIds.value.map((id, position) => ({
      id,
      position,
      name:
        groupsById.value.get(id)?.name ??
        t("selling.unavailableSelection", { id }),
    })),
    ...props.groups
      .filter(({ id }) => !selected.has(id))
      .map(({ id, name }) => ({ id, name, position: -1 })),
  ];
});

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((value) => value !== id)
    : [...selectedIds.value, id];
}

function selectAll() {
  const selected = selectedIds.value.filter((id) => groupsById.value.has(id));
  const remaining = props.groups
    .map(({ id }) => id)
    .filter((id) => !selected.includes(id));
  selectedIds.value = [...selected, ...remaining];
}

function move(position: number, step: -1 | 1) {
  const target = position + step;
  if (target < 0 || target >= selectedIds.value.length) return;
  const reordered = [...selectedIds.value];
  const [id] = reordered.splice(position, 1);
  reordered.splice(target, 0, id);
  selectedIds.value = reordered;
}
</script>
