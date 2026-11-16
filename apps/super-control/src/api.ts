import type { ControlPage } from "../../../shared/controlPages";
import type { ManagedPlan } from "../../../shared/subscriptionPlans";

export type SessionIdentity = { email: string };
export type PosIntegration = {
  name: string;
  keyPrefix: string;
  lastSyncedAt: string | null;
  lastSourceUpdatedAt: string | null;
  createdAt: string;
};
export type PosIntegrationResponse = {
  integration: PosIntegration | null;
  syncUrl: string;
};
export type PosIntegrationKeyResponse = PosIntegrationResponse & {
  apiKey: string;
  message: string;
};
export type Dashboard = {
  totals: {
    users: number;
    businesses: number;
    active: number;
    disabled: number;
    expired: number;
    expiringSoon: number;
    unlimited: number;
  };
  recentBusinesses: BusinessListItem[];
  recentActivity: Activity[];
};
export type SubscriptionSummary = {
  planCode: string;
  planName: string;
  source: "manual" | "provider";
  status: "trialing" | "active" | "expired" | "unlimited";
  expiresAt: string | null;
  expiresOn: string | null;
  daysRemaining: number | null;
  readOnly: boolean;
};
export type BusinessListItem = {
  id: string;
  name: string;
  slug: string;
  isActive: number | boolean;
  ownerEmail: string;
  createdAt: string;
  updatedAt?: string;
  memberCount?: number;
  productCount?: number;
  subscription: SubscriptionSummary;
};
export type Activity = {
  id: string;
  actorEmail: string;
  action: string;
  businessId?: string;
  userId?: string;
  createdAt: string;
  details: Record<string, unknown>;
};
export type Member = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
};
export type NewMemberAccount = {
  displayName: string;
  email: string;
  password: string;
};
export type OrderingSettings = {
  latitude: number | null;
  longitude: number | null;
  enableSubmitOrder: boolean;
  orderRadiusMeters: number;
  hourlyDeviceOrderLimit: number;
};
export type BusinessDetail = {
  business: BusinessListItem & OrderingSettings & {
    subscriptionPlanId: string | null;
    tagline: string;
    description: string;
    phone: string;
    address: string;
    contactEmail: string;
    websiteUrl: string;
    customMenuUrl: string;
    allowCategoryBrowsing: boolean;
    disabledControlPages: ControlPage[];
    currency: string;
    locale: string;
    timezone: string;
  };
  members: Member[];
  counts: {
    products: number;
    categories: number;
    banners: number;
    tables: number;
    members: number;
  };
};
export type CloneSection =
  "categories" | "products" | "pricing" | "theme" | "businessSettings";
export type CloneCounts = {
  categories: number;
  products: number;
  priceLists: number;
  productPrices: number;
};
export type ClonePreview = {
  source: { id: string; name: string };
  target: { id: string; name: string };
  effectiveSections: CloneSection[];
  sourceCounts: CloneCounts;
  targetCounts: CloneCounts;
  referencedMediaCount: number;
  warnings: string[];
  blockers: string[];
  canClone: boolean;
};
export type CloneResult = {
  auditId: string;
  sourceBusinessId: string;
  targetBusinessId: string;
  effectiveSections: CloneSection[];
  copied: CloneCounts & { media: number };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok)
    throw new ApiError(
      String(payload.error || "Request failed"),
      response.status,
      payload.code ? String(payload.code) : undefined,
    );
  return payload as T;
}

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const loadSubscriptionPlans = () =>
  api<{ plans: ManagedPlan[] }>("/api/super/subscription-plans");
