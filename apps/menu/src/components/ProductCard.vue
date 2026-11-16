<template>
  <article
    class="menu-product-card bg-surface shadow-[0_10px_34px_rgba(45,38,30,.07)]"
    :class="
      viewMode === 'list'
        ? [
            'flex overflow-hidden rounded-[1.35rem]',
            hasDescription ? 'min-h-[142px]' : 'min-h-[112px]',
          ]
        : 'overflow-hidden rounded-[1.6rem]'
    "
  >
    <div
      class="relative isolate block shrink-0 overflow-hidden text-left"
      :class="
        viewMode === 'list'
          ? hasDescription
            ? 'w-32 sm:w-44'
            : 'w-28 sm:w-32'
          : 'w-full'
      "
    >
      <button
        type="button"
        class="absolute inset-0 z-10 cursor-pointer focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-tomato"
        :aria-label="t('product.viewDetails', { name: store.nameFor(product) })"
        @click="openProduct(product)"
      ></button>
      <MenuImage
        :src="product.imageUrl"
        :fallback-src="store.data.business.menuTheme.productPlaceholderUrl"
        alt=""
        loading="lazy"
        decoding="async"
        class="menu-product-image w-full bg-cream object-contain"
        :class="
          viewMode === 'list'
            ? hasDescription
              ? 'h-full min-h-[142px]'
              : 'h-full min-h-[112px]'
            : 'h-44 sm:h-52'
        "
      >
        <template #fallback>
          <span
            class="menu-product-image grid w-full place-items-center bg-cream text-ink/25"
            aria-hidden="true"
            :class="
              viewMode === 'list'
                ? hasDescription
                  ? 'h-full min-h-[142px]'
                  : 'h-full min-h-[112px]'
                : 'h-44 sm:h-52'
            "
          >
            <PackageOpen :size="viewMode === 'list' ? 26 : 34" />
          </span>
        </template>
      </MenuImage>
      <span
        v-if="product.isFeatured"
        class="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-surface/90 px-2.5 py-1.5 text-[11px] font-extrabold backdrop-blur sm:left-3 sm:top-3"
        >{{ t("menu.guestFavourite") }}</span
      >
      <button
        class="absolute right-2 top-2 z-20 grid size-10 place-items-center rounded-full bg-surface/90 sm:right-3 sm:top-3"
        :class="store.isFavourite(product.id) ? 'text-tomato' : 'text-ink'"
        :aria-label="t('menu.saveItem')"
        :aria-pressed="store.isFavourite(product.id)"
        @click="store.toggleFavourite(product.id)"
      >
        <Heart
          :size="18"
          :fill="store.isFavourite(product.id) ? 'currentColor' : 'none'"
        />
      </button>
    </div>
    <div
      class="flex min-w-0 flex-1 flex-col"
      :class="
        viewMode === 'list'
          ? hasDescription
            ? 'p-3 sm:p-4'
            : 'p-3'
          : hasDescription
            ? 'p-4'
            : 'p-3'
      "
    >
      <div
        class="mb-2"
        :class="
          viewMode === 'list'
            ? 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3'
            : 'flex flex-col items-start justify-between gap-1 sm:flex-row sm:gap-3'
        "
      >
        <div class="min-w-0">
          <p
            v-if="showItemCode"
            class="menu-item-code mb-1 mt-0 truncate font-extrabold uppercase tracking-[.1em]"
          >
            {{ product.code }}
          </p>
          <h3
            class="menu-item-title font-display m-0 min-w-0 font-extrabold leading-6"
            :class="viewMode === 'list' ? 'whitespace-normal break-words' : ''"
          >
            {{ store.nameFor(product) }}
          </h3>
        </div>
        <strong
          class="whitespace-nowrap text-base text-tomato sm:text-lg"
          :class="viewMode === 'list' ? 'shrink-0 text-right' : ''"
        >
          <PriceDisplay
            :amount="displayPrice"
            :prefix="product.portions?.length ? t('product.from') : ''"
            :unit="product.unit"
          />
        </strong>
      </div>
      <p
        v-if="hasDescription"
        class="menu-item-description clamp-2 mt-0 leading-5 sm:leading-6"
        :class="viewMode === 'list' ? 'mb-2' : 'mb-4 min-h-10'"
      >
        {{ product.description }}
      </p>
      <div class="mt-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2">
        <div v-if="cartQuantity > 0" class="flex items-center gap-1 sm:gap-2">
          <button
            v-if="store.orderingEnabled"
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-ink transition hover:bg-action hover:text-on-action active:scale-90 sm:size-12"
            :aria-label="t('order.decreaseQuantity', { name: store.nameFor(product) })"
            :disabled="store.submittingOrder"
            @click="decreaseFromCard"
          >
            <Minus :size="21" />
          </button>
          <span
            class="min-w-6 whitespace-nowrap rounded-full bg-tomato px-1.5 py-1 text-center text-xs font-extrabold tabular-nums text-on-primary sm:px-2.5"
          >
            <span aria-hidden="true" class="sm:hidden">{{ cartQuantity }}</span>
            <span class="sr-only sm:not-sr-only">{{
              t("order.quantity", { count: cartQuantity })
            }}</span>
          </span>
        </div>
        <button
          v-if="store.orderingEnabled"
          class="grid shrink-0 place-items-center rounded-full bg-action text-on-action transition hover:bg-tomato hover:text-on-primary active:scale-90 sm:size-12"
          :class="[
            cartQuantity > 0 ? 'size-9' : 'size-11',
            buttonAnimating ? 'add-button-pop !bg-tomato' : '',
          ]"
          :aria-label="t('menu.addToCart')"
          :disabled="store.submittingOrder"
          @click="addFromCard"
        >
          <Check v-if="buttonAnimating && addsDirectly" :size="21" />
          <Plus v-else :size="21" />
        </button>
      </div>
    </div>
    <CartQuantityDialog
      v-if="cartDialogMode"
      :mode="cartDialogMode"
      :product-name="store.nameFor(product)"
      :items="cartItems"
      @close="cartDialogMode = null"
      @add-new="openProduct(product)"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Check, Heart, Minus, PackageOpen, Plus } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import CartQuantityDialog from "./CartQuantityDialog.vue";
