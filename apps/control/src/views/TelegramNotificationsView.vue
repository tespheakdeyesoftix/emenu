<template>
  <div>
    <PageHeader
      :title="t('nav.telegramNotifications')"
      :description="t('telegram.description')"
      eyebrow=""
    >
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-soft" @click="historyOpen = true">
          <History :size="16" aria-hidden="true" />{{
            t("telegram.history.title")
          }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="loading || !!loadError"
          @click="open()"
        >
          <Plus :size="16" aria-hidden="true" />{{ t("telegram.new") }}
        </button>
      </div>
    </PageHeader>
    <p v-if="loading" class="card p-5" role="status">
      {{ t("common.loading") }}
    </p>
    <p v-if="loadError" class="card p-5 text-sm text-red-700" role="alert">
      {{ loadError }}
    </p>
    <p
      v-else-if="!loading && !rules.length"
      class="card p-5 text-sm text-black/60"
    >
      {{ t("telegram.empty") }}
    </p>
    <div v-else-if="!loading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="rule in rules"
        :key="rule.id"
        class="card min-w-0 space-y-3 p-4"
      >
        <div class="flex flex-wrap gap-2 text-xs font-bold text-black/60">
          <span class="rounded-full bg-cream px-2 py-1">{{
            t(`telegram.sources.${rule.source}`)
          }}</span>
          <span class="rounded-full bg-cream px-2 py-1">{{
            branchName(rule.branchId)
          }}</span>
        </div>
        <h2 class="m-0 break-words text-base font-bold">{{ rule.title }}</h2>
        <p class="m-0 break-words text-sm text-black/60">{{ rule.chatId }}</p>
        <p class="m-0 text-xs font-semibold text-black/60">
          {{ t(rule.enabled ? "telegram.active" : "telegram.paused") }}
          <template v-if="rule.lastStatus">
            · {{ t(`telegram.delivery.${rule.lastStatus}`) }}</template
          >
        </p>
        <button type="button" class="btn-soft" @click="open(rule)">
          <Pencil :size="14" aria-hidden="true" />{{ t("telegram.edit") }}
        </button>
      </article>
    </div>

    <TelegramDeliveryHistory v-if="historyOpen" @close="historyOpen = false" />

    <ModalPanel
      :open="editing"
      size="large"
      :title="t(draft.id ? 'telegram.edit' : 'telegram.new')"
      :close-on-backdrop="false"
      @close="close"
    >
      <form
        id="telegram-notification-form"
        class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]"
        @submit.prevent="save"
      >
        <div class="min-w-0 space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              ><span class="label">{{ t("telegram.source") }}</span>
              <select
                v-model="draft.source"
                class="input"
                @change="changeSource"
              >
                <option
                  v-for="source in telegramSources"
                  :key="source"
                  :value="source"
                >
                  {{ t(`telegram.sources.${source}`) }}
                </option>
              </select>
            </label>
            <label
              ><span class="label">{{ t("menus.branch") }}</span>
              <select v-model="draft.branchId" class="input">
                <option value="">{{ t("menus.allBranches") }}</option>
                <option
                  v-for="branch in branches"
                  :key="branch.id"
                  :value="branch.id"
                >
                  {{ branch.name }}
                </option>
              </select>
            </label>
            <div>
              <label class="block">
                <span class="label">{{ t("telegram.chat") }}</span>
                <input
                  v-model.trim="draft.chatId"
                  class="input"
                  required
                  :maxlength="maxTelegramChatListLength"
                  placeholder="-1001234567890, 123456789"
                  aria-describedby="telegram-chat-help"
                />
              </label>
              <p
                id="telegram-chat-help"
                class="mb-0 mt-1 text-xs text-black/60"
              >
                {{ t("telegram.chatHelp", { count: maxTelegramChatsPerRule }) }}
              </p>
            </div>
            <label
              ><span class="label">{{ t("telegram.token") }}</span>
              <input
                v-model.trim="draft.botToken"
                class="input"
                type="password"
                autocomplete="new-password"
                :required="!draft.id"
                maxlength="121"
                :placeholder="draft.id ? t('telegram.keepToken') : ''"
              />
            </label>
          </div>
          <label class="block"
            ><span class="label">{{ t("telegram.title") }}</span>
            <input
              v-model="draft.title"
              class="input"
              required
              maxlength="160"
            />
          </label>
          <label class="block"
            ><span class="label">{{ t("telegram.message") }}</span>
            <textarea
              v-model="draft.message"
              class="input min-h-52 font-mono"
              required
              maxlength="6000"
              spellcheck="false"
            />
          </label>
          <fieldset
            v-if="draft.source === 'Order'"
            class="min-w-0 rounded-2xl border border-black/10 p-3"
          >
            <legend class="px-1 text-sm font-bold">
              {{ t("telegram.orderButtons.title") }}
            </legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="min-w-0 space-y-2">
                <label class="flex items-center gap-2 text-sm font-bold">
                  <input v-model="draft.showAcceptButton" type="checkbox" />
                  {{ t("telegram.orderButtons.showAccept") }}
                </label>
                <label class="block">
                  <span class="label">{{
                    t("telegram.orderButtons.acceptUrl")
                  }}</span>
                  <input
                    v-model.trim="draft.acceptUrl"
                    class="input"
                    type="text"
                    inputmode="url"
                    :maxlength="maxTelegramOrderActionUrlLength"
                    :required="draft.showAcceptButton"
                    placeholder="https://"
                    aria-describedby="telegram-order-buttons-help"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </label>
              </div>
              <div class="min-w-0 space-y-2">
                <label class="flex items-center gap-2 text-sm font-bold">
                  <input v-model="draft.showCancelButton" type="checkbox" />
                  {{ t("telegram.orderButtons.showCancel") }}
                </label>
                <label class="block">
                  <span class="label">{{
                    t("telegram.orderButtons.cancelUrl")
                  }}</span>
                  <input
                    v-model.trim="draft.cancelUrl"
                    class="input"
                    type="text"
                    inputmode="url"
                    :maxlength="maxTelegramOrderActionUrlLength"
                    :required="draft.showCancelButton"
                    placeholder="https://"
                    aria-describedby="telegram-order-buttons-help"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </label>
              </div>
            </div>
            <p
              id="telegram-order-buttons-help"
              class="mb-0 mt-2 text-xs text-black/60"
            >
              {{ t("telegram.orderButtons.help", orderUrlFields) }}
            </p>
          </fieldset>
          <div>
            <label class="block max-w-52">
              <span class="label">{{ t("telegram.historyDays") }}</span>
              <input
                v-model.number="draft.historyDays"
                class="input"
                type="number"
                :min="minTelegramDeliveryRetentionDays"
                :max="maxTelegramDeliveryRetentionDays"
                step="1"
                required
                aria-describedby="telegram-history-days-help"
              />
            </label>
            <p
              id="telegram-history-days-help"
              class="mb-0 mt-1 text-xs text-black/60"
            >
              {{
                t("telegram.historyDaysHelp", {
                  min: minTelegramDeliveryRetentionDays,
                  max: maxTelegramDeliveryRetentionDays,
                })
              }}
            </p>
          </div>
          <label class="flex items-center gap-2 text-sm font-bold">
            <input v-model="draft.enabled" type="checkbox" />{{
              t("telegram.enabled")
            }}
          </label>
          <p v-if="actionError" class="m-0 text-sm text-red-700" role="alert">
            {{ actionError }}
          </p>
        </div>
        <aside class="min-w-0 space-y-3 rounded-2xl bg-cream p-4">
          <h3 class="m-0 text-sm font-bold">
            {{ t("telegram.templateHelp") }}
          </h3>
          <p class="m-0 text-xs leading-5 text-black/65">
            {{ t("telegram.templateInstructions") }}
          </p>
          <pre
            class="m-0 whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs"
            v-text="templates[draft.source].message"
          />
          <p class="m-0 text-xs leading-5 text-black/65">
            {{ t("telegram.formatters") }}
            <code>format_date</code>, <code>format_datetime</code>,
            <code>format_currency</code>
          </p>
          <details>
            <summary class="cursor-pointer text-xs font-bold">
              {{ t("telegram.sampleFields") }}
            </summary>
            <pre
              class="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 text-xs"
              >{{
                JSON.stringify({ doc: examples[draft.source] }, null, 2)
              }}</pre>
          </details>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn-soft"
              :disabled="!!busy || !hasTemplate"
              @click="preview"
            >
              <Eye :size="14" aria-hidden="true" />{{ t("telegram.preview") }}
            </button>
            <button
              type="button"
              class="btn-soft"
              :disabled="!!busy || !canSendTest"
              @click="sendTest"
            >
              <Send :size="14" aria-hidden="true" />{{
                t(
                  busy === "test"
                    ? "telegram.sendingTest"
                    : "telegram.sendTest",
                )
              }}
            </button>
          </div>
          <p
            v-if="rendered"
            class="m-0 whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-sm"
            role="status"
          >
            {{ rendered }}
          </p>
          <div
            v-if="testResults.length"
            class="rounded-xl bg-white p-3"
            role="status"
          >
            <h4 class="m-0 text-sm font-bold">
              {{ t("telegram.testResults") }}
            </h4>
            <ul class="mb-0 mt-2 list-none space-y-2 p-0">
              <li
                v-for="result in testResults"
                :key="result.chatId"
                class="text-sm"
              >
                <div
                  class="flex flex-wrap items-center justify-between gap-x-2"
                >
                  <span class="break-all">{{ result.chatId }}</span>
                  <strong
                    :class="result.ok ? 'text-green-800' : 'text-red-700'"
                  >
                    {{
                      t(result.ok ? "telegram.testSent" : "telegram.testFailed")
                    }}
                  </strong>
                </div>
                <p v-if="!result.ok" class="mb-0 mt-0.5 text-xs text-red-700">
                  {{ result.error }}
                </p>
              </li>
            </ul>
          </div>
        </aside>
      </form>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            v-if="draft.id"
            type="button"
            class="btn-soft text-red-700"
            :disabled="!!busy"
            @click="remove"
          >
            <Trash2 :size="14" aria-hidden="true" />{{ t("telegram.delete") }}
          </button>
          <div class="ml-auto flex gap-2">
            <button
              type="button"
              class="btn-soft"
              :disabled="!!busy"
              @click="close"
            >
              {{ t("common.cancel") }}
            </button>
            <button
              type="submit"
              form="telegram-notification-form"
              class="btn-primary"
              :disabled="!!busy"
            >
              {{ t(busy === "save" ? "common.saving" : "telegram.save") }}
            </button>
          </div>
        </div>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { Eye, History, Pencil, Plus, Send, Trash2 } from "lucide-vue-next";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  maxTelegramChatListLength,
  maxTelegramChatsPerRule,
  maxTelegramDeliveryRetentionDays,
  maxTelegramOrderActionUrlLength,
  minTelegramDeliveryRetentionDays,
  telegramDeliveryRetentionDays,
  telegramSources,
  telegramTemplates,
  type TelegramSource,
  type TelegramTestResult,
  type TelegramDeliveryStatus,
} from "../../../../shared/telegramNotifications";
import ModalPanel from "../components/ModalPanel.vue";
import PageHeader from "../components/PageHeader.vue";
import TelegramDeliveryHistory from "../components/TelegramDeliveryHistory.vue";
import { ControlRequestError, useAdminStore } from "../stores/admin";

