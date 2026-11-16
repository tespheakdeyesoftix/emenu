import { captureWebhook } from "./webhookEvents";

const orderStatuses = [
  "submitted",
  "accepted",
  "completed",
  "cancelled",
] as const;
type OrderStatus = (typeof orderStatuses)[number];
type OrderStatusUpdate = Exclude<OrderStatus, "submitted">;
export type OrderProductDecision = {
  id: string;
  status: "accepted" | "rejected";
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return orderStatuses.some((status) => status === value);
}

export function isOrderStatusUpdate(
  value: unknown,
): value is OrderStatusUpdate {
  return value !== "submitted" && isOrderStatus(value);
}

export async function updateOrderStatus(
  db: D1Database,
  businessId: string,
  orderId: string,
  status: OrderStatusUpdate,
) {
  const transition = `business_id=?2 AND id=?3 AND (
    (status='submitted' AND ?1 IN ('accepted','cancelled'))
    OR (status='accepted' AND ?1 IN ('completed','cancelled'))
  )`;
  const bindings = [status, businessId, orderId];
  const [, updated, current] = await db.batch<{ status: OrderStatus }>([
    captureWebhook(db, "orders", "updated", transition, bindings, "?1"),
    db
      .prepare(`UPDATE orders SET status=?1 WHERE ${transition}`)
      .bind(...bindings),
    db
      .prepare("SELECT status FROM orders WHERE business_id=? AND id=?")
      .bind(businessId, orderId),
  ]);
  const order = current.results[0];
  return order && { ...order, changed: Boolean(updated.meta.changes) };
}

export async function confirmOrderProducts(
  db: D1Database,
  businessId: string,
  orderId: string,
  products: OrderProductDecision[],
) {
  const transition = `business_id=?1 AND id=?2 AND status='submitted'
    AND (SELECT COUNT(*) FROM order_products WHERE order_id=?2)=json_array_length(?3)
    AND NOT EXISTS (
      SELECT 1 FROM json_each(?3) AS decision
      WHERE NOT EXISTS (
        SELECT 1 FROM order_products
        WHERE order_id=?2 AND id=json_extract(decision.value,'$.id')
      )
    )`;
  const bindings = [businessId, orderId, JSON.stringify(products)];
  // Review the lines while the order is still submitted. D1 runs the full
  // batch in one transaction, so neither update can commit on its own.
  const [, , updated, current, lines] = await db.batch<Record<string, unknown>>([
    captureWebhook(db, "orders", "updated", transition, bindings, "'accepted'"),
    db
      .prepare(
        `UPDATE order_products SET status=(
           SELECT json_extract(decision.value,'$.status') FROM json_each(?3) AS decision
           WHERE json_extract(decision.value,'$.id')=order_products.id
         )
         WHERE order_id=?2 AND EXISTS (SELECT 1 FROM orders WHERE ${transition})`,
      )
      .bind(...bindings),
    db
      .prepare(`UPDATE orders SET status='accepted' WHERE ${transition}`)
      .bind(...bindings),
    db
      .prepare("SELECT status FROM orders WHERE business_id=? AND id=?")
      .bind(businessId, orderId),
    db
      .prepare(
        `SELECT line.id, line.status FROM order_products line
         JOIN orders o ON o.id=line.order_id WHERE o.business_id=? AND o.id=?
         ORDER BY line.line_number`,
      )
      .bind(businessId, orderId),
  ]);
  const order = current.results[0];
  if (!order) return null;
  const decisionsById = new Map(products.map(({ id, status }) => [id, status]));
  const matches =
    lines.results.length === products.length &&
    lines.results.every(({ id, status }) => decisionsById.get(String(id)) === status);
  return {
    status: order.status,
    changed: Boolean(updated.meta.changes),
    matches,
    products: lines.results,
  };
}

