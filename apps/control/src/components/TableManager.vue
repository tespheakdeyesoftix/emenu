<template>
  <div>
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="display m-0 text-2xl">{{ t("pages.tables.title") }}</h1>
      <div v-if="!admin.isReadOnly" class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn-soft" :disabled="busy || store.loading" @click="openNewGroup">
          <FolderPlus :size="16" aria-hidden="true" />{{ t("pages.tables.addGroup") }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="busy || store.loading || !availableGroups.length"
          @click="openNewTable"
        >
          <Plus :size="16" aria-hidden="true" />{{ t("pages.tables.addTable") }}
        </button>
        <MenuActionPopover
          v-if="!selectingDelete && (filteredTables.length || visibleGroups.length)"
          v-slot="{ close }"
          :label="t('common.moreActions')"
          :disabled="busy || store.loading"
        >
          <button type="button" class="text-red-700" @click="close(); selectingDelete = true">
            <Trash2 :size="16" aria-hidden="true" />{{ t("tableDeletion.bulk") }}
          </button>
        </MenuActionPopover>
      </div>
    </header>
    <div class="card mb-5 flex flex-wrap items-center gap-3 p-3">
      <div class="relative w-full sm:w-72">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
          :size="15"
        />
        <input
          v-model="query"
          type="search"
          class="input !rounded-xl !py-2.5 !pl-9 !text-left !text-xs"
          :aria-label="t('pages.tables.search')"
          :placeholder="t('pages.tables.search')"
        />
      </div>
      <select v-model="selectedBranchId" class="input !w-auto max-w-full" :aria-label="t('menus.branch')" @change="selectedGroupId = ''">
        <option value="">{{ t('menus.allBranches') }}</option>
        <option v-for="branch in store.branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
      </select>
      <select v-model="selectedGroupId" class="input !w-auto max-w-full sm:max-w-xs" :aria-label="t('pages.tables.groups')">
        <option value="">{{ t("pages.tables.allGroups") }}</option>
        <option v-for="group in visibleGroups" :key="group.id" :value="group.id">
          {{ group.name }}<template v-if="!selectedBranchId"> · {{ branchName(group.branchId) }}</template>
        </option>
      </select>
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
        <button type="button" class="btn-soft" :disabled="busy || !filteredTables.length" @click="selectMatchingTables">
          {{ t("tableDeletion.selectTables") }}
        </button>
        <button type="button" class="btn-soft" :disabled="busy || !visibleGroups.length" @click="selectVisibleGroups">
          {{ t("tableDeletion.selectGroups") }}
        </button>
        <button type="button" class="btn-soft" :disabled="busy || !hasSelection" @click="clearDeleteSelection">
          {{ t("menus.unselectAll") }}
        </button>
        <button type="button" class="btn-soft" :disabled="busy" @click="closeBulkDelete">
          {{ t("common.cancel") }}
        </button>
        <button
          type="button"
          class="btn-soft text-red-700"
          :disabled="busy || !hasSelection"
          @click="requestDelete(selectedTableIds, selectedGroupIds)"
        >
          {{ t("tableDeletion.deleteSelected") }}
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="card grid min-h-80 place-items-center">
      <LoaderCircle :size="32" class="animate-spin text-black/25" />
    </div>

    <div v-else class="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside class="card min-w-0 p-3">
        <h2 class="display m-0 px-2 pb-3 pt-1 text-lg">{{ t("pages.tables.groups") }}</h2>

        <button
          type="button"
          class="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
          :class="
            !selectedGroupId
              ? 'bg-ink text-white'
              : 'text-black/55 hover:bg-cream'
          "
          :aria-pressed="!selectedGroupId"
          @click="selectedGroupId = ''"
        >
          <LayoutGrid :size="17" aria-hidden="true" />{{ t("pages.tables.allTables") }}
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-xs"
            :class="!selectedGroupId ? 'bg-white/10' : 'bg-black/[.06]'"
          >
            {{ branchTables.length }}
          </span>
        </button>

        <div
          v-for="group in visibleGroups"
          :key="group.id"
          class="mb-1 flex items-center gap-1"
        >
          <input
            v-if="selectingDelete && !admin.isReadOnly"
            v-model="selectedGroupIds"
            type="checkbox"
            class="size-4 shrink-0 accent-red-600"
            :value="group.id"
            :disabled="busy"
            :aria-label="t('tableDeletion.selectGroup', { name: group.name })"
          />
          <button
            type="button"
            class="flex min-w-0 flex-1 items-start gap-2 rounded-xl px-2 py-2.5 text-start transition"
            :class="
              selectedGroupId === group.id
                ? 'bg-ink text-white'
                : 'hover:bg-cream'
            "
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
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums"
              :class="selectedGroupId === group.id ? 'bg-white/10' : 'bg-cream text-black/60'"
              :aria-label="t('pages.tables.count', { count: group.tableCount || 0 })"
            >{{ group.tableCount || 0 }}</span>
          </button>
          <MenuActionPopover
            v-if="!selectingDelete && !admin.isReadOnly"
            v-slot="{ close }"
            compact
            :label="t('common.actionsFor', { name: group.name })"
            :disabled="busy"
          >
            <button type="button" @click="close(); openEditGroup(group)">
              <Pencil :size="16" aria-hidden="true" />{{ t("common.edit") }}
            </button>
            <button
              type="button"
              :disabled="!canMoveGroup(group, -1)"
              @click="close(); moveGroup(group, -1)"
            >
              <ArrowUp :size="16" aria-hidden="true" />{{ t("common.moveUp") }}
            </button>
            <button
              type="button"
              :disabled="!canMoveGroup(group, 1)"
              @click="close(); moveGroup(group, 1)"
            >
              <ArrowDown :size="16" aria-hidden="true" />{{ t("common.moveDown") }}
            </button>
            <button
              type="button"
              class="text-red-700"
              @click="close(); requestDelete([], [group.id], t('tableDeletion.deleteGroup', { name: group.name }))"
            >
              <Trash2 :size="16" aria-hidden="true" />{{ t("common.delete") }}
            </button>
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
          <input
            v-if="selectingDelete && !admin.isReadOnly"
            v-model="selectedTableIds"
            type="checkbox"
            class="size-4 shrink-0 accent-red-600"
            :value="table.id"
            :disabled="busy"
            :aria-label="t('tableDeletion.selectTable', { name: table.code })"
          />
          <span
            class="grid size-12 shrink-0 place-items-center rounded-xl bg-cream text-black/30 sm:size-20 sm:rounded-2xl"
          >
            <Armchair :size="28" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex flex-wrap items-baseline gap-2">
              <h3 class="m-0 min-w-0 font-bold [overflow-wrap:anywhere]">{{ table.label }}</h3>
              <span
                class="max-w-full rounded-full bg-mint px-2 py-0.5 text-[10px] font-extrabold uppercase [overflow-wrap:anywhere]"
              >
                {{ table.code }}
              </span>
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
            <button type="button" @click="close(); openEditTable(table)">
              <Pencil :size="16" aria-hidden="true" />{{ t("common.edit") }}
            </button>
            <button
              type="button"
              :disabled="!canMoveTable(table, -1)"
              @click="close(); moveTable(table, -1)"
            >
              <ArrowUp :size="16" aria-hidden="true" />{{ t("common.moveUp") }}
            </button>
            <button
              type="button"
              :disabled="!canMoveTable(table, 1)"
              @click="close(); moveTable(table, 1)"
            >
              <ArrowDown :size="16" aria-hidden="true" />{{ t("common.moveDown") }}
            </button>
            <button
              type="button"
              class="text-red-700"
              @click="close(); requestDelete([table.id], [], t('tableDeletion.deleteTable', { name: table.code }))"
            >
              <Trash2 :size="16" aria-hidden="true" />{{ t("common.delete") }}
            </button>
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
        <input v-model="pendingDelete.includeGroupTables" type="checkbox" class="size-4" :disabled="busy" />
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
          <select v-model="groupForm.branchId" class="input" required>
            <option v-for="branch in store.activeBranches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
          </select>
        </label>
        <label>
          <span class="label">ឈ្មោះក្រុម</span>
          <input
            v-model.trim="groupForm.name"
            class="input"
            required
            placeholder="ឧ. បន្ទប់ទទួលភ្ញៀវធំ"
          />
        </label>
        <label
          v-if="editingGroupId"
          class="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <input
            v-model="groupForm.isActive"
            type="checkbox"
            class="size-4 accent-black"
          />
          បើកប្រើក្រុមនេះ
        </label>
        <p v-if="formError" class="m-0 text-xs font-bold text-red-600">
          {{ formError }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="table-group-form"
          class="btn-primary w-full"
          :disabled="busy"
        >
          {{
            busy
              ? "កំពុងរក្សាទុក…"
              : editingGroupId
                ? "រក្សាទុកក្រុម"
                : "បន្ថែមក្រុម"
          }}
        </button>
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
          <select v-model="tableForm.groupId" class="input" required>
            <option value="" disabled>ជ្រើសរើសក្រុម</option>
            <option
              v-for="group in availableGroups"
              :key="group.id"
              :value="group.id"
            >
              {{ group.name }}
            </option>
          </select>
        </label>
        <label>
          <span class="label">លេខកូដតុ</span>
          <input
            v-model.trim="tableForm.code"
            class="input uppercase"
            required
            maxlength="32"
            placeholder="ឧ. T01"
          />
        </label>
        <label>
          <span class="label">ឈ្មោះតុ</span>
          <input
            v-model.trim="tableForm.label"
            class="input"
            required
            maxlength="80"
            placeholder="ឧ. តុជិតបង្អួច"
          />
        </label>
        <label
          v-if="editingTableId"
          class="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <input
            v-model="tableForm.isActive"
            type="checkbox"
            class="size-4 accent-black"
          />
          បើកប្រើតុនេះ
        </label>
        <p v-if="formError" class="m-0 text-xs font-bold text-red-600">
          {{ formError }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="table-editor-form"
          class="btn-primary w-full"
          :disabled="busy"
        >
          {{
            busy ? "កំពុងរក្សាទុក…" : editingTableId ? "រក្សាទុកតុ" : "បន្ថែមតុ"
          }}
        </button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Armchair,
  ArrowDown,
  ArrowUp,
  FolderPlus,
  LayoutGrid,
  LoaderCircle,
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
