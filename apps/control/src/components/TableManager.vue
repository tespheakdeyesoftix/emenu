<template>
  <div>
    <PageHeader :title="t('pages.tables.title')">
      <div v-if="!admin.isReadOnly" class="flex flex-wrap items-center gap-2">
        <Button variant="subtle" size="lg" type="button" :disabled="busy || store.loading" @click="openNewGroup">
          <template #prefix><FolderPlus :size="16" aria-hidden="true" /></template>{{ t("pages.tables.addGroup") }}
        </Button>
        <Button variant="solid" size="lg"
          type="button"
          :disabled="busy || store.loading || !availableGroups.length"
          @click="openNewTable"
        >
          <template #prefix><Plus :size="16" aria-hidden="true" /></template>{{ t("pages.tables.addTable") }}
        </Button>
        <MenuActionPopover
          v-if="!selectingDelete && (filteredTables.length || visibleGroups.length)"
          v-slot="{ close }"
          :label="t('common.moreActions')"
          :disabled="busy || store.loading"
        >
          <Button variant="ghost" type="button" class="text-red-700" @click="close(); selectingDelete = true">
            <template #prefix><Trash2 :size="16" aria-hidden="true" /></template>{{ t("tableDeletion.bulk") }}
          </Button>
        </MenuActionPopover>
      </div>
    </PageHeader>
    <div class="card mb-5 flex flex-wrap items-center gap-3 p-3">
      <div class="relative w-full sm:w-72">
        <TextInput size="lg" variant="outline"
          v-model="query"
          type="search"
          :aria-label="t('pages.tables.search')"
          :placeholder="t('pages.tables.search')">
          <template #prefix>
            <Search :size="15" aria-hidden="true" />
          </template>
        </TextInput>
      </div>
      <Select
        size="lg"
        variant="outline"
        v-model="selectedBranchId"
        class="!w-auto max-w-full"
        :aria-label="t('menus.branch')"
        @update:model-value="selectedGroupId = ''"
        :options="[
          { label: t('menus.allBranches'), value: '' },
          ...store.branches.map(branch => ({ label: branch.name, value: branch.id })),
        ]"
      />
      <Select
        size="lg"
        variant="outline"
        v-model="selectedGroupId"
        class="!w-auto max-w-full sm:max-w-xs"
        :aria-label="t('pages.tables.groups')"
        :options="[
          { label: t('pages.tables.allGroups'), value: '' },
          ...visibleGroups.map(group => ({ label: [group.name, (!selectedBranchId ? [' · ', branchName(group.branchId)].join('') : '')].join(''), value: group.id })),
        ]"
      />
      <span class="text-sm font-semibold text-black/55">
        {{ t("pages.tables.count", { count: filteredTables.length }) }}
      </span>
      <div
        v-if="selectingDelete && !admin.isReadOnly"
        class="flex w-full flex-wrap items-center gap-2 border-t border-black/10 pt-3"
      >
        <span class="mr-1 text-sm font-bold text-black/60" role="status">
          {{ t("tableDeletion.selected", { tables: selectedTableIds.length, groups: selectedGroupIds.length }) }}
        </span>
        <Button variant="subtle" size="lg" type="button" :disabled="busy || !filteredTables.length" @click="selectMatchingTables">
          {{ t("tableDeletion.selectTables") }}
        </Button>
        <Button variant="subtle" size="lg" type="button" :disabled="busy || !visibleGroups.length" @click="selectVisibleGroups">
          {{ t("tableDeletion.selectGroups") }}
        </Button>
        <Button variant="subtle" size="lg" type="button" :disabled="busy || !hasSelection" @click="clearDeleteSelection">
          {{ t("menus.unselectAll") }}
        </Button>
        <Button variant="subtle" size="lg" type="button" :disabled="busy" @click="closeBulkDelete">
          {{ t("common.cancel") }}
        </Button>
        <Button variant="subtle" size="lg"
          type="button"
          class="text-red-700"
          :disabled="busy || !hasSelection"
          @click="requestDelete(selectedTableIds, selectedGroupIds)"
        >
          {{ t("tableDeletion.deleteSelected") }}
        </Button>
      </div>
    </div>

    <div v-if="store.loading" class="card grid min-h-80 place-items-center">
      <Spinner class="!size-[32px] text-black/25" />
    </div>

    <div v-else class="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside class="card min-w-0 p-3">
        <h2 class="display m-0 px-2 pb-3 pt-1 text-lg">{{ t("pages.tables.groups") }}</h2>

        <Button
          type="button"
          size="lg"
          :variant="!selectedGroupId ? 'solid' : 'ghost'"
          class="mb-2 w-full !justify-start text-start"
          :aria-pressed="!selectedGroupId"
          @click="selectedGroupId = ''"
        >
          <template #prefix><LayoutGrid :size="17" aria-hidden="true" /></template>{{ t("pages.tables.allTables") }}
          <template #suffix>
          <Badge :class="!selectedGroupId ? 'bg-white/10' : 'bg-black/[.06]'" class="ml-auto rounded-full px-2 py-0.5 text-xs">{{ branchTables.length }}</Badge>
        </template>
        </Button>

        <div
          v-for="group in visibleGroups"
          :key="group.id"
          class="mb-1 flex items-center gap-1"
        >
          <Checkbox
            v-if="selectingDelete && !admin.isReadOnly"
            :model-value="selectedGroupIds.includes(group.id)"
            class="shrink-0"
            :disabled="busy"
            :aria-label="t('tableDeletion.selectGroup', { name: group.name })"
            @update:model-value="selectedGroupIds = setIdSelected(selectedGroupIds, group.id, Boolean($event))"
          />
          <Button
            type="button"
            size="lg"
            :variant="selectedGroupId === group.id ? 'solid' : 'ghost'"
            class="admin-row-button !h-auto min-h-11 min-w-0 flex-1 !shrink !justify-start !px-2 py-2 text-start"
            :aria-pressed="selectedGroupId === group.id"
            @click="selectedGroupId = group.id"
          >
            <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <strong class="block text-sm leading-snug">{{ group.name }}</strong>
              <small class="mt-0.5 block text-[11px] opacity-70">
                {{ branchName(group.branchId) }}
                <span v-if="!isActive(group.isActive)"> · {{ t("pages.tables.archived") }}</span>
                <span v-else> · {{ t("pages.tables.activeCount", { count: group.activeTableCount || 0 }) }}</span>
              </small>
            </span>
            <Badge :class="selectedGroupId === group.id ? 'bg-white/10' : 'bg-cream text-black/60'" :aria-label="t('pages.tables.count', { count: group.tableCount || 0 })" class="shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums">{{ group.tableCount || 0 }}</Badge>
          </Button>
          <MenuActionPopover
            v-if="!selectingDelete && !admin.isReadOnly"
            v-slot="{ close }"
            compact
            :label="t('common.actionsFor', { name: group.name })"
            :disabled="busy"
          >
            <Button variant="ghost" type="button" @click="close(); openEditGroup(group)">
              <template #prefix><Pencil :size="16" aria-hidden="true" /></template>{{ t("common.edit") }}
            </Button>
            <Button variant="ghost"
              type="button"
              :disabled="!canMoveGroup(group, -1)"
              @click="close(); moveGroup(group, -1)"
            >
              <template #prefix><ArrowUp :size="16" aria-hidden="true" /></template>{{ t("common.moveUp") }}
            </Button>
            <Button variant="ghost"
              type="button"
              :disabled="!canMoveGroup(group, 1)"
              @click="close(); moveGroup(group, 1)"
            >
              <template #prefix><ArrowDown :size="16" aria-hidden="true" /></template>{{ t("common.moveDown") }}
            </Button>
            <Button variant="ghost"
              type="button"
              class="text-red-700"
              @click="close(); requestDelete([], [group.id], t('tableDeletion.deleteGroup', { name: group.name }))"
            >
              <template #prefix><Trash2 :size="16" aria-hidden="true" /></template>{{ t("common.delete") }}
            </Button>
          </MenuActionPopover>
        </div>

        <div
          v-if="!store.groups.length"
          class="rounded-2xl border border-dashed border-black/10 p-5 text-center text-sm text-black/40"
        >
          បន្ថែមតំបន់អង្គុយដំបូងរបស់អ្នក ដើម្បីរៀបចំតុ។
        </div>
      </aside>

      <section class="min-w-0 space-y-3">
        <article
          v-for="table in filteredTables"
          :key="table.id"
          class="card flex items-start gap-3 p-3 sm:items-center sm:gap-4 sm:p-4"
        >
          <Checkbox
            v-if="selectingDelete && !admin.isReadOnly"
            :model-value="selectedTableIds.includes(table.id)"
            class="shrink-0"
            :disabled="busy"
            :aria-label="t('tableDeletion.selectTable', { name: table.code })"
            @update:model-value="selectedTableIds = setIdSelected(selectedTableIds, table.id, Boolean($event))"
          />
          <span
            class="grid size-12 shrink-0 place-items-center rounded-xl bg-cream text-black/30 sm:size-20 sm:rounded-2xl"
          >
            <Armchair :size="28" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex flex-wrap items-baseline gap-2">
              <h3 class="m-0 min-w-0 font-bold [overflow-wrap:anywhere]">{{ table.label }}</h3>
              <Badge theme="green" class="max-w-full uppercase [overflow-wrap:anywhere]">{{ table.code }}</Badge>
            </div>
            <p class="m-0 text-xs font-medium text-black/55 [overflow-wrap:anywhere]">
              {{ table.groupName }}
            </p>
            <p
              class="mb-0 mt-2 text-[11px] font-bold"
              :class="isTableActive(table) ? 'text-emerald-700' : 'text-black/55'"
            >
              <span aria-hidden="true">{{ isTableActive(table) ? "●" : "○" }}</span>
              {{ t(isTableActive(table) ? "pages.tables.active" : "pages.tables.archived") }}
              <span class="font-normal text-black/50"> · {{ t("pages.tables.qrReady") }}</span>
            </p>
          </div>
          <MenuActionPopover
            v-if="!selectingDelete && !admin.isReadOnly"
            v-slot="{ close }"
            compact
            :label="t('common.actionsFor', { name: table.label })"
            :disabled="busy"
          >
            <Button variant="ghost" type="button" @click="close(); openEditTable(table)">
              <template #prefix><Pencil :size="16" aria-hidden="true" /></template>{{ t("common.edit") }}
            </Button>
            <Button variant="ghost"
              type="button"
              :disabled="!canMoveTable(table, -1)"
              @click="close(); moveTable(table, -1)"
            >
              <template #prefix><ArrowUp :size="16" aria-hidden="true" /></template>{{ t("common.moveUp") }}
            </Button>
            <Button variant="ghost"
              type="button"
              :disabled="!canMoveTable(table, 1)"
              @click="close(); moveTable(table, 1)"
            >
              <template #prefix><ArrowDown :size="16" aria-hidden="true" /></template>{{ t("common.moveDown") }}
            </Button>
            <Button variant="ghost"
              type="button"
              class="text-red-700"
              @click="close(); requestDelete([table.id], [], t('tableDeletion.deleteTable', { name: table.code }))"
            >
              <template #prefix><Trash2 :size="16" aria-hidden="true" /></template>{{ t("common.delete") }}
            </Button>
          </MenuActionPopover>
        </article>

        <div v-if="!filteredTables.length" class="card py-16 text-center">
          <Armchair class="mx-auto text-black/20" :size="44" />
          <h3>រកមិនឃើញតុ</h3>
          <p class="text-sm text-black/40">
            {{
              store.tables.length
                ? "សូមសាកល្បងពាក្យស្វែងរក ឬក្រុមតុផ្សេង។"
                : "បន្ថែមក្រុមតុ រួចបង្កើតតុដំបូងរបស់អ្នក។"
            }}
          </p>
        </div>
      </section>
    </div>

    <ConfirmDialog
      :open="!!pendingDelete"
      :title="pendingDelete?.title ?? ''"
      :message="t(pendingDelete?.includeGroupTables ? 'tableDeletion.confirmWithTables' : 'tableDeletion.confirm', {
        tables: pendingDelete?.tableIds.length ?? 0,
        groups: pendingDelete?.groupIds.length ?? 0,
      })"
      :busy="busy"
      :error="formError"
      @close="pendingDelete = null"
      @confirm="confirmDelete"
    >
      <label v-if="pendingDelete && pendingDelete.groupIds.length" class="mt-4 flex items-center gap-3 text-sm font-semibold">
        <Checkbox v-model="pendingDelete.includeGroupTables" type="checkbox" class="size-4" :disabled="busy" />
        {{ t("tableDeletion.includeGroupTables") }}
      </label>
    </ConfirmDialog>
    <ModalPanel
      :open="groupOpen"
      :close-on-backdrop="false"
      :title="editingGroupId ? 'កែសម្រួលក្រុមតុ' : 'បន្ថែមក្រុមតុ'"
      @close="closeGroup"
    >
      <form id="table-group-form" class="space-y-4" @submit.prevent="saveGroup">
        <label v-if="!editingGroupId"><span class="label">{{ t('menus.branch') }}</span>
          <Select
            size="lg"
            variant="outline"
            v-model="groupForm.branchId"
            required
            :options="[...store.activeBranches.map(branch => ({ label: branch.name, value: branch.id }))]"
          />
        </label>
        <label>
          <span class="label">ឈ្មោះក្រុម</span>
          <TextInput size="lg" variant="outline"
            v-model.trim="groupForm.name"
            required
            placeholder="ឧ. បន្ទប់ទទួលភ្ញៀវធំ"
          />
        </label>
        <label
          v-if="editingGroupId"
          class="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <Checkbox
            v-model="groupForm.isActive"
            type="checkbox"
            class="size-4 accent-black"
          />
          បើកប្រើក្រុមនេះ
        </label>
        <Alert v-if="formError" theme="red" :title="formError" />
      </form>

      <template #footer>
        <Button variant="solid" size="lg"
          type="submit"
          form="table-group-form"
          class="w-full"
          :disabled="busy"
        >
          {{
            busy
              ? "កំពុងរក្សាទុក…"
              : editingGroupId
                ? "រក្សាទុកក្រុម"
                : "បន្ថែមក្រុម"
          }}
        </Button>
      </template>
    </ModalPanel>

    <ModalPanel
      :open="tableOpen"
      :close-on-backdrop="false"
      :title="editingTableId ? 'កែសម្រួលតុ' : 'បន្ថែមតុ'"
      @close="closeTable"
    >
      <form
        id="table-editor-form"
        class="space-y-4"
        @submit.prevent="saveTable"
      >
        <label>
          <span class="label">ក្រុមតុ</span>
          <Select
            size="lg"
            variant="outline"
            v-model="tableForm.groupId"
            required
            :options="[
              { label: 'ជ្រើសរើសក្រុម', value: '', disabled: true },
              ...availableGroups.map(group => ({ label: group.name, value: group.id })),
            ]"
          />
        </label>
        <label>
          <span class="label">លេខកូដតុ</span>
          <TextInput size="lg" variant="outline"
            v-model.trim="tableForm.code"
            class="uppercase"
            required
            maxlength="32"
            placeholder="ឧ. T01"
          />
        </label>
        <label>
          <span class="label">ឈ្មោះតុ</span>
          <TextInput size="lg" variant="outline"
            v-model.trim="tableForm.label"
            required
            maxlength="80"
            placeholder="ឧ. តុជិតបង្អួច"
          />
        </label>
        <label
          v-if="editingTableId"
          class="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <Checkbox
            v-model="tableForm.isActive"
            type="checkbox"
            class="size-4 accent-black"
          />
          បើកប្រើតុនេះ
        </label>
        <Alert v-if="formError" theme="red" :title="formError" />
      </form>

      <template #footer>
        <Button variant="solid" size="lg"
          type="submit"
          form="table-editor-form"
          class="w-full"
          :disabled="busy"
        >
          {{
            busy ? "កំពុងរក្សាទុក…" : editingTableId ? "រក្សាទុកតុ" : "បន្ថែមតុ"
          }}
        </Button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "./PageHeader.vue";
