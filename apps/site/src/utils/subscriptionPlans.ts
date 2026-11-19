import { MAX_DAILY_ORDERS, planPrice, type PlanOffer } from "../../../../shared/subscriptionPlans";

export function publicPlanPrice(plan: PlanOffer) {
  if (!plan.amountMinor) return "ឥតគិតថ្លៃ";
  const period = plan.billingInterval === "year" ? "ឆ្នាំ" : "ខែ";
  return `${planPrice(plan.amountMinor)} / ${period}`;
}

const quantity = (value: number | null) =>
  value === null ? "មិនកំណត់" : new Intl.NumberFormat("km-KH").format(value);

export function publicPlanLimits({ limits, pos }: PlanOffer) {
  return [
    `គណនីអ្នកប្រើ (រួមទាំងម្ចាស់)៖ ${quantity(limits.users ?? null)}`,
    `សាខា៖ ${quantity(limits.branches)}`,
    `ម៉ឺនុយ និងម៉ឺនុយរង៖ ${quantity(limits.menus)}`,
    `ផលិតផល៖ ${quantity(limits.products)}`,
    `ការកម្មង់ក្នុងមួយថ្ងៃ៖ ${quantity(limits.dailyOrders ?? MAX_DAILY_ORDERS)}`,
    ...(pos?.enabled ? [
      `ប្រវត្តិរូប POS សកម្ម៖ ${quantity(pos.profiles)}`,
      `ការលក់តាម POS ក្នុងមួយថ្ងៃ៖ ${quantity(pos.dailySales)}`,
    ] : []),
  ];
}
