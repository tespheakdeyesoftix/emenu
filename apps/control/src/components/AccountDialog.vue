<template>
  <ModalPanel
    :open="open"
    :title="t('account.title')"
    :close-on-backdrop="false"
    @close="$emit('close')"
  >
    <div class="flex items-center gap-4 rounded-2xl bg-cream p-4">
      <Avatar class="size-12" theme="amber">
        <span class="text-base-semibold">{{ initials }}</span>
      </Avatar>
      <div class="min-w-0">
        <div class="truncate font-bold">{{ name }}</div>
        <div class="truncate text-sm text-black/45">{{ email }}</div>
        <div class="mt-1 text-xs font-bold capitalize text-emerald-700">
          {{ roleLabel }}
        </div>
      </div>
    </div>
    <section class="mt-4 rounded-6 border border-outline-gray-1 p-4" :aria-label="t('account.subscription')">
      <h3 class="m-0 text-base-semibold text-ink-gray-9">{{ t("account.subscription") }}</h3>
      <dl class="mb-0 mt-3 grid grid-cols-2 gap-4">
        <div class="min-w-0">
          <dt class="text-sm text-ink-gray-6">{{ t("account.plan") }}</dt>
          <dd class="m-0 mt-1 break-words"><Badge :label="planName" /></dd>
        </div>
        <div class="min-w-0">
          <dt class="text-sm text-ink-gray-6">{{ t("account.expires") }}</dt>
          <dd class="m-0 mt-1 break-words text-base-medium">{{ expiresOn || t("shell.noExpiry") }}</dd>
        </div>
      </dl>
    </section>
    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <Button
        size="lg"
        variant="outline"
        icon-left="lucide-key-round"
        :label="t('account.changePassword')"
        @click="$emit('changePassword')"
      />
      <Button
        size="lg"
        theme="red"
        icon-left="lucide-log-out"
        :label="t('account.signOut')"
        :loading="signingOut"
        :loading-text="t('account.signingOut')"
        @click="$emit('signOut')"
      />
    </div>
  </ModalPanel>
</template>

<script setup lang="ts">
import { Avatar, Badge, Button } from "frappe-ui";
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
  planName: string;
  expiresOn: string | null;
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
