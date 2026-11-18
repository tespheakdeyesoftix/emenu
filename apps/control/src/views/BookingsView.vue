<template>
  <Tabs v-model="mode" class="min-w-0">
    <PageHeader :title="copy.title">
      <TabList v-if="!bookingId" variant="subtle" size="md" :aria-label="copy.title">
        <TabTrigger value="list" :label="copy.list" />
        <TabTrigger value="calendar" :label="copy.calendar" />
      </TabList>
    </PageHeader>

    <section
      v-if="bookingId"
      class="grid min-w-0 gap-4 rounded-6 border border-outline-gray-1 bg-surface-base p-4 sm:p-6"
      :aria-label="copy.details"
    >
      <Button
        :route="bookingLink()"
        variant="ghost"
        icon-left="lucide-arrow-left"
        class="justify-self-start"
        :label="copy.back"
      />
      <LoadingText v-if="detailLoading" :text="copy.loading" role="status" />
      <Alert v-if="detailError" theme="red" :title="detailError" />
      <template v-if="detail">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="m-0 text-xl font-extrabold">{{ detail.reference }}</h2>
            <p class="mb-0 mt-1 text-sm">
              {{ detail.branchName }} · {{ detail.arrivalDate }}
              {{ detail.arrivalTime }} · {{ detail.timezone }}
            </p>
          </div>
          <Badge :theme="statusThemes[detail.status]" :label="copy.statuses[detail.status]" />
        </div>
        <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&_dt]:text-sm [&_dt]:text-ink-gray-6">
          <div>
            <dt>{{ copy.guest }}</dt>
            <dd class="m-0 font-bold">{{ detail.guestName }}</dd>
          </div>
          <div>
            <dt>{{ copy.phone }}</dt>
            <dd class="m-0">
              <Button
                :href="`tel:${detail.guestPhone}`"
                target="_self"
                variant="ghost"
                icon-left="lucide-phone"
                :label="detail.guestPhone"
                class="-ms-2"
              />
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
        <form
          v-if="detail.status === 'confirmed' && detailCanManage && !store.isReadOnly"
          class="flex flex-wrap items-end gap-3"
          @submit.prevent="saveTable"
        >
          <label class="min-w-48">
            <span class="label">{{ copy.bookingTable }}</span>
            <Select
              v-model="selectedTable"
              size="lg"
              variant="outline"
              :disabled="savingTable"
              :options="[
                { value: '', label: copy.unassignedTable },
                ...tableOptions.map(table => ({ value: table.id, label: table.groupName + ' · ' + table.label })),
              ]"
            />
          </label>
          <Button
            type="submit"
            size="lg"
            :label="copy.saveTable"
            :loading="savingTable"
            :disabled="saving !== null || selectedTable === (detail.tableId ?? '')"
          />
        </form>
        <p v-else-if="detail.tableLabel" class="m-0 text-sm">{{ copy.bookingTable }} · {{ detail.tableLabel }}</p>
        <DisclosureSection :title="copy.terms" class="rounded-5 bg-surface-gray-1 px-2">
          <p class="mb-0 whitespace-pre-wrap break-words">
            {{ detail.termsText }}
          </p>
          <p class="mb-0 break-all text-xs text-black/65">
            {{ detail.termsVersion }}
          </p>
        </DisclosureSection>
        <div
          v-if="detailCanManage && !store.isReadOnly"
          class="flex flex-wrap gap-2"
        >
          <Button size="lg"
            v-for="status in bookingStatusActions(detail.status)"
            :key="status"
            type="button"
            :variant="status === 'confirmed' ? 'solid' : 'subtle'"
            :disabled="saving !== null"
            :loading="saving === status"
            @click="updateStatus(status)"
          >
            {{ copy.actions[status] }}
          </Button>
        </div>
        <Alert v-else :title="copy.readOnly" />
      </template>
    </section>

    <section
      v-else
      class="grid min-w-0 gap-4 rounded-6 border border-outline-gray-1 bg-surface-base p-4 sm:p-6"
      :aria-label="copy[mode]"
    >
      <div class="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap">
        <Select
          v-model="branchId"
          :label="copy.branch"
          :options="branchOptions"
          size="lg"
          variant="outline"
          class="sm:min-w-40"
        />
        <template v-if="mode === 'list'">
          <DateFilter
            v-for="field in dateFields"
            :key="field"
            v-model="dateFilters[field]"
            :label="copy[field]"
            class="sm:w-44"
          />
        </template>
      </div>
      <Alert v-if="!canManage && !loading && !error" :title="copy.readOnly" />
      <LoadingText v-if="loading" :text="copy.loading" role="status" />
      <Alert v-if="error" theme="red" :title="error" />
      <TabPanel value="list" class="min-w-0" :aria-busy="loading">
        <ListView
          v-if="!loading && !error"
          :columns="bookingColumns"
          :rows="records"
          row-key="id"
          :options="bookingListOptions"
          :class="[
            records.length ? '!min-w-[735px]' : 'min-h-32',
            '!w-full p-2 [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:-outline-offset-2 [&_a:focus-visible]:outline-outline-gray-4',
          ]"
        >
          <template #cell="{ column, row, item }">
            <span v-if="column.key === 'reference'" class="block truncate text-base-semibold underline underline-offset-2" :title="row.reference">
              {{ row.reference }}
            </span>
            <span v-else-if="column.key === 'arrival'" class="whitespace-nowrap text-base tabular-nums">
              {{ row.arrivalDate }} {{ row.arrivalTime }}
            </span>
            <Badge v-else-if="column.key === 'status'" :theme="statusThemes[row.status as BookingStatus]" :label="copy.statuses[row.status as BookingStatus]" />
            <ListRowItem v-else :column="column" :row="row" :item="item" :align="column.align" />
          </template>
        </ListView>
        <ListFooter v-if="!loading && !error && (page > 1 || hasMore)" class="mt-4">
          <nav :aria-label="copy.pages" class="flex flex-wrap items-center gap-2">
            <Button variant="subtle" size="lg" :label="copy.previous" :disabled="page === 1" @click="page--" />
            <Badge :label="String(page)" aria-current="page" />
            <Button variant="subtle" size="lg" :label="copy.next" :disabled="!hasMore" @click="page++" />
          </nav>
        </ListFooter>
      </TabPanel>
      <TabPanel value="calendar" class="min-w-0">
        <Calendar
          ref="calendar"
          class="booking-calendar min-h-[30rem]"
          :aria-label="copy.calendar"
          :aria-busy="loading"
          :events="loading || error ? [] : calendarEvents"
          :config="calendarConfig"
          :on-click="openCalendarBooking"
          @range-change="calendarRange = $event"
        >
          <template #header="{ currentYear, currentMonth, activeView, updateActiveView, decrement, increment, setCalendarDate }">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg-semibold text-ink-gray-9" aria-live="polite">
                {{ calendarHeading(currentYear, currentMonth) }}
              </h2>
              <div class="flex items-center gap-1">
                <Button
                  v-if="activeView === 'Day'"
                  variant="outline"
                  :label="copy.calendar"
                  @click="updateActiveView('Month')"
                />
                <Button
                  variant="ghost"
                  icon="lucide-chevron-left"
                  :aria-label="activeView === 'Day' ? copy.previousDay : copy.previousMonth"
                  @click="decrement"
                />
                <Button
                  variant="subtle"
                  :label="copy.today"
                  @click="setCalendarDate(bookingToday())"
                />
                <Button
                  variant="ghost"
                  icon="lucide-chevron-right"
                  :aria-label="activeView === 'Day' ? copy.nextDay : copy.nextMonth"
                  @click="increment"
                />
              </div>
            </div>
            <div
              v-if="activeView === 'Month'"
              class="booking-weekdays grid grid-cols-7 text-center text-xs text-ink-gray-6"
            >
              <span v-for="day in weekdayLabels" :key="day" class="py-2">{{ day }}</span>
            </div>
          </template>
        </Calendar>
      </TabPanel>
    </section>
  </Tabs>
