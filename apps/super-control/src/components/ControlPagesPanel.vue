<template>
  <section class="panel p-6" aria-labelledby="control-pages-title">
    <div class="flex items-start gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-lime/40">
        <PanelLeft :size="18" />
      </span>
      <div>
        <h2 id="control-pages-title" class="display m-0 text-xl font-extrabold">
          Control app sidebar
        </h2>
        <p class="mb-0 mt-1 text-sm leading-6 text-black/55">
          Turn off a page to hide it from this business’s sidebar and block direct links.
        </p>
      </div>
    </div>

    <form class="mt-5 grid gap-4" @submit.prevent="save">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn-soft"
          :disabled="saving || enabledPages.length === sidebarPages.length"
          @click="enabledPages = [...sidebarPages]"
        >
          Turn all on
        </button>
        <button
          type="button"
          class="btn-soft"
          :disabled="saving || !enabledPages.length"
          @click="enabledPages = []"
        >
          Turn all off
        </button>
      </div>
      <fieldset class="m-0 grid min-w-0 gap-2 border-0 p-0 sm:grid-cols-2" :disabled="saving">
        <legend class="sr-only">Enabled Control app pages</legend>
        <label
          v-for="page in sidebarPages"
          :key="page"
          class="flex cursor-pointer items-center gap-3 rounded-xl bg-cream px-3 py-2.5 text-sm font-bold"
        >
          <input
            v-model="enabledPages"
            :value="page"
            class="size-4 shrink-0 accent-ink"
            type="checkbox"
          />
          {{ controlPages[page].label }}
        </label>
      </fieldset>
      <p v-if="!enabledPages.length" class="m-0 text-xs leading-5 text-black/55">
        All Control app pages will be unavailable to this business.
      </p>
      <p v-if="error" class="m-0 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700" role="alert">
        {{ error }}
      </p>
      <button type="submit" class="btn-primary w-full" :disabled="saving || !dirty">
        <LoaderCircle v-if="saving" :size="16" class="animate-spin" />
        <Save v-else :size="16" />
        {{ saving ? "Saving…" : "Save sidebar settings" }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { LoaderCircle, PanelLeft, Save } from "lucide-vue-next";
import { controlPageIds, controlPages, type ControlPage } from "../../../../shared/controlPages";
import { api } from "../api";
import { useSuperStore } from "../stores/super";

const props = defineProps<{ business: { id: string; disabledControlPages: ControlPage[] } }>();
const emit = defineEmits<{ saved: [disabledControlPages: ControlPage[]] }>();
const store = useSuperStore();
const sidebarPages = controlPageIds.filter((page) => page !== "bookings");
const enabledPages = ref<ControlPage[]>(sidebarPages.filter(
  (page) => !props.business.disabledControlPages.includes(page),
));
const disabledPages = computed(() => sidebarPages.filter((page) => !enabledPages.value.includes(page)));
const dirty = computed(() =>
  disabledPages.value.length !== props.business.disabledControlPages.length ||
  disabledPages.value.some((page) => !props.business.disabledControlPages.includes(page)),
);
const saving = ref(false);
const error = ref("");

async function save() {
  if (saving.value || !dirty.value) return;
  saving.value = true;
  error.value = "";
  try {
    const result = await api<{ disabledControlPages: ControlPage[] }>(
      `/api/super/businesses/${props.business.id}/control-pages`,
      { method: "PUT", body: JSON.stringify({ disabledControlPages: disabledPages.value }) },
    );
    emit("saved", result.disabledControlPages);
    store.notify("Sidebar settings saved");
  } catch (value) {
    error.value = value instanceof Error ? value.message : "Could not save sidebar settings";
  } finally {
    saving.value = false;
  }
}
</script>
