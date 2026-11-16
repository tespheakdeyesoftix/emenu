<template>
  <div v-if="loading" class="panel grid min-h-[440px] place-items-center">
    <LoaderCircle :size="36" class="animate-spin text-black/30" />
  </div>
  <div v-else-if="error || !detail" class="panel p-9 text-center">
    <TriangleAlert :size="38" class="mx-auto text-red-500" />
    <h1 class="display mb-2 mt-4 text-2xl font-extrabold">
      Could not load business
    </h1>
    <p class="text-sm text-black/50">{{ error }}</p>
    <RouterLink to="/businesses" class="btn-soft mt-4"
      >Back to businesses</RouterLink
    >
  </div>
  <template v-else>
    <PageHeader
      eyebrow="Business detail"
      :title="detail.business.name"
      :description="`/${detail.business.slug} · Registered ${formatDate(detail.business.createdAt)}`"
    >
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-soft" @click="cloneOpen = true">
          <Copy :size="16" />Clone data
        </button>
        <a
          :href="menuUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-soft"
          ><ExternalLink :size="16" />Public menu</a
        >
        <button
          type="button"
          class="btn-primary"
          :disabled="supportLoading"
          @click="openSupportSession"
        >
          <LoaderCircle
            v-if="supportLoading"
            :size="16"
            class="animate-spin"
          /><LogIn v-else :size="16" />Open as owner
        </button>
      </div>
    </PageHeader>
    <p
      v-if="actionError"
      class="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"
      role="alert"
    >
      {{ actionError }}
    </p>
    <div
      class="panel mb-6 flex gap-1 overflow-x-auto p-1.5"
      role="tablist"
      aria-label="Business detail sections"
    >
      <button
        v-for="(tab, index) in tabs"
        :id="`business-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-controls="`business-panel-${tab.id}`"
        :aria-selected="activeTab === tab.id"
        :tabindex="activeTab === tab.id ? 0 : -1"
        class="min-h-10 shrink-0 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime"
        :class="
          activeTab === tab.id
            ? 'bg-ink text-white'
            : 'text-black/60 hover:bg-black/[.05] hover:text-ink'
        "
        @click="activeTab = tab.id"
        @keydown="navigateTabs($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>
    <section
      v-show="activeTab === 'overview'"
      id="business-panel-overview"
      role="tabpanel"
      aria-labelledby="business-tab-overview"
      tabindex="0"
    >
      <div
        class="mb-6 flex flex-col gap-4 rounded-[1.5rem] border p-5 sm:flex-row sm:items-center sm:justify-between"
        :class="
          detail.business.isActive
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-red-200 bg-red-50'
        "
      >
        <div class="flex items-start gap-3">
          <component
            :is="detail.business.isActive ? CircleCheckBig : Ban"
            :size="21"
            class="mt-0.5"
          />
          <div>
            <p class="m-0 font-bold">
              {{
                detail.business.isActive
                  ? "Business is active"
                  : "Business is disabled"
              }}
            </p>
            <p class="mb-0 mt-1 text-sm opacity-65">
              {{
                detail.business.isActive
                  ? "Owners can sign in and customers can view the QR menu."
                  : "Owner access and the public menu are blocked. Data remains preserved."
              }}
            </p>
          </div>
        </div>
        <button
          type="button"
          :class="detail.business.isActive ? 'btn-danger' : 'btn-primary'"
          @click="confirmStatus = true"
        >
          {{
            detail.business.isActive ? "Disable business" : "Enable business"
          }}
        </button>
      </div>
      <div class="grid items-start gap-6 lg:grid-cols-2">
        <div class="grid content-start gap-6">
          <section class="panel p-6">
            <h2 class="display m-0 text-xl font-extrabold">Profile</h2>
            <dl class="mt-5 grid gap-4 text-sm">
              <div>
                <dt
                  class="text-xs font-bold uppercase tracking-[.1em] text-black/35"
                >
                  Business ID
                </dt>
                <dd class="mb-0 mt-1 break-all font-mono text-xs">
                  {{ detail.business.id }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-xs font-bold uppercase tracking-[.1em] text-black/35"
                >
                  Contact
                </dt>
                <dd class="mb-0 mt-1">
                  {{
                    detail.business.contactEmail ||
                    detail.business.phone ||
                    "Not configured"
                  }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-xs font-bold uppercase tracking-[.1em] text-black/35"
                >
                  Location
                </dt>
                <dd class="mb-0 mt-1">
                  {{ detail.business.address || "Not configured" }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-xs font-bold uppercase tracking-[.1em] text-black/35"
                >
                  Locale & currency
                </dt>
                <dd class="mb-0 mt-1 uppercase">
                  {{ detail.business.locale }} ·
                  {{ detail.business.currency }} ·
                  {{ detail.business.timezone }}
                </dd>
              </div>
            </dl>
            <button v-if="!editingSlug" type="button" class="btn-soft mt-2" @click="editSlug">
              Edit menu URL
            </button>
            <form v-else class="mt-4 grid gap-3 border-t border-black/10 pt-4" @submit.prevent="saveSlug">
              <label>
                <span class="label">Menu link slug</span>
                <input v-model.trim="slugDraft" class="input" type="text" minlength="3" maxlength="48"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*" autocapitalize="none" spellcheck="false"
                  :disabled="slugSaving" required />
              </label>
              <p class="m-0 text-sm leading-6 text-black/55">
                Use lowercase letters, numbers, and single hyphens. Existing links and QR codes will still open.
              </p>
              <p v-if="slugDraft" class="m-0 break-all text-xs text-black/55">{{ defaultMenuUrlFor(slugDraft) }}</p>
              <p v-if="slugError" role="alert" class="m-0 text-sm text-red-700">{{ slugError }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="submit" class="btn-primary" :disabled="slugSaving || slugDraft === detail.business.slug">
                  {{ slugSaving ? "Saving…" : "Save menu URL" }}
                </button>
                <button type="button" class="btn-soft" :disabled="slugSaving" @click="editingSlug = false">Cancel</button>
              </div>
            </form>
          </section>
          <section
            class="panel grid grid-cols-2 gap-px overflow-hidden bg-black/[.06] sm:grid-cols-3"
            aria-label="Business counts"
          >
            <div v-for="stat in stats" :key="stat.label" class="bg-white p-5">
              <p class="display m-0 text-2xl font-extrabold">
                {{ stat.value }}
              </p>
              <p class="mb-0 mt-1 text-xs font-bold text-black/40">
                {{ stat.label }}
              </p>
            </div>
          </section>
        </div>
        <section class="panel p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800"
              >
                <CalendarClock :size="18" />
              </span>
              <div>
                <h2 class="display m-0 text-xl font-extrabold">Subscription</h2>
                <p class="mb-0 mt-1 text-sm text-black/45">
                  {{ detail.business.subscription.planName }} plan
                </p>
              </div>
            </div>
            <span
              class="rounded-full px-3 py-1 text-xs font-bold capitalize"
              :class="subscriptionStatusClass"
              >{{ detail.business.subscription.status }}</span
            >
          </div>
          <p class="mb-0 mt-5 text-sm leading-6 text-black/60">
            {{ subscriptionDescription }}
          </p>
          <button v-if="!changingPlan" type="button" class="btn-soft mt-4" @click="changingPlan = true">
            Change plan
          </button>
          <form v-else class="mt-4 grid gap-3" @submit.prevent="assignPlan">
            <SubscriptionPlanPicker ref="planPicker" v-model="selectedPlan" :disabled="planSaving"
              :exclude-plan-id="detail.business.subscriptionPlanId" />
            <p v-if="planError" class="m-0 text-sm text-red-700" role="alert">{{ planError }}</p>
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="btn-primary" :disabled="planSaving || !selectedPlan">
                {{ planSaving ? "Saving…" : "Save plan" }}
              </button>
              <button type="button" class="btn-soft" :disabled="planSaving" @click="changingPlan = false">Cancel</button>
            </div>
          </form>
          <form class="mt-5 grid gap-3" @submit.prevent="saveSubscription()">
            <label>
              <span class="label">Access expires after</span>
              <input
                v-model="subscriptionExpiresOn"
                type="date"
                class="input"
                :disabled="subscriptionSaving"
                required
              />
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="btn-soft px-3 py-2"
                :disabled="subscriptionSaving"
                @click="extendSubscription(30)"
              >
                +30 days
              </button>
              <button
                type="button"
                class="btn-soft px-3 py-2"
                :disabled="subscriptionSaving"
                @click="extendSubscription(90)"
              >
                +90 days
              </button>
              <button
                type="button"
                class="btn-soft px-3 py-2"
                :disabled="subscriptionSaving"
                @click="extendSubscription('year')"
              >
                +1 year
              </button>
            </div>
            <p
              v-if="subscriptionError"
              class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
            >
              {{ subscriptionError }}
            </p>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="submit"
                class="btn-primary"
                :disabled="subscriptionSaving || !subscriptionExpiresOn"
              >
                <LoaderCircle
                  v-if="subscriptionSaving"
                  :size="16"
                  class="animate-spin"
                />
                <Save v-else :size="16" />Save expiry
              </button>
              <button
                type="button"
                class="btn-soft"
                :disabled="subscriptionSaving"
                @click="saveSubscription(null)"
              >
                <InfinityIcon :size="16" />Make unlimited
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
    <section
      v-show="activeTab === 'menu'"
      id="business-panel-menu"
      role="tabpanel"
      aria-labelledby="business-tab-menu"
      tabindex="0"
      class="grid items-start gap-6 lg:grid-cols-2"
    >
      <section class="panel p-6">
        <div class="flex items-start gap-3">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime/40"
          >
            <Link2 :size="18" />
          </span>
          <div>
            <h2 class="display m-0 text-xl font-extrabold">
              Customer menu domain
            </h2>
            <p class="mb-0 mt-1 text-sm leading-6 text-black/45">
              Map one customer-owned subdomain to this business. Leave it empty
              to use the default Pages URL.
            </p>
          </div>
        </div>
        <form class="mt-5 grid gap-3" @submit.prevent="saveCustomMenuUrl">
          <label>
            <span class="label">Custom HTTPS origin (optional)</span>
            <input
              v-model.trim="customMenuUrl"
              type="url"
              class="input"
              placeholder="https://emenu.restaurant.com"
              :disabled="menuUrlSaving"
            />
          </label>
          <div
            class="rounded-2xl border border-black/[.06] bg-cream p-4 text-xs leading-5 text-black/55"
          >
            <strong class="block text-ink">Cloudflare setup required</strong>
            <span class="mt-1 block">
              First add this hostname to the
              <code>angkor-emenu-menu</code> Pages project, then ask the
              customer to create:
            </span>
            <code class="mt-2 block break-all rounded-xl bg-white p-3 text-ink"
              >CNAME emenu.restaurant.com → angkor-emenu-menu.pages.dev</code
            >
            <span class="mt-2 block">
              Enter only the HTTPS origin—paths, queries, and fragments are not
              accepted.
            </span>
          </div>
          <p class="m-0 break-all text-xs leading-5 text-black/40">
            Default: {{ defaultMenuUrl }}
          </p>
          <p
            v-if="menuUrlError"
            class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
          >
            {{ menuUrlError }}
          </p>
          <button
            type="submit"
            class="btn-primary mt-1 w-full"
            :disabled="menuUrlSaving"
          >
            <LoaderCircle
              v-if="menuUrlSaving"
              :size="16"
              class="animate-spin"
            />
            <Save v-else :size="16" />
            {{ menuUrlSaving ? "Saving…" : "Save custom domain" }}
          </button>
        </form>
        <form class="mt-6 grid gap-3 border-t border-black/10 pt-5" @submit.prevent="saveMenuBrowsing">
          <label class="flex items-center gap-3 text-sm font-bold">
            <input v-model="allowCategoryBrowsing" type="checkbox" class="size-4 accent-ink"
              :disabled="menuBrowsingSaving" aria-describedby="menu-browsing-help" />
            Allow browsing by product category
          </label>
          <p id="menu-browsing-help" class="m-0 text-sm leading-6 text-black/55">
            When enabled, customers can open the business link and browse by product category.
            When disabled, the business link opens the first active main menu.
          </p>
          <p v-if="menuBrowsingError" role="alert" class="m-0 text-sm text-red-700">{{ menuBrowsingError }}</p>
          <button type="submit" class="btn-primary w-full"
            :disabled="menuBrowsingSaving || allowCategoryBrowsing === detail.business.allowCategoryBrowsing">
            <LoaderCircle v-if="menuBrowsingSaving" :size="16" class="animate-spin" />
            <Save v-else :size="16" />
            {{ menuBrowsingSaving ? "Saving…" : "Save browsing settings" }}
          </button>
        </form>
      </section>
      <OrderingSettingsPanel
        :key="`ordering-${detail.business.id}`"
        :business="detail.business"
        @saved="Object.assign(detail.business, $event)"
      />
    </section>
    <section v-if="activeTab === 'branches'" id="business-panel-branches" role="tabpanel" aria-labelledby="business-tab-branches" tabindex="0">
      <BranchesPanel :key="detail.business.id" :business-id="detail.business.id" />
    </section>
    <section v-if="activeTab === 'booking'" id="business-panel-booking" role="tabpanel" aria-labelledby="business-tab-booking" tabindex="0">
      <BookingSettingsPanel :key="detail.business.id" :business-id="detail.business.id"
        :menu-url="detail.business.customMenuUrl || defaultMenuUrl" />
    </section>
    <section
      v-show="activeTab === 'access'"
      id="business-panel-access"
      role="tabpanel"
      aria-labelledby="business-tab-access"
      tabindex="0"
      class="grid items-start gap-6 xl:grid-cols-2"
    >
      <ControlPagesPanel
        :key="`control-pages-${detail.business.id}`"
        :business="detail.business"
        @saved="detail.business.disabledControlPages = $event"
      />
      <BookingFeaturePanel v-if="activeTab === 'access'" :key="detail.business.id" :business-id="detail.business.id" />
      <section class="panel overflow-hidden">
        <header
          class="flex flex-col gap-4 border-b border-black/[.06] p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 class="display m-0 text-xl font-extrabold">Member accounts</h2>
            <p class="mb-0 mt-1 text-sm text-black/45">
              Add manager logins, reset passwords, or update login emails.
            </p>
          </div>
          <button
            type="button"
            class="btn-primary shrink-0"
            @click="addMemberOpen = true"
          >
            <UserPlus :size="16" />Add sub-account
          </button>
        </header>
        <div class="divide-y divide-black/[.05]">
          <div
            v-for="member in detail.members"
            :key="member.id"
            class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
          >
            <span
              class="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-sm font-extrabold"
              >{{ initials(member.displayName || member.email) }}</span
            >
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate font-bold">{{ member.displayName }}</p>
              <p class="mb-0 mt-1 truncate text-sm text-black/45">
                {{ member.email }}
              </p>
            </div>
            <span
              class="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold capitalize text-blue-700"
              >{{ member.role }}</span
            >
            <button
              type="button"
              class="btn-soft px-4 py-2"
              @click="editMember = member"
            >
              <KeyRound :size="15" />Credentials
            </button>
          </div>
        </div>
      </section>
    </section>
    <section
      v-show="activeTab === 'integration'"
      id="business-panel-integration"
      role="tabpanel"
      aria-labelledby="business-tab-integration"
      tabindex="0"
      class="grid max-w-3xl gap-6"
    >
      <PosIntegrationPanel
        :key="detail.business.id"
        :business-id="detail.business.id"
        :business-active="Boolean(detail.business.isActive)"
        :subscription-read-only="detail.business.subscription.readOnly"
      />
    </section>
    <section v-if="activeTab === 'reset'" id="business-panel-reset" role="tabpanel"
      aria-labelledby="business-tab-reset" tabindex="0" class="max-w-3xl">
      <BusinessResetPanel :key="detail.business.id" :business-id="detail.business.id" @reset="refreshResetCounts" />
    </section>
  </template>
  <ConfirmDialog
    :open="confirmStatus"
    :title="
      detail?.business.isActive ? 'Disable business?' : 'Enable business?'
    "
    :message="
      detail?.business.isActive
        ? 'Owner sessions will be revoked and both the management portal and public menu will stop working immediately.'
        : 'The owner portal and public menu will become available again. Owners must sign in again.'
    "
    :confirm-label="
      detail?.business.isActive ? 'Disable business' : 'Enable business'
    "
    :danger="Boolean(detail?.business.isActive)"
    :busy="statusLoading"
    @close="confirmStatus = false"
    @confirm="changeStatus"
  />
  <CredentialsDialog
    :open="Boolean(editMember)"
    :member="editMember"
    :saving="credentialsLoading"
    :error="credentialsError"
    @close="editMember = null"
    @submit="saveCredentials"
  />
  <AddMemberDialog
    :open="addMemberOpen"
    :saving="memberCreating"
    :error="memberCreateError"
    @close="closeAddMember"
    @submit="createMember"
  />
  <CloneBusinessDialog
    :open="cloneOpen"
    :target-id="businessId"
    :target-name="detail?.business.name || ''"
    @close="cloneOpen = false"
    @cloned="finishClone"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  Ban,
  CalendarClock,
  CircleCheckBig,
  Copy,
  ExternalLink,
  KeyRound,
  Infinity as InfinityIcon,
  Link2,
  LoaderCircle,
  LogIn,
  Save,
  TriangleAlert,
  UserPlus,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import CredentialsDialog from "../components/CredentialsDialog.vue";
import AddMemberDialog from "../components/AddMemberDialog.vue";
import CloneBusinessDialog from "../components/CloneBusinessDialog.vue";
import ControlPagesPanel from "../components/ControlPagesPanel.vue";
import BookingFeaturePanel from "../components/BookingFeaturePanel.vue";
import BookingSettingsPanel from "../components/BookingSettingsPanel.vue";
import BranchesPanel from "../components/BranchesPanel.vue";
import BusinessResetPanel from "../components/BusinessResetPanel.vue";
import OrderingSettingsPanel from "../components/OrderingSettingsPanel.vue";
import PosIntegrationPanel from "../components/PosIntegrationPanel.vue";
import SubscriptionPlanPicker from "../components/SubscriptionPlanPicker.vue";
import type { ManagedPlan } from "../../../../shared/subscriptionPlans";
import {
  api,
  ApiError,
  formatDate,
  type BusinessDetail,
  type CloneResult,
  type Member,
  type NewMemberAccount,
  type SubscriptionSummary,
} from "../api";
import { AUTH_VERSION, createPasswordProof } from "../utils/passwordProof";
import { useSuperStore } from "../stores/super";
const route = useRoute();
const store = useSuperStore();
const detail = ref<BusinessDetail | null>(null);
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "access", label: "Sidebar & members" },
  { id: "menu", label: "Customer menu" },
  { id: "branches", label: "Branches" },
  { id: "booking", label: "Booking Settings" },
  { id: "integration", label: "POS integration" },
  { id: "reset", label: "Reset data" },
] as const;
const activeTab = ref<(typeof tabs)[number]["id"]>("overview");
const loading = ref(true);
const error = ref("");
const actionError = ref("");
const confirmStatus = ref(false);
const statusLoading = ref(false);
const supportLoading = ref(false);
const editingSlug = ref(false);
const slugDraft = ref("");
const slugSaving = ref(false);
const slugError = ref("");
const customMenuUrl = ref("");
const menuUrlSaving = ref(false);
const menuUrlError = ref("");
const allowCategoryBrowsing = ref(true);
const menuBrowsingSaving = ref(false);
const menuBrowsingError = ref("");
const subscriptionExpiresOn = ref("");
const subscriptionSaving = ref(false);
const subscriptionError = ref("");
const changingPlan = ref(false);
const selectedPlan = ref<ManagedPlan | null>(null);
const planPicker = ref<InstanceType<typeof SubscriptionPlanPicker> | null>(null);
const planSaving = ref(false);
const planError = ref("");
const editMember = ref<Member | null>(null);
const credentialsLoading = ref(false);
const credentialsError = ref("");
const addMemberOpen = ref(false);
const memberCreating = ref(false);
const memberCreateError = ref("");
const cloneOpen = ref(false);
const businessId = computed(() => String(route.params.id));
const menuBase =
  import.meta.env.VITE_MENU_URL || "https://angkor-emenu-menu.pages.dev";
const defaultMenuUrlFor = (slug: string) => `${menuBase.replace(/\/$/, "")}/${encodeURIComponent(slug)}`;
const defaultMenuUrl = computed(() => defaultMenuUrlFor(detail.value?.business.slug || ""));
const menuUrl = computed(
  () => detail.value?.business.customMenuUrl?.trim() || defaultMenuUrl.value,
);
const subscriptionStatusClass = computed(() => {
  const status = detail.value?.business.subscription.status;
  if (status === "expired") return "bg-red-100 text-red-700";
  if (status === "trialing") return "bg-amber-100 text-amber-800";
  if (status === "unlimited") return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
});
const subscriptionDescription = computed(() => {
  const subscription = detail.value?.business.subscription;
  if (!subscription) return "Subscription details are unavailable.";
  if (!subscription.expiresOn) return "Access has no expiry date.";
  if (subscription.status === "expired")
    return `Management access expired on ${subscription.expiresOn}. The public menu remains online.`;
  return `Management access is available through ${subscription.expiresOn}${
    subscription.daysRemaining === null
      ? "."
      : ` (${subscription.daysRemaining} days remaining).`
  }`;
});
const stats = computed(() =>
  detail.value
    ? [
        { label: "Products", value: detail.value.counts.products },
        { label: "Categories", value: detail.value.counts.categories },
        { label: "Tables", value: detail.value.counts.tables },
        { label: "Banners", value: detail.value.counts.banners },
        { label: "Members", value: detail.value.counts.members },
      ]
    : [],
);
const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
async function load() {
  loading.value = true;
  editingSlug.value = false;
  changingPlan.value = false;
  planError.value = "";
  error.value = "";
  menuUrlError.value = "";
  menuBrowsingError.value = "";
  try {
    const loaded = await api<BusinessDetail>(
      `/api/super/businesses/${businessId.value}`,
    );
    detail.value = loaded;
    customMenuUrl.value = loaded.business.customMenuUrl || "";
    allowCategoryBrowsing.value = loaded.business.allowCategoryBrowsing;
    subscriptionExpiresOn.value = loaded.business.subscription.expiresOn || "";
  } catch (value) {
    error.value = value instanceof Error ? value.message : "Business not found";
  } finally {
    loading.value = false;
  }
}
function dateInBusinessTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: detail.value?.business.timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
function extendSubscription(value: number | "year") {
  const today = dateInBusinessTimeZone();
  const current = subscriptionExpiresOn.value;
  const base = current && current >= today ? current : today;
  if (value === "year") {
    const [year, month, day] = base.split("-").map(Number);
    const date = new Date(Date.UTC(year + 1, month - 1, day));
    if (date.getUTCMonth() !== month - 1) date.setUTCDate(0);
    subscriptionExpiresOn.value = date.toISOString().slice(0, 10);
    return;
  }
  subscriptionExpiresOn.value = addDays(base, value);
}
async function assignPlan() {
  const business = detail.value?.business;
  const plan = selectedPlan.value;
  if (!business || !plan || planSaving.value) return;
  planSaving.value = true;
  planError.value = "";
  try {
    await api(`/api/super/businesses/${business.id}/subscription-plan`, {
      method: "PUT",
      body: JSON.stringify({ planId: plan.id, priceId: plan.priceId }),
    });
    business.subscriptionPlanId = plan.id;
    business.subscription.planCode = plan.code;
    business.subscription.planName = plan.name;
    changingPlan.value = false;
    store.notify("Subscription plan updated");
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === "PLAN_UNAVAILABLE") await planPicker.value?.load();
    planError.value = cause instanceof Error ? cause.message : "Could not change the plan";
  } finally {
    planSaving.value = false;
  }
}

async function saveSubscription(
  expiresOn: string | null = subscriptionExpiresOn.value,
) {
  if (!detail.value) return;
  subscriptionSaving.value = true;
  subscriptionError.value = "";
  try {
    const subscription = await api<SubscriptionSummary>(
      `/api/super/businesses/${businessId.value}/subscription`,
      {
        method: "PATCH",
        body: JSON.stringify({ expiresOn }),
      },
    );
    detail.value.business.subscription = subscription;
    subscriptionExpiresOn.value = subscription.expiresOn || "";
    store.notify(
      subscription.expiresOn
        ? "Subscription expiry updated"
        : "Subscription set to unlimited",
    );
  } catch (value) {
    subscriptionError.value =
      value instanceof Error
        ? value.message
        : "Could not update the subscription";
  } finally {
    subscriptionSaving.value = false;
  }
}
function editSlug() {
  if (!detail.value) return;
  slugDraft.value = detail.value.business.slug;
  slugError.value = "";
  editingSlug.value = true;
}
async function saveSlug() {
  const business = detail.value?.business;
  if (!business || slugSaving.value || slugDraft.value === business.slug) return;
  slugSaving.value = true;
  slugError.value = "";
  try {
    const result = await api<{ slug: string }>(`/api/super/businesses/${business.id}/slug`, {
      method: "PATCH",
      body: JSON.stringify({ slug: slugDraft.value, previousSlug: business.slug }),
    });
    business.slug = result.slug;
    if (detail.value?.business === business) {
      editingSlug.value = false;
      store.notify("Menu URL updated. Existing links still work.");
    }
  } catch (cause) {
    if (detail.value?.business === business)
      slugError.value = cause instanceof Error ? cause.message : "Could not update the menu URL";
  } finally {
    slugSaving.value = false;
  }
}
async function saveCustomMenuUrl() {
  if (!detail.value) return;
  menuUrlSaving.value = true;
  menuUrlError.value = "";
  try {
    const result = await api<{ customMenuUrl: string }>(
      `/api/super/businesses/${businessId.value}/menu-url`,
      {
        method: "PATCH",
        body: JSON.stringify({ customMenuUrl: customMenuUrl.value }),
      },
    );
    customMenuUrl.value = result.customMenuUrl;
    detail.value.business.customMenuUrl = result.customMenuUrl;
    store.notify(
      result.customMenuUrl
        ? "Custom public menu URL saved"
        : "Default public menu URL restored",
    );
  } catch (value) {
    menuUrlError.value =
      value instanceof Error ? value.message : "Could not update the menu URL";
  } finally {
    menuUrlSaving.value = false;
  }
}
async function saveMenuBrowsing() {
  const business = detail.value?.business;
  if (!business || menuBrowsingSaving.value) return;
  menuBrowsingSaving.value = true;
  menuBrowsingError.value = "";
  try {
    const settings = await api<{ allowCategoryBrowsing: boolean }>(
      `/api/super/businesses/${business.id}/menu-browsing`,
      { method: "PUT", body: JSON.stringify({ allowCategoryBrowsing: allowCategoryBrowsing.value }) },
    );
    business.allowCategoryBrowsing = settings.allowCategoryBrowsing;
    store.notify("Browsing settings saved");
  } catch (cause) {
    menuBrowsingError.value = cause instanceof Error ? cause.message : "Could not save browsing settings";
  } finally {
    menuBrowsingSaving.value = false;
  }
}
async function changeStatus() {
  if (!detail.value) return;
  statusLoading.value = true;
  actionError.value = "";
  try {
    const isActive = !Boolean(detail.value.business.isActive);
    await api(`/api/super/businesses/${businessId.value}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    detail.value.business.isActive = isActive;
    confirmStatus.value = false;
    store.notify(isActive ? "Business enabled" : "Business disabled");
  } catch (value) {
    actionError.value =
      value instanceof Error ? value.message : "Could not update business";
  } finally {
    statusLoading.value = false;
  }
}
async function saveCredentials(email: string, password: string) {
  if (!editMember.value) return;
  credentialsLoading.value = true;
  credentialsError.value = "";
  try {
    const passwordProof = await createPasswordProof(email, password);
    await api(`/api/super/users/${editMember.value.id}/credentials`, {
      method: "PUT",
      body: JSON.stringify({ email, passwordProof, authVersion: AUTH_VERSION }),
    });
    editMember.value = null;
    store.notify("Account credentials reset");
    await load();
  } catch (value) {
    credentialsError.value =
      value instanceof Error ? value.message : "Could not reset credentials";
  } finally {
    credentialsLoading.value = false;
  }
}
function closeAddMember() {
  if (memberCreating.value) return;
  addMemberOpen.value = false;
  memberCreateError.value = "";
}
async function createMember(account: NewMemberAccount) {
  memberCreating.value = true;
  memberCreateError.value = "";
  try {
    const passwordProof = await createPasswordProof(
      account.email,
      account.password,
    );
    const member = await api<Member>(
      `/api/super/businesses/${businessId.value}/members`,
      {
        method: "POST",
        body: JSON.stringify({
          displayName: account.displayName,
          email: account.email,
          passwordProof,
          authVersion: AUTH_VERSION,
        }),
      },
    );
    if (detail.value) {
      detail.value.members.push(member);
      detail.value.counts.members += 1;
    }
    addMemberOpen.value = false;
    store.notify("Sub-account created");
  } catch (value) {
    memberCreateError.value =
      value instanceof Error ? value.message : "Could not create sub-account";
  } finally {
    memberCreating.value = false;
  }
}
async function openSupportSession() {
  const popup = window.open("", "_blank");
  if (popup) popup.opener = null;
  supportLoading.value = true;
  actionError.value = "";
  try {
    const result = await api<{ handoffUrl: string }>(
      `/api/super/businesses/${businessId.value}/support-session`,
      { method: "POST" },
    );
    if (popup) popup.location.href = result.handoffUrl;
    else window.open(result.handoffUrl, "_blank", "noopener");
    store.notify("Support session opened for 15 minutes");
  } catch (value) {
    popup?.close();
    actionError.value =
      value instanceof Error ? value.message : "Could not open support session";
  } finally {
    supportLoading.value = false;
  }
}
async function refreshResetCounts() {
  const current = detail.value;
  if (!current) return;
  try {
    const result = await api<BusinessDetail>(`/api/super/businesses/${current.business.id}`);
    if (detail.value === current) current.counts = result.counts;
  } catch {
    store.notify("Reset completed. Reload to refresh the business counts.");
  }
}

async function finishClone(result: CloneResult) {
  cloneOpen.value = false;
  store.notify(
    `Data cloned successfully · ${result.copied.products} products · ${result.copied.categories} categories`,
  );
  await load();
}

function navigateTabs(event: KeyboardEvent, index: number) {
  let nextIndex: number;
  switch (event.key) {
    case "ArrowLeft":
      nextIndex = (index - 1 + tabs.length) % tabs.length;
      break;
    case "ArrowRight":
      nextIndex = (index + 1) % tabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  const tab = tabs[nextIndex];
  activeTab.value = tab.id;
  document.getElementById(`business-tab-${tab.id}`)?.focus();
}

onMounted(load);
watch(businessId, () => {
  activeTab.value = "overview";
  void load();
});
</script>
