<template>
  <ModalPanel :open="true" :title="t('shiftAudit.title')" size="large" @close="$emit('close')">
    <LoadingText v-if="loading" role="status" class="p-5" />
    <Alert v-else-if="error" theme="red" :title="error" />
    <p v-else-if="!events.length" class="p-5">{{ t("shiftAudit.empty") }}</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-left text-sm">
        <thead class="text-ink-gray-5">
          <tr>
            <th v-for="column in ['time', 'action', 'register', 'operator', 'details']" :key="column" class="p-3">
              {{ t(`shiftAudit.${column}`) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.id" class="border-t align-top">
            <td class="p-3 whitespace-nowrap">{{ time(event.occurred_at, event.timezone) }}</td>
            <td class="p-3">{{ t(`shiftAudit.event.${event.action}`) }}</td>
            <td class="p-3">
              <div>{{ event.profile_name || event.branch_name }}</div>
              <div v-if="event.profile_name" class="text-ink-gray-5">{{ event.branch_name }}</div>
            </td>
            <td class="p-3">{{ event.actor_name || event.actor_id }}</td>
            <td class="p-3">
              <div v-if="event.amount_minor !== null && event.currency">
                {{ formatPosAmount(event.amount_minor, event.currency) }}
              </div>
              <div v-if="event.reason_code">{{ t(`shiftAudit.reason.${event.reason_code}`) }}</div>
              <div v-if="event.reason && event.reason !== event.reason_code">{{ event.reason }}</div>
              <div v-if="event.original_actor_id">{{ t("shiftAudit.originalOperator") }} {{ event.original_actor_name || event.original_actor_id }}</div>
              <details v-if="event.counts.length" class="my-1">
                <summary class="cursor-pointer">{{ t("shiftAudit.counts") }}</summary>
                <div v-for="(count, index) in event.counts" :key="index" class="py-1">
                  <div>{{ count.payment_type_name }} · {{ count.currency }}</div>
                  <div>{{ t("shiftAudit.expected") }} {{ formatPosAmount(count.expected_minor, count.currency) }}</div>
                  <div>{{ t("shiftAudit.counted") }} {{ formatPosAmount(count.declared_minor, count.currency) }}</div>
                  <div>{{ t("shiftAudit.variance") }} {{ formatPosAmount(count.variance_minor, count.currency) }}</div>
                </div>
              </details>
              <code class="break-all text-ink-gray-5">{{ event.reference }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button :disabled="page === 1 || loading" @click="load(page - 1)">{{ t("pages.orders.previous") }}</Button>
        <span>{{ t("pages.orders.page", { page }) }}</span>
        <Button :disabled="!more || loading" @click="load(page + 1)">{{ t("pages.orders.next") }}</Button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { Alert, Button, LoadingText } from "frappe-ui";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAdminStore } from "../stores/admin";
import { formatPosAmount, type SupportedCurrency } from "../utils/currency";
import ModalPanel from "./ModalPanel.vue";

defineEmits<{ close: [] }>();
const { t, locale } = useI18n();
const store = useAdminStore();
type Count = { payment_type_name: string; currency: SupportedCurrency;
  expected_minor: number; declared_minor: number; variance_minor: number };
type AuditEvent = {
  id: string; action: string; occurred_at: string; timezone: string; actor_id: string; actor_name: string | null;
  profile_name: string | null; branch_name: string; reference: string; reason: string | null;
  reason_code: string | null; currency: SupportedCurrency | null; amount_minor: number | null;
  original_actor_name: string | null; original_actor_id: string | null; counts_json: string | null;
};
const events = ref<(AuditEvent & { counts: Count[] })[]>([]);
const error = ref("");
const loading = ref(false);
const page = ref(1);
const more = ref(false);

const time = (value: string, timeZone: string) => new Intl.DateTimeFormat(locale.value, {
  dateStyle: "medium", timeStyle: "short", timeZone,
}).format(new Date(value));

async function load(next: number) {
  loading.value = true;
  error.value = "";
  try {
    const reply = await store.request(`/api/admin/pos/shift-audit?page=${next}`);
    events.value = reply.events.map((event: AuditEvent) => ({
      ...event, counts: event.counts_json ? JSON.parse(event.counts_json) : [],
    }));
    page.value = reply.page;
    more.value = reply.has_more;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t("selling.loadFailed");
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(1));
</script>