import MenuImage from "./MenuImage.vue";
import PriceDisplay from "./PriceDisplay.vue";
import { useProductDrawerNavigation } from "../composables/useProductDrawerNavigation";
import { useMenuStore } from "../stores/menu";

const props = withDefaults(
  defineProps<{
    product: any;
    viewMode?: "grid" | "list";
  }>(),
  { viewMode: "grid" },
);

const store = useMenuStore();
const { openProduct } = useProductDrawerNavigation();
const { t } = useI18n();
const buttonAnimating = ref(false);
const cartDialogMode = ref<"add" | "reduce" | null>(null);
const cartItems = computed(() =>
  store.cart.filter((item) => item.product.id === props.product.id),
);
const cartQuantity = computed(
  () => store.cartQuantityByProduct.get(props.product.id) ?? 0,
);
const addsDirectly = computed(
  () =>
    !props.product.portions?.length && !props.product.modifierGroups?.length,
);
let animationTimer = 0;
const hasDescription = computed(() =>
  Boolean(props.product.description?.trim()),
);
const showItemCode = computed(
  () =>
    store.data.business.menuTheme.showItemCode &&
    Boolean(props.product.code?.trim()),
);
const displayPrice = computed(() =>
  props.product.portions?.length
    ? Math.min(
        ...props.product.portions.map(
          (portion: { priceCents: number }) => portion.priceCents,
        ),
      )
    : props.product.priceCents,
);
function decreaseFromCard() {
  if (cartItems.value.length > 1) {
    cartDialogMode.value = "reduce";
    return;
  }
  const item = cartItems.value[0];
  if (item) store.decreaseCartItemQuantity(item.key);
}

function addFromCard() {
  if (!addsDirectly.value && cartQuantity.value > 0) {
    cartDialogMode.value = "add";
    return;
  }
  window.clearTimeout(animationTimer);
  buttonAnimating.value = false;
  requestAnimationFrame(() => {
    buttonAnimating.value = true;
    animationTimer = window.setTimeout(() => {
      buttonAnimating.value = false;
    }, 480);
  });
  if (addsDirectly.value) store.selectOrAdd(props.product);
  else void openProduct(props.product);
}

onBeforeUnmount(() => window.clearTimeout(animationTimer));
</script>

<style scoped>
.add-button-pop {
  animation: add-button-pop 480ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes add-button-pop {
  0% {
    transform: scale(1);
  }
  38% {
    transform: scale(1.24) rotate(8deg);
  }
  68% {
    transform: scale(0.92) rotate(-3deg);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .add-button-pop {
    animation: none;
  }
}
</style>
