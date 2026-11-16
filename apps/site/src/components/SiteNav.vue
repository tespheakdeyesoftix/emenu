<template>
  <header class="fixed inset-x-0 top-0 z-40 px-4 py-4">
    <nav
      class="mx-auto flex h-16 max-w-6xl items-center rounded-full border border-secondary/25 bg-cream/90 px-4 shadow-[0_10px_40px_rgba(33,23,16,.12)] backdrop-blur-xl sm:px-6"
      aria-label="ម៉ឺនុយមេ"
    >
      <BrandLogo />
      <div
        class="mx-auto hidden items-center gap-7 text-sm font-bold text-black/55 md:flex"
      >
        <a href="#features" class="text-inherit no-underline">មុខងារ</a>
        <a href="#how" class="text-inherit no-underline">របៀបប្រើ</a>
        <a href="#pricing" class="text-inherit no-underline">តម្លៃ</a>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="hidden rounded-full px-4 py-2.5 text-sm font-bold sm:block"
          @click="auth.open('login')"
        >
          ចូលគណនី
        </button>
        <button
          class="rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ink"
          @click="auth.open('register')"
        >
          ចាប់ផ្ដើម
        </button>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
</script>
