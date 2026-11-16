import { controlPageIds } from "../../../shared/controlPages";
import { MAX_DAILY_ORDERS, type PlanLimits, type PlanOffer, type PlanPos } from "../../../shared/subscriptionPlans";

export const DEFAULT_PLAN_ID = "plan_standard";

// Only the current manual USD price is offered to new businesses.
export const planOfferJoin = `
  JOIN subscription_plan_prices price ON price.id=(
    SELECT id FROM subscription_plan_prices
    WHERE plan_id=plan.id AND is_active=1 AND currency='USD'
      AND provider IS NULL AND interval_count=1
    ORDER BY created_at DESC,id DESC LIMIT 1
  )`;
export const planOfferFields = `
  plan.id,plan.code,plan.name,plan.description,plan.features_json AS featuresJson,
  plan.max_branches AS maxBranches,plan.max_menus AS maxMenus,
  plan.max_products AS maxProducts,plan.max_daily_orders AS maxDailyOrders,
  plan.pos_enabled AS posEnabled,plan.max_pos_profiles AS maxPosProfiles,
  plan.max_daily_pos_sales AS maxDailyPosSales,
  price.id AS priceId,price.amount_minor AS amountMinor,price.billing_interval AS billingInterval`;

export const planFeatures = (value: string) => {
  try {
    const keys: unknown = JSON.parse(value);
    return Array.isArray(keys) ? controlPageIds.filter(key => keys.includes(key)) : [];
  } catch {
    return [];
  }
};

export type PlanOfferRow = Omit<PlanOffer, "features" | "limits" | "pos"> & {
  featuresJson: string;
  maxBranches: number | null;
  maxMenus: number | null;
  maxProducts: number | null;
  maxDailyOrders: number | null;
  posEnabled: number;
  maxPosProfiles: number | null;
  maxDailyPosSales: number | null;
};

export const serializePlan = <T extends PlanOfferRow>(
  {
    featuresJson, maxBranches, maxMenus, maxProducts, maxDailyOrders,
    posEnabled, maxPosProfiles, maxDailyPosSales, ...row
  }: T,
) => ({
  ...row,
  features: planFeatures(featuresJson),
  limits: { branches: maxBranches, menus: maxMenus, products: maxProducts, dailyOrders: maxDailyOrders },
  pos: { enabled: Boolean(posEnabled), profiles: maxPosProfiles, dailySales: maxDailyPosSales },
});

const isLimit = (input: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): input is number | null =>
  input === null || (typeof input === "number" && Number.isSafeInteger(input) && input >= minimum && input <= maximum);

export function parsePlanLimits(value: unknown): PlanLimits | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { branches, menus, products, dailyOrders } = value as Record<string, unknown>;
  if (Object.keys(value).length !== 4 || !isLimit(branches, 1) || !isLimit(menus, 0) ||
    !isLimit(products, 0) || !isLimit(dailyOrders, 0, MAX_DAILY_ORDERS)) return null;
  return { branches, menus, products, dailyOrders };
}

export function parsePlanPos(value: unknown): PlanPos | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { enabled, profiles, dailySales } = value as Record<string, unknown>;
  if (Object.keys(value).length !== 3 || typeof enabled !== "boolean" ||
    !isLimit(profiles, 0) || !isLimit(dailySales, 0)) return null;
  return { enabled, profiles, dailySales };
}

export const posPlanEnabled = (businessId: string) => `NOT EXISTS (
  SELECT 1 FROM business_subscriptions subscription
  JOIN subscription_plans plan ON plan.id=subscription.plan_id
  WHERE subscription.business_id=${businessId} AND plan.pos_enabled=0
)`;

const limitErrors = {
  PLAN_BRANCH_LIMIT: { code: "PLAN_BRANCH_LIMIT", error: "This business has reached its subscription plan’s branch limit." },
  PLAN_MENU_LIMIT: { code: "PLAN_MENU_LIMIT", error: "This business has reached its subscription plan’s menu limit." },
  PLAN_PRODUCT_LIMIT: { code: "PLAN_PRODUCT_LIMIT", error: "This business has reached its subscription plan’s product limit." },
  PLAN_DAILY_ORDER_LIMIT: { code: "order_limit_reached", error: "The business has reached its daily order limit." },
  PLAN_POS_PROFILE_LIMIT: { code: "PLAN_POS_PROFILE_LIMIT", error: "This business has reached its subscription plan’s active POS profile limit." },
  PLAN_POS_PROFILE_IN_USE: { code: "PLAN_POS_PROFILE_IN_USE", error: "Deactivate excess POS profiles before applying this limit." },
  PLAN_DAILY_POS_SALE_LIMIT: { code: "PLAN_DAILY_POS_SALE_LIMIT", error: "This business has reached its daily POS sales limit." },
};

export function planLimitError(error: unknown) {
  const message = String(error);
  const code = (Object.keys(limitErrors) as (keyof typeof limitErrors)[])
    .find(key => message.includes(key));
  return code ? limitErrors[code] : null;
}

export function selectedPlan(db: D1Database, planId: string, publicOnly: boolean) {
  return db.prepare(
    `SELECT ${planOfferFields} FROM subscription_plans plan ${planOfferJoin}
     WHERE plan.id=? AND plan.is_active=1 AND (?=0 OR plan.is_public=1)`,
  ).bind(planId, Number(publicOnly)).first<PlanOfferRow>();
}

export async function publicPlans(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT ${planOfferFields} FROM subscription_plans plan ${planOfferJoin}
     WHERE plan.is_active=1 AND plan.is_public=1 ORDER BY plan.display_order,plan.name,plan.id`,
  ).all<PlanOfferRow>();
  return results.map(serializePlan);
}
