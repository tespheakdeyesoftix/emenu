import type { PaymentKind, PosCurrency, ProfileConfig } from "../../../../shared/posProfile";

export type PosProfile = {
  id: string;
  name: string;
  branch_id: string;
  branch_name: string;
  is_active: boolean;
  config: ProfileConfig;
  pending_config: ProfileConfig | null;
};

type NamedOption = { id: string; name: string };
export type CatalogOption = NamedOption & { parent_id: string | null };
export type PosTableGroup = NamedOption & { branch_id: string };
export type PosPaymentOption = NamedOption & { kind: PaymentKind; currency: PosCurrency | null };

export type PosProfileOptions = {
  branches: NamedOption[];
  table_groups: PosTableGroup[];
  categories: CatalogOption[];
  menus: CatalogOption[];
  payment_types: PosPaymentOption[];
  customers: NamedOption[];
};
