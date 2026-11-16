import { validBookingDate as isCalendarDate } from "../../../shared/booking";
import type { Env } from "./index";
import { scheduleBranchWebhooks } from "./webhookDelivery";
import {
  confirmOrderProducts,
  isOrderStatus,
  isOrderStatusUpdate,
  updateOrderStatus,
  type OrderProductDecision,
} from "./orderStatus";
import {
  posResponse,
  readPosJson,
  withPosIdentity,
  type SyncIdentity,
} from "./posSync";

const orderColumns = `o.id, o.order_number, o.status, o.posting_date, o.submitted_at,
  o.total_quantity, o.total_amount, o.currency, o.table_id,
  o.branch_id, branch.slug AS branch_slug, branch.name AS branch_name, o.menu_id,
  t.code AS table_code, t.label AS table_label, g.id AS table_group_id, g.name AS table_group_name`;
const ordersFrom = `FROM orders o
  JOIN restaurant_tables t ON t.id=o.table_id AND t.business_id=o.business_id
  JOIN table_groups g ON g.id=t.group_id AND g.business_id=o.business_id
  JOIN branches branch ON branch.id=o.branch_id AND branch.business_id=o.business_id`;

function parseProductDecisions(value: unknown): OrderProductDecision[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30)
    return null;
  const ids = new Set<string>();
  const products: OrderProductDecision[] = [];
  for (const item of value) {
    const { id, status } = item ?? {};
    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ||
      ids.has(id) ||
      (status !== "accepted" && status !== "rejected")
    ) return null;
    ids.add(id);
    products.push({ id, status });
  }
  return products.some(({ status }) => status === "accepted") ? products : null;
}

