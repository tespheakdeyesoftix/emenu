<template>
  <Teleport to="body">
    <div
      v-if="auth.modal"
      class="fixed inset-0 z-50 grid place-items-end bg-black/45 backdrop-blur-sm sm:place-items-center sm:p-5"
      @click.self="auth.close"
    >
      <div
        class="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-cream p-6 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] sm:p-8"
      >
        <div class="mb-7 flex items-start justify-between gap-4">
          <div>
            <p class="m-0 text-xs font-bold tracking-[.12em] text-secondary">
              {{
                auth.modal === "register" ? "ចុះឈ្មោះ" : "សូមស្វាគមន៍"
              }}
            </p>
            <h2 class="display m-0 mt-2 text-2xl font-extrabold">
              {{
                auth.modal === "register" ? "បង្កើតម៉ឺនុយរបស់អ្នក" : "ចូលគណនី"
              }}
            </h2>
          </div>
          <button
            class="grid size-9 shrink-0 place-items-center rounded-full bg-white"
            aria-label="បិទ"
            @click="auth.close"
          >
            <X :size="18" />
          </button>
        </div>

        <form
          v-if="auth.modal === 'register'"
          class="space-y-4"
          @submit.prevent="submitRegistration"
        >
          <label class="block">
            <span class="mb-2 block text-sm font-bold">គម្រោងជាវ</span>
            <select v-model="auth.selectedPriceId" class="field w-full" required
              :disabled="auth.loading || auth.plansLoading || !auth.plans.length">
              <option value="" disabled>{{ auth.plansLoading ? "កំពុងផ្ទុកគម្រោង…" : "ជ្រើសរើសគម្រោង" }}</option>
              <option v-for="plan in auth.plans" :key="plan.id" :value="plan.priceId">
                {{ plan.name }} · {{ publicPlanPrice(plan) }}
              </option>
            </select>
          </label>
          <p v-if="auth.plansError" class="text-sm text-red-700" role="alert">
            {{ auth.plansError }} <button type="button" class="font-bold underline" @click="auth.loadPlans">សាកល្បងម្តងទៀត</button>
          </p>
          <p v-else-if="!auth.plansLoading && !auth.plans.length" class="text-sm text-black/60">មិនទាន់មានគម្រោងសម្រាប់ចុះឈ្មោះទេ។</p>
          <p v-else-if="auth.selectedPlan?.amountMinor" class="text-sm text-black/60">
            សាកល្បងឥតគិតថ្លៃ ៣០ ថ្ងៃ។ បន្តការជាវជាមួយអ្នកគ្រប់គ្រង។
          </p>
          <input
            v-model="register.displayName"
            class="field"
            autocomplete="name"
            aria-label="ឈ្មោះរបស់អ្នក"
            placeholder="ឈ្មោះរបស់អ្នក"
            required
          />
          <input
            v-model="register.businessName"
            class="field"
            autocomplete="organization"
            aria-label="ឈ្មោះភោជនីយដ្ឋាន ឬអាជីវកម្ម"
            placeholder="ឈ្មោះភោជនីយដ្ឋាន ឬអាជីវកម្ម"
            required
          />
          <label class="block">
            <span
              class="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-black/60"
            >
              <span>ឈ្មោះតំណម៉ឺនុយ</span>
              <span class="tabular-nums text-black/35"
                >{{ register.slug.length }}/48</span
              >
            </span>
            <div
              class="overflow-hidden rounded-2xl border bg-white transition focus-within:ring-4"
              :class="
                slugError
                  ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-100'
                  : 'border-black/10 focus-within:border-primary focus-within:ring-primary/20'
              "
            >
              <div
                class="truncate border-b border-black/[.06] bg-black/[.025] px-4 py-2 text-[11px] font-semibold text-black/40"
              >
                {{ menuUrlPrefix }}
              </div>
              <input
                :value="register.slug"
                class="w-full border-0 bg-transparent px-4 py-3 text-sm outline-none"
                aria-label="ឈ្មោះតំណម៉ឺនុយ"
                aria-required="true"
                :aria-invalid="Boolean(slugError)"
                :aria-describedby="
                  slugError
                    ? 'menu-slug-help menu-slug-error'
                    : 'menu-slug-help'
                "
                placeholder="angkor-kitchen"
                maxlength="48"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                @input="updateSlug"
                @blur="finishSlug"
              />
            </div>
            <p
              id="menu-slug-help"
              class="mb-0 mt-2 text-[11px] leading-5 text-black/45"
            >
              នេះជាផ្នែកចុងក្រោយនៃតំណដែលអតិថិជនប្រើដើម្បីបើកម៉ឺនុយ។
              ប្រើតែអក្សរអង់គ្លេសតូច លេខ និងសញ្ញា - ប៉ុណ្ណោះ។
              បើត្រូវការកែតំណក្រោយចុះឈ្មោះ សូមទាក់ទងអ្នកគ្រប់គ្រង។
            </p>
            <p
              v-if="slugError"
              id="menu-slug-error"
              class="mb-0 mt-1 text-[11px] font-bold leading-5 text-red-600"
            >
              {{ slugError }}
            </p>
            <p
              v-else-if="register.slug"
              class="mb-0 mt-1 break-all text-[11px] leading-5 text-secondary"
            >
              តំណម៉ឺនុយរបស់អ្នក៖ {{ fullMenuUrl }}
            </p>
          </label>
          <input
            v-model="register.email"
            class="field"
            type="email"
            autocomplete="email"
            aria-label="អ៊ីមែល"
            placeholder="អ៊ីមែល"
            required
          />
          <input
            v-model="register.password"
            class="field"
            type="password"
            autocomplete="new-password"
            minlength="8"
            aria-label="ពាក្យសម្ងាត់"
            placeholder="ពាក្យសម្ងាត់ ៨ តួឡើងទៅ"
            required
          />
          <input
            v-model="register.confirmPassword"
            class="field"
            type="password"
            autocomplete="new-password"
            minlength="8"
            aria-label="បញ្ជាក់ពាក្យសម្ងាត់"
            placeholder="បញ្ជាក់ពាក្យសម្ងាត់"
            required
          />
          <button class="btn-dark w-full" :disabled="auth.loading || auth.plansLoading || !auth.selectedPlan">
            {{ auth.loading ? "កំពុងបង្កើត…" : "បង្កើតម៉ឺនុយ" }}
            <ArrowRight :size="17" />
          </button>
        </form>

        <form v-else class="space-y-4" @submit.prevent="auth.login(login)">
          <input
            v-model="login.email"
            class="field"
            type="email"
            autocomplete="email"
            aria-label="អ៊ីមែល"
            placeholder="អ៊ីមែល"
            required
          />
          <input
            v-model="login.password"
            class="field"
            type="password"
            autocomplete="current-password"
            minlength="8"
            aria-label="ពាក្យសម្ងាត់"
            placeholder="ពាក្យសម្ងាត់"
            required
          />
          <button class="btn-dark w-full" :disabled="auth.loading">
            {{ auth.loading ? "កំពុងចូល…" : "ចូលគណនី" }}
            <ArrowRight :size="17" />
          </button>
        </form>

        <p
          v-if="auth.error"
          class="mt-4 rounded-xl bg-red-50 p-3 text-center text-xs font-bold text-red-700"
        >
          {{ auth.error }}
        </p>
        <p class="mb-0 mt-5 text-center text-xs leading-5 text-black/40">
          ដោយបន្ត អ្នកយល់ព្រមនឹងលក្ខខណ្ឌ និងគោលការណ៍ឯកជនភាព។
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ArrowRight, X } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { publicPlanPrice } from "../utils/subscriptionPlans";

