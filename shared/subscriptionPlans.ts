import type { ControlPage } from "./controlPages";

export type PlanLimits = {
  branches: number | null;
  menus: number | null;
  products: number | null;
  dailyOrders: number | null;
};

export const MAX_DAILY_ORDERS = 999;

export type PlanPos = {
  enabled: boolean;
  profiles: number | null;
  dailySales: number | null;
};

export type PlanOffer = {
  id: string;
  code: string;
  name: string;
  description: string;
  features: ControlPage[];
  limits: PlanLimits;
  pos: PlanPos;
  priceId: string;
  amountMinor: number;
  billingInterval: "month" | "year";
};

export type ManagedPlan = PlanOffer & {
  displayOrder: number;
  isPublic: boolean;
  isActive: boolean;
  assignedBusinesses: number;
};

export const planPrice = (amountMinor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountMinor / 100);
