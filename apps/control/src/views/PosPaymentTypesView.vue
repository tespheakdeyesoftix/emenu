<template>
  <PageHeader :title="t('nav.posPaymentTypes')">
    <Button variant="solid" size="lg"
      type="button"
      :disabled="store.isReadOnly"
      @click="edit()"
    >
      <template #prefix><Plus :size="16" /></template>{{ t("selling.addPaymentType") }}
    </Button>
  </PageHeader>

  <section class="card overflow-hidden" :aria-busy="loading">
    <LoadingText v-if="loading" :text="t('common.loading')" role="status" class="p-6" />
    <Alert v-else-if="error" theme="red" :title="error" class="m-4">
      <template #actions>
        <Button variant="subtle" size="lg" type="button" @click="load(page)">
          {{ t("common.tryAgain") }}
        </Button>
      </template>
    </Alert>
    <p v-else-if="!payments.length" class="p-6 text-sm text-black/55">
      {{ t("selling.emptyPaymentTypes") }}
    </p>
    <List divider="none" v-else class="divide-y divide-black/10">
      <ListRow
        v-for="payment in payments"
        :key="payment.id"
        class="!flex items-center justify-between gap-3 p-4"
      >
        <div class="min-w-0 break-words">
          <h2 class="font-bold">{{ payment.name }}</h2>
          <p class="mt-1 text-sm text-black/60">
            {{ groupLabel(payment.payment_type_group ?? defaultPaymentGroup[payment.kind]) }} ·
            {{ payment.currency || t("selling.currencyFromProfile") }}
          </p>
        </div>
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="store.isReadOnly"
          @click="edit(payment)"
        >
          {{ t("common.edit") }}
        </Button>
      </ListRow>
    </List>
    <div
      v-if="page > 1 || hasMore"
      class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4"
    >
      <Button variant="subtle" size="lg"
        type="button"
        :disabled="loading || page === 1"
        @click="load(page - 1)"
      >
        {{ t("pages.orders.previous") }}
      </Button>
      <span class="text-sm text-black/60">{{
        t("pages.orders.page", { page })
      }}</span>
      <Button variant="subtle" size="lg"
        type="button"
        :disabled="loading || !hasMore"
        @click="load(page + 1)"
      >
        {{ t("pages.orders.next") }}
      </Button>
    </div>
  </section>

  <ModalPanel
    :open="Boolean(draft)"
    :title="t(draft?.id ? 'selling.editPaymentType' : 'selling.addPaymentType')"
    :close-on-backdrop="!saving"
    @close="close"
  >
    <form
      v-if="draft"
      id="pos-payment-type-form"
      class="grid gap-4"
      @submit.prevent="save"
    >
      <label>
        <span class="label">{{ t("selling.name") }}</span>
        <TextInput size="lg" variant="outline"
          v-model.trim="draft.name"
          required
          maxlength="120"
          :disabled="saving"
        />
      </label>
      <Select
        v-model="draft.payment_type_group"
        size="lg"
        variant="outline"
        :label="t('selling.paymentTypeGroup')"
        required
        :disabled="saving"
        :options="paymentTypeGroups.map(group => ({ label: groupLabel(group), value: group }))"
      />
      <Select
        size="lg"
        variant="outline"
        :label="t('selling.paymentCurrency')"
        v-model="draft.currency"
        :placeholder="t('selling.chooseCurrency')"
        :required="!draft.id"
        :disabled="saving"
        :options="[...currencies]"
      />
      <Alert v-if="saveError" theme="red" :title="saveError" />
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="saving"
          @click="close"
        >
          {{ t("common.cancel") }}
        </Button>
        <Button variant="solid" size="lg"
          type="submit"
          form="pos-payment-type-form"
          :disabled="saving || store.isReadOnly || (!draft?.id && !draft?.currency)"
        >
          {{ t(saving ? "common.saving" : "common.save") }}
        </Button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { List, ListRow } from "frappe-ui/list";
import { LoadingText, Alert, Button, Select, TextInput } from "frappe-ui";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Plus } from "lucide-vue-next";
import { defaultPaymentGroup, paymentTypeGroups, type PaymentTypeGroup, type PosCurrency } from "../../../../shared/posProfile";
import ModalPanel from "../components/ModalPanel.vue";
import PageHeader from "../components/PageHeader.vue";
import { ControlRequestError, useAdminStore } from "../stores/admin";
import type { PosPaymentOption } from "../types/posProfile";

const { t, locale } = useI18n();
const store = useAdminStore();
const endpoint = "/api/admin/pos/payment-types";
const currencies = ["USD", "KHR"] as const;
const payments = ref<PosPaymentOption[]>([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(true);
const error = ref("");
const draft = ref<{ id: string; name: string; payment_type_group: PaymentTypeGroup; currency: PosCurrency | "" } | null>(null);
const saving = ref(false);
const saveError = ref("");

async function load(nextPage: number) {
  loading.value = true;
  error.value = "";
  try {
    const result = await store.request(`${endpoint}?page=${nextPage}`);
    payments.value = result.payment_types;
    page.value = result.page;
    hasMore.value = result.has_more;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("selling.loadFailed");
  } finally {
    loading.value = false;
  }
}

function groupLabel(group: PaymentTypeGroup) {
  return t("selling.paymentTypeGroups." + group.toLowerCase().replaceAll(" ", "_"));
}

function edit(payment?: PosPaymentOption) {
  draft.value = payment
    ? {
      id: payment.id,
      name: payment.name,
      payment_type_group: payment.payment_type_group ?? defaultPaymentGroup[payment.kind],
      currency: payment.currency ?? "",
    }
    : { id: "", name: "", payment_type_group: "Cash", currency: "" };
  saveError.value = "";
}

function close() {
  if (!saving.value) draft.value = null;
}

async function save() {
  if (saving.value || store.isReadOnly || !draft.value?.name) return;
  const { id, name, payment_type_group, currency } = draft.value;
  if (!id && !currency) return;
  saving.value = true;
  saveError.value = "";
  try {
    await store.request(
      id ? `${endpoint}/${encodeURIComponent(id)}` : endpoint,
      {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ name, payment_type_group, ...(currency ? { currency } : {}) }),
      },
    );
    draft.value = null;
    await load(page.value);
  } catch (cause) {
    saveError.value = cause instanceof ControlRequestError && cause.serverMessage && locale.value === "en"
      ? cause.serverMessage
      : cause instanceof Error ? cause.message : t("selling.saveFailed");
  } finally {
    saving.value = false;
  }
}
onMounted(() => load(1));
</script>
