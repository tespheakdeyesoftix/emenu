import type { SupportedCurrency } from "./currency";

const VISIT_GAP_MS = 3 * 60 * 60 * 1000;

type VisitReceipt = {
  deviceId?: string;
  tableId?: string;
  submittedAt?: string | null;
  status: "submitted" | "accepted" | "completed" | "cancelled";
  totalAmount?: number;
  currency?: SupportedCurrency;
};

export function activeVisitOrders<T extends VisitReceipt>(
  orders: T[],
  tableId: string | undefined,
  deviceId: string,
  now: number,
) {
  if (!tableId || !deviceId) return [];

  const recent = orders
    .filter((order) => order.tableId === tableId && order.deviceId === deviceId)
    .map((order) => ({ order, time: Date.parse(order.submittedAt ?? "") }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => b.time - a.time);

  const visit: T[] = [];
  let previousTime = now;
  for (const { order, time } of recent) {
    if (previousTime - time >= VISIT_GAP_MS) break;
    visit.push(order);
    previousTime = time;
  }
  return visit;
}

export function visitSpend(orders: VisitReceipt[]) {
  const totals = new Map<SupportedCurrency, { estimated: number; awaiting: number }>();
  for (const { status, currency, totalAmount } of orders) {
    if (!currency || totalAmount === undefined) continue;
    const total = totals.get(currency) ?? { estimated: 0, awaiting: 0 };
    if (status !== "cancelled") total.estimated += totalAmount;
    if (status === "submitted") total.awaiting += totalAmount;
    totals.set(currency, total);
  }
  return totals;
}
