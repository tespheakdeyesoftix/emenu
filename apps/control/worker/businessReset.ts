import { branchResetOptions, businessResetOptions, type ResetBackup } from "../../../shared/businessReset";
import type { Env } from "./index";
import { captureWebhook } from "./webhookEvents";

const encoder = new TextEncoder();
const maxTableBytes = 1_500_000;
const maxBackupBytes = 8_000_000;
const maxTableRows = 25_000;
const backupDurationMs = 15 * 60_000;
const own = "business_id=?1";
const branchOnly = `${own} AND branch_id=?2`;
const sourceOrders = "SELECT id FROM orders";
const sourceBookings = "SELECT id FROM bookings";
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const fail = (status: number, error: string, code?: string) => ({ ok: false as const, status, error, code });
const success = <T>(data: T) => ({ ok: true as const, data });

type Target = { name: string; where: string };
type Snapshot = Target & { query: string; columns: string[]; content: string; count: number };

function targetsFor(scope: string, selections: Set<unknown>) {
  const selected = (key: string) => selections.has(key);
  const targets: Target[] = [];
  const add = (name: string, where = own) => targets.push({ name, where });
  const resetScope = scope === "business" ? own : branchOnly;
  const workingDays = selected("workingDays");
  const cashierShifts = selected("cashierShifts") || workingDays;
  const dayIds = `SELECT id FROM working_days WHERE ${resetScope}`;
  const shiftsWhere = selected("cashierShifts") ? resetScope
    : `${resetScope} AND working_day_id IN (${dayIds})`;
  const shiftIds = `SELECT id FROM cashier_shifts WHERE ${shiftsWhere}`;
  const relatedSales = [];
  if (workingDays) relatedSales.push(`working_day_id IN (${dayIds})`);
  if (cashierShifts) relatedSales.push(`shift_id IN (${shiftIds})`);
  const salesWhere = selected("sales") ? resetScope : `${resetScope} AND (${relatedSales.join(" OR ")})`;
  const orders = selected("orders");
  const tables = selected("tables") || selected("tableGroups");
  const bookings = selected("bookings");
  const ordersWhere = orders ? resetScope : `${branchOnly} AND table_id IN (
    SELECT id FROM restaurant_tables WHERE ${branchOnly})`;
  const orderIds = `${sourceOrders} WHERE ${ordersWhere}`;
  const bookingIds = `${sourceBookings} WHERE ${branchOnly}`;
  const logOrders = selected("telegramLogs") ? `${sourceOrders} WHERE ${branchOnly}` : orderIds;
  const logs = selected("telegramLogs");
  const allLogs = logs && scope === "business";

  if (logs || orders || tables || bookings) {
    const sources = [];
    if (logs || orders || tables) sources.push(`(source='Order' AND source_id IN (${logOrders}))`);
    if (logs || bookings) sources.push(`(source='Booking' AND source_id IN (${bookingIds}))`);
    add("telegram_notification_deliveries", allLogs ? own : `${own} AND (${sources.join(" OR ")})`);
  }
  if (logs || orders || tables)
    add("telegram_order_deliveries", `${own} AND order_id IN (${allLogs ? `${sourceOrders} WHERE ${own}` : logOrders})`);
  if (logs || bookings)
    add("telegram_booking_deliveries", `booking_id IN (${allLogs ? `${sourceBookings} WHERE ${own}` : bookingIds})`);

  if (orders || tables) {
    add("order_products", `order_id IN (${orderIds})`);
    add("orders", ordersWhere);
  }
  if (selected("sales") || cashierShifts) {
    const saleIds = `SELECT id FROM sales WHERE ${salesWhere}`;
    const commands = [`EXISTS (
      SELECT 1 FROM sales WHERE ${salesWhere} AND sales.profile_id=pos_commands.profile_id
        AND sales.id=json_extract(pos_commands.response_json,'$.id')
        AND json_type(pos_commands.response_json,'$.lines')='array'
    )`];
    if (cashierShifts) {
      commands.push(`EXISTS (SELECT 1 FROM cashier_shifts WHERE ${shiftsWhere}
        AND profile_id=pos_commands.profile_id AND (
          id=json_extract(pos_commands.response_json,'$.id') OR
          id=json_extract(pos_commands.response_json,'$.shift_id')
        ))`);
    }
    if (workingDays) commands.push(`json_extract(pos_commands.response_json,'$.id') IN (${dayIds})
      AND profile_id IN (SELECT id FROM pos_profiles WHERE ${resetScope})`);
    add("pos_commands", `${own} AND (${commands.map(condition => `(${condition})`).join(" OR ")})`);
    add("sale_products", `sale_id IN (${saleIds})`);
    add("sale_payments", `sale_id IN (${saleIds})`);
    add("sales", salesWhere);
  }
  if (cashierShifts) {
    for (const name of ["cash_floats", "cashier_shift_closing_counts", "cashier_shift_reopens"])
      add(name, `shift_id IN (${shiftIds})`);
    add("cashier_shifts", shiftsWhere);
  }
  if (workingDays) add("working_days", resetScope);
  if (bookings) add("bookings", branchOnly);
  if (tables) add("restaurant_tables", branchOnly);
  if (selected("tableGroups")) add("table_groups", branchOnly);
  if (selected("analytics")) add("analytics_events", branchOnly);

  const products = selected("products") || selected("categories");
  const menus = selected("menus");
  if (products || menus) {
    // Follow the same parent keys as the foreign keys for rows without a branch.
    const references = [];
    if (products) references.push(`product_id IN (SELECT id FROM products WHERE ${own})`);
    if (menus) references.push(`menu_id IN (SELECT id FROM menus WHERE ${own})`);
    const assignments = `${own} AND (${references.join(" OR ")})`;
    add("menu_products", assignments);
    add("menu_product_exclusions", assignments);
  }
  if (products) {
    const productIds = `${own} AND product_id IN (SELECT id FROM products WHERE ${own})`;
    add("product_images", productIds);
    add("product_prices", productIds);
    add("products");
  }
  if (menus) add("menus");
  if (selected("categories")) add("categories");
  if (selected("banners")) add("banners");
  if (selected("qrDesigns")) add("qr_designs");
  return targets;
}

