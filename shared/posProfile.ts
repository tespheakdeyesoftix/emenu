import type { PosReceiptSettings } from "./posReceipts";

export type PosCurrency = "USD" | "KHR";
export type PaymentKind = "cash" | "card" | "qr" | "other";

export const paymentKindByGroup = {
  Cash: "cash",
  "Credit Card": "card",
  Bank: "other",
  "QR Payment": "qr",
  Other: "other",
} as const satisfies Record<string, PaymentKind>;

export type PaymentTypeGroup = keyof typeof paymentKindByGroup;
export const paymentTypeGroups = Object.keys(paymentKindByGroup) as PaymentTypeGroup[];
export const defaultPaymentGroup: Record<PaymentKind, PaymentTypeGroup> = {
  cash: "Cash",
  card: "Credit Card",
  qr: "QR Payment",
  other: "Other",
};

export const posTaxModes = ["disabled", "inclusive", "exclusive"] as const;
export type PosTaxMode = (typeof posTaxModes)[number];

export type PosTaxRule = {
  id: string;
  tax_name: string;
  tax_mode: PosTaxMode;
  tax_1_name: string;
  tax_1_rate: number;
  calculate_tax_1_after_discount: boolean;
  tax_2_name: string;
  tax_2_rate: number;
  calculate_tax_2_after_adding_tax_1: boolean;
  calculate_tax_2_after_discount: boolean;
  tax_3_name: string;
  tax_3_rate: number;
  calculate_tax_3_after_adding_tax_1: boolean;
  calculate_tax_3_after_adding_tax_2: boolean;
  calculate_tax_3_after_discount: boolean;
};

export const posTableStatusColors = {
  vacant: "#2F7656",
  occupied: "#245EB2",
  bill_requested: "#B45309",
  hold: "#6B4AA0",
  booked: "#AE356C",
} as const;
export type PosTableStatus = keyof typeof posTableStatusColors;
export type PosTableStatusColors = Record<PosTableStatus, string>;
export const posTableStatuses = Object.keys(posTableStatusColors) as PosTableStatus[];

export type ProfileConfig = PosReceiptSettings & {
  working_day_enabled: boolean;
  cashier_shift_enabled: boolean;
  table_mode: "disabled" | "optional" | "required";
  table_group_ids?: string[] | null;
  prompt_guest_cover?: boolean;
  table_status_colors?: PosTableStatusColors;
  catalog_mode: "menu" | "category";
  selected_ids: string[] | null;
  default_menu_id: string | null;
  payment_types: {
    id: string;
    currency: PosCurrency;
    allow_cash_float?: boolean;
  }[];
  default_payment_type_id: string;
  default_customer_id: string;
  receipt_template: { title: string; footer: string; show_tax: boolean };
  print_copies: number;
  tax_mode: PosTaxMode;
  tax_rate_bps: number;
  tax_rules: PosTaxRule[];
  default_tax_rule_id: string | null;
};

export type ProfileConfigView = ProfileConfig & { default_tax_rule: PosTaxRule | null };