const auth = useAuthStore();
const menuBaseUrl = import.meta.env.VITE_MENU_URL || "http://localhost:5174";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugTouched = ref(false);
const register = reactive({
  displayName: "",
  businessName: "",
  slug: "",
  email: "",
  password: "",
  confirmPassword: "",
});
const login = reactive({ email: "", password: "" });

const menuUrlPrefix = computed(
  () => `${menuBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}/`,
);
const fullMenuUrl = computed(
  () => `${menuBaseUrl.replace(/\/$/, "")}/${register.slug}`,
);
const slugError = computed(() => {
  if (!slugTouched.value && !register.slug) return "";
  if (!register.slug) return "សូមបញ្ចូលឈ្មោះតំណម៉ឺនុយ។";
  if (register.slug.length < 3 || register.slug.length > 48)
    return "ឈ្មោះតំណម៉ឺនុយត្រូវមានពី ៣ ដល់ ៤៨ តួអក្សរ។";
  if (!slugPattern.test(register.slug))
    return "ប្រើតែអក្សរអង់គ្លេសតូច លេខ និងសញ្ញា - ដោយមិនដាក់ - នៅដើម ឬចុង។";
  return "";
});

function normalizeSlug(value: string, trimEnd = false) {
  const normalized = value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
  return trimEnd ? normalized.replace(/-+$/, "") : normalized;
}

function updateSlug(event: Event) {
  register.slug = normalizeSlug((event.target as HTMLInputElement).value);
}

function finishSlug() {
  register.slug = normalizeSlug(register.slug, true);
  slugTouched.value = true;
}

async function submitRegistration() {
  finishSlug();
  if (slugError.value) return;
  await auth.register(register);
}
</script>
