<template>
  <div class="min-h-screen lg:flex">
    <WorkspaceNavigation
      v-model:mobile-open="mobile"
      :user-name="userName"
      :user-initials="userInitials"
      :role-label="roleLabel"
      @open-account="accountOpen = true"
    />
    <div class="min-w-0 flex-1">
      <header
        class="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-black/[0.07] bg-[#f3f1eb]/90 px-5 backdrop-blur-xl lg:px-9"
      >
        <button
          type="button"
          class="-ml-2 rounded-xl p-2 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink lg:hidden"
          :aria-label="t('shell.openNavigation')"
          :aria-expanded="mobile"
          aria-controls="workspace-navigation-drawer"
          aria-haspopup="dialog"
          @click="mobile = true"
        >
          <Menu :size="22" aria-hidden="true" />
        </button>
        <div class="hidden lg:block">
          <p class="m-0 text-[11px] font-medium tracking-normal text-black/45">
            {{ t("shell.workspace") }}
          </p>
          <p class="m-0 mt-0.5 text-sm font-semibold">
            {{ store.business.name || t("shell.loadingBusiness") }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span
            v-if="store.loaded"
            class="hidden rounded-lg border border-black/[0.06] bg-white px-3 py-1.5 text-xs font-medium text-black/55 xl:block"
          >
            {{
              store.subscription.expiresOn
                ? `${subscriptionPlanName} · ${store.subscription.expiresOn}`
                : `${subscriptionPlanName} · ${t("shell.noExpiry")}`
            }}
          </span>
          <a
            v-if="store.loaded && store.publicMenuUrl"
            :href="store.publicMenuUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-soft"
            ><ExternalLink :size="16" /><span class="hidden sm:inline">{{
              t("common.viewMenu")
            }}</span></a
          ><button v-else type="button" class="btn-soft opacity-50" disabled>
            <ExternalLink :size="16" /><span class="hidden sm:inline">{{
              t("common.viewMenu")
            }}</span></button
          ><LanguageSwitcher class="hidden sm:inline-flex" /><button
            class="grid size-10 place-items-center rounded-xl border border-black/[0.06] bg-white"
          >
            <Bell :size="17" />
          </button>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-full bg-[#ffd8b5] text-xs font-extrabold lg:hidden"
            :disabled="!store.loaded"
            :aria-label="t('shell.openAccountMenu')"
            @click="accountOpen = true"
          >
            {{ userInitials }}
          </button>
        </div>
      </header>
      <div
        v-if="store.supportSession"
        class="flex flex-col gap-3 border-b border-amber-300 bg-amber-100 px-5 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between lg:px-9"
      >
        <div class="flex min-w-0 items-start gap-3 sm:items-center">
          <ShieldAlert :size="19" class="mt-0.5 shrink-0 sm:mt-0" />
          <p class="m-0 leading-5">
            <strong>{{ t("shell.support.title") }}</strong>
            {{
              t("shell.support.message", {
                business: store.business.name,
                email: store.supportSession.actorEmail,
                time: supportExpiry,
              })
            }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full bg-amber-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          :disabled="signingOut"
          @click="signOut"
        >
          {{
            signingOut ? t("shell.support.leaving") : t("shell.support.leave")
          }}
        </button>
      </div>
      <div
        v-else-if="store.isReadOnly || store.subscription.status === 'trialing'"
        class="flex items-start gap-3 border-b px-5 py-3 text-sm lg:px-9"
        :class="
          store.isReadOnly
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-amber-200 bg-amber-50 text-amber-950'
        "
      >
        <CalendarClock :size="19" class="mt-0.5 shrink-0" />
        <p class="m-0 leading-5">
          <template v-if="store.isReadOnly">
            <strong>{{ t("shell.subscription.expiredTitle") }}</strong>
            {{ t("shell.subscription.expiredMessage") }}
          </template>
          <template v-else>
            <strong>{{
              t("shell.subscription.trialTitle", {
                plan: subscriptionPlanName,
              })
            }}</strong>
            {{
              t("shell.subscription.trialMessage", {
                days: store.subscription.daysRemaining,
                date: store.subscription.expiresOn,
              })
            }}
          </template>
        </p>
      </div>
      <main class="mx-auto max-w-[1560px] p-5 lg:p-9">
        <div
          v-if="store.loading"
          class="card grid min-h-[420px] place-items-center p-8 text-center"
        >
          <div>
            <LoaderCircle
              :size="38"
              class="mx-auto animate-spin text-black/30"
            />
            <p class="mb-0 mt-4 text-sm font-bold text-black/50">
              {{ t("shell.loadingWorkspace") }}
            </p>
          </div>
        </div>
        <div
          v-else-if="store.loadError"
          class="card grid min-h-[420px] place-items-center p-8 text-center"
        >
          <div class="max-w-md">
            <AlertTriangle :size="38" class="mx-auto text-red-500" />
            <h1 class="display mb-2 mt-4 text-2xl font-extrabold">
              {{ t("shell.loadFailed") }}
            </h1>
            <p class="text-sm leading-6 text-black/50">
              {{ store.loadError }} {{ t("shell.loadFailedDetail") }}
            </p>
            <button class="btn-primary mt-3" @click="store.load">
              <RefreshCw :size="16" />{{ t("common.tryAgain") }}
            </button>
          </div>
        </div>
        <div
          v-else-if="store.loaded"
          :inert="contentReadOnly"
          :aria-disabled="contentReadOnly"
          :class="contentReadOnly ? 'select-none opacity-75' : ''"
        >
          <RouterView v-if="!currentPage || store.canAccessPage(currentPage)" />
          <WorkspaceUnavailableView v-else />
        </div>
      </main>
    </div>
    <AccountDialog
      :open="accountOpen"
      :name="userName"
      :email="store.user.email"
      :role="store.role"
      :initials="userInitials"
      :signing-out="signingOut"
      @close="accountOpen = false"
      @change-password="openPasswordDialog"
      @sign-out="signOut"
    />
    <ChangePasswordDialog
      :open="passwordOpen"
      :saving="passwordSaving"
      :error="passwordError"
      @close="passwordOpen = false"
      @submit="changePassword"
    />
    <Transition
      enter-active-class="transition"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition"
      leave-to-class="translate-y-3 opacity-0"
      ><div
        v-if="store.toast"
        class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl"
      >
        <CheckCircle2 class="mr-2 inline" :size="17" />{{ store.toast }}
      </div></Transition
    >
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import {
  ExternalLink,
  Bell,
  Menu,
  CheckCircle2,
  LoaderCircle,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CalendarClock,
} from "lucide-vue-next";
import AccountDialog from "./AccountDialog.vue";
import ChangePasswordDialog from "./ChangePasswordDialog.vue";
import LanguageSwitcher from "./LanguageSwitcher.vue";
import WorkspaceNavigation from "./WorkspaceNavigation.vue";
import WorkspaceUnavailableView from "../views/WorkspaceUnavailableView.vue";
import { useAdminStore } from "../stores/admin";
import { controlPageIds, sellingControlPages } from "../../../../shared/controlPages";
const { t, locale } = useI18n();
const store = useAdminStore();
const route = useRoute();
const mobile = ref(false);
const accountOpen = ref(false);
const passwordOpen = ref(false);
const signingOut = ref(false);
const passwordSaving = ref(false);
const passwordError = ref("");
const currentPage = computed(() => controlPageIds.find((page) => page === route.name));
const contentReadOnly = computed(
  () => store.isReadOnly && route.name !== "reports" && route.name !== "orders" && route.name !== "bookings" &&
    !(currentPage.value && sellingControlPages.includes(currentPage.value)),
);
const userName = computed(
  () =>
    store.user.displayName ||
    store.user.email ||
    (store.loading ? t("common.loading") : t("shell.accountOwner")),
);
const userInitials = computed(() => {
  const parts = userName.value.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
});
const roleLabel = computed(() => {
  const key = `shell.roles.${store.role}`;
  const label = t(key);
  return label === key ? store.role : label;
});
const subscriptionPlanName = computed(() =>
  store.subscription.planName === "Standard"
    ? t("shell.plans.standard")
    : store.subscription.planName,
);
const supportExpiry = computed(() => {
  if (!store.supportSession?.expiresAt) return t("shell.support.expiresSoon");
  return new Intl.DateTimeFormat(locale.value === "km" ? "km-KH" : "en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(store.supportSession.expiresAt));
});

function openPasswordDialog() {
  accountOpen.value = false;
  passwordError.value = "";
  passwordOpen.value = true;
}

async function signOut() {
  signingOut.value = true;
  try {
    await store.signOut();
  } finally {
    signingOut.value = false;
  }
}

async function changePassword(currentPassword: string, newPassword: string) {
  passwordSaving.value = true;
  passwordError.value = "";
  try {
    await store.changePassword(currentPassword, newPassword);
    passwordOpen.value = false;
  } catch (error) {
    passwordError.value =
      error instanceof Error ? error.message : t("account.changeFailed");
  } finally {
    passwordSaving.value = false;
  }
}

function refreshAccessOnFocus() {
  if (store.loaded) void store.refreshWorkspaceAccess().catch(() => undefined);
}

onMounted(() => {
  void store.load();
  window.addEventListener("focus", refreshAccessOnFocus);
});
onUnmounted(() => window.removeEventListener("focus", refreshAccessOnFocus));
</script>
