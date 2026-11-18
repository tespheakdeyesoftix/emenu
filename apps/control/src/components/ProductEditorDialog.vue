<template>
  <ModalPanel
    :open="productOpen"
    :close-on-backdrop="false"
    size="large"
    mobile-fullscreen
    :title="editingProductId ? 'កែសម្រួលមុខម្ហូប' : 'បន្ថែមមុខម្ហូប'"
    @close="!saving && dismissProduct()"
  >

    <form id="catalog-product-form" novalidate @submit.prevent="submitProduct">
      <SettingsTabs v-model="productTab" :tabs="productTabs" :label="t('pages.catalog.productTabs.label')">
      <TabPanel as="section" :force-mount="true" value="details"
        data-product-tab="details"
        class="data-[state=inactive]:hidden grid gap-4 sm:grid-cols-2"
      >
        <label class="sm:col-span-2"
          ><span class="label">ឈ្មោះមុខម្ហូប · ខ្មែរ</span
          ><TextInput size="lg" variant="outline"
            v-model="newProduct.nameKm"
            required
            lang="km"
            placeholder="ឧ. ប៊ឺហ្គឺសាច់គោ"
        /></label>
        <label v-if="store.business.enableEn"
          ><span class="label">ឈ្មោះមុខម្ហូប · អង់គ្លេស </span
          ><TextInput size="lg" variant="outline"
            v-model="newProduct.nameEn"
            placeholder="e.g. Beef burger"
        /></label>
        <label v-if="store.business.enableZh"
          ><span class="label">ឈ្មោះមុខម្ហូប · ចិន </span
          ><TextInput size="lg" variant="outline"
            v-model="newProduct.nameZh"
            lang="zh"
            placeholder="例如：牛肉汉堡"
        /></label>
        <label class="sm:col-span-2"
          ><span class="label">លេខកូដមុខម្ហូប </span
          ><TextInput size="lg" variant="outline"
            v-model.trim="newProduct.code"
            class="uppercase"
            maxlength="64"
            autocomplete="off"
            placeholder="ឧ. BURGER-001"
        /></label>
        <div>
          <label for="catalog-product-category" class="label">
            {{ t("pages.catalog.productCategory.label") }}
            <span class="text-red-600" aria-hidden="true">*</span>
          </label>
          <Button
            variant="outline" size="lg"
            id="catalog-product-category"
            ref="categoryButton"
            type="button"
            class="w-full !justify-between text-start"
            aria-haspopup="dialog"
            :aria-expanded="categoryPickerOpen"
            @click="openCategoryPicker"
          >
            <span class="truncate">
              {{
                selectedCategory
                  ? categoryLabel(selectedCategory)
                  : t("pages.catalog.productCategory.choose")
              }}
            </span>
            <template #suffix><ChevronDown :size="16" class="shrink-0" aria-hidden="true" /></template>
          </Button>
        </div>
        <div v-if="store.canAccessPage('menus')">
          <span class="label">{{ t('nav.menus') }}</span>
          <Button
            variant="subtle" size="lg"
            ref="menuButton"
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="menuPickerOpen"
            @click="menuPickerOpen = true"
          >
            {{ t("menus.choose") }} · {{ t("menus.selected", { count: productMenuIds.length }) }}
          </Button>
        </div>
        <label
          ><span class="label">ឯកតា </span
          ><TextInput size="lg" variant="outline"
            v-model.trim="newProduct.unit"
            maxlength="40"
            placeholder="ឧ. ចាន កែវ នាក់"
        /></label>
        <label
          ><span class="label">{{ t("pages.catalog.productRating") }}</span
          ><TextInput size="lg" variant="outline"
            v-model.number="newProduct.rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            placeholder="4.9"
          />
          <small class="mt-1 block text-xs text-black/40">
            {{ t("pages.catalog.productRatingHelp") }}
          </small></label
        >
        <label class="sm:col-span-2"
          ><span class="label">លំដាប់បង្ហាញ</span
          ><TextInput size="lg" variant="outline"
            v-model.number="newProduct.sortOrder"
            type="number"
            min="0"
            step="1"
        /></label>
        <label class="sm:col-span-2"
          ><span class="label">ការពិពណ៌នា</span
          ><Textarea size="lg" variant="outline"
            v-model="newProduct.description"
            class="resize-none"
            :rows="3"
          ></Textarea>
        </label>
        <div class="sm:col-span-2">
          <ImageUploader
            v-model="newProduct.images"
            v-model:primary-id="newProduct.primaryMediaId"
            label="រូបថតមុខម្ហូប "
            :max="5"
          />
        </div>
        <label
          class="sm:col-span-2 flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
          ><Checkbox
            v-model="newProduct.isFeatured"
            type="checkbox"
            class="size-4 accent-black"
          />ដាក់មុខម្ហូបនេះជាមុខម្ហូបពិសេស</label
        >
        <label
          class="sm:col-span-2 flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <Checkbox
            v-model="newProduct.isAvailable"
            type="checkbox"
            class="size-4 accent-black"
          />
          បង្ហាញមុខម្ហូបនេះលើម៉ឺនុយ QR
        </label>
      </TabPanel>
      <TabPanel as="section" :force-mount="true" value="prices"
        data-product-tab="prices"
        class="data-[state=inactive]:hidden space-y-4"
      >
        <label class="block sm:max-w-md"
          ><span class="label">{{
            newProduct.portions.length
              ? "តម្លៃទាបបំផុត · ស្វ័យប្រវត្តិ"
              : "តម្លៃ"
          }}</span
          ><TextInput size="lg" variant="outline"
            v-model.number="newProduct.priceCents"
            type="number"
            min="0"
            :step="store.business.currency === 'USD' ? '0.01' : '1'"
            required
            :disabled="newProduct.portions.length > 0"
          />
          <small
            v-if="newProduct.portions.length"
            class="mt-1 block text-xs text-black/40"
          >
            តម្លៃអតិបរមា៖ {{ money(productMaxPrice) }}
          </small></label
        >
        <div class="rounded-2xl border border-black/[.08] bg-cream p-4">
          <PortionEditor
            v-model="newProduct.portions"
            :enable-en="store.business.enableEn"
            :enable-zh="store.business.enableZh"
            :currency="store.business.currency"
          />
        </div>
        <div class="overflow-x-auto rounded-2xl border border-black/[.08] bg-cream p-4">
          <div
            v-if="activePriceLists.length === 1 && store.canAccessPage('priceLists')"
            class="mb-4 flex flex-col gap-3 rounded-2xl border border-dashed border-black/10 bg-white p-4 text-xs leading-5 text-black/50 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              បង្កើតបញ្ជីតម្លៃបន្ថែម ដើម្បីកំណត់តម្លៃពិសេសសម្រាប់មុខម្ហូបនេះ។
            </span>
            <Button
              route="/price-lists"
              variant="outline"
              class="shrink-0"
              @click="closeProduct"
            >
              បង្កើតបញ្ជីតម្លៃ
            </Button>
          </div>
          <List class="w-full [--list-gap:0px] rounded-4 border border-outline-gray-1 bg-surface-base" :columns="priceColumns" :style="{ minWidth: (10 + activePriceLists.length * 11) + 'rem' }">
            <ListHeader class="!h-auto min-h-9 bg-surface-gray-1 py-2 text-ink-gray-7">

                <ListHeaderCell class="px-2">គោលដៅតម្លៃ</ListHeaderCell>
                <ListHeaderCell v-for="list in activePriceLists" :key="list.id" class="px-2">
                  {{ displayPriceListName(list.name) }}
                </ListHeaderCell>

            </ListHeader>

              <ListRow v-for="row in productPricingRows" :key="row.targetKey">
                <ListCell role="rowheader" class="px-2 font-medium">{{ row.label }}</ListCell>
                <ListCell v-for="list in activePriceLists" :key="list.id" class="!block px-2 py-2">
                  <div
                    v-if="list.isNormal"
                    class="rounded-xl bg-white px-3 py-2 font-bold"
                  >
                    {{ money(row.normalPrice) }}
                  </div>
                  <div v-else class="min-w-40">
                    <label
                      class="mb-2 flex cursor-pointer items-center gap-2 text-[11px] font-bold text-black/55"
                    >
                      <Checkbox
                        type="checkbox"
                        class="size-4 accent-black"
                        :model-value="
                          priceOverrideEnabled(list.id, row.targetKey)
                        "
                        @change="togglePriceOverride(list.id, row, $event)"
                      />
                      ប្រើតម្លៃផ្ទាល់ខ្លួន
                    </label>
                    <TextInput size="lg" variant="outline"
                      v-model.number="
                        priceDrafts[priceDraftKey(list.id, row.targetKey)]
                      "
                      type="number"
                      min="0"
                      :step="store.business.currency === 'USD' ? '0.01' : '1'"
                      class="!rounded-xl !px-3 !py-2"
                      :disabled="
                        !priceOverrideEnabled(list.id, row.targetKey)
                      "
                      :placeholder="String(row.normalPrice)"
                    />
                    <small
                      v-if="!priceOverrideEnabled(list.id, row.targetKey)"
                      class="mt-1 block text-[10px] text-black/35"
                      >ប្រើតម្លៃធម្មតា {{ money(row.normalPrice) }}</small
                    >
                  </div>
                </ListCell>
              </ListRow>

          </List>
        </div>
      </TabPanel>
      <TabPanel as="section" :force-mount="true" value="modifiers"
        data-product-tab="modifiers"
        class="data-[state=inactive]:hidden rounded-2xl border border-black/[.08] bg-cream p-4"
      >
        <ModifierGroupEditor
          v-model="newProduct.modifierGroups"
          :enable-en="store.business.enableEn"
          :enable-zh="store.business.enableZh"
          :currency="store.business.currency"
        />
      </TabPanel>
      </SettingsTabs>
    </form>

    <template #footer>
      <Alert v-if="formError" theme="red" :title="formError" class="mb-2 mt-0" />
      <div :class="editingProductId ? '' : 'grid gap-2 sm:grid-cols-2'">
        <Button variant="subtle" size="lg"
          v-if="!editingProductId"
          type="submit"
          form="catalog-product-form"
          name="submitAction"
          value="save-and-new"
          class="w-full"
          :disabled="saving"
        >
          {{ saving ? "កំពុងរក្សាទុក…" : "រក្សាទុក និងបន្ថែមថ្មី" }}
        </Button>
        <Button variant="solid" size="lg"
          type="submit"
          form="catalog-product-form"
          name="submitAction"
          value="save"
          class="w-full"
          :disabled="saving"
        >
          {{
            saving
              ? "កំពុងរក្សាទុក…"
              : editingProductId
                ? "រក្សាទុកមុខម្ហូប"
                : "បន្ថែមមុខម្ហូប"
          }}
        </Button>
      </div>
    </template>
  </ModalPanel>
  <ModalPanel
    :open="categoryPickerOpen"
    :title="t('pages.catalog.productCategory.choose')"
    @close="closeCategoryPicker"
  >
    <label class="mb-3 block">
      <span class="sr-only">{{ t("pages.catalog.productCategory.search") }}</span>
      <TextInput size="lg" variant="outline"
        ref="categorySearchInput"
        v-model="categorySearch"
        type="search"
        :placeholder="t('pages.catalog.productCategory.search')"
      />
    </label>
    <Alert v-if="!matchingCategories.length" :title="t('pages.catalog.productCategory.noMatches')" />
    <div v-else class="space-y-1">
      <Button
        v-for="item in matchingCategories"
        :key="item.id"
        type="button"
        size="lg"
        class="w-full !justify-between text-start"
        :variant="item.id === newProduct.categoryId ? 'solid' : 'ghost'"
        :aria-pressed="item.id === newProduct.categoryId"
        @click="chooseCategory(item.id)"
      >
        <span>{{ categoryLabel(item) }}</span>
        <template #suffix><Check v-if="item.id === newProduct.categoryId" :size="16" aria-hidden="true" /></template>
      </Button>
    </div>
  </ModalPanel>
  <ProductMenuPicker
    v-if="menuPickerOpen"
    :selected-ids="productMenuIds"
    @close="closeMenuPicker"
    @save="applyMenuPicker"
  />
