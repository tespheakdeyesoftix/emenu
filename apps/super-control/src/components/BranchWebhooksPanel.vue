<template>
  <section class="mt-5 grid gap-4 border-t border-black/10 pt-5" aria-labelledby="branch-webhooks-title">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="branch-webhooks-title" class="display m-0 text-lg font-bold">Webhooks · {{ branchName }}</h3>
        <p class="mb-0 mt-1 text-sm text-black/60">Send branch events to a public HTTPS API. Local development also supports HTTP on localhost and private IP addresses.</p>
      </div>
      <button class="btn-primary" type="button" :disabled="busy" @click="edit()">Add webhook</button>
    </header>
    <p v-if="error" class="m-0 text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="message" class="m-0 text-sm text-emerald-700" role="status">{{ message }}</p>
    <p v-if="loading" class="m-0 text-sm" role="status">Loading webhooks…</p>
    <p v-else-if="!rules.length" class="m-0 text-sm text-black/60">No webhook rules for this branch.</p>
    <ul v-else class="m-0 grid list-none gap-2 p-0">
      <li v-for="rule in rules" :key="rule.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3">
        <div class="min-w-0">
          <strong class="break-words">{{ rule.name }}</strong>
          <p class="m-0 text-xs text-black/60">
            {{ webhookTables[rule.table].label }} · {{ webhookEvents[rule.event] }} ·
            {{ rule.archived ? "Archived" : rule.enabled ? "Enabled" : "Disabled" }}
          </p>
        </div>
        <div v-if="!rule.archived" class="flex flex-wrap gap-2">
          <button class="btn-soft" type="button" :disabled="busy" @click="edit(rule)">Edit</button>
          <button class="btn-soft" type="button" :disabled="busy" @click="toggle(rule)">
            {{ rule.enabled ? "Disable" : "Enable" }}
          </button>
          <button class="btn-soft" type="button" :disabled="busy" @click="archive(rule)">Archive</button>
        </div>
      </li>
    </ul>

    <form v-if="draft" class="grid gap-4 rounded-xl border border-black/10 p-4" @submit.prevent="save">
      <h4 class="m-0 font-bold">{{ draft.id ? "Edit webhook" : "New webhook" }}</h4>
      <p v-if="draft.id" class="m-0 text-xs text-black/60">Edits apply to future events. Queued deliveries keep their saved configuration.</p>
      <label><span class="label">Name</span><input v-model.trim="draft.name" class="input" required maxlength="100" /></label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label>
          <span class="label">Table</span>
          <select v-model="draft.table" class="input" @change="changeTable">
            <option v-for="(table, key) in webhookTables" :key="key" :value="key">{{ table.label }}</option>
          </select>
        </label>
        <label>
          <span class="label">Event</span>
          <select v-model="draft.event" class="input" @change="sample = ''">
            <option v-for="event in webhookTables[draft.table].events" :key="event" :value="event">{{ webhookEvents[event] }}</option>
          </select>
        </label>
      </div>
      <div class="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label>
          <span class="label">Method</span>
          <select v-model="draft.method" class="input" @change="changeMethod"><option v-for="method in webhookMethods" :key="method">{{ method }}</option></select>
        </label>
        <label><span class="label">Webhook URL</span><input v-model.trim="draft.url" class="input" type="url" required maxlength="2048" placeholder="https://api.example.com/orders" /></label>
      </div>
      <label v-if="webhookDefinition(draft.table).contactFields?.length" class="flex items-start gap-2 text-sm">
        <input v-model="draft.includeBookingContact" type="checkbox" class="mt-1 size-4 accent-ink" @change="sample = ''" />
        Allow the template and filter to use guest name, phone, preference text, and booking note
      </label>
      <label>
        <span class="label">Filter JSON</span>
        <textarea v-model="draft.filter" class="input min-h-20 font-mono" rows="3" spellcheck="false" />
        <span class="mt-1 block text-xs text-black/60">
          All conditions must match. Use eq, neq, in, or changed. The empty array matches every record.
        </span>
        <code v-pre class="block break-words text-xs">[{"field":"status","op":"eq","value":"accepted"}]</code>
      </label>
      <label>
        <span class="label">Headers JSON</span>
        <textarea v-model="draft.headers" class="input min-h-20 font-mono" rows="3" autocomplete="off" spellcheck="false" placeholder="{}" />
        <span class="mt-1 block text-xs text-black/60">
          {{ draft.headerNames.length ? `Saved headers: ${draft.headerNames.join(", ")}. Leave blank to keep them, or enter {} to clear them.` : "Header values are encrypted and hidden after saving." }}
        </span>
      </label>
      <label>
        <span class="label">Body format</span>
        <select v-model="draft.bodyFormat" class="input" :disabled="bodyless(draft.method)" @change="changeBodyFormat">
          <option value="json">JSON</option>
          <option value="text">Raw text or form data</option>
          <option value="none">No body</option>
        </select>
      </label>
      <label v-if="draft.bodyFormat !== 'none'">
        <span class="label">{{ draft.bodyFormat === "json" ? "Body JSON" : "Raw body" }}</span>
        <textarea v-model="draft.body" class="input min-h-28 font-mono" rows="5" spellcheck="false" required @input="sample = ''" />
        <span class="mt-1 block text-xs text-black/60">
          {{ draft.bodyFormat === "json"
            ? "Use a placeholder as the entire JSON value to preserve numbers, arrays, and nulls."
            : "Enter the exact text to send, with placeholders if needed. Use Headers JSON to set Content-Type." }}
        </span>
      </label>
      <details v-if="draft.bodyFormat !== 'none'" class="text-sm">
        <summary class="cursor-pointer font-bold">Available template fields</summary>
        <p class="break-words text-xs">{{ templateFields(draft) }}</p>
        <p v-if="draft.event === 'updated'" class="text-xs">For the previous values, replace <code>record.</code> with <code>previous.</code>.</p>
        <p v-pre class="break-words text-xs">{{event}} · {{eventId}} · {{deliveryId}} · {{businessId}} · {{branchId}} · {{occurredAt}}</p>
      </details>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" type="submit" :disabled="busy">Save webhook</button>
        <button v-if="draft.bodyFormat !== 'none'" class="btn-soft" type="button" :disabled="busy" @click="preview">Preview sample body</button>
        <button class="btn-soft" type="button" :disabled="busy" @click="draft = null">Cancel</button>
      </div>
      <pre v-if="sample" class="m-0 max-h-64 overflow-auto rounded-xl bg-black/5 p-3 text-xs">{{ sample }}</pre>
    </form>

    <div class="grid gap-2 border-t border-black/10 pt-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 class="m-0 font-bold">Delivery history</h4>
          <p class="mb-0 mt-1 text-xs text-black/60">Latest 5 deliveries. Logs expire after 24 hours.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="clearScope" class="input w-auto max-w-full" aria-label="Logs to clear" :disabled="busy">
            <option value="branch">This branch</option>
            <option value="business">This business</option>
            <option v-for="rule in rules" :key="rule.id" :value="`rule:${rule.id}`">
              {{ rule.name }}{{ rule.archived ? " (archived)" : "" }}
            </option>
          </select>
          <button class="btn-soft" type="button" :disabled="busy" @click="confirmClear">Clear logs</button>
          <button class="btn-soft" type="button" :disabled="busy" @click="perform(loadHistory)">Refresh</button>
        </div>
      </header>
      <p v-if="!deliveries.length && !loading" class="m-0 text-sm text-black/60">No deliveries for this branch.</p>
      <ul v-else class="m-0 grid list-none gap-2 p-0">
        <li v-for="delivery in deliveries" :key="delivery.id" class="grid gap-1 rounded-xl border border-black/10 p-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <strong class="break-words">{{ delivery.ruleName }} · {{ delivery.status }}</strong>
            <button v-if="delivery.status === 'failed'" class="btn-soft" type="button" :disabled="busy" @click="retry(delivery.id)">Retry</button>
          </div>
          <span class="break-words text-xs text-black/60">
            {{ webhookTables[delivery.table].label }} · {{ webhookEvents[delivery.event] }} · {{ delivery.recordId }}
          </span>
          <span class="text-xs text-black/60">
            Queued {{ time(delivery.createdAt) }} · {{ delivery.attempts }} {{ delivery.attempts === 1 ? "attempt" : "attempts" }}
            <template v-if="delivery.attemptedAt"> · Last attempt {{ time(delivery.attemptedAt) }}</template>
            <template v-if="delivery.nextAttemptAt"> · Next attempt {{ time(delivery.nextAttemptAt) }}</template>
            <template v-if="delivery.httpStatus"> · HTTP {{ delivery.httpStatus }}</template>
          </span>
          <span v-if="delivery.error" class="text-xs text-black/60">{{ delivery.error }}</span>
          <span v-if="delivery.status === 'blocked'" class="text-xs text-black/60">Waiting for an earlier delivery for this record and host.</span>
          <span class="break-all font-mono text-xs text-black/45">Delivery {{ delivery.id }}</span>
        </li>
      </ul>
    </div>
    <ConfirmDialog
      :open="!!clearTarget" title="Clear webhook logs?" confirm-label="Clear logs" :busy="busy" danger
      :message="`Clear all delivery history for ${clearTarget?.label ?? ''}? Queued deliveries can add new entries when they run.`"
      @close="clearTarget = null" @confirm="clearHistory"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  previewWebhookBody, webhookDefinition, webhookEvents, webhookFields, webhookMethods, webhookTables,
  type WebhookBodyFormat, type WebhookDelivery, type WebhookEvent, type WebhookMethod, type WebhookRule, type WebhookTable,
} from "../../../../shared/branchWebhooks";
import { api } from "../api";
import ConfirmDialog from "./ConfirmDialog.vue";

