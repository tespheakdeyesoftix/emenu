export const posReceiptTypes = ["receipt", "kitchen_receipt", "qr_label"] as const;
export const posReceiptLanguages = ["en", "km", "bilingual"] as const;
export const posReceiptTextSizes = ["small", "normal", "large"] as const;
export const posReceiptAlignments = ["left", "center", "right"] as const;
export const posQrTargets = ["table_menu", "business_menu", "custom_url"] as const;

export const posReceiptFields = {
  receipt: [
    "logo", "business_details", "branch", "order_number", "date_time",
    "cashier", "customer", "table", "service_type", "item_codes", "modifiers",
    "item_notes", "unit_prices", "discount", "tax", "payments", "change",
    "order_notes", "signature",
  ],
  kitchen_receipt: [
    "logo", "branch", "order_number", "date_time", "cashier", "table",
    "service_type", "station", "item_codes", "modifiers", "item_notes",
    "order_notes", "highlight_notes",
  ],
  qr_label: ["logo", "branch", "table", "show_link"],
} as const;

export const posReceiptLimits = {
  width: { min: 30, max: 216 },
  labelHeight: { min: 20, max: 150 },
  qrSize: { min: 15, max: 150 },
  copies: { min: 1, max: 10 },
} as const;

export type PosReceiptType = (typeof posReceiptTypes)[number];
export type PosReceiptField = (typeof posReceiptFields)[PosReceiptType][number];
export type PosReceiptDefaults = Record<PosReceiptType, string | null>;

export const emptyPosReceiptDefaults: PosReceiptDefaults = {
  receipt: null,
  kitchen_receipt: null,
  qr_label: null,
};

type ReceiptTemplateBase = {
  id: string;
  name: string;
  language: (typeof posReceiptLanguages)[number];
  paper_width_mm: number;
  print_copies: number;
  title: string;
  footer: string;
  text_size: (typeof posReceiptTextSizes)[number];
  heading_alignment: (typeof posReceiptAlignments)[number];
  fields: PosReceiptField[];
};

export type PosReceiptTemplate = ReceiptTemplateBase & (
  | { type: "receipt" | "kitchen_receipt"; qr?: never }
  | {
      type: "qr_label";
      qr: {
        label_height_mm: number;
        size_mm: number;
        target: (typeof posQrTargets)[number];
        custom_url: string;
        caption: string;
      };
    }
);

export type PosReceiptSettings = {
  receipt_templates: PosReceiptTemplate[];
  default_receipt_templates: PosReceiptDefaults;
};
