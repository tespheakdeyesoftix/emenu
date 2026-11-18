<template>
  <section class="panel grid gap-5 p-6" aria-labelledby="reset-data-title">
    <div>
      <h2 id="reset-data-title" class="display m-0 text-xl font-extrabold">Reset data</h2>
      <p class="mb-0 mt-2 text-sm text-black/60">
        Permanently delete selected records. Prepare and save a CSV backup before confirming.
      </p>
    </div>
    <p v-if="loading" role="status" class="m-0 text-sm">Loading branches…</p>
    <p v-else-if="!branches.length && !error" class="m-0 text-sm">This business has no branches.</p>
    <fieldset v-if="branches.length" class="m-0 grid gap-4 border-0 p-0" :disabled="busy">
      <div class="grid gap-4 sm:grid-cols-2">
        <label>
          <span class="label">Reset scope</span>
          <select v-model="scope" class="input" @change="changeScope">
            <option value="branch">Selected branch</option>
            <option value="business">Whole business</option>
          </select>
        </label>
        <label>
          <span class="label">{{ scope === "branch" ? "Branch" : "Branch for confirmation" }}</span>
          <select v-model="branchId" class="input" @change="changeSelection">
            <option value="">Choose a branch</option>
            <option v-for="branch in branches" :key="branch.id" :value="branch.id">
              {{ branch.name }} ({{ branch.slug }})
            </option>
          </select>
        </label>
      </div>
      <p v-if="scope === 'business'" class="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        This selection affects every branch. The branch you choose is used to confirm the reset.
      </p>
      <fieldset class="m-0 grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-2">
        <legend class="px-1 text-sm font-bold">Data to reset</legend>
        <label v-for="(label, key) in options" :key="key" class="flex items-center gap-2 text-sm">
          <input v-model="selection" type="checkbox" :value="key" class="size-4 accent-ink" @change="changeSelection" />
          {{ label }}
        </label>
      </fieldset>
      <label v-if="canNotify" class="flex items-center gap-2 text-sm">
        <input v-model="sendDeletedWebhooks" type="checkbox" class="size-4 accent-ink" @change="clearBackup" />
        Send Deleted webhooks for the orders or bookings removed by this reset
      </label>
      <p v-if="scope === 'branch'" class="m-0 text-sm leading-6 text-black/55">
        Table groups include their tables. Removing tables also removes their orders. Orders and bookings include
        their dependent rows. Branch delivery logs are matched through the original order or booking.
      </p>
      <p v-else class="m-0 text-sm leading-6 text-black/55">
        Categories include products. Products and menus include their related prices, image links, or menu assignments
        where applicable. Saved orders can block menu removal.
      </p>
      <p v-if="selection.includes('sales')" class="m-0 text-sm leading-6 text-black/55">
        POS sales include their line items and payments. Removing sales changes the totals for any open cashier shifts they belong to.
      </p>
      <button type="button" class="btn-soft justify-self-start" :disabled="!branchId || !selection.length" @click="prepare">
        {{ busy && !backup ? "Preparing…" : "Prepare backup" }}
      </button>

      <template v-if="backup">
        <div class="grid gap-2 rounded-xl border border-black/10 p-4">
          <h3 class="m-0 text-sm font-bold">CSV files and row counts</h3>
          <ul class="m-0 grid list-none gap-1 p-0 text-sm text-black/65 sm:grid-cols-2">
            <li v-for="table in backup.tables" :key="table.name">
              {{ table.name }} · {{ table.rows.length }}
            </li>
          </ul>
          <p v-for="blocker in backup.blockers" :key="blocker" class="m-0 text-sm text-red-700" role="alert">{{ blocker }}</p>
          <p v-if="!hasRows" class="m-0 text-sm text-black/60">There are no matching records.</p>
          <button type="button" class="btn-soft mt-2 justify-self-start" :disabled="!hasRows" @click="download">
            <Download :size="16" /> Download CSV ZIP
          </button>
        </div>
        <div v-if="backup.token && downloadStarted" class="grid gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <label class="flex items-center gap-2 text-sm font-bold">
            <input v-model="backupSaved" type="checkbox" class="size-4" />
            I saved the CSV ZIP backup.
          </label>
          <label v-if="scope === 'business'" class="flex items-center gap-2 text-sm font-bold">
            <input v-model="confirmBusinessWide" type="checkbox" class="size-4" />
            I confirm this reset applies across the whole business.
          </label>
          <label>
            <span class="label">Type the exact branch name to confirm</span>
            <strong class="mb-2 block break-all text-sm">{{ backup.branch.name }}</strong>
            <input v-model="confirmation" type="text" class="input" autocomplete="off" spellcheck="false" />
          </label>
          <button type="button" class="btn-danger justify-self-start"
            :disabled="!backupSaved || confirmation !== backup.branch.name || (scope === 'business' && !confirmBusinessWide)"
            @click="remove">
            <Trash2 :size="16" /> Permanently delete data
          </button>
        </div>
      </template>
    </fieldset>
    <p v-if="error" role="alert" class="m-0 text-sm text-red-700">{{ error }}</p>
    <button v-if="error && !branches.length && !loading" type="button" class="btn-soft justify-self-start" @click="load">
      Try again
    </button>
    <p v-if="message" role="status" class="m-0 text-sm font-bold text-emerald-700">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { Download, Trash2 } from "lucide-vue-next";
