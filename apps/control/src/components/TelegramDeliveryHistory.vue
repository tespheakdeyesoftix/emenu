<template>
  <ModalPanel
    open
    size="large"
    :title="t('telegram.history.title')"
    :close-on-backdrop="false"
    @close="close"
  >
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <p class="m-0 text-sm text-black/65">
        {{ t("telegram.history.retention") }}
      </p>
      <div class="flex items-end gap-2">
        <label>
          <span class="label">{{ t("telegram.history.status") }}</span>
          <select
            v-model="status"
            class="input"
            :disabled="busy"
            @change="load(0)"
          >
            <option value="">{{ t("telegram.history.allStatuses") }}</option>
            <option v-for="value in statuses" :key="value" :value="value">
              {{ t(`telegram.history.${value}`) }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="btn-soft"
          :disabled="busy"
          @click="load(offset)"
        >
          <RefreshCw :size="15" aria-hidden="true" />{{
            t("telegram.history.refresh")
          }}
        </button>
      </div>
    </div>
    <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="loading" class="text-sm text-black/60" role="status">
      {{ t("common.loading") }}
    </p>
    <p v-else-if="!deliveries.length && !error" class="text-sm text-black/60">
      {{ t("telegram.history.empty") }}
    </p>
    <div v-if="deliveries.length" class="overflow-x-auto" :aria-busy="busy">
      <table class="w-full min-w-[42rem] border-collapse text-start text-sm">
        <thead class="bg-cream text-black/65">
          <tr>
            <th scope="col" class="p-3 text-start">
              {{ t("telegram.history.alert") }}
            </th>
            <th scope="col" class="p-3 text-start">{{ t("telegram.chat") }}</th>
            <th scope="col" class="p-3 text-start">
              {{ t("telegram.history.status") }}
            </th>
            <th scope="col" class="p-3 text-start">
              {{ t("telegram.history.updated") }}
            </th>
            <th scope="col" class="p-3 text-start">
              {{ t("telegram.history.action") }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="delivery in deliveries"
            :key="deliveryKey(delivery)"
            class="border-b border-black/10 align-top"
          >
            <td class="p-3">
              <span class="block text-xs text-black/60">{{
                t(`telegram.sources.${delivery.source}`)
              }}</span>
              <strong class="block break-all">{{ delivery.reference }}</strong>
            </td>
            <td class="break-all p-3">{{ delivery.chatId }}</td>
            <td class="p-3">
              <strong
                :class="{
                  'text-green-800': delivery.status === 'sent',
                  'text-red-700': delivery.status === 'failed',
                }"
              >
                {{ t(`telegram.history.${delivery.status}`) }}
              </strong>
              <span class="ms-2 text-xs text-black/60">{{
                t("telegram.history.attempts", { count: delivery.attempts })
              }}</span>
              <p
                v-if="delivery.error"
                class="mb-0 mt-1 break-words text-xs text-red-700"
              >
                {{ delivery.error }}
              </p>
            </td>
            <td class="p-3 text-xs text-black/65">
              {{ timestamp(delivery.updatedAt) }}
            </td>
            <td class="p-3">
              <button
                v-if="delivery.canRetry"
                type="button"
                class="btn-soft"
                :disabled="busy"
                :aria-label="
                  t('telegram.history.retryChat', { chat: delivery.chatId })
                "
                @click="retry(delivery)"
              >
                {{
                  t(
                    retrying === deliveryKey(delivery)
                      ? "telegram.history.retrying"
                      : "telegram.history.retry",
                  )
                }}
              </button>
              <span
                v-else-if="delivery.status === 'failed'"
                class="text-xs text-black/60"
                >{{ t("telegram.history.retryUnavailable") }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div v-if="offset || hasMore" class="flex items-center gap-2">
          <button
            type="button"
            class="btn-soft"
            :disabled="busy || offset === 0"
            @click="load(Math.max(0, offset - pageSize))"
          >
            {{ t("telegram.history.previous") }}
          </button>
          <button
            type="button"
            class="btn-soft"
            :disabled="busy || !hasMore"
            @click="load(offset + pageSize)"
          >
            {{ t("telegram.history.next") }}
          </button>
        </div>
        <button
          type="button"
          class="btn-soft ms-auto"
          :disabled="!!retrying"
          @click="close"
        >
          {{ t("common.close") }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  type TelegramDeliveryHistoryItem,
  type TelegramDeliveryStatus,
} from "../../../../shared/telegramNotifications";
import { ControlRequestError, useAdminStore } from "../stores/admin";
import ModalPanel from "./ModalPanel.vue";

const emit = defineEmits<{ close: [] }>();
const admin = useAdminStore();
const { t, locale } = useI18n();
const endpoint = "/api/admin/telegram-notifications/history";
const statuses: TelegramDeliveryStatus[] = [
  "failed",
  "pending",
  "sent",
  "cancelled",
];
const status = ref<TelegramDeliveryStatus | "">("");
const deliveries = ref<TelegramDeliveryHistoryItem[]>([]);
const loading = ref(false);
const retrying = ref("");
const busy = computed(() => loading.value || !!retrying.value);
const error = ref("");
const offset = ref(0);
const pageSize = ref(40);
const hasMore = ref(false);
const dates = computed(
  () =>
    new Intl.DateTimeFormat(locale.value === "km" ? "km-KH" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: admin.business.timezone,
    }),
);

const timestamp = (value: number) => dates.value.format(value * 1000);
const deliveryKey = ({
  notificationId,
  sourceId,
  chatId,
}: TelegramDeliveryHistoryItem) => `${notificationId}/${sourceId}/${chatId}`;

function errorText(cause: unknown) {
  if (cause instanceof ControlRequestError && cause.serverMessage)
    return cause.serverMessage;
  return cause instanceof Error ? cause.message : t("telegram.error");
}

async function load(nextOffset = 0) {
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({
      offset: String(nextOffset),
      status: status.value,
    });
    const result = await admin.request(`${endpoint}?${params}`);
    deliveries.value = result.deliveries;
    offset.value = nextOffset;
    pageSize.value = result.pageSize;
    hasMore.value = result.hasMore;
  } catch (cause) {
    error.value = errorText(cause);
  } finally {
    loading.value = false;
  }
}

async function retry(delivery: TelegramDeliveryHistoryItem) {
  if (busy.value || !delivery.canRetry) return;
  retrying.value = deliveryKey(delivery);
  error.value = "";
  const { notificationId, sourceId, chatId } = delivery;
  let retryError = "";
  try {
    await admin.request(`${endpoint}/retry`, {
      method: "POST",
      body: JSON.stringify({ notificationId, sourceId, chatId }),
    });
  } catch (cause) {
    retryError = errorText(cause);
  } finally {
    await load(offset.value);
    if (retryError) error.value = retryError;
    retrying.value = "";
  }
}

function close() {
  if (!retrying.value) emit("close");
}

onMounted(() => void load());
</script>
