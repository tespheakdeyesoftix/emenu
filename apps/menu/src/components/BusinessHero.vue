<template>
  <section class="w-full">
    <div
      class="relative overflow-hidden rounded-b-[1.75rem] bg-surface shadow-sm"
    >
      <details
        v-if="store.availableLanguages.length > 1"
        ref="languageMenu"
        class="z-20"
        :class="
          hasBanner
            ? 'absolute right-3 top-3 text-white'
            : 'relative ml-auto mr-4 mt-4 w-fit text-ink sm:mr-6 sm:mt-6'
        "
      >
        <summary
          class="flex cursor-pointer list-none items-center gap-2 rounded-full border px-3.5 py-2.5 text-sm font-bold shadow-lg backdrop-blur-md [&::-webkit-details-marker]:hidden"
          :class="
            hasBanner
              ? 'border-white/35 bg-black/45'
              : 'border-ink/[.08] bg-cream'
          "
          :aria-label="t('language.select')"
        >
          <img
            v-if="activeLanguage"
            :src="activeLanguage.flag"
            alt=""
            class="h-4 w-6 rounded-sm object-cover shadow-sm"
          />
          <span>{{ activeLanguage?.label }}</span>
          <ChevronDown :size="14" />
        </summary>
        <div
          class="absolute right-0 mt-2 min-w-36 overflow-hidden rounded-2xl border border-ink/[.08] bg-surface p-1.5 text-ink shadow-2xl"
        >
          <button
            v-for="language in store.availableLanguages"
            :key="language.code"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-cream"
            :class="store.selectedLanguage === language.code ? 'bg-cream' : ''"
            @click="changeLanguage(language.code)"
          >
            <img
              :src="language.flag"
              alt=""
              class="h-4 w-6 rounded-sm object-cover shadow-sm"
            />
            <span>{{ language.label }}</span>
          </button>
        </div>
      </details>
      <Swiper
        v-if="hasBanner"
        :modules="swiperModules"
        :slides-per-view="1"
        :speed="700"
        :loop="visibleBanners.length > 1"
        :autoplay="
          visibleBanners.length > 1
            ? { delay: 4500, disableOnInteraction: false }
            : false
        "
        :pagination="visibleBanners.length > 1 ? { clickable: true } : false"
        :grab-cursor="visibleBanners.length > 1"
        @swiper="onBannerChange"
        @slide-change="onBannerChange"
        class="menu-business-banner business-banner-swiper aspect-[2/1] w-full max-h-[420px] sm:aspect-[2.75/1]"
      >
        <SwiperSlide
          v-for="banner in visibleBanners"
          :key="banner.id"
          class="h-full"
        >
          <component
            :is="isClickable(banner) ? 'button' : 'div'"
            :type="isClickable(banner) ? 'button' : undefined"
            class="relative block size-full border-0 bg-transparent p-0 text-left"
            @click="openBanner(banner)"
          >
            <MenuImage
              :src="banner.imageUrl"
              :alt="banner.title || store.data.business.name"
              class="size-full object-cover"
            >
              <template #fallback>
                <div class="size-full bg-cream" />
              </template>
            </MenuImage>
            <span
              v-if="isClickable(banner)"
              class="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg backdrop-blur-md"
            >
              <Info :size="15" />{{ t("banner.viewDetails") }}
            </span>
          </component>
        </SwiperSlide>
      </Swiper>

      <div class="menu-business-identity p-4 sm:p-6">
        <div
          v-if="store.tableContextUnavailable"
          class="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"
        >
          This table code is unavailable. Please ask a staff member before
          ordering.
        </div>
        <div class="flex items-center gap-3">
          <MenuImage
            :src="business.logoUrl"
            alt=""
            class="size-16 shrink-0 rounded-2xl object-cover sm:size-[4.5rem]"
          >
            <template #fallback>
              <span
                class="grid size-16 shrink-0 place-items-center rounded-2xl bg-ink text-xl font-bold text-cream sm:size-[4.5rem]"
                aria-hidden="true"
              >
                {{ businessInitials(business.name) }}
              </span>
            </template>
          </MenuImage>
          <div class="min-w-0 flex-1">
            <h1
              class="menu-business-name font-display m-0 truncate font-extrabold"
            >
              {{ store.data.business.name }}
            </h1>
            <p v-if="store.data.branch && !store.data.branch.isDefault && !headerLocations.length" class="theme-muted m-0 mt-1 text-sm font-semibold text-ink/55">
              {{ store.data.branch.name }}
            </p>
            <div
              v-if="headerLocations.length"
              class="no-scrollbar mt-1 flex max-w-full items-center gap-3 overflow-x-auto whitespace-nowrap pb-0.5"
            >
              <a
                v-for="(location, index) in headerLocations"
                :key="index"
                :href="location.mapLink"
                target="_blank"
                rel="noopener noreferrer"
                class="theme-muted inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink/55 transition hover:text-tomato sm:text-base"
                :aria-label="`${t('shopInfo.openMap')}: ${location.text}`"
                @click="trackContact('map')"
              >
                <MapPin :size="17" class="shrink-0" />
                <span>{{ location.text }}</span>
              </a>
            </div>
          </div>
          <button
            type="button"
            class="menu-header-action ml-auto grid size-11 shrink-0 place-items-center rounded-full border border-transparent bg-cream text-ink shadow-sm transition hover:bg-black/[.08] sm:flex sm:size-auto sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm sm:font-extrabold"
            :aria-label="t('shopInfo.button')"
            @click="shopInfoOpen = true"
          >
            <Info :size="19" />
            <span class="hidden sm:inline">{{ t("shopInfo.button") }}</span>
          </button>
        </div>
        <div v-if="hasHeaderDetails" class="mt-1.5 space-y-0.5">
          <div
            v-if="headerContacts.length || showWifi"
            class="no-scrollbar flex items-center gap-4 overflow-x-auto whitespace-nowrap pb-0.5"
          >
            <a
              v-for="contact in headerContacts"
              :key="`${contact.label}-${contact.number}`"
              :href="`tel:${phoneHref(contact.number)}`"
              class="theme-muted inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink/55 transition hover:text-tomato sm:text-base"
              :aria-label="`${contact.label}: ${contact.number}`"
              @click="trackContact('phone')"
            >
              <Phone :size="17" />{{ contact.number }}
            </a>
            <button
              v-if="showWifi"
              type="button"
              class="theme-muted inline-flex shrink-0 items-center gap-2 text-left text-sm font-semibold text-ink/55 transition hover:text-tomato sm:text-base"
              :aria-label="`${t('wifi.title')}: ${business.wifiSsid}`"
              @click="openWifi"
            >
              <Wifi :size="18" class="shrink-0" />
              <span>
                {{
                  business.wifiSecurity === "open"
                    ? t("wifi.openNetworkLabel")
                    : business.wifiPassword
                }}
              </span>
            </button>
          </div>

          <div v-if="headerSocials.length" class="flex flex-wrap gap-2">
            <a
              v-for="social in headerSocials"
              :key="`${social.platform}-${social.url}`"
              :href="social.url"
              target="_blank"
              rel="noopener noreferrer"
              class="menu-header-social grid size-9 place-items-center rounded-full border border-ink/10 bg-cream text-ink shadow-sm transition hover:bg-action hover:text-on-action"
              :aria-label="social.platform"
              :title="social.platform"
              @click="trackContact('social')"
            >
              <component
                :is="socialIcon(social.platform)"
                :size="17"
                :stroke-width="2.4"
              />
            </a>
          </div>

          <p
            v-if="showTagline"
            class="theme-muted mb-0 text-base leading-5 text-ink/60 sm:text-lg sm:leading-6"
          >
            {{ business.tagline }}
          </p>
        </div>
      </div>
    </div>
    <ShopInfoSheet :open="shopInfoOpen" @close="shopInfoOpen = false" />
    <WifiAccessModal
      :open="wifiOpen"
      :ssid="business.wifiSsid"
      :password="business.wifiPassword"
      :security="business.wifiSecurity"
      @close="wifiOpen = false"
    />
    <BannerDetailSheet
      :banner="selectedBanner"
      @close="selectedBanner = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ChevronDown,
  Facebook,
  Info,
  Instagram,
  Link2,
  MapPin,
  Phone,
  Send,
  Twitter,
  Wifi,
  Youtube,
} from "lucide-vue-next";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/vue";
import { useI18n } from "vue-i18n";
import "swiper/css";
import "swiper/css/pagination";
import { businessInitials } from "../../../../shared/businessInitials";
import { useMenuStore } from "../stores/menu";
import type { MenuBanner, MenuLanguage } from "../stores/menu";
import BannerDetailSheet from "./BannerDetailSheet.vue";
import MenuImage from "./MenuImage.vue";
import ShopInfoSheet from "./ShopInfoSheet.vue";
import TikTokIcon from "./icons/TikTokIcon.vue";
import WifiAccessModal from "./WifiAccessModal.vue";
import { trackAnalytics } from "../analytics";