const props = defineProps<{ businessId: string; branchId: string; branchName: string }>();
const businessBase = `/api/super/businesses/${encodeURIComponent(props.businessId)}`;
const base = `${businessBase}/branches/${encodeURIComponent(props.branchId)}/webhooks`;
type Draft = {
  id?: string; revision?: number; name: string; table: WebhookTable; event: WebhookEvent;
  method: WebhookMethod; url: string; filter: string; body: string; bodyFormat: WebhookBodyFormat; headers: string;
  headerNames: string[]; includeBookingContact: boolean;
};
const draft = ref<Draft | null>(null);
const rules = ref<WebhookRule[]>([]);
const deliveries = ref<WebhookDelivery[]>([]);
const clearScope = ref("branch");
const clearTarget = ref<{ endpoint: string; label: string } | null>(null);
const loading = ref(true);
const busy = ref(false);
const message = ref("");
const error = ref("");
const sample = ref("");
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const time = (unix: number) => new Date(unix * 1000).toLocaleString();
const templateFields = (rule: Draft) => Object.keys(webhookFields(rule.table, rule.includeBookingContact))
  .map(field => "{{record." + field + "}}").join(" · ");
const defaultBody = (table: WebhookTable) => pretty(Object.fromEntries(
  webhookDefinition(table).defaultBodyFields.map(field => [field, "{{record." + field + "}}"]),
));
const bodyless = (method: WebhookMethod) => method === "GET" || method === "HEAD";
const readBody = (rule: Draft): unknown => rule.bodyFormat === "json" ? JSON.parse(rule.body) : rule.bodyFormat === "text" ? rule.body : null;

