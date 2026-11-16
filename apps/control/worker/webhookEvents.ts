import type { WebhookEvent, WebhookTable } from "../../../shared/branchWebhooks";

export const maxWebhookBodyBytes = 256 * 1024;
const orderLine = `json_object(
  'id', line.id, 'lineNumber', line.line_number, 'productId', line.product_id,
  'productCode', line.product_code, 'productName', line.product_name,
  'quantity', line.quantity, 'price', line.price, 'totalAmount', line.total_amount,
  'portionId', line.portion_id, 'portionName', line.portion_name,
  'modifiers', json(line.modifiers), 'note', line.note
)`;
const lineTextBytes = ["id", "product_id", "product_code", "product_name", "portion_id", "portion_name", "modifiers", "note"]
  .map(column => `length(CAST(COALESCE(line.${column}, '') AS BLOB))`).join(" + ");
// Bound the stored snapshot before aggregating. A large order can still be
// saved and delivered by rules whose body does not request line items.
const orderItems = `CASE WHEN (
  SELECT COALESCE(sum(CASE WHEN ${lineTextBytes} > ${maxWebhookBodyBytes} THEN ${maxWebhookBodyBytes} + 1
    ELSE length(CAST(${orderLine} AS BLOB)) + 1 END), 0)
  FROM order_products line WHERE line.order_id=r.id
) < ${maxWebhookBodyBytes}
THEN (SELECT json_group_array(${orderLine} ORDER BY line.line_number) FROM order_products line WHERE line.order_id=r.id)
ELSE NULL END`;

const records: Record<WebhookTable, string> = {
  orders: `json_object(
    'id', r.id, 'orderNumber', r.order_number, 'status', r.status,
    'postingDate', r.posting_date, 'submittedAt', r.submitted_at, 'tableId', r.table_id,
    'menuId', r.menu_id, 'totalQuantity', r.total_quantity, 'totalAmount', r.total_amount,
    'currency', r.currency, 'note', r.note,
    'items', json(${orderItems})
  )`,
  bookings: `json_patch(json_object(
    'id', r.id, 'status', r.status, 'arrivalDate', r.arrival_date, 'arrivalTime', r.arrival_time,
    'arrivalAt', r.arrival_at, 'timezone', r.timezone, 'pax', r.pax, 'preference', r.preference,
    'createdAt', r.created_at, 'updatedAt', r.updated_at
  ), CASE WHEN EXISTS (SELECT 1 FROM matching_rules WHERE include_contact=1
    AND business_id=r.business_id AND branch_id=r.branch_id)
    THEN json_object('guestName', r.guest_name, 'guestPhone', r.guest_phone,
      'preferenceText', r.preference_text, 'note', r.note)
    ELSE '{}' END)`,
};

// The predicate and status expressions are supplied by trusted write paths.
// Capture updates before mutation using the same transition predicate as the write.
export function captureWebhook(
  db: D1Database,
  table: WebhookTable,
  event: WebhookEvent,
  predicate: string,
  bindings: unknown[],
  nextStatus?: string,
) {
  const oldRecord = records[table];
  const newRecord = event === "updated"
    ? `json_set(${oldRecord}, '$.status', ${nextStatus}${table === "bookings" ? ", '$.updatedAt', CURRENT_TIMESTAMP" : ""})`
    : oldRecord;
  return db.prepare(`
    WITH matching_rules AS (
      SELECT rule.business_id, rule.branch_id, config.include_contact
      FROM branch_webhooks rule
      JOIN branch_webhook_revisions config ON config.webhook_id=rule.id AND config.revision=rule.revision
      WHERE rule.enabled=1 AND rule.archived=0 AND config.table_key='${table}' AND config.event='${event}'
    )
    INSERT INTO branch_webhook_events
      (business_id, branch_id, table_key, record_id, event, record_json, previous_json)
    SELECT r.business_id, r.branch_id, '${table}', r.id, '${event}', ${newRecord},
      ${event === "updated" ? oldRecord : "NULL"}
    FROM ${table} AS r
    WHERE (${predicate}) AND EXISTS (
      SELECT 1 FROM matching_rules WHERE business_id=r.business_id AND branch_id=r.branch_id
    )
  `).bind(...bindings);
}