const store = useMenuStore();
const { t } = useI18n();
const swiperModules = [Autoplay, Pagination];
const languageMenu = ref<HTMLDetailsElement | null>(null);
const shopInfoOpen = ref(false);
const wifiOpen = ref(false);
const selectedBanner = ref<MenuBanner | null>(null);
const business = computed(() => store.data.business);
const headerLocations = computed(() => {
  if (!business.value.showHeaderLocation) return [];
  return business.value.locations
    .filter((location) => location.showInMenu !== false)
    .map((location) => {
      const address = location.address?.trim() || "";
      const mapLink =
        location.mapUrl?.trim() ||
        (address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
          : "");
      return {
        mapLink,
        text:
          location.label?.trim() || address || String(t("shopInfo.openMap")),
      };
    })
    .filter((location) => location.mapLink);
});
const headerContacts = computed(() =>
  business.value.showHeaderPhones
    ? business.value.contactNumbers.filter((contact) => contact.number?.trim())
    : [],
);
const showWifi = computed(
  () =>
    business.value.showHeaderWifi &&
    Boolean(business.value.wifiSsid) &&
    (business.value.wifiSecurity === "open" ||
      Boolean(business.value.wifiPassword)),
);
const headerSocials = computed(() =>
  business.value.showHeaderSocials
    ? business.value.socialLinks.filter((social) => social.url?.trim())
    : [],
);
const showTagline = computed(
  () =>
    business.value.showHeaderTagline && Boolean(business.value.tagline?.trim()),
);
const hasHeaderDetails = computed(
  () =>
    headerContacts.value.length > 0 ||
    showWifi.value ||
    headerSocials.value.length > 0 ||
    showTagline.value,
);
const visibleBanners = computed(() =>
  (store.data.banners as MenuBanner[]).filter((banner) =>
    Boolean(banner.imageUrl),
  ),
);
const hasBanner = computed(() => visibleBanners.value.length > 0);
const activeLanguage = computed(() =>
  store.availableLanguages.find(
    (language) => language.code === store.selectedLanguage,
  ),
);

