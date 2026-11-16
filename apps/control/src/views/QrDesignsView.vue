<template>
  <div>
    <PageHeader
      :eyebrow="$t('pages.qrDesigns.eyebrow')"
      :title="$t('pages.qrDesigns.title')"
      :description="$t('pages.qrDesigns.description')"
    >
      <button class="btn-primary" @click="openNew">
        <Plus :size="17" />ការរចនាថ្មី
      </button>
    </PageHeader>

    <div v-if="store.loading" class="card grid min-h-80 place-items-center">
      <LoaderCircle :size="32" class="animate-spin text-black/25" />
    </div>
    <template v-else>
      <div
        v-if="error"
        class="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
      >
        {{ error }}
      </div>
      <div class="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        <article
          v-for="design in store.designs"
          :key="design.id"
          class="card overflow-hidden"
        >
          <div class="relative bg-[#e4e7df] p-5">
            <span
              v-if="design.isDefault"
              class="absolute left-4 top-4 z-10 rounded-full bg-mint px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink"
              >លំនាំដើម</span
            >
            <span
              class="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase text-black/55"
              >{{
                design.targetType === "table" ? "QR សម្រាប់តុ" : "QR ម៉ឺនុយ"
              }}</span
            >
            <QrDesignPreview
              v-if="store.allowCategoryBrowsing || design.config.menuSlug"
              :input="previewFor(design)"
            />
            <p v-else class="m-0 grid min-h-80 place-items-center p-5 text-center text-sm text-black/55">
              {{ $t('pages.qrDesigns.menuRequired') }}
            </p>
          </div>
          <div class="p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="display m-0 text-lg font-extrabold">
                  {{ design.name }}
                </h2>
                <p class="mb-0 mt-1 text-xs text-black/40">
                  {{ presetFor(design.presetKey).name }} ·
                  {{ dimensionLabel(design) }}
                </p>
              </div>
              <button
                class="btn-soft !p-2.5"
                aria-label="កែសម្រួលការរចនា"
                @click="openEdit(design)"
              >
                <Pencil :size="16" />
              </button>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="btn-soft" @click="openEdit(design)">
                <Download :size="15" />មើលជាមុន និងទាញយក
              </button>
              <button
                class="btn-soft"
                :disabled="busy"
                @click="duplicate(design)"
              >
                <Copy :size="15" />ចម្លង
              </button>
              <button
                v-if="!design.isDefault"
                class="btn-soft"
                :disabled="busy"
                @click="makeDefault(design)"
              >
                <Star :size="15" />កំណត់ជាលំនាំដើម
              </button>
              <button
                v-if="!design.isDefault"
                class="btn-soft text-red-600"
                :disabled="busy"
                @click="remove(design)"
              >
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
        </article>
        <button
          class="grid min-h-96 place-items-center rounded-3xl border-2 border-dashed border-black/10 bg-white/40 p-8 text-center transition hover:border-black/25 hover:bg-white"
          @click="openNew"
        >
          <span
            ><span
              class="mx-auto grid size-12 place-items-center rounded-full bg-ink text-white"
              ><Plus :size="22" /></span
            ><strong class="mt-4 block">បង្កើតការរចនាថ្មីមួយទៀត</strong
            ><span class="mt-1 block text-sm text-black/40"
              >ចាប់ផ្តើមពីទម្រង់បោះពុម្ពដែលបានរៀបចំរួច។</span
            ></span
          >
        </button>
      </div>
    </template>

    <QrDesigner
      :open="designerOpen"
      :design="selectedDesign"
      :business="admin.business"
      :menu-url="admin.platformMenuUrl"
      @close="designerOpen = false"
      @notify="admin.notify"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Copy,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import QrDesigner from "../components/QrDesigner.vue";
import QrDesignPreview from "../components/QrDesignPreview.vue";
import { useAdminStore } from "../stores/admin";
import { useQrDesignStore } from "../stores/qrDesigns";
import { designDimensions, type QrRenderInput } from "../utils/qrRenderer";
import { presetFor, type QrDesign } from "../types/qrDesign";

const admin = useAdminStore();
const store = useQrDesignStore();
const designerOpen = ref(false);
const selectedDesign = ref<QrDesign | null>(null);
const busy = ref(false);
const error = ref("");

const previewFor = (design: QrDesign): QrRenderInput => ({
  design,
  business: admin.business,
  menuUrl: admin.platformMenuUrl,
});
const dimensionLabel = (design: QrDesign) => {
  const size = designDimensions(design);
  return `${size.widthMm} × ${size.heightMm} mm`;
};
function openNew() {
  selectedDesign.value = null;
  designerOpen.value = true;
}
function openEdit(design: QrDesign) {
  selectedDesign.value = design;
  designerOpen.value = true;
}
async function run(action: () => Promise<void>) {
  busy.value = true;
  error.value = "";
  try {
    await action();
  } catch (caught) {
    error.value =
      caught instanceof Error ? caught.message : "មិនអាចកែប្រែការរចនាបានទេ";
  } finally {
    busy.value = false;
  }
}
async function duplicate(design: QrDesign) {
  await run(() => store.duplicateDesign(design.id));
  admin.notify("បានចម្លងការរចនា QR");
}
async function makeDefault(design: QrDesign) {
  await run(() => store.setDefault(design.id));
  admin.notify("បានកែប្រែការរចនា QR លំនាំដើម");
}
async function remove(design: QrDesign) {
  if (
    !window.confirm(
      `លុប “${design.name}” មែនទេ? លេខកូដ QR ដែលបានបោះពុម្ពនឹងនៅតែអាចបើកម៉ឺនុយបាន។`,
    )
  )
    return;
  await run(() => store.deleteDesign(design.id));
  if (!error.value) admin.notify("បានលុបការរចនា QR");
}
onMounted(() => store.load(true));
</script>
