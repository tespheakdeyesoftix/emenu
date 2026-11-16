<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-5"
        role="presentation"
        @click.self="$emit('close')"
      >
        <section
          role="dialog"
          aria-modal="true"
          :aria-label="t('shopInfo.title')"
          class="max-h-[90dvh] w-full overflow-y-auto rounded-t-[2rem] bg-surface shadow-2xl sm:max-w-xl sm:rounded-[2rem]"
        >
          <header
            class="sticky top-0 z-10 flex items-center gap-3 border-b border-ink/[.06] bg-surface/95 px-5 py-4 backdrop-blur sm:px-6"
          >
            <div
              class="grid size-11 place-items-center rounded-2xl text-white"
              :style="{
                backgroundColor:
                  business.menuTheme?.primaryColor ||
                  business.themeColor ||
                  '#e84231',
              }"
            >
              <Store :size="21" />
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="m-0 text-xs font-bold uppercase tracking-[.13em] text-ink/35"
              >
                {{ t("shopInfo.title") }}
              </p>
              <h2
                class="font-display m-0 mt-0.5 truncate text-xl font-extrabold"
              >
                {{ business.name }}
              </h2>
            </div>
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-full bg-cream"
              :aria-label="t('common.close')"
              @click="$emit('close')"
            >
              <X :size="19" />
            </button>
          </header>

          <div
            class="space-y-5 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6"
          >
            <section
              v-if="business.description"
              class="rounded-3xl bg-cream p-5"
            >
              <p
                class="mb-2 mt-0 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-ink/40"
              >
                <Info :size="15" />{{ t("shopInfo.about") }}
              </p>
              <p class="m-0 whitespace-pre-line text-sm leading-6 text-ink/65">
                {{ business.description }}
              </p>
            </section>

            <section
              v-if="business.showBusinessHours && orderedHours.length"
              class="rounded-3xl border border-ink/[.07] p-5"
            >
              <h3
                class="font-display m-0 flex items-center gap-2 text-base font-extrabold"
              >
                <Clock3 :size="18" />{{ t("shopInfo.hours") }}
              </h3>
              <div class="mt-4 divide-y divide-black/[.06]">
                <div
                  v-for="hours in orderedHours"
                  :key="hours.day"
                  class="flex items-center justify-between gap-4 py-2.5 text-sm"
                  :class="
                    hours.day === today ? 'font-extrabold text-tomato' : ''
                  "
                >
                  <span>{{ dayName(hours.day) }}</span>
                  <span v-if="hours.enabled" class="tabular-nums"
                    >{{ hours.open }} - {{ hours.close }}</span
                  >
                  <span v-else class="text-ink/35">{{
                    t("shopInfo.closed")
                  }}</span>
                </div>
              </div>
            </section>

            <section
              v-if="hasContact"
              class="rounded-3xl border border-ink/[.07] p-5"
            >
              <h3
                class="font-display m-0 flex items-center gap-2 text-base font-extrabold"
              >
                <ContactRound :size="18" />{{ t("shopInfo.contact") }}
              </h3>
              <div class="mt-4 space-y-2">
                <a
                  v-for="contact in business.contactNumbers"
                  :key="`${contact.label}-${contact.number}`"
                  :href="`tel:${phoneHref(contact.number)}`"
                  class="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm text-ink"
                  @click="trackContact('phone')"
                >
                  <Phone :size="17" class="text-tomato" /><span
                    class="min-w-0 flex-1"
                    ><strong class="block">{{ contact.label }}</strong
                    ><span class="text-ink/50">{{ contact.number }}</span></span
                  ><ChevronRight :size="17" class="text-ink/25" />
                </a>
                <a
                  v-if="business.email"
                  :href="`mailto:${business.email}`"
                  class="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm text-ink"
                  @click="trackContact('email')"
                  ><Mail :size="17" class="text-tomato" /><span
                    class="min-w-0 flex-1 truncate"
                    >{{ business.email }}</span
                  ><ChevronRight :size="17" class="text-ink/25"
                /></a>
                <a
                  v-if="business.websiteUrl"
                  :href="business.websiteUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm text-ink"
                  @click="trackContact('website')"
                  ><Globe2 :size="17" class="text-tomato" /><span
                    class="min-w-0 flex-1 truncate"
                    >{{ displayUrl(business.websiteUrl) }}</span
                  ><ExternalLink :size="16" class="text-ink/25"
                /></a>
              </div>
            </section>

            <section
              v-if="business.socialLinks.length"
              class="rounded-3xl border border-ink/[.07] p-5"
            >
              <h3
                class="font-display m-0 flex items-center gap-2 text-base font-extrabold"
              >
                <Share2 :size="18" />{{ t("shopInfo.social") }}
              </h3>
              <div class="mt-4 flex flex-wrap gap-2">
                <a
                  v-for="social in business.socialLinks"
                  :key="`${social.platform}-${social.url}`"
                  :href="social.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 rounded-full bg-action px-4 py-2.5 text-sm font-bold text-on-action"
                  @click="trackContact('social')"
                  >{{ social.platform }}<ExternalLink :size="14"
                /></a>
              </div>
            </section>

            <section
              v-if="locations.length"
              class="relative isolate min-h-44 overflow-hidden rounded-3xl bg-action bg-cover bg-center p-5 text-on-action shadow-sm"
              :style="{
                backgroundImage: `linear-gradient(100deg, rgba(20, 21, 18, 0.38) 0%, rgba(20, 21, 18, 0.26) 52%, rgba(20, 21, 18, 0.12) 100%), url(${mapCardBackground})`,
              }"
            >
              <h3
                class="font-display m-0 flex items-center gap-2 text-base font-extrabold"
              >
                <MapPin :size="18" />{{ t("shopInfo.location") }}
              </h3>
              <div class="mt-4 space-y-3">
                <article
                  v-for="(location, index) in locations"
                  :key="`${location.label}-${index}`"
                  class="rounded-2xl border border-white/20 bg-black/10 p-4 backdrop-blur-sm"
                >
                  <strong class="block text-sm">{{ location.label }}</strong>
                  <p
                    v-if="location.address"
                    class="mb-0 mt-1 text-sm leading-5 text-on-action/65"
                  >
                    {{ location.address }}
                  </p>
                  <a
                    :href="location.mapLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-extrabold text-ink"
                    @click="trackContact('map')"
                    >{{ t("shopInfo.openMap") }}<ExternalLink :size="15"
                  /></a>
                </article>
              </div>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import {
  ChevronRight,
  Clock3,
  ContactRound,
  ExternalLink,
  Globe2,
  Info,
  Mail,
  MapPin,
  Phone,
  Share2,
  Store,
  X,
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useMenuStore } from "../stores/menu";
import mapCardBackground from "../assets/ui/map-card-background.webp";
import { trackAnalytics } from "../analytics";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const store = useMenuStore();
const { t } = useI18n();
const business = computed(() => store.data.business);
const today = new Date().getDay();
const orderedHours = computed(() =>
  [...business.value.businessHours].sort(
    (left, right) => ((left.day + 6) % 7) - ((right.day + 6) % 7),
  ),
);
const hasContact = computed(
  () =>
    business.value.contactNumbers.length > 0 ||
    Boolean(business.value.email) ||
    Boolean(business.value.websiteUrl),
);
const locations = computed(() => {
  const savedLocations = business.value.locations
    .filter((location) => location.showInMenu !== false)
    .map((location) => {
      const address = location.address?.trim() || "";
      const mapLink =
        location.mapUrl?.trim() ||
        (address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
          : "");
      return {
        label:
          location.label?.trim() || address || String(t("shopInfo.location")),
        address,
        mapLink,
      };
    })
    .filter((location) => location.mapLink);
  return savedLocations;
});
function dayName(day: number) {
  return t(`shopInfo.weekdays.${day}`);
}
function phoneHref(number: string) {
  return number.replace(/[^+\d]/g, "");
}
function displayUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
function trackContact(
  actionKind: "phone" | "email" | "website" | "map" | "social",
) {
  trackAnalytics("contact_click", { actionKind });
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}

let previousBodyOverflow = "";
let ownsScrollLock = false;
watch(
  () => props.open,
  (open) => {
    if (open && !ownsScrollLock) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeydown);
      ownsScrollLock = true;
    } else if (!open && ownsScrollLock) {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", onKeydown);
      ownsScrollLock = false;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (ownsScrollLock) document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener("keydown", onKeydown);
});
</script>