function changeLanguage(language: MenuLanguage) {
  store.setLanguage(language);
  if (languageMenu.value) languageMenu.value.open = false;
}

function isClickable(banner: MenuBanner) {
  return Boolean(banner.detailText?.trim());
}

function openBanner(banner: MenuBanner) {
  if (isClickable(banner)) {
    selectedBanner.value = banner;
    trackAnalytics("banner_open", { bannerId: banner.id });
  }
}

function onBannerChange(swiper: { realIndex: number }) {
  const banner = visibleBanners.value[swiper.realIndex || 0];
  if (banner)
    trackAnalytics(
      "banner_impression",
      { bannerId: banner.id },
      `banner-impression:${banner.id}`,
    );
}

function trackContact(actionKind: "phone" | "map" | "social") {
  trackAnalytics("contact_click", { actionKind });
}

function openWifi() {
  wifiOpen.value = true;
  trackAnalytics("contact_click", { actionKind: "wifi" });
}

function phoneHref(number: string) {
  return number.replace(/[^+\d]/g, "");
}

function socialIcon(platform: string) {
  if (platform === "Facebook") return Facebook;
  if (platform === "Instagram") return Instagram;
  if (platform === "TikTok") return TikTokIcon;
  if (platform === "Telegram") return Send;
  if (platform === "YouTube") return Youtube;
  if (platform === "X") return Twitter;
  return Link2;
}
</script>

<style>
.business-banner-swiper .swiper-pagination {
  bottom: 0.65rem;
}

.business-banner-swiper .swiper-pagination-bullet {
  width: 0.4rem;
  height: 0.4rem;
  background: rgb(255 255 255 / 65%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 20%);
  opacity: 1;
  transition:
    width 250ms ease,
    background-color 250ms ease;
}

.business-banner-swiper .swiper-pagination-bullet-active {
  width: 1.25rem;
  border-radius: 9999px;
  background: white;
}
</style>
