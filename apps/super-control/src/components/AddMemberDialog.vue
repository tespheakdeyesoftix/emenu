<template>
  <ModalPanel :open="open" title="Add a sub-account" @close="close">
    <form class="grid gap-4" @submit.prevent="submit">
      <p class="m-0 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        Create a manager login for this business. Share the temporary password
        securely after the account is created.
      </p>

      <label>
        <span class="label">Account name</span>
        <input
          v-model.trim="displayName"
          class="input"
          maxlength="120"
          autocomplete="off"
          placeholder="Manager or staff name"
          required
        />
      </label>

      <label>
        <span class="label">Login email</span>
        <input
          v-model.trim="email"
          class="input"
          type="email"
          maxlength="254"
          autocomplete="off"
          placeholder="manager@example.com"
          required
        />
      </label>

      <label>
        <span class="label">Temporary password</span>
        <div class="flex gap-2">
          <input
            v-model="password"
            class="input min-w-0 font-mono"
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
        <Copy :size="14" class="mr-1 inline" />
        {{ copied ? "Copied" : "Copy temporary password" }}
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
        <UserPlus v-else :size="17" />
        {{ saving ? "Creating…" : "Create sub-account" }}
      </button>
    </form>
  </ModalPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Copy, LoaderCircle, UserPlus } from "lucide-vue-next";
import type { NewMemberAccount } from "../api";
import { generateTemporaryPassword } from "../utils/passwordProof";
import ModalPanel from "./ModalPanel.vue";

const props = defineProps<{
  open: boolean;
  saving: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  submit: [account: NewMemberAccount];
}>();

const displayName = ref("");
const email = ref("");
const password = ref("");
const copied = ref(false);
const localError = computed(() =>
  password.value && password.value.length < 8
    ? "Password must have at least 8 characters"
    : "",
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      displayName.value = "";
      email.value = "";
      password.value = generateTemporaryPassword();
      copied.value = false;
    }
  },
);

function generate() {
  password.value = generateTemporaryPassword();
  copied.value = false;
}

async function copyPassword() {
  await navigator.clipboard.writeText(password.value);
  copied.value = true;
}

function close() {
  if (!props.saving) emit("close");
}

function submit() {
  if (localError.value) return;
  emit("submit", {
    displayName: displayName.value.trim(),
    email: email.value.trim().toLowerCase(),
    password: password.value,
  });
}
</script>