</template>

<script setup lang="ts">
import {
  Alert,
  Badge,
  Button,
  LoadingText,
  Select,
  TabList,
  TabPanel,
  TabTrigger,
  Tabs,
} from "frappe-ui";
import {
  Calendar,
  ListFooter,
  ListRowItem,
  ListView,
  type CalendarConfig,
  type CalendarEvent,
  type CalendarMode,
} from "frappe-ui/experimental";
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import {
  bookingDateAt,
  bookingStatusActions,
  type BookingBranch,
  type BookingDetail,
  type BookingStatus,
  type BookingSummary,
} from "../../../../shared/booking";
import DateFilter from "../components/DateFilter.vue";
import DisclosureSection from "../components/DisclosureSection.vue";
import PageHeader from "../components/PageHeader.vue";
import { useAdminStore } from "../stores/admin";

const store = useAdminStore();
const route = useRoute();
const router = useRouter();
const { locale } = useI18n();
const copy = computed(() => messages[locale.value === "km" ? "km" : "en"]);
const dateFields = ["from", "to"] as const;
const bookingColumns = computed(() => [
  { key: "reference", label: copy.value.reference, width: "minmax(105px, 1fr)" },
  { key: "guestName", label: copy.value.guest, width: "minmax(115px, 1.25fr)" },
  { key: "branchName", label: copy.value.branch, width: "minmax(105px, 1fr)" },
  { key: "arrival", label: copy.value.arrival, width: "133px" },
  { key: "pax", label: copy.value.pax, width: "62px" },
  { key: "status", label: copy.value.status, width: "100px" },
]);
const bookingListOptions = computed(() => ({
  selectable: false,
  rowHeight: 48,
  getRowRoute: (booking: BookingSummary) => bookingLink(booking.id),
  emptyState: { title: copy.value.empty },
}));
const mode = ref<"list" | "calendar">("list");
const branchId = ref("");
const branches = ref<BookingBranch[]>([]);
const branchOptions = computed(() => [
  { label: copy.value.allBranches, value: "" },
  ...branches.value.map(({ id, name }) => ({ label: name, value: id })),
]);
const dateFilters = reactive({ from: "", to: "" });
const page = ref(1);
const hasMore = ref(false);
const records = ref<BookingSummary[]>([]);
const loading = ref(false);
const canManage = ref(false);
const error = ref("");
const timezone = ref("UTC");
type CalendarRange = { view: CalendarMode; startDate: string; endDate: string };
const calendarRange = ref<CalendarRange | null>(null);
const calendar = ref<InstanceType<typeof Calendar>>();
const calendarConfig: Partial<CalendarConfig> = {
  defaultMode: "Month",
  isEditMode: false,
  enableShortcuts: false,
  timeFormat: "24h",
  showIcon: false,
};
const statusThemes = {
  requested: "amber",
  confirmed: "green",
  declined: "red",
  cancelled: "gray",
} as const satisfies Record<BookingStatus, string>;
const calendarColors: Record<BookingStatus, string> = {
  requested: "amber",
  confirmed: "green",
  declined: "pink",
  cancelled: "violet",
};
const calendarEvents = computed<CalendarEvent[]>(() =>
  records.value.map((record) => ({
    id: record.id,
    title: `${record.guestName} · ${copy.value.statuses[record.status]}`,
    fromDate: record.arrivalDate,
    toDate: record.arrivalDate,
    fromTime: record.arrivalTime,
    toTime: record.arrivalTime,
    color: calendarColors[record.status],
  })),
);
const weekdayLabels = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale.value, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 10, 1 + index))),
  ),
);
let calendarAnchor: Date | undefined;
const bookingId = computed(() => String(route.params.bookingId || ""));
const detail = ref<BookingDetail | null>(null);
const detailCanManage = ref(false);
const detailLoading = ref(false);
const tableOptions = ref<{ id: string; label: string; groupName: string }[]>([]);
const selectedTable = ref("");
const savingTable = ref(false);
const detailError = ref("");
const saving = ref<BookingStatus | null>(null);
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
function bookingToday() {
  return new Date(`${bookingDateAt(Date.now(), timezone.value)}T12:00:00`);
}