</template>

<script setup lang="ts">
import { List, ListCell, ListHeader, ListHeaderCell, ListRow } from "frappe-ui/list";
import { Alert, Button, Checkbox, TabPanel, TextInput, Textarea } from "frappe-ui";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Check, ChevronDown } from "lucide-vue-next";
import { descriptionText } from "../../../../shared/descriptionText";
import {
  useAdminStore,
  type Category,
  type MediaImage,
  type Product,
  type ProductModifierGroup,
  type ProductPortion,
  type ProductPriceEntry,
} from "../stores/admin";
import { formatCurrency } from "../utils/currency";
import ImageUploader from "./ImageUploader.vue";
import ModalPanel from "./ModalPanel.vue";
import ModifierGroupEditor from "./ModifierGroupEditor.vue";
import PortionEditor from "./PortionEditor.vue";
import ProductMenuPicker from "./ProductMenuPicker.vue";
import SettingsTabs from "./SettingsTabs.vue";

const props = defineProps<{ categories: Category[]; initialMenuId?: string }>();
const emit = defineEmits<{
  close: [];
  saved: [wasEditing: boolean, keepOpen: boolean];
}>();
const { t } = useI18n();
const store = useAdminStore();
const saving = ref(false);
const formError = ref("");
const editingProductId = ref("");
const storedDescription = ref("");
const productOpen = ref(false);
const productTab = ref("details");
const productTabs = computed(() => [
  { id: "details", label: t("pages.catalog.productTabs.details") },
  { id: "prices", label: t("pages.catalog.productTabs.prices") },
  { id: "modifiers", label: t("pages.catalog.productTabs.modifiers") },
]);
const productMenuIds = ref<string[]>([]);
const localMenuDraft = ref<string[]>();
const menuPickerOpen = ref(false);
const menuButton = ref<InstanceType<typeof Button>>();