type Rule = {
  id: string;
  source: TelegramSource;
  branchId: string | null;
  chatId: string;
  title: string;
  message: string;
  enabled: number;
  historyDays: number;
  showAcceptButton: number;
  acceptUrl: string;
  showCancelButton: number;
  cancelUrl: string;
  lastStatus: TelegramDeliveryStatus | null;
};
type Branch = { id: string; name: string; isActive: number };

const { t } = useI18n();
const admin = useAdminStore();
const endpoint = "/api/admin/telegram-notifications";
const orderUrlFields = { id: "{{doc.id}}", number: "{{doc.order_number}}" };
const rules = ref<Rule[]>([]);
const branches = ref<Branch[]>([]);
const templates = ref(telegramTemplates);
const examples = ref<Partial<Record<TelegramSource, unknown>>>({});
const loading = ref(true);
const editing = ref(false);
const historyOpen = ref(false);
const busy = ref<"" | "save" | "delete" | "preview" | "test">("");
const loadError = ref("");
const actionError = ref("");
const rendered = ref("");
const testResults = ref<TelegramTestResult[]>([]);
const draft = reactive({
  id: "",
  source: "Order" as TelegramSource,
  branchId: "",
  chatId: "",
  botToken: "",
  enabled: true,
  historyDays: telegramDeliveryRetentionDays,
  showAcceptButton: false,
  acceptUrl: "",
  showCancelButton: false,
  cancelUrl: "",
  ...telegramTemplates.Order,
});
let previousSource = draft.source;
const hasTemplate = computed(() =>
  Boolean(draft.title.trim() && draft.message.trim()),
);
const canSendTest = computed(
  () =>
    hasTemplate.value &&
    Boolean(draft.chatId.trim() && (draft.id || draft.botToken.trim())) &&
    (draft.source !== "Order" ||
      ((!draft.showAcceptButton || !!draft.acceptUrl.trim()) &&
        (!draft.showCancelButton || !!draft.cancelUrl.trim()))),
);

