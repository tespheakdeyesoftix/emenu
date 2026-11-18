<template>
  <section class="card mt-5 overflow-hidden bg-ink text-white">
    <div class="grid md:grid-cols-[1fr_300px]">
      <div class="p-7 lg:p-9">
        <Badge theme="green" variant="solid">{{ t("pages.overview.qrPanel.live") }}</Badge>
        <h2 class="display mb-2 mt-5 text-2xl font-extrabold lg:text-3xl">
          {{ t("pages.overview.qrPanel.title") }}
        </h2>
        <p class="max-w-xl text-sm leading-6 text-white/55">
          {{ t("pages.overview.qrPanel.description", { url: menuUrl }) }}
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="lg"
            route="/qr-designs"
          >
            <template #prefix><Download :size="16" aria-hidden="true" /></template>{{
              t("pages.overview.qrPanel.design")
            }}
          </Button>
          <Button
            variant="subtle" size="lg"
            type="button"

            @click="$emit('copy')"
          >
            {{ t("pages.overview.qrPanel.copy") }}
          </Button>
        </div>
      </div>
      <div
        class="relative hidden place-items-center overflow-hidden bg-mint md:grid"
      >
        <div
          class="grid size-40 place-items-center rounded-3xl bg-white p-3 shadow-2xl"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            :alt="t('pages.overview.qrPanel.alt', { business: businessName })"
            class="size-full"
          />
          <Spinner v-else class="!size-[36px] text-ink/40" />
        </div>
        <div
          class="absolute -right-8 -top-8 size-24 rounded-full border-[18px] border-black/10"
        ></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Badge, Button, Spinner } from "frappe-ui";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Download } from "lucide-vue-next";
import { createMenuQrCode } from "../utils/qrCode";
const { t } = useI18n();

const props = defineProps<{ menuUrl: string; businessName: string }>();
const emit = defineEmits<{
  copy: [];
  notify: [message: string];
}>();
const previewUrl = ref("");

watch(
  () => props.menuUrl,
  async (menuUrl) => {
    previewUrl.value = "";
    if (!menuUrl) return;
    try {
      previewUrl.value = await createMenuQrCode(menuUrl, 320);
    } catch {
      emit("notify", t("pages.overview.qrPanel.error"));
    }
  },
  { immediate: true },
);
</script>
