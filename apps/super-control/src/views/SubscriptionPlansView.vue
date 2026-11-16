<template>
  <PageHeader eyebrow="Subscription settings" title="Subscription plans" description="Set prices, Control features, and which plans customers can choose." />
  <p v-if="error" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error }}</p>
  <div class="grid items-start gap-6 xl:grid-cols-2">
    <section class="panel p-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="display m-0 text-xl font-extrabold">Plans</h2>
        <button type="button" class="btn-primary" :disabled="busy || loading" @click="edit()">Add plan</button>
      </div>
      <p v-if="loading" role="status">Loading plans…</p>
      <button v-else-if="!plans.length && error" type="button" class="btn-soft" @click="load">Retry</button>
      <p v-else-if="!plans.length" class="text-sm text-black/55">No subscription plans yet.</p>
      <ul v-else class="m-0 list-none divide-y divide-black/10 p-0">
        <li v-for="plan in plans" :key="plan.id" class="flex flex-wrap items-center gap-3 py-4">
          <div class="min-w-0 flex-1">
            <strong class="break-words">{{ plan.name }}</strong>
            <p class="mb-0 mt-1 text-sm text-black/60">
              {{ plan.amountMinor ? `${planPrice(plan.amountMinor)}/${plan.billingInterval}` : "Free" }}
              · {{ plan.isActive ? (plan.isPublic ? "Published" : "Hidden") : "Archived" }}
            </p>
            <p class="mb-0 mt-1 text-xs text-black/55">
              {{ plan.assignedBusinesses }} {{ plan.assignedBusinesses === 1 ? "business" : "businesses" }}
              · {{ plan.features.length }} Control features
            </p>
            <p class="mb-0 mt-1 text-xs text-black/55">
              {{ plan.limits.branches ?? "Unlimited" }} branches ·
              {{ plan.limits.menus ?? "Unlimited" }} menus ·
              {{ plan.limits.products ?? "Unlimited" }} products ·
              {{ plan.limits.dailyOrders ?? MAX_DAILY_ORDERS }} orders/day
            </p>
            <p class="mb-0 mt-1 text-xs text-black/55">
              <template v-if="plan.pos?.enabled">
                {{ plan.pos.profiles ?? "Unlimited" }} active POS profiles ·
                {{ plan.pos.dailySales ?? "Unlimited" }} POS sales/day
              </template>
              <template v-else>POS disabled</template>
            </p>
          </div>
          <button type="button" class="btn-soft" :disabled="busy" @click="edit(plan)">Edit</button>
          <button v-if="plan.id !== 'plan_standard' && (plan.isActive || !plan.assignedBusinesses)"
            type="button" class="btn-soft" :disabled="busy" @click="removing = plan">
            {{ plan.assignedBusinesses ? "Archive" : "Delete" }}
          </button>
        </li>
      </ul>
    </section>

    <form v-if="editing" class="panel grid gap-4 p-6" @submit.prevent="save">
      <h2 class="display m-0 text-xl font-extrabold">{{ draft.id ? "Edit plan" : "Add plan" }}</h2>
      <fieldset class="m-0 grid min-w-0 gap-4 border-0 p-0" :disabled="busy">
        <label><span class="label">Plan name</span><input v-model.trim="draft.name" class="input" maxlength="80" required /></label>
        <label><span class="label">Description</span><textarea v-model.trim="draft.description" class="input" maxlength="500" rows="3" /></label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label><span class="label">Price type</span>
            <select v-model="draft.priceType" class="input"><option value="free">Free</option><option value="paid">Paid</option></select>
          </label>
          <label><span class="label">Display order</span><input v-model.number="draft.displayOrder" class="input" type="number" min="0" step="1" required /></label>
          <template v-if="draft.priceType === 'paid'">
            <label><span class="label">Price (USD)</span><input v-model.number="draft.amount" class="input" type="number" min="0.01" step="0.01" required /></label>
            <label><span class="label">Billing period</span>
              <select v-model="draft.billingInterval" class="input"><option value="month">Monthly</option><option value="year">Yearly</option></select>
            </label>
          </template>
        </div>
        <label v-if="wasArchived" class="flex items-center gap-2 text-sm font-bold">
          <input v-model="draft.isActive" type="checkbox" /> Restore plan for new assignments
        </label>
        <label class="flex items-center gap-2 text-sm font-bold">
          <input v-model="draft.isPublic" type="checkbox" :disabled="!draft.isActive" /> Show on public website
        </label>
        <fieldset class="m-0 grid gap-2 rounded-xl border border-black/10 p-3 sm:grid-cols-2">
          <legend class="px-1 text-sm font-bold">Included Control features</legend>
          <label v-for="key in planControlPages" :key="key" class="flex items-center gap-2 text-sm">
            <input v-model="draft.features" :value="key" type="checkbox" /> {{ controlPages[key].label }}
          </label>
        </fieldset>
        <fieldset class="m-0 grid min-w-0 gap-3 rounded-xl border border-black/10 p-3 sm:grid-cols-2">
          <legend class="px-1 text-sm font-bold">Plan limits per business</legend>
          <label v-for="limit in limitFields" :key="limit.key">
            <span class="label">{{ limit.label }}</span>
            <input
              v-model.number="draft.limits[limit.key]"
              class="input"
              type="number"
              :min="limit.min"
              :max="limit.max"
              step="1"
              :placeholder="limit.placeholder"
            />
          </label>
          <p class="m-0 text-xs leading-5 text-black/60 sm:col-span-2">
            Branches, menus and products count even when archived or hidden. The default branch and submenus count too.
            Daily orders are counted across all branches in the business’s time zone.
          </p>
        </fieldset>
        <fieldset class="m-0 grid min-w-0 gap-3 rounded-xl border border-black/10 p-3">
          <legend class="px-1 text-sm font-bold">Point of sale (POS)</legend>
          <label class="flex items-center gap-2 text-sm font-bold">
            <input v-model="draft.pos.enabled" type="checkbox" /> Enable POS
          </label>
          <template v-if="draft.pos.enabled">
            <div class="grid gap-3 sm:grid-cols-2">
              <label>
                <span class="label">Active POS profiles</span>
                <input v-model.number="draft.pos.profiles" class="input" type="number" min="0" step="1" placeholder="Unlimited" />
              </label>
              <label>
                <span class="label">Daily POS sales</span>
                <input v-model.number="draft.pos.dailySales" class="input" type="number" min="0" step="1" placeholder="Unlimited" />
              </label>
            </div>
            <p class="m-0 text-xs leading-5 text-black/60">
              Limits apply across all branches. Daily sales count paid transactions by POS business date.
              Offline register sales are checked when they sync.
            </p>
          </template>
        </fieldset>
        <p v-if="assigned" class="m-0 text-sm text-black/60">
          Changes to features and limits apply to the {{ assigned }} assigned {{ assigned === 1 ? "business" : "businesses" }}.
        </p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary">{{ busy ? "Saving…" : "Save plan" }}</button>
          <button type="button" class="btn-soft" @click="editing = false">Cancel</button>
        </div>
      </fieldset>
    </form>
  </div>

  <ConfirmDialog :open="Boolean(removing)" :title="removing?.assignedBusinesses ? 'Archive plan?' : 'Delete plan?'"
    :message="removing?.assignedBusinesses ? 'Existing businesses keep this plan. New businesses can no longer choose it.' : 'This unused plan will be deleted.'"
    :confirm-label="removing?.assignedBusinesses ? 'Archive plan' : 'Delete plan'" :busy="busy" danger
    @close="removing = null" @confirm="remove" />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { controlPageIds, controlPages, sellingControlPages, type ControlPage } from "../../../../shared/controlPages";