import { setIdSelected } from "../utils/selection";
import { Badge, Alert, Button, Checkbox, Select, TextInput, Spinner } from "frappe-ui";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Armchair,
  ArrowDown,
  ArrowUp,
  FolderPlus,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-vue-next";
import ConfirmDialog from "./ConfirmDialog.vue";
import MenuActionPopover from "./MenuActionPopover.vue";
import ModalPanel from "./ModalPanel.vue";
import { useAdminStore } from "../stores/admin";
import { useQrDesignStore } from "../stores/qrDesigns";
import type { RestaurantTable, TableGroup } from "../types/qrDesign";

const admin = useAdminStore();
const store = useQrDesignStore();
const { t } = useI18n();
const query = ref("");
const selectedBranchId = ref("");
const selectedGroupId = ref("");
const groupOpen = ref(false);
const tableOpen = ref(false);
const editingGroupId = ref("");
const editingTableId = ref("");
const busy = ref(false);
const formError = ref("");
const selectingDelete = ref(false);
const selectedTableIds = ref<string[]>([]);
const selectedGroupIds = ref<string[]>([]);
const pendingDelete = ref<{
  title: string;
  tableIds: string[];
  groupIds: string[];
  includeGroupTables: boolean;
} | null>(null);
const hasSelection = computed(() => selectedTableIds.value.length + selectedGroupIds.value.length > 0);
const groupForm = reactive({ name: "", branchId: "", isActive: true });
const tableForm = reactive({
  groupId: "",
  code: "",
  label: "",
  isActive: true,
});

