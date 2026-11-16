<template>
  <section class="panel max-w-4xl p-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="display m-0 text-xl font-extrabold">Branches</h2>
        <p class="mt-1 text-sm text-black/55">
          Manage locations and where customers can submit QR orders.
        </p>
      </div>
      <button
        class="btn-primary"
        type="button"
        :disabled="loading || saving || locating"
        @click="edit()"
      >
        Add branch
      </button>
    </header>
    <p v-if="loading" role="status">Loading branches…</p>
    <ul class="divide-y divide-black/10 p-0">
      <li
        v-for="branch in branches"
        :key="branch.id"
        class="flex list-none flex-wrap items-center gap-3 py-3"
      >
        <div class="min-w-0 flex-1">
          <strong>{{ branch.name }}</strong>
          <p class="m-0 break-words text-xs text-black/55">
            {{ branch.slug }} ·
            {{
              branch.isDefault
                ? "Default"
                : branch.isActive
                  ? "Active"
                  : "Archived"
            }}<template v-if="branch.address"> · {{ branch.address }}</template>
          </p>
          <p class="m-0 break-all font-mono text-xs text-black/45">
            {{ branch.id }}
          </p>
        </div>
        <button
          class="btn-soft"
          type="button"
          :aria-expanded="webhookBranch?.id === branch.id"
          :aria-label="`Webhooks for ${branch.name}`"
          @click="webhookBranch = webhookBranch?.id === branch.id ? null : branch"
        >
          Webhooks
        </button>
        <button
          class="btn-soft"
          type="button"
          :disabled="saving || locating"
          @click="edit(branch)"
        >
          Edit
        </button>
      </li>
    </ul>
    <form
      v-if="editing"
      class="mt-5 grid gap-4 border-t border-black/10 pt-5"
      @submit.prevent="save"
    >
      <h3 class="display m-0 text-lg font-bold">
        {{ draft.id ? "Edit branch" : "New branch" }}
      </h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <label
          ><span class="label">Branch name</span
          ><input
            v-model.trim="draft.name"
            class="input"
            maxlength="160"
            required
        /></label>
        <label
          ><span class="label">Link slug</span
          ><input
            v-model.trim="draft.slug"
            class="input"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxlength="80"
            :readonly="Boolean(draft.id)"
            required
        /></label>
      </div>
      <p v-if="draft.isDefault" class="m-0 text-sm text-black/60">
        This branch uses the business profile for its public contact details.
      </p>
      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2">
          <label
            ><span class="label">Address</span
            ><input v-model.trim="draft.address" class="input"
          /></label>
          <label
            ><span class="label">Phone</span
            ><input v-model.trim="draft.phone" class="input" type="tel"
          /></label>
        </div>
        <label
          ><span class="label">Map URL</span
          ><input v-model.trim="draft.mapUrl" class="input" type="url"
        /></label>
        <label class="flex items-center gap-2 text-sm font-bold">
          <input v-model="draft.isActive" type="checkbox" />Active on QR links
        </label>
      </template>
      <fieldset class="m-0 grid min-w-0 gap-3 rounded-2xl border border-black/10 p-4" :disabled="saving || locating">
        <legend class="px-1 text-sm font-bold">QR order submission</legend>
        <p class="m-0 text-sm text-black/60">
          Leave both coordinates or the radius blank to use the corresponding business settings.
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label
            ><span class="label">Latitude</span
            ><input
              v-model="draft.latitude"
              class="input"
              type="number"
              min="-90"
              max="90"
              step="any"
              :required="draft.longitude !== ''"
          /></label>
          <label
            ><span class="label">Longitude</span
            ><input
              v-model="draft.longitude"
              class="input"
              type="number"
              min="-180"
              max="180"
              step="any"
              :required="draft.latitude !== ''"
          /></label>
        </div>
        <button type="button" class="btn-soft justify-self-start" @click="useCurrentLocation">
          {{ locating ? "Getting location…" : "Use current location" }}
        </button>
        <div class="grid gap-3 sm:grid-cols-2">
          <label>
            <span class="label">Submit order</span>
            <select v-model="draft.submitOrderMode" class="input">
              <option value="inherit">Use business setting</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label>
            <span class="label">Ordering radius (m)</span>
            <input v-model="draft.orderRadiusMeters" class="input" type="number" min="1" step="1" placeholder="Use business radius" />
          </label>
        </div>
      </fieldset>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" type="submit" :disabled="saving || locating">
          {{ saving ? "Saving…" : "Save branch" }}
        </button>
        <button
          class="btn-soft"
          type="button"
          :disabled="saving || locating"
          @click="editing = false"
        >
          Cancel
        </button>
      </div>
    </form>
    <p v-if="error" class="m-0 mt-3 text-sm text-red-700" role="alert">
      {{ error }}
    </p>
    <BranchWebhooksPanel v-if="webhookBranch" :key="webhookBranch.id" :business-id="businessId"
      :branch-id="webhookBranch.id" :branch-name="webhookBranch.name" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../api";
