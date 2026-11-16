<template>
  <ModalPanel
    :open="open"
    :title="t('account.title')"
    :close-on-backdrop="false"
    @close="$emit('close')"
  >
    <div class="flex items-center gap-4 rounded-2xl bg-cream p-4">
      <div
        class="grid size-12 shrink-0 place-items-center rounded-full bg-[#ffd8b5] text-sm font-extrabold"
      >
        {{ initials }}
      </div>
      <div class="min-w-0">
        <div class="truncate font-bold">{{ name }}</div>
        <div class="truncate text-sm text-black/45">{{ email }}</div>
        <div class="mt-1 text-xs font-bold capitalize text-emerald-700">
          {{ roleLabel }}
        </div>
      </div>
    </div>
    <div class="mt-5 grid gap-3">
      <button
        type="button"
        class="flex items-center gap-3 rounded-2xl border border-black/[.08] px-4 py-3 text-left text-sm font-bold hover:bg-cream"
        @click="$emit('changePassword')"
      >
        <KeyRound :size="18" />
        <span class="flex-1">{{ t("account.changePassword") }}</span>
        <ChevronRight :size="17" class="text-black/30" />
      </button>
      <button
        type="button"
        class="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
        :disabled="signingOut"
        @click="$emit('signOut')"
      >
        <LogOut :size="18" />
        {{ signingOut ? t("account.signingOut") : t("account.signOut") }}
      </button>
    </div>
  </ModalPanel>
</template>

<script setup lang="ts">
import { ChevronRight, KeyRound, LogOut } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  open: boolean;
  name: string;
  email: string;
  role: string;
  initials: string;
  signingOut: boolean;
}>();
const roleLabel = computed(() => {
  const key = `shell.roles.${props.role}`;
  const label = t(key);
  return label === key ? props.role : label;
});

defineEmits<{
  close: [];
  changePassword: [];
  signOut: [];
}>();
</script>
