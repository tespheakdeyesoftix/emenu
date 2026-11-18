<template>
  <article
    class="mx-auto max-w-full space-y-2 break-words bg-white p-3 text-black shadow-sm"
    :aria-label="t('selling.receipts.preview')"
    :lang="template.language === 'km' ? 'km' : 'en'"
    :style="paperStyle"
  >
    <header :style="{ textAlign: template.heading_alignment }">
      <div v-if="shows('logo')" class="mb-1">
        <img v-if="store.business.logoUrl" :src="store.business.logoUrl" alt="" class="inline-block max-h-9 max-w-full object-contain" />
        <Store v-else :size="22" class="inline-block" aria-hidden="true" />
      </div>
      <p class="text-[1.25em] font-bold">{{ template.title || heading }}</p>
      <p v-if="shows('branch')">{{ tx("Main branch", "សាខាមេ") }}</p>
      <p v-if="shows('business_details')">
        {{ tx("Phnom Penh, Cambodia", "ភ្នំពេញ កម្ពុជា") }}<br />
        +855 00 000 000
      </p>
    </header>

    <template v-if="template.type === 'qr_label'">
      <div class="space-y-1 text-center">
        <p v-if="shows('table')" class="font-semibold">{{ tx("Table A12", "តុ A12") }}</p>
        <img
          v-if="qrImage"
          :src="qrImage"
          :width="template.qr.size_mm * 3"
          :style="{ width: Math.min(100, template.qr.size_mm / template.paper_width_mm * 100) + '%' }"
          :alt="t('selling.receipts.qrPreview')"
          class="mx-auto max-w-full"
        />
        <p v-if="qrError">{{ t("selling.receipts.qrUnavailable") }}</p>
        <p>{{ template.qr.caption || tx("Scan to open the menu", "ស្កេនដើម្បីមើលម៉ឺនុយ") }}</p>
        <p v-if="shows('show_link')" class="break-all text-[0.9em]">{{ qrUrl }}</p>
      </div>
    </template>

    <template v-else>
      <div v-if="metadata.length" class="space-y-0.5 border-y border-dashed border-black/30 py-2">
        <p v-for="entry in metadata" :key="entry">{{ entry }}</p>
      </div>
      <div v-if="shows('order_notes')" :class="noteStyle">
        {{ tx("Order note: serve together", "កំណត់ចំណាំ៖ បម្រើជាមួយគ្នា") }}
      </div>
      <div class="space-y-1.5">
        <div v-for="item in items" :key="item.code">
          <div class="flex justify-between gap-2">
            <p :class="template.type === 'kitchen_receipt' ? 'font-bold' : ''">
              {{ item.quantity }} × {{ tx(item.en, item.km) }}
            </p>
            <span v-if="template.type === 'receipt'" class="shrink-0">{{ money(item.price * item.quantity) }}</span>
          </div>
          <p v-if="shows('item_codes')">{{ item.code }}</p>
          <p v-if="template.type === 'receipt' && shows('unit_prices')">
            {{ tx("Each", "ក្នុងមួយ") }} {{ money(item.price) }}
          </p>
          <p v-if="item.modifier && shows('modifiers')">{{ tx("Oat milk", "ទឹកដោះគោអូត") }}</p>
          <p v-if="item.modifier && shows('item_notes')" :class="noteStyle">
            {{ tx("Less ice", "ទឹកកកតិច") }}
          </p>
        </div>
      </div>
      <div v-if="template.type === 'receipt'" class="space-y-0.5 border-t border-dashed border-black/30 pt-2">
        <div v-for="row in totals" :key="row.label" class="flex justify-between gap-2" :class="{ 'font-bold': row.bold }">
          <span>{{ row.label }}</span>
          <span class="shrink-0">{{ money(row.amount) }}</span>
        </div>
        <p v-if="shows('signature')" class="mt-3 border-t border-black/30 pt-1">
          {{ tx("Signature", "ហត្ថលេខា") }}
        </p>
      </div>
    </template>

    <p v-if="template.footer" class="whitespace-pre-line border-t border-dashed border-black/30 pt-2"
      :style="{ textAlign: template.heading_alignment }">{{ template.footer }}</p>
  </article>
</template>

