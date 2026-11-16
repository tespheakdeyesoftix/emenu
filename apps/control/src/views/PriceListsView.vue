<template>
  <div>
    <PageHeader
      :eyebrow="$t('pages.priceLists.eyebrow')"
      :title="$t('pages.priceLists.title')"
      :description="$t('pages.priceLists.description')"
    >
      <button class="btn-primary" @click="openNew">
        <Plus :size="17" />បញ្ជីតម្លៃថ្មី
      </button>
    </PageHeader>

    <div class="mb-5 rounded-3xl bg-ink p-5 text-white">
      <p class="m-0 text-xs font-bold uppercase tracking-[.14em] text-white/45">
        តម្លៃម៉ឺនុយ QR បច្ចុប្បន្ន
      </p>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <h2 class="display m-0 text-2xl font-extrabold">
          {{ displayListName(activeList?.name) }}
        </h2>
        <span
          class="rounded-full bg-mint px-3 py-1 text-xs font-extrabold text-ink"
          >កំពុងប្រើ</span
        >
      </div>
      <p class="mb-0 mt-2 text-sm text-white/55">
        {{
          store.business.pricingMode === "manual"
            ? "បានកំណត់ដោយដៃពីព័ត៌មានអាជីវកម្ម។"
            : "បានជ្រើសស្វ័យប្រវត្តិតាមកាលវិភាគ និងបញ្ជីតម្លៃបម្រុង។"
        }}
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <article
        v-for="list in store.priceLists"
        :key="list.id"
        class="card p-5"
        :class="list.isArchived ? 'opacity-60' : ''"
      >
        <div class="flex items-start gap-3">
          <div
            class="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream"
          >
            <BadgeDollarSign :size="21" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="display m-0 text-lg font-extrabold">
                {{ displayListName(list.name) }}
              </h2>
              <span
                v-if="list.isNormal"
                class="rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold"
                >បានការពារ</span
              >
              <span
                v-if="list.id === store.activePriceListId"
                class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700"
                >កំពុងប្រើ</span
              >
              <span
                v-if="list.isArchived"
                class="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
                >ប័ណ្ណសារ</span
              >
            </div>
            <p class="mb-0 mt-1 text-xs text-black/40">
              {{ scheduleText(list) }} · បានរក្សាទុក
              {{ Number(list.overrideCount || 0) }} តម្លៃ
            </p>
          </div>
          <button
            class="btn-soft !px-3"
            :aria-label="`កែសម្រួល ${list.name}`"
            @click="openEdit(list)"
          >
            <Pencil :size="15" />
          </button>
        </div>
      </article>
    </div>

    <ModalPanel
      :open="modalOpen"
      :title="editingId ? 'កែសម្រួលបញ្ជីតម្លៃ' : 'បញ្ជីតម្លៃថ្មី'"
      @close="closeModal"
    >
      <form id="price-list-form" class="space-y-4" @submit.prevent="save">
        <label>
          <span class="label">ឈ្មោះ</span>
          <input
            v-model.trim="form.name"
            class="input"
            maxlength="80"
            required
            :disabled="form.isNormal"
            placeholder="បុណ្យចូលឆ្នាំខ្មែរ"
          />
        </label>
        <label
          v-if="!form.isNormal"
          class="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <input
            v-model="form.scheduleEnabled"
            type="checkbox"
            class="size-4 accent-black"
          />
          បើកប្រើបញ្ជីនេះតាមកាលវិភាគ
        </label>
        <div
          v-if="form.scheduleEnabled && !form.isNormal"
          class="grid gap-4 sm:grid-cols-2"
        >
          <label
            ><span class="label">ចាប់ផ្តើម</span
            ><input
              v-model="form.scheduleStartLocal"
              type="datetime-local"
              class="input"
              required
          /></label>
          <label
            ><span class="label">បញ្ចប់</span
            ><input
              v-model="form.scheduleEndLocal"
              type="datetime-local"
              class="input"
              required
          /></label>
          <p class="m-0 text-xs leading-5 text-black/45 sm:col-span-2">
            ម៉ោងប្រើតំបន់ {{ store.business.timezone }}។
            ម៉ោងបញ្ចប់មិនត្រូវបានរាប់បញ្ចូលទេ។
          </p>
        </div>
        <label
          v-if="editingId && !form.isNormal"
          class="flex items-start gap-3 rounded-2xl border border-black/10 p-4 text-sm"
        >
          <input
            v-model="form.isArchived"
            type="checkbox"
            class="mt-0.5 size-4 accent-black"
          />
          <span
            ><strong class="block">Achive this Price List</strong
            ><small class="text-black/45"
              >បញ្ជីដែលដាក់ក្នុង Archive List
              នឹងមិនបង្ហាញក្នុងការកំណត់តម្លៃមុខម្ហូប
              ប៉ុន្តែតម្លៃនៅតែរក្សាទុក។</small
            ></span
          >
        </label>
        <p
          v-if="error"
          class="m-0 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700"
        >
          {{ error }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="price-list-form"
          class="btn-primary w-full"
          :disabled="saving"
        >
          {{ saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកបញ្ជីតម្លៃ" }}
        </button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { BadgeDollarSign, Pencil, Plus } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import ModalPanel from "../components/ModalPanel.vue";
import { useAdminStore, type PriceList } from "../stores/admin";

const store = useAdminStore();
const modalOpen = ref(false);
const editingId = ref("");
const saving = ref(false);
const error = ref("");
const emptyForm = () => ({
  name: "",
  isNormal: false,
  scheduleEnabled: false,
  scheduleStartLocal: "",
  scheduleEndLocal: "",
  isArchived: false,
});
const form = reactive(emptyForm());
const activeList = computed(() =>
  store.priceLists.find((list) => list.id === store.activePriceListId),
);

function scheduleText(list: PriceList) {
  if (list.isNormal) return "តម្លៃធម្មតាបម្រុង";
  if (!list.scheduleEnabled) return "គ្មានកាលវិភាគស្វ័យប្រវត្តិ";
  return `${String(list.scheduleStartLocal).replace("T", " ")} → ${String(list.scheduleEndLocal).replace("T", " ")}`;
}
function displayListName(name?: string) {
  return !name || name === "Normal Rate" ? "តម្លៃធម្មតា" : name;
}
function openNew() {
  editingId.value = "";
  Object.assign(form, emptyForm());
  error.value = "";
  modalOpen.value = true;
}
function openEdit(list: PriceList) {
  editingId.value = list.id;
  Object.assign(form, {
    name: list.name,
    isNormal: Boolean(list.isNormal),
    scheduleEnabled: Boolean(list.scheduleEnabled),
    scheduleStartLocal: list.scheduleStartLocal || "",
    scheduleEndLocal: list.scheduleEndLocal || "",
    isArchived: Boolean(list.isArchived),
  });
  error.value = "";
  modalOpen.value = true;
}
function closeModal() {
  if (!saving.value) modalOpen.value = false;
}
async function save() {
  saving.value = true;
  error.value = "";
  try {
    if (editingId.value) await store.updatePriceList(editingId.value, form);
    else await store.createPriceList(form);
    modalOpen.value = false;
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? caught.message
        : "មិនអាចរក្សាទុកបញ្ជីតម្លៃបានទេ។";
  } finally {
    saving.value = false;
  }
}
</script>
