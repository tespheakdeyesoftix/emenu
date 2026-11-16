<template>
  <ModalPanel
    :open="true"
    :title="t(profile ? 'selling.editProfile' : 'selling.newProfile')"
    size="large"
    :close-on-backdrop="!saving"
    @close="close"
  >
    <form id="pos-profile-form" class="space-y-5" @submit.prevent="save">
      <fieldset class="space-y-5" :disabled="saving || store.isReadOnly">
        <div class="grid gap-4 sm:grid-cols-2">
          <label>
            <span class="label">{{ t("selling.name") }}</span>
            <input v-model.trim="name" class="input" required maxlength="120" />
          </label>
          <label>
            <span class="label">{{ t("menus.branch") }}</span>
            <input
              v-if="profile"
              :value="profile.branch_name"
              class="input"
              readonly
            />
            <select
              v-else
              v-model="branchId"
              class="input"
              required
              @change="tableGroupIds = []"
            >
              <option
                v-for="branch in options.branches"
                :key="branch.id"
                :value="branch.id"
              >
                {{ branch.name }}
              </option>
            </select>
          </label>
        </div>
        <div class="flex flex-wrap gap-4 text-sm font-semibold">
          <label class="flex items-center gap-2"
            ><input v-model="active" type="checkbox" />{{
              t("selling.active")
            }}</label
          >
          <label class="flex items-center gap-2"
            ><input v-model="config.working_day_enabled" type="checkbox" />{{
              t("selling.workingDay")
            }}</label
          >
        </div>

        <div class="grid gap-4 border-t border-black/10 pt-4 sm:grid-cols-2">
          <label>
            <span class="label">{{ t("selling.tableMode") }}</span>
            <select v-model="config.table_mode" class="input">
              <option v-for="mode in tableModes" :key="mode" :value="mode">
                {{ t(`selling.modes.${mode}`) }}
              </option>
            </select>
          </label>
          <label>
            <span class="label">{{ t("selling.catalogMode") }}</span>
            <select
              v-model="config.catalog_mode"
              class="input"
              @change="selectedIds = []"
            >
              <option value="category">{{ t("selling.categories") }}</option>
              <option value="menu">{{ t("nav.menus") }}</option>
            </select>
          </label>
        </div>
        <PosTableGroupPicker
          v-if="config.table_mode !== 'disabled'"
          v-model="tableGroupIds"
          :groups="branchTableGroups"
        />
        <PosCatalogPicker
          v-if="catalogChoices.length || selectedIds.length"
          :key="config.catalog_mode"
          v-model="selectedIds"
          :items="catalogChoices"
        />

        <div class="space-y-3 border-t border-black/10 pt-4">
          <h3 class="font-bold">{{ t("selling.paymentTypes") }}</h3>
          <p v-if="!options.payment_types.length" class="text-sm text-black/60">
            {{ t("selling.noPaymentTypes") }}
          </p>
          <template v-else>
            <label v-if="availablePayments.length" class="block">
              <span class="label">{{ t("selling.allowPaymentType") }}</span>
              <select v-model="paymentToAdd" class="input" @change="addPayment">
                <option value="" disabled>
                  {{ t("selling.choosePayment") }}
                </option>
                <option
                  v-for="payment in availablePayments"
                  :key="payment.id"
                  :value="payment.id"
                >
                  {{ payment.name }} ·
                  {{ paymentCurrencies(payment).join(" / ") }}
                </option>
              </select>
            </label>
            <ul
              v-if="acceptedPayments.length"
              class="max-h-56 divide-y divide-black/10 overflow-y-auto overscroll-contain"
            >
              <li
                v-for="payment in acceptedPayments"
                :key="payment.id"
                class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
              >
                <div class="min-w-0 flex-1">
                  <div class="break-words font-semibold">
                    {{ payment.name }}
                  </div>
                  <div class="text-xs text-black/60">
                    {{ paymentCurrencies(payment).join(" / ") }}
                  </div>
                </div>
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="allowsCashFloat(payment)"
                    @change="
                      setCashFloat(
                        payment.id,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  {{ t("selling.allowCashFloat") }}
                </label>
                <button
                  type="button"
                  class="grid size-8 shrink-0 place-items-center rounded-lg text-black/60 hover:bg-cream hover:text-red-700"
                  :aria-label="
                    t('selling.removePaymentType', { name: payment.name })
                  "
                  @click="removePayment(payment.id)"
                >
                  <X :size="16" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </template>
          <div class="grid gap-4 sm:grid-cols-2">
            <label>
              <span class="label">{{ t("selling.defaultPayment") }}</span>
              <select
                v-model="config.default_payment_type_id"
                class="input"
                required
              >
                <option value="" disabled>
                  {{ t("selling.choosePayment") }}
                </option>
                <option
                  v-for="payment in acceptedPayments"
                  :key="payment.id"
                  :value="payment.id"
                >
                  {{ payment.name }}
                </option>
              </select>
            </label>
            <label>
              <span class="label">{{ t("selling.defaultCustomer") }}</span>
              <select v-model="config.default_customer_id" class="input">
                <option :value="walkInId">{{ t("selling.walkIn") }}</option>
                <option
                  v-for="customer in options.customers"
                  :key="customer.id"
                  :value="customer.id"
                >
                  {{ customer.name }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div class="grid gap-4 border-t border-black/10 pt-4 sm:grid-cols-2">
          <label>
            <span class="label">{{ t("selling.taxMode") }}</span>
            <select v-model="config.tax_mode" class="input">
              <option v-for="mode in taxModes" :key="mode" :value="mode">
                {{ t(`selling.modes.${mode}`) }}
              </option>
            </select>
          </label>
          <label v-if="config.tax_mode !== 'disabled'">
            <span class="label">{{ t("selling.taxRate") }}</span>
            <input
              v-model.number="taxRate"
              type="number"
              class="input"
              required
              min="0"
              max="100"
              step="0.01"
            />
          </label>
          <label>
            <span class="label">{{ t("selling.receiptTitle") }}</span>
            <input
              v-model="config.receipt_template.title"
              class="input"
              maxlength="120"
            />
          </label>
          <label>
            <span class="label">{{ t("selling.printCopies") }}</span>
            <input
              v-model.number="config.print_copies"
              type="number"
              class="input"
              required
              min="1"
              max="10"
            />
          </label>
          <label class="sm:col-span-2">
            <span class="label">{{ t("selling.receiptFooter") }}</span>
            <textarea
              v-model="config.receipt_template.footer"
              class="input"
              maxlength="500"
              rows="2"
            ></textarea>
          </label>
          <label class="flex items-center gap-2 text-sm font-semibold">
            <input
              v-model="config.receipt_template.show_tax"
              type="checkbox"
            />{{ t("selling.showReceiptTax") }}
          </label>
        </div>
      </fieldset>
      <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
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
          form="pos-profile-form"
          :disabled="
            saving || store.isReadOnly || !options.payment_types.length
          "
        >
          {{ t(saving ? "common.saving" : "common.save") }}
        </button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { X } from "lucide-vue-next";
import type { ProfileConfig } from "../../../../shared/posProfile";
import { useAdminStore } from "../stores/admin";
import type {
  PosPaymentOption,
  PosProfile,
  PosProfileOptions,
} from "../types/posProfile";
import ModalPanel from "./ModalPanel.vue";
import PosCatalogPicker from "./PosCatalogPicker.vue";
import PosTableGroupPicker from "./PosTableGroupPicker.vue";

const props = defineProps<{
  profile: PosProfile | null;
  options: PosProfileOptions;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const { t } = useI18n();
const store = useAdminStore();
const tableModes = ["disabled", "optional", "required"] as const;
const taxModes = ["disabled", "inclusive", "exclusive"] as const;
const walkInId = `walkin_${store.business.id}`;
const originalConfig = props.profile?.pending_config ?? props.profile?.config;
const config = ref<ProfileConfig>(
  originalConfig
    ? JSON.parse(JSON.stringify(originalConfig))
    : {
        working_day_enabled: false,
        cashier_shift_enabled: false,
        table_mode: "disabled",
        catalog_mode: "category",
        selected_ids: null,
        payment_types: [],
        default_payment_type_id: "",
        default_customer_id: walkInId,
        receipt_template: { title: "", footer: "", show_tax: true },
        print_copies: 1,
        tax_mode: "disabled",
        tax_rate_bps: 0,
      },
);
const name = ref(props.profile?.name ?? "");
const branchId = ref(
  props.profile?.branch_id ?? props.options.branches[0]?.id ?? "",
);
const active = ref(props.profile?.is_active ?? true);
const taxRate = ref(config.value.tax_rate_bps / 100);
const selectedIds = ref([...(config.value.selected_ids ?? [])]);
const tableGroupIds = ref([...(config.value.table_group_ids ?? [])]);
const saving = ref(false);
const error = ref("");
const paymentToAdd = ref("");

const paymentTypesById = computed(
  () => new Map(config.value.payment_types.map((type) => [type.id, type])),
);
const acceptedPayments = computed(() =>
  props.options.payment_types.filter((payment) =>
    paymentTypesById.value.has(payment.id),
  ),
);
const availablePayments = computed(() =>
  props.options.payment_types.filter(
    (payment) => !paymentTypesById.value.has(payment.id),
  ),
);
const catalogChoices = computed(() =>
  config.value.catalog_mode === "menu"
    ? props.options.menus
    : props.options.categories,
);
const branchTableGroups = computed(() =>
  (props.options.table_groups ?? []).filter(
    (group) => group.branch_id === branchId.value,
  ),
);

function paymentCurrencies(payment: PosPaymentOption) {
  if (payment.currency) return [payment.currency];
  return (
    originalConfig?.payment_types.find(({ id }) => id === payment.id)
      ?.currencies ?? [store.business.currency]
  );
}

function allowsCashFloat(payment: PosPaymentOption) {
  return (
    paymentTypesById.value.get(payment.id)?.allow_cash_float ??
    (config.value.cashier_shift_enabled && payment.kind === "cash")
  );
}

function addPayment() {
  const payment = availablePayments.value.find(
    ({ id }) => id === paymentToAdd.value,
  );
  paymentToAdd.value = "";
  if (!payment) return;
  config.value.payment_types.push({
    id: payment.id,
    currencies: paymentCurrencies(payment),
    allow_cash_float:
      originalConfig?.payment_types.find(({ id }) => id === payment.id)
        ?.allow_cash_float ?? allowsCashFloat(payment),
  });
  if (!config.value.default_payment_type_id)
    config.value.default_payment_type_id = payment.id;
}

function removePayment(id: string) {
  config.value.payment_types = config.value.payment_types.filter(
    (item) => item.id !== id,
  );
  if (config.value.default_payment_type_id === id)
    config.value.default_payment_type_id =
      config.value.payment_types[0]?.id ?? "";
}

function setCashFloat(id: string, enabled: boolean) {
  const type = paymentTypesById.value.get(id);
  if (type) type.allow_cash_float = enabled;
}

function close() {
  if (!saving.value) emit("close");
}

async function save() {
  if (saving.value || store.isReadOnly || !name.value) return;
  error.value = "";
  const updated: ProfileConfig = {
    ...config.value,
    selected_ids: selectedIds.value.length ? selectedIds.value : null,
    tax_rate_bps:
      config.value.tax_mode === "disabled"
        ? 0
        : Math.round(taxRate.value * 100),
  };
  const keepExistingShifts =
    config.value.cashier_shift_enabled &&
    !originalConfig?.payment_types.some(
      (type) => type.allow_cash_float === true,
    );
  updated.cashier_shift_enabled =
    keepExistingShifts || acceptedPayments.value.some(allowsCashFloat);
  if (updated.cashier_shift_enabled && !config.value.cashier_shift_enabled) {
    updated.payment_types = updated.payment_types.map((type) => ({
      ...type,
      allow_cash_float: type.allow_cash_float ?? false,
    }));
  }
  if (tableGroupIds.value.length || updated.table_group_ids)
    updated.table_group_ids = tableGroupIds.value.length
      ? tableGroupIds.value
      : null;
  const changed = JSON.stringify(updated) !== JSON.stringify(originalConfig);
  if (
    changed &&
    !updated.payment_types.some(({ currencies }) =>
      currencies.includes(store.business.currency),
    )
  ) {
    error.value = t("selling.businessCurrencyRequired", {
      currency: store.business.currency,
    });
    return;
  }
  saving.value = true;
  try {
    const body = {
      name: name.value,
      branch_id: branchId.value,
      is_active: active.value,
      ...(changed ? { config: updated } : {}),
    };
    const path = props.profile
      ? `/api/admin/pos/profiles/${encodeURIComponent(props.profile.id)}`
      : "/api/admin/pos/profiles";
    await store.request(path, {
      method: props.profile ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    emit("saved");
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("selling.saveFailed");
  } finally {
    saving.value = false;
  }
}
</script>
