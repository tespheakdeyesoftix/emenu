<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="store.selected"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-5"
        @click.self="closeProduct"
      >
        <article
          class="max-h-[94vh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-[2rem] bg-cream sm:grid sm:grid-cols-2 sm:rounded-[2rem]"
        >
          <div class="pointer-events-none sticky top-0 z-10 h-0 sm:col-span-2 sm:w-1/2">
            <button
              class="pointer-events-auto absolute left-4 top-4 grid size-10 place-items-center rounded-full bg-surface"
              :aria-label="t('common.close')"
              @click="closeProduct"
            >
              <X :size="18" />
            </button>
            <button
              class="pointer-events-auto absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-surface shadow-sm transition active:scale-90"
              :class="
                store.isFavourite(store.selected.id)
                  ? 'text-tomato'
                  : 'text-ink'
              "
              :aria-label="t('menu.saveItem')"
              :aria-pressed="store.isFavourite(store.selected.id)"
              @click="store.toggleFavourite(store.selected.id)"
            >
              <Heart
                :size="19"
                :fill="
                  store.isFavourite(store.selected.id) ? 'currentColor' : 'none'
                "
              />
            </button>
          </div>
          <div class="relative min-h-72 sm:min-h-[560px]">
            <MenuImage
              :src="store.selected.imageUrl"
              :fallback-src="store.data.business.menuTheme.productPlaceholderUrl"
              alt=""
              class="absolute inset-0 size-full object-contain"
            >
              <template #fallback>
                <div
                  class="absolute inset-0 grid place-items-center bg-cream text-ink/25"
                  aria-hidden="true"
                >
                  <PackageOpen :size="54" />
                </div>
              </template>
            </MenuImage>
            <span
              v-if="selectedRating != null"
              class="absolute bottom-4 left-4 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-bold"
            >
              {{
                t("product.guestRating", {
                  rating: formattedRating,
                })
              }}
            </span>
          </div>

          <div class="flex flex-col p-6 sm:p-8">
            <p
              v-if="store.selected.isFeatured"
              class="m-0 text-xs font-bold uppercase tracking-[.18em] text-tomato"
            >
              {{ t("product.signature") }}
            </p>
            <p
              v-if="showItemCode"
              class="menu-item-code menu-item-code--detail mb-1 mt-2 font-extrabold uppercase tracking-[.12em]"
            >
              {{ store.selected.code }}
            </p>
            <h2
              class="menu-item-title menu-item-title--detail font-display mb-2 font-extrabold leading-tight"
              :class="store.selected.isFeatured ? 'mt-2' : 'mt-0'"
            >
              {{ store.nameFor(store.selected) }}
            </h2>
            <p
              v-if="store.orderingEnabled"
              class="mb-2 mt-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-ink/65"
            >
              <span>{{ t("product.unitPrice") }}</span>
              <PriceDisplay :amount="unitPrice" :unit="store.selected.unit" layout="inline" />
            </p>
            <p
              v-if="cartQuantity > 0 && !quantityCartItem"
              class="mb-2 mt-0 text-sm font-bold text-tomato"
            >
              {{ t("order.inOrderQuantity", { count: cartQuantity }) }}
            </p>
            <section
              v-if="!store.orderingEnabled"
              class="mb-2 mt-3 rounded-2xl border border-ink/[.07] bg-surface p-4 shadow-sm sm:p-5"
            >
              <span
                class="mb-2 block text-[11px] font-extrabold uppercase tracking-[.14em] text-ink/35"
              >
                {{ t("product.price") }}
              </span>
              <PriceDisplay
                :amount="unitPrice"
                :unit="store.selected.unit"
                align="start"
                layout="inline"
              />
            </section>
            <div class="flex gap-4 text-xs font-bold text-ink/40">
              <span v-if="store.selected.prepMinutes">
                <Clock :size="14" class="mr-1 inline" />
                {{
                  t("product.minutes", { count: store.selected.prepMinutes })
                }}
              </span>
              <span v-if="store.selected.calories">
                <Flame :size="14" class="mr-1 inline" />
                {{ t("product.calories", { count: store.selected.calories }) }}
              </span>
            </div>
            <p
              v-if="store.selected.description"
              class="menu-item-description my-6 leading-6"
            >
              {{ store.selected.description }}
            </p>

            <section
              v-if="store.selected.portions?.length"
              class="mb-4 rounded-2xl bg-surface p-4"
            >
              <p
                class="m-0 text-xs font-bold uppercase tracking-[.14em] text-ink/35"
              >
                {{ t("product.choosePortion") }}
              </p>
              <label
                v-for="portion in store.selected.portions"
                :key="portion.id"
                class="mt-3 flex cursor-pointer items-center gap-3 text-sm font-bold"
              >
                <input
                  v-model="selectedPortionId"
                  type="radio"
                  name="product-portion"
                  :value="portion.id"
                  class="size-4 accent-black"
                />
                <span>{{ store.labelFor(portion) }}</span>
                <span class="ml-auto text-ink/45">
                  <PriceDisplay :amount="portion.priceCents" />
                </span>
              </label>
            </section>

            <section
              v-for="group in store.selected.modifierGroups || []"
              :key="group.id"
              class="mb-4 rounded-2xl bg-surface p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <p
                  class="m-0 text-xs font-bold uppercase tracking-[.14em] text-ink/45"
                >
                  {{ store.labelFor(group) }}
                </p>
                <span
                  v-if="group.required"
                  class="rounded-full bg-tomato/10 px-2 py-1 text-[10px] font-bold text-tomato"
                >
                  {{ t("product.required") }}
                </span>
              </div>
              <p class="mb-0 mt-1 text-[11px] text-ink/35">
                {{
                  group.multiple
                    ? t("product.chooseMultiple")
                    : t("product.chooseOne")
                }}
              </p>
              <label
                v-for="option in group.options"
                :key="option.id"
                class="mt-3 flex cursor-pointer items-center gap-3 text-sm font-bold"
              >
                <input
                  :type="group.multiple ? 'checkbox' : 'radio'"
                  :name="`modifier-${group.id}`"
                  :checked="isModifierSelected(group.id, option.id)"
                  class="size-4 accent-black"
                  @change="toggleModifier(group, option.id, $event)"
                />
                <span>{{ store.labelFor(option) }}</span>
                <span
                  v-if="Number(option.priceCents || 0) !== 0"
                  class="ml-auto text-ink/45"
                >
                  <PriceDisplay
                    :amount="Number(option.priceCents)"
                    :prefix="Number(option.priceCents) > 0 ? '+' : ''"
                  />
                </span>
              </label>
            </section>

            <p
              v-if="selectionError"
              class="mb-0 mt-1 text-xs font-bold text-red-600"
            >
              {{ t("product.requiredError") }}
            </p>

            <div
              v-if="store.orderingEnabled"
              class="sticky bottom-0 mt-auto flex flex-wrap items-center gap-3 bg-cream pt-4"
            >
              <p
                v-if="cartQuantity > 0 && !quantityCartItem && !store.editingCartKey"
                class="m-0 basis-full text-xs font-bold text-ink/65"
              >
                {{ t("order.quantityToAdd") }}
              </p>
              <div class="flex shrink-0 items-center rounded-full border border-ink/10 bg-surface">
                <button
                  type="button"
                  class="grid size-11 place-items-center rounded-full transition hover:bg-cream disabled:opacity-40"
                  :aria-label="t('order.decreaseQuantity', { name: store.nameFor(store.selected) })"
                  :disabled="quantity <= (quantityCartItem ? 0 : 1)"
                  @click="quantity -= 1"
                >
                  <Minus :size="18" aria-hidden="true" />
                </button>
                <output class="min-w-6 text-center text-sm font-extrabold tabular-nums">
                  <span class="sr-only">{{ t('order.quantity', { count: quantity }) }}</span>
                  <span aria-hidden="true">{{ quantity }}</span>
                </output>
                <button
                  type="button"
                  class="grid size-11 place-items-center rounded-full transition hover:bg-cream"
                  :aria-label="t('order.increaseQuantity', { name: store.nameFor(store.selected) })"
                  @click="quantity += 1"
                >
                  <Plus :size="18" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                class="flex min-w-fit flex-1 items-center justify-between gap-3 rounded-full bg-tomato px-4 py-4 font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
                :disabled="store.submittingOrder"
                @click="addSelection"
              >
                <span>{{
                  quantity === 0
                    ? text.remove
                    : quantityCartItem || store.editingCartKey
                      ? text.saveChanges
                      : t("order.add")
                }}</span>
                <span v-if="quantity > 0">
                  <PriceDisplay
                    :amount="unitPrice * quantity"
                    :unit="quantity === 1 ? store.selected.unit : undefined"
                    inherit-color
                  />
                </span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Clock, Flame, Heart, Minus, PackageOpen, Plus, X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import MenuImage from "./MenuImage.vue";
