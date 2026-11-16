<template>
  <PageHeader
    eyebrow="Tenant onboarding"
    title="Register a business"
    description="Create the owner account and a ready-to-configure menu workspace."
  />
  <form
    class="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_.8fr]"
    @submit.prevent="submit"
  >
    <section class="panel grid gap-5 p-6 lg:p-8">
      <div>
        <h2 class="display m-0 text-xl font-extrabold">Business details</h2>
        <p class="mb-0 mt-1 text-sm text-black/45">
          The menu starts with Khmer, KHR, and the default pricing setup.
        </p>
      </div>
      <label
        ><span class="label">Business name</span
        ><input
          v-model.trim="form.businessName"
          class="input"
          maxlength="160"
          required
      /></label>
      <label
        ><span class="label">Menu link</span>
        <div
          class="flex items-center rounded-2xl border border-black/10 bg-white focus-within:border-moss focus-within:ring-4 focus-within:ring-moss/10"
        >
          <span class="pl-4 text-sm text-black/35">/</span
          ><input
            :value="form.slug"
            class="min-w-0 flex-1 border-0 bg-transparent px-2 py-3.5 text-sm outline-none"
            maxlength="48"
            required
            @input="updateSlug"
          />
        </div>
        <small class="mt-2 block text-black/40"
          >This is the last part of the public menu URL. Use lowercase letters, numbers, and single hyphens.
          You can correct it from Business detail after registration.</small
        ></label
      >
      <SubscriptionPlanPicker ref="planPicker" v-model="selectedPlan" default-to-standard :disabled="saving" />
      <div class="border-t border-black/[.06] pt-5">
        <h2 class="display m-0 text-xl font-extrabold">Owner account</h2>
      </div>
      <label
        ><span class="label">Owner name</span
        ><input
          v-model.trim="form.ownerDisplayName"
          class="input"
          maxlength="120"
          required
      /></label>
      <label
        ><span class="label">Login email</span
        ><input
          v-model.trim="form.ownerEmail"
          class="input"
          type="email"
          autocomplete="off"
          required
      /></label>
    </section>
    <aside class="panel h-fit p-6 lg:p-8">
      <div class="grid size-12 place-items-center rounded-2xl bg-lime">
        <KeyRound :size="21" />
      </div>
      <h2 class="display mb-2 mt-5 text-xl font-extrabold">
        Temporary password
      </h2>
      <p class="mt-0 text-sm leading-6 text-black/50">
        Copy this password and deliver it to the owner securely. It is never
        stored or logged as plain text.
      </p>
      <label
        ><span class="label">Initial password</span
        ><input
          v-model="form.password"
          class="input font-mono"
          type="text"
          minlength="8"
          autocomplete="off"
          required
      /></label>
      <div class="mt-3 flex gap-2">
        <button type="button" class="btn-soft flex-1" @click="generate">
          <RefreshCw :size="15" />Generate</button
        ><button type="button" class="btn-soft flex-1" @click="copy">
          <Copy :size="15" />Copy
        </button>
      </div>
      <p
        v-if="error"
        class="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
      >
        {{ error }}
      </p>
      <button class="btn-primary mt-6 w-full" :disabled="saving || !selectedPlan">
        <LoaderCircle v-if="saving" :size="17" class="animate-spin" /><Building2
          v-else
          :size="17"
        />{{ saving ? "Registering…" : "Register business" }}
      </button>
    </aside>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  Building2,
  Copy,
  KeyRound,
  LoaderCircle,
  RefreshCw,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import SubscriptionPlanPicker from "../components/SubscriptionPlanPicker.vue";
import type { ManagedPlan } from "../../../../shared/subscriptionPlans";
import { api, ApiError } from "../api";
import {
  AUTH_VERSION,
  createPasswordProof,
  generateTemporaryPassword,
} from "../utils/passwordProof";
import { useSuperStore } from "../stores/super";
const router = useRouter();
const store = useSuperStore();
const saving = ref(false);
const error = ref("");
const selectedPlan = ref<ManagedPlan | null>(null);
const planPicker = ref<InstanceType<typeof SubscriptionPlanPicker> | null>(null);
const form = reactive({
  businessName: "",
  slug: "",
  ownerDisplayName: "",
  ownerEmail: "",
  password: generateTemporaryPassword(),
});
function updateSlug(event: Event) {
  form.slug = (event.target as HTMLInputElement).value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-/, "");
}
function generate() {
  form.password = generateTemporaryPassword();
}
async function copy() {
  await navigator.clipboard.writeText(form.password);
  store.notify("Temporary password copied");
}
async function submit() {
  const plan = selectedPlan.value;
  if (!plan || saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    const email = form.ownerEmail.trim().toLowerCase();
    const passwordProof = await createPasswordProof(email, form.password);
    const result = await api<{ business: { id: string } }>(
      "/api/super/businesses",
      {
        method: "POST",
        body: JSON.stringify({
          businessName: form.businessName,
          slug: form.slug,
          ownerDisplayName: form.ownerDisplayName,
          ownerEmail: email,
          passwordProof,
          authVersion: AUTH_VERSION,
          planId: plan.id,
          priceId: plan.priceId,
        }),
      },
    );
    store.notify("Business registered successfully");
    await router.push(`/businesses/${result.business.id}`);
  } catch (value) {
    if (value instanceof ApiError && value.code === "PLAN_UNAVAILABLE") await planPicker.value?.load();
    error.value =
      value instanceof Error ? value.message : "Could not register business";
  } finally {
    saving.value = false;
  }
}
</script>
