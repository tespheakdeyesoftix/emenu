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
        <Password size="lg" variant="outline"
          v-model="form.currentPassword"
          autocomplete="current-password"
          minlength="8"
          required
        />
      </label>
      <label>
        <span class="label">{{ t("account.newPassword") }}</span>
        <Password size="lg" variant="outline"
          v-model="form.newPassword"
          autocomplete="new-password"
          minlength="8"
          :placeholder="t('account.minimum')"
          required
        />
      </label>
      <label>
        <span class="label">{{ t("account.confirmPassword") }}</span>
        <Password size="lg" variant="outline"
          v-model="form.confirmPassword"
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
      <Button variant="solid" size="lg"
        type="submit"
        form="change-password-form"
        class="w-full"
        :disabled="saving"
      >
        <template #prefix><Spinner v-if="saving" class="!size-[17px]" />
        <KeyRound v-else :size="17" /></template>
        {{ saving ? t("account.changing") : t("account.changePassword") }}
      </Button>
    </template>
  </ModalPanel>
</template>

<script setup lang="ts">
import { Password, Button, Spinner } from "frappe-ui";
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { KeyRound } from "lucide-vue-next";
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
