<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-250 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
        role="dialog"
        aria-modal="true"
        :aria-label="t('wifi.title')"
        @click.self="emit('close')"
      >
        <section
          class="w-full max-w-sm rounded-t-[2rem] bg-surface p-6 text-center shadow-2xl sm:rounded-[2rem] sm:p-8"
        >
          <div class="mb-5 flex items-center justify-between gap-3 text-left">
            <div>
              <p
                class="m-0 text-xs font-extrabold uppercase tracking-[.14em] text-tomato"
              >
                {{ t("wifi.title") }}
              </p>
              <h2 class="font-display mb-0 mt-1 text-2xl font-extrabold">
                {{ ssid }}
              </h2>
            </div>
            <button
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-ink"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <X :size="20" />
            </button>
          </div>

          <div
            class="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-3xl bg-white p-4"
          >
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              :alt="t('wifi.qrAlt', { ssid })"
              class="size-full"
            />
            <LoaderCircle v-else class="animate-spin text-tomato" :size="32" />
          </div>
          <p class="mb-0 mt-4 text-sm leading-6 text-ink/50">
            {{ t("wifi.scanToJoin") }}
          </p>

          <div
            v-if="security === 'wpa'"
            class="mt-5 rounded-2xl bg-cream p-4 text-left"
          >
            <span
              class="text-[11px] font-bold uppercase tracking-[.12em] text-ink/35"
            >
              {{ t("wifi.password") }}
            </span>
            <div class="mt-1 flex items-center gap-3">
              <strong class="min-w-0 flex-1 break-all text-base">{{
                password
              }}</strong>
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-action px-3 py-2 text-xs font-extrabold text-on-action"
                @click="copyPassword"
              >
                <Check v-if="copied" :size="15" />
                <Copy v-else :size="15" />
                {{ copied ? t("wifi.copied") : t("wifi.copy") }}
              </button>
            </div>
          </div>
          <div
            v-else
            class="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm font-bold"
          >
            {{ t("wifi.openNetwork") }}
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { Check, Copy, LoaderCircle, X } from "lucide-vue-next";
import QRCode from "qrcode";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  open: boolean;
  ssid: string;
  password: string;
  security: "wpa" | "open";
}>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const qrDataUrl = ref("");
const copied = ref(false);
let copyTimer = 0;
let previousBodyOverflow = "";
let ownsScrollLock = false;

function escapeWifiValue(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function wifiPayload() {
  const ssid = escapeWifiValue(props.ssid);
  if (props.security === "open") return `WIFI:T:nopass;S:${ssid};H:false;;`;
  return `WIFI:T:WPA;S:${ssid};P:${escapeWifiValue(props.password)};H:false;;`;
}

async function renderQr() {
  if (!props.open || !props.ssid) {
    qrDataUrl.value = "";
    return;
  }
  qrDataUrl.value = await QRCode.toDataURL(wifiPayload(), {
    width: 560,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#171714", light: "#ffffff" },
  });
}

function fallbackCopy(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(props.password);
  } catch {
    fallbackCopy(props.password);
  }
  window.clearTimeout(copyTimer);
  copied.value = true;
  copyTimer = window.setTimeout(() => (copied.value = false), 1800);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}

watch(
  () => [props.open, props.ssid, props.password, props.security] as const,
  ([open]) => {
    copied.value = false;
    void renderQr();
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
  window.clearTimeout(copyTimer);
  if (ownsScrollLock) document.body.style.overflow = previousBodyOverflow;
  window.removeEventListener("keydown", onKeydown);
});
</script>
