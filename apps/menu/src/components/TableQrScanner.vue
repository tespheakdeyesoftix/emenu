<template>
  <dialog
    ref="dialog"
    class="table-scanner fixed inset-0 m-0 max-h-none w-full max-w-none overflow-hidden overscroll-none bg-black p-0 text-white backdrop:bg-black"
    aria-labelledby="table-scan-title"
    @cancel="stopCamera"
    @close="onClose"
  >
    <div
      v-show="error !== 'tableScanCameraUnavailable' && error !== 'tableScanNeedsHttps'"
      class="absolute inset-0 overflow-hidden"
    >
      <video ref="video" class="block size-full object-cover" muted playsinline />
    </div>
    <header class="table-scanner-header absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent">
      <h2 id="table-scan-title" class="font-display m-0 text-xl font-extrabold">
        {{ text.scanTableQr }}
      </h2>
      <button
        type="button"
        autofocus
        class="grid size-11 shrink-0 place-items-center rounded-full bg-black/70 text-white focus-visible:outline-white"
        :aria-label="t('common.close')"
        @click="closeScanner"
      >
        <X :size="20" aria-hidden="true" />
      </button>
    </header>
    <footer class="table-scanner-footer absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 bg-gradient-to-t from-black/85 to-transparent text-center">
      <p
        class="m-0 max-w-sm rounded-2xl bg-black/70 px-4 py-3 text-sm leading-5"
        :class="error ? 'font-semibold text-red-200' : 'text-white'"
        role="status"
      >
        {{
          error ? text[error]
            : checking ? text.tableScanChecking
            : starting || switching ? text.tableScanOpening
            : text.tableScanInstructions
        }}
      </p>
      <button
        v-if="!starting && cameras.length > 1 && error !== 'tableScanCameraUnavailable'"
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/70 px-4 text-sm font-bold text-white focus-visible:outline-white disabled:opacity-60"
        :disabled="checking || switching"
        @click="switchCamera"
      >
        <SwitchCamera :size="18" aria-hidden="true" />
        {{ text.tableScanSwitchCamera }}
      </button>
    </footer>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";
import { SwitchCamera, X } from "lucide-vue-next";
import type QrScanner from "qr-scanner";
import { useI18n } from "vue-i18n";
import { useMenuStore } from "../stores/menu";
import { uiText } from "../uiText";

const props = defineProps<{
  scan: (value: string, signal: AbortSignal) => Promise<boolean>;
}>();
const emit = defineEmits<{ close: [] }>();
const store = useMenuStore();
const { t } = useI18n();
const text = computed(() => uiText(store.selectedLanguage));
const dialog = ref<HTMLDialogElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const starting = ref(true);
const switching = ref(false);
const checking = ref(false);
const cameras = ref<QrScanner.Camera[]>([]);
const error = ref<"" | "tableScanCameraUnavailable" | "tableScanNeedsHttps" |
  "tableScanInvalid" | "tableScanFailed">("");
const controller = new AbortController();
const cameraPreferenceKey = "angkor_emenu_table_camera_id";
let scanner: QrScanner | undefined;
let lastScan = "";

async function checkCode(value: string) {
  if (!dialog.value?.open || starting.value || switching.value || checking.value || value === lastScan) return;
  lastScan = value;
  checking.value = true;
  error.value = "";
  try {
    const accepted = await props.scan(value, controller.signal);
    if (controller.signal.aborted || !dialog.value?.open) return;
    if (accepted) closeScanner();
    else error.value = "tableScanInvalid";
  } catch {
    if (!controller.signal.aborted) error.value = "tableScanFailed";
  } finally {
    checking.value = false;
  }
}

function rearCameraPriority(label: string) {
  if (!/\b(back|rear|environment|outward)\b/i.test(label)) return 0;
  if (/\b(front|selfie|ultra[\s-]*wide|tele(?:photo)?|macro|depth|secondary|auxiliary|dual|triple)\b/i.test(label)) return 0;
  if (/\b(0[.,]\d+|[2-9](?:[.,]\d+)?)\s*(x\b|×)/i.test(label)) return 0;
  return /\b(main|primary|standard|wide)\b|\b1(?:[.,]0)?\s*(x\b|×)/i.test(label) ? 2 : 1;
}

function preferredRearCamera(devices: QrScanner.Camera[]) {
  return devices.reduce<QrScanner.Camera | undefined>((best, camera) =>
    rearCameraPriority(camera.label) > rearCameraPriority(best?.label ?? "") ? camera : best,
  undefined);
}

function activeCamera() {
  const stream = video.value?.srcObject;
  return stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined;
}

function activeCameraId() {
  const track = activeCamera();
  return track?.getSettings().deviceId || cameras.value.find(({ label }) => label === track?.label)?.id;
}

function savedCameraId() {
  try {
    return localStorage.getItem(cameraPreferenceKey);
  } catch {
    return null;
  }
}

function saveCameraId(id: string) {
  try {
    localStorage.setItem(cameraPreferenceKey, id);
  } catch {
    // The scanner still works when browser storage is unavailable.
  }
}

