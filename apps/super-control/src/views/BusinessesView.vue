<template>
  <PageHeader title="Registered businesses">
    <RouterLink to="/businesses/new" class="btn-primary"
      ><Plus :size="17" />Register business</RouterLink
    >
  </PageHeader>
  <section class="panel overflow-hidden">
    <form
      class="flex flex-col gap-3 border-b border-black/[.06] p-4 sm:flex-row"
      @submit.prevent="search"
    >
      <label class="relative flex-1"
        ><Search
          :size="17"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" /><input
          v-model="query"
          class="input pl-11"
          placeholder="Search name, slug, or owner email"
      /></label>
      <select v-model="status" class="input sm:w-44" @change="search">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
      </select>
      <select
        v-model="subscriptionStatus"
        class="input sm:w-48"
        @change="search"
      >
        <option value="all">All subscriptions</option>
        <option value="current">Current</option>
        <option value="expiring">Expiring in 7 days</option>
        <option value="expired">Expired</option>
        <option value="unlimited">Unlimited</option>
      </select>
      <button class="btn-soft"><Search :size="16" />Search</button>
    </form>
    <div v-if="loading" class="grid min-h-72 place-items-center">
      <LoaderCircle :size="32" class="animate-spin text-black/30" />
    </div>
    <div
      v-else-if="error"
      class="p-8 text-center text-sm font-bold text-red-700"
    >
      {{ error }}<br /><button class="btn-soft mt-4" @click="load">
        Try again
      </button>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr
            class="bg-canvas/70 text-xs uppercase tracking-[.1em] text-black/35"
          >
            <th class="px-6 py-4">Business</th>
            <th class="px-5 py-4">Owner</th>
            <th class="px-5 py-4">Registered</th>
            <th class="px-5 py-4">Content</th>
            <th class="px-5 py-4">Subscription</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/[.05]">
          <tr
            v-for="business in result?.items"
            :key="business.id"
            class="hover:bg-cream/60"
          >
            <td class="px-6 py-4">
              <strong class="block">{{ business.name }}</strong
              ><span class="text-xs text-black/40">/{{ business.slug }}</span>
            </td>
            <td class="px-5 py-4 text-black/60">
              {{ business.ownerEmail || "No owner" }}
            </td>
            <td class="px-5 py-4 text-black/60">
              {{ formatDate(business.createdAt) }}
            </td>
            <td class="px-5 py-4 text-black/60">
              {{ business.productCount || 0 }} products ·
              {{ business.memberCount || 0 }} users
            </td>
            <td class="px-5 py-4">
              <span
                class="rounded-full px-3 py-1 text-xs font-bold capitalize"
                :class="subscriptionClass(business.subscription.status)"
                >{{ business.subscription.status }}</span
              >
              <small class="mt-1 block text-black/40">
                {{
                  business.subscription.expiresOn
                    ? `Ends ${business.subscription.expiresOn}`
                    : "No expiry"
                }}
              </small>
            </td>
            <td class="px-5 py-4">
              <span
                class="rounded-full px-3 py-1 text-xs font-bold"
                :class="business.isActive ? 'status-active' : 'status-disabled'"
                >{{ business.isActive ? "Active" : "Disabled" }}</span
              >
            </td>
            <td class="px-6 py-4 text-right">
              <RouterLink
                :to="`/businesses/${business.id}`"
                class="btn-soft px-4 py-2"
                >Manage<ChevronRight :size="15"
              /></RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="!result?.items.length"
        class="grid min-h-64 place-items-center text-center"
      >
        <div>
          <Building2 :size="34" class="mx-auto text-black/25" />
          <p class="mb-0 mt-3 text-sm font-bold text-black/40">
            No matching businesses
          </p>
        </div>
      </div>
    </div>
    <footer
      v-if="result && result.total > 0"
      class="flex items-center justify-between border-t border-black/[.06] px-5 py-4 text-sm text-black/45"
    >
      <span>{{ result.total }} total</span>
      <div class="flex items-center gap-2">
        <button
          class="btn-soft px-4 py-2"
          :disabled="result.page <= 1"
          @click="changePage(result.page - 1)"
        >
          Previous</button
        ><span class="px-2">{{ result.page }} / {{ result.totalPages }}</span
        ><button
          class="btn-soft px-4 py-2"
          :disabled="result.page >= result.totalPages"
          @click="changePage(result.page + 1)"
        >
          Next
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Building2,
  ChevronRight,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import { api, formatDate, type BusinessListItem } from "../api";
type Result = {
  items: BusinessListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
const query = ref("");
const status = ref("all");
const subscriptionStatus = ref("all");
const page = ref(1);
const loading = ref(true);
const error = ref("");
const result = ref<Result | null>(null);
async function load() {
  loading.value = true;
  error.value = "";
  const params = new URLSearchParams({
    q: query.value,
    status: status.value,
    subscriptionStatus: subscriptionStatus.value,
    page: String(page.value),
    pageSize: "25",
  });
  try {
    result.value = await api<Result>(`/api/super/businesses?${params}`);
  } catch (value) {
    error.value =
      value instanceof Error ? value.message : "Could not load businesses";
  } finally {
    loading.value = false;
  }
}
function search() {
  page.value = 1;
  load();
}
function changePage(next: number) {
  page.value = next;
  load();
}
function subscriptionClass(value: string) {
  if (value === "expired") return "bg-red-100 text-red-700";
  if (value === "trialing") return "bg-amber-100 text-amber-800";
  if (value === "unlimited") return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
}
onMounted(load);
</script>