import { MAX_DAILY_ORDERS, planPrice, type ManagedPlan, type PlanLimits, type PlanPos } from "../../../../shared/subscriptionPlans";
import { api, loadSubscriptionPlans } from "../api";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import PageHeader from "../components/PageHeader.vue";
import { useSuperStore } from "../stores/super";

const store = useSuperStore();
const plans = ref<ManagedPlan[]>([]);
const loading = ref(true);
const busy = ref(false);
const editing = ref(false);
const removing = ref<ManagedPlan | null>(null);
const error = ref("");
const assigned = ref(0);
const wasArchived = ref(false);
const endpoint = "/api/super/subscription-plans";
const planControlPages = controlPageIds.filter((page) => !sellingControlPages.includes(page));
const limitFields = [
  { key: "branches", label: "Branches", min: 1, max: undefined, placeholder: "Unlimited" },
  { key: "menus", label: "Menus and submenus", min: 0, max: undefined, placeholder: "Unlimited" },
  { key: "products", label: "Products", min: 0, max: undefined, placeholder: "Unlimited" },
  { key: "dailyOrders", label: "Daily order submissions", min: 0, max: MAX_DAILY_ORDERS, placeholder: String(MAX_DAILY_ORDERS) },
] as const;
const limitDraft = (limits?: PlanLimits): Record<keyof PlanLimits, number | ""> => ({
  branches: limits?.branches ?? "",
  menus: limits?.menus ?? "",
  products: limits?.products ?? "",
  dailyOrders: limits?.dailyOrders ?? "",
});
const posDraft = (pos?: PlanPos): { enabled: boolean; profiles: number | ""; dailySales: number | "" } => ({
  enabled: pos?.enabled ?? false,
  profiles: pos?.profiles ?? "",
  dailySales: pos?.dailySales ?? "",
});
const draft = ref({
  id: "", name: "", description: "", isActive: true, isPublic: false, displayOrder: 0,
  priceType: "free", amount: 0, billingInterval: "month" as ManagedPlan["billingInterval"],
  features: [] as ControlPage[],
  limits: limitDraft(),
  pos: posDraft(),
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    plans.value = (await loadSubscriptionPlans()).plans;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not load plans";
  } finally {
    loading.value = false;
  }
}