function calendarHeading(year: number, month: number) {
  const day = calendarRange.value?.view === "Day" ? calendarRange.value.startDate : "";
  const date = day ? new Date(`${day}T12:00:00`) : new Date(year, month, 1);
  return new Intl.DateTimeFormat(locale.value, {
    month: "long",
    year: "numeric",
    day: day ? "numeric" : undefined,
  }).format(date);
}

function openCalendarBooking({ calendarEvent }: { calendarEvent: CalendarEvent }) {
  if (typeof calendarEvent.id === "string") void router.push(bookingLink(calendarEvent.id));
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
  const calendarMode = mode.value === "calendar";
  const range = calendarRange.value;
  if (calendarMode && !range) return;
  loading.value = true;
  error.value = "";
  const first = calendarMode ? range!.startDate : dateFilters.from;
  const last = calendarMode ? range!.endDate : dateFilters.to;
  let requestedPage = calendarMode ? 1 : page.value;
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
    } while (calendarMode && result.hasMore);
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
    )) as { booking: BookingDetail; canManage: boolean; tableOptions: typeof tableOptions.value };
    if (generation === detailGeneration) {
      detail.value = result.booking;
      detailCanManage.value = result.canManage;
      selectedTable.value = result.booking.tableId ?? "";
      tableOptions.value = result.tableOptions;
    }
  } catch (value) {
    if (generation === detailGeneration)
      detailError.value =
        value instanceof Error ? value.message : copy.value.loadFailed;
  } finally {
    if (generation === detailGeneration) detailLoading.value = false;
  }
}