import { branchResetOptions, businessResetOptions, type ResetBackup, type ResetScope } from "../../../../shared/businessReset";
import { api, ApiError } from "../api";

const props = defineProps<{ businessId: string }>();
const emit = defineEmits<{ reset: [] }>();
const base = `/api/super/businesses/${encodeURIComponent(props.businessId)}`;
const branches = ref<{ id: string; name: string; slug: string }[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const message = ref("");
const scope = ref<ResetScope>("branch");
const branchId = ref("");
const selection = ref<string[]>([]);
const sendDeletedWebhooks = ref(false);
const canNotify = computed(() => selection.value.includes("orders") || (scope.value === "branch" &&
  selection.value.some(key => ["bookings", "tables", "tableGroups"].includes(key))));
const options = computed(() => scope.value === "branch" ? branchResetOptions : businessResetOptions);
const backup = shallowRef<ResetBackup | null>(null);
const hasRows = computed(() => backup.value?.tables.some(({ rows }) => rows.length > 0));
const downloadStarted = ref(false);
const backupSaved = ref(false);
const confirmBusinessWide = ref(false);
const confirmation = ref("");

function clearBackup() {
  backup.value = null;
  downloadStarted.value = backupSaved.value = confirmBusinessWide.value = false;
  confirmation.value = error.value = message.value = "";
}

function changeScope() {
  selection.value = [];
  changeSelection();
}

function changeSelection() {
  sendDeletedWebhooks.value = false;
  clearBackup();
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    branches.value = (await api<{ branches: typeof branches.value }>(`${base}/branches`)).branches;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not load branches";
  } finally {
    loading.value = false;
  }
}

const payload = () => ({ scope: scope.value, branchId: branchId.value, selection: selection.value,
  sendDeletedWebhooks: canNotify.value && sendDeletedWebhooks.value });

async function prepare() {
  if (busy.value || !branchId.value || !selection.value.length) return;
  clearBackup();
  busy.value = true;
  try {
    backup.value = await api<ResetBackup>(`${base}/reset-data/backup`, {
      method: "POST", body: JSON.stringify(payload()),
    });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not prepare the backup";
  } finally {
    busy.value = false;
  }
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^(?:['\t\r\n]|\s*[=+@-])/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

async function download() {
  if (busy.value || !backup.value || !hasRows.value) return;
  busy.value = true;
  error.value = "";
  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const { name, columns, rows } of backup.value.tables) {
      const lines = [columns.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
      zip.file(`${name}.csv`, lines.join("\r\n") + "\r\n");
    }
    zip.file("backup-info.json", JSON.stringify({
      businessId: props.businessId,
      branch: backup.value.branch,
      scope: scope.value,
      selection: selection.value,
      sendDeletedWebhooks: canNotify.value && sendDeletedWebhooks.value,
      tables: backup.value.tables.map(({ name, rows }) => ({ name, rows: rows.length })),
      csv: "Unquoted empty fields represent NULL. Quoted empty fields represent empty text. A leading apostrophe was added to text that starts with a spreadsheet formula character, apostrophe, tab, CR or LF. Remove the added apostrophe when importing as raw data.",
    }, null, 2));
    const url = URL.createObjectURL(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `emenu-${props.businessId}-${scope.value === "branch" ? branchId.value : "business"}-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    downloadStarted.value = true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not create the CSV ZIP";
  } finally {
    busy.value = false;
  }
}

async function remove() {
  const snapshot = backup.value;
  if (busy.value || !downloadStarted.value || !backupSaved.value || !snapshot?.token ||
    confirmation.value !== snapshot.branch.name || (scope.value === "business" && !confirmBusinessWide.value)) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await api<{ tables: { name: string; count: number }[] }>(`${base}/reset-data/delete`, {
      method: "POST",
      body: JSON.stringify({
        ...payload(), token: snapshot.token, confirmation: confirmation.value,
        backupSaved: backupSaved.value, confirmBusinessWide: confirmBusinessWide.value,
      }),
    });
    const count = result.tables.reduce((total, table) => total + table.count, 0);
    clearBackup();
    message.value = `Reset complete. ${count} ${count === 1 ? "row" : "rows"} affected.`;
    emit("reset");
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === "RESET_BACKUP_STALE") clearBackup();
    error.value = cause instanceof Error ? cause.message : "Could not reset the data";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