const matchesBranch = (id: string) => !selectedBranchId.value || id === selectedBranchId.value;
const branchName = (id: string) => store.branches.find((branch) => branch.id === id)?.name ?? "";
const visibleGroups = computed(() => store.groups.filter((group) => matchesBranch(group.branchId)));
const branchTables = computed(() => store.tables.filter((table) => matchesBranch(table.branchId)));
const filteredTables = computed(() => {
  const search = query.value.trim().toLowerCase();
  return branchTables.value.filter((table) => {
    const matchesGroup =
      !selectedGroupId.value || table.groupId === selectedGroupId.value;
    const matchesSearch =
      !search ||
      `${table.code} ${table.label} ${table.groupName}`
        .toLowerCase()
        .includes(search);
    return matchesGroup && matchesSearch;
  });
});
watch([selectedBranchId, selectedGroupId, query], () => { selectedTableIds.value = []; });
watch(selectedBranchId, () => { selectedGroupIds.value = []; });

function selectMatchingTables() {
  selectedTableIds.value = filteredTables.value.map(({ id }) => id);
}

function selectVisibleGroups() {
  selectedGroupIds.value = visibleGroups.value.map(({ id }) => id);
}

function clearDeleteSelection() {
  selectedTableIds.value = [];
  selectedGroupIds.value = [];
}

