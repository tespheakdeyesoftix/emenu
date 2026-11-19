<template>
  <PageHeader :title="t('nav.users')">
    <Button variant="solid" size="lg" icon-left="lucide-user-plus" :disabled="store.isReadOnly || loading || atCapacity" :title="atCapacity ? t('staff.limitReached') : undefined" @click="edit()">
      {{ t("staff.add") }}
    </Button>
  </PageHeader>

  <section class="card overflow-hidden" :aria-busy="loading">
    <LoadingText v-if="loading" :text="t('common.loading')" class="p-6" />
    <Alert v-else-if="error" theme="red" :title="error" class="m-4"
      :primary-action="{ label: t('common.tryAgain'), onClick: load }" />
    <div v-else>
      <div class="border-b border-outline-gray-1 px-5 py-4">
        <p class="m-0 text-base-semibold">{{ capacity.limit === null
          ? t('staff.unlimitedUsers', { count: capacity.current })
          : t('staff.userCapacity', { count: capacity.current, limit: capacity.limit }) }}</p>
        <p class="mb-0 mt-1 text-sm text-ink-gray-5">{{ t('staff.ownerCounts') }}</p>
        <Alert v-if="atCapacity" theme="amber" class="mt-3" :title="t('staff.limitReached')" />
      </div>
      <div class="overflow-x-auto">
      <ListView :columns="columns" :rows="users" row-key="id"
        :options="{ selectable: false, rowHeight: 76 }" class="!w-full !min-w-[650px] p-2">
        <template #cell="{ column, row }">
          <div v-if="column.key === 'name'" class="min-w-0">
            <p class="truncate font-semibold">{{ row.name }}</p>
            <p class="truncate text-sm text-ink-gray-5">{{ row.email }}</p>
          </div>
          <Badge v-else-if="column.key === 'role'" :label="t('staff.roles.' + row.role)"
            :theme="row.role === 'owner' ? 'green' : 'gray'" />
          <span v-else-if="column.key === 'permissions'" class="text-sm text-ink-gray-6">
            {{ t('staff.allowedCount', { count: permissionCount(row), total: userPermissionKeys.length }) }}
          </span>
          <div v-else class="flex justify-end gap-2">
            <span v-if="row.role === 'owner'" class="text-sm text-ink-gray-5">{{ t("staff.accountOwner") }}</span>
            <template v-else>
              <Button variant="subtle" :disabled="store.isReadOnly || row.memberships > 1" @click="edit(row)">{{ t("common.edit") }}</Button>
              <Button variant="ghost" theme="red" :disabled="store.isReadOnly" @click="removeTarget = row">{{ t("staff.remove") }}</Button>
            </template>
          </div>
        </template>
      </ListView>
      </div>
    </div>
  </section>

  <ModalPanel :open="Boolean(draft)" :title="t(draft?.id ? 'staff.edit' : 'staff.add')"
    size="large" :close-on-backdrop="!saving" @close="close">
    <form v-if="draft" id="staff-user-form" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" @submit.prevent="save">
      <div class="space-y-4">
        <TextInput v-model="draft.name" :label="t('staff.name')" size="lg" variant="outline" maxlength="120" required :disabled="saving" />
        <TextInput v-model="draft.email" :label="t('staff.email')" type="email" size="lg" variant="outline" maxlength="254" required :disabled="saving || Boolean(draft.id)" />
        <TextInput v-model="password" :label="t(draft.id ? 'staff.newPassword' : 'staff.password')" type="password"
          size="lg" variant="outline" minlength="8" maxlength="128" :required="!draft.id"
          :description="draft.id ? t('staff.passwordHelp') : undefined" :disabled="saving" autocomplete="new-password" />
        <TextInput v-model="draft.username" :label="t('staff.username')" size="lg" variant="outline" maxlength="40"
          :description="t('staff.usernameHelp')" :disabled="saving" />
        <Select v-model="draft.role" :label="t('staff.role')" :options="roleOptions" size="lg" variant="outline" :disabled="saving" />
        <fieldset v-if="draft.role === 'editor'" class="space-y-2" :disabled="saving">
          <legend class="mb-2 text-base-semibold">{{ t("staff.profiles") }}</legend>
          <p v-if="!profiles.length" class="text-sm text-ink-gray-5">{{ t("staff.noProfiles") }}</p>
          <Checkbox class="!flex w-full" v-for="profile in profiles" :key="profile.id" :label="profile.name" :description="profile.branch"
            :model-value="draft.profile_ids.includes(profile.id)" @update:model-value="toggleProfile(profile.id, $event === true)" />
        </fieldset>
        <p v-else class="text-sm text-ink-gray-5">{{ t("staff.managerProfiles") }}</p>
      </div>
      <fieldset class="space-y-3 rounded-xl border border-outline-gray-1 p-4" :disabled="saving">
        <legend class="px-1 text-base-semibold">{{ t("staff.permissions") }}</legend>
        <Checkbox class="!flex w-full" v-for="key in userPermissionKeys" :key="key" v-model="draft.permissions[key]" :label="t('staff.actions.' + key)" />
      </fieldset>
      <Alert v-if="saveError" theme="red" :title="saveError" class="lg:col-span-2" />
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="subtle" :disabled="saving" @click="close">{{ t("common.cancel") }}</Button>
        <Button variant="solid" type="submit" form="staff-user-form" :loading="saving" :disabled="store.isReadOnly || (!draft?.id && atCapacity)">{{ t("common.save") }}</Button>
      </div>
    </template>
  </ModalPanel>
  <ConfirmDialog :open="Boolean(removeTarget)" :title="t('staff.removeTitle')"
    :message="t('staff.removeMessage', { name: removeTarget?.name })" :confirm-label="t('staff.remove')"
    :busy="removing" :error="removeError" @close="removeTarget = null" @confirm="remove" />