<script setup lang="ts">
import { Store } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PosReceiptField, PosReceiptTemplate } from "../../../../shared/posReceipts";
import { useAdminStore } from "../stores/admin";
import { formatCurrency } from "../utils/currency";
import { createMenuQrCode } from "../utils/qrCode";

const props = defineProps<{ template: PosReceiptTemplate }>();
const store = useAdminStore();
const { t } = useI18n();

const tx = (english: string, khmer: string) => {
  const language = props.template.language;
  return language === "km" ? khmer : language === "bilingual" ? english + " / " + khmer : english;
};
const shows = (field: PosReceiptField) => props.template.fields.includes(field);
const money = (amount: number) => {
  const currency = store.business.currency;
  return formatCurrency(currency === "KHR" ? amount * 4_000 : amount, currency);
};
const heading = computed(() => {
  switch (props.template.type) {
    case "receipt":
      return store.business.name || tx("Sales receipt", "បង្កាន់ដៃលក់");
    case "kitchen_receipt":
      return tx("Kitchen order", "ការបញ្ជាទិញផ្ទះបាយ");
    case "qr_label":
      return store.business.name || tx("Menu", "ម៉ឺនុយ");
  }
});
const paperStyle = computed(() => ({
  width: props.template.paper_width_mm * 3.3 + "px",
  minHeight: props.template.type === "qr_label" ? props.template.qr.label_height_mm * 3.3 + "px" : undefined,
  fontSize: { small: "11px", normal: "12px", large: "15px" }[props.template.text_size],
}));
const noteStyle = computed(() => shows("highlight_notes") ? "bg-black px-1 font-bold text-white" : "italic");
const metadata = computed(() => [
  shows("order_number") && tx("Order #1042", "ការបញ្ជាទិញ #1042"),
  shows("date_time") && "14:30 · 18 Nov 2026",
  shows("table") && tx("Table A12", "តុ A12"),
  shows("service_type") && tx("Dine-in", "ញ៉ាំនៅហាង"),
  shows("cashier") && tx("Cashier: Dara", "អ្នកគិតលុយ៖ ដារ៉ា"),
  shows("customer") && tx("Customer: Walk-in", "អតិថិជន៖ ទូទៅ"),
  shows("station") && tx("Station: Kitchen", "ផ្នែក៖ ផ្ទះបាយ"),
].filter((entry): entry is string => Boolean(entry)));
const items = [
  { code: "CAF-01", en: "Iced coffee", km: "កាហ្វេទឹកកក", quantity: 2, price: 3.5, modifier: true },
  { code: "BKT-04", en: "Butter croissant", km: "នំប៉័ងប៊ឺ", quantity: 1, price: 2.5, modifier: false },
];
const totals = computed(() => [
  { label: tx("Subtotal", "សរុបរង"), amount: 9.5 },
  ...(shows("discount") ? [{ label: tx("Discount", "បញ្ចុះតម្លៃ"), amount: -0.5 }] : []),
  ...(shows("tax") ? [{ label: tx("Tax", "ពន្ធ"), amount: 0.9 }] : []),
  { label: tx("Total", "សរុប"), amount: 9.9, bold: true },
  ...(shows("payments") ? [{ label: tx("Cash", "សាច់ប្រាក់"), amount: 10 }] : []),
  ...(shows("change") ? [{ label: tx("Change", "ប្រាក់អាប់"), amount: 0.1 }] : []),
]);
const qrUrl = computed(() => {
  const qr = props.template.qr;
  if (!qr) return "";
  if (qr.target === "custom_url") return /^https?:\/\//i.test(qr.custom_url) ? qr.custom_url : "";
  return qr.target === "table_menu"
    ? "https://example.test/menu/sample?table=A12"
    : "https://example.test/menu/sample";
});
const qrImage = ref("");
const qrError = ref(false);
watch(qrUrl, async (url, _, onCleanup) => {
  qrImage.value = "";
  qrError.value = false;
  if (!url) return;
  let current = true;
  onCleanup(() => { current = false; });
  try {
    const image = await createMenuQrCode(url, 256);
    if (current) qrImage.value = image;
  } catch {
    if (current) qrError.value = true;
  }
}, { immediate: true });
</script>