function closeBulkDelete() {
  clearDeleteSelection();
  selectingDelete.value = false;
}

function requestDelete(tableIds: string[], groupIds: string[], title = t("tableDeletion.deleteSelected")) {
  if (busy.value || admin.isReadOnly || (!tableIds.length && !groupIds.length)) return;
  formError.value = "";
  pendingDelete.value = { title, tableIds: [...tableIds], groupIds: [...groupIds], includeGroupTables: false };
}

async function confirmDelete() {
  const selection = pendingDelete.value;
  if (!selection || busy.value || admin.isReadOnly) return;
  await run(async () => {
    const result = await store.deleteTables(selection.tableIds, selection.groupIds, selection.includeGroupTables);
    if (result.deletedGroupIds.includes(selectedGroupId.value)) selectedGroupId.value = "";
    const messages = [t("tableDeletion.result", {
      tables: result.deletedTableIds.length,
      groups: result.deletedGroupIds.length,
    })];
    if (result.keptTableCount) {
      const key = selection.includeGroupTables ? "tableDeletion.keptTablesWithGroups" : "tableDeletion.keptTables";
      messages.push(t(key, { count: result.keptTableCount }));
    }
    if (result.keptGroupCount)
      messages.push(t("tableDeletion.keptGroups", { count: result.keptGroupCount }));
    pendingDelete.value = null;
    closeBulkDelete();
    admin.notify(messages.join(" "));
  });
}

