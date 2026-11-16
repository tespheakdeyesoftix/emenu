<template>
  <ModalPanel
    :open="open"
    title="Clone business data"
    @close="!cloning && $emit('close')"
  >
    <div class="space-y-6">
      <div>
        <p class="mt-0 text-sm leading-6 text-black/60">
          Copy selected data from another registered business into
          <strong class="text-ink">{{ targetName }}</strong
          >. Selected target sections will be replaced.
        </p>
        <form class="mt-4 flex gap-2" @submit.prevent="searchBusinesses">
          <label class="relative min-w-0 flex-1">
            <Search
              :size="16"
              class="absolute left-4 top-1/2 -translate-y-1/2 text-black/30"
            />
            <input
              v-model.trim="query"
              class="input pl-10"
              placeholder="Search source business"
              :disabled="cloning"
            />
          </label>
          <button class="btn-soft px-4" :disabled="sourceLoading || cloning">
            <LoaderCircle
              v-if="sourceLoading"
              :size="16"
              class="animate-spin"
            />
            <Search v-else :size="16" />
          </button>
        </form>
        <div
          class="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-black/[.07]"
        >
          <button
            v-for="business in businesses"
            :key="business.id"
            type="button"
            class="flex w-full items-center gap-3 border-b border-black/[.05] px-4 py-3 text-left last:border-0"
            :class="sourceId === business.id ? 'bg-lime/20' : 'hover:bg-cream'"
            :disabled="cloning"
            @click="selectSource(business.id)"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas"
            >
              <Building2 :size="16" />
            </span>
            <span class="min-w-0 flex-1">
              <strong class="block truncate text-sm">{{
                business.name
              }}</strong>
              <small class="block truncate text-black/40"
                >/{{ business.slug }} ·
                {{ business.productCount || 0 }} products</small
              >
            </span>
            <CircleCheck
              v-if="sourceId === business.id"
              :size="18"
              class="text-emerald-600"
            />
          </button>
          <p
            v-if="!sourceLoading && !businesses.length"
            class="m-0 p-5 text-center text-sm text-black/40"
          >
            No source businesses found.
          </p>
        </div>
        <p v-if="sourceError" class="mb-0 mt-2 text-xs font-bold text-red-700">
          {{ sourceError }}
        </p>
      </div>

      <fieldset :disabled="cloning">
        <legend class="label mb-3">Choose data to clone</legend>
        <div class="grid gap-2">
          <label
            v-for="option in sectionOptions"
            :key="option.value"
            class="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/[.07] p-4"
            :class="selected(option.value) ? 'bg-lime/15' : 'bg-white'"
          >
            <input
              type="checkbox"
              class="mt-1 size-4 accent-black"
              :checked="selected(option.value)"
              @change="
                toggleSection(
                  option.value,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            <span>
              <strong class="block text-sm">{{ option.label }}</strong>
              <small class="mt-1 block leading-5 text-black/45">{{
                option.description
              }}</small>
            </span>
          </label>
        </div>
      </fieldset>

      <p
        v-if="actionError"
        class="m-0 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"
      >
        {{ actionError }}
      </p>

      <div v-if="preview" class="space-y-4">
        <div class="rounded-2xl border border-black/[.07] bg-cream p-4">
          <p
            class="m-0 text-xs font-bold uppercase tracking-[.1em] text-black/35"
          >
            Replacement preview
          </p>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div class="font-bold text-black/45">Section</div>
            <div class="font-bold text-black/45">Target</div>
            <div class="font-bold text-black/45">Source</div>
            <template v-for="row in previewRows" :key="row.label">
              <div class="text-left font-bold">{{ row.label }}</div>
              <div>{{ row.target }}</div>
              <div>{{ row.source }}</div>
            </template>
          </div>
          <p class="mb-0 mt-3 text-xs text-black/45">
            {{ preview.referencedMediaCount }} referenced image{{
              preview.referencedMediaCount === 1 ? "" : "s"
            }}
            will be copied.
          </p>
          <p class="mb-0 mt-2 text-xs leading-5 text-black/45">
            Selected: {{ selectedSectionLabels }}
          </p>
        </div>
        <div
          v-for="blocker in preview.blockers"
          :key="blocker"
          class="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"
        >
          {{ blocker }}
        </div>
        <div
          v-for="warning in preview.warnings"
          :key="warning"
          class="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800"
        >
          {{ warning }}
        </div>
        <label v-if="preview.canClone" class="block">
          <span class="label"
            >Type <strong>{{ targetName }}</strong> to confirm</span
          >
          <input
            v-model="confirmationName"
            class="input"
            autocomplete="off"
            :disabled="cloning"
          />
        </label>
      </div>

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="btn-soft"
          :disabled="cloning"
          @click="$emit('close')"
        >
          Cancel
        </button>
        <button
          v-if="!preview"
          type="button"
          class="btn-primary"
          :disabled="!sourceId || !sections.length || previewLoading"
          @click="loadPreview"
        >
          <LoaderCircle v-if="previewLoading" :size="17" class="animate-spin" />
          <ScanSearch v-else :size="17" />
          {{ previewLoading ? "Preparing…" : "Review changes" }}
        </button>
        <button
          v-else
          type="button"
          class="btn-danger"
          :disabled="
            cloning || !preview.canClone || confirmationName !== targetName
          "
          @click="cloneData"
        >
          <LoaderCircle v-if="cloning" :size="17" class="animate-spin" />
          <Copy v-else :size="17" />
          {{ cloning ? "Cloning…" : "Replace selected data" }}
        </button>
      </div>
    </div>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Building2,
  CircleCheck,
  Copy,
  LoaderCircle,
  ScanSearch,
  Search,
} from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
import {
  api,
  type BusinessListItem,
  type ClonePreview,
  type CloneResult,
  type CloneSection,
} from "../api";

