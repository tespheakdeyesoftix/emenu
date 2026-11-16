<template>
  <div>
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <span class="label !mb-1">{{ label }}</span>
        <p class="m-0 text-xs text-black/40">{{ uploadHint }}</p>
      </div>
      <label
        v-if="modelValue.length < max"
        class="btn-soft cursor-pointer whitespace-nowrap"
        :class="uploading ? 'pointer-events-none opacity-50' : ''"
      >
        <Upload :size="16" />{{
          uploading ? "កំពុងកែសម្រួល និងបង្ហោះ…" : "បង្ហោះ"
        }}
        <input
          class="hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :multiple="max > 1"
          @change="selectFiles"
        />
      </label>
    </div>

    <div
      v-if="!modelValue.length"
      class="grid min-h-32 place-items-center rounded-2xl border-2 border-dashed border-black/10 bg-cream text-center"
    >
      <div class="p-5">
        <ImagePlus class="mx-auto text-black/25" :size="28" />
        <p class="mb-0 mt-2 text-xs font-bold text-black/40">
          មិនទាន់មានរូបភាពទេ
        </p>
      </div>
    </div>

    <div
      v-else
      class="grid gap-2"
      :class="preview === 'wide' ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-5'"
    >
      <div
        v-for="image in modelValue"
        :key="image.id"
        class="group relative overflow-hidden rounded-2xl border-2 bg-cream"
        :class="[
          preview === 'wide' ? 'aspect-[16/7]' : 'aspect-square',
          image.id === primaryId ? 'border-mint' : 'border-transparent',
        ]"
      >
        <FallbackImage
          :src="image.url"
          :alt="image.filename || 'រូបភាពដែលបានបង្ហោះ'"
          class="size-full object-cover"
        >
          <template #fallback>
            <span
              class="grid size-full place-items-center text-black/25"
              aria-hidden="true"
            >
              <PackageOpen :size="24" />
            </span>
          </template>
        </FallbackImage>
        <button
          type="button"
          class="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-red-600 shadow"
          aria-label="លុបរូបភាព"
          @click="remove(image.id)"
        >
          <X :size="14" />
        </button>
        <button
          v-if="max > 1"
          type="button"
          class="absolute inset-x-1.5 bottom-1.5 rounded-full px-2 py-1.5 text-[10px] font-extrabold shadow"
          :class="
            image.id === primaryId ? 'bg-mint text-ink' : 'bg-white/90 text-ink'
          "
          @click="$emit('update:primaryId', image.id)"
        >
          {{ image.id === primaryId ? "រូបចម្បង" : "កំណត់ជារូបចម្បង" }}
        </button>
      </div>
    </div>
    <p v-if="error" class="mb-0 mt-2 text-xs font-bold text-red-600">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ImagePlus, PackageOpen, Upload, X } from "lucide-vue-next";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import { useAdminStore, type MediaImage } from "../stores/admin";

const props = withDefaults(
  defineProps<{
    modelValue: MediaImage[];
    max?: number;
    label?: string;
    primaryId?: string;
    profile?: "default" | "banner" | "background" | "print";
    preview?: "grid" | "wide";
  }>(),
  {
    max: 1,
    label: "រូបភាព",
    primaryId: "",
    profile: "default",
    preview: "grid",
  },
);
const emit = defineEmits<{
  "update:modelValue": [value: MediaImage[]];
  "update:primaryId": [value: string];
}>();
const store = useAdminStore();
const uploading = ref(false);
const error = ref("");
const uploadHint = computed(() => {
  const optimization =
    props.profile === "print"
      ? "សម្រួលសម្រាប់ការបោះពុម្ព"
      : props.profile === "background"
        ? "optimized to 1920 px and approximately 1 MB"
        : props.profile === "banner"
          ? "សម្រួលទទឹងរហូតដល់ 1600 px"
          : "សម្រួលទទឹងរហូតដល់ 500 px";
  return `JPG, PNG ឬ WebP · ${optimization} · អតិបរមា ${props.max} រូប`;
});

async function selectFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []).slice(
    0,
    props.max - props.modelValue.length,
  );
  if (!files.length) return;
  error.value = "";
  uploading.value = true;
  try {
    const uploaded = await Promise.all(
      files.map((file) => store.uploadMedia(file, props.profile)),
    );
    const next = [...props.modelValue, ...uploaded];
    emit("update:modelValue", next);
    if (!props.primaryId && next[0]) emit("update:primaryId", next[0].id);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "ការបង្ហោះរូបភាពមិនបានសម្រេចទេ។";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

function remove(imageId: string) {
  const next = props.modelValue.filter((image) => image.id !== imageId);
  emit("update:modelValue", next);
  if (props.primaryId === imageId) emit("update:primaryId", next[0]?.id ?? "");
}
</script>