function scanRegion(player: HTMLVideoElement, canvasSize: number): QrScanner.ScanRegion {
  const { videoWidth, videoHeight, clientWidth, clientHeight } = player;
  if (!videoWidth || !videoHeight || !clientWidth || !clientHeight) return {};
  // Keep the scan area inside the part of the video visible with object-fit: cover.
  const scale = Math.max(clientWidth / videoWidth, clientHeight / videoHeight);
  const size = Math.floor(Math.min(clientWidth, clientHeight) * 0.7 / scale);
  return {
    x: Math.floor((videoWidth - size) / 2),
    y: Math.floor((videoHeight - size) / 2),
    width: size,
    height: size,
    downScaledWidth: canvasSize,
    downScaledHeight: canvasSize,
  };
}

async function startCamera() {
  if (!window.isSecureContext) {
    error.value = "tableScanNeedsHttps";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = "tableScanCameraUnavailable";
    return;
  }
  try {
    const { default: Scanner } = await import("qr-scanner");
    // Device labels may be hidden until the first stream is open.
    const listCameras = () => Scanner.listCameras().then(
      (devices) => devices.filter(({ id }) => id),
      () => [],
    );
    const savedId = savedCameraId();
    const initialDevices = await listCameras();
    const preferred = initialDevices.find(({ id }) => id === savedId) ?? preferredRearCamera(initialDevices);
    if (!video.value || !dialog.value?.open || controller.signal.aborted) return;
    scanner = new Scanner(video.value, ({ data }) => void checkCode(data), {
      preferredCamera: preferred?.id ?? "environment",
      calculateScanRegion: (player) => scanRegion(player, Scanner.DEFAULT_CANVAS_SIZE),
      maxScansPerSecond: 8,
      highlightScanRegion: true,
      returnDetailedScanResult: true,
    });
    scanner.setInversionMode("both");
    await scanner.start();
    if (controller.signal.aborted) return;
    const track = activeCamera();
    const openedId = track?.getSettings().deviceId;
    if (preferred && track && (openedId ? openedId !== preferred.id : track.label !== preferred.label)) {
      await scanner.setCamera("environment");
    }
    if (controller.signal.aborted) return;
    const devices = await listCameras();
    if (controller.signal.aborted) return;
    cameras.value = devices;
    if (savedId && activeCameraId() === savedId) return;
    if (savedId && savedId !== preferred?.id && devices.some(({ id }) => id === savedId)) {
      if (await changeCamera(savedId) || controller.signal.aborted) return;
    }
    const primary = preferredRearCamera(devices);
    const activeId = activeCameraId();
    const activeLabel = devices.find(({ id }) => id === activeId)?.label ?? activeCamera()?.label ?? "";
    if (primary && primary.id !== preferred?.id && primary.id !== activeId &&
      rearCameraPriority(primary.label) > rearCameraPriority(activeLabel)) {
      await changeCamera(primary.id);
    }
  } catch {
    if (!controller.signal.aborted) cameraUnavailable();
  } finally {
    starting.value = false;
  }
}

async function changeCamera(id: string) {
  const currentScanner = scanner;
  if (!currentScanner) return false;
  const previous = activeCameraId() ?? "environment";
  try {
    await currentScanner.setCamera(id);
    const current = activeCameraId();
    if (activeCamera() && (!current || current === id)) return true;
  } catch {
    // Restore the previous stream when the new camera fails to open.
  }
  if (controller.signal.aborted) return false;
  await currentScanner.setCamera(previous);
  if (!controller.signal.aborted && !activeCamera()) await currentScanner.start();
  return false;
}

async function switchCamera() {
  if (starting.value || switching.value || checking.value) return;
  const currentId = activeCameraId();
  const currentIndex = cameras.value.findIndex(({ id }) => id === currentId);
  const next = cameras.value[(currentIndex + 1) % cameras.value.length];
  if (!next) return;
  switching.value = true;
  lastScan = "";
  error.value = "";
  try {
    const changed = await changeCamera(next.id);
    if (controller.signal.aborted) return;
    if (changed && activeCameraId() === next.id) saveCameraId(next.id);
    if (!changed) cameras.value = cameras.value.filter(({ id }) => id !== next.id);
  } catch {
    if (!controller.signal.aborted) cameraUnavailable();
  } finally {
    switching.value = false;
  }
}

function releaseCamera() {
  scanner?.destroy();
  scanner = undefined;
  const player = video.value;
  if (typeof MediaStream !== "undefined" && player?.srcObject instanceof MediaStream) {
    player.srcObject.getTracks().forEach((track) => track.stop());
    player.srcObject = null;
  }
}

function cameraUnavailable() {
  error.value = "tableScanCameraUnavailable";
  releaseCamera();
}

function stopCamera() {
  controller.abort();
  releaseCamera();
}

function closeScanner() {
  stopCamera();
  dialog.value?.close();
}

function onClose() {
  stopCamera();
  emit("close");
}

onMounted(() => {
  dialog.value?.showModal();
  void startCamera();
});
onBeforeUnmount(stopCamera);
onDeactivated(closeScanner);
</script>

<style scoped>
.table-scanner {
  height: 100%;
  height: 100dvh;
}
.table-scanner-header,
.table-scanner-footer {
  padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
}
.table-scanner-header {
  padding-top: calc(1rem + env(safe-area-inset-top));
  padding-bottom: 1.5rem;
}
.table-scanner-footer {
  padding-top: 1.5rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
</style>