function snapshotQuery(target: Target, columns: string[]) {
  // D1 limits the number of function arguments, so split wide rows into arrays.
  const groups = [];
  for (let offset = 0; offset < columns.length; offset += 32)
    groups.push(`json_array(${columns.slice(offset, offset + 32).map(quote).join(",")})`);
  return `WITH reset_rows AS MATERIALIZED (
    SELECT rowid AS position, json_array(${groups.join(",")}) AS value
    FROM ${target.name} WHERE ${target.where} ORDER BY rowid LIMIT ${maxTableRows + 1}
  )
  SELECT count(*) AS count, CASE
    WHEN count(*)<=${maxTableRows} AND COALESCE(sum(length(CAST(value AS BLOB))+1),0)<=${maxTableBytes}
    THEN (SELECT json_group_array(json(value) ORDER BY position) FROM reset_rows)
  END AS content FROM reset_rows`;
}

async function readSnapshot(db: D1Database, targets: Target[], businessId: string, branchId: string) {
  const schemas = await db.batch<{ name: string }>(
    targets.map(({ name }) => db.prepare(`PRAGMA table_info(${name})`)),
  );
  const tables = targets.map((target, index) => {
    const columns = schemas[index].results.map(({ name }) => name);
    return { ...target, columns, query: snapshotQuery(target, columns) };
  });
  const values = await db.batch<{ count: number; content: string | null }>(
    tables.map(({ query }) => db.prepare(query).bind(...scopeBindings(query, businessId, branchId))),
  );
  const snapshots: Snapshot[] = [];
  let totalBytes = 0;
  for (const [index, table] of tables.entries()) {
    const { count, content } = values[index].results[0];
    if (content === null) return null;
    totalBytes += encoder.encode(content).length;
    if (totalBytes > maxBackupBytes) return null;
    snapshots.push({ ...table, content, count });
  }
  return snapshots;
}

function scopeBindings(sql: string, businessId: string, branchId: string) {
  return sql.includes("?2") ? [businessId, branchId] : [businessId];
}

