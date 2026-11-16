<template>
  <div>
    <label>
      <span class="label">Subscription plan</span>
      <select v-model="selection" class="input" required :disabled="loading || disabled || !plans.length">
        <option :value="null" disabled>{{ loading ? "Loading plans…" : "Choose a plan" }}</option>
        <option v-for="plan in plans" :key="plan.id" :value="plan">
          {{ plan.name }} · {{ plan.amountMinor ? `${planPrice(plan.amountMinor)}/${plan.billingInterval}` : "Free" }}
        </option>
      </select>
    </label>
    <p v-if="error" class="mb-0 text-sm text-red-700" role="alert">
      {{ error }} <button type="button" class="font-bold underline" @click="load">Retry</button>
    </p>
    <p v-else-if="!loading && !plans.length" class="mb-0 text-sm text-black/55">
      No plans are available for this selection.
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { planPrice, type ManagedPlan } from "../../../../shared/subscriptionPlans";
import { loadSubscriptionPlans } from "../api";

const props = defineProps<{ defaultToStandard?: boolean; excludePlanId?: string | null; disabled?: boolean }>();
const selection = defineModel<ManagedPlan | null>({ required: true });
const plans = ref<ManagedPlan[]>([]);
const loading = ref(true);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  selection.value = null;
  try {
    const result = await loadSubscriptionPlans();
    plans.value = result.plans.filter(plan => plan.isActive && plan.id !== props.excludePlanId);
    if (props.defaultToStandard)
      selection.value = plans.value.find(plan => plan.id === "plan_standard") ?? null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not load plans";
  } finally {
    loading.value = false;
  }
}

defineExpose({ load });
onMounted(load);
</script>