function errorText(cause: unknown) {
  if (cause instanceof ControlRequestError && cause.serverMessage)
    return cause.serverMessage;
  return cause instanceof Error ? cause.message : t("telegram.error");
}
const branchName = (id: string | null) =>
  branches.value.find((branch) => branch.id === id)?.name ??
  t("menus.allBranches");

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await admin.request(endpoint);
    rules.value = data.rules;
    branches.value = data.branches;
    templates.value = data.templates;
    examples.value = data.examples;
  } catch (cause) {
    loadError.value = errorText(cause);
  } finally {
    loading.value = false;
  }
}

function open(rule?: Rule) {
  const source = rule?.source ?? "Order";
  const template = templates.value[source];
  Object.assign(draft, {
    id: rule?.id ?? "",
    source,
    branchId: rule?.branchId ?? "",
    chatId: rule?.chatId ?? "",
    botToken: "",
    title: rule?.title ?? template.title,
    message: rule?.message ?? template.message,
    enabled: rule ? !!rule.enabled : true,
    historyDays: rule?.historyDays ?? telegramDeliveryRetentionDays,
    showAcceptButton: !!rule?.showAcceptButton,
    acceptUrl: rule?.acceptUrl ?? "",
    showCancelButton: !!rule?.showCancelButton,
    cancelUrl: rule?.cancelUrl ?? "",
  });
  previousSource = source;
  rendered.value = "";
  testResults.value = [];
  actionError.value = "";
  editing.value = true;
}

