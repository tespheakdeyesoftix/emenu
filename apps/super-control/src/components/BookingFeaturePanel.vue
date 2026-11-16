<template>
  <section class="panel p-6" aria-labelledby="booking-feature-title">
    <h2 id="booking-feature-title" class="display m-0 text-xl font-extrabold">
      Feature Settings
    </h2>
    <p v-if="loading" role="status">Loading Booking access…</p>
    <template v-if="feature">
      <label class="mt-4 flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          :checked="feature.enabled"
          :disabled="saving"
          @change="
            save({ enabled: ($event.target as HTMLInputElement).checked })
          "
        />
        Enable Booking for this business
      </label>
      <p class="mt-2 text-sm text-black/65">
        {{
          !feature.planIncluded
            ? "The assigned subscription plan must include Booking."
            : !feature.enabled
              ? "The business switch is off. Existing bookings remain available to authorized staff."
              : !feature.effective
                ? "The business or subscription is inactive. Existing bookings are read-only."
                : "Booking is enabled. Choose participating branches in Booking Settings."
        }}
      </p>
      <h3 class="mb-1 mt-5 font-extrabold">Staff Booking access</h3>
      <p class="mt-0 text-sm text-black/65">
        Owners and managers have access automatically. Granted staff can view
        bookings and guest details.
      </p>
      <div v-if="feature.staff.length" class="grid gap-2">
        <label
          v-for="member in feature.staff"
          :key="member.userId"
          class="flex items-center gap-3 rounded-xl bg-cream p-3 text-sm"
        >
          <input
            type="checkbox"
            :checked="member.canView"
            :disabled="saving"
            @change="
              save({
                userId: member.userId,
                canView: ($event.target as HTMLInputElement).checked,
              })
            "
          />
          <span
            ><strong>{{ member.name }}</strong> · {{ member.email }}</span
          >
        </label>
      </div>
      <p v-else class="text-sm text-black/60">
        No staff accounts need an access grant.
      </p>
    </template>
    <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <button
      v-if="error && !feature"
      class="btn-soft"
      type="button"
      @click="load"
    >
      Try again
    </button>
    <p v-if="message" class="text-sm text-emerald-700" role="status">
      {{ message }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

const props = defineProps<{ businessId: string }>();
type Feature = {
  enabled: boolean;
  planIncluded: boolean;
  effective: boolean;
  staff: { userId: string; name: string; email: string; canView: boolean }[];
};
const feature = ref<Feature | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const message = ref("");
const endpoint = () =>
  `/api/super/businesses/${encodeURIComponent(props.businessId)}/booking-feature`;

async function load() {
  loading.value = true;
  error.value = "";
  try {
    feature.value = await api<Feature>(endpoint());
  } catch (value) {
    error.value =
      value instanceof Error ? value.message : "Could not load Booking access";
  } finally {
    loading.value = false;
  }
}

async function save(
  input: { enabled: boolean } | { userId: string; canView: boolean },
) {
  if (saving.value) return;
  saving.value = true;
  error.value = message.value = "";
  try {
    feature.value = await api<Feature>(endpoint(), {
      method: "PUT",
      body: JSON.stringify(input),
    });
    message.value = "Booking access saved.";
  } catch (value) {
    await load();
    error.value =
      value instanceof Error ? value.message : "Could not save Booking access";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
