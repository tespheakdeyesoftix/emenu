<template>
  <aside class="sticky top-0 z-30 hidden h-dvh shrink-0 self-start lg:flex">
    <Button
      v-if="!openGroup && visibleGroups.length"
      variant="outline"
      size="md"
      icon="lucide-panel-left-open"
      class="absolute -right-4 top-5 z-10"
      :aria-label="t('shell.openSubmenu')"
      :tooltip="t('shell.openSubmenu')"
      @click="reopenSubmenu"
    />

    <SidebarRail class="!w-[84px] !px-2 !py-0 border-r border-outline-gray-1">
      <div
        class="grid h-[72px] w-full shrink-0 place-items-center border-b border-outline-gray-1"
      >
        <BrandMark
          :title="businessName"
          :logo-url="store.business.logoUrl"
          compact
        />
      </div>
      <SidebarRailItem
        v-if="store.canAccessPage('telegramNotifications')"
        :route="controlPages.telegramNotifications.path"
        :label="t('nav.telegramNotifications')"
        icon="lucide-bell"
        variant="ghost"
        class="mt-2 !h-9 !w-full"
      />
      <nav
        :aria-label="t('shell.workspace')"
        class="min-h-0 w-full flex-1 space-y-1 overflow-y-auto overscroll-contain py-3"
      >
        <SidebarRailItem
          v-if="store.canAccessPage('overview')"
          :route="controlPages.overview.path"
          :label="t('nav.overview')"
          variant="ghost"
          class="!h-12 !w-full flex-col gap-1"
          @click="closeOnPageSelect"
        >
          <LayoutDashboard :size="18" aria-hidden="true" />
          <span class="max-w-full truncate px-0.5 text-xs-medium">{{
            t("nav.overview")
          }}</span>
        </SidebarRailItem>
        <SidebarRailItem
          v-for="group in visibleGroups"
          :id="`workspace-group-${group.id}`"
          :key="group.id"
          :label="t(`nav.groups.${group.id}`)"
          variant="ghost"
          :active="activeGroupId === group.id || openGroupId === group.id"
          class="!h-12 !w-full flex-col gap-1"
          :aria-expanded="openGroupId === group.id"
          :aria-controls="
            openGroupId === group.id ? 'workspace-submenu' : undefined
          "
          @click="toggleGroup(group.id)"
        >
          <component :is="group.icon" :size="18" aria-hidden="true" />
          <span class="max-w-full truncate px-0.5 text-xs-medium">{{
            t(`nav.groups.${group.id}`)
          }}</span>
        </SidebarRailItem>
      </nav>
      <div
        class="flex w-full shrink-0 flex-col items-center gap-1 border-t border-outline-gray-1 py-2"
      >
        <SidebarRailItem
          :href="store.loaded ? store.publicMenuUrl || undefined : undefined"
          :label="t('common.viewMenu')"
          icon="lucide-external-link"
          variant="ghost"
          class="!h-9 !w-full"
          :disabled="!store.loaded || !store.publicMenuUrl"
          target="_blank"
          rel="noopener noreferrer"
        />
        <LanguageSwitcher compact />
        <SidebarRailItem
          :label="t('shell.openAccountMenu')"
          :description="`${userName} · ${roleLabel}`"
          variant="ghost"
          class="!size-10"
          :disabled="!store.loaded"
          @click="$emit('openAccount')"
        >
          <Avatar size="md" theme="amber"
            ><span class="text-xs-medium">{{ userInitials }}</span></Avatar
          >
        </SidebarRailItem>
      </div>
    </SidebarRail>

    <div
      v-if="openGroup"
      id="workspace-submenu"
      ref="submenu"
      @keydown.esc.stop="closeGroup"
    >
      <Sidebar
        width="14rem"
        :collapsible="false"
        :aria-label="t(`nav.groups.${openGroup.id}`)"
        class="border-r border-outline-gray-1"
      >
        <div
          class="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-outline-gray-1 px-3"
        >
          <SidebarHeader
            :title="t(`nav.groups.${openGroup.id}`)"
            :show-logo="false"
          />
          <Button
            variant="ghost"
            size="md"
            icon="lucide-panel-left-close"
            :aria-label="t('shell.collapseSubmenu')"
            :tooltip="t('shell.collapseSubmenu')"
            @click="closeGroup"
          />
        </div>
        <div
          :key="openGroup.id"
          class="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
        >
          <SidebarItem
            v-for="page in openGroup.pages"
            :key="page"
            :route="controlPages[page].path"
            :icon="pageNavigation[page].icon"
            :label="t(`nav.${page}`)"
            class="!h-9"
          />
        </div>
      </Sidebar>
    </div>
  </aside>

  <Dialog
    v-model:open="mobileOpen"
    :title="t('shell.workspace')"
    :show-close-button="false"
    size="sm"
    @after-leave="restoreNavigationFocus"
  >
    <template #title="{ close }">
      <div
        class="flex min-h-[72px] items-center gap-2 border-b border-outline-gray-1 px-4 py-2"
      >
        <BrandMark
          :title="businessName"
          :logo-url="store.business.logoUrl"
          compact
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm-medium text-ink-gray-5">
            {{ t("shell.workspace") }}
          </p>
          <p class="break-words text-base-semibold text-ink-gray-9">
            {{ businessName }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="md"
          icon="lucide-x"
          autofocus
          :aria-label="t('shell.closeNavigation')"
          @click="close"
        />
      </div>
    </template>
    <div id="workspace-navigation-drawer" class="flex min-h-0 flex-1 flex-col">
      <Sidebar
        width="100%"
        :collapsible="false"
        :aria-label="t('shell.workspace')"
        class="!h-auto min-h-0 flex-1 space-y-1 overflow-y-auto p-3"
      >
        <SidebarItem
          v-if="store.canAccessPage('telegramNotifications')"
          :route="controlPages.telegramNotifications.path"
          :label="t('nav.telegramNotifications')"
          icon="lucide-bell"
          class="!h-10"
          @click="closeOnPageSelect"
        />
        <Divider v-if="store.canAccessPage('telegramNotifications')" flex-item />
        <SidebarItem
          v-if="store.canAccessPage('overview')"
          :route="controlPages.overview.path"
          :label="t('nav.overview')"
          :icon="LayoutDashboard"
          class="!h-10"
          @click="closeOnPageSelect"
        />
        <div v-for="group in visibleGroups" :key="group.id">
          <SidebarItem
            :label="t(`nav.groups.${group.id}`)"
            :icon="group.icon"
            :active="activeGroupId === group.id"
            class="!h-10"
            :aria-expanded="mobileGroupId === group.id"
            :aria-controls="`workspace-drawer-group-${group.id}`"
            @click="
              mobileGroupId = mobileGroupId === group.id ? null : group.id
            "
          >
            <template #suffix>
              <ChevronDown
                :size="15"
                class="transition-transform"
                :class="{ 'rotate-180': mobileGroupId === group.id }"
                aria-hidden="true"
              />
            </template>
          </SidebarItem>
          <div
            v-if="mobileGroupId === group.id"
            :id="`workspace-drawer-group-${group.id}`"
            class="space-y-1 border-l border-outline-gray-1 pl-2 ml-3"
          >
            <SidebarItem
              v-for="page in group.pages"
              :key="page"
              :route="controlPages[page].path"
              :label="t(`nav.${page}`)"
              :icon="pageNavigation[page].icon"
              class="!h-10"
              @click="closeOnPageSelect"
            />
          </div>
        </div>
      </Sidebar>
      <div class="shrink-0 space-y-2 border-t border-outline-gray-1 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Button
            :href="store.loaded ? store.publicMenuUrl || undefined : undefined"
            :disabled="!store.loaded || !store.publicMenuUrl"
            :label="t('common.viewMenu')"
            variant="subtle"
            icon-left="lucide-external-link"
            target="_blank"
            rel="noopener noreferrer"
          />
          <LanguageSwitcher />
        </div>
        <Button
          :disabled="!store.loaded"
          :aria-label="t('shell.openAccountMenu')"
          variant="outline"
          size="lg"
          class="w-full !justify-start"
          @click="requestMobileAccount"
        >
          <template #prefix>
            <Avatar size="sm" theme="amber">{{ userInitials }}</Avatar>
          </template>
          {{ userName }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Avatar,
  Button,
  Dialog,
  Divider,
  Sidebar,
  SidebarHeader,
  SidebarItem,
  SidebarRail,
  SidebarRailItem,
} from "frappe-ui";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import {
  Armchair,
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Images,
  LayoutDashboard,
  ListTree,
  Package,
  Palette,
  QrCode,
  Receipt,
  Send,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-vue-next";
import {
  controlPageIds,
  controlPages,
  type ControlPage,
} from "../../../../shared/controlPages";
import { useAdminStore } from "../stores/admin";
import BrandMark from "./BrandMark.vue";
import LanguageSwitcher from "./LanguageSwitcher.vue";

defineProps<{ userName: string; userInitials: string; roleLabel: string }>();
const emit = defineEmits<{ openAccount: [] }>();
const mobileOpen = defineModel<boolean>("mobileOpen", { required: true });

const { t } = useI18n();
const route = useRoute();
const store = useAdminStore();
const businessName = computed(() => store.business.name || "Angkor eMenu");

const groups = [
  { id: "menu", icon: Utensils },
  { id: "selling", icon: ShoppingCart },
  { id: "service", icon: ClipboardList },
  { id: "design", icon: Palette },
  { id: "business", icon: Store },
] as const;
type GroupId = (typeof groups)[number]["id"];

const pageNavigation = {
  overview: { group: null, icon: LayoutDashboard },
  users: { group: "business", icon: Users },
  business: { group: "business", icon: Store },
  appearance: { group: "design", icon: Palette },
  catalog: { group: "menu", icon: Package },
  menus: { group: "menu", icon: ListTree },
  priceLists: { group: "menu", icon: Tags },
  managePrices: { group: "menu", icon: BadgeDollarSign },
  sellingOverview: { group: "selling", icon: LayoutDashboard },
  posProfiles: { group: "selling", icon: SlidersHorizontal },
  posPaymentTypes: { group: "selling", icon: CreditCard },
  posCustomers: { group: "selling", icon: Users },
  salesList: { group: "selling", icon: Receipt },
  orders: { group: "service", icon: ClipboardList },
  bookings: { group: "service", icon: CalendarClock },
  tables: { group: "service", icon: Armchair },
  telegramNotifications: { group: "service", icon: Send },
  reports: { group: "business", icon: BarChart3 },
  banners: { group: "design", icon: Images },
  qrDesigns: { group: "design", icon: QrCode },
} satisfies Record<ControlPage, { group: GroupId | null; icon: LucideIcon }>;

const visibleGroups = computed(() =>
  groups
    .map((group) => ({
      ...group,
      pages: controlPageIds.filter(
        (page) =>
          pageNavigation[page].group === group.id && store.canAccessPage(page),
      ),
    }))
    .filter((group) => group.pages.length),
);
const activeGroupId = computed(
  () =>
    visibleGroups.value.find((group) =>
      group.pages.some((page) => page === route.name),
    )?.id ?? null,
);
const defaultGroupId = computed(
  () => activeGroupId.value ?? visibleGroups.value[0]?.id ?? null,
);
const groupStorageKey = "angkor_emenu_control_submenu_group";
const openGroupId = ref<GroupId | null>(null);
try {
  const savedGroup = localStorage.getItem(groupStorageKey);
  if (savedGroup && savedGroup !== "collapsed") {
    openGroupId.value =
      visibleGroups.value.find((group) => group.id === savedGroup)?.id ??
      defaultGroupId.value;
  }
} catch {
  // Navigation preferences still work for this session.
}
const openGroup = computed(() =>
  visibleGroups.value.find((group) => group.id === openGroupId.value),
);
const submenu = ref<HTMLElement>();
const mobileGroupId = ref<GroupId | null>(null);

watch(openGroupId, (groupId) => {
  try {
    localStorage.setItem(groupStorageKey, groupId ?? "collapsed");
  } catch {
    // Navigation preferences still work for this session.
  }
});

watch(
  () => route.name,
  () => {
    if (openGroupId.value && openGroupId.value !== activeGroupId.value)
      closeGroup();
  },
);

async function toggleGroup(id: GroupId) {
  if (openGroupId.value === id) {
    closeGroup();
    return;
  }
  openGroupId.value = id;
  await nextTick();
  const link =
    submenu.value?.querySelector<HTMLAnchorElement>("a[aria-current=page]") ??
    submenu.value?.querySelector<HTMLAnchorElement>("a");
  link?.focus();
}

function reopenSubmenu() {
  const id = defaultGroupId.value;
  if (id) void toggleGroup(id);
}

function closeGroup() {
  const id = openGroupId.value;
  if (id && submenu.value?.contains(document.activeElement)) {
    document.getElementById(`workspace-group-${id}`)?.focus();
  }
  openGroupId.value = null;
}

function closeOnPageSelect(event: MouseEvent) {
  if (
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  if (mobileOpen.value) mobileOpen.value = false;
  else closeGroup();
}

watch(
  mobileOpen,
  (open) => {
    if (open) mobileGroupId.value = activeGroupId.value;
  },
  { flush: "sync" },
);

let accountRequested = false;
function requestMobileAccount() {
  accountRequested = true;
  mobileOpen.value = false;
}

const desktop = window.matchMedia("(min-width: 1024px)");
function restoreNavigationFocus() {
  if (!desktop.matches && !mobileOpen.value)
    document.getElementById("workspace-navigation-trigger")?.focus();
  if (accountRequested) {
    accountRequested = false;
    emit("openAccount");
  }
}
function closeDrawerOnDesktop(event: MediaQueryListEvent) {
  if (event.matches) mobileOpen.value = false;
}
onMounted(() => desktop.addEventListener("change", closeDrawerOnDesktop));
onUnmounted(() => desktop.removeEventListener("change", closeDrawerOnDesktop));
</script>