async function snapshotSignature(secret: string, metadata: unknown[], snapshots: Snapshot[], signature?: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const content = encoder.encode(JSON.stringify(["business-data-reset-v1", metadata,
    snapshots.map(({ name, columns, content }) => [name, columns, content])]));
  if (signature) {
    const bytes = Uint8Array.from(signature.match(/../g) ?? [], (part) => Number.parseInt(part, 16));
    return await crypto.subtle.verify("HMAC", key, bytes, content);
  }
  const signed = await crypto.subtle.sign("HMAC", key, content);
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const menuOrderReference = (resettingBusinessOrders: boolean) => `EXISTS (
  SELECT 1 FROM orders WHERE menu_id IN (SELECT id FROM menus WHERE ${own})
  ${resettingBusinessOrders ? "AND business_id<>?1" : ""}
)`;

function tenantChecks(targets: Target[]) {
  const checks = [];
  for (const { name, where } of targets) {
    if (name === "sales") checks.push(`NOT EXISTS (
      SELECT 1 FROM sales WHERE reverses_sale_id IN (SELECT id FROM sales WHERE ${where})
        AND id NOT IN (SELECT id FROM sales WHERE ${where})
    )`);
    const relations = name === "orders" ? [["telegram_order_deliveries", "order_id"]]
      : name === "products" ? [["product_images", "product_id"], ["product_prices", "product_id"]]
      : name === "categories" ? [["categories", "parent_id"]] : [];
    for (const [table, key] of relations) {
      checks.push(`NOT EXISTS (SELECT 1 FROM ${table} WHERE business_id<>?1
        AND ${key} IN (SELECT id FROM ${name} WHERE ${where}))`);
    }
  }
  return checks;
}

export async function resetBusinessData(
  env: Env, actor: string, businessId: string, action: "backup" | "delete", input: Record<string, unknown>,
) {
  const { branchId, scope, selection, confirmation, token } = input;
  const sendDeletedWebhooks = input.sendDeletedWebhooks === true;
  if (input.sendDeletedWebhooks !== undefined && typeof input.sendDeletedWebhooks !== "boolean")
    return fail(400, "Invalid Deleted webhook selection.");
  if (typeof branchId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(branchId))
    return fail(400, "Select a valid branch");
  if (scope !== "branch" && scope !== "business") return fail(400, "Select a reset scope");
  const options = scope === "branch" ? branchResetOptions : businessResetOptions;
  if (!Array.isArray(selection) || !selection.length ||
    selection.some((value) => typeof value !== "string" || !Object.hasOwn(options, value)) ||
    new Set(selection).size !== selection.length)
    return fail(400, "Select valid data for this reset scope");
  if (typeof env.AUTH_PEPPER !== "string" || env.AUTH_PEPPER.length < 32)
    return fail(503, "Backup verification is unavailable");

  const db = env.DB;
  const branch = await db.prepare("SELECT id,name FROM branches WHERE business_id=? AND id=?")
    .bind(businessId, branchId).first<ResetBackup["branch"]>();
  if (!branch) return fail(404, "Branch does not belong to this business");
  const deleting = action === "delete";
  if (deleting && confirmation !== branch.name) return fail(400, "Type the exact branch name to confirm");
  if (deleting && input.backupSaved !== true) return fail(400, "Confirm that the CSV ZIP backup was saved");
  if (deleting && scope === "business" && input.confirmBusinessWide !== true)
    return fail(400, "Confirm that this reset applies across the whole business");
  const stale = () => fail(409, "The backup expired or the data changed. Prepare and download a new backup.", "RESET_BACKUP_STALE");
  const proof = typeof token === "string" ? /^(\d{13})\.([a-f0-9]{64})$/.exec(token) : null;
  if (deleting && (!proof || Number(proof[1]) <= Date.now())) return stale();

  const selected = new Set<unknown>(selection);
  const menus = selected.has("menus");
  const remainingMenuOrders = menuOrderReference(scope === "business" && selected.has("orders"));
  const targets = targetsFor(scope, selected);
  const sales = targets.find(({ name }) => name === "sales");
  const resettingOperations = selected.has("workingDays") || selected.has("cashierShifts");
  const commandReset = JSON.stringify({
    code: resettingOperations ? "POS_DATA_RESET" : "SALE_RESET",
    error: resettingOperations ? "This POS working day, shift or sale was cleared by an administrator."
      : "This POS sale was cleared by an administrator.",
  });
  if (sendDeletedWebhooks && !targets.some(({ name }) => name === "orders" || name === "bookings"))
    return fail(400, "Select a reset that removes orders or bookings to send Deleted webhooks.");
  const ownership = tenantChecks(targets);
  const blockers = menus && await db.prepare(`SELECT ${remainingMenuOrders} AS inUse`).bind(businessId).first<number>("inUse")
    ? ["Saved orders outside this reset still reference these menus."]
    : [];
  if (ownership.length) {
    const sql = `SELECT (${ownership.join(" AND ")}) AS valid`;
    if (!await db.prepare(sql).bind(...scopeBindings(sql, businessId, branchId)).first<number>("valid"))
      blockers.push("A related record outside this reset references the selection. Include its data in the reset or reset it first.");
  }
  if (deleting && blockers.length) return fail(409, blockers[0]);
  const snapshots = await readSnapshot(db, targets, businessId, branchId);
  if (!snapshots) return fail(413, "This backup is too large. Select fewer data types and try again.");
  const counts = snapshots.map(({ name, count }) => ({ name, count }));
  if (sendDeletedWebhooks && counts.reduce((total, { name, count }) =>
    total + (name === "orders" || name === "bookings" ? count : 0), 0) > 100) {
    const limit = "Deleted webhooks are limited to 100 orders and bookings combined. Turn off Deleted webhooks and prepare a fresh backup.";
    if (deleting) return fail(409, limit);
    blockers.push(limit);
  }
  const hasRows = counts.some(({ count }) => count > 0);
  const expiresAt = proof && deleting ? Number(proof[1]) : Date.now() + backupDurationMs;
  const metadata = [actor, businessId, branch, scope, [...selection].sort(), expiresAt,
    ...(sendDeletedWebhooks ? ["send-deleted-webhooks"] : [])];
  if (!deleting) {
    const backup: ResetBackup = {
      branch, expiresAt, blockers,
      token: hasRows && !blockers.length
        ? `${expiresAt}.${await snapshotSignature(env.AUTH_PEPPER, metadata, snapshots)}` : null,
      tables: snapshots.map(({ name, columns, content }) => ({
        name, columns,
        rows: (JSON.parse(content) as (string | number | null)[][][]).map((row) => row.flat()),
      })),
    };
    return success(backup);
  }
  if (!hasRows || !await snapshotSignature(env.AUTH_PEPPER, metadata, snapshots, proof![2]) || Date.now() >= expiresAt)
    return stale();

  // Write the audit row only when every file still matches the backup. The deletes
  // all depend on that audit row and execute in the same D1 transaction.
  const auditId = `aud_${crypto.randomUUID().replaceAll("-", "")}`;
  const checks = snapshots.map(({ query }, index) =>
    `?${index + 7} = (SELECT content FROM (${query}))`,
  );
  checks.push(...ownership);
  const guarded = "EXISTS (SELECT 1 FROM super_admin_audit_log WHERE id=?3)";
  const audit = db.prepare(`INSERT INTO super_admin_audit_log (id,actor_email,action,business_id,details_json)
    SELECT ?3,?4,'business.data_reset',?1,?5
    WHERE EXISTS (SELECT 1 FROM branches WHERE business_id=?1 AND id=?2 AND name=?6 COLLATE BINARY)
    ${menus ? `AND NOT ${remainingMenuOrders}` : ""}
    AND ${checks.join(" AND ")}`).bind(businessId, branchId, auditId, actor,
    JSON.stringify({ branchId, branchName: branch.name, scope, selection, tables: counts,
      ...(sendDeletedWebhooks ? { sendDeletedWebhooks } : {}) }),
    branch.name, ...snapshots.map(({ content }) => content));
  try {
    const [logged] = await db.batch([
      audit,
      ...(sendDeletedWebhooks ? targets.flatMap(({ name, where }) =>
        name === "orders" || name === "bookings"
          ? [captureWebhook(db, name, "deleted", `(${where}) AND ${guarded}`, [businessId, branchId, auditId])]
          : []) : []),
      ...(sales ? [db.prepare(`UPDATE cashier_shifts SET activity_revision=activity_revision+1
        WHERE business_id=?1 AND closed_at IS NULL AND id IN (
          SELECT shift_id FROM sales WHERE ${sales.where}
        ) AND ${guarded}`).bind(businessId, branchId, auditId)] : []),
      ...snapshots.map(({ name, where }) => {
        // Keep idempotency keys so old POS retries cannot recreate cleared records.
        const statement = name === "pos_commands"
          ? `UPDATE pos_commands SET response_status=410,response_json='${commandReset}'`
          : `DELETE FROM ${name}`;
        return db.prepare(`${statement} WHERE (${where}) AND ${guarded}`).bind(businessId, branchId, auditId);
      }),
      db.prepare(`UPDATE businesses SET menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP
        WHERE id=?1 AND ?2 IS NOT NULL AND ${guarded}`).bind(businessId, branchId, auditId),
    ]);
    return logged.meta.changes ? success({ tables: counts }) : stale();
  } catch (error) {
    if (String(error).includes("FOREIGN KEY constraint failed"))
      return fail(409, "Other records still reference this selection. The reset was rolled back.");
    throw error;
  }
}
