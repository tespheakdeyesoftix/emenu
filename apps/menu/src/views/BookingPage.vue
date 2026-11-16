<template>
  <main
    :lang="language"
    class="min-h-screen bg-cream px-4 py-6 text-ink sm:py-10"
  >
    <div class="mx-auto max-w-xl">
      <header class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <RouterLink :to="menuLink" class="text-sm font-bold underline">{{
          copy.back
        }}</RouterLink>
        <div class="flex items-center gap-2 rounded-full bg-white p-1">
          <button
            v-for="option in languages"
            :key="option"
            type="button"
            :lang="option"
            class="rounded-full px-3 py-1.5 text-sm font-bold"
            :class="language === option ? 'bg-ink text-white' : ''"
            :aria-pressed="language === option"
            :disabled="sending"
            @click="language = option"
          >
            {{ option === "km" ? "ខ្មែរ" : "English" }}
          </button>
        </div>
      </header>
      <section
        class="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-7"
        aria-labelledby="booking-title"
      >
        <p
          v-if="businessName && (!config || receipt)"
          class="mb-1 mt-0 text-sm font-bold text-black/65"
        >
          {{ businessName }}
        </p>
        <h1 id="booking-title" class="m-0 text-2xl font-extrabold sm:text-3xl">
          {{ receipt ? copy.received : copy.title }}
        </h1>
        <p v-if="loading" role="status">{{ copy.loading }}</p>
        <div v-else-if="pageError" class="mt-4" role="alert">
          <p>{{ copy[pageError] }}</p>
          <button type="button" class="booking-button" @click="revision++">
            {{ copy.retry }}
          </button>
        </div>
        <div v-else-if="receipt" class="mt-4" role="status">
          <p>{{ copy.followup }}</p>
          <dl class="grid gap-3 rounded-2xl bg-cream p-4 sm:grid-cols-2">
            <div>
              <dt>{{ copy.reference }}</dt>
              <dd class="m-0 font-bold">{{ receipt.reference }}</dd>
            </div>
            <div>
              <dt>{{ copy.branch }}</dt>
              <dd class="m-0 font-bold">{{ receipt.branchName }}</dd>
            </div>
            <div>
              <dt>{{ copy.arrival }}</dt>
              <dd class="m-0 font-bold">
                {{ receipt.arrivalDate }} · {{ receipt.arrivalTime }}
              </dd>
            </div>
            <div>
              <dt>{{ copy.pax }}</dt>
              <dd class="m-0 font-bold">{{ receipt.pax }}</dd>
            </div>
          </dl>
        </div>
        <div v-else-if="!config" class="mt-4 grid gap-2">
          <p class="m-0 font-semibold">{{ copy.selectBranch }}</p>
          <RouterLink
            v-for="branch in branches"
            :key="branch.id"
            :to="{ path: route.path, query: { branch: branch.slug } }"
            class="rounded-xl border border-black/15 px-4 py-3 font-bold hover:bg-cream"
            >{{ branch.name }}</RouterLink
          >
        </div>
        <form v-else class="mt-4" @submit.prevent="submit">
          <fieldset :disabled="sending" class="m-0 grid gap-4 border-0 p-0">
            <div class="grid gap-4 sm:grid-cols-2">
              <label
                >{{ copy.date }}
                <input
                  v-model="arrivalDate"
                  class="booking-field"
                  type="date"
                  required
                  :min="config.today"
                  :max="config.lastDate"
                />
              </label>
              <label
                >{{ copy.time }}
                <select
                  v-model="arrivalTime"
                  class="booking-field"
                  :disabled="slotsLoading || !slots.length"
                  :aria-describedby="
                    showNoSlots ? 'booking-no-slots' : undefined
                  "
                  required
                >
                  <option value="">
                    {{ slotsLoading ? copy.loading : copy.selectTime }}
                  </option>
                  <option v-for="slot in slots" :key="slot" :value="slot">
                    {{ slot }}
                  </option>
                </select>
              </label>
            </div>
            <p
              v-if="showNoSlots"
              id="booking-no-slots"
              class="m-0 text-sm text-amber-800"
              role="status"
            >
              {{
                config.businessHours.some(({ open, close }) => open !== close)
                  ? copy.noSlots
                  : copy.noOpeningHours
              }}
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <label
                >{{ copy.name }}
                <input
                  v-model="guestName"
                  class="booking-field"
                  autocomplete="name"
                  maxlength="100"
                  required
                />
              </label>
              <label
                >{{ copy.phone }}
                <input
                  v-model="guestPhone"
                  class="booking-field"
                  type="tel"
                  autocomplete="tel"
                  maxlength="32"
                  required
                />
              </label>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label
                >{{ copy.pax }} ({{ config.minPax }}–{{ config.maxPax }})
                <select v-model="pax" class="booking-field" required>
                  <option :value="null" disabled>{{ copy.selectPax }}</option>
                  <option v-for="size in partySizes" :key="size" :value="size">
                    {{ size }}
                  </option>
                </select>
              </label>
              <label
                >{{ copy.preference }}
                <select v-model="preference" class="booking-field">
                  <option value="">{{ copy.noPreference }}</option>
                  <option
                    v-for="option in config.preferences"
                    :key="option"
                    :value="option"
                  >
                    {{ copy.preferences[option] }}
                  </option>
                </select>
              </label>
            </div>
            <label
              >{{ copy.preferenceText }}
              <span class="text-black/55">({{ copy.optional }})</span>
              <input
                v-model="preferenceText"
                class="booking-field"
                maxlength="200"
              />
            </label>
            <label
              >{{ copy.note }}
              <span class="text-black/55">({{ copy.optional }})</span>
              <textarea
                v-model="note"
                class="booking-field"
                rows="2"
                maxlength="500"
              ></textarea>
            </label>
            <div class="rounded-xl bg-cream p-3">
              <h2 class="m-0 text-base font-bold">{{ copy.terms }}</h2>
              <div
                class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm"
                tabindex="0"
                :aria-label="copy.terms"
              >
                {{ config.terms[language] }}
              </div>
              <label class="mt-3 flex items-start gap-2">
                <input
                  v-model="accepted"
                  type="checkbox"
                  required
                  class="mt-1 size-4"
                />
                {{ copy.accept }}
              </label>
            </div>
            <p
              v-if="formError"
              class="m-0 text-sm font-semibold text-red-700"
              role="alert"
            >
              {{ copy[formError] }}
            </p>
            <button
              v-if="
                formError === 'networkError' && !slots.length && !slotsLoading
              "
              type="button"
              class="justify-self-start font-bold underline"
              @click="retrySlots"
            >
              {{ copy.retry }}
            </button>
            <button
              class="booking-button"
              type="submit"
              :disabled="
                !accepted ||
                !arrivalTime ||
                pax === null ||
                !guestName.trim() ||
                !guestPhone.trim() ||
                slotsLoading
              "
            >
              {{ sending ? copy.sending : copy.submit }}
            </button>
          </fieldset>
        </form>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  bookingPreferences,
  type BookingBranch,
  type BookingLanguage,
  type BookingReceipt,
} from "../../../../shared/booking";
import { bookingCopy } from "../bookingCopy";
import { randomUuid } from "../utils/randomUuid";

