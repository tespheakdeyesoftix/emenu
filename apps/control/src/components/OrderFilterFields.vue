<template>
  <div :class="inSheet ? 'grid gap-3' : 'contents'">
    <div :class="inSheet ? 'w-full' : 'w-72 max-w-full'">
      <label :for="dateInputId" class="sr-only">{{ t("pages.orders.dateRange") }}</label>
      <DateRangePicker
        :id="dateInputId"
        :model-value="filters.dateRange"
        :placeholder="t('pages.orders.dateRange')"
        size="lg"
        variant="outline"
        format="DD/MM/YYYY"
        align="end"
        :typeable="!inSheet"
        @update:model-value="setFilter('dateRange', $event)"
      >
        <template #prefix><Icon name="lucide-calendar-days" class="size-4" /></template>
        <template #actions="{ fromDate, clear }">
          <Button variant="ghost" :label="t('common.clear')" :disabled="!fromDate" @click="clear" />
        </template>
      </DateRangePicker>
    </div>
    <Select
      size="lg"
      variant="outline"
      :model-value="filters.branchId"
      :class="inSheet ? 'w-full' : 'w-36 max-w-full'"
      :label="inSheet ? t('menus.branch') : undefined"
      :aria-label="t('menus.branch')"
      :options="branchOptions"
      @update:model-value="setBranch(String($event ?? ''))"
    />
    <Select
      size="lg"
      variant="outline"
      :model-value="filters.status"
      :class="inSheet ? 'w-full' : 'w-36 max-w-full'"
      :label="inSheet ? t('pages.orders.status') : undefined"
      :aria-label="t('pages.orders.status')"
      :options="statusOptions"
      @update:model-value="setFilter('status', String($event ?? ''))"
    />
    <label v-if="!inSheet" :for="tableInputId" class="sr-only">{{ t("pages.orders.tableNumber") }}</label>
    <Combobox
      :id="tableInputId"
      size="lg"
      variant="outline"
      trigger="button"
      :model-value="filters.tableId || null"
      :class="inSheet ? 'w-full' : 'w-44 max-w-full'"
      :label="inSheet ? t('pages.orders.tableNumber') : undefined"
      :aria-label="t('pages.orders.tableNumber')"
      :placeholder="t('pages.orders.allTables')"
      :empty-text="t('pages.orders.noMatchingTables')"
      :options="tableOptions"
      @update:model-value="setFilter('tableId', String($event ?? ''))"
    />
  </div>
</template>

<script lang="ts">
export type OrderFilters = {
  dateRange: DateRangeValue;
  branchId: string;
  status: string;
  tableId: string;
};

export type OrderFilterOptions = {
  branches: { id: string; name: string }[];
  tables: { id: string; branchId: string; code: string; label: string; groupName: string }[];
};
</script>

<script setup lang="ts">
import { Button, Combobox, DateRangePicker, Icon, Select, type DateRangeValue, type SelectOption } from "frappe-ui";
import { computed, useId } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  options: OrderFilterOptions;
  statusOptions: SelectOption[];
  inSheet?: boolean;
}>();
const filters = defineModel<OrderFilters>({ required: true });
const { t } = useI18n();
const dateInputId = useId();
const tableInputId = "orders-table-filter-" + useId();

const branchOptions = computed(() => [
  { label: t("menus.allBranches"), value: "" },
  ...props.options.branches.map(branch => ({ label: branch.name, value: branch.id })),
]);

const tableOptions = computed(() => {
  const { branchId } = filters.value;
  const branches = new Map(props.options.branches.map(branch => [branch.id, branch.name]));
  const tables = props.options.tables
    .filter(table => !branchId || table.branchId === branchId)
    .map(table => ({
      value: table.id,
      label: table.label === table.code ? table.code : table.code + " · " + table.label,
      description: (branchId ? [table.groupName] : [branches.get(table.branchId), table.groupName])
        .filter(Boolean).join(" · "),
    }));
  return [{ label: t("pages.orders.allTables"), value: "" }, ...tables];
});

function setFilter<Key extends keyof OrderFilters>(key: Key, value: OrderFilters[Key]) {
  filters.value = { ...filters.value, [key]: value };
}

function setBranch(branchId: string) {
  const selectedTable = props.options.tables.find(table => table.id === filters.value.tableId);
  const tableId = !branchId || selectedTable?.branchId === branchId ? filters.value.tableId : "";
  filters.value = { ...filters.value, branchId, tableId };
}
</script>
