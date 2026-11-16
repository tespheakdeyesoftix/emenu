<template>
  <Teleport to="body"
    ><div
      v-if="open"
      class="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      @click.self="closeOnBackdrop && $emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :class="[
          'flex w-full flex-col overflow-hidden bg-white shadow-[0_24px_80px_rgba(0,0,0,.18)]',
          size === 'large' ? 'sm:max-w-4xl lg:max-w-5xl' : 'max-w-lg',
          mobileFullscreen
            ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[1.25rem]'
            : 'max-h-[100dvh] rounded-t-[1.25rem] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[1.25rem]',
          fixedHeight && 'h-[min(44rem,100dvh)] sm:h-[min(44rem,calc(100dvh-2.5rem))]',
        ]"
      >
        <header
          :class="[
            'flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 bg-white px-5 py-4 sm:py-5',
            size === 'large' ? 'sm:px-8' : 'sm:px-7',
          ]"
        >
          <h2 :id="titleId" class="display m-0 min-w-0 text-2xl">
            {{ title }}
          </h2>
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full bg-cream transition hover:bg-ink/10"
            aria-label="Close dialog"
            @click="$emit('close')"
          >
            <X :size="18" />
          </button>
        </header>

        <div
          :class="[
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5',
            size === 'large' ? 'sm:px-8 sm:py-7' : 'sm:px-7 sm:py-6',
          ]"
        >
          <slot />
        </div>

        <footer
          v-if="$slots.footer"
          :class="[
            'shrink-0 border-t border-ink/10 bg-white px-5 py-4',
            size === 'large' ? 'sm:px-8' : 'sm:px-7',
          ]"
        >
          <slot name="footer" />
        </footer>
      </div></div
  ></Teleport>
</template>
<script lang="ts">
let lockedModalCount = 0;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";

function lockBodyScroll() {
  if (lockedModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0)
      document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  lockedModalCount += 1;
}

function unlockBodyScroll() {
  lockedModalCount = Math.max(0, lockedModalCount - 1);
  if (lockedModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
}
</script>

<script setup lang="ts">
import { X } from "lucide-vue-next";
import { onBeforeUnmount, useId, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    closeOnBackdrop?: boolean;
    size?: "default" | "large";
    mobileFullscreen?: boolean;
    fixedHeight?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
    size: "default",
    mobileFullscreen: false,
  },
);
defineEmits<{ close: [] }>();
const titleId = useId();

let ownsBodyLock = false;
watch(
  () => props.open,
  (open) => {
    if (open && !ownsBodyLock) {
      lockBodyScroll();
      ownsBodyLock = true;
    } else if (!open && ownsBodyLock) {
      unlockBodyScroll();
      ownsBodyLock = false;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (ownsBodyLock) unlockBodyScroll();
});
</script>
