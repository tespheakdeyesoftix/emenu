import { defineStore } from "pinia";
import type { PlanOffer } from "../../../../shared/subscriptionPlans";
import { AUTH_VERSION, createPasswordProof } from "../utils/passwordProof";
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const ADMIN = import.meta.env.VITE_ADMIN_URL || "http://localhost:5173";
export const useAuthStore = defineStore("auth", {
  state: () => ({
    modal: "" as "" | "register" | "login",
    loading: false,
    error: "",
    plans: [] as PlanOffer[],
    plansLoading: false,
    plansError: "",
    selectedPriceId: "",
  }),
  getters: {
    selectedPlan: (state) => state.plans.find(plan => plan.priceId === state.selectedPriceId),
  },
  actions: {
    open(type: "register" | "login", priceId = "") {
      this.modal = type;
      this.error = "";
      this.selectedPriceId = priceId;
      if (type === "register") void this.loadPlans();
    },
    close() {
      this.modal = "";
      this.error = "";
    },
    async loadPlans() {
      if (this.plansLoading) return;
      this.plansLoading = true;
      this.plansError = "";
      try {
        const response = await fetch(`${API}/api/public/subscription-plans`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        this.plans = (await response.json() as { plans: PlanOffer[] }).plans;
        if (!this.selectedPlan) this.selectedPriceId = "";
      } catch {
        this.plans = [];
        this.selectedPriceId = "";
        this.plansError = "មិនអាចផ្ទុកគម្រោងបានទេ។";
      } finally {
        this.plansLoading = false;
      }
    },
    async register(payload: Record<string, string>) {
      const plan = this.selectedPlan;
      if (!plan || this.plansLoading || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        if (payload.password !== payload.confirmPassword)
          throw new Error("ពាក្យសម្ងាត់ទាំងពីរមិនត្រូវគ្នា។");
        const passwordProof = await createPasswordProof(
          payload.email,
          payload.password,
        );
        const {
          password: _password,
          confirmPassword: _confirmPassword,
          ...profile
        } = payload;
        const r = await fetch(`${API}/api/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...profile,
            passwordProof,
            authVersion: AUTH_VERSION,
            planId: plan.id,
            priceId: plan.priceId,
          }),
        });
        const data = await r.json();
        if (!r.ok && data.code) {
          if (data.code === "PLAN_UNAVAILABLE") {
            this.selectedPriceId = "";
            await this.loadPlans();
            throw new Error("គម្រោង ឬតម្លៃបានផ្លាស់ប្តូរ។ សូមជ្រើសរើសគម្រោងម្តងទៀត។");
          }
          const messages: Record<string, string> = {
            INVALID_MENU_SLUG:
              "ឈ្មោះតំណម៉ឺនុយត្រូវមានពី ៣ ដល់ ៤៨ តួ និងប្រើតែអក្សរអង់គ្លេសតូច លេខ ឬសញ្ញា -។",
            MENU_SLUG_IN_USE:
              "ឈ្មោះតំណម៉ឺនុយនេះមានអ្នកប្រើរួចហើយ។ សូមជ្រើសរើសឈ្មោះផ្សេង។",
            EMAIL_IN_USE:
              "អ៊ីមែលនេះមានគណនីរួចហើយ។ សូមចូលគណនី ឬប្រើអ៊ីមែលផ្សេង។",
            REGISTRATION_CONFLICT:
              "អ៊ីមែល ឬឈ្មោះតំណម៉ឺនុយនេះមានអ្នកប្រើរួចហើយ។",
          };
          throw new Error(
            messages[String(data.code)] ||
              "មិនអាចបង្កើតគណនីបានទេ។ សូមពិនិត្យព័ត៌មាន ហើយសាកល្បងម្ដងទៀត។",
          );
        }
        if (!r.ok)
          throw new Error(
            "មិនអាចបង្កើតគណនីបានទេ។ សូមពិនិត្យព័ត៌មាន ហើយសាកល្បងម្ដងទៀត។",
          );
        location.href = `${ADMIN.replace(/\/$/, "")}#auth=${encodeURIComponent(data.token)}`;
      } catch (e) {
        this.error = e instanceof Error ? e.message : "មិនអាចបង្កើតគណនីបានទេ។";
      } finally {
        this.loading = false;
      }
    },
    async login(payload: Record<string, string>) {
      this.loading = true;
      this.error = "";
      try {
        const passwordProof = await createPasswordProof(
          payload.email,
          payload.password,
        );
        const r = await fetch(`${API}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: payload.email.trim().toLowerCase(),
            passwordProof,
            authVersion: AUTH_VERSION,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error("អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។");
        location.href = `${ADMIN.replace(/\/$/, "")}#auth=${encodeURIComponent(data.token)}`;
      } catch (e) {
        this.error = e instanceof Error ? e.message : "មិនអាចចូលគណនីបានទេ។";
      } finally {
        this.loading = false;
      }
    },
  },
});
