<template>
  <div class="menu-page-bottom-space min-h-screen">
    <PageHeader :title="text.myOrder" />
    <div
      v-if="orderToast"
      class="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-2 text-sm shadow-2xl"
      :class="orderToast.kind === 'warning' ? 'border border-amber-200 bg-amber-50 text-amber-950' : 'bg-action text-on-action'"
    >
      <CircleCheck v-if="orderToast.kind === 'success'" :size="20" class="shrink-0" aria-hidden="true" />
      <TriangleAlert v-else-if="orderToast.kind === 'warning'" :size="20" class="shrink-0 text-amber-700" aria-hidden="true" />
      <CircleAlert v-else :size="20" class="shrink-0" aria-hidden="true" />
      <p :role="orderToast.kind === 'success' ? 'status' : 'alert'" class="m-0 min-w-0 flex-1 font-bold">
        {{ orderToast.message }}
      </p>
      <span class="shrink-0 tabular-nums opacity-75" aria-hidden="true">{{ toastSeconds }}s</span>
      <button
        type="button"
        class="grid size-11 shrink-0 place-items-center rounded-full"
        :class="orderToast.kind === 'warning' ? 'hover:bg-amber-100' : 'hover:bg-on-action/10'"
        :aria-label="t('common.close')"
        @click="dismissOrderToast"
      >
        <X :size="19" aria-hidden="true" />
      </button>
    </div>
    <main class="mx-auto max-w-3xl px-4 py-7 sm:px-6">
      <div
        v-if="store.orderSubmissionEnabled"
        class="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 shadow-sm"
        role="group"
        :aria-label="text.myOrder"
      >
        <button
          type="button"
          class="rounded-xl px-3 py-2.5 text-sm font-bold"
          :class="activeTab === 'current' ? 'bg-action text-on-action' : 'text-ink'"
          :aria-pressed="activeTab === 'current'"
          @click="selectedTab = 'current'"
        >
          {{ text.currentOrder }}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-2.5 text-sm font-bold"
          :class="activeTab === 'history' ? 'bg-action text-on-action' : 'text-ink'"
          :aria-pressed="activeTab === 'history'"
          @click="selectedTab = 'history'"
        >
          {{ text.orderHistory }}
        </button>
      </div>
      <p
        v-if="showCurrent && store.cart.length && !store.tableContext"
        class="mb-5 flex items-center gap-3 rounded-2xl border border-amber-400 bg-amber-50 p-4 text-sm font-bold text-amber-950"
      >
        <button
          type="button"
          class="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800 transition hover:bg-amber-200 focus-visible:outline-amber-700"
          :aria-label="text.scanTableQr"
          @click="showTableScanner = true"
        >
          <QrCode :size="22" aria-hidden="true" />
        </button>
        <span>{{ text.orderTableRequired }}</span>
      </p>
      <div
        v-if="showCurrent && store.cart.length && locationMessage"
        class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm shadow-sm"
        :class="outsideOrderRadius ? 'border border-amber-200 bg-amber-50 text-amber-950' : 'bg-surface'"
      >
        <p class="m-0 flex items-start gap-2 font-bold" role="status">
          <TriangleAlert v-if="outsideOrderRadius" :size="18" class="shrink-0 text-amber-700" aria-hidden="true" />
          <span>{{ locationMessage }}</span>
        </p>
        <button
          v-if="store.orderLocationStatus !== 'checking'"
          type="button"
          class="rounded-full px-4 py-2 font-bold disabled:opacity-60"
          :class="outsideOrderRadius ? 'bg-amber-100 text-amber-950 hover:bg-amber-200' : 'bg-cream text-ink'"
          :disabled="store.submittingOrder"
          @click="store.requestOrderLocation()"
        >
          {{ text.checkLocationAgain }}
        </button>
      </div>
      <section
        v-if="showHistory && historyGroups.length"
        class="mb-5 space-y-5"
        :aria-label="text.orderHistory"
      >
        <section v-for="group in historyGroups" :key="group.date">
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 class="font-display m-0 text-base font-extrabold">
              {{ group.label }} · {{ group.dateLabel }}
            </h2>
            <p class="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span class="text-ink/65">{{ group.partial ? text.knownDailyTotal : text.dailyTotal }}</span>
              <strong v-for="{ currency, amount } in group.totals" :key="currency" class="whitespace-nowrap">
                {{ formatCurrency(amount, currency) }}
              </strong>
              <span v-if="!group.totals.length">—</span>
              <span class="whitespace-nowrap text-ink/65">
                <span aria-hidden="true">·</span>
                {{ text.dailyItemCount(group.itemCount, group.itemCountPartial) }}
              </span>
            </p>
          </div>
          <div class="space-y-3">
            <article
              v-for="order in group.orders"
              :key="order.orderId"
              class="rounded-[1.6rem] bg-surface p-4 shadow-sm"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="m-0 break-words text-sm font-bold">
                    {{ text.orderReference }} {{ order.orderNumber }}
                  </h3>
                  <p class="mb-0 mt-1 text-xs text-ink/60">
                    {{ order.groupName }} · {{ order.tableLabel }}
                    <time v-if="order.submittedAt" :datetime="order.submittedAt">
                      · {{ historyTimeFormat.format(new Date(order.submittedAt)) }}
                    </time>
                  </p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1">
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-bold"
                    :class="statusColors[order.status]"
                    aria-live="polite"
                  >
                    {{ text.orderStatuses[order.status] }}
                  </span>
                  <strong v-if="order.totalAmount !== undefined && order.currency" class="text-sm">
                    {{ formatCurrency(order.totalAmount, order.currency) }}
                  </strong>
                </div>
              </div>
              <p v-if="order.note" class="mb-0 mt-3 whitespace-pre-wrap break-words text-sm text-ink/70">
                <strong>{{ text.orderNote }}</strong> {{ order.note }}
              </p>
              <ul v-if="order.items?.length" class="mb-0 mt-3 list-none space-y-1 border-t border-ink/10 px-0 pt-3 text-sm">
                <li v-for="(item, index) in order.items" :key="index" class="flex items-baseline gap-2">
                  <span class="shrink-0 font-bold">{{ item.quantity }} ×</span>
                  <span class="min-w-0 break-words">
                    {{ store.nameFor(item) }}
                    <span v-if="item.portionName" class="text-ink/60">· {{ item.portionName }}</span>
                    <span v-if="item.modifiers?.length" class="mt-0.5 block text-xs leading-5 text-ink/60">
                      {{ item.modifiers.map((modifier) => store.labelFor(modifier)).join(", ") }}
                    </span>
                  </span>
                  <span
                    v-if="item.status"
                    class="ml-auto shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold"
                    :class="itemStatusColors[item.status]"
                    aria-live="polite"
                  >
                    {{ text.orderItemStatuses[item.status] }}
                  </span>
                </li>
              </ul>
            </article>
          </div>
        </section>
      </section>
      <p
        v-if="showHistory && statusRefreshFailed"
        class="mb-5 mt-0 text-xs text-ink/65"
        role="status"
      >
          {{ text.orderStatusRefreshFailed }}
      </p>
      <div v-if="showCurrent && store.cart.length" class="space-y-4">
        <div
          class="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="m-0 text-sm leading-5 text-ink/50">
            {{ text.expiresToday }}
          </p>
          <button
            type="button"
            class="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 sm:self-auto"
            :disabled="store.submittingOrder"
            @click="clearOrderDialog?.showModal()"
          >
            <Trash2 :size="16" />
            {{ text.clearOrder }}
          </button>
        </div>
        <article
          v-for="item in store.cart"
          :key="item.key"
          class="menu-product-card overflow-hidden rounded-[1.6rem] bg-surface p-3 shadow-[0_10px_34px_rgba(45,38,30,.07)] sm:p-4"
        >
          <div class="flex gap-3 sm:gap-4">
            <MenuImage
              :src="item.product.imageUrl"
              :fallback-src="store.data.business.menuTheme.productPlaceholderUrl"
              :alt="store.nameFor(item.product)"
              class="size-24 shrink-0 rounded-2xl bg-cream object-contain sm:size-28"
            >
              <template #fallback>
                <div
                  class="grid size-24 shrink-0 place-items-center rounded-2xl bg-cream text-ink/25 sm:size-28"
                  aria-hidden="true"
                >
                  <PackageOpen :size="28" />
                </div>
              </template>
            </MenuImage>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <h2 class="font-display m-0 text-lg font-extrabold leading-6">
                  {{ store.nameFor(item.product) }}
                </h2>
                <strong class="whitespace-nowrap text-tomato">
                  <PriceDisplay :amount="item.unitPrice * item.qty" />
                </strong>
              </div>
              <p
                v-if="item.portion"
                class="mb-0 mt-1 text-sm font-bold text-ink/45"
              >
                {{ store.labelFor(item.portion) }}
              </p>
              <p
                v-if="item.modifiers.length"
                class="mb-0 mt-1 text-xs leading-5 text-ink/40"
              >
                {{
                  item.modifiers
                    .map((modifier) => store.labelFor(modifier))
                    .join(", ")
                }}
              </p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <div class="flex items-center rounded-full bg-cream p-1">
                  <button
                    class="grid size-8 place-items-center rounded-full bg-surface"
                    :disabled="store.submittingOrder"
                    @click="store.setCartQuantity(item.key, item.qty - 1, true)"
                  >
                    <Minus :size="16" />
                  </button>
                  <span class="w-9 text-center font-extrabold">{{
                    item.qty
                  }}</span>
                  <button
                    class="grid size-8 place-items-center rounded-full bg-surface"
                    :disabled="store.submittingOrder"
                    @click="store.setCartQuantity(item.key, item.qty + 1, true)"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
                <button
                  class="rounded-full bg-cream px-3 py-2 text-xs font-bold"
                  :disabled="store.submittingOrder"
                  @click="editCartItem(item.key)"
                >
                  {{ text.edit }}
                </button>
                <button
                  class="rounded-full px-3 py-2 text-xs font-bold text-red-600"
                  :disabled="store.submittingOrder"
                  @click="store.removeCartItem(item.key)"
                >
                  {{ text.remove }}
                </button>
              </div>
            </div>
          </div>
          <div v-if="store.tableContext" class="mt-3">
            <p
              v-if="item.note?.trim()"
              class="mb-1 mt-0 whitespace-pre-wrap break-words text-sm text-ink/65"
            >
              {{ item.note }}
            </p>
            <button
              type="button"
              class="rounded-full bg-cream px-3 py-2 text-xs font-bold disabled:opacity-60"
              :disabled="store.submittingOrder"
              @click="openItemNote(item)"
            >
              {{ item.note?.trim() ? text.editNote : text.addNote }}
            </button>
          </div>
        </article>

        <div class="rounded-2xl bg-surface p-4 shadow-sm">
          <label for="order-note" class="block text-sm font-bold">
            {{ text.orderNoteOptional }}
          </label>
          <textarea
            id="order-note"
            :value="store.orderNote"
            :disabled="store.submittingOrder"
            class="mt-2 block w-full rounded-xl border border-ink/10 bg-cream p-3 text-sm text-ink disabled:opacity-60"
            rows="3"
            maxlength="500"
            @input="store.setOrderNote(($event.target as HTMLTextAreaElement).value)"
          />
        </div>
        <section ref="orderSummary" class="rounded-[1.6rem] bg-action p-5 text-on-action shadow-sm">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="m-0 text-sm text-on-action/55">
                {{ store.cartCount }} {{ text.item }}
              </p>
              <h2 class="font-display m-0 mt-1 text-xl font-extrabold">
                {{ text.total }}
              </h2>
            </div>
            <strong class="text-2xl text-on-action">
              <PriceDisplay :amount="store.cartTotal" inherit-color />
            </strong>
          </div>
          <button
            v-if="canSubmitOrder"
            type="button"
            class="mt-4 w-full rounded-full bg-surface px-4 py-3 font-bold text-ink disabled:opacity-60"
            :disabled="submitDisabled"
            @click="confirmOrder"
          >
            {{
              store.submittingOrder ? text.submittingOrder : text.submitOrder
            }}
          </button>
          <p
            v-if="!store.orderSubmissionEnabled"
            class="mb-0 mt-4 text-sm"
          >
            {{ text.orderingDisabled }}
          </p>
        </section>
      </div>

      <div
        v-if="showEmpty"
        class="rounded-[2rem] bg-surface px-6 py-20 text-center shadow-sm"
      >
        <ShoppingBag class="mx-auto mb-4 text-ink/20" :size="48" />
        <p class="m-0 text-base text-ink/50">
          {{ store.cart.length ? text.noRecentOrders : text.noOrder }}
        </p>
        <RouterLink
          :to="menuLink(`${basePath}/menu`)"
          class="mt-6 inline-flex rounded-full bg-action px-6 py-3 font-bold text-on-action"
        >
          {{ text.browseMenu }}
        </RouterLink>
      </div>
    </main>
    <TableQrScanner
      v-if="showTableScanner"
      :scan="connectScannedTable"
      @close="showTableScanner = false"
    />
    <button
      v-if="showCurrent && store.cart.length && canSubmitOrder && summaryOffscreen"
      type="button"
      class="menu-floating-bottom fixed right-4 z-30 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-action px-3 text-sm font-bold text-on-action shadow-xl disabled:opacity-60 sm:right-6"
      :aria-label="store.submittingOrder ? text.submittingOrder : undefined"
      :disabled="submitDisabled"
      @click="confirmOrder"
    >
      <Send :size="16" aria-hidden="true" />
      <span>{{ text.submitShort }}</span>
      <span class="border-l border-on-action/20 pl-2 tabular-nums">
        {{ formatCurrency(store.cartTotal, store.data.business.currency) }}
      </span>
    </button>
    <dialog
      ref="clearOrderDialog"
      class="m-auto w-11/12 max-w-sm rounded-[2rem] bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/60"
      aria-labelledby="clear-order-title"
      aria-describedby="clear-order-description"
    >
      <form method="dialog">
        <h2 id="clear-order-title" class="font-display m-0 text-xl font-extrabold">
          {{ text.clearOrder }}
        </h2>
        <p id="clear-order-description" class="mb-0 mt-2 text-sm text-ink/70">
          {{ text.clearOrderConfirm }}
        </p>
        <div class="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            autofocus
            class="min-h-11 flex-1 rounded-full bg-cream px-4 py-2 text-sm font-bold"
          >
            {{ text.cancelOrderSubmission }}
          </button>
          <button
            type="button"
            class="min-h-11 flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
            :disabled="store.submittingOrder"
            @click="clearOrder"
          >
            {{ text.clearOrder }}
          </button>
        </div>
      </form>
    </dialog>
    <dialog
      ref="noteDialog"
      class="m-auto w-11/12 max-w-sm rounded-[2rem] bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/60"
      aria-labelledby="item-note-title"
    >
      <form @submit.prevent="saveItemNote">
        <h2 id="item-note-title" class="font-display m-0 text-xl font-extrabold">
          {{ text.itemNote }}
        </h2>
        <textarea
          v-model="noteDraft"
          class="mt-4 block w-full rounded-xl border border-ink/10 bg-cream p-3 text-sm text-ink"
          aria-labelledby="item-note-title"
          rows="4"
          maxlength="500"
          autofocus
        />
        <div class="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-11 flex-1 rounded-full bg-cream px-4 py-2 text-sm font-bold"
            @click="noteDialog?.close()"
          >
            {{ text.cancelOrderSubmission }}
          </button>
          <button
            type="submit"
            class="min-h-11 flex-1 rounded-full bg-action px-4 py-2 text-sm font-bold text-on-action"
          >
            {{ text.saveChanges }}
          </button>
        </div>
      </form>
    </dialog>
    <dialog
      v-if="
        store.cart.length && store.tableContext && store.orderSubmissionEnabled
      "
      ref="confirmationDialog"
      class="m-auto w-11/12 max-w-sm rounded-[2rem] bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/60"
      aria-labelledby="order-confirmation-title"
    >
      <form method="dialog">
        <h2
          id="order-confirmation-title"
          class="font-display m-0 text-2xl font-extrabold"
        >
          {{ text.submitOrderConfirm }}
        </h2>
        <div class="mt-4 rounded-2xl bg-cream p-4">
          <TableContextLabel :table="store.tableContext" />
          <div
            class="mt-2 flex items-center justify-between gap-3 text-sm font-bold"
          >
            <span>{{ text.total }}</span>
            <PriceDisplay :amount="store.cartTotal" />
          </div>
          <p v-if="store.orderNote.trim()" class="mb-0 mt-3 whitespace-pre-wrap break-words text-sm text-ink/70">
            <strong>{{ text.orderNote }}</strong> {{ store.orderNote.trim() }}
          </p>
        </div>
        <div class="mt-6 flex flex-wrap gap-2">
          <button
            type="submit"
            autofocus
            class="min-h-11 flex-1 rounded-full bg-cream px-4 py-2 text-sm font-bold"
          >
            {{ text.cancelOrderSubmission }}
          </button>
          <button
            type="button"
            class="min-h-11 flex-1 rounded-full bg-action px-4 py-2 text-sm font-bold text-on-action"
            @click="submitConfirmedOrder"
          >
            {{ text.submitOrder }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import {
  CircleAlert,
  CircleCheck,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  TriangleAlert,
  PackageOpen,
  QrCode,
  X,
} from "lucide-vue-next";
import MenuImage from "../components/MenuImage.vue";
import PageHeader from "../components/PageHeader.vue";
import PriceDisplay from "../components/PriceDisplay.vue";
import TableContextLabel from "../components/TableContextLabel.vue";
import TableQrScanner from "../components/TableQrScanner.vue";
import { useProductDrawerNavigation } from "../composables/useProductDrawerNavigation";
import { useMenuStore, type CartItem } from "../stores/menu";
import { uiText } from "../uiText";
import { useMenuLink } from "../composables/useMenuLink";
import { formatCurrency } from "../utils/currency";
import { visitSpend } from "../utils/visitSpend";

const store = useMenuStore();
const menuLink = useMenuLink();
const { t } = useI18n();
const { editCartItem } = useProductDrawerNavigation();
const route = useRoute();
const router = useRouter();
const slug = computed(() => String(route.params.slug || ""));
const basePath = computed(() =>
  route.meta.customDomain || !slug.value ? "" : `/${slug.value}`,
);
const text = computed(() => uiText(store.selectedLanguage));
const historyClock = ref(Date.now());
const historyTimezone = computed(() => store.data.business.timezone || "Asia/Phnom_Penh");
const historyDates = computed(() => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: historyTimezone.value, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(historyClock.value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const previous = new Date(`${today}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return [today, previous.toISOString().slice(0, 10)];
});
const historyTimeFormat = computed(() => new Intl.DateTimeFormat(store.selectedLanguage, {
  timeStyle: "short",
  timeZone: historyTimezone.value,
}));
const historyGroups = computed(() => {
  const dateFormat = new Intl.DateTimeFormat(store.selectedLanguage, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  return historyDates.value.map((date, index) => {
    const orders = store.submittedOrders.filter((order) => order.postingDate === date).sort((a, b) =>
      (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "") ||
      b.orderNumber.localeCompare(a.orderNumber),
    );
    const countedOrders = orders.filter((order) => order.status !== "cancelled");
    const itemCount = countedOrders.reduce((count, order) => {
      const orderQuantity = order.items?.reduce((quantity, item) => quantity + item.quantity, 0) ?? 0;
      return count + orderQuantity;
    }, 0);
    return {
      date,
      dateLabel: dateFormat.format(new Date(`${date}T00:00:00Z`)),
      label: index === 0 ? text.value.today : text.value.yesterday,
      orders,
      itemCount,
      itemCountPartial: countedOrders.some((order) => !order.items?.length),
      totals: Array.from(visitSpend(orders), ([currency, total]) => ({ currency, amount: total.estimated })),
      partial: countedOrders.some((order) =>
        order.totalAmount === undefined || !order.currency,
      ),
    };
  }).filter((group) => group.orders.length);
});
const selectedTab = ref<"current" | "history" | null>(null);
const activeTab = computed(() =>
  selectedTab.value ?? (!store.cart.length && historyGroups.value.length ? "history" : "current"),
);
const showCurrent = computed(() => !store.orderSubmissionEnabled || activeTab.value === "current");
const showHistory = computed(() => !store.orderSubmissionEnabled || activeTab.value === "history");
const showEmpty = computed(() =>
  showCurrent.value
    ? !store.cart.length && (store.orderSubmissionEnabled || !historyGroups.value.length)
    : !historyGroups.value.length,
);
const canSubmitOrder = computed(() => Boolean(store.tableContext && store.orderSubmissionEnabled));
const outsideOrderRadius = computed(() => store.orderLocationStatus === "outside");
const submitDisabled = computed(() =>
  store.submittingOrder || store.orderLocationStatus === "checking" || outsideOrderRadius.value,
);
const orderSummary = ref<HTMLElement | null>(null);
const summaryOffscreen = ref(false);
const orderPageActive = ref(false);

watch([orderSummary, orderPageActive], ([summary, active], _, onCleanup) => {
  summaryOffscreen.value = false;
  if (!summary || !active) return;

  const dock = summary.closest(".menu-theme")?.querySelector(".menu-bottom-dock");
  let observer: IntersectionObserver | undefined;
  const observeSummary = () => {
    observer?.disconnect();
    const dockHeight = Math.ceil(dock?.getBoundingClientRect().height ?? 0);
    observer = new IntersectionObserver(([entry]) => {
      summaryOffscreen.value = !entry.isIntersecting;
    }, { rootMargin: `0px 0px -${dockHeight}px 0px` });
    observer.observe(summary);
  };
  const dockResize = new ResizeObserver(observeSummary);
  if (dock) dockResize.observe(dock);
  observeSummary();
  onCleanup(() => {
    observer?.disconnect();
    dockResize.disconnect();
  });
}, { flush: "post" });

const confirmationDialog = ref<HTMLDialogElement | null>(null);
const showTableScanner = ref(false);
const clearOrderDialog = ref<HTMLDialogElement | null>(null);
const noteDialog = ref<HTMLDialogElement | null>(null);
const noteItemKey = ref("");
const noteDraft = ref("");
const statusRefreshFailed = ref(false);
const orderToastDurationSeconds = 7;
type OrderToastKind = "success" | "error" | "warning";
const orderToast = ref<{ message: string; kind: OrderToastKind } | null>(null);
const toastSeconds = ref(orderToastDurationSeconds);
const statusColors = {
  submitted: "bg-amber-100 text-amber-900",
  accepted: "bg-sky-100 text-sky-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
};
const itemStatusColors = {
  submitted: "bg-ink/5 text-ink/70",
  confirmed: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
};
let statusTimer = 0;
let statusRequest: AbortController | undefined;
let orderToastTimer = 0;

function dismissOrderToast() {
  window.clearInterval(orderToastTimer);
  orderToast.value = null;
}

function showOrderToast(message: string, kind: OrderToastKind = "error") {
  dismissOrderToast();
  orderToast.value = { message, kind };
  toastSeconds.value = orderToastDurationSeconds;
  const expiresAt = Date.now() + orderToastDurationSeconds * 1000;
  orderToastTimer = window.setInterval(() => {
    toastSeconds.value = Math.ceil((expiresAt - Date.now()) / 1000);
    if (toastSeconds.value <= 0) dismissOrderToast();
  }, 250);
}

async function refreshStatuses() {
  if (document.hidden || statusRequest) return;
  historyClock.value = Date.now();
  const request = new AbortController();
  statusRequest = request;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]);
  try {
    const refreshed = await store.refreshSubmittedOrders(signal, historyDates.value);
    if (!request.signal.aborted) statusRefreshFailed.value = !refreshed || signal.aborted;
  } catch {
    if (!request.signal.aborted) statusRefreshFailed.value = true;
  } finally {
    if (statusRequest === request) statusRequest = undefined;
  }
}

onActivated(() => {
  orderPageActive.value = true;
  selectedTab.value = null;
  void refreshStatuses();
  statusTimer = window.setInterval(refreshStatuses, 10_000);
  document.addEventListener("visibilitychange", refreshStatuses);
});
onDeactivated(() => {
  orderPageActive.value = false;
  showTableScanner.value = false;
  dismissOrderToast();
  confirmationDialog.value?.close();
  clearOrderDialog.value?.close();
  noteDialog.value?.close();
  window.clearInterval(statusTimer);
  document.removeEventListener("visibilitychange", refreshStatuses);
  statusRequest?.abort();
  statusRequest = undefined;
});
const locationMessage = computed(() => {
  if (!store.orderSubmissionEnabled) return "";
  switch (store.orderLocationStatus) {
    case "checking":
      return text.value.checkingOrderLocation;
    case "outside":
      return text.value.outsideOrderRadius;
    default:
      return "";
  }
});
const orderFailureMessage = computed(() => {
  switch (store.orderError) {
    case "menu_changed":
      return text.value.orderMenuChanged;
    case "cart_prices_updated":
      return text.value.cartPricesUpdated;
    case "cart_items_unavailable":
      return text.value.cartItemsUnavailable;
    case "menu_unavailable":
      return text.value.orderMenuUnavailable;
    case "table_unavailable":
      return text.value.orderTableRequired;
    case "ordering_disabled":
      return text.value.orderingDisabled;
    case "ordering_settings_changed":
      return text.value.orderingSettingsChanged;
    case "order_limit_reached":
      return text.value.orderLimitReached;
    case "device_order_limit_reached":
      return text.value.deviceOrderLimitReached;
    case "invalid_order":
      return text.value.invalidOrder;
    case "location_unavailable":
      return text.value.orderLocationUnavailable;
    default:
      if (outsideOrderRadius.value) return text.value.outsideOrderRadius;
      if (store.orderLocationStatus === "blocked") return text.value.locationSettingsDescription;
      return text.value.orderFailed;
  }
});

function clearOrder() {
  if (!clearOrderDialog.value?.open) return;
  clearOrderDialog.value.close();
  if (store.cart.length) store.clearCart();
}

async function connectScannedTable(value: string, signal: AbortSignal) {
  const orderPath = route.fullPath;
  const scanned = await store.validateTableScan(value, signal);
  if (!scanned || signal.aborted || route.fullPath !== orderPath) return false;

  store.moveDraftToTable(scanned.token);
  if (route.query.table === scanned.token && route.query.table_id === scanned.tableId) {
    void store.load(slug.value, scanned.token, {
      force: true,
      hostname: window.location.hostname,
      tableId: scanned.tableId,
      branch: store.currentBranchSlug,
      menu: store.currentMenuSlug,
    });
  } else {
    const failure = await router.replace({
      path: route.path,
      query: { ...route.query, table: scanned.token, table_id: scanned.tableId },
    });
    if (failure) throw new Error("Table navigation failed");
  }
  return true;
}

function openItemNote(item: CartItem) {
  noteItemKey.value = item.key;
  noteDraft.value = item.note ?? "";
  noteDialog.value?.showModal();
}

function saveItemNote() {
  if (!noteDialog.value?.open) return;
  store.setCartNote(noteItemKey.value, noteDraft.value.trim());
  noteDialog.value.close();
}

async function confirmOrder() {
  const orderPath = route.fullPath;
  if (store.orderLocationStatus !== "inside")
    await store.requestOrderLocation(true);
  if (route.fullPath !== orderPath) return;
  if (store.orderLocationStatus === "inside") {
    confirmationDialog.value?.showModal();
  } else if (store.orderError === "location_unavailable") {
    showOrderToast(text.value.orderLocationUnavailable);
  }
}

async function submitConfirmedOrder() {
  if (!confirmationDialog.value?.open) return;
  const orderPath = route.fullPath;
  confirmationDialog.value.close();
  dismissOrderToast();
  const received = await store.submitOrder();
  if (received === undefined || route.fullPath !== orderPath) return;
  if (received) {
    selectedTab.value = null;
    showOrderToast(text.value.orderSubmitted, "success");
  } else {
    const orderUpdated = store.orderError === "cart_prices_updated" || store.orderError === "cart_items_unavailable";
    showOrderToast(orderFailureMessage.value, outsideOrderRadius.value || orderUpdated ? "warning" : "error");
  }
}
</script>