const availableGroups = computed(() => {
  if (!editingTableId.value) return store.activeGroups.filter((group) => matchesBranch(group.branchId));
  const current = store.tables.find(
    (table) => table.id === editingTableId.value,
  );
  return store.groups.filter(
    (group) => group.branchId === current?.branchId && (isActive(group.isActive) || group.id === current?.groupId),
  );
});

const isActive = (value: number | boolean) => value !== 0 && value !== false;
const isTableActive = (table: RestaurantTable) =>
  isActive(table.isActive) && isActive(table.groupIsActive);
const tablesInGroup = (groupId: string) =>
  store.tables.filter((table) => table.groupId === groupId);

function openNewGroup() {
  editingGroupId.value = "";
  const branch = store.activeBranches.find((item) => item.id === selectedBranchId.value)
    ?? store.activeBranches.find((item) => item.isDefault);
  Object.assign(groupForm, { name: "", branchId: branch?.id ?? "", isActive: true });
  formError.value = "";
  groupOpen.value = true;
}

function openEditGroup(group: TableGroup) {
  editingGroupId.value = group.id;
  Object.assign(groupForm, {
    name: group.name,
    isActive: isActive(group.isActive),
  });
  formError.value = "";
  groupOpen.value = true;
}

function closeGroup() {
  if (busy.value) return;
  groupOpen.value = false;
  editingGroupId.value = "";
  formError.value = "";
}