function closeMenuPicker() {
  menuPickerOpen.value = false;
  (menuButton.value?.$el as HTMLButtonElement | undefined)?.focus();
}
function applyMenuPicker(ids: string[], localIds: string[]) {
  productMenuIds.value = ids;
  localMenuDraft.value = localIds;
  closeMenuPicker();
}

const newProduct = reactive({
  code: "",
  rating: "" as number | "",
  nameKm: "",
  nameEn: "",
  nameZh: "",
  categoryId: "",
  priceCents: 25000,
  unit: "",
  portions: [] as ProductPortion[],
  modifierGroups: [] as ProductModifierGroup[],
  description: "",
  images: [] as MediaImage[],
  primaryMediaId: "",
  isFeatured: false,
  isAvailable: true,
  mediaIds: [] as string[],
  imageUrl: "",
  sortOrder: 0,
});
const categoryPickerOpen = ref(false);
const categorySearch = ref("");
const categoryButton = ref<InstanceType<typeof Button>>();
const categorySearchInput = ref<InstanceType<typeof TextInput>>();
const selectedCategory = computed(() =>
  props.categories.find(({ id }) => id === newProduct.categoryId),
);
const matchingCategories = computed(() => {
  const term = categorySearch.value.trim().toLowerCase();
  if (!term) return props.categories;
  return props.categories.filter(({ name, nameKm, nameEn, nameZh }) =>
    [name, nameKm, nameEn, nameZh].some((value) => value?.toLowerCase().includes(term)),
  );
});