import PriceDisplay from "./PriceDisplay.vue";
import { useProductDrawerNavigation } from "../composables/useProductDrawerNavigation";
import {
  useMenuStore,
  type ProductModifierGroup,
  type ProductModifierOption,
} from "../stores/menu";
import { uiText } from "../uiText";

const store = useMenuStore();
const { closeProduct } = useProductDrawerNavigation();
const { t } = useI18n();
const text = computed(() => uiText(store.selectedLanguage));
const selectedPortionId = ref("");
const quantity = ref(1);
const selectedModifierIds = reactive<Record<string, string[]>>({});
const selectionError = ref(false);
const cartQuantity = computed(() =>
  store.selected ? store.cartQuantityByProduct.get(store.selected.id) ?? 0 : 0,
);
const quantityCartItem = computed(() => {
  const product = store.selected;
  if (
    !product ||
    store.editingCartKey ||
    product.portions?.length ||
    product.modifierGroups?.length
  ) return null;

  const items = store.cart.filter((item) => item.product.id === product.id);
  const item = items[0];
  return items.length === 1 && !item.portion && !item.modifiers.length ? item : null;
});
const showItemCode = computed(
  () =>
    store.data.business.menuTheme.showItemCode &&
    Boolean(store.selected?.code?.trim()),
);
const selectedRating = computed(() => {
  const value = store.selected?.rating;
  if (value == null || String(value).trim() === "") return null;
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null;
});
const formattedRating = computed(() =>
  selectedRating.value == null
    ? ""
    : new Intl.NumberFormat(
        store.selectedLanguage === "km"
          ? "km-KH"
          : store.selectedLanguage === "zh"
            ? "zh-CN"
            : "en",
        {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        },
      ).format(selectedRating.value),
);

