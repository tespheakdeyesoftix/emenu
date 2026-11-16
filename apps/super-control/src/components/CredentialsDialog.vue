<template>
  <ModalPanel :open="open" title="Reset account credentials" @close="close">
    <form class="grid gap-4" @submit.prevent="submit">
      <p
        class="m-0 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
      >
        This revokes every active session for
        <strong>{{ member?.displayName }}</strong
        >. Changing the email also requires this new password.
      </p>
      <label>
        <span class="label">Registered email</span>
        <input
          v-model.trim="email"
          class="input"
          type="email"
          autocomplete="off"
          required
        />
      </label>
      <label>
        <span class="label">New password</span>
        <div class="flex gap-2">
          <input
            v-model="password"
            class="input min-w-0"
            type="text"
            minlength="8"
            autocomplete="off"
            required
          />
          <button
            type="button"
            class="btn-soft shrink-0 px-4"
            @click="generate"
          >
            Generate
          </button>
        </div>
      </label>
      <button
        v-if="password"
        type="button"
        class="justify-self-start text-xs font-bold text-moss"
        @click="copyPassword"
      >
        <Copy :size="14" class="mr-1 inline" />Copy temporary password
      </button>
      <p
        v-if="error || localError"
        class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
      >
        {{ localError || error }}
      </p>
      <button
        class="btn-primary mt-2 w-full"
        :disabled="saving || Boolean(localError)"
      >
        <LoaderCircle v-if="saving" :size="17" class="animate-spin" />
        <KeyRound v-else :size="17" />
        {{ saving ? "Saving…" : "Reset credentials" }}
      </button>
    </form>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Copy, KeyRound, LoaderCircle } from "lucide-vue-next";
import type { Member } from "../api";
import { generateTemporaryPassword } from "../utils/passwordProof";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  open: boolean;
  member: Member | null;
  saving: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  submit: [email: string, password: string];
}>();
const email = ref("");
const password = ref("");
const localError = computed(() =>
  password.value && password.value.length < 8
    ? "Password must have at least 8 characters"
    : "",
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      email.value = props.member?.email || "";
      password.value = generateTemporaryPassword();
    } else {
      email.value = "";
      password.value = "";
    }
  },
);

function generate() {
  password.value = generateTemporaryPassword();
}
async function copyPassword() {
  await navigator.clipboard.writeText(password.value);
}
function close() {
  if (!props.saving) emit("close");
}
function submit() {
  if (!localError.value)
    emit("submit", email.value.trim().toLowerCase(), password.value);
}
</script>