function categoryLabel(item: Category) {
  return [
    ...new Set([
      item.nameKm || item.name,
      store.business.enableEn && item.nameEn,
      store.business.enableZh && item.nameZh,
    ].filter(Boolean)),
  ].join(" / ");
}

async function openCategoryPicker() {
  categorySearch.value = "";
  categoryPickerOpen.value = true;
  await nextTick();
  categorySearchInput.value?.focus();
}

function closeCategoryPicker() {
  categoryPickerOpen.value = false;
  (categoryButton.value?.$el as HTMLButtonElement | undefined)?.focus();
}

function chooseCategory(id: string) {
  newProduct.categoryId = id;
  closeCategoryPicker();
}
type RememberedProductFields = {
  categoryId: string;
  priceCents: number;
  unit: string;
};
const productDefaultsStorageKey = computed(
  () =>
    `angkor_emenu_product_defaults:${store.business.id || store.business.slug || "default"}`,
);

function readRememberedProductFields(): RememberedProductFields | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(productDefaultsStorageKey.value) || "null",
    ) as Partial<RememberedProductFields> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const priceCents = Number(parsed.priceCents);
    return {
      categoryId: String(parsed.categoryId || ""),
      priceCents:
        Number.isFinite(priceCents) && priceCents >= 0 ? priceCents : 25000,
      unit: String(parsed.unit || "")
        .trim()
        .slice(0, 40),
    };
  } catch {
    return null;
  }
}

