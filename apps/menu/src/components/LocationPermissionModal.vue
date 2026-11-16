<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[85dvh] w-11/12 max-w-sm overflow-y-auto overscroll-contain rounded-[2rem] bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60"
    aria-labelledby="location-permission-title"
    aria-describedby="location-permission-description"
    @cancel.prevent="respond('dismiss')"
  >
    <section class="p-6 text-center sm:p-8">
      <div
        class="mx-auto grid size-14 place-items-center rounded-2xl bg-cream text-tomato"
      >
        <MapPin :size="28" aria-hidden="true" />
      </div>
      <h2
        id="location-permission-title"
        class="font-display mb-0 mt-4 text-2xl font-extrabold"
      >
        {{ isSettings ? text.locationSettingsTitle : text.locationPermissionTitle }}
      </h2>
      <p
        id="location-permission-description"
        class="mb-0 mt-3 text-sm leading-6 text-ink/70"
      >
        {{ isSettings ? text.locationSettingsDescription : text.locationPermissionDescription }}
      </p>
      <div class="mt-6 flex flex-wrap-reverse justify-center gap-2">
        <button
          type="button"
          autofocus
          class="min-h-11 flex-1 whitespace-nowrap rounded-full bg-cream px-4 py-2 text-sm font-bold"
          @click="respond('dismiss')"
        >
          {{ isSettings ? t("common.close") : text.locationNotNow }}
        </button>
        <button
          v-if="!isSettings"
          type="button"
          class="min-h-11 flex-1 whitespace-nowrap rounded-full bg-action px-4 py-2 text-sm font-extrabold text-on-action"
          @click="respond('allow')"
        >
          {{ text.allowLocation }}
        </button>
      </div>
    </section>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { MapPin } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import type { MenuLanguage } from "../stores/menu";
import { uiText } from "../uiText";

const props = defineProps<{ language: MenuLanguage; mode: "request" | "settings" }>();
const emit = defineEmits<{ allow: []; dismiss: [] }>();
const { t } = useI18n();
const isSettings = computed(() => props.mode === "settings");
const text = computed(() => uiText(props.language));
const dialog = ref<HTMLDialogElement | null>(null);

function respond(choice: "allow" | "dismiss") {
  dialog.value?.close();
  if (choice === "allow") emit("allow");
  else emit("dismiss");
}

onMounted(() => dialog.value?.showModal());
</script>
