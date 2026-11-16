<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="banner"
        class="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-5"
        role="presentation"
        @click.self="$emit('close')"
      >
        <section
          role="dialog"
          aria-modal="true"
          :aria-label="t('banner.detailsFor', { title: banner.title })"
          class="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-surface shadow-2xl sm:max-w-2xl sm:rounded-[2rem]"
        >
          <div
            class="relative aspect-[2/1] overflow-hidden bg-cream sm:aspect-[2.4/1]"
          >
            <MenuImage
              :src="banner.imageUrl"
              :alt="banner.title"
              class="size-full object-cover"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"
            ></div>
            <button
              ref="closeButton"
              type="button"
              class="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-surface/95 text-ink shadow-lg"
              :aria-label="t('common.close')"
              @click="$emit('close')"
            >
              <X :size="19" />
            </button>
          </div>

          <div class="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
            <h2 class="font-display m-0 text-3xl font-extrabold leading-tight">
              {{ banner.title }}
            </h2>
            <p
              v-if="banner.subtitle"
              class="mb-0 mt-2 text-base leading-6 text-ink/55"
            >
              {{ banner.subtitle }}
            </p>
            <p
              class="mb-0 mt-6 whitespace-pre-line text-sm leading-7 text-ink/70 sm:text-base"
            >
              {{ banner.detailText }}
            </p>
            <a
              v-if="banner.ctaUrl"
              :href="banner.ctaUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-7 inline-flex items-center gap-2 rounded-full bg-action px-5 py-3 text-sm font-extrabold text-on-action"
              @click="trackCta"
            >
              {{ banner.ctaLabel || t("banner.learnMore") }}
              <ExternalLink :size="16" />
            </a>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ExternalLink, X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import type { MenuBanner } from "../stores/menu";
import { trackAnalytics } from "../analytics";
import MenuImage from "./MenuImage.vue";

const props = defineProps<{ banner: MenuBanner | null }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const closeButton = ref<HTMLButtonElement | null>(null);
let previousBodyOverflow = "";
let previousActiveElement: HTMLElement | null = null;
let ownsScrollLock = false;

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}

function trackCta() {
  if (props.banner)
    trackAnalytics("banner_cta_click", { bannerId: props.banner.id });
}

watch(
  () => Boolean(props.banner),
  async (open) => {
    if (open && !ownsScrollLock) {
      previousActiveElement = document.activeElement as HTMLElement | null;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeydown);
      ownsScrollLock = true;
      await nextTick();
      closeButton.value?.focus();
    } else if (!open && ownsScrollLock) {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", onKeydown);
      ownsScrollLock = false;
      previousActiveElement?.focus();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (ownsScrollLock) document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener("keydown", onKeydown);
});
</script>