function rememberProductFields() {
  const values: RememberedProductFields = {
    categoryId: newProduct.categoryId,
    priceCents: Number(newProduct.priceCents || 0),
    unit: newProduct.unit.trim().slice(0, 40),
  };
  try {
    localStorage.setItem(
      productDefaultsStorageKey.value,
      JSON.stringify(values),
    );
  } catch {
    // Product creation still succeeds when browser storage is unavailable.
  }
}
const priceColumns = computed(() => ["minmax(10rem,1fr)", ...activePriceLists.value.map(() => "minmax(11rem,1fr)")]);
const priceDrafts = reactive<Record<string, string>>(Object.create(null));
type ProductPricingRow = {
  targetKey: string;
  portionId: string | null;
  label: string;
  normalPrice: number;
};
const activePriceLists = computed(() =>
  store.priceLists.filter((list) => !list.isArchived),
);
const portionPricingRows = computed<ProductPricingRow[]>(() =>
  newProduct.portions.map((portion) => ({
    targetKey: portion.id,
    portionId: portion.id as string | null,
    label: portion.labelKm || "ទំហំគ្មានឈ្មោះ",
    normalPrice: Number(portion.priceCents || 0),
  })),
);
const productPricingRows = computed<ProductPricingRow[]>(() =>
  portionPricingRows.value.length
    ? portionPricingRows.value
    : [
        {
          targetKey: "base",
          portionId: null,
          label: "តម្លៃ",
          normalPrice: Number(newProduct.priceCents || 0),
        },
      ],
);
const productMaxPrice = computed(() =>
  newProduct.portions.length
    ? Math.max(
        ...newProduct.portions.map((portion) =>
          Number(portion.priceCents || 0),
        ),
      )
    : Number(newProduct.priceCents || 0),
);
const priceDraftKey = (priceListId: string, targetKey: string) =>
  `${priceListId}:${targetKey}`;

function priceOverrideEnabled(priceListId: string, targetKey: string) {
  return (
    String(priceDrafts[priceDraftKey(priceListId, targetKey)] ?? "").trim() !==
    ""
  );
}

function togglePriceOverride(
  priceListId: string,
  row: ProductPricingRow,
  event: Event,
) {
  const enabled = (event.target as HTMLInputElement).checked;
  priceDrafts[priceDraftKey(priceListId, row.targetKey)] = enabled
    ? String(row.normalPrice)
    : "";
}

function clearPriceDrafts() {
  Object.keys(priceDrafts).forEach((key) => delete priceDrafts[key]);
}

function loadProductPriceDrafts(productId: string, priceEntries: ProductPriceEntry[]) {
  clearPriceDrafts();
  for (const entry of priceEntries.filter(
    (item) => item.productId === productId,
  )) {
    const targetKey = entry.portionId || "base";
    priceDrafts[priceDraftKey(entry.priceListId, targetKey)] = String(
      entry.priceCents,
    );
  }
}

function productPriceEntries() {
  return activePriceLists.value
    .filter((list) => !list.isNormal)
    .flatMap((list) =>
      productPricingRows.value.map((row) => {
        const raw = String(
          priceDrafts[priceDraftKey(list.id, row.targetKey)] ?? "",
        ).trim();
        return {
          priceListId: list.id,
          portionId: row.portionId,
          priceCents: raw === "" ? null : Number(raw),
        };
      }),
    );
}