async function orderDetail(
  db: D1Database,
  businessId: string,
  orderId: string,
) {
  const [headers, lines] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT ${orderColumns}, o.note ${ordersFrom} WHERE o.business_id=? AND o.id=?`,
      )
      .bind(businessId, orderId),
    db
      .prepare(
        `SELECT line.id, line.line_number, line.product_id, line.status,
        COALESCE(line.product_code, product.code) AS product_code,
        COALESCE(line.product_name, NULLIF(product.name_km,''), product.name, line.product_id) AS name,
        product.name_en, line.quantity, line.price, line.portion_id, line.portion_name,
        line.price_list AS price_list_id, price_list.name AS price_list_name,
        line.modifiers, line.total_amount, line.note
       FROM order_products line
       JOIN orders o ON o.id=line.order_id
       LEFT JOIN products product ON product.id=line.product_id AND product.business_id=o.business_id
       LEFT JOIN price_lists price_list ON price_list.id=line.price_list AND price_list.business_id=o.business_id
       WHERE o.business_id=? AND o.id=?
       ORDER BY line.line_number`,
      )
      .bind(businessId, orderId),
  ]);
  const order = headers.results[0];
  if (!order) return posResponse({ error: "Order not found" }, 404);
  return posResponse({
    order,
    products: lines.results.map((line) => ({
      ...line,
      modifiers: (
        JSON.parse(String(line.modifiers)) as Record<string, unknown>[]
      ).map((option) => ({
        id: option.id,
        group_id: option.groupId,
        label_km: option.labelKm ?? "",
        label_en: option.labelEn ?? "",
        label_zh: option.labelZh ?? "",
        prefix: option.prefix ?? "",
        price: Number(option.priceCents ?? 0),
      })),
    })),
  });
}

export async function handlePosOrders(
  request: Request,
  env: Env,
  execution: ExecutionContext,
  subscriptionFor: (identity: SyncIdentity) => { readOnly: boolean },
  orderId?: string,
): Promise<Response> {
  if (request.method !== "GET" && !(orderId && request.method === "PATCH"))
    return posResponse({ error: "Method not allowed" }, 405, {
      allow: orderId ? "GET, PATCH" : "GET",
    });

  return withPosIdentity(request, env, async (identity) => {
    const { businessId } = identity;
    if (orderId && request.method === "PATCH") {
      if (subscriptionFor(identity).readOnly)
        return posResponse(
          {
            error: "Subscription has expired; orders are read-only",
            code: "SUBSCRIPTION_EXPIRED",
          },
          402,
        );
      const body = await readPosJson(request, 4096);
      if ("products" in body) {
        const products = parseProductDecisions(body.products);
        if (body.status !== "accepted" || Object.keys(body).length !== 2 || !products)
          return posResponse({
            error: "Send status accepted with unique product line IDs and accepted or rejected decisions, including at least one accepted line",
          }, 400);

        const order = await confirmOrderProducts(env.DB, businessId, orderId, products);
        if (!order) return posResponse({ error: "Order not found" }, 404);
        if (order.changed) scheduleBranchWebhooks(env, execution, businessId);
        if (order.status === "submitted")
          return posResponse({ error: "Send one decision for every line in this order" }, 400);
        if (order.status !== "accepted" || !order.matches)
          return posResponse({
            code: "order_status_conflict",
            error: "This order was already reviewed with a different result",
            status: order.status,
          }, 409);
        return posResponse({ id: orderId, status: order.status, products: order.products });
      }
      if (!isOrderStatusUpdate(body.status) || Object.keys(body).length !== 1)
        return posResponse(
          { error: "Send only status with accepted, completed, or cancelled" },
          400,
        );
      const order = await updateOrderStatus(
        env.DB,
        businessId,
        orderId,
        body.status,
      );
      if (!order) return posResponse({ error: "Order not found" }, 404);
      if (order.changed) scheduleBranchWebhooks(env, execution, businessId);
      if (order.status !== body.status)
        return posResponse(
          {
            code: "order_status_conflict",
            error: "This order can no longer be changed to that status",
            status: order.status,
          },
          409,
        );
      return posResponse({ id: orderId, status: order.status });
    }

    if (orderId) return orderDetail(env.DB, businessId, orderId);

    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const branchId = params.get("branch_id");
    const postingDate = params.get("posting_date");
    const page = Number(params.get("page") ?? 1);
    const pageSize = Number(params.get("page_size") ?? 25);
    if (status !== null && !isOrderStatus(status))
      return posResponse({ error: "Invalid order status filter" }, 400);
    if (postingDate !== null && !isCalendarDate(postingDate))
      return posResponse(
        { error: "posting_date must be a valid date in YYYY-MM-DD format" },
        400,
      );
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000)
      return posResponse({ error: "Invalid page number" }, 400);
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
      return posResponse(
        { error: "page_size must be an integer between 1 and 100" },
        400,
      );

    const filters = ["o.business_id=?"];
    const bindings = [businessId];
    if (status) {
      filters.push("o.status=?");
      bindings.push(status);
    }
    if (branchId) {
      filters.push("o.branch_id=?");
      bindings.push(branchId);
    }
    if (postingDate) {
      filters.push("o.posting_date=?");
      bindings.push(postingDate);
    }
    const filteredOrders = `${ordersFrom} WHERE ${filters.join(" AND ")}`;
    const offset = (page - 1) * pageSize;
    const [orders, count] = await env.DB.batch<Record<string, unknown>>([
      env.DB
        .prepare(
          `SELECT ${orderColumns} ${filteredOrders}
         ORDER BY o.posting_date DESC, o.rowid DESC LIMIT ? OFFSET ?`,
        )
        .bind(...bindings, pageSize, offset),
      env.DB
        .prepare(`SELECT COUNT(*) AS total_record ${filteredOrders}`)
        .bind(...bindings),
    ]);
    const totalRecord = Number(count.results[0].total_record);
    return posResponse({
      orders: orders.results,
      page,
      page_size: pageSize,
      has_more: offset + pageSize < totalRecord,
      total_record: totalRecord,
    });
  });
}
