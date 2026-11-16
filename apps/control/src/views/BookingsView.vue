<template>
  <div class="grid gap-4">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="m-0 text-2xl font-extrabold">{{ copy.title }}</h1>
        <p class="mb-0 mt-1 text-sm text-black/65">{{ copy.description }}</p>
      </div>
      <div class="flex gap-2" v-if="!bookingId">
        <button
          v-for="tab in tabs"
          :key="tab"
          type="button"
          :aria-pressed="mode === tab"
          :class="mode === tab ? 'btn-primary' : 'btn-soft'"
          @click="mode = tab"
        >
          {{ copy[tab] }}
        </button>
      </div>
    </header>

    <section
      v-if="bookingId"
      class="panel grid gap-4 p-4 sm:p-6"
      :aria-label="copy.details"
    >
      <RouterLink
        :to="bookingLink()"
        class="justify-self-start font-bold underline"
        >{{ copy.back }}</RouterLink
      >
      <p v-if="detailLoading" class="m-0" role="status">{{ copy.loading }}</p>
      <p v-if="detailError" class="m-0 text-red-700" role="alert">
        {{ detailError }}
      </p>
      <template v-if="detail">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="m-0 text-xl font-extrabold">{{ detail.reference }}</h2>
            <p class="mb-0 mt-1 text-sm">
              {{ detail.branchName }} · {{ detail.arrivalDate }}
              {{ detail.arrivalTime }} · {{ detail.timezone }}
            </p>
          </div>
          <span class="rounded-full bg-cream px-3 py-1 text-sm font-bold">{{
            copy.statuses[detail.status]
          }}</span>
        </div>
        <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt>{{ copy.guest }}</dt>
            <dd class="m-0 font-bold">{{ detail.guestName }}</dd>
          </div>
          <div>
            <dt>{{ copy.phone }}</dt>
            <dd class="m-0 font-bold">
              <a :href="`tel:${detail.guestPhone}`" class="underline">{{
                detail.guestPhone
              }}</a>
            </dd>
          </div>
          <div>
            <dt>{{ copy.pax }}</dt>
            <dd class="m-0 font-bold">{{ detail.pax }}</dd>
          </div>
          <div>
            <dt>{{ copy.preference }}</dt>
            <dd class="m-0">{{ presetLabel(detail.preference) }}</dd>
          </div>
          <div>
            <dt>{{ copy.preferenceText }}</dt>
            <dd class="m-0 whitespace-pre-wrap break-words">
              {{ detail.preferenceText || "—" }}
            </dd>
          </div>
          <div>
            <dt>{{ copy.note }}</dt>
            <dd class="m-0 whitespace-pre-wrap break-words">
              {{ detail.note || "—" }}
            </dd>
          </div>
          <div>
            <dt>{{ copy.created }}</dt>
            <dd class="m-0">
              {{ formatTimestamp(detail.createdAt, detail.timezone) }}
            </dd>
          </div>
          <div>
            <dt>{{ copy.accepted }}</dt>
            <dd class="m-0">
              {{ formatTimestamp(detail.termsAcceptedAt, detail.timezone) }} ·
              {{ detail.termsLanguage === "km" ? "ខ្មែរ" : "English" }}
            </dd>
          </div>
        </dl>
        <details class="rounded-xl bg-cream p-3">
          <summary class="cursor-pointer font-bold">{{ copy.terms }}</summary>
          <p class="mb-0 whitespace-pre-wrap break-words">
            {{ detail.termsText }}
          </p>
          <p class="mb-0 break-all text-xs text-black/65">
            {{ detail.termsVersion }}
          </p>
        </details>
        <div
          v-if="detailCanManage && !store.isReadOnly"
          class="flex flex-wrap gap-2"
        >
          <button
            v-for="status in bookingStatusActions(detail.status)"
            :key="status"
            type="button"
            :class="status === 'confirmed' ? 'btn-primary' : 'btn-soft'"
            :disabled="saving"
            @click="updateStatus(status)"
          >
            {{ copy.actions[status] }}
          </button>
        </div>
        <p v-else class="m-0 text-sm text-black/65">{{ copy.readOnly }}</p>
      </template>
    </section>

    <section
      v-else
      class="panel grid gap-4 p-4 sm:p-6"
      :aria-label="copy[mode]"
    >
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-sm font-bold"
          >{{ copy.branch }}
          <select v-model="branchId" class="input mt-1 min-w-36">
            <option value="">{{ copy.allBranches }}</option>
            <option
              v-for="branch in branches"
              :key="branch.id"
              :value="branch.id"
            >
              {{ branch.name }}
            </option>
          </select>
        </label>
        <template v-if="mode === 'list'">
          <label class="text-sm font-bold"
            >{{ copy.from
            }}<input v-model="from" type="date" class="input mt-1"
          /></label>
          <label class="text-sm font-bold"
            >{{ copy.to }}<input v-model="to" type="date" class="input mt-1"
          /></label>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn-soft"
            :aria-label="copy.previousMonth"
            @click="moveMonth(-1)"
          >
            ‹
          </button>
          <strong class="self-center" aria-live="polite">{{
            monthLabel
          }}</strong>
          <button
            type="button"
            class="btn-soft"
            :aria-label="copy.nextMonth"
            @click="moveMonth(1)"
          >
            ›
          </button>
        </template>
      </div>
      <p
        v-if="!canManage && !loading && !error"
        class="m-0 text-sm text-black/65"
      >
        {{ copy.readOnly }}
      </p>
      <p v-if="loading" class="m-0" role="status">{{ copy.loading }}</p>
      <p v-else-if="error" class="m-0 text-red-700" role="alert">{{ error }}</p>
      <template v-else-if="mode === 'list'">
        <p v-if="!records.length" class="m-0" role="status">{{ copy.empty }}</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-black/10">
                <th
                  v-for="heading in headings"
                  :key="heading"
                  class="whitespace-nowrap px-2 py-3"
                  scope="col"
                >
                  {{ copy[heading] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="booking in records"
                :key="booking.id"
                class="border-b border-black/10"
              >
                <td class="px-2 py-3">
                  <RouterLink
                    :to="bookingLink(booking.id)"
                    class="font-bold underline"
                    >{{ booking.reference }}</RouterLink
                  >
                </td>
                <td class="px-2 py-3">{{ booking.guestName }}</td>
                <td class="px-2 py-3">{{ booking.branchName }}</td>
                <td class="whitespace-nowrap px-2 py-3">
                  {{ booking.arrivalDate }} {{ booking.arrivalTime }}
                </td>
                <td class="px-2 py-3">{{ booking.pax }}</td>
                <td class="px-2 py-3">{{ copy.statuses[booking.status] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="page > 1 || hasMore"
          class="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            class="btn-soft"
            :disabled="page === 1"
            @click="page--"
          >
            {{ copy.previous }}
          </button>
          <span>{{ page }}</span>
          <button
            type="button"
            class="btn-soft"
            :disabled="!hasMore"
            @click="page++"
          >
            {{ copy.next }}
          </button>
        </div>
      </template>
      <div v-else class="overflow-x-auto">
        <table
          class="booking-calendar w-full table-fixed border-collapse text-sm"
        >
          <thead>
            <tr>
              <th
                v-for="day in weekdayLabels"
                :key="day"
                class="p-2"
                scope="col"
              >
                {{ day }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="week in calendarWeeks" :key="week[0]">
              <td
                v-for="date in week"
                :key="date"
                class="h-24 border border-black/10 p-1 align-top"
                :class="date.slice(0, 7) === month ? '' : 'bg-black/[.04]'"
              >
                <time :datetime="date" class="block px-1 font-bold">{{
                  Number(date.slice(-2))
                }}</time>
                <div
                  v-for="booking in recordsByDate.get(date) || []"
                  :key="booking.id"
                  class="mb-1 rounded bg-cream px-1 py-1"
                >
                  <RouterLink
                    :to="bookingLink(booking.id)"
                    class="block truncate font-bold underline"
                    :title="`${booking.arrivalTime} · ${booking.guestName}`"
                  >
                    {{ booking.arrivalTime }} {{ booking.guestName }}
                  </RouterLink>
                  <span class="block truncate text-xs text-black/65">{{
                    copy.statuses[booking.status]
                  }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import {
  addBookingDays,
  bookingDateAt,
  bookingStatusActions,
  type BookingBranch,
  type BookingDetail,
  type BookingStatus,
  type BookingSummary,
} from "../../../../shared/booking";
import { useAdminStore } from "../stores/admin";

const store = useAdminStore();
const route = useRoute();
const { locale } = useI18n();
const copy = computed(() => messages[locale.value === "km" ? "km" : "en"]);
const tabs = ["list", "calendar"] as const;
const headings = [
  "reference",
  "guest",
  "branch",
  "arrival",
  "pax",
  "status",
] as const;
const mode = ref<(typeof tabs)[number]>("list");
const branchId = ref("");
const branches = ref<BookingBranch[]>([]);
const from = ref("");
const to = ref("");
const page = ref(1);
const hasMore = ref(false);
const records = ref<BookingSummary[]>([]);
const loading = ref(false);
const canManage = ref(false);
const error = ref("");
const timezone = ref("UTC");
const monthSelection = ref("");
const month = computed(
  () =>
    monthSelection.value ||
    bookingDateAt(Date.now(), timezone.value).slice(0, 7),
);
const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month.value}-01T00:00:00Z`)),
);
const weekdayLabels = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale.value, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 10, 1 + i))),
  ),
);
const calendarWeeks = computed(() => {
  const first = `${month.value}-01`;
  const start = addBookingDays(
    first,
    -new Date(`${first}T00:00:00Z`).getUTCDay(),
  );
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) =>
      addBookingDays(start, week * 7 + day),
    ),
  );
});
const recordsByDate = computed(() => {
  const days = new Map<string, BookingSummary[]>();
  for (const record of records.value) {
    if (!days.has(record.arrivalDate)) days.set(record.arrivalDate, []);
    days.get(record.arrivalDate)!.push(record);
  }
  return days;
});
const bookingId = computed(() => String(route.params.bookingId || ""));
const detail = ref<BookingDetail | null>(null);
const detailCanManage = ref(false);
const detailLoading = ref(false);
const detailError = ref("");
const saving = ref(false);
let listGeneration = 0;
let detailGeneration = 0;

type Listing = {
  bookings: BookingSummary[];
  branches: BookingBranch[];
  hasMore: boolean;
  canManage: boolean;
  timezone: string;
};
function bookingLink(id?: string) {
  return { name: "bookings", params: { bookingId: id || "" } };
}
function moveMonth(delta: number) {
  const [year, current] = month.value.split("-").map(Number);
  monthSelection.value = new Date(Date.UTC(year, current - 1 + delta, 1))
    .toISOString()
    .slice(0, 7);
}
function formatTimestamp(value: string, timeZone: string) {
  const date = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z",
  );
  return Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(date)
    : value;
}
function presetLabel(value: string) {
  return (
    copy.value.preferences[value as keyof typeof copy.value.preferences] ||
    value ||
    "—"
  );
}

async function loadList() {
  const generation = ++listGeneration;
  if (bookingId.value) return;
  loading.value = true;
  error.value = "";
  const calendar = mode.value === "calendar";
  const first = calendar ? calendarWeeks.value[0][0] : from.value;
  const last = calendar ? calendarWeeks.value[5][6] : to.value;
  let requestedPage = calendar ? 1 : page.value;
  const items: BookingSummary[] = [];
  try {
    let result: Listing;
    do {
      const query = new URLSearchParams({ page: String(requestedPage) });
      if (first) query.set("from", first);
      if (last) query.set("to", last);
      if (branchId.value) query.set("branchId", branchId.value);
      result = (await store.request(`/api/admin/bookings?${query}`)) as Listing;
      if (generation !== listGeneration) return;
      items.push(...result.bookings);
      requestedPage++;
    } while (calendar && result.hasMore);
    records.value = items;
    branches.value = result.branches;
    hasMore.value = result.hasMore;
    canManage.value = result.canManage;
    timezone.value = result.timezone;
  } catch (value) {
    if (generation === listGeneration)
      error.value =
        value instanceof Error ? value.message : copy.value.loadFailed;
  } finally {
    if (generation === listGeneration) loading.value = false;
  }
}

async function loadDetail(id: string) {
  const generation = ++detailGeneration;
  detail.value = null;
  detailError.value = "";
  if (!id) return;
  detailLoading.value = true;
  try {
    const result = (await store.request(
      `/api/admin/bookings/${encodeURIComponent(id)}`,
    )) as { booking: BookingDetail; canManage: boolean };
    if (generation === detailGeneration) {
      detail.value = result.booking;
      detailCanManage.value = result.canManage;
    }
  } catch (value) {
    if (generation === detailGeneration)
      detailError.value =
        value instanceof Error ? value.message : copy.value.loadFailed;
  } finally {
    if (generation === detailGeneration) detailLoading.value = false;
  }
}

async function updateStatus(status: BookingStatus) {
  if (
    !detail.value ||
    !detailCanManage.value ||
    store.isReadOnly ||
    saving.value
  )
    return;
  const { id, status: expectedStatus } = detail.value;
  saving.value = true;
  detailError.value = "";
  try {
    const result = (await store.request(
      `/api/admin/bookings/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, expectedStatus }),
      },
    )) as { status: BookingStatus };
    if (detail.value?.id === id)
      detail.value = { ...detail.value, status: result.status };
  } catch (value) {
    if (bookingId.value === id) {
      await loadDetail(id);
      if (bookingId.value === id)
        detailError.value =
          value instanceof Error ? value.message : copy.value.loadFailed;
    }
  } finally {
    saving.value = false;
  }
}