const money = (amount: number) =>
  formatCurrency(amount, store.business.currency);
const displayPriceListName = (name: string) =>
  name === "Normal Rate" ? "តម្លៃធម្មតា" : name;

watch(
  () => newProduct.portions.map((portion) => Number(portion.priceCents || 0)),
  (prices) => {
    if (prices.length) newProduct.priceCents = Math.min(...prices);
  },
  { deep: true },
);

function resetProduct(useRememberedFields = false) {
  productTab.value = "details";
  editingProductId.value = "";
  storedDescription.value = "";
  productMenuIds.value = [];
  localMenuDraft.value = undefined;
  Object.assign(newProduct, {
    code: "",
    rating: "",
    nameKm: "",
    nameEn: "",
    nameZh: "",
    categoryId: "",
    priceCents: 25000,
    unit: "",
    portions: [],
    modifierGroups: [],
    description: "",
    images: [],
    primaryMediaId: "",
    isFeatured: false,
    isAvailable: true,
    mediaIds: [],
    imageUrl: "",
    sortOrder: 0,
  });
  if (useRememberedFields) {
    const remembered = readRememberedProductFields();
    const rememberedCategoryExists = props.categories.some(
      (item) => item.id === remembered?.categoryId,
    );
    newProduct.categoryId = rememberedCategoryExists
      ? remembered!.categoryId
      : props.categories[0]?.id || "";
    if (remembered) {
      newProduct.priceCents = remembered.priceCents;
      newProduct.unit = remembered.unit;
    }
  }
  clearPriceDrafts();
}
function resetNewProduct() {
  resetProduct(true);
  const menuId = props.initialMenuId;
  if (menuId) {
    productMenuIds.value = [menuId];
    localMenuDraft.value = [menuId];
  }
}
function openNewProduct() {
  resetNewProduct();
  formError.value = "";
  productOpen.value = true;
}
function openEditProduct(item: Product, priceEntries: ProductPriceEntry[]) {
  productTab.value = "details";
  editingProductId.value = item.id;
  storedDescription.value = item.description || "";
  productMenuIds.value = [...(item.menuIds ?? [])];
  localMenuDraft.value = undefined;
  const images = item.images?.length
    ? item.images
    : item.primaryMediaId && item.imageUrl
      ? [{ id: item.primaryMediaId, url: item.imageUrl, isPrimary: true }]
      : [];
  Object.assign(newProduct, {
    code: item.code || "",
    rating: item.rating ?? "",
    nameKm: item.nameKm || item.name,
    nameEn: item.nameEn || "",
    nameZh: item.nameZh || "",
    categoryId: item.categoryId,
    priceCents: item.priceCents,
    unit: item.unit || "",
    portions: (item.portions || []).map((portion) => ({ ...portion })),
    modifierGroups: (item.modifierGroups || []).map((group) => ({
      ...group,
      options: group.options.map((option) => ({ ...option })),
    })),
    description: descriptionText(storedDescription.value),
    images: [...images],
    primaryMediaId:
      item.primaryMediaId || images.find((image) => image.isPrimary)?.id || "",
    isFeatured: Boolean(item.isFeatured),
    isAvailable: item.isAvailable !== 0 && item.isAvailable !== false,
    mediaIds: images.map((image) => image.id),
    imageUrl: item.imageUrl || "",
    sortOrder: Number(item.sortOrder ?? 0),
  });
  loadProductPriceDrafts(item.id, priceEntries);
  formError.value = "";
  productOpen.value = true;
}