function openNewTable() {
  editingTableId.value = "";
  Object.assign(tableForm, {
    groupId:
      (selectedGroupId.value &&
        availableGroups.value.some(
          (group) => group.id === selectedGroupId.value,
        ) &&
        selectedGroupId.value) ||
      availableGroups.value[0]?.id ||
      "",
    code: "",
    label: "",
    isActive: true,
  });
  formError.value = "";
  tableOpen.value = true;
}

function openEditTable(table: RestaurantTable) {
  editingTableId.value = table.id;
  Object.assign(tableForm, {
    groupId: table.groupId,
    code: table.code,
    label: table.label,
    isActive: isActive(table.isActive),
  });
  formError.value = "";
  tableOpen.value = true;
}

function closeTable() {
  if (busy.value) return;
  tableOpen.value = false;
  editingTableId.value = "";
  formError.value = "";
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  formError.value = "";
  try {
    await action();
  } catch (caught) {
    formError.value =
      caught instanceof Error
        ? caught.message
        : "មិនអាចរក្សាទុកការផ្លាស់ប្តូរបានទេ";
  } finally {
    busy.value = false;
  }
}

async function saveGroup() {
  const wasEditing = Boolean(editingGroupId.value);
  await run(async () => {
    if (editingGroupId.value) {
      const group = store.groups.find(
        (item) => item.id === editingGroupId.value,
      );
      if (!group) throw new Error("រកមិនឃើញក្រុមតុទេ");
      await store.updateGroup({
        ...group,
        name: groupForm.name,
        isActive: groupForm.isActive ? 1 : 0,
      });
    } else {
      await store.addGroup(groupForm.name, groupForm.branchId);
    }
  });
  if (!formError.value) {
    closeGroup();
    admin.notify(wasEditing ? "បានកែប្រែក្រុមតុ" : "បានបន្ថែមក្រុមតុ");
  }
}

async function saveTable() {
  const wasEditing = Boolean(editingTableId.value);
  await run(async () => {
    if (editingTableId.value) {
      const table = store.tables.find(
        (item) => item.id === editingTableId.value,
      );
      if (!table) throw new Error("រកមិនឃើញតុទេ");
      await store.updateTable({
        ...table,
        groupId: tableForm.groupId,
        code: tableForm.code.toUpperCase(),
        label: tableForm.label,
        isActive: tableForm.isActive ? 1 : 0,
      });
    } else {
      await store.addTable({
        groupId: tableForm.groupId,
        code: tableForm.code.toUpperCase(),
        label: tableForm.label,
        isActive: 1,
      });
    }
  });
  if (!formError.value) {
    closeTable();
    admin.notify(wasEditing ? "បានកែប្រែតុ" : "បានបន្ថែមតុ");
  }
}

const siblingGroups = (group: TableGroup) => store.groups.filter((item) => item.branchId === group.branchId);
function canMoveGroup(group: TableGroup, direction: number) {
  const groups = siblingGroups(group);
  const index = groups.findIndex((item) => item.id === group.id);
  return index >= 0 && index + direction >= 0 && index + direction < groups.length;
}

async function moveGroup(group: TableGroup, direction: number) {
  const groups = siblingGroups(group);
  const index = groups.findIndex((item) => item.id === group.id);
  if (!canMoveGroup(group,direction)) return;
  [groups[index], groups[index + direction]] = [
    groups[index + direction],
    groups[index],
  ];
  await run(() => store.reorderGroups(groups));
}

function canMoveTable(table: RestaurantTable, direction: number) {
  const tables = tablesInGroup(table.groupId);
  const index = tables.findIndex((item) => item.id === table.id);
  return (
    index >= 0 && index + direction >= 0 && index + direction < tables.length
  );
}

async function moveTable(table: RestaurantTable, direction: number) {
  const tables = [...tablesInGroup(table.groupId)];
  const index = tables.findIndex((item) => item.id === table.id);
  if (index < 0 || !canMoveTable(table, direction)) return;
  [tables[index], tables[index + direction]] = [
    tables[index + direction],
    tables[index],
  ];
  await run(() => store.reorderTables(table.groupId, tables));
}

onMounted(() => store.load());
</script>
