<template>
  <div>
    <PageHeader :title="t('pages.overview.title')">
      <Button
        variant="solid"
        size="lg"
        v-if="store.canAccessPage('catalog')"
        @click="$router.push('/catalog')"
      >
        <template #prefix><Plus :size="17" /></template
        >{{ t("pages.overview.addDish") }}
      </Button>
    </PageHeader>
    <section class="grid gap-4 md:grid-cols-3">
      <article v-for="stat in stats" :key="stat.label" class="card p-6">
        <div class="mb-8 flex items-center justify-between">
          <span
            class="grid size-10 place-items-center rounded-xl"
            :class="stat.color"
            ><component :is="stat.icon" :size="18" /></span
          ><Badge theme="green" :label="stat.note" />
        </div>
        <div class="display text-[2.5rem] leading-none">{{ stat.value }}</div>
        <p class="mb-0 mt-2 text-sm text-black/50">{{ stat.label }}</p>
      </article>
    </section>
    <section class="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <article class="card overflow-hidden">
        <div
          class="flex items-center justify-between border-b border-black/[0.06] p-5"
        >
          <div>
            <h2 class="display m-0 text-xl">
              {{ t("pages.overview.recentProducts") }}
            </h2>
            <p class="m-0 mt-1.5 text-[13px] text-black/45">
              {{ t("pages.overview.recentProductsDescription") }}
            </p>
          </div>
          <Button
            v-if="store.canAccessPage('catalog')"
            route="/catalog"
            variant="ghost"
            >{{ t("pages.overview.manageAll") }}</Button
          >
        </div>
        <div class="divide-y divide-black/[0.06]">
          <div
            v-for="(product, i) in store.recentProducts"
            :key="product.id"
            class="flex items-center gap-4 p-4"
          >
            <span class="w-4 text-xs font-bold text-black/25">{{
              String(i + 1).padStart(2, "0")
            }}</span>
            <MenuProductThumbnail
              :src="product.imageUrl || product.images?.[0]?.url || ''"
              class="size-14 rounded-xl"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate font-bold">{{ product.name }}</div>
              <div class="truncate text-xs text-black/40">
                {{ descriptionText(product.description) }}
              </div>
            </div>
            <div class="text-right">
              <div class="font-bold">{{ money(product.priceCents) }}</div>
              <span
                class="text-xs font-bold"
                :class="
                  productAvailable(product)
                    ? 'text-emerald-600'
                    : 'text-black/35'
                "
                >{{
                  t(
                    productAvailable(product)
                      ? "pages.overview.available"
                      : "pages.overview.unavailable",
                  )
                }}</span
              >
            </div>
          </div>
        </div>
      </article>
      <article v-if="tasks.length" class="card p-5">
        <div class="flex items-center justify-between">
          <h2 class="display m-0 text-xl">
            {{ t("pages.overview.readiness") }}
          </h2>
          <span class="display text-2xl">{{ readinessPercent }}%</span>
        </div>
        <Progress
          class="my-5"
          size="sm"
          :value="readinessPercent"
          :aria-label="t('pages.overview.readinessProgress')"
        />
        <div class="space-y-3">
          <Button
            v-for="task in tasks"
            :key="task.name"
            :route="task.to"
            variant="outline"
            size="lg"
            class="admin-row-button !h-auto min-h-12 w-full !justify-start text-start"
          >
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full"
              :class="
                task.done ? 'bg-ink text-white' : 'bg-white text-black/30'
              "
              ><Check :size="14" /></span
            ><span class="flex-1 text-sm font-medium">{{ task.name }}</span
            ><span
              class="max-w-[46%] text-right text-xs leading-4 text-black/40"
              :title="task.done ? t('pages.overview.done') : task.meta"
              >{{ task.done ? t("pages.overview.done") : task.meta }}</span
            ><ChevronRight :size="15" class="shrink-0 text-black/25" />
          </Button>
        </div>
        <Button
          variant="subtle"
          size="lg"
          v-if="nextTask"
          :route="nextTask.to"
          class="mt-5 w-full"
        >
          {{ t("pages.overview.continueSetup") }} <ArrowRight :size="16" />
        </Button>
        <Button
          variant="subtle"
          size="lg"
          v-else
          :href="store.publicMenuUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-5 w-full"
        >
          {{ t("pages.overview.viewLiveMenu") }} <ExternalLink :size="16" />
        </Button>
      </article>
    </section>
    <MenuQrPanel
      :menu-url="store.platformMenuUrl"
      :business-name="store.business.name"
      @copy="store.copyMenuUrl(store.platformMenuUrl)"
      @notify="store.notify"
    />
  </div>
