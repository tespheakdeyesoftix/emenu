<template>
  <div>
    <PageHeader :title="$t('pages.qrDesigns.title')">
      <Button variant="solid" size="lg" @click="openNew">
        <template #prefix><Plus :size="17" /></template>ការរចនាថ្មី
      </Button>
    </PageHeader>

    <div v-if="store.loading" class="card grid min-h-80 place-items-center">
      <Spinner class="!size-[32px] text-black/25" />
    </div>
    <template v-else>
      <Alert v-if="error" theme="red" :title="error" class="mb-4" />
      <div class="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        <article
          v-for="design in store.designs"
          :key="design.id"
          class="card overflow-hidden"
        >
          <div class="relative bg-[#e4e7df] p-5">
            <Badge v-if="design.isDefault" theme="green" class="absolute left-4 top-4 z-10 uppercase tracking-wider">លំនាំដើម</Badge>
            <Badge class="absolute right-4 top-4 z-10 uppercase">{{
                design.targetType === "table" ? "QR សម្រាប់តុ" : "QR ម៉ឺនុយ"
              }}</Badge>
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
              <Button variant="subtle" size="lg"
                class="!p-2.5"
                aria-label="កែសម្រួលការរចនា"
                @click="openEdit(design)"
              >
                <template #icon><Pencil :size="16" /></template>
              </Button>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button variant="subtle" size="lg" @click="openEdit(design)">
                <template #prefix><Download :size="15" /></template>មើលជាមុន និងទាញយក
              </Button>
              <Button variant="subtle" size="lg"
                :disabled="busy"
                @click="duplicate(design)"
              >
                <template #prefix><Copy :size="15" /></template>ចម្លង
              </Button>
              <Button variant="subtle" size="lg"
                v-if="!design.isDefault"
                :disabled="busy"
                @click="makeDefault(design)"
              >
                <template #prefix><Star :size="15" /></template>កំណត់ជាលំនាំដើម
              </Button>
              <Button variant="subtle" size="lg"
                v-if="!design.isDefault"
                theme="red"
                :aria-label="$t('common.delete') + ' ' + design.name"
                :disabled="busy"
                @click="designToDelete = design; error = ''"
              >
                <template #icon><Trash2 :size="15" /></template>
              </Button>
            </div>
          </div>
        </article>
        <Button
          variant="outline" size="lg" type="button"
          class="admin-action-card !justify-center min-h-96 border-dashed !text-center"
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
        </Button>
      </div>
    </template>

    <ConfirmDialog
      :open="!!designToDelete"
      :title="$t('common.delete')"
      :message="designToDelete ? deleteMessage(designToDelete.name) : ''"
      :busy="busy"
      :error="error"
      @close="designToDelete = null; error = ''"
      @confirm="remove"
    />

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
import { Badge, Alert, Button, Spinner } from "frappe-ui";
import { onMounted, ref } from "vue";
import {
  Copy,
  Download,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-vue-next";
import ConfirmDialog from "../components/ConfirmDialog.vue";
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
const designToDelete = ref<QrDesign | null>(null);
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
function deleteMessage(name: string) {
  return `លុប “${name}” មែនទេ? លេខកូដ QR ដែលបានបោះពុម្ពនឹងនៅតែអាចបើកម៉ឺនុយបាន។`;
}
async function remove() {
  const design = designToDelete.value;
  if (!design || busy.value) return;
  await run(() => store.deleteDesign(design.id));
  if (!error.value) {
    designToDelete.value = null;
    admin.notify("បានលុបការរចនា QR");
  }
}
onMounted(() => run(() => store.load(true)));
</script>
