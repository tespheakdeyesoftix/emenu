export type PosCurrency = "USD" | "KHR";
export type PaymentKind = "cash" | "card" | "qr" | "other";

export type ProfileConfig = {
  working_day_enabled: boolean;
  cashier_shift_enabled: boolean;
  table_mode: "disabled" | "optional" | "required";
  table_group_ids?: string[] | null;
  catalog_mode: "menu" | "category";
  selected_ids: string[] | null;
  payment_types: {
    id: string;
    currencies: PosCurrency[];
    allow_cash_float?: boolean;
  }[];
  default_payment_type_id: string;
  default_customer_id: string;
  receipt_template: { title: string; footer: string; show_tax: boolean };
  print_copies: number;
  tax_mode: "disabled" | "inclusive" | "exclusive";
  tax_rate_bps: number;
};
