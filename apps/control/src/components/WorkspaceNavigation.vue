<template>
  <aside class="sticky top-0 z-30 hidden h-dvh shrink-0 self-start lg:flex">
    <button
      v-if="!openGroup && visibleGroups.length"
      type="button"
      class="workspace-focus absolute -right-4 top-5 grid size-8 place-items-center rounded-lg border border-black/10 bg-white text-black/55 shadow-sm hover:text-ink"
      :aria-label="t('shell.openSubmenu')"
      :title="t('shell.openSubmenu')"
      @click="reopenSubmenu"
    >
      <PanelLeftOpen :size="17" aria-hidden="true" />
    </button>
    <div
      class="flex w-[84px] flex-col border-r border-black/[0.08] bg-[#fbfbf8]"
    >
      <div
        class="grid h-[72px] shrink-0 place-items-center border-b border-black/[0.07]"
      >
        <BrandMark
          :title="businessName"
          :logo-url="store.business.logoUrl"
          compact
        />
      </div>

      <nav
        :aria-label="t('shell.workspace')"
        class="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-1.5 py-3"
      >
        <RouterLink
          v-if="store.canAccessPage('overview')"
          :to="controlPages.overview.path"
          class="rail-item"
          exact-active-class="is-current"
          @click="closeOnPageSelect"
        >
          <span class="rail-icon"
            ><LayoutDashboard :size="19" aria-hidden="true"
          /></span>
          <span>{{ t("nav.overview") }}</span>
        </RouterLink>

        <button
          v-for="group in visibleGroups"
          :id="`workspace-group-${group.id}`"
          :key="group.id"
          type="button"
          class="rail-item"
          :class="{
            'is-current': activeGroupId === group.id,
            'is-open': openGroupId === group.id,
          }"
          :aria-current="activeGroupId === group.id ? 'true' : undefined"
          :aria-expanded="openGroupId === group.id"
          :aria-controls="
            openGroupId === group.id ? 'workspace-submenu' : undefined
          "
          @click="toggleGroup(group.id)"
        >
          <span class="rail-icon"
            ><component :is="group.icon" :size="19" aria-hidden="true"
          /></span>
          <span>{{ t(`nav.groups.${group.id}`) }}</span>
        </button>
      </nav>

      <div
        class="grid shrink-0 place-items-center border-t border-black/[0.07] py-3"
      >
        <button
          type="button"
          class="workspace-focus grid size-11 place-items-center rounded-xl hover:bg-black/5 disabled:opacity-60"
          :disabled="!store.loaded"
          :aria-label="t('shell.openAccountMenu')"
          :title="`${userName} · ${roleLabel}`"
          @click="$emit('openAccount')"
        >
          <span
            class="grid size-9 place-items-center rounded-full bg-[#ffd8b5] text-xs font-bold"
            aria-hidden="true"
          >
            {{ userInitials }}
          </span>
        </button>
      </div>
    </div>

    <nav
      v-if="openGroup"
      id="workspace-submenu"
      ref="submenu"
      :aria-label="t(`nav.groups.${openGroup.id}`)"
      class="flex w-56 flex-col border-r border-black/[0.08] bg-white"
      @keydown.esc.stop="closeGroup"
    >
      <div
        class="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.07] px-4"
      >
        <h2 class="text-base font-bold">
          {{ t(`nav.groups.${openGroup.id}`) }}
        </h2>
        <button
          type="button"
          class="workspace-focus grid size-9 shrink-0 place-items-center rounded-lg text-black/55 hover:bg-cream hover:text-ink"
          :aria-label="t('shell.collapseSubmenu')"
          :title="t('shell.collapseSubmenu')"
          @click="closeGroup"
        >
          <PanelLeftClose :size="17" aria-hidden="true" />
        </button>
      </div>
      <ul
        :key="openGroup.id"
        class="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        <li v-for="page in openGroup.pages" :key="page">
          <RouterLink
            :to="controlPages[page].path"
            class="workspace-link"
            :class="{ 'is-current': route.name === page }"
          >
            <component
              :is="pageNavigation[page].icon"
              :size="17"
              class="shrink-0"
              aria-hidden="true"
            />
            <span>{{ t(`nav.${page}`) }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </aside>

  <dialog
    id="workspace-navigation-drawer"
    ref="drawer"
    aria-labelledby="workspace-drawer-title"
    class="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-80 max-w-[90vw] overflow-hidden bg-[#fbfbf8] p-0 text-ink shadow-2xl backdrop:bg-ink/45"
    @click.self="mobileOpen = false"
    @close="mobileOpen = false"
  >
    <div class="flex h-full flex-col">
      <div
        class="flex min-h-[72px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.07] px-4 py-2"
      >
        <BrandMark
          :title="businessName"
          :logo-url="store.business.logoUrl"
          compact
        />
        <div class="min-w-0 flex-1">
          <h2
            id="workspace-drawer-title"
            class="text-xs font-semibold text-black/55"
          >
            {{ t("shell.workspace") }}
          </h2>
          <p class="break-words text-sm font-bold">{{ businessName }}</p>
        </div>
        <button
          type="button"
          autofocus
          class="workspace-focus grid size-10 shrink-0 place-items-center rounded-lg hover:bg-cream"
          :aria-label="t('shell.closeNavigation')"
          @click="mobileOpen = false"
        >
          <X :size="20" aria-hidden="true" />
        </button>
      </div>

      <nav
        :aria-label="t('shell.workspace')"
        class="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3"
      >
        <RouterLink
          v-if="store.canAccessPage('overview')"
          :to="controlPages.overview.path"
          class="workspace-link"
          exact-active-class="is-current"
          @click="closeOnPageSelect"
        >
          <LayoutDashboard :size="18" class="shrink-0" aria-hidden="true" />
          <span>{{ t("nav.overview") }}</span>
        </RouterLink>

        <div v-for="group in visibleGroups" :key="group.id">
          <button
            type="button"
            class="workspace-link w-full"
            :class="{ 'is-current': activeGroupId === group.id }"
            :aria-expanded="mobileGroupId === group.id"
            :aria-controls="`workspace-drawer-group-${group.id}`"
            @click="
              mobileGroupId = mobileGroupId === group.id ? null : group.id
            "
          >
            <component
              :is="group.icon"
              :size="18"
              class="shrink-0"
              aria-hidden="true"
            />
            <span class="flex-1 font-semibold">{{
              t(`nav.groups.${group.id}`)
            }}</span>
            <ChevronDown
              :size="16"
              class="shrink-0 transition-transform motion-reduce:transition-none"
              :class="{ 'rotate-180': mobileGroupId === group.id }"
              aria-hidden="true"
            />
          </button>
          <ul
            v-show="mobileGroupId === group.id"
            :id="`workspace-drawer-group-${group.id}`"
            class="mb-2 ml-5 mt-1 space-y-1 border-l border-black/10 pl-2"
          >
            <li v-for="page in group.pages" :key="page">
              <RouterLink
                :to="controlPages[page].path"
                class="workspace-link"
                :class="{ 'is-current': route.name === page }"
                @click="closeOnPageSelect"
              >
                <component
                  :is="pageNavigation[page].icon"
                  :size="16"
                  class="shrink-0"
                  aria-hidden="true"
                />
                <span>{{ t(`nav.${page}`) }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </nav>

      <div class="shrink-0 border-t border-black/[0.07] p-3">
        <LanguageSwitcher />
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
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
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Receipt,
  Send,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  Utensils,
  X,
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
defineEmits<{ openAccount: [] }>();
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
  business: { group: "business", icon: Store },
  appearance: { group: "design", icon: Palette },
  catalog: { group: "menu", icon: Package },
  menus: { group: "menu", icon: ListTree },
  priceLists: { group: "menu", icon: Tags },
  managePrices: { group: "menu", icon: BadgeDollarSign },
  sellingOverview: { group: "selling", icon: LayoutDashboard },
  posProfiles: { group: "selling", icon: SlidersHorizontal },
  posPaymentTypes: { group: "selling", icon: CreditCard },
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
const drawer = ref<HTMLDialogElement>();

watch(openGroupId, (groupId) => {
  try {
    localStorage.setItem(groupStorageKey, groupId ?? "collapsed");
  } catch {
    // Navigation preferences still work for this session.
  }
});

watch(() => route.name, () => {
  if (openGroupId.value && openGroupId.value !== activeGroupId.value) closeGroup();
});

async function toggleGroup(id: GroupId) {
  if (openGroupId.value === id) {
    closeGroup();
    return;
  }
  openGroupId.value = id;
  await nextTick();
  const link =
    submenu.value?.querySelector<HTMLAnchorElement>("a.is-current") ??
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

watch(mobileOpen, (open) => {
  if (open) {
    mobileGroupId.value = activeGroupId.value;
    drawer.value?.showModal();
  } else {
    drawer.value?.close();
  }
});

const desktop = window.matchMedia("(min-width: 1024px)");
function closeDrawerOnDesktop(event: MediaQueryListEvent) {
  if (event.matches) mobileOpen.value = false;
}
onMounted(() => desktop.addEventListener("change", closeDrawerOnDesktop));
onUnmounted(() => desktop.removeEventListener("change", closeDrawerOnDesktop));
</script>

<style scoped>
.workspace-focus,
.rail-item,
.workspace-link {
  @apply focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink;
}

.rail-item {
  @apply flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold leading-snug text-black/60 transition-colors hover:bg-black/[0.035] hover:text-ink;
  overflow-wrap: anywhere;
}

.rail-icon {
  @apply grid h-8 w-10 shrink-0 place-items-center rounded-xl;
}

.rail-item.is-open,
.rail-item.is-current {
  @apply text-ink;
}

.rail-item.is-open .rail-icon {
  @apply bg-[#e7e9e1];
}

.rail-item.is-current .rail-icon {
  @apply bg-ink text-mint;
}

.workspace-link {
  @apply flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium leading-snug text-black/65 transition-colors hover:bg-black/[0.04] hover:text-ink;
  overflow-wrap: anywhere;
}

.workspace-link.is-current {
  @apply bg-[#e7e9e1] font-bold text-ink;
}
</style>
