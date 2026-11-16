<template>
  <PageHeader
    :eyebrow="t('nav.groups.selling')"
    :title="t('nav.posPaymentTypes')"
  >
    <button
      type="button"
      class="btn-primary"
      :disabled="store.isReadOnly"
      @click="edit()"
    >
      <Plus :size="16" />{{ t("selling.addPaymentType") }}
    </button>
  </PageHeader>

  <section class="card overflow-hidden" :aria-busy="loading">
    <p v-if="loading" class="p-6 text-sm text-black/55" role="status">
      {{ t("common.loading") }}
    </p>
    <div v-else-if="error" class="p-6" role="alert">
      <p class="mb-3 text-sm text-red-700">{{ error }}</p>
      <button type="button" class="btn-soft" @click="load(page)">
        {{ t("common.tryAgain") }}
      </button>
    </div>
    <p v-else-if="!payments.length" class="p-6 text-sm text-black/55">
      {{ t("selling.emptyPaymentTypes") }}
    </p>
    <ul v-else class="divide-y divide-black/10">
      <li
        v-for="payment in payments"
        :key="payment.id"
        class="flex items-center justify-between gap-3 p-4"
      >
        <div class="min-w-0 break-words">
          <h2 class="font-bold">{{ payment.name }}</h2>
          <p class="mt-1 text-sm text-black/60">
            {{ t(`selling.paymentKinds.${payment.kind}`) }} ·
            {{ payment.currency || t("selling.currencyFromProfile") }}
          </p>
        </div>
        <button
          type="button"
          class="btn-soft"
          :disabled="store.isReadOnly"
          @click="edit(payment)"
        >
          {{ t("common.edit") }}
        </button>
      </li>
    </ul>
    <div
      v-if="page > 1 || hasMore"
      class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4"
    >
      <button
        type="button"
        class="btn-soft"
        :disabled="loading || page === 1"
        @click="load(page - 1)"
      >
        {{ t("pages.orders.previous") }}
      </button>
      <span class="text-sm text-black/60">{{
        t("pages.orders.page", { page })
      }}</span>
      <button
        type="button"
        class="btn-soft"
        :disabled="loading || !hasMore"
        @click="load(page + 1)"
      >
        {{ t("pages.orders.next") }}
      </button>
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
        <input
          v-model.trim="draft.name"
          required
          maxlength="120"
          class="input"
          :disabled="saving"
        />
      </label>
      <label>
        <span class="label">{{ t("selling.paymentKind") }}</span>
        <input
          v-if="draft.id"
          :value="t(`selling.paymentKinds.${draft.kind}`)"
          class="input"
          readonly
        />
        <select v-else v-model="draft.kind" class="input" :disabled="saving">
          <option v-for="kind in paymentKinds" :key="kind" :value="kind">
            {{ t(`selling.paymentKinds.${kind}`) }}
          </option>
        </select>
      </label>
      <label>
        <span class="label">{{ t("selling.paymentCurrency") }}</span>
        <input
          v-if="draft.id"
          :value="draft.currency || t('selling.currencyFromProfile')"
          class="input"
          readonly
        />
        <select
          v-else
          v-model="draft.currency"
          class="input"
          required
          :disabled="saving"
        >
          <option value="" disabled>{{ t("selling.chooseCurrency") }}</option>
          <option
            v-for="currency in currencies"
            :key="currency"
            :value="currency"
          >
            {{ currency }}
          </option>
        </select>
      </label>
      <p v-if="saveError" class="text-sm text-red-700" role="alert">
        {{ saveError }}
      </p>
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn-soft"
          :disabled="saving"
          @click="close"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="submit"
          class="btn-primary"
          form="pos-payment-type-form"
          :disabled="saving || store.isReadOnly"
        >
          {{ t(saving ? "common.saving" : "common.save") }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Plus } from "lucide-vue-next";
import type { PaymentKind, PosCurrency } from "../../../../shared/posProfile";
import ModalPanel from "../components/ModalPanel.vue";
import PageHeader from "../components/PageHeader.vue";
import { useAdminStore } from "../stores/admin";
import type { PosPaymentOption } from "../types/posProfile";

const { t } = useI18n();
const store = useAdminStore();
const endpoint = "/api/admin/pos/payment-types";
const paymentKinds: PaymentKind[] = ["cash", "card", "qr", "other"];
const currencies = ["USD", "KHR"] as const;
const payments = ref<PosPaymentOption[]>([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(true);
const error = ref("");
const draft = ref<(Omit<PosPaymentOption, "currency"> & { currency: PosCurrency | "" }) | null>(null);
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

function edit(payment?: PosPaymentOption) {
  draft.value = payment
    ? { ...payment, currency: payment.currency ?? "" }
    : { id: "", name: "", kind: "cash", currency: "" };
  saveError.value = "";
}

function close() {
  if (!saving.value) draft.value = null;
}

async function save() {
  if (saving.value || store.isReadOnly || !draft.value?.name) return;
  const { id, name, kind, currency } = draft.value;
  if (!id && !currency) return;
  saving.value = true;
  saveError.value = "";
  try {
    await store.request(
      id ? `${endpoint}/${encodeURIComponent(id)}` : endpoint,
      {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(id ? { name } : { name, kind, currency }),
      },
    );
    draft.value = null;
    await load(page.value);
  } catch (cause) {
    saveError.value =
      cause instanceof Error ? cause.message : t("selling.saveFailed");
  } finally {
    saving.value = false;
  }
}
onMounted(() => load(1));
</script>
