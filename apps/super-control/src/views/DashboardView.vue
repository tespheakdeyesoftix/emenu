<template>
  <PageHeader title="Your platform at a glance" />
  <div v-if="loading" class="panel grid min-h-80 place-items-center">
    <LoaderCircle :size="34" class="animate-spin text-black/30" />
  </div>
  <div v-else-if="error" class="panel p-8 text-center">
    <TriangleAlert :size="34" class="mx-auto text-red-500" />
    <p class="mb-4 mt-3 text-sm font-bold text-red-700">{{ error }}</p>
    <button class="btn-primary" @click="load">Try again</button>
  </div>
  <template v-else-if="dashboard">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="card in cards"
        :key="card.label"
        class="panel overflow-hidden p-5"
      >
        <div class="flex items-center justify-between">
          <span
            class="grid size-11 place-items-center rounded-2xl"
            :class="card.color"
            ><component :is="card.icon" :size="20"
          /></span>
          <span
            class="text-xs font-bold uppercase tracking-[.12em] text-black/30"
            >Live</span
          >
        </div>
        <p class="display mb-0 mt-7 text-4xl font-extrabold">
          {{ card.value }}
        </p>
        <p class="mb-0 mt-1 text-sm font-bold text-black/45">
          {{ card.label }}
        </p>
      </article>
    </div>
    <div class="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <section class="panel overflow-hidden">
        <header
          class="flex items-center justify-between border-b border-black/[.06] p-5 lg:p-6"
        >
          <div>
            <h2 class="display m-0 text-xl font-extrabold">
              Recent businesses
            </h2>
            <p class="mb-0 mt-1 text-xs text-black/40">Newest registrations</p>
          </div>
          <RouterLink to="/businesses" class="btn-soft"
            >View all<ArrowRight :size="16"
          /></RouterLink>
        </header>
        <div class="divide-y divide-black/[.05]">
          <RouterLink
            v-for="business in dashboard.recentBusinesses"
            :key="business.id"
            :to="`/businesses/${business.id}`"
            class="flex items-center gap-4 p-5 transition hover:bg-cream"
          >
            <span
              class="grid size-11 shrink-0 place-items-center rounded-2xl bg-canvas font-extrabold"
              >{{ business.name.slice(0, 2).toUpperCase() }}</span
            >
            <span class="min-w-0 flex-1"
              ><strong class="block truncate text-sm">{{
                business.name
              }}</strong
              ><small class="block truncate text-black/40">{{
                business.ownerEmail
              }}</small></span
            >
            <span
              class="rounded-full px-3 py-1 text-xs font-bold"
              :class="business.isActive ? 'status-active' : 'status-disabled'"
              >{{ business.isActive ? "Active" : "Disabled" }}</span
            >
          </RouterLink>
          <p
            v-if="!dashboard.recentBusinesses.length"
            class="m-0 p-8 text-center text-sm text-black/40"
          >
            No businesses registered yet.
          </p>
        </div>
      </section>
      <section class="panel overflow-hidden">
        <header class="border-b border-black/[.06] p-5 lg:p-6">
          <h2 class="display m-0 text-xl font-extrabold">Recent activity</h2>
          <p class="mb-0 mt-1 text-xs text-black/40">
            Sensitive actions are audited
          </p>
        </header>
        <div class="divide-y divide-black/[.05]">
          <div
            v-for="activity in dashboard.recentActivity"
            :key="activity.id"
            class="flex gap-3 p-4 lg:px-6"
          >
            <span class="mt-1 size-2 shrink-0 rounded-full bg-coral"></span>
            <div class="min-w-0">
              <p class="m-0 text-sm font-bold">
                {{ actionLabel(activity.action) }}
              </p>
              <p class="mb-0 mt-1 truncate text-xs text-black/40">
                {{ detailLabel(activity) }} ·
                {{ formatDate(activity.createdAt) }}
              </p>
            </div>
          </div>
          <p
            v-if="!dashboard.recentActivity.length"
            class="m-0 p-8 text-center text-sm text-black/40"
          >
            No super-admin activity yet.
          </p>
        </div>
      </section>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArrowRight,
  Ban,
  Building2,
  CalendarClock,
  CircleCheckBig,
  Infinity as InfinityIcon,
  LoaderCircle,
  TriangleAlert,
  Users,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import { api, formatDate, type Activity, type Dashboard } from "../api";
const dashboard = ref<Dashboard | null>(null);
const loading = ref(true);
const error = ref("");
const cards = computed(() =>
  dashboard.value
    ? [
        {
          label: "Registered users",
          value: dashboard.value.totals.users,
          icon: Users,
          color: "bg-blue-100 text-blue-700",
        },
        {
          label: "Total businesses",
          value: dashboard.value.totals.businesses,
          icon: Building2,
          color: "bg-violet-100 text-violet-700",
        },
        {
          label: "Active businesses",
          value: dashboard.value.totals.active,
          icon: CircleCheckBig,
          color: "bg-emerald-100 text-emerald-700",
        },
        {
          label: "Disabled businesses",
          value: dashboard.value.totals.disabled,
          icon: Ban,
          color: "bg-red-100 text-red-700",
        },
        {
          label: "Expired subscriptions",
          value: dashboard.value.totals.expired,
          icon: CalendarClock,
          color: "bg-amber-100 text-amber-800",
        },
        {
          label: "Unlimited subscriptions",
          value: dashboard.value.totals.unlimited,
          icon: InfinityIcon,
          color: "bg-blue-100 text-blue-700",
        },
      ]
    : [],
);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    dashboard.value = await api<Dashboard>("/api/super/dashboard");
  } catch (value) {
    error.value =
      value instanceof Error ? value.message : "Could not load dashboard";
  } finally {
    loading.value = false;
  }
}
const actionLabels: Record<string, string> = {
  "business.created": "Business registered",
  "business.member_created": "Business sub-account created",
  "business.enabled": "Business enabled",
  "business.disabled": "Business disabled",
  "business.custom_menu_url_updated": "Public menu URL updated",
  "user.password_reset": "Password reset",
  "user.credentials_changed": "Account credentials changed",
  "support_session.created": "Owner support session opened",
  "subscription.expiry_updated": "Subscription expiry updated",
  "subscription.plan_created": "Subscription plan created",
  "subscription.plan_updated": "Subscription plan updated",
  "subscription.plan_removed": "Subscription plan removed",
  "subscription.plan_assigned": "Business subscription plan changed",
};
const actionLabel = (action: string) =>
  actionLabels[action] || action.replaceAll("_", " ");
const detailLabel = (activity: Activity) =>
  String(
    activity.details.businessName ||
      activity.details.email ||
      activity.details.ownerEmail ||
      activity.details.name ||
      activity.details.planId ||
      activity.actorEmail,
  );
onMounted(load);
</script>
