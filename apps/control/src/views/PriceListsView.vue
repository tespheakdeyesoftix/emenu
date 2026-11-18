<template>
  <div>
    <PageHeader :title="$t('pages.priceLists.title')">
      <Button variant="solid" size="lg" @click="openNew">
        <template #prefix><Plus :size="17" /></template>បញ្ជីតម្លៃថ្មី
      </Button>
    </PageHeader>

    <div class="mb-5 rounded-3xl bg-ink p-5 text-white">
      <p class="m-0 text-xs font-bold uppercase tracking-[.14em] text-white/45">
        តម្លៃម៉ឺនុយ QR បច្ចុប្បន្ន
      </p>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <h2 class="display m-0 text-2xl font-extrabold">
          {{ displayListName(activeList?.name) }}
        </h2>
        <Badge theme="green" variant="solid">កំពុងប្រើ</Badge>
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
              <Badge v-if="list.isNormal">បានការពារ</Badge>
              <Badge v-if="list.id === store.activePriceListId" theme="green">កំពុងប្រើ</Badge>
              <Badge v-if="list.isArchived" theme="gray">ប័ណ្ណសារ</Badge>
            </div>
            <p class="mb-0 mt-1 text-xs text-black/40">
              {{ scheduleText(list) }} · បានរក្សាទុក
              {{ Number(list.overrideCount || 0) }} តម្លៃ
            </p>
          </div>
          <Button variant="subtle" size="lg"
            class="!px-3"
            :aria-label="`កែសម្រួល ${list.name}`"
            @click="openEdit(list)"
          >
            <template #icon><Pencil :size="15" /></template>
          </Button>
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
          <TextInput size="lg" variant="outline"
            v-model.trim="form.name"
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
          <Checkbox
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
          <ScheduleDateTimePicker v-model="form.scheduleStartLocal" label="ចាប់ផ្តើម" />
          <ScheduleDateTimePicker v-model="form.scheduleEndLocal" label="បញ្ចប់" />
          <p class="m-0 text-xs leading-5 text-black/45 sm:col-span-2">
            ម៉ោងប្រើតំបន់ {{ store.business.timezone }}។
            ម៉ោងបញ្ចប់មិនត្រូវបានរាប់បញ្ចូលទេ។
          </p>
        </div>
        <label
          v-if="editingId && !form.isNormal"
          class="flex items-start gap-3 rounded-2xl border border-black/10 p-4 text-sm"
        >
          <Checkbox
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
        <Alert v-if="error" theme="red" :title="error" class="mt-2" />
      </form>

      <template #footer>
        <Button variant="solid" size="lg"
          type="submit"
          form="price-list-form"
          class="w-full"
          :disabled="saving"
        >
          {{ saving ? "កំពុងរក្សាទុក…" : "រក្សាទុកបញ្ជីតម្លៃ" }}
        </Button>
      </template>
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import { Badge, Alert, Button, Checkbox, TextInput } from "frappe-ui";
import { computed, reactive, ref } from "vue";
import { BadgeDollarSign, Pencil, Plus } from "lucide-vue-next";
import ScheduleDateTimePicker from "../components/ScheduleDateTimePicker.vue";
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
