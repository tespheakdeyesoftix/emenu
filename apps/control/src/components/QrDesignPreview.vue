<template>
  <div
    class="relative grid min-h-80 place-items-center overflow-hidden rounded-[2rem] bg-[#dfe4da] p-5"
  >
    <div
      v-if="loading"
      class="absolute inset-0 z-10 grid place-items-center bg-white/60 backdrop-blur-sm"
    >
      <LoaderCircle :size="28" class="animate-spin text-black/35" />
    </div>
    <canvas
      v-show="!failed"
      ref="canvasElement"
      class="max-h-[620px] max-w-full rounded-md shadow-[0_24px_70px_rgba(15,35,29,.25)]"
      :aria-label="`មើលជាមុន៖ ${input.design.name}`"
    ></canvas>
    <p
      v-if="failed"
      class="m-0 max-w-xs text-center text-sm font-bold text-red-600"
    >
      មិនអាចបង្ហាញរូបមើលជាមុនបានទេ។ សូមពិនិត្យពណ៌ និងរូបភាពដែលបានជ្រើសរើស។
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import { renderQrCanvas, type QrRenderInput } from "../utils/qrRenderer";

const props = defineProps<{ input: QrRenderInput }>();
const canvasElement = ref<HTMLCanvasElement | null>(null);
const loading = ref(false);
const failed = ref(false);
let renderVersion = 0;
let renderTimer = 0;
let hasRendered = false;
const PREVIEW_DEBOUNCE_MS = 1_500;

async function renderPreview(version: number) {
  loading.value = true;
  failed.value = false;
  await nextTick();
  try {
    const rendered = await renderQrCanvas(props.input, { dpi: 72 });
    if (version !== renderVersion || !canvasElement.value) return;
    const target = canvasElement.value;
    target.width = rendered.width;
    target.height = rendered.height;
    target.getContext("2d")?.drawImage(rendered, 0, 0);
  } catch {
    if (version === renderVersion) failed.value = true;
  } finally {
    if (version === renderVersion) loading.value = false;
  }
}

watch(
  () => props.input,
  () => {
    const version = ++renderVersion;
    window.clearTimeout(renderTimer);
    if (!hasRendered) {
      hasRendered = true;
      void renderPreview(version);
      return;
    }
    loading.value = false;
    failed.value = false;
    renderTimer = window.setTimeout(
      () => void renderPreview(version),
      PREVIEW_DEBOUNCE_MS,
    );
  },
  { deep: true, immediate: true },
);

onBeforeUnmount(() => {
  window.clearTimeout(renderTimer);
  renderVersion += 1;
});
</script>