async function loadRules() {
  rules.value = (await api<{ rules: WebhookRule[] }>(base)).rules;
}

async function loadHistory() {
  deliveries.value = (await api<{ deliveries: WebhookDelivery[] }>(`${base}/deliveries`)).deliveries;
}

function confirmClear() {
  if (clearScope.value === "business") {
    clearTarget.value = { endpoint: `${businessBase}/webhook-deliveries`, label: "this business" };
  } else if (clearScope.value === "branch") {
    clearTarget.value = { endpoint: `${base}/deliveries`, label: `branch “${props.branchName}”` };
  } else {
    const rule = rules.value.find(rule => `rule:${rule.id}` === clearScope.value);
    if (!rule) return;
    clearTarget.value = { endpoint: `${base}/deliveries?webhookId=${encodeURIComponent(rule.id)}`, label: `webhook “${rule.name}”` };
  }
}

function clearHistory() {
  return perform(async () => {
    const target = clearTarget.value;
    if (!target) return;
    clearTarget.value = null;
    await api(target.endpoint, { method: "DELETE" });
    await loadHistory();
    message.value = "Webhook logs cleared.";
  });
}

async function perform(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = message.value = "";
  try { await action(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "The webhook operation failed."; }
  finally { busy.value = false; }
}

onMounted(async () => {
  await perform(async () => { await Promise.all([loadRules(), loadHistory()]); });
  loading.value = false;
});

function edit(rule?: WebhookRule) {
  error.value = message.value = sample.value = "";
  draft.value = rule ? {
    ...rule, bodyFormat: rule.bodyFormat ?? "json", filter: pretty(rule.filter), headers: "",
    body: rule.bodyFormat === "text" ? String(rule.body) : pretty(rule.body),
  } : {
    name: "", table: "orders", event: "inserted", method: "POST", url: "", filter: "[]",
    body: defaultBody("orders"), bodyFormat: "json",
    headers: "", headerNames: [], includeBookingContact: false,
  };
}

function changeTable() {
  if (!draft.value) return;
  const rule = draft.value;
  const { events } = webhookDefinition(rule.table);
  if (!events.includes(rule.event)) rule.event = events[0];
  rule.includeBookingContact = false;
  rule.filter = "[]";
  if (rule.bodyFormat === "json") rule.body = defaultBody(rule.table);
  sample.value = "";
}

function changeMethod() {
  if (draft.value && bodyless(draft.value.method)) draft.value.bodyFormat = "none";
  sample.value = "";
}

function changeBodyFormat() {
  if (draft.value && draft.value.bodyFormat === "json" && !draft.value.body.trim())
    draft.value.body = defaultBody(draft.value.table);
  sample.value = "";
}

function preview() {
  if (!draft.value) return;
  const rule = draft.value;
  error.value = sample.value = "";
  try {
    const result = previewWebhookBody(readBody(rule), rule.table, rule.event, rule.includeBookingContact, rule.bodyFormat);
    sample.value = rule.bodyFormat === "text" ? String(result) : pretty(result);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Enter a valid JSON body."; }
}

function save() {
  return perform(async () => {
    const rule = draft.value;
    if (!rule) return;
    const body = readBody(rule);
    previewWebhookBody(body, rule.table, rule.event, rule.includeBookingContact, rule.bodyFormat);
    await api(rule.id ? `${base}/${rule.id}` : base, {
      method: rule.id ? "PUT" : "POST",
      body: JSON.stringify({
        name: rule.name, table: rule.table, event: rule.event, url: rule.url, method: rule.method,
        revision: rule.revision, includeBookingContact: rule.includeBookingContact,
        filter: JSON.parse(rule.filter), body, bodyFormat: rule.bodyFormat,
        ...(rule.headers.trim() ? { headers: JSON.parse(rule.headers) } : {}),
      }),
    });
    draft.value = null;
    await loadRules();
    message.value = rule.id ? "Webhook saved." : "Webhook saved as disabled. Enable it to start delivery.";
  });
}

function toggle(rule: WebhookRule) {
  return perform(async () => {
    await api(`${base}/${rule.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !rule.enabled, revision: rule.revision }) });
    await Promise.all([loadRules(), loadHistory()]);
    message.value = rule.enabled ? "Webhook disabled." : "Webhook enabled.";
  });
}

function archive(rule: WebhookRule) {
  if (!window.confirm(`Archive “${rule.name}” and stop its pending deliveries?`)) return;
  return perform(async () => {
    await api(`${base}/${rule.id}`, { method: "DELETE" });
    if (draft.value?.id === rule.id) draft.value = null;
    await Promise.all([loadRules(), loadHistory()]);
    message.value = "Webhook archived.";
  });
}

function retry(id: string) {
  return perform(async () => {
    await api(`${base}/deliveries/${id}/retry`, { method: "POST" });
    await loadHistory();
    message.value = "Delivery queued for retry.";
  });
}
</script>
