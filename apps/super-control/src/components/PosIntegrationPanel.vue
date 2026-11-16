<template>
  <section class="panel min-w-0 p-6" aria-labelledby="pos-integration-title">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime/40"
        >
          <PlugZap :size="18" />
        </span>
        <div>
          <h2
            id="pos-integration-title"
            class="display m-0 text-xl font-extrabold"
          >
            POS integration
          </h2>
          <p class="mb-0 mt-1 text-sm leading-6 text-black/45">
            Connect this business’s POS to sync its catalog and receive new order events.
          </p>
        </div>
      </div>
      <span
        v-if="!loading && !loadError"
        class="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
        :class="
          integration
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-black/5 text-black/50'
        "
      >
        {{ integration ? "Connected" : "Not connected" }}
      </span>
    </div>

    <div
      v-if="loading"
      class="mt-6 flex items-center gap-2 text-sm text-black/45"
      role="status"
    >
      <LoaderCircle :size="17" class="animate-spin" />Loading integration…
    </div>
    <div
      v-else-if="loadError"
      class="mt-5 rounded-2xl bg-red-50 p-4"
      role="alert"
    >
      <p class="m-0 text-sm text-red-700">{{ loadError }}</p>
      <button type="button" class="btn-soft mt-3" @click="loadIntegration">
        Try again
      </button>
    </div>
    <template v-else>
      <p
        v-if="!businessActive || subscriptionReadOnly"
        class="mb-0 mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"
      >
        {{
          !businessActive
            ? "Sync is paused while this business is disabled."
            : "Sync is paused until this business’s subscription is renewed."
        }}
        You can still manage its API key.
      </p>
      <dl v-if="integration" class="mb-0 mt-5 grid gap-3 text-sm">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <dt class="text-black/45">Key prefix</dt>
          <dd class="m-0 font-mono text-xs">
            {{ integration.keyPrefix }}••••••••
          </dd>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <dt class="text-black/45">Last successful sync</dt>
          <dd class="m-0 text-right font-medium">
            {{
              integration.lastSyncedAt
                ? displayDate(integration.lastSyncedAt)
                : "Not synced yet"
            }}
          </dd>
        </div>
      </dl>
      <div class="mt-5 rounded-2xl border border-black/[.06] bg-cream p-4">
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-xs font-bold uppercase tracking-[.1em] text-black/45"
            >Sync endpoint · POST</span
          >
          <button
            type="button"
            class="grid size-8 shrink-0 place-items-center rounded-full bg-white hover:bg-black/5"
            aria-label="Copy sync endpoint"
            @click="copyEndpoint('sync')"
          >
            <Check
              v-if="copiedEndpoint === 'sync'"
              :size="14"
              class="text-emerald-700"
            /><Copy v-else :size="14" />
          </button>
        </div>
        <code class="mt-2 block break-all text-xs leading-6 text-ink">{{
          syncUrl
        }}</code>
        <p class="mb-0 mt-2 text-xs leading-5 text-black/45">
          Send the API key as <code>Authorization: Bearer YOUR_KEY</code>.
        </p>
      </div>
      <div v-if="orderSocketUrl" class="mt-3 rounded-2xl border border-black/[.06] bg-cream p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold uppercase tracking-[.1em] text-black/45">Order WebSocket</span>
          <button
            type="button"
            class="grid size-8 shrink-0 place-items-center rounded-full bg-white hover:bg-black/5"
            aria-label="Copy order WebSocket URL"
            @click="copyEndpoint('websocket')"
          >
            <Check v-if="copiedEndpoint === 'websocket'" :size="14" class="text-emerald-700" />
            <Copy v-else :size="14" />
          </button>
        </div>
        <code class="mt-2 block break-all text-xs leading-6 text-ink">{{ orderSocketUrl }}</code>
        <p class="mb-0 mt-2 text-xs leading-5 text-black/45">
          Use the same authorization header when connecting. New orders arrive as <code>order.submitted</code> events.
        </p>
      </div>
      <form class="mt-5 grid gap-3" @submit.prevent="requestKey">
        <label>
          <span class="label">Integration name</span>
          <input
            v-model.trim="name"
            class="input"
            type="text"
            maxlength="120"
            placeholder="e.g. Restaurant POS"
            autocomplete="off"
            :disabled="saving"
            required
          />
        </label>
        <p
          v-if="actionError"
          class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
          role="alert"
        >
          {{ actionError }}
        </p>
        <button
          type="submit"
          class="btn-primary w-full"
          :disabled="saving || !name.trim()"
        >
          <LoaderCircle
            v-if="saving"
            :size="16"
            class="animate-spin"
          /><RefreshCw v-else-if="integration" :size="16" /><KeyRound
            v-else
            :size="16"
          />
          {{
            saving
              ? "Working…"
              : integration
                ? "Rotate API key"
                : "Create API key"
          }}
        </button>
        <button
          v-if="integration"
          type="button"
          class="btn-soft w-full text-red-700"
          :disabled="saving"
          @click="
            confirmAction = 'revoke';
            confirmationError = '';
          "
        >
          <Unplug :size="16" />Revoke API key
        </button>
      </form>
      <p class="mb-0 mt-3 text-xs leading-5 text-black/40">
        A new key is shown once. Store it in your POS server’s secret settings.
      </p>
    </template>
  </section>

  <ModalPanel
    :open="confirmAction !== null"
    :title="
      confirmAction === 'revoke' ? 'Revoke POS API key?' : 'Rotate POS API key?'
    "
    @close="closeConfirmation"
  >
    <p class="mt-0 text-sm leading-6 text-black/60">
      {{
        confirmAction === "revoke"
          ? "The current key will stop working immediately. Existing menu data will stay in place. You can create a new key later to reconnect the POS."
          : "The current key will stop working immediately. Update the POS with the new key to continue syncing. Existing menu data and sync history will stay in place."
      }}
    </p>
    <p
      v-if="confirmationError"
      class="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
      role="alert"
    >
      {{ confirmationError }}
    </p>
    <div class="mt-6 flex flex-wrap justify-end gap-3">
      <button
        type="button"
        class="btn-soft"
        :disabled="saving"
        @click="closeConfirmation"
      >
        Cancel
      </button>
      <button
        type="button"
        :class="confirmAction === 'revoke' ? 'btn-danger' : 'btn-primary'"
        :disabled="saving"
        @click="confirmAction === 'revoke' ? revokeKey() : issueKey()"
      >
        <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
        {{
          saving
            ? "Working…"
            : confirmAction === "revoke"
              ? "Revoke key"
              : "Rotate key"
        }}
      </button>
    </div>
  </ModalPanel>

  <ModalPanel
    :open="Boolean(apiKey)"
    title="Your POS API key"
    @close="dismissKey"
  >
    <p
      class="mt-0 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
    >
      Copy and save this key now. You won’t be able to view it again after
      closing this dialog.
    </p>
    <label>
      <span class="label">API key</span>
      <textarea
        :value="apiKey"
        class="input resize-none break-all font-mono text-xs leading-6"
        rows="3"
        readonly
        spellcheck="false"
        autocomplete="off"
        aria-label="POS API key"
        @focus="selectKey"
      />
    </label>
    <button type="button" class="btn-primary mt-3 w-full" @click="copyKey">
      <Check v-if="keyCopied" :size="16" /><Copy v-else :size="16" />{{
        keyCopied ? "Copied" : "Copy API key"
      }}
    </button>
    <p class="mb-0 mt-4 text-xs leading-5 text-black/45">
      Use it only for this business. Keep it on your POS server.
    </p>
    <p
      v-if="copyError"
      class="mb-0 mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700"
      role="alert"
    >
      {{ copyError }}
    </p>
    <button type="button" class="btn-soft mt-5 w-full" @click="dismissKey">
      Done, I’ve saved the key
    </button>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  Unplug,
} from "lucide-vue-next";
import {
  api,
  formatDate,
  type PosIntegration,
  type PosIntegrationKeyResponse,
  type PosIntegrationResponse,
} from "../api";
import { useSuperStore } from "../stores/super";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  businessId: string;
  businessActive: boolean;
  subscriptionReadOnly: boolean;
}>();
const store = useSuperStore();
const integration = ref<PosIntegration | null>(null);
const syncUrl = ref("");
const orderSocketUrl = computed(() => {
  if (!syncUrl.value) return "";
  const url = new URL("/api/integrations/pos/orders/ws", syncUrl.value);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
});
const name = ref("POS");
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const actionError = ref("");
const confirmationError = ref("");
const confirmAction = ref<"rotate" | "revoke" | null>(null);
const apiKey = ref("");
const keyCopied = ref(false);
const copiedEndpoint = ref<"sync" | "websocket" | null>(null);
const copyError = ref("");
let disposed = false;
const path = computed(
  () =>
    `/api/super/businesses/${encodeURIComponent(props.businessId)}/pos-integration`,
);
const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const displayDate = (value: string) =>
  formatDate(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);

