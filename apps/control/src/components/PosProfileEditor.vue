<template>
  <ModalPanel
    :open="true"
    :title="t(profile ? 'selling.editProfile' : 'selling.newProfile')"
    size="large"
    :close-on-backdrop="!saving"
    @close="close"
  >
    <form id="pos-profile-form" class="space-y-5" novalidate @submit.prevent="save">
      <fieldset class="min-w-0" :disabled="saving || store.isReadOnly">
        <SettingsTabs
          v-model="profileTab"
          :tabs="profileTabs"
          :label="t('nav.posProfiles')"
        >
          <TabPanel
            as="section"
            :force-mount="true"
            value="general"
            data-profile-tab="general"
            class="space-y-4 data-[state=inactive]:hidden"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <label>
                <span class="label">{{ t("selling.name") }}</span>
                <TextInput size="lg" variant="outline" v-model.trim="name" required maxlength="120" />
              </label>
              <label>
                <span class="label">{{ t("menus.branch") }}</span>
                <TextInput size="lg" variant="outline" v-if="profile"
                  :model-value="profile.branch_name"

                  readonly
                />
                <Select
                  size="lg"
                  variant="outline"
                  v-else
                  v-model="branchId"
                  required
                  @update:model-value="tableGroupIds = []"
                  :options="[...options.branches.map(branch => ({ label: branch.name, value: branch.id }))]"
                />
              </label>
            </div>
            <div class="flex flex-wrap gap-4 text-sm font-semibold">
              <label class="flex items-center gap-2"
                ><Checkbox v-model="active" type="checkbox" />{{
                  t("selling.active")
                }}</label
              >
              <label class="flex items-center gap-2"
                ><Checkbox v-model="config.working_day_enabled" type="checkbox" />{{
                  t("selling.workingDay")
                }}</label
              >
            </div>

            <label class="block sm:max-w-md">
              <span class="label">{{ t("selling.defaultCustomer") }}</span>
              <Select
                size="lg"
                variant="outline"
                v-model="config.default_customer_id"
                :options="[
                  { label: t('selling.walkIn'), value: walkInId },
                  ...options.customers.map(customer => ({ label: customer.name, value: customer.id })),
                ]"
              />
            </label>

            <fieldset v-if="config.table_mode !== 'disabled'" class="space-y-3 rounded-xl border border-outline-gray-2 p-4">
              <legend class="px-1 text-sm font-semibold">{{ t("selling.tablePlanSettings") }}</legend>
              <label class="flex items-center gap-2 text-sm">
                <Checkbox v-model="config.prompt_guest_cover" />
                {{ t("selling.promptGuestCover") }}
              </label>
              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ColorField
                  v-for="status in posTableStatuses"
                  :key="status"
                  v-model="tableStatusColors[status]"
                  :label="t(`selling.tableStatuses.${status}`)"
                />
              </div>
              <Button
                variant="ghost"
                :label="t('selling.resetTableColors')"
                @click="Object.assign(tableStatusColors, posTableStatusColors)"
              />
            </fieldset>
          </TabPanel>

          <TabPanel
            as="section"
            :force-mount="true"
            value="catalog"
            data-profile-tab="catalog"
            class="space-y-4 data-[state=inactive]:hidden"
          >
            <label class="block sm:max-w-md">
              <span class="label">{{ t("selling.catalogMode") }}</span>
              <Select
                size="lg"
                variant="outline"
                v-model="config.catalog_mode"
                @update:model-value="selectCatalogNodes([])"
                :options="[
                  { label: t('selling.categories'), value: 'category' },
                  { label: t('nav.menus'), value: 'menu' },
                ]"
              />
            </label>
            <PosCatalogPicker
              v-if="catalogChoices.length || selectedIds.length"
              :key="config.catalog_mode"
              :model-value="selectedIds"
              :items="catalogChoices"
              :flat="config.catalog_mode === 'menu'"
              @update:model-value="selectCatalogNodes"
            />
            <label v-if="config.catalog_mode === 'menu'" class="block sm:max-w-md">
              <span class="label">{{ t("selling.defaultMenu") }}</span>
              <Select
                v-model="defaultMenu"
                size="lg"
                variant="outline"
                :disabled="!selectedMenus.length"
                :options="[
                  { label: t('selling.noDefaultMenu'), value: '' },
                  ...selectedMenus.map(menu => ({ label: menu.name, value: menu.id })),
                ]"
              />
            </label>
          </TabPanel>

          <TabPanel
            as="section"
            :force-mount="true"
            value="tables"
            data-profile-tab="tables"
            class="space-y-4 data-[state=inactive]:hidden"
          >
            <label class="block sm:max-w-md">
              <span class="label">{{ t("selling.tableMode") }}</span>
              <Select
                size="lg"
                variant="outline"
                v-model="config.table_mode"
                :options="[...tableModes.map(mode => ({ label: t(`selling.modes.${mode}`), value: mode }))]"
              />
            </label>
            <p
              v-if="profile?.pending_config && profile.pending_config.table_mode !== profile.config.table_mode"
              class="text-sm font-semibold text-amber-800"
              role="status"
            >
              {{
                t("selling.pendingTableMode", {
                  active: t(`selling.modes.${profile.config.table_mode}`),
                  pending: t(`selling.modes.${profile.pending_config.table_mode}`),
                })
              }}
            </p>
            <PosTableGroupPicker
              v-if="config.table_mode !== 'disabled'"
              v-model="tableGroupIds"
              :groups="branchTableGroups"
            />
          </TabPanel>

          <TabPanel
            as="section"
            :force-mount="true"
            value="payments"
            data-profile-tab="payments"
            class="space-y-4 data-[state=inactive]:hidden"
          >
            <h3 class="font-bold">{{ t("selling.paymentTypes") }}</h3>
            <p v-if="!options.payment_types.length" class="text-sm text-black/60">
              {{ t("selling.noPaymentTypes") }}
            </p>
            <List
              v-else
              divider="none"
              class="max-h-64 divide-y divide-black/10 overflow-y-auto overscroll-contain"
            >
              <ListRow
                v-for="{ payment, position } in paymentChoices"
                :key="payment.id"
                class="!flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
              >
                <Checkbox
                  class="min-w-0 flex-1"
                  :label="payment.name"
                  :description="paymentCurrency(payment)"
                  :model-value="position !== -1"
                  @update:model-value="togglePayment(payment, $event === true)"
                />
                <template v-if="position !== -1">
                  <Select
                    v-if="!payment.currency"
                    :aria-label="t('common.currency')"
                    :model-value="paymentCurrency(payment)"
                    :options="[{ label: 'USD', value: 'USD' }, { label: 'KHR', value: 'KHR' }]"
                    @update:model-value="setPaymentCurrency(payment.id, $event)"
                  />
                  <label class="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      :model-value="allowsCashFloat(payment)"
                      @update:model-value="setCashFloat(payment.id, $event === true)"
                    />
                    {{ t("selling.allowCashFloat") }}
                  </label>
                  <div class="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      type="button"
                      class="size-8 disabled:opacity-30"
                      :aria-label="t('menus.moveUp', { name: payment.name })"
                      :disabled="position === 0"
                      @click="movePayment(position, -1)"
                    >
                      <template #icon><ArrowUp :size="16" aria-hidden="true" /></template>
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      class="size-8 disabled:opacity-30"
                      :aria-label="t('menus.moveDown', { name: payment.name })"
                      :disabled="position === acceptedPayments.length - 1"
                      @click="movePayment(position, 1)"
                    >
                      <template #icon><ArrowDown :size="16" aria-hidden="true" /></template>
                    </Button>
                  </div>
                </template>
              </ListRow>
            </List>

            <label class="block sm:max-w-md">
              <span class="label">{{ t("selling.defaultPayment") }}</span>
              <Select
                size="lg"
                variant="outline"
                v-model="config.default_payment_type_id"
                required
                :options="[
                  { label: t('selling.choosePayment'), value: '', disabled: true },
                  ...acceptedPayments.map(payment => ({ label: payment.name, value: payment.id })),
                ]"
              />
            </label>
          </TabPanel>

          <TabPanel
            as="section"
            :force-mount="true"
            value="tax"
            data-profile-tab="tax"
            class="space-y-4 data-[state=inactive]:hidden"
          >
            <PosTaxRulesEditor
              v-model="config.tax_rules"
              v-model:default-rule-id="config.default_tax_rule_id"
            />
            <h3 class="border-t border-black/10 pt-4 font-semibold">
              {{ t("selling.taxRules.currentRegisterTax") }}
            </h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <label>
                <span class="label">{{ t("selling.taxMode") }}</span>
                <Select
                  size="lg"
                  variant="outline"
                  v-model="config.tax_mode"
                  :options="posTaxModes.map(mode => ({ label: t(`selling.modes.${mode}`), value: mode }))"
                />
              </label>
              <label v-if="config.tax_mode !== 'disabled'">
                <span class="label">{{ t("selling.taxRate") }}</span>
                <TextInput size="lg" variant="outline"
                  v-model.number="taxRate"
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.01"
                />
              </label>
            </div>
          </TabPanel>

          <TabPanel
            as="section"
            :force-mount="true"
            value="receipt"
            data-profile-tab="receipt"
            class="space-y-4 data-[state=inactive]:hidden"
          >
            <PosReceiptTemplatesEditor
              ref="receiptEditor"
              v-model="config.receipt_templates"
              v-model:defaults="config.default_receipt_templates"
            >
              <template #current-register>
                <details class="rounded-xl border border-black/10 p-3">
                  <summary class="cursor-pointer text-sm font-semibold">
                    {{ t("selling.receipts.currentReceipt") }}
                  </summary>
                  <div class="mt-3 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span class="label">{{ t("selling.receiptTitle") }}</span>
                      <TextInput size="lg" variant="outline"
                        v-model="config.receipt_template.title"
                        maxlength="120"
                      />
                    </label>
                    <label>
                      <span class="label">{{ t("selling.printCopies") }}</span>
                      <TextInput size="lg" variant="outline"
                        v-model.number="config.print_copies"
                        type="number"
                        required
                        min="1"
                        max="10"
                      />
                    </label>
                    <label class="sm:col-span-2">
                      <span class="label">{{ t("selling.receiptFooter") }}</span>
                      <Textarea size="lg" variant="outline"
                        v-model="config.receipt_template.footer"
                        maxlength="500"
                        :rows="2"
                      ></Textarea>
                    </label>
                    <label class="flex items-center gap-2 text-sm font-semibold">
                      <Checkbox
                        v-model="config.receipt_template.show_tax"
                        type="checkbox"
                      />{{ t("selling.showReceiptTax") }}
                    </label>
                  </div>
                </details>
              </template>
            </PosReceiptTemplatesEditor>
          </TabPanel>
        </SettingsTabs>
      </fieldset>
      <Alert v-if="error" theme="red" :title="error" />
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
          form="pos-profile-form"
          :disabled="
            saving || store.isReadOnly || !options.payment_types.length
          "
        >
          {{ t(saving ? "common.saving" : "common.save") }}
        </Button>
      </div>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { List, ListRow } from "frappe-ui/list";
