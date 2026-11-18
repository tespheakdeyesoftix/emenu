<template>
  <PageHeader :title="t('nav.posCustomers')">
    <Button v-if="!store.isReadOnly" variant="solid" size="lg" type="button" @click="edit()">
      <template #prefix><Plus :size="16" /></template>
      {{ t(isGroups ? "customers.addGroup" : "customers.addCustomer") }}
    </Button>
  </PageHeader>

  <SettingsTabs v-model="resource" :tabs="tabs" :label="t('nav.posCustomers')">
    <TabPanel :key="resource" :value="resource" as="section" class="card overflow-hidden" :aria-busy="loading">
      <div v-if="!isGroups" class="flex flex-wrap items-end gap-3 border-b border-black/10 p-4">
        <TextInput
          v-model="search" type="search" size="lg" variant="outline" class="min-w-0 flex-[1_1_240px]"
          :aria-label="t('common.search')" :placeholder="t('customers.searchPlaceholder')" :debounce="250" maxlength="120"
        >
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </TextInput>
        <Select v-model="sortBy" :label="t('customers.sortBy')" :options="sortOptions" size="lg" variant="outline" />
        <Select v-model="sortDirection" :label="t('customers.sortDirection')" :options="directionOptions" size="lg" variant="outline" />
      </div>
      <LoadingText v-if="loading" :text="t('common.loading')" role="status" class="p-6" />
      <Alert v-else-if="loadError" theme="red" :title="loadError" class="m-4">
        <template #actions>
          <Button variant="subtle" type="button" @click="load(page)">{{ t("common.tryAgain") }}</Button>
        </template>
      </Alert>
      <p v-else-if="!rows.length" class="p-6 text-sm text-black/55">
        {{ t(isGroups ? "customers.emptyGroups" : search.trim() ? "customers.noMatches" : "customers.emptyCustomers") }}
      </p>
      <div v-else class="overflow-x-auto">
        <ListView
          :key="resource" :columns="columns" :rows="rows" row-key="id" :options="listOptions"
          class="!w-full p-2" :class="isGroups ? '!min-w-[300px]' : '!min-w-[830px]'"
        >
          <template #cell="{ column, row, item }">
            <div v-if="column.key === 'name'" class="min-w-0">
              <p class="m-0 truncate font-semibold" :title="row.name">{{ row.name }}</p>
              <p v-if="row.is_walk_in" class="m-0 text-sm text-ink-gray-5">{{ t("customers.walkIn") }}</p>
            </div>
            <span v-else-if="column.key === 'is_membership'">
              {{ row.is_membership ? t("customers.member") : "—" }}
            </span>
            <div v-else-if="column.key === 'actions'" class="flex justify-end gap-2">
              <Button v-if="!isGroups || !store.isReadOnly" variant="subtle" type="button" @click="edit(row)">
                {{ t(store.isReadOnly ? "customers.view" : "common.edit") }}
              </Button>
              <Button
                v-if="!store.isReadOnly && !row.is_walk_in"
                variant="ghost" theme="red" type="button" @click="confirmDelete(row)"
              >
                {{ t("common.delete") }}
              </Button>
            </div>
            <ListRowItem v-else :column="column" :row="row" :item="item || '—'" :align="column.align" />
          </template>
        </ListView>
      </div>
      <div v-if="!loadError && (page > 1 || hasMore)" class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4">
        <Button variant="subtle" type="button" :disabled="loading || page <= 1" @click="load(page - 1)">
          {{ t("pages.orders.previous") }}
        </Button>
        <span class="text-sm text-black/60">{{ t("pages.orders.page", { page }) }}</span>
        <Button variant="subtle" type="button" :disabled="loading || !hasMore" @click="load(page + 1)">
          {{ t("pages.orders.next") }}
        </Button>
      </div>
    </TabPanel>
  </SettingsTabs>

  <ModalPanel :open="Boolean(draft)" :title="t(editorTitle)" :close-on-backdrop="!busy" @close="closeEditor">
    <form v-if="draft" id="pos-customer-form" class="grid gap-4" @submit.prevent="save">
      <label>
        <span class="label">{{ t("selling.name") }}</span>
        <TextInput v-model.trim="draft.name" size="lg" variant="outline" required maxlength="120" :disabled="editorDisabled" />
      </label>
      <template v-if="!isGroups">
        <Checkbox v-model="draft.is_membership" :label="t('customers.membership')" :disabled="editorDisabled" />
        <label>
          <span class="label">{{ t("customers.code") }}</span>
          <TextInput
            v-model.trim="draft.customer_code" size="lg" variant="outline" maxlength="120"
            :required="draft.is_membership" :disabled="editorDisabled"
          />
        </label>
        <Select
          v-model="draft.customer_group_id" size="lg" variant="outline" :label="t('customers.group')"
          :disabled="editorDisabled || loadingGroups" :options="groupOptions"
        />
        <Alert v-if="groupError" theme="red" :title="groupError">
          <template #actions>
            <Button variant="subtle" type="button" @click="loadGroups(draft)">{{ t("common.tryAgain") }}</Button>
          </template>
        </Alert>
        <div class="grid gap-4 sm:grid-cols-2">
          <label v-for="field in contactFields" :key="field.key">
            <span class="label">{{ t(field.label) }}</span>
            <TextInput
              v-model.trim="draft[field.key]" size="lg" variant="outline"
              :type="field.type" :maxlength="field.limit" :disabled="editorDisabled"
            />
          </label>
          <Select
            v-model="selectedGender" size="lg" variant="outline" :label="t('customers.gender')"
            :disabled="editorDisabled" :options="genderOptions"
          />
          <DateFilter v-model="draft.dob" :label="t('customers.dob')" :disabled="editorDisabled" />
        </div>
        <label>
          <span class="label">{{ t("customers.address") }}</span>
          <Textarea v-model.trim="draft.address" size="lg" variant="outline" :rows="3" maxlength="1000" :disabled="editorDisabled" />
        </label>
        <div class="grid gap-2">
          <p class="label !mb-0">{{ t("customers.photo") }}</p>
          <img
            v-if="photoPreview" :src="photoPreview" :alt="t('customers.photoPreview')"
            class="size-20 rounded-lg object-cover" referrerpolicy="no-referrer"
          />
          <LoadingText v-else-if="loadingPhoto" :text="t('common.loading')" role="status" />
          <div v-if="!store.isReadOnly" class="flex flex-wrap gap-2">
            <ImageUploadButton
              type="button" :label="t(hasPhoto ? 'customers.replacePhoto' : 'customers.uploadPhoto')"
              :disabled="busy" :loading="preparingPhoto" :loading-text="t('customers.preparingPhoto')"
              @select="selectPhoto"
            />
            <Button v-if="hasPhoto" variant="ghost" theme="red" type="button" :disabled="busy || preparingPhoto" @click="clearPhoto">
              {{ t("customers.removePhoto") }}
            </Button>
          </div>
          <Alert v-if="photoError" theme="red" :title="photoError" />
        </div>
      </template>
      <Alert v-if="actionError" theme="red" :title="actionError" />
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="subtle" size="lg" type="button" :disabled="busy" @click="closeEditor">
          {{ t(store.isReadOnly ? "common.close" : "common.cancel") }}
        </Button>
        <Button
          v-if="!store.isReadOnly" variant="solid" size="lg" type="submit" form="pos-customer-form"
          :disabled="busy || loadingGroups || preparingPhoto || Boolean(groupError)"
        >
          {{ t(busy ? "common.saving" : "common.save") }}
        </Button>
      </div>
    </template>
  </ModalPanel>

  <ConfirmDialog
    v-if="deleting" :open="true" :title="t(isGroups ? 'customers.deleteGroup' : 'customers.deleteCustomer')"
    :message="t(isGroups ? 'customers.confirmGroup' : 'customers.confirmCustomer', { name: deleting.name })"
    :busy="busy" :error="actionError" @close="deleting = null" @confirm="remove"
  />
