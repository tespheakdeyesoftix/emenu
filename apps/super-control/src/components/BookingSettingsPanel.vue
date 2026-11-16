<template>
  <section class="panel p-6" aria-labelledby="booking-settings-title">
    <h2 id="booking-settings-title" class="display m-0 text-xl font-extrabold">
      Booking Settings
    </h2>
    <p class="mt-2 text-sm text-black/60">
      Bookings follow regular business hours.
    </p>
    <p v-if="loading" role="status">Loading booking settings…</p>
    <div
      v-if="publication"
      class="mt-5 rounded-xl border border-black/10 p-4 text-sm"
      role="status"
    >
      <p class="m-0 font-extrabold">
        {{
          bookingPageLive
            ? "Guest booking page is live"
            : "Guest booking page is unavailable"
        }}
      </p>
      <ul v-if="!bookingPageLive" class="mb-0 mt-2 list-disc space-y-1 pl-5">
        <li v-if="!publication.planIncluded">
          <template v-if="publication.planName">
            The {{ publication.planName }} subscription plan needs Bookings
            enabled.
          </template>
          <template v-else>
            Assign a subscription plan that includes Bookings.
          </template>
          <RouterLink to="/subscription-plans" class="font-bold underline">
            Manage subscription plans
          </RouterLink>
        </li>
        <li v-if="!publication.enabled">
          Turn on Booking in Feature Settings.
        </li>
        <li
          v-if="
            publication.enabled &&
            publication.planIncluded &&
            !publication.effective
          "
        >
          Check that the business is active and its subscription is current.
        </li>
        <li v-if="!publication.termsPublished">
          Save the booking terms in both Khmer and English.
        </li>
        <li v-if="!enabledBranches.size">
          Enable and save at least one active branch.
        </li>
      </ul>
      <p v-if="dirty" class="mb-0 mt-2 text-black/60">
        Save your changes to update the guest booking page.
      </p>
    </div>
    <form v-if="draft" class="mt-5 grid gap-5" @submit.prevent="save">
      <fieldset
        :disabled="saving"
        class="m-0 grid gap-4 border-0 p-0 sm:grid-cols-3"
      >
        <label v-for="field in limits" :key="field.key">
          <span class="label">{{ field.label }}</span>
          <input
            v-model.number="draft[field.key]"
            class="input"
            type="number"
            step="1"
            :min="field.min"
            :max="field.max"
            required
          />
        </label>
      </fieldset>
      <div class="grid gap-4 sm:grid-cols-2">
        <label
          ><span class="label">Booking terms in Khmer</span>
          <textarea
            v-model="draft.termsKm"
            class="input"
            rows="5"
            maxlength="10000"
            :disabled="saving"
            lang="km"
          ></textarea>
        </label>
        <label
          ><span class="label">Booking terms in English</span>
          <textarea
            v-model="draft.termsEn"
            class="input"
            rows="5"
            maxlength="10000"
            :disabled="saving"
            lang="en"
          ></textarea>
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <a
          :href="bookingUrl()"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-soft"
          >Open branch picker</a
        >
        <button type="button" class="btn-soft" @click="copyLink()">
          Copy booking link
        </button>
      </div>
      <h3 class="m-0 text-lg font-extrabold">Branches</h3>
      <p v-if="!draft.branches.length" class="m-0 text-sm text-black/60">
        Add a branch before opening bookings.
      </p>
      <section
        v-for="branch in draft.branches"
        :key="branch.id"
        class="grid gap-3 rounded-xl border border-black/10 p-4"
      >
        <h4 class="m-0 flex flex-wrap items-center gap-2 font-extrabold">
          {{ branch.name }}
          <span class="text-sm text-black/60">
            {{
              !branch.active
                ? "Inactive"
                : bookingPageLive && enabledBranches.has(branch.id)
                  ? "Live"
                  : "Unavailable"
            }}
          </span>
        </h4>
        <label class="flex items-center gap-2 text-sm font-bold">
          <input
            v-model="branch.enabled"
            type="checkbox"
            :disabled="saving || !branch.active"
          />
          Enable booking for this branch
        </label>
        <label
          ><span class="label">Blocked dates (YYYY-MM-DD, one per line)</span>
          <textarea
            v-model="branch.blockedDatesText"
            class="input"
            rows="3"
            maxlength="5000"
            :disabled="saving"
          ></textarea>
        </label>
        <div class="flex flex-wrap gap-2">
          <button class="btn-soft" type="button" @click="copyLink(branch.slug)">
            Copy branch link
          </button>
        </div>
      </section>
      <button
        class="btn-primary justify-self-start"
        type="submit"
        :disabled="saving || !dirty"
      >
        {{ saving ? "Saving…" : "Save booking settings" }}
      </button>
    </form>
    <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <button v-if="error && !draft" class="btn-soft" type="button" @click="load">
      Try again
    </button>
    <p v-if="message" class="text-sm text-emerald-700" role="status">
      {{ message }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { BookingBranch } from "../../../../shared/booking";
import { api } from "../api";

const props = defineProps<{ businessId: string; menuUrl: string }>();
type Rules = {
  slotMinutes: number;
  noticeMinutes: number;
  advanceDays: number;
  minPax: number;
  maxPax: number;
  termsKm: string;
  termsEn: string;
};
type Branch = BookingBranch & {
  active: boolean;
  enabled: boolean;
};
type Publication = {
  enabled: boolean;
  planIncluded: boolean;
  planName: string | null;
  effective: boolean;
  termsPublished: boolean;
};
type Settings = Rules & {
  branches: (Branch & { blockedDates: string[] })[];
  publication: Publication;
  termsVersion: string;
};
const draft = ref<
  (Rules & { branches: (Branch & { blockedDatesText: string })[] }) | null
>(null);
const publication = ref<Publication | null>(null);
const enabledBranches = ref(new Set<string>());
const bookingPageLive = computed(
  () =>
    publication.value?.effective &&
    publication.value.termsPublished &&
    enabledBranches.value.size > 0,
);
const baseline = ref("");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const message = ref("");
const endpoint = () =>
  `/api/super/businesses/${encodeURIComponent(props.businessId)}/booking-settings`;
const limits = [
  { key: "slotMinutes", label: "Slot interval (minutes)", min: 5, max: 240 },
  {
    key: "noticeMinutes",
    label: "Minimum notice (minutes)",
    min: 0,
    max: 525600,
  },
  {
    key: "advanceDays",
    label: "Advance booking limit (days)",
    min: 0,
    max: 365,
  },
  { key: "minPax", label: "Minimum guests", min: 1, max: 1000 },
  { key: "maxPax", label: "Maximum guests", min: 1, max: 1000 },
] as const;

function payload() {
  if (!draft.value) return "";
  const { branches, ...rules } = draft.value;
  return JSON.stringify({
    ...rules,
    branches: branches.map(({ id, enabled, blockedDatesText }) => ({
      id,
      enabled,
      blockedDates: blockedDatesText.split(/\s+/).filter(Boolean),
    })),
  });
}
const dirty = computed(() => payload() !== baseline.value);

function useSettings({
  branches,
  publication: savedPublication,
  termsVersion: _termsVersion,
  ...rules
}: Settings) {
  publication.value = savedPublication;
  enabledBranches.value = new Set(
    branches
      .filter(({ active, enabled }) => active && enabled)
      .map(({ id }) => id),
  );
  draft.value = {
    ...rules,
    branches: branches.map(({ blockedDates, ...branch }) => ({
      ...branch,
      blockedDatesText: blockedDates.join("\n"),
    })),
  };
  baseline.value = payload();
}

function bookingUrl(branch?: string) {
  const url = new URL(props.menuUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/booking`;
  url.search = "";
  url.hash = "";
  if (branch) url.searchParams.set("branch", branch);
  return url.toString();
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    useSettings(await api<Settings>(endpoint()));
  } catch (value) {
    error.value =
      value instanceof Error
        ? value.message
        : "Could not load booking settings";
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (saving.value || !dirty.value) return;
  saving.value = true;
  error.value = message.value = "";
  try {
    useSettings(
      await api<Settings>(endpoint(), { method: "PUT", body: payload() }),
    );
    message.value = "Booking settings saved.";
  } catch (value) {
    error.value =
      value instanceof Error
        ? value.message
        : "Could not save booking settings";
  } finally {
    saving.value = false;
  }
}

async function copyLink(branch?: string) {
  error.value = message.value = "";
  try {
    await navigator.clipboard.writeText(bookingUrl(branch));
    message.value = "Booking link copied.";
  } catch {
    error.value = bookingUrl(branch);
  }
}

onMounted(load);
</script>