watch(
  [branchId, from, to, mode],
  () => {
    page.value = 1;
  },
  { flush: "sync" },
);
watch([mode, branchId, from, to, page, month, bookingId], loadList, {
  immediate: true,
});
watch(bookingId, loadDetail, { immediate: true });

const messages = {
  en: {
    title: "Bookings",
    description: "Review booking requests and upcoming arrivals.",
    details: "Booking details",
    list: "List",
    calendar: "Calendar",
    back: "Back to bookings",
    loading: "Loading bookings…",
    loadFailed: "Could not load or update bookings",
    readOnly: "You can view bookings in read-only mode.",
    reference: "Reference",
    guest: "Guest",
    branch: "Branch",
    arrival: "Arrival",
    pax: "Guests",
    status: "Status",
    phone: "Phone number",
    preference: "Preference",
    preferenceText: "Preference details",
    note: "Note",
    created: "Submitted",
    accepted: "Terms accepted",
    terms: "Accepted booking terms",
    from: "Arrival from",
    to: "Arrival through",
    allBranches: "All branches",
    empty: "No bookings match these filters.",
    previous: "Previous",
    next: "Next",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    statuses: {
      requested: "Requested",
      confirmed: "Confirmed",
      declined: "Declined",
      cancelled: "Cancelled",
    },
    actions: {
      requested: "",
      confirmed: "Confirm",
      declined: "Decline",
      cancelled: "Cancel booking",
    },
    preferences: {
      indoor: "Indoor",
      outdoor: "Outdoor",
      "private-room": "Private room",
    },
  },
  km: {
    title: "ការកក់តុ",
    description: "ពិនិត្យសំណើកក់តុ និងការមកដល់នាពេលខាងមុខ។",
    details: "ព័ត៌មានការកក់",
    list: "បញ្ជី",
    calendar: "ប្រតិទិន",
    back: "ត្រឡប់ទៅការកក់",
    loading: "កំពុងផ្ទុកការកក់…",
    loadFailed: "មិនអាចផ្ទុក ឬកែប្រែការកក់បានទេ។",
    readOnly: "អ្នកអាចមើលការកក់តែប៉ុណ្ណោះ។",
    reference: "លេខយោង",
    guest: "ភ្ញៀវ",
    branch: "សាខា",
    arrival: "ពេលមកដល់",
    pax: "ចំនួនភ្ញៀវ",
    status: "ស្ថានភាព",
    phone: "លេខទូរសព្ទ",
    preference: "ចំណូលចិត្ត",
    preferenceText: "ព័ត៌មានបន្ថែមអំពីចំណូលចិត្ត",
    note: "ចំណាំ",
    created: "បានដាក់សំណើ",
    accepted: "បានយល់ព្រមលក្ខខណ្ឌ",
    terms: "លក្ខខណ្ឌការកក់ដែលបានយល់ព្រម",
    from: "មកដល់ចាប់ពី",
    to: "មកដល់រហូតដល់",
    allBranches: "សាខាទាំងអស់",
    empty: "មិនមានការកក់ត្រូវនឹងតម្រងនេះទេ។",
    previous: "មុន",
    next: "បន្ទាប់",
    previousMonth: "ខែមុន",
    nextMonth: "ខែបន្ទាប់",
    statuses: {
      requested: "បានស្នើ",
      confirmed: "បានបញ្ជាក់",
      declined: "បានបដិសេធ",
      cancelled: "បានបោះបង់",
    },
    actions: {
      requested: "",
      confirmed: "បញ្ជាក់",
      declined: "បដិសេធ",
      cancelled: "បោះបង់ការកក់",
    },
    preferences: {
      indoor: "ក្នុងអគារ",
      outdoor: "ក្រៅអគារ",
      "private-room": "បន្ទប់ឯកជន",
    },
  },
};
</script>

<style scoped>
.booking-calendar {
  min-width: 38rem;
}
dt {
  font-size: 0.875rem;
  color: #57534e;
}
</style>