function closeProduct() {
  productOpen.value = false;
  categoryPickerOpen.value = false;
  menuPickerOpen.value = false;
  formError.value = "";
  resetProduct();
}
function dismissProduct() {
  closeProduct();
  emit("close");
}
async function submitProduct(event: SubmitEvent) {
  if (saving.value || categoryPickerOpen.value || menuPickerOpen.value) return;
  const form = event.currentTarget as HTMLFormElement;
  if (!form.checkValidity()) {
    const invalidControl = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:invalid, select:invalid, textarea:invalid");
    const invalidTab = invalidControl?.closest<HTMLElement>("[data-product-tab]")
      ?.dataset.productTab;
    if (invalidTab) productTab.value = invalidTab;
    await nextTick();
    invalidControl?.reportValidity();
    return;
  }

  if (!newProduct.categoryId) {
    productTab.value = "details";
    formError.value = t("pages.catalog.productCategory.required");
    await nextTick();
    (categoryButton.value?.$el as HTMLButtonElement | undefined)?.focus();
    return;
  }

  const submitter = event.submitter as HTMLButtonElement | null;
  await saveProduct(submitter?.value === "save-and-new");
}

async function saveProduct(saveAndNew = false) {
  const rating =
    newProduct.rating === "" || newProduct.rating == null
      ? null
      : Number(newProduct.rating);
  if (
    rating != null &&
    (!Number.isFinite(rating) || rating < 0 || rating > 5)
  ) {
    productTab.value = "details";
    formError.value = t("pages.catalog.invalidProductRating");
    return;
  }
  if (newProduct.images.length > 0 && !newProduct.primaryMediaId) {
    productTab.value = "details";
    formError.value = "សូមជ្រើសរើសរូបថតមួយជារូបចម្បង។";
    return;
  }
  const missingPortionLabel = newProduct.portions.some(
    (portion) =>
      !portion.labelKm.trim() ||
      !Number.isFinite(Number(portion.priceCents)) ||
      Number(portion.priceCents) < 0,
  );
  if (missingPortionLabel) {
    productTab.value = "prices";
    formError.value = "ទំហំទាំងអស់ត្រូវមានឈ្មោះជាភាសាខ្មែរ និងតម្លៃត្រឹមត្រូវ។";
    return;
  }
  const invalidModifierGroup = newProduct.modifierGroups.some(
    (group) =>
      !group.labelKm.trim() ||
      !group.options.length ||
      group.options.some(
        (option) =>
          !option.labelKm.trim() ||
          (option.priceCents != null && !Number.isFinite(Number(option.priceCents))),
      ),
  );
  if (invalidModifierGroup) {
    productTab.value = "modifiers";
    formError.value = "គ្រប់ក្រុម និងជម្រើសបន្ថែមត្រូវមានឈ្មោះជាភាសាខ្មែរ។";
    return;
  }
  const priceEntries = productPriceEntries();
  if (
    priceEntries.some(
      (entry) =>
        entry.priceCents != null &&
        (!Number.isFinite(entry.priceCents) || entry.priceCents < 0),
    )
  ) {
    productTab.value = "prices";
    formError.value = "តម្លៃក្នុងបញ្ជីត្រូវតែស្មើសូន្យ ឬធំជាងសូន្យ។";
    return;
  }
  saving.value = true;
  formError.value = "";
  const wasEditing = Boolean(editingProductId.value);
  try {
    const primary = newProduct.images.find(
      (image) => image.id === newProduct.primaryMediaId,
    );
    const payload = {
      ...newProduct,
      description: newProduct.description === descriptionText(storedDescription.value)
        ? storedDescription.value
        : newProduct.description,
      menuIds: localMenuDraft.value,
      rating,
      name: newProduct.nameKm,
      maxPrice: productMaxPrice.value,
      mediaIds: newProduct.images.map((image) => image.id),
      imageUrl: primary?.url || "",
      priceEntries,
    };
    if (editingProductId.value)
      await store.updateProduct(editingProductId.value, payload);
    else {
      await store.addProduct(payload);
      rememberProductFields();
    }
    const keepOpen = saveAndNew && !wasEditing;
    if (keepOpen) resetNewProduct();
    else closeProduct();
    emit("saved", wasEditing, keepOpen);
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "មិនអាចរក្សាទុកមុខម្ហូបបានទេ";
  } finally {
    saving.value = false;
  }
}

defineExpose({ productOpen, openNewProduct, openEditProduct });
</script>