function changeSource() {
  const previous = templates.value[previousSource];
  if (draft.title === previous.title)
    draft.title = templates.value[draft.source].title;
  if (draft.message === previous.message)
    draft.message = templates.value[draft.source].message;
  previousSource = draft.source;
}

watch(
  () => [draft.source, draft.title, draft.message],
  () => {
    rendered.value = "";
  },
);

function close() {
  if (busy.value) return;
  editing.value = false;
  draft.botToken = "";
}

async function preview() {
  if (busy.value) return;
  busy.value = "preview";
  rendered.value = "";
  actionError.value = "";
  const { source, title, message } = draft;
  try {
    const result = await admin.request(`${endpoint}/preview`, {
      method: "POST",
      body: JSON.stringify({ source, title, message }),
    });
    if (
      draft.source === source &&
      draft.title === title &&
      draft.message === message
    )
      rendered.value = result.text;
  } catch (cause) {
    actionError.value = errorText(cause);
  } finally {
    busy.value = "";
  }
}

async function sendTest() {
  if (busy.value || !canSendTest.value) return;
  busy.value = "test";
  actionError.value = "";
  testResults.value = [];
  const {
    id,
    source,
    title,
    message,
    chatId,
    botToken,
    showAcceptButton,
    acceptUrl,
    showCancelButton,
    cancelUrl,
  } = draft;
  try {
    const result = await admin.request(`${endpoint}/test`, {
      method: "POST",
      body: JSON.stringify({
        notificationId: id || null,
        source,
        title,
        message,
        chatId,
        botToken,
        showAcceptButton,
        acceptUrl,
        showCancelButton,
        cancelUrl,
      }),
    });
    testResults.value = result.results;
  } catch (cause) {
    actionError.value = errorText(cause);
  } finally {
    busy.value = "";
  }
}

async function save() {
  if (busy.value) return;
  busy.value = "save";
  actionError.value = "";
  const { id, branchId, ...settings } = draft;
  try {
    await admin.request(id ? `${endpoint}/${id}` : endpoint, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({ ...settings, branchId: branchId || null }),
    });
    editing.value = false;
    draft.botToken = "";
    admin.notify(t("telegram.saved"));
    await load();
  } catch (cause) {
    actionError.value = errorText(cause);
  } finally {
    busy.value = "";
  }
}

async function remove() {
  if (busy.value || !window.confirm(t("telegram.confirmDelete"))) return;
  busy.value = "delete";
  actionError.value = "";
  try {
    await admin.request(`${endpoint}/${draft.id}`, { method: "DELETE" });
    editing.value = false;
    draft.botToken = "";
    await load();
  } catch (cause) {
    actionError.value = errorText(cause);
  } finally {
    busy.value = "";
  }
}

onMounted(() => void load());
</script>
