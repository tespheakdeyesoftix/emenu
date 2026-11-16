<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[85dvh] w-11/12 max-w-sm overflow-y-auto rounded-[1.6rem] bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    :aria-label="title"
    @click.self="dialog?.close()"
    @close="emit('close')"
  >
    <section class="p-5">
      <header class="mb-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="font-display m-0 text-lg font-extrabold">
            {{ title }}
          </h2>
          <p class="mb-0 mt-1 break-words text-sm font-bold text-ink/60">
            {{ productName }}
          </p>
        </div>
        <button
          type="button"
          autofocus
          class="grid size-10 shrink-0 place-items-center rounded-full bg-cream"
          :aria-label="t('common.close')"
          @click="dialog?.close()"
        >
          <X :size="18" />
        </button>
      </header>
      <ul class="m-0 list-none space-y-2 p-0">
        <li v-for="item in items" :key="item.key">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left transition hover:bg-ink/10 disabled:opacity-50"
            :disabled="store.submittingOrder"
            @click="changeQuantity(item)"
          >
            <component
              :is="isAdding ? Plus : Minus"
              :size="18"
              class="shrink-0"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 break-words text-sm font-bold">
              {{ itemLabel(item) }}
              <span
                v-if="item.note"
                class="mt-1 block text-xs font-medium text-ink/60"
              >
                {{ item.note }}
              </span>
            </span>
            <span class="shrink-0 text-xs font-extrabold tabular-nums">
              {{ t("order.quantity", { count: item.qty }) }}
            </span>
          </button>
        </li>
      </ul>
      <button
        v-if="isAdding"
        type="button"
        class="mt-4 w-full rounded-full bg-action px-4 py-3 text-sm font-extrabold text-on-action disabled:opacity-50"
        :disabled="store.submittingOrder"
        @click="addNew"
      >
        {{ t("order.chooseNewCombination") }}
      </button>
    </section>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onDeactivated, onMounted, ref, watch } from "vue";
import { Minus, Plus, X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useMenuStore, type CartItem } from "../stores/menu";

const props = defineProps<{
  mode: "add" | "reduce";
  productName: string;
  items: CartItem[];
}>();
const emit = defineEmits<{ close: []; addNew: [] }>();
const { t } = useI18n();
const store = useMenuStore();
const dialog = ref<HTMLDialogElement | null>(null);
const isAdding = computed(() => props.mode === "add");
const title = computed(() =>
  t(isAdding.value ? "order.chooseItemToAdd" : "order.chooseItemToReduce"),
);

function itemLabel(item: CartItem) {
  const labels = item.modifiers.map((modifier) => store.labelFor(modifier));
  if (item.portion) labels.unshift(store.labelFor(item.portion));
  return labels.join(" · ") || t("order.noOptions");
}

function changeQuantity(item: CartItem) {
  if (isAdding.value) store.setCartQuantity(item.key, item.qty + 1, true);
  else store.decreaseCartItemQuantity(item.key);
  dialog.value?.close();
}

function addNew() {
  dialog.value?.close();
  emit("addNew");
}

onMounted(() => dialog.value?.showModal());
onDeactivated(() => dialog.value?.close());
watch(
  () => props.items.length,
  (count) => {
    if (count === 0) dialog.value?.close();
  },
);
</script>