watch(
  [() => store.selected, () => store.editingCartKey, () => quantityCartItem.value?.qty],
  ([product]) => {
    const editing = store.editingItem;
    quantity.value = editing?.qty ?? quantityCartItem.value?.qty ?? 1;
    selectedPortionId.value =
      editing?.portion?.id || product?.portions?.[0]?.id || "";
    Object.keys(selectedModifierIds).forEach(
      (key) => delete selectedModifierIds[key],
    );
    product?.modifierGroups?.forEach((group) => {
      selectedModifierIds[group.id] =
        editing?.modifiers
          .filter((modifier) =>
            group.options.some((option) => option.id === modifier.id),
          )
          .map((modifier) => modifier.id) || [];
    });
    selectionError.value = false;
  },
  { immediate: true },
);

const selectedPortion = computed(() =>
  store.selected?.portions?.find(
    (portion) => portion.id === selectedPortionId.value,
  ),
);

const selectedModifiers = computed(() => {
  if (!store.selected) return [];
  return (
    store.selected.modifierGroups?.flatMap((group) =>
      group.options.filter((option) =>
        selectedModifierIds[group.id]?.includes(option.id),
      ),
    ) || []
  );
});

const unitPrice = computed(
  () =>
    (selectedPortion.value?.priceCents ?? store.selected?.priceCents ?? 0) +
    selectedModifiers.value.reduce(
      (total, option) => total + Number(option.priceCents || 0),
      0,
    ),
);

const requiredGroupsComplete = computed(() =>
  (store.selected?.modifierGroups || []).every(
    (group) =>
      !group.required || Boolean(selectedModifierIds[group.id]?.length),
  ),
);

function isModifierSelected(groupId: string, optionId: string) {
  return selectedModifierIds[groupId]?.includes(optionId) || false;
}

function toggleModifier(
  group: ProductModifierGroup,
  optionId: string,
  event: Event,
) {
  const checked = (event.target as HTMLInputElement).checked;
  const current = selectedModifierIds[group.id] || [];
  if (!group.multiple) {
    selectedModifierIds[group.id] = checked ? [optionId] : [];
  } else if (checked) {
    selectedModifierIds[group.id] = [...current, optionId];
  } else {
    selectedModifierIds[group.id] = current.filter((id) => id !== optionId);
  }
  selectionError.value = false;
}

function addSelection() {
  if (!store.orderingEnabled || store.submittingOrder) return;
  if (!store.selected || !requiredGroupsComplete.value) {
    selectionError.value = true;
    return;
  }
  if (quantityCartItem.value) {
    const { key, product } = quantityCartItem.value;
    if (quantity.value === 0) store.removeCartItem(key);
    else if (store.setCartQuantity(key, quantity.value)) {
      store.showCartQuantityToast(product);
    }
    closeProduct();
    return;
  }
  store.add(store.selected, {
    portion: selectedPortion.value,
    modifiers: selectedModifiers.value as ProductModifierOption[],
    quantity: quantity.value,
  });
  closeProduct();
}
</script>