</template>
<script setup lang="ts">
import { Badge, Button, Progress } from "frappe-ui";
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Plus,
  PackageOpen,
  ListTree,
  Images,
  Check,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import MenuProductThumbnail from "../components/MenuProductThumbnail.vue";
import MenuQrPanel from "../components/MenuQrPanel.vue";
import { useAdminStore, type Product } from "../stores/admin";
import { formatCurrency } from "../utils/currency";
import { visibleCategoryIds } from "../utils/readiness";
import { descriptionText } from "../../../../shared/descriptionText";
const store = useAdminStore();
const { locale, t } = useI18n();
onMounted(() => {
  void store.loadRecentProducts().catch(() => undefined);
});
const money = (amount: number) =>
  formatCurrency(amount, store.business.currency);
const productAvailable = (product: Product) =>
  product.isAvailable == null || Boolean(product.isAvailable);
const stats = computed(() => [
  {
    label: t("pages.overview.dishes"),
    value: store.stats.products,
    note: t("pages.overview.thisWeek"),
    icon: PackageOpen,
    color: "bg-[#ffe4d6]",
  },
  {
    label: t("pages.overview.categories"),
    value: store.stats.categories,
    note: t("pages.overview.wellOrganized"),
    icon: ListTree,
    color: "bg-[#e5f6cc]",
  },
  {
    label: t("pages.overview.activeBanners"),
    value: store.stats.banners,
    note: t("pages.overview.live"),
    icon: Images,
    color: "bg-[#dedcff]",
  },
]);
const publishedCategoryIds = computed(() =>
  visibleCategoryIds(store.categories),
);
const missingProfileDetails = computed(() => {
  const business = store.business;
  return [
    {
      complete: Boolean(business.name.trim()),
      label: t("pages.overview.tasks.businessName"),
    },
    {
      complete: Boolean(
        business.logoUrl?.trim() || business.logoMediaId?.trim(),
      ),
      label: t("pages.overview.tasks.businessLogo"),
    },
    {
      complete: Boolean(business.address.trim()),
      label: t("pages.overview.tasks.businessAddress"),
    },
    {
      complete: business.contactNumbers.some((contact) =>
        Boolean(contact.number.trim()),
      ),
      label: t("pages.overview.tasks.contactNumber"),
    },
  ].filter((detail) => !detail.complete);
});
const formattedMissingProfileDetails = computed(() =>
  new Intl.ListFormat(locale.value === "km" ? "km-KH" : "en", {
    style: "short",
    type: "conjunction",
  }).format(missingProfileDetails.value.map((detail) => detail.label)),
);
const tasks = computed(() => {
  const menuComplete =
    publishedCategoryIds.value.size > 0 &&
    store.readiness.publishedProducts > 0;
  const photosComplete =
    store.readiness.publishedProducts > 0 &&
    store.readiness.missingPhotoProducts === 0;
  const profileMissing = missingProfileDetails.value.length;
  const photoMissing = store.readiness.missingPhotoProducts;

  return (
    [
      {
        name: t("pages.overview.tasks.profile"),
        done: profileMissing === 0,
        meta: t("pages.overview.tasks.profileMissingDetails", {
          details: formattedMissingProfileDetails.value,
        }),
        to: "/business",
        page: "business",
      },
      {
        name: t("pages.overview.tasks.menu"),
        done: menuComplete,
        meta:
          publishedCategoryIds.value.size === 0
            ? t("pages.overview.tasks.addCategory")
            : store.readiness.publishedProducts === 0
              ? t("pages.overview.tasks.addFirstDish")
              : t("pages.overview.tasks.published", {
                  count: store.readiness.publishedProducts,
                }),
        to: "/catalog",
        page: "catalog",
      },
      {
        name: t("pages.overview.tasks.photos"),
        done: photosComplete,
        meta:
          store.readiness.publishedProducts === 0
            ? t("pages.overview.tasks.addDishFirst")
            : t("pages.overview.tasks.photosMissing", { count: photoMissing }),
        to: "/catalog?filter=missing-photos",
        page: "catalog",
      },
      {
        name: t("pages.overview.tasks.qr"),
        done: Boolean(store.readiness.firstQrDownloadedAt),
        meta: t("pages.overview.tasks.downloadOnce"),
        to: "/qr-designs",
        page: "qrDesigns",
      },
    ] as const
  ).filter((task) => store.canAccessPage(task.page));
});
const readinessPercent = computed(() =>
  Math.round(
    (tasks.value.filter((task) => task.done).length /
      (tasks.value.length || 1)) *
      100,
  ),
);
const nextTask = computed(() => tasks.value.find((task) => !task.done));
</script>