const props = defineProps<{
  open: boolean;
  targetId: string;
  targetName: string;
}>();
const emit = defineEmits<{ close: []; cloned: [result: CloneResult] }>();
const query = ref("");
const businesses = ref<BusinessListItem[]>([]);
const sourceId = ref("");
const sections = ref<CloneSection[]>([]);
const preview = ref<ClonePreview | null>(null);
const confirmationName = ref("");
const sourceLoading = ref(false);
const previewLoading = ref(false);
const cloning = ref(false);
const sourceError = ref("");
const actionError = ref("");

const sectionOptions: Array<{
  value: CloneSection;
  label: string;
  description: string;
}> = [
  {
    value: "categories",
    label: "Categories",
    description: "Category tree, translations, order, visibility, and images.",
  },
  {
    value: "products",
    label: "Products",
    description:
      "Products, options, portions, availability, and galleries. Includes categories.",
  },
  {
    value: "pricing",
    label: "Pricing",
    description:
      "Price lists, schedules, overrides, currencies, and timezone. Includes products and categories.",
  },
  {
    value: "theme",
    label: "Theme",
    description:
      "Menu appearance, colors, typography, layout, and background image.",
  },
  {
    value: "businessSettings",
    label: "Business settings",
    description:
      "Logo, profile, contacts, hours, locations, languages, ordering, Wi-Fi, and social links.",
  },
];

const previewRows = computed(() => {
  if (!preview.value) return [];
  const rows = [];
  if (preview.value.effectiveSections.includes("categories"))
    rows.push({
      label: "Categories",
      target: preview.value.targetCounts.categories,
      source: preview.value.sourceCounts.categories,
    });
  if (preview.value.effectiveSections.includes("products"))
    rows.push({
      label: "Products",
      target: preview.value.targetCounts.products,
      source: preview.value.sourceCounts.products,
    });
  if (preview.value.effectiveSections.includes("pricing")) {
    rows.push({
      label: "Price lists",
      target: preview.value.targetCounts.priceLists,
      source: preview.value.sourceCounts.priceLists,
    });
    rows.push({
      label: "Price entries",
      target: preview.value.targetCounts.productPrices,
      source: preview.value.sourceCounts.productPrices,
    });
  }
  return rows;
});
const selectedSectionLabels = computed(() =>
  sectionOptions
    .filter((option) => preview.value?.effectiveSections.includes(option.value))
    .map((option) => option.label)
    .join(", "),
);

function selected(section: CloneSection) {
  return sections.value.includes(section);
}
function resetReview() {
  preview.value = null;
  confirmationName.value = "";
  actionError.value = "";
}
function selectSource(id: string) {
  sourceId.value = id;
  resetReview();
}
function toggleSection(section: CloneSection, checked: boolean) {
  const next = new Set(sections.value);
  if (checked) next.add(section);
  else next.delete(section);
  if (checked && section === "pricing") {
    next.add("products");
    next.add("categories");
  }
  if (checked && section === "products") next.add("categories");
  if (!checked && section === "categories") {
    next.delete("products");
    next.delete("pricing");
  }
  if (!checked && section === "products") next.delete("pricing");
  sections.value = sectionOptions
    .map((option) => option.value)
    .filter((value) => next.has(value));
  resetReview();
}
async function searchBusinesses() {
  sourceLoading.value = true;
  sourceError.value = "";
  try {
    const params = new URLSearchParams({
      q: query.value,
      status: "all",
      subscriptionStatus: "all",
      page: "1",
      pageSize: "100",
    });
    const result = await api<{ items: BusinessListItem[] }>(
      `/api/super/businesses?${params}`,
    );
    businesses.value = result.items.filter(
      (business) => business.id !== props.targetId,
    );
  } catch (value) {
    sourceError.value =
      value instanceof Error ? value.message : "Could not load businesses";
  } finally {
    sourceLoading.value = false;
  }
}
async function loadPreview() {
  previewLoading.value = true;
  actionError.value = "";
  try {
    preview.value = await api<ClonePreview>(
      `/api/super/businesses/${props.targetId}/clone/preview`,
      {
        method: "POST",
        body: JSON.stringify({
          sourceBusinessId: sourceId.value,
          sections: sections.value,
        }),
      },
    );
    sections.value = [...preview.value.effectiveSections];
  } catch (value) {
    actionError.value =
      value instanceof Error ? value.message : "Could not prepare clone";
  } finally {
    previewLoading.value = false;
  }
}
async function cloneData() {
  if (!preview.value?.canClone || confirmationName.value !== props.targetName)
    return;
  cloning.value = true;
  actionError.value = "";
  try {
    const result = await api<CloneResult>(
      `/api/super/businesses/${props.targetId}/clone`,
      {
        method: "POST",
        body: JSON.stringify({
          sourceBusinessId: sourceId.value,
          sections: sections.value,
          confirmationName: confirmationName.value,
        }),
      },
    );
    emit("cloned", result);
  } catch (value) {
    actionError.value =
      value instanceof Error ? value.message : "Could not clone business data";
  } finally {
    cloning.value = false;
  }
}
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    query.value = "";
    businesses.value = [];
    sourceId.value = "";
    sections.value = [];
    preview.value = null;
    confirmationName.value = "";
    sourceError.value = "";
    actionError.value = "";
    void searchBusinesses();
  },
);
</script>
