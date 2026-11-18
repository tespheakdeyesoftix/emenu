import type { PaymentKind, PaymentTypeGroup, PosCurrency, ProfileConfigView } from "../../../../shared/posProfile";

export type PosProfile = {
  id: string;
  name: string;
  branch_id: string;
  branch_name: string;
  is_active: boolean;
  config: ProfileConfigView;
  pending_config: ProfileConfigView | null;
};

type NamedOption = { id: string; name: string };
export type CatalogOption = NamedOption & { parent_id: string | null };
export type PosTableGroup = NamedOption & { branch_id: string };
export type PosPaymentOption = NamedOption & { kind: PaymentKind; payment_type_group?: PaymentTypeGroup | null; currency: PosCurrency | null };

export type PosProfileOptions = {
  branches: NamedOption[];
  table_groups: PosTableGroup[];
  categories: CatalogOption[];
  menus: CatalogOption[];
  payment_types: PosPaymentOption[];
  customers: NamedOption[];
};