type Config = {
  businessName: string;
  businessHours: { open: string; close: string }[];
  today: string;
  lastDate: string;
  minPax: number;
  maxPax: number;
  slots: string[];
  preferences: (typeof bookingPreferences)[number][];
  terms: { km: string; en: string; version: string };
};
type ErrorKey =
  | "unavailable"
  | "networkError"
  | "invalidDetails"
  | "invalidParty"
  | "slotUnavailable"
  | "termsChanged"
  | "rulesChanged";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const route = useRoute();
const languages = ["km", "en"] as const;
const language = ref<BookingLanguage>(
  localStorage.getItem("angkor_emenu_language") === "en" ? "en" : "km",
);
const copy = computed(() => bookingCopy[language.value]);
const config = ref<Config | null>(null);
const receipt = ref<BookingReceipt | null>(null);
const branches = ref<BookingBranch[]>([]);
const businessName = ref("");
const slug = ref("");
const loading = ref(true);
const sending = ref(false);
const revision = ref(0);
const pageError = ref<ErrorKey | "">("");
const formError = ref<ErrorKey | "">("");
const slots = ref<string[]>([]);
const slotsLoading = ref(false);
const slotsRevision = ref(0);
const arrivalDate = ref("");
const arrivalTime = ref("");
const pax = ref<number | null>(null);
const guestName = ref("");
const guestPhone = ref("");
const preference = ref("");
const preferenceText = ref("");
const note = ref("");
const accepted = ref(false);
const partySizes = computed(() => {
  if (!config.value) return [];
  const { minPax, maxPax } = config.value;
  return Array.from(
    { length: maxPax - minPax + 1 },
    (_, index) => minPax + index,
  );
});
const showNoSlots = computed(
  () =>
    arrivalDate.value &&
    !slotsLoading.value &&
    !slots.value.length &&
    !formError.value,
);
let submitted: { key: string; id: string } | null = null;
const branchQuery = computed(() =>
  "branch" in route.query
    ? typeof route.query.branch === "string"
      ? route.query.branch
      : ""
    : null,
);
const menuLink = computed(() => ({
  path: route.meta.customDomain
    ? "/"
    : `/${encodeURIComponent(String(route.params.slug || slug.value))}`,
  query: branchQuery.value ? { branch: branchQuery.value } : {},
}));

class BookingError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(code);
  }
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new BookingError(response.status, body.code);
  return body as T;
}
function bookingUrl(business: string, branch: string | null, date?: string) {
  const query = new URLSearchParams();
  if (branch !== null) query.set("branch", branch);
  if (date) query.set("date", date);
  return `${apiBase}/api/public/businesses/${encodeURIComponent(business)}/bookings${query.size ? `?${query}` : ""}`;
}
function setConfig(value: Config) {
  if (config.value && config.value.terms.version !== value.terms.version)
    accepted.value = false;
  config.value = value;
  if (
    pax.value !== null &&
    (pax.value < value.minPax || pax.value > value.maxPax)
  )
    pax.value = null;
}

