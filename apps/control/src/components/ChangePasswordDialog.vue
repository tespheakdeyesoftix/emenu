<template>
  <ModalPanel
    :open="open"
    :title="t('account.changePassword')"
    :close-on-backdrop="false"
    @close="close"
  >
    <form id="change-password-form" class="grid gap-4" @submit.prevent="submit">
      <label>
        <span class="label">{{ t("account.currentPassword") }}</span>
        <input
          v-model="form.currentPassword"
          class="input"
          type="password"
          autocomplete="current-password"
          minlength="8"
          required
        />
      </label>
      <label>
        <span class="label">{{ t("account.newPassword") }}</span>
        <input
          v-model="form.newPassword"
          class="input"
          type="password"
          autocomplete="new-password"
          minlength="8"
          :placeholder="t('account.minimum')"
          required
        />
      </label>
      <label>
        <span class="label">{{ t("account.confirmPassword") }}</span>
        <input
          v-model="form.confirmPassword"
          class="input"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
        />
      </label>
      <p
        v-if="message"
        class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
      >
        {{ message }}
      </p>
    </form>

    <template #footer>
      <button
        type="submit"
        form="change-password-form"
        class="btn-primary w-full"
        :disabled="saving"
      >
        <LoaderCircle v-if="saving" :size="17" class="animate-spin" />
        <KeyRound v-else :size="17" />
        {{ saving ? t("account.changing") : t("account.changePassword") }}
      </button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { KeyRound, LoaderCircle } from "lucide-vue-next";
import ModalPanel from "./ModalPanel.vue";
const { t } = useI18n();

const props = defineProps<{
  open: boolean;
  saving: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  submit: [currentPassword: string, newPassword: string];
}>();
const form = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});
const localError = computed(() => {
  if (form.confirmPassword && form.newPassword !== form.confirmPassword) {
    return t("account.mismatch");
  }
  return "";
});
const message = computed(() => localError.value || props.error);

watch(
  () => props.open,
  (open) => {
    if (!open) reset();
  },
);

function reset() {
  form.currentPassword = "";
  form.newPassword = "";
  form.confirmPassword = "";
}

function close() {
  if (props.saving) return;
  emit("close");
}

function submit() {
  if (form.newPassword !== form.confirmPassword) return;
  emit("submit", form.currentPassword, form.newPassword);
}
</script>
