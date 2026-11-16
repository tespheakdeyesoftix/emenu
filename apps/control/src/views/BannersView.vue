<template>
  <div>
    <PageHeader
      :eyebrow="$t('pages.banners.eyebrow')"
      :title="$t('pages.banners.title')"
      :description="$t('pages.banners.description')"
    >
      <button class="btn-primary" @click="openNew">
        <Plus :size="17" />បដាថ្មី
      </button>
    </PageHeader>

    <div class="grid gap-5 lg:grid-cols-2">
      <article
        v-for="banner in store.banners"
        :key="banner.id"
        class="card overflow-hidden"
      >
        <div
          class="relative h-56 bg-cover bg-center"
          :style="{
            backgroundImage: `linear-gradient(90deg,rgba(12,16,14,.8),rgba(12,16,14,.08)),url(${banner.imageUrl})`,
          }"
        >
          <div
            class="absolute inset-0 flex max-w-sm flex-col justify-end p-6 text-white"
          >
            <span
              class="mb-auto w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold"
              :class="bannerStatus(banner).overlayClass"
            >
              {{ bannerStatus(banner).label.toUpperCase() }}
            </span>
            <h2 class="display mb-1 text-2xl font-extrabold">
              {{ banner.title }}
            </h2>
            <p class="m-0 text-sm text-white/70">{{ banner.subtitle }}</p>
          </div>
        </div>

        <div class="flex items-start gap-3 p-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-3 py-1 text-xs font-bold"
                :class="bannerStatus(banner).className"
              >
                {{ bannerStatus(banner).label }}
              </span>
              <span
                v-if="banner.detailText"
                class="inline-flex items-center gap-1 text-xs font-bold text-black/45"
              >
                <MousePointerClick :size="14" />ចុចដើម្បីមើលលម្អិត
              </span>
            </div>
            <p class="mb-0 mt-2 text-xs text-black/40">
              {{ bannerStatus(banner).description }}
            </p>
          </div>
          <button
            class="grid size-9 shrink-0 place-items-center rounded-full hover:bg-cream"
            :aria-label="`កែសម្រួល ${banner.title}`"
            @click="openEdit(banner)"
          >
            <Pencil :size="16" />
          </button>
          <button
            class="grid size-9 shrink-0 place-items-center rounded-full hover:bg-red-50 hover:text-red-600"
            :aria-label="`លុប ${banner.title}`"
            @click="requestDeleteBanner(banner)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </article>

      <button
        class="grid min-h-72 place-items-center rounded-3xl border-2 border-dashed border-black/10 bg-white/50 p-10 text-center transition hover:border-black/25"
        @click="openNew"
      >
        <div>
          <span
            class="mx-auto grid size-12 place-items-center rounded-2xl bg-white shadow-sm"
          >
            <ImagePlus :size="20" />
          </span>
          <h3 class="display mb-1 mt-4 text-lg font-extrabold">
            បង្កើតបដាថ្មីមួយទៀត
          </h3>
          <p class="m-0 text-sm text-black/40">
            ប្រើរូបភាពទទឹងធំ និងភ្លឺ ដើម្បីទទួលបានលទ្ធផលល្អបំផុត។
          </p>
        </div>
      </button>
    </div>

    <ModalPanel
      :open="modalOpen"
      :title="editingId ? 'កែសម្រួលបដា' : 'បង្កើតបដា'"
      size="large"
      mobile-fullscreen
      @close="closeModal"
    >
      <form
        id="banner-editor-form"
        class="grid gap-5 lg:grid-cols-2"
        @submit.prevent="save"
      >
        <div class="space-y-4">
          <label>
            <span class="label">ចំណងជើង</span>
            <input
              v-model.trim="form.title"
              required
              class="input"
              maxlength="160"
              placeholder="អាហារថ្ងៃត្រង់ដ៏ឆ្ងាញ់"
            />
          </label>
          <label>
            <span class="label">សារបន្ថែម</span>
            <textarea
              v-model.trim="form.subtitle"
              class="input resize-none"
              maxlength="500"
              rows="3"
            ></textarea>
          </label>
          <ImageUploader
            v-model="form.images"
            label="រូបភាពផ្ទៃខាងក្រោយ"
            profile="banner"
            preview="wide"
            :max="1"
          />
          <label
            class="flex items-start gap-3 rounded-2xl border border-black/10 p-4 text-sm"
          >
            <input
              v-model="form.isActive"
              type="checkbox"
              class="mt-0.5 size-4 accent-black"
            />
            <span>
              <strong class="block">បានផ្សព្វផ្សាយ</strong>
              <small class="text-black/45">
                បិទជម្រើសនេះដើម្បីលាក់បដាដោយមិនចាំបាច់លុប។
              </small>
            </span>
          </label>
        </div>

        <div class="space-y-4">
          <section class="rounded-3xl bg-cream p-4">
            <label class="flex items-start gap-3 text-sm">
              <input
                v-model="form.scheduleEnabled"
                type="checkbox"
                class="mt-0.5 size-4 accent-black"
              />
              <span>
                <strong class="block">កំណត់កាលវិភាគបដានេះ</strong>
                <small class="text-black/45">
                  បង្ហាញតែក្នុងពេលព្រឹត្តិការណ៍ដែលបានកំណត់។
                </small>
              </span>
            </label>
            <div
              v-if="form.scheduleEnabled"
              class="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <label>
                <span class="label">ចាប់ផ្តើម</span>
                <input
                  v-model="form.startsAt"
                  type="datetime-local"
                  class="input"
                  required
                />
              </label>
              <label>
                <span class="label">បញ្ចប់</span>
                <input
                  v-model="form.endsAt"
                  type="datetime-local"
                  class="input"
                  required
                />
              </label>
              <p class="m-0 text-xs leading-5 text-black/45 sm:col-span-2">
                ម៉ោងប្រើតំបន់ {{ store.business.timezone }}។
                ម៉ោងបញ្ចប់មិនត្រូវបានរាប់បញ្ចូលទេ។
              </p>
            </div>
          </section>

          <section class="rounded-3xl bg-cream p-4">
            <label class="flex items-start gap-3 text-sm">
              <input
                v-model="form.detailsEnabled"
                type="checkbox"
                class="mt-0.5 size-4 accent-black"
              />
              <span>
                <strong class="block">បង្ហាញព័ត៌មានលម្អិតពេលចុច</strong>
                <small class="text-black/45">
                  ភ្ញៀវអាចមើលព័ត៌មានព្រឹត្តិការណ៍បន្ថែមដោយមិនចាកចេញពីម៉ឺនុយ។
                </small>
              </span>
            </label>
            <div v-if="form.detailsEnabled" class="mt-4 space-y-4">
              <label>
                <span class="label">ព័ត៌មានលម្អិតព្រឹត្តិការណ៍</span>
                <textarea
                  v-model.trim="form.detailText"
                  class="input resize-none"
                  maxlength="10000"
                  rows="5"
                  required
                  placeholder="បញ្ចូលកាលបរិច្ឆេទព្រឹត្តិការណ៍ លក្ខខណ្ឌប្រូម៉ូសិន ឬព័ត៌មានមានប្រយោជន៍ផ្សេងទៀត។"
                ></textarea>
              </label>
              <div class="grid gap-4 sm:grid-cols-2">
                <label>
                  <span class="label">អក្សរលើប៊ូតុង (មិនចាំបាច់)</span>
                  <input
                    v-model.trim="form.ctaLabel"
                    class="input"
                    maxlength="80"
                    placeholder="មើលបន្ថែម"
                  />
                </label>
                <label>
                  <span class="label">តំណខាងក្រៅ (មិនចាំបាច់)</span>
                  <input
                    v-model.trim="form.ctaUrl"
                    class="input"
                    type="url"
                    placeholder="https://..."
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        <p
          v-if="formError"
          class="m-0 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 lg:col-span-2"
        >
          {{ formError }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="banner-editor-form"
          class="btn-primary w-full"
          :disabled="saving"
        >
          {{
            saving
              ? "កំពុងរក្សាទុក…"
              : editingId
                ? "រក្សាទុកការកែប្រែ"
                : "ផ្សព្វផ្សាយបដា"
          }}
        </button>
      </template>
    </ModalPanel>

    <ConfirmDialog
      :open="Boolean(bannerToDelete)"
      title="លុបបដា?"
      :message="`លុប ${bannerToDelete?.title || 'បដានេះ'} ជាអចិន្ត្រៃយ៍? វានឹងបាត់ពីម៉ឺនុយ QR សាធារណៈ។`"
      confirm-label="លុបបដា"
      :busy="deletingBanner"
      :error="deleteError"
      @close="closeDeleteBanner"
      @confirm="confirmDeleteBanner"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  ImagePlus,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import ModalPanel from "../components/ModalPanel.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import ImageUploader from "../components/ImageUploader.vue";
import { useAdminStore, type Banner, type MediaImage } from "../stores/admin";

const store = useAdminStore();
const modalOpen = ref(false);
const editingId = ref("");
const saving = ref(false);
const formError = ref("");
const bannerToDelete = ref<{ id: string; title: string } | null>(null);
const deletingBanner = ref(false);
const deleteError = ref("");

type BannerForm = {
  title: string;
  subtitle: string;
  images: MediaImage[];
  isActive: boolean;
  scheduleEnabled: boolean;
  startsAt: string;
  endsAt: string;
  detailsEnabled: boolean;
  detailText: string;
  ctaLabel: string;
  ctaUrl: string;
};

const emptyForm = (): BannerForm => ({
  title: "",
  subtitle: "",
  images: [],
  isActive: true,
  scheduleEnabled: false,
  startsAt: "",
  endsAt: "",
  detailsEnabled: false,
  detailText: "",
  ctaLabel: "",
  ctaUrl: "",
});
const form = reactive(emptyForm());
const nowLocal = ref(localDateTimeNow(store.business.timezone));
let clock: number | undefined;

function localDateTimeNow(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

function formatSchedule(value?: string | null) {
  return value ? value.replace("T", " ") : "";
}

function bannerStatus(banner: Banner) {
  const enabled = banner.isActive !== false && Number(banner.isActive) !== 0;
  if (!enabled)
    return {
      label: "មិនសកម្ម",
      description: "បានលាក់ពីម៉ឺនុយសាធារណៈ",
      className: "bg-slate-100 text-slate-600",
      overlayClass: "bg-white/85 text-ink",
    };
  if (!banner.startsAt || !banner.endsAt)
    return {
      label: "បង្ហាញជានិច្ច",
      description: "បង្ហាញគ្រប់ពេលដែលម៉ឺនុយសាធារណៈដំណើរការ",
      className: "bg-emerald-50 text-emerald-700",
      overlayClass: "bg-mint text-ink",
    };
  if (nowLocal.value < banner.startsAt)
    return {
      label: "បានកំណត់ពេល",
      description: `ចាប់ផ្តើម ${formatSchedule(banner.startsAt)} (${store.business.timezone})`,
      className: "bg-blue-50 text-blue-700",
      overlayClass: "bg-blue-100 text-blue-800",
    };
  if (nowLocal.value >= banner.endsAt)
    return {
      label: "បានបញ្ចប់",
      description: `បានបញ្ចប់ ${formatSchedule(banner.endsAt)} (${store.business.timezone})`,
      className: "bg-amber-50 text-amber-700",
      overlayClass: "bg-amber-100 text-amber-800",
    };
  return {
    label: "កំពុងផ្សាយ",
    description: `បង្ហាញរហូតដល់ ${formatSchedule(banner.endsAt)} (${store.business.timezone})`,
    className: "bg-emerald-50 text-emerald-700",
    overlayClass: "bg-mint text-ink",
  };
}

function openNew() {
  editingId.value = "";
  Object.assign(form, emptyForm());
  formError.value = "";
  modalOpen.value = true;
}

function openEdit(banner: Banner) {
  editingId.value = banner.id;
  Object.assign(form, {
    title: banner.title,
    subtitle: banner.subtitle || "",
    images: banner.imageUrl
      ? [
          {
            id: `existing-${banner.id}`,
            url: banner.imageUrl,
            filename: "រូបភាពបដាបច្ចុប្បន្ន",
          },
        ]
      : [],
    isActive: banner.isActive !== false && Number(banner.isActive) !== 0,
    scheduleEnabled: Boolean(banner.startsAt && banner.endsAt),
    startsAt: banner.startsAt || "",
    endsAt: banner.endsAt || "",
    detailsEnabled: Boolean(banner.detailText),
    detailText: banner.detailText || "",
    ctaLabel: banner.ctaLabel || "",
    ctaUrl: banner.ctaUrl || "",
  });
  formError.value = "";
  modalOpen.value = true;
}

function closeModal() {
  if (!saving.value) modalOpen.value = false;
}

async function save() {
  if (saving.value) return;
  if (!form.images[0]?.url) {
    formError.value = "សូមបង្ហោះរូបភាពផ្ទៃខាងក្រោយសម្រាប់បដានេះ។";
    return;
  }
  if (
    form.scheduleEnabled &&
    (!form.startsAt || !form.endsAt || form.startsAt >= form.endsAt)
  ) {
    formError.value = "ពេលបញ្ចប់ត្រូវនៅក្រោយពេលចាប់ផ្តើម។";
    return;
  }
  if (form.detailsEnabled && !form.detailText.trim()) {
    formError.value = "សូមបន្ថែមព័ត៌មានព្រឹត្តិការណ៍សម្រាប់បដាដែលអាចចុចបាន។";
    return;
  }
  saving.value = true;
  formError.value = "";
  const payload: Partial<Banner> = {
    title: form.title,
    subtitle: form.subtitle,
    imageUrl: form.images[0].url,
    isActive: form.isActive,
    startsAt: form.scheduleEnabled ? form.startsAt : null,
    endsAt: form.scheduleEnabled ? form.endsAt : null,
    detailText: form.detailsEnabled ? form.detailText : "",
    ctaLabel: form.detailsEnabled ? form.ctaLabel : "",
    ctaUrl: form.detailsEnabled ? form.ctaUrl : "",
  };
  try {
    if (editingId.value) await store.updateBanner(editingId.value, payload);
    else await store.addBanner(payload);
    modalOpen.value = false;
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "មិនអាចរក្សាទុកបដាបានទេ។";
  } finally {
    saving.value = false;
  }
}

function requestDeleteBanner(banner: { id: string; title: string }) {
  bannerToDelete.value = banner;
  deleteError.value = "";
}

function closeDeleteBanner() {
  if (deletingBanner.value) return;
  bannerToDelete.value = null;
  deleteError.value = "";
}

async function confirmDeleteBanner() {
  if (!bannerToDelete.value || deletingBanner.value) return;
  deletingBanner.value = true;
  deleteError.value = "";
  try {
    await store.remove("banners", bannerToDelete.value.id);
    bannerToDelete.value = null;
  } catch (error) {
    deleteError.value =
      error instanceof Error ? error.message : "មិនអាចលុបបដាបានទេ។";
  } finally {
    deletingBanner.value = false;
  }
}

onMounted(() => {
  clock = window.setInterval(() => {
    nowLocal.value = localDateTimeNow(store.business.timezone);
  }, 30_000);
});
watch(
  () => store.business.timezone,
  (timezone) => {
    nowLocal.value = localDateTimeNow(timezone);
  },
);
onBeforeUnmount(() => {
  if (clock !== undefined) window.clearInterval(clock);
});
</script>
