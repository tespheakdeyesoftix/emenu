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
          <Select
            size="lg"
            variant="outline"
            v-model="status"
            :disabled="busy"
            @update:model-value="load(0)"
            :options="[
              { label: t('telegram.history.allStatuses'), value: '' },
              ...statuses.map(value => ({ label: t(`telegram.history.${value}`), value: value })),
            ]"
          />
        </label>
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="busy"
          @click="load(offset)"
        >
          <template #prefix><RefreshCw :size="15" aria-hidden="true" /></template>{{
            t("telegram.history.refresh")
          }}
        </Button>
      </div>
    </div>
    <Alert v-if="error" theme="red" :title="error" />
    <LoadingText v-if="loading" :text="t('common.loading')" role="status" />
    <p v-else-if="!deliveries.length && !error" class="text-sm text-black/60">
      {{ t("telegram.history.empty") }}
    </p>
    <div v-if="deliveries.length" class="overflow-x-auto" :aria-busy="busy">
      <List class="w-full min-w-[650px]" :columns="['minmax(120px,1fr)', '115px', 'minmax(145px,1.3fr)', '135px', '100px']">
        <ListHeader class="!h-10 bg-surface-gray-1 text-ink-gray-7">
            <ListHeaderCell >
              {{ t("telegram.history.alert") }}
            </ListHeaderCell>
            <ListHeaderCell >{{ t("telegram.chat") }}</ListHeaderCell>
            <ListHeaderCell >
              {{ t("telegram.history.status") }}
            </ListHeaderCell>
            <ListHeaderCell >
              {{ t("telegram.history.updated") }}
            </ListHeaderCell>
            <ListHeaderCell >
              {{ t("telegram.history.action") }}
            </ListHeaderCell>

        </ListHeader>
          <ListRow
            v-for="delivery in deliveries"
            :key="deliveryKey(delivery)"
            class="border-b border-black/10 align-top"
          >
            <ListCell class="!block py-2.5">
              <span class="block text-xs text-black/60">{{
                t(`telegram.sources.${delivery.source}`)
              }}</span>
              <strong class="block break-all">{{ delivery.reference }}</strong>
            </ListCell>
            <ListCell class="break-all !block py-2.5">{{ delivery.chatId }}</ListCell>
            <ListCell class="!block py-2.5">
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
              <Alert v-if="delivery.error" theme="red" :title="delivery.error" class="mb-0 mt-1" />
            </ListCell>
            <ListCell class="text-xs text-black/65 !block py-2.5">
              {{ timestamp(delivery.updatedAt) }}
            </ListCell>
            <ListCell class="!block py-2.5">
              <Button variant="subtle" size="lg"
                v-if="delivery.canRetry"
                type="button"
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
              </Button>
              <span
                v-else-if="delivery.status === 'failed'"
                class="text-xs text-black/60"
                >{{ t("telegram.history.retryUnavailable") }}</span
              >
            </ListCell>
          </ListRow>
      </List>
    </div>
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div v-if="offset || hasMore" class="flex items-center gap-2">
          <Button variant="subtle" size="lg"
            type="button"
            :disabled="busy || offset === 0"
            @click="load(Math.max(0, offset - pageSize))"
          >
            {{ t("telegram.history.previous") }}
          </Button>
          <Button variant="subtle" size="lg"
            type="button"
            :disabled="busy || !hasMore"
            @click="load(offset + pageSize)"
          >
            {{ t("telegram.history.next") }}
          </Button>
        </div>
        <Button variant="subtle" size="lg"
          type="button"
          class="ms-auto"
          :disabled="!!retrying"
          @click="close"
        >
          {{ t("common.close") }}
        </Button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { List, ListCell, ListHeader, ListHeaderCell, ListRow } from "frappe-ui/list";
import { Alert, LoadingText, Button, Select } from "frappe-ui";
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