import { Alert, Button, Checkbox, Select, TabPanel, TextInput, Textarea } from "frappe-ui";
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowDown, ArrowUp } from "lucide-vue-next";
import { emptyPosReceiptDefaults } from "../../../../shared/posReceipts";
import { posTableStatusColors, posTableStatuses, posTaxModes, type ProfileConfig, type PosTableStatusColors } from "../../../../shared/posProfile";
import { useAdminStore } from "../stores/admin";
import type {
  PosPaymentOption,
  PosProfile,
  PosProfileOptions,
} from "../types/posProfile";
import ColorField from "./ColorField.vue";
import ModalPanel from "./ModalPanel.vue";
import PosCatalogPicker from "./PosCatalogPicker.vue";
import PosReceiptTemplatesEditor from "./PosReceiptTemplatesEditor.vue";
import PosTableGroupPicker from "./PosTableGroupPicker.vue";
import PosTaxRulesEditor from "./PosTaxRulesEditor.vue";
import SettingsTabs from "./SettingsTabs.vue";

const props = defineProps<{
  profile: PosProfile | null;
  options: PosProfileOptions;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const { t } = useI18n();
const store = useAdminStore();
const profileTab = ref("general");
const receiptEditor = ref<InstanceType<typeof PosReceiptTemplatesEditor>>();
const profileTabs = computed(() => [
  { id: "general", label: t("selling.profileTabs.general") },
  { id: "catalog", label: t("selling.profileTabs.catalog") },
  { id: "tables", label: t("selling.profileTabs.tables") },
  { id: "payments", label: t("selling.profileTabs.payments") },
  { id: "tax", label: t("selling.profileTabs.tax") },
  { id: "receipt", label: t("selling.profileTabs.receipt") },
]);
const tableModes = ["disabled", "optional", "required"] as const;
const walkInId = `walkin_${store.business.id}`;
const savedConfig = props.profile?.pending_config ?? props.profile?.config;
const originalConfig = savedConfig && editableConfig(savedConfig);
const config = ref<ProfileConfig>(
  originalConfig
    ? JSON.parse(JSON.stringify(originalConfig))
    : {
        working_day_enabled: false,
        cashier_shift_enabled: false,
        table_mode: "disabled",
        catalog_mode: "category",
        selected_ids: null,
        default_menu_id: null,
        payment_types: [],
        default_payment_type_id: "",
        default_customer_id: walkInId,
        receipt_template: { title: "", footer: "", show_tax: true },
        print_copies: 1,
        receipt_templates: [],
        default_receipt_templates: { ...emptyPosReceiptDefaults },
        tax_mode: "disabled",
        tax_rate_bps: 0,
        tax_rules: [],
        default_tax_rule_id: null,
      },
);
const name = ref(props.profile?.name ?? "");
const branchId = ref(
  props.profile?.branch_id ?? props.options.branches[0]?.id ?? "",
);
const active = ref(props.profile?.is_active ?? true);
const taxRate = ref(config.value.tax_rate_bps / 100);
const selectedIds = ref([...(config.value.selected_ids ?? [])]);
const tableStatusColors = ref<PosTableStatusColors>({ ...posTableStatusColors, ...config.value.table_status_colors });
const tableGroupIds = ref([...(config.value.table_group_ids ?? [])]);
const saving = ref(false);
const error = ref("");

const paymentTypesById = computed(
  () => new Map(config.value.payment_types.map((type) => [type.id, type])),
);
const paymentOptionsById = computed(() =>
  new Map(props.options.payment_types.map((payment) => [payment.id, payment])),
);
const acceptedPayments = computed(() =>
  config.value.payment_types
    .map(({ id }) => paymentOptionsById.value.get(id))
    .filter((payment): payment is PosPaymentOption => payment !== undefined),
);
const paymentChoices = computed(() => [
  ...acceptedPayments.value.map((payment, position) => ({ payment, position })),
  ...props.options.payment_types
    .filter(({ id }) => !paymentTypesById.value.has(id))
    .map((payment) => ({ payment, position: -1 })),
]);
const rootMenus = computed(() =>
  props.options.menus.filter(({ parent_id }) => parent_id === null),
);
const catalogChoices = computed(() =>
  config.value.catalog_mode === "menu" ? rootMenus.value : props.options.categories,
);
const selectedMenus = computed(() =>
  rootMenus.value.filter(({ id }) => selectedIds.value.includes(id)),
);
const defaultMenu = computed({
  get: () => selectedMenus.value.find(({ id }) => id === config.value.default_menu_id)?.id ?? "",
  set: (id: string) => {
    config.value.default_menu_id = id || null;
  },
});
const branchTableGroups = computed(() =>
  (props.options.table_groups ?? []).filter(
    (group) => group.branch_id === branchId.value,
  ),
);

function editableConfig({ default_tax_rule, ...config }: PosProfile["config"]): ProfileConfig {
  return config;
}

function selectCatalogNodes(ids: string[]) {
  selectedIds.value = ids;
  if (!defaultMenu.value) config.value.default_menu_id = null;
}

function paymentCurrency(payment: PosPaymentOption) {
  if (payment.currency) return payment.currency;
  return (
    paymentTypesById.value.get(payment.id)?.currency ??
    originalConfig?.payment_types.find(({ id }) => id === payment.id)
      ?.currency ?? store.business.currency
  );
}

function setPaymentCurrency(id: string, currency: unknown) {
  const payment = paymentTypesById.value.get(id);
  if (payment && (currency === "USD" || currency === "KHR"))
    payment.currency = currency;
}

function allowsCashFloat(payment: PosPaymentOption) {
  return (
    paymentTypesById.value.get(payment.id)?.allow_cash_float ??
    (config.value.cashier_shift_enabled && payment.kind === "cash")
  );
}

function togglePayment(payment: PosPaymentOption, accepted: boolean) {
  if (!accepted) {
    removePayment(payment.id);
    return;
  }
  if (paymentTypesById.value.has(payment.id)) return;
  config.value.payment_types.push({
    id: payment.id,
    currency: paymentCurrency(payment),
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
      acceptedPayments.value[0]?.id ?? "";
}

function movePayment(position: number, step: -1 | 1) {
  const payment = acceptedPayments.value[position];
  const neighbor = acceptedPayments.value[position + step];
  if (!payment || !neighbor) return;

  const types = [...config.value.payment_types];
  const from = types.findIndex(({ id }) => id === payment.id);
  const to = types.findIndex(({ id }) => id === neighbor.id);
  [types[from], types[to]] = [types[to], types[from]];
  config.value.payment_types = types;
}

function setCashFloat(id: string, enabled: boolean) {
  const type = paymentTypesById.value.get(id);
  if (type) type.allow_cash_float = enabled;
}

function close() {
  if (!saving.value) emit("close");
}

async function save(event: SubmitEvent) {
  if (saving.value || store.isReadOnly) return;
  error.value = "";
  const form = event.currentTarget as HTMLFormElement;
  if (!form.checkValidity()) {
    const control = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input:invalid, select:invalid, textarea:invalid",
    );
    const tab = control?.closest<HTMLElement>("[data-profile-tab]")?.dataset.profileTab;
    if (tab) profileTab.value = tab;
    const invalidTemplate = control?.closest<HTMLElement>("[data-receipt-template-id]")?.dataset.receiptTemplateId;
    if (invalidTemplate) receiptEditor.value?.selectTemplate(invalidTemplate);
    const disclosure = control?.closest("details");
    if (disclosure) disclosure.open = true;
    await nextTick();
    control?.reportValidity();
    return;
  }
  if (!name.value) {
    profileTab.value = "general";
    return;
  }
  const updated: ProfileConfig = {
    ...config.value,
    prompt_guest_cover: config.value.prompt_guest_cover ?? false,
    table_status_colors: { ...tableStatusColors.value },
    selected_ids: selectedIds.value.length ? selectedIds.value : null,
    default_menu_id: config.value.catalog_mode === "menu" ? defaultMenu.value || null : null,
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
    !updated.payment_types.some(({ currency }) =>
      currency === store.business.currency,
    )
  ) {
    profileTab.value = "payments";
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
