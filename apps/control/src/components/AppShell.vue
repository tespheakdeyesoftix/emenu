<template>
  <div class="min-h-screen lg:flex">
    <WorkspaceNavigation
      v-model:mobile-open="mobile"
      :user-name="userName"
      :user-initials="userInitials"
      :role-label="roleLabel"
      @open-account="accountOpen = true"
    />
    <div class="min-w-0 flex-1" :style="{ '--workspace-header-height': headerHeight + 'px' }">
      <div
        ref="workspaceHeader"
        data-workspace-header
        class="sticky top-0 z-20 border-b border-outline-gray-1 bg-surface-base"
      >
        <div class="relative mx-auto max-w-[1560px] px-5 lg:px-9">
          <Button
            id="workspace-navigation-trigger"
            variant="ghost"
            size="lg"
            icon="lucide-menu"
            class="absolute left-3 top-4 z-20 lg:!hidden"
            :aria-label="t('shell.openNavigation')"
            :aria-expanded="mobile"
            :aria-controls="mobile ? 'workspace-navigation-drawer' : undefined"
            aria-haspopup="dialog"
            @click="mobile = true"
          />
          <PageHeaderTarget />
          <div v-if="!store.loaded" class="flex min-h-[71px] items-center pl-11 lg:pl-0">
            <h1 class="min-w-0 text-2xl-semibold text-ink-gray-9 [overflow-wrap:anywhere]">
              {{ currentPage ? t(`nav.${currentPage}`) : t("shell.workspace") }}
            </h1>
          </div>
        </div>
      </div>
      <Alert
        v-if="store.supportSession"
        class="mx-5 mt-3 lg:mx-9"
        theme="amber"
        icon="lucide-shield-alert"
        :title="t('shell.support.title')"
        :description="
          t('shell.support.message', {
            business: store.business.name,
            email: store.supportSession.actorEmail,
            time: supportExpiry,
          })
        "
        :primary-action="{
          label: t(
            signingOut ? 'shell.support.leaving' : 'shell.support.leave',
          ),
          variant: 'solid',
          disabled: signingOut,
          onClick: signOut,
        }"
      />
      <Alert
        v-else-if="store.isReadOnly || store.subscription.status === 'trialing'"
        class="mx-5 mt-3 lg:mx-9"
        :theme="store.isReadOnly ? 'red' : 'amber'"
        icon="lucide-calendar-clock"
        :title="
          store.isReadOnly
            ? t('shell.subscription.expiredTitle')
            : t('shell.subscription.trialTitle', { plan: subscriptionPlanName })
        "
        :description="
          store.isReadOnly
            ? t('shell.subscription.expiredMessage')
            : t('shell.subscription.trialMessage', {
                days: store.subscription.daysRemaining,
                date: store.subscription.expiresOn,
              })
        "
      />
      <main class="mx-auto max-w-[1560px] p-5 lg:p-9">
        <div
          v-if="store.loading"
          class="card grid min-h-[420px] place-items-center p-8 text-center"
        >
          <div>
            <Spinner size="lg" class="mx-auto !size-9 text-ink-gray-5" />
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
            <h2 class="display mb-2 mt-4 text-2xl font-extrabold">
              {{ t("shell.loadFailed") }}
            </h2>
            <p class="text-sm leading-6 text-black/50">
              {{ store.loadError }} {{ t("shell.loadFailedDetail") }}
            </p>
            <Button variant="solid" size="lg" class="mt-3" @click="store.load">
              <template #prefix><RefreshCw :size="16" /></template
              >{{ t("common.tryAgain") }}
            </Button>
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
      :plan-name="subscriptionPlanName"
      :expires-on="store.subscription.expiresOn"
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
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, useTemplateRef, watch } from "vue";
import { Alert, Button, PageHeaderTarget, Spinner, toast } from "frappe-ui";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { AlertTriangle, RefreshCw } from "lucide-vue-next";
import AccountDialog from "./AccountDialog.vue";
import ChangePasswordDialog from "./ChangePasswordDialog.vue";
import WorkspaceNavigation from "./WorkspaceNavigation.vue";
import WorkspaceUnavailableView from "../views/WorkspaceUnavailableView.vue";
import { useAdminStore } from "../stores/admin";
import { workspaceActionsDisabled } from "../utils/workspaceHeader";
import {
  controlPageIds,
  sellingControlPages,
} from "../../../../shared/controlPages";
const { t, locale } = useI18n();
const store = useAdminStore();
watch(
  () => store.toast,
  (message) => {
    if (message) toast(message);
  },
);
const route = useRoute();
const mobile = ref(false);
const workspaceHeader = useTemplateRef<HTMLElement>("workspaceHeader");
const headerHeight = ref(72);
let headerObserver: ResizeObserver | undefined;
const accountOpen = ref(false);
const passwordOpen = ref(false);
const signingOut = ref(false);
const passwordSaving = ref(false);
const passwordError = ref("");
const currentPage = computed(() =>
  controlPageIds.find((page) => page === route.name),
);
const contentReadOnly = computed(
  () =>
    store.isReadOnly &&
    route.name !== "reports" &&
    route.name !== "orders" &&
    route.name !== "bookings" &&
    !(currentPage.value && sellingControlPages.includes(currentPage.value)),
);
provide(workspaceActionsDisabled, contentReadOnly);
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
  const header = workspaceHeader.value;
  if (header) {
    headerObserver = new ResizeObserver(() => {
      headerHeight.value = header.offsetHeight;
    });
    headerObserver.observe(header);
  }
  window.addEventListener("focus", refreshAccessOnFocus);
});
onUnmounted(() => {
  headerObserver?.disconnect();
  window.removeEventListener("focus", refreshAccessOnFocus);
});
</script>