function edit(plan?: ManagedPlan) {
  error.value = "";
  assigned.value = plan?.assignedBusinesses ?? 0;
  wasArchived.value = plan?.isActive === false;
  draft.value = {
    id: plan?.id ?? "", name: plan?.name ?? "", description: plan?.description ?? "",
    isActive: plan?.isActive ?? true, isPublic: plan?.isPublic ?? false, displayOrder: plan?.displayOrder ?? 0,
    priceType: plan?.amountMinor ? "paid" : "free", amount: (plan?.amountMinor ?? 0) / 100,
    billingInterval: plan?.billingInterval ?? "month", features: [...(plan?.features ?? [])],
    limits: limitDraft(plan?.limits),
    pos: posDraft(plan?.pos),
  };
  editing.value = true;
}

async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  const { id, priceType, amount, limits, pos, ...fields } = draft.value;
  try {
    await api(id ? `${endpoint}/${id}` : endpoint, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({
        ...fields, isPublic: fields.isActive && fields.isPublic,
        amountMinor: priceType === "free" ? 0 : Math.round(amount * 100),
        limits: Object.fromEntries(limitFields.map(({ key }) => [key, limits[key] === "" ? null : limits[key]])),
        pos: {
          enabled: pos.enabled,
          profiles: pos.profiles === "" ? null : pos.profiles,
          dailySales: pos.dailySales === "" ? null : pos.dailySales,
        },
      }),
    });
    editing.value = false;
    store.notify("Subscription plan saved");
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not save plan";
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!removing.value || busy.value) return;
  busy.value = true;
  error.value = "";
  const id = removing.value.id;
  try {
    const result = await api<{ archived: boolean }>(`${endpoint}/${id}`, { method: "DELETE" });
    if (draft.value.id === id) editing.value = false;
    removing.value = null;
    store.notify(result.archived ? "Plan archived" : "Plan deleted");
    await load();
  } catch (cause) {
    removing.value = null;
    error.value = cause instanceof Error ? cause.message : "Could not remove plan";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