</template>

<script setup lang="ts">
import { Alert, Button, Checkbox, LoadingText, Select, TabPanel, Textarea, TextInput } from "frappe-ui";
import { ListRowItem, ListView } from "frappe-ui/experimental";
import { Plus, Search } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import DateFilter from "../components/DateFilter.vue";
import ImageUploadButton from "../components/ImageUploadButton.vue";
import ModalPanel from "../components/ModalPanel.vue";
import PageHeader from "../components/PageHeader.vue";
import SettingsTabs from "../components/SettingsTabs.vue";
import { ControlRequestError, useAdminStore } from "../stores/admin";
import { compressImageForUpload } from "../utils/imageCompression";

const contactFields = [
  { key: "phone_number", label: "customers.phone", type: "tel", limit: 50 },
  { key: "email", label: "customers.email", type: "email", limit: 254 },
  { key: "external_reference", label: "customers.reference", type: "text", limit: 120 },
] as const;
const customerFields = [
  ...contactFields.map(({ key }) => key), "address", "photo", "customer_group_id", "customer_code", "gender", "dob",
] as const;
type CustomerField = (typeof customerFields)[number];
type Group = { id: string; name: string };
type DirectoryRow = Group & Partial<Record<CustomerField, string | null>> & {
  is_walk_in?: number;
  is_membership?: number;
  has_uploaded_photo?: number;
  customer_group_name?: string | null;
};
type Draft = Group & Record<CustomerField, string> & { is_membership: boolean; hasUploadedPhoto: boolean };