async function loadIntegration() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await api<PosIntegrationResponse>(path.value);
    if (disposed) return;
    integration.value = result.integration;
    syncUrl.value = result.syncUrl;
    name.value = result.integration?.name || "POS";
  } catch (error) {
    if (!disposed)
      loadError.value = message(error, "Could not load the POS integration");
  } finally {
    if (!disposed) loading.value = false;
  }
}
function requestKey() {
  actionError.value = "";
  confirmationError.value = "";
  if (integration.value) confirmAction.value = "rotate";
  else void issueKey();
}
async function issueKey() {
  if (saving.value) return;
  saving.value = true;
  actionError.value = "";
  confirmationError.value = "";
  try {
    const result = await api<PosIntegrationKeyResponse>(path.value, {
      method: "PUT",
      body: JSON.stringify({ name: name.value }),
    });
    if (disposed) return;
    integration.value = result.integration;
    syncUrl.value = result.syncUrl;
    apiKey.value = result.apiKey;
    keyCopied.value = false;
    copyError.value = "";
    confirmAction.value = null;
    store.notify("POS API key created");
  } catch (error) {
    if (disposed) return;
    const value = message(error, "Could not create the POS API key");
    if (confirmAction.value) confirmationError.value = value;
    else actionError.value = value;
  } finally {
    if (!disposed) saving.value = false;
  }
}
async function revokeKey() {
  if (saving.value) return;
  saving.value = true;
  confirmationError.value = "";
  try {
    const result = await api<PosIntegrationResponse>(path.value, {
      method: "DELETE",
    });
    if (disposed) return;
    integration.value = result.integration;
    syncUrl.value = result.syncUrl;
    name.value = "POS";
    actionError.value = "";
    apiKey.value = "";
    confirmAction.value = null;
    store.notify("POS API key revoked");
  } catch (error) {
    if (!disposed)
      confirmationError.value = message(
        error,
        "Could not revoke the POS API key",
      );
  } finally {
    if (!disposed) saving.value = false;
  }
}
function closeConfirmation() {
  if (!saving.value) confirmAction.value = null;
}
function dismissKey() {
  apiKey.value = "";
  keyCopied.value = false;
  copyError.value = "";
}
function selectKey(event: FocusEvent) {
  (event.target as HTMLTextAreaElement).select();
}
async function copyKey() {
  copyError.value = "";
  try {
    await navigator.clipboard.writeText(apiKey.value);
    keyCopied.value = true;
  } catch {
    copyError.value =
      "Could not copy automatically. Select the key and copy it manually.";
  }
}
async function copyEndpoint(endpoint: "sync" | "websocket") {
  actionError.value = "";
  try {
    await navigator.clipboard.writeText(endpoint === "sync" ? syncUrl.value : orderSocketUrl.value);
    copiedEndpoint.value = endpoint;
  } catch {
    actionError.value =
      "Could not copy automatically. Select and copy the endpoint URL.";
  }
}
onMounted(loadIntegration);
onBeforeUnmount(() => {
  disposed = true;
  dismissKey();
});
</script>