async function saveTable() {
  if (!detail.value || !detailCanManage.value || store.isReadOnly || savingTable.value) return;
  const { id, tableId } = detail.value;
  savingTable.value = true;
  detailError.value = "";
  try {
    await store.request(`/api/admin/bookings/${encodeURIComponent(id)}/table`, {
      method: "PATCH",
      body: JSON.stringify({ tableId: selectedTable.value || null, expectedTableId: tableId }),
    });
    if (bookingId.value === id) await loadDetail(id);
  } catch (value) {
    if (bookingId.value === id)
      detailError.value = value instanceof Error ? value.message : copy.value.loadFailed;
  } finally {
    savingTable.value = false;
  }
}

async function updateStatus(status: BookingStatus) {
  if (
    !detail.value ||
    !detailCanManage.value ||
    store.isReadOnly ||
    saving.value !== null || savingTable.value
  )
    return;
  const { id, status: expectedStatus } = detail.value;
  saving.value = status;
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
    saving.value = null;
  }
}

watch(
  [branchId, dateFilters, mode],
  () => {
    page.value = 1;
  },
  { flush: "sync" },
);
watch(calendar, (current, previous) => {
  if (previous) calendarAnchor = new Date(previous.currentYear, previous.currentMonth, 1, 12);
  if (current) current.setCalendarDate(calendarAnchor ?? bookingToday());
  else calendarRange.value = null;
}, { flush: "post" });
watch([mode, branchId, dateFilters, page, calendarRange, bookingId], loadList, {
  immediate: true,
});
watch(bookingId, loadDetail, { immediate: true });

const messages = {
  en: {
    title: "Bookings",
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
    bookingTable: "Reserved table",
    unassignedTable: "Unassigned",
    saveTable: "Save table",
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
    pages: "Booking pages",
    allBranches: "All branches",
    empty: "No bookings match these filters.",
    previous: "Previous",
    next: "Next",
    previousMonth: "Previous month",
    previousDay: "Previous day",
    nextDay: "Next day",
    today: "Today",
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
    bookingTable: "តុដែលបានកក់",
    unassignedTable: "មិនទាន់ជ្រើសតុ",
    saveTable: "រក្សាទុកតុ",
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
    pages: "ទំព័រការកក់",
    allBranches: "សាខាទាំងអស់",
    empty: "មិនមានការកក់ត្រូវនឹងតម្រងនេះទេ។",
    previous: "មុន",
    next: "បន្ទាប់",
    previousMonth: "ខែមុន",
    previousDay: "ថ្ងៃមុន",
    nextDay: "ថ្ងៃបន្ទាប់",
    today: "ថ្ងៃនេះ",
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
.booking-calendar:has(.booking-weekdays) :deep(.grid.grid-cols-7:not(.booking-weekdays):has(+ div [data-week-row])) {
  display: none;
}
</style>