const { t, locale } = useI18n();
const store = useAdminStore();
const base = "/api/admin/pos";
const resource = ref("customers");
const isGroups = computed(() => resource.value === "customer-groups");
const search = ref("");
const sortBy = ref("name");
const sortDirection = ref("asc");
const sortOptions = computed(() => [
  { label: t("selling.name"), value: "name" },
  { label: t("customers.phone"), value: "phone_number" },
  { label: t("customers.code"), value: "customer_code" },
]);
const directionOptions = computed(() => [
  { label: t("customers.ascending"), value: "asc" },
  { label: t("customers.descending"), value: "desc" },
]);
const tabs = computed(() => [
  { id: "customers", label: t("nav.posCustomers") },
  { id: "customer-groups", label: t("customers.groups") },
]);
const columns = computed(() => [
  { key: "name", label: t("selling.name"), width: "minmax(145px, 1.2fr)" },
  ...(!isGroups.value ? [
    { key: "customer_code", label: t("customers.code"), width: "minmax(112px, 0.8fr)" },
    { key: "customer_group_name", label: t("customers.group"), width: "minmax(120px, 0.9fr)" },
    { key: "phone_number", label: t("customers.phone"), width: "minmax(120px, 0.9fr)" },
    { key: "email", label: t("customers.email"), width: "minmax(145px, 1.15fr)" },
    { key: "is_membership", label: t("customers.membership"), width: "105px" },
  ] : []),
  { key: "actions", label: t("customers.actions"), width: "145px", align: "end" },
]);
const listOptions = { selectable: false, rowHeight: 56, getRowRoute: () => null };
const rows = shallowRef<DirectoryRow[]>([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(true);
const loadError = ref("");
let listRequest = 0;

const draft = ref<Draft | null>(null);
const genderOptions = computed(() => [
  { label: t("customers.unspecifiedGender"), value: "" },
  { label: t("customers.male"), value: "Male" },
  { label: t("customers.female"), value: "Female" },
]);
const selectedGender = computed({
  get: () => genderOptions.value.find(({ value }) => value.toLowerCase() === draft.value?.gender.toLowerCase())?.value ?? "",
  set: (value: string | null) => {
    if (draft.value) draft.value.gender = value ?? "";
  },
});
const photoPreview = ref("");
const photoFile = shallowRef<File | null>(null);
const photoRemoved = ref(false);
const loadingPhoto = ref(false);
const preparingPhoto = ref(false);
const photoError = ref("");
const hasPhoto = computed(() => Boolean(photoPreview.value || (!photoRemoved.value && draft.value?.hasUploadedPhoto)));
const groups = shallowRef<Group[]>([]);
const loadingGroups = ref(false);
const groupError = ref("");
const groupOptions = computed(() => [
  { label: t("customers.noGroup"), value: "" },
  ...groups.value.map((group) => ({ label: group.name, value: group.id })),
]);
const deleting = shallowRef<Group | null>(null);
const busy = ref(false);
const editorDisabled = computed(() => busy.value || store.isReadOnly);
const actionError = ref("");
const editorTitle = computed(() => {
  if (isGroups.value) return draft.value?.id ? "customers.editGroup" : "customers.addGroup";
  if (store.isReadOnly) return "customers.viewCustomer";
  return draft.value?.id ? "customers.editCustomer" : "customers.addCustomer";
});

function errorMessage(cause: unknown) {
  if (cause instanceof ControlRequestError && cause.serverMessage && locale.value === "en")
    return cause.serverMessage;
  return cause instanceof Error ? cause.message : t("customers.requestFailed");
}

async function load(nextPage: number) {
  const requestId = ++listRequest;
  const list = resource.value;
  loading.value = true;
  loadError.value = "";
  const params = new URLSearchParams({ page: String(nextPage) });
  if (list === "customers") {
    const term = search.value.trim();
    if (term) params.set("search", term);
    params.set("sort_by", sortBy.value);
    params.set("sort_direction", sortDirection.value);
  }
  try {
    const result = await store.request(`${base}/${list}?${params}`);
    if (requestId !== listRequest) return;
    rows.value = list === "customers" ? result.customers : result.customer_groups;
    page.value = result.page;
    hasMore.value = result.has_more;
  } catch (cause) {
    if (requestId === listRequest) loadError.value = errorMessage(cause);
  } finally {
    if (requestId === listRequest) loading.value = false;
  }
}

async function loadGroups(editor: Draft) {
  loadingGroups.value = true;
  groupError.value = "";
  try {
    const options: Group[] = [];
    let groupPage = 1;
    do {
      const result = await store.request(`${base}/customer-groups?page=${groupPage}&page_size=100`);
      if (draft.value !== editor) return;
      options.push(...result.customer_groups);
      if (!result.has_more) break;
      groupPage += 1;
    } while (true);
    groups.value = options;
  } catch (cause) {
    if (draft.value === editor) groupError.value = errorMessage(cause);
  } finally {
    if (draft.value === editor) loadingGroups.value = false;
  }
}

function setPhotoPreview(url: string) {
  if (photoPreview.value.startsWith("blob:")) URL.revokeObjectURL(photoPreview.value);
  photoPreview.value = url;
}

async function loadPhoto(editor: Draft) {
  loadingPhoto.value = true;
  try {
    const image: Blob = await store.request(`${base}/customers/${encodeURIComponent(editor.id)}/photo`, undefined, "blob");
    if (draft.value === editor && !photoFile.value && !photoRemoved.value)
      setPhotoPreview(URL.createObjectURL(image));
  } catch {
    if (draft.value === editor && !photoFile.value && !photoRemoved.value)
      photoError.value = t("customers.photoLoadFailed");
  } finally {
    if (draft.value === editor) loadingPhoto.value = false;
  }
}

async function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const editor = draft.value;
  input.value = "";
  if (!file || !editor || editorDisabled.value || preparingPhoto.value) return;
  preparingPhoto.value = true;
  photoError.value = "";
  try {
    const compressed = await compressImageForUpload(file);
    if (draft.value === editor) {
      photoFile.value = compressed;
      photoRemoved.value = false;
      photoError.value = "";
      setPhotoPreview(URL.createObjectURL(compressed));
    }
  } catch {
    if (draft.value === editor) photoError.value = t("customers.invalidPhoto");
  } finally {
    if (draft.value === editor) preparingPhoto.value = false;
  }
}

function clearPhoto() {
  photoFile.value = null;
  photoRemoved.value = true;
  photoError.value = "";
  setPhotoPreview("");
}

function edit(row?: DirectoryRow) {
  const values: Record<CustomerField, string> = {
    phone_number: "", email: "", gender: "", dob: "", external_reference: "",
    address: "", photo: "", customer_group_id: "", customer_code: "",
  };
  for (const field of customerFields) values[field] = row?.[field] ?? "";
  draft.value = {
    id: row?.id ?? "", name: row?.name ?? "", ...values,
    is_membership: Boolean(row?.is_membership), hasUploadedPhoto: Boolean(row?.has_uploaded_photo),
  };
  photoFile.value = null;
  photoRemoved.value = false;
  loadingPhoto.value = false;
  preparingPhoto.value = false;
  photoError.value = "";
  setPhotoPreview(values.photo);
  if (draft.value.hasUploadedPhoto) void loadPhoto(draft.value);
  actionError.value = "";
  groupError.value = "";
  loadingGroups.value = false;
  groups.value = row?.customer_group_id && row.customer_group_name
    ? [{ id: row.customer_group_id, name: row.customer_group_name }]
    : [];
  if (!isGroups.value && !store.isReadOnly) void loadGroups(draft.value);
}

function closeEditor() {
  if (busy.value) return;
  draft.value = null;
  setPhotoPreview("");
}

async function save() {
  if (!draft.value?.name || editorDisabled.value || loadingGroups.value || preparingPhoto.value || groupError.value) return;
  const { id, name, photo, hasUploadedPhoto, ...fields } = draft.value;
  if (!isGroups.value && fields.is_membership && !fields.customer_code.trim()) {
    actionError.value = t("customers.codeRequired");
    return;
  }
  const payload = isGroups.value ? { name } : { name, ...fields, ...(photoRemoved.value ? { photo: null } : {}) };
  let body: string | FormData = JSON.stringify(payload);
  if (!isGroups.value && photoFile.value) {
    const form = new FormData();
    form.set("customer", body);
    form.set("photo", photoFile.value);
    body = form;
  }
  busy.value = true;
  actionError.value = "";
  try {
    await store.request(`${base}/${resource.value}${id ? "/" + encodeURIComponent(id) : ""}`, {
      method: id ? "PATCH" : "POST",
      body,
    });
    draft.value = null;
    setPhotoPreview("");
    await load(1);
  } catch (cause) {
    actionError.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}

function confirmDelete(row: Group) {
  actionError.value = "";
  deleting.value = row;
}

async function remove() {
  if (!deleting.value || editorDisabled.value) return;
  busy.value = true;
  actionError.value = "";
  try {
    await store.request(`${base}/${resource.value}/${encodeURIComponent(deleting.value.id)}`, { method: "DELETE" });
    deleting.value = null;
    await load(rows.value.length === 1 && page.value > 1 ? page.value - 1 : page.value);
  } catch (cause) {
    actionError.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}

watch([resource, search, sortBy, sortDirection], () => {
  page.value = 1;
  hasMore.value = false;
  void load(1);
});
onMounted(() => load(1));
onUnmounted(() => {
  draft.value = null;
  setPhotoPreview("");
});
</script>