function retrySlots() {
  formError.value = "";
  slotsRevision.value++;
}

watch(language, (value) => {
  accepted.value = false;
  localStorage.setItem("angkor_emenu_language", value);
});
watch(
  [() => route.params.slug, branchQuery, revision],
  async ([pathSlug, branch], _, cleanup) => {
    const controller = new AbortController();
    cleanup(() => controller.abort());
    const { signal } = controller;
    loading.value = true;
    pageError.value = formError.value = "";
    config.value = receipt.value = null;
    businessName.value = "";
    branches.value = [];
    slots.value = [];
    arrivalDate.value = arrivalTime.value = "";
    accepted.value = false;
    submitted = null;
    try {
      const business = route.meta.customDomain
        ? (
            await request<{ slug: string }>(
              `${apiBase}/api/public/domains/${encodeURIComponent(location.hostname)}`,
              { signal },
            )
          ).slug
        : String(pathSlug || "");
      const result = await request<
        Config | { businessName: string; branches: BookingBranch[] }
      >(bookingUrl(business, branch), { signal });
      if (signal.aborted) return;
      slug.value = business;
      businessName.value = result.businessName;
      if ("branches" in result) branches.value = result.branches;
      else {
        setConfig(result);
        pax.value = result.minPax;
        arrivalDate.value = result.today;
      }
    } catch (error) {
      if (!signal.aborted)
        pageError.value =
          error instanceof BookingError && error.status === 404
            ? "unavailable"
            : "networkError";
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  },
  { immediate: true },
);

watch(
  [arrivalDate, branchQuery, slotsRevision],
  async ([date, branch], previous, cleanup) => {
    const controller = new AbortController();
    cleanup(() => controller.abort());
    const { signal } = controller;
    slots.value = [];
    if (date !== previous[0] || branch !== previous[1]) arrivalTime.value = "";
    if (!date || !branch || !config.value) {
      slotsLoading.value = false;
      return;
    }
    slotsLoading.value = true;
    try {
      const result = await request<Config>(
        bookingUrl(slug.value, branch, date),
        { signal },
      );
      if (signal.aborted) return;
      setConfig(result);
      slots.value = result.slots;
      if (!slots.value.includes(arrivalTime.value)) arrivalTime.value = "";
    } catch (error) {
      if (!signal.aborted)
        formError.value =
          error instanceof BookingError && error.status === 404
            ? "unavailable"
            : "networkError";
    } finally {
      if (!signal.aborted) slotsLoading.value = false;
    }
  },
);

async function submit() {
  if (
    !accepted.value ||
    !config.value ||
    pax.value === null ||
    !slots.value.includes(arrivalTime.value) ||
    sending.value
  )
    return;
  const branch = branchQuery.value;
  const data = {
    arrivalDate: arrivalDate.value,
    arrivalTime: arrivalTime.value,
    pax: pax.value,
    guestName: guestName.value.trim(),
    guestPhone: guestPhone.value.trim(),
    preference: preference.value,
    preferenceText: preferenceText.value.trim(),
    note: note.value.trim(),
    termsAccepted: true,
    termsLanguage: language.value,
    termsVersion: config.value.terms.version,
  };
  const key = JSON.stringify(data);
  if (!submitted || submitted.key !== key)
    submitted = { key, id: randomUuid() };
  formError.value = "";
  sending.value = true;
  try {
    const saved = await request<BookingReceipt>(
      bookingUrl(slug.value, branch),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, submissionId: submitted.id }),
      },
    );
    if (branchQuery.value === branch) receipt.value = saved;
  } catch (error) {
    if (branchQuery.value !== branch) return;
    const code = error instanceof BookingError ? error.code : "";
    if (code === "BOOKING_TERMS_CHANGED") {
      accepted.value = false;
      formError.value = "termsChanged";
      slotsRevision.value++;
    } else if (
      code === "BOOKING_SLOT_UNAVAILABLE" ||
      code === "BOOKING_RULES_CHANGED"
    ) {
      formError.value =
        code === "BOOKING_SLOT_UNAVAILABLE"
          ? "slotUnavailable"
          : "rulesChanged";
      slotsRevision.value++;
    } else if (code === "BOOKING_INVALID_PARTY") {
      formError.value = "invalidParty";
      slotsRevision.value++;
    } else {
      formError.value =
        code === "BOOKING_UNAVAILABLE"
          ? "unavailable"
          : code === "BOOKING_INVALID_DETAILS"
            ? "invalidDetails"
            : "networkError";
    }
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.booking-field {
  display: block;
  width: 100%;
  min-height: 2.75rem;
  margin-top: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #78716c;
  border-radius: 0.75rem;
  background: #fff;
}
.booking-button {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #1c1917;
  color: #fff;
  font-weight: 700;
}
.booking-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
