<template>
  <main class="grid min-h-screen bg-ink lg:grid-cols-2">
    <section
      class="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col"
    >
      <div
        class="absolute inset-0 bg-cover bg-center opacity-50"
        style="
          background-image:
            linear-gradient(rgba(15, 20, 16, 0.25), rgba(15, 20, 16, 0.8)),
            url(&quot;https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85&quot;);
        "
      ></div>
      <BrandMark class="relative z-10 text-white" />
      <LanguageSwitcher class="absolute right-8 top-8 z-20 text-ink" />
      <div class="relative z-10 mt-auto max-w-lg">
        <p class="mb-4 text-sm font-medium text-mint">
          {{ t("auth.tagline") }}
        </p>
        <h1 class="display text-5xl leading-[1.3]">
          {{ t("auth.heroTitle") }}
        </h1>
        <p class="text-lg leading-8 text-white/60">
          {{ t("auth.heroBody") }}
        </p>
      </div>
    </section>
    <section class="grid place-items-center bg-cream p-6">
      <form
        class="w-full max-w-md rounded-[1.25rem] border border-black/[0.06] bg-white p-7 shadow-[0_18px_60px_rgba(24,32,28,.09)] sm:p-10"
        @submit.prevent="login"
      >
        <div class="mb-8 flex items-start justify-between gap-3 lg:hidden">
          <BrandMark :subtitle="t('auth.dashboard')" />
          <LanguageSwitcher />
        </div>
        <p class="eyebrow mb-2">{{ t("auth.welcomeBack") }}</p>
        <h2 class="display mb-2 mt-0 text-3xl">{{ t("auth.title") }}</h2>
        <p class="mb-8 mt-0 text-sm text-black/45">
          {{ t("auth.subtitle") }}
        </p>
        <label
          ><span class="label">{{ t("auth.email") }}</span
          ><TextInput size="lg" variant="outline"
            v-model="email"
            class="mb-4"
            type="email"
            required
            autocomplete="email"
            placeholder="you@restaurant.com" /></label
        ><label
          ><span class="label">{{ t("auth.password") }}</span
          ><Password size="lg" variant="outline"
            v-model="password"
            required
            autocomplete="current-password"
            minlength="8"
            placeholder="••••••••"
        /></label>
        <div class="my-5 flex items-center justify-between text-sm">
          <label class="flex items-center gap-2"
            ><Checkbox type="checkbox" class="accent-black" />{{
              t("auth.remember")
            }}</label
          >
          <Button href="#" target="_self" variant="ghost" :label="t('auth.forgot')" />
        </div>
        <Button variant="solid" size="lg" type="submit" class="w-full" :disabled="loading">
          {{ loading ? t("auth.signingIn") : t("auth.signIn")
          }}<ArrowRight :size="17" />
        </Button>
        <Alert v-if="error" theme="red" :title="error" class="mt-4" />
      </form>
    </section>
  </main>
</template>
<script setup lang="ts">
import { Password, Alert, Button, Checkbox, TextInput } from "frappe-ui";
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowRight } from "lucide-vue-next";
import BrandMark from "../components/BrandMark.vue";
import LanguageSwitcher from "../components/LanguageSwitcher.vue";
import { AUTH_VERSION, createPasswordProof } from "../utils/passwordProof";
import { khmerError } from "../utils/khmer";
import { telegramOrderQuery } from "../utils/telegramOrderLink";
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");
async function login() {
  loading.value = true;
  error.value = "";
  try {
    const passwordProof = await createPasswordProof(
      email.value,
      password.value,
    );
    const r = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: email.value.trim().toLowerCase(),
        passwordProof,
        authVersion: AUTH_VERSION,
      }),
    });
    const data = await r.json();
    if (!r.ok)
      throw new Error(
        locale.value === "km"
          ? khmerError(data.error, t("auth.failed"))
          : data.error || t("auth.failed"),
      );
    localStorage.setItem("mf_token", data.token);
    const orderAlert = telegramOrderQuery(route.query);
    void router.push(orderAlert ? { name: "orders", query: orderAlert } : "/");
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? locale.value === "km"
          ? khmerError(caught.message, t("auth.failed"))
          : caught.message
        : t("auth.failed");
  } finally {
    loading.value = false;
  }
}
</script>