</template>

<script setup lang="ts">
import { Alert, Badge, Button, Checkbox, LoadingText, Select, TextInput } from "frappe-ui";
import { ListView } from "frappe-ui/experimental";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { userPermissionKeys, type UserPermissions } from "../../../../shared/userPermissions";
import { AUTH_VERSION, createPasswordProof } from "../utils/passwordProof";
import { ControlRequestError, useAdminStore } from "../stores/admin";
import PageHeader from "../components/PageHeader.vue";
import ModalPanel from "../components/ModalPanel.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";

type Staff = {
  id: string; name: string; email: string; username: string | null;
  role: "owner" | "manager" | "editor"; permissions: UserPermissions; profile_ids: string[]; memberships: number;
};
type Draft = Omit<Staff, "memberships" | "role" | "username"> & { role: "manager" | "editor"; username: string };
const { t, locale } = useI18n();
const store = useAdminStore();
const users = ref<Staff[]>([]);
const profiles = ref<{ id: string; name: string; branch: string }[]>([]);
const loading = ref(true);
const capacity = ref<{ current: number; limit: number | null }>({ current: 0, limit: null });
const atCapacity = computed(() => capacity.value.limit !== null && capacity.value.current >= capacity.value.limit);
const error = ref("");
const draft = ref<Draft | null>(null);
const password = ref("");
const saving = ref(false);
const saveError = ref("");
const removeTarget = ref<Staff | null>(null);
const removing = ref(false);
const removeError = ref("");
const roleOptions = computed(() => ["editor","manager"].map(value => ({ value, label: t("staff.roles." + value) })));
const columns = computed(() => [
  { key: "name", label: t("staff.name"), width: "minmax(240px,2fr)" },
  { key: "role", label: t("staff.role"), width: "120px" },
  { key: "permissions", label: t("staff.permissions"), width: "minmax(130px,1fr)" },
  { key: "actions", label: "", width: "160px" },
]);
function message(cause: unknown) {
  if (cause instanceof ControlRequestError && cause.serverCode === "PLAN_USER_LIMIT") return t("staff.limitReached");
  return cause instanceof ControlRequestError && cause.serverMessage && locale.value === "en"
    ? cause.serverMessage : cause instanceof Error ? cause.message : t("selling.saveFailed");
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [members, choices] = await Promise.all([store.request("/api/admin/users"), store.request("/api/admin/users/options")]);
    users.value = members.users;
    capacity.value = members.capacity ?? { current: members.users.length, limit: null };
    profiles.value = choices.profiles;
  } catch (cause) { error.value = message(cause); }
  finally { loading.value = false; }
}
function permissionCount(user: Staff) { return userPermissionKeys.filter(key => user.permissions[key]).length; }
function edit(user?: Staff) {
  if (store.isReadOnly || (!user && atCapacity.value)) return;
  draft.value = user ? {
    id: user.id, name: user.name, email: user.email, role: user.role === "manager" ? "manager" : "editor",
    username: user.username ?? "", permissions: { ...user.permissions }, profile_ids: [...user.profile_ids],
  } : {
    id: "", name: "", email: "", username: "", role: "editor", profile_ids: [],
    permissions: Object.fromEntries(userPermissionKeys.map(key => [key, false])) as UserPermissions,
  };
  password.value = "";
  saveError.value = "";
}
function toggleProfile(id: string, enabled: boolean) {
  if (!draft.value) return;
  draft.value.profile_ids = enabled ? [...draft.value.profile_ids, id] : draft.value.profile_ids.filter(value => value !== id);
}
function close() { if (!saving.value) draft.value = null; }
async function save() {
  if (!draft.value || saving.value || store.isReadOnly) return;
  if (!draft.value.id && atCapacity.value) { saveError.value = t("staff.limitReached"); return; }
  saving.value = true;
  saveError.value = "";
  try {
    const { id, ...data } = draft.value;
    const body = { ...data, email: data.email.trim().toLowerCase(), ...(password.value ? {
      passwordProof: await createPasswordProof(data.email, password.value), authVersion: AUTH_VERSION,
    } : {}) };
    await store.request(id ? "/api/admin/users/" + encodeURIComponent(id) : "/api/admin/users",
      { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
    draft.value = null;
    password.value = "";
    await load();
  } catch (cause) {
    saveError.value = message(cause);
    if (cause instanceof ControlRequestError && cause.serverCode === "PLAN_USER_LIMIT") {
      const latest = await store.request("/api/admin/users").catch(() => null);
      if (latest?.capacity) capacity.value = latest.capacity;
    }
  }
  finally { saving.value = false; }
}
async function remove() {
  if (!removeTarget.value || removing.value || store.isReadOnly) return;
  removing.value = true;
  removeError.value = "";
  try {
    await store.request("/api/admin/users/" + encodeURIComponent(removeTarget.value.id), { method: "DELETE" });
    removeTarget.value = null;
    await load();
  } catch (cause) { removeError.value = message(cause); }
  finally { removing.value = false; }
}
onMounted(load);
</script>