import BranchWebhooksPanel from "./BranchWebhooksPanel.vue";
import { currentLocation } from "../utils/currentLocation";

type Branch = {
  id: string;
  name: string;
  slug: string;
  isDefault: number;
  isActive: number;
  address: string;
  phone: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  orderRadiusMeters: number | null;
  enableSubmitOrder: number | null;
};
const props = defineProps<{ businessId: string }>();
const branches = ref<Branch[]>([]);
const webhookBranch = ref<Branch | null>(null);
const loading = ref(true);
const editing = ref(false);
const saving = ref(false);
const locating = ref(false);
const error = ref("");
const blank = () => ({
  id: "",
  name: "",
  slug: "",
  isDefault: false,
  isActive: true,
  address: "",
  phone: "",
  mapUrl: "",
  latitude: "" as number | string,
  longitude: "" as number | string,
  orderRadiusMeters: "" as number | "",
  submitOrderMode: "inherit",
});
const draft = reactive(blank());

function edit(branch?: Branch) {
  Object.assign(
    draft,
    blank(),
    branch
      ? {
          ...branch,
          isDefault: Boolean(branch.isDefault),
          isActive: Boolean(branch.isActive),
          latitude: branch.latitude ?? "",
          longitude: branch.longitude ?? "",
          orderRadiusMeters: branch.orderRadiusMeters ?? "",
          submitOrderMode: branch.enableSubmitOrder == null
            ? "inherit" : branch.enableSubmitOrder ? "enabled" : "disabled",
        }
      : {},
  );
  error.value = "";
  editing.value = true;
}
const branchPath = () => `/api/super/businesses/${props.businessId}/branches`;
onMounted(async () => {
  try {
    branches.value = (await api<{ branches: Branch[] }>(branchPath())).branches;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
});
async function useCurrentLocation() {
  if (locating.value || saving.value) return;
  locating.value = true;
  error.value = "";
  try {
    const coords = await currentLocation();
    draft.latitude = coords.latitude;
    draft.longitude = coords.longitude;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    locating.value = false;
  }
}
async function save() {
  if (saving.value || locating.value) return;
  saving.value = true;
  error.value = "";
  try {
    const path = draft.id ? `${branchPath()}/${draft.id}` : branchPath();
    const { submitOrderMode, ...branch } = draft;
    const result = await api<{ branches: Branch[] }>(path, {
      method: draft.id ? "PUT" : "POST",
      body: JSON.stringify({
        ...branch,
        latitude: draft.latitude === "" ? null : Number(draft.latitude),
        longitude: draft.longitude === "" ? null : Number(draft.longitude),
        orderRadiusMeters: draft.orderRadiusMeters === "" ? null : draft.orderRadiusMeters,
        enableSubmitOrder: submitOrderMode === "inherit" ? null : submitOrderMode === "enabled",
      }),
    });
    branches.value = result.branches;
    editing.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}
</script>
