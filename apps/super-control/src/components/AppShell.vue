<template>
  <div class="min-h-screen lg:flex">
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-black/[.06] bg-ink p-5 text-white lg:flex"
    >
      <RouterLink to="/" class="flex items-center gap-3 rounded-2xl px-2 py-3">
        <span
          class="grid size-11 place-items-center rounded-2xl bg-lime text-ink"
          ><ShieldCheck :size="22"
        /></span>
        <span
          ><strong class="display block text-lg">Super Control</strong
          ><small class="text-white/45">Angkor eMenu</small></span
        >
      </RouterLink>
      <nav class="mt-10 space-y-2">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
          active-class="!bg-white !text-ink"
        >
          <component :is="item.icon" :size="18" />{{ item.label }}
        </RouterLink>
      </nav>
      <div
        class="mt-auto rounded-2xl border border-white/10 bg-white/[.05] p-4"
      >
        <p
          class="m-0 text-[10px] font-bold uppercase tracking-[.14em] text-white/35"
        >
          Protected by Cloudflare
        </p>
        <p class="mb-0 mt-2 truncate text-sm font-bold">
          {{ store.identity?.email || "Verifying…" }}
        </p>
        <button
          type="button"
          class="mt-3 text-xs font-bold text-lime"
          @click="store.signOut"
        >
          Sign out
        </button>
      </div>
    </aside>
    <div class="min-w-0 flex-1 lg:ml-[272px]">
      <header
        class="sticky top-0 z-20 flex h-[72px] items-center border-b border-black/[.06] bg-canvas/90 px-5 backdrop-blur-xl lg:px-9"
      >
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full bg-white lg:hidden"
          aria-label="Toggle navigation"
          @click="mobile = !mobile"
        >
          <Menu :size="20" />
        </button>
        <div class="ml-3 lg:ml-0">
          <p
            class="m-0 text-xs font-bold uppercase tracking-[.14em] text-black/35"
          >
            Owner operations
          </p>
          <p class="m-0 text-sm font-bold">Private administration</p>
        </div>
        <div
          class="ml-auto flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800"
        >
          <LockKeyhole :size="14" />Access verified
        </div>
      </header>
      <nav
        v-if="mobile"
        class="fixed inset-x-4 top-20 z-40 rounded-3xl bg-ink p-3 text-white shadow-2xl lg:hidden"
      >
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold"
          @click="mobile = false"
        >
          <component :is="item.icon" :size="18" />{{ item.label }}
        </RouterLink>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-lime"
          @click="store.signOut"
        >
          <LogOut :size="18" />Sign out
        </button>
      </nav>
      <main class="p-5 lg:p-9"><RouterView /></main>
    </div>
    <Transition
      enter-active-class="transition"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition"
      leave-to-class="translate-y-3 opacity-0"
    >
      <div
        v-if="store.toast"
        class="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white shadow-2xl"
      >
        <CheckCircle2 :size="17" class="mr-2 inline" />{{ store.toast }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Building2,
  CheckCircle2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PlusCircle,
  ShieldCheck,
  Tags,
} from "lucide-vue-next";
import { useSuperStore } from "../stores/super";
const store = useSuperStore();
const mobile = ref(false);
const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/businesses", label: "Businesses", icon: Building2 },
  { to: "/businesses/new", label: "Register business", icon: PlusCircle },
  { to: "/subscription-plans", label: "Subscription plans", icon: Tags },
];
onMounted(() => store.loadIdentity());
</script>
