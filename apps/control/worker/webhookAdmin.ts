import {
  validateWebhookTemplate, webhookDefinition, webhookFields, webhookMethods, webhookTables,
  type WebhookBodyFormat, type WebhookCondition, type WebhookDelivery, type WebhookEvent,
  type WebhookMethod, type WebhookRule, type WebhookTable,
} from "../../../shared/branchWebhooks";
import type { Env } from "./index";
import { webhookBlocked, webhookRetentionSeconds } from "./webhookDelivery";
import { encryptWebhookHeaders, webhookDestination } from "./webhookDestination";

type Input = Record<string, unknown>;
export type WebhookAdminAction = "list" | "create" | "update" | "toggle" | "archive" | "deliveries" | "retry";
type SavedRule = Omit<WebhookRule, "filter" | "body" | "headerNames" | "enabled" | "archived" | "includeBookingContact"> & {
  filterJson: string;
  bodyJson: string;
  headerNamesJson: string;
  headersCiphertext: string;
  host: string;
  enabled: number;
  archived: number;
  includeBookingContact: number;
};
const ruleColumns = `rule.id, rule.revision, rule.name, rule.enabled, rule.archived,
  config.table_key AS "table", config.event, config.url, config.host, config.method, config.filter_json AS filterJson,
  config.body_json AS bodyJson, config.body_format AS bodyFormat, config.include_contact AS includeBookingContact,
  config.header_names_json AS headerNamesJson, config.headers_ciphertext AS headersCiphertext`;
const ruleJoin = `FROM branch_webhooks rule JOIN branch_webhook_revisions config
  ON config.webhook_id=rule.id AND config.revision=rule.revision`;
const fail = (status: number, error: string) => ({ ok: false as const, status, error });
const success = (data: unknown) => ({ ok: true as const, data });

export async function clearWebhookHistory(
  env: Env, actor: string, businessId: string, branchId: string | null, webhookId: string | null,
) {
  const db = env.DB;
  if (webhookId !== null) {
    const rule = await db.prepare("SELECT 1 FROM branch_webhooks WHERE business_id=? AND branch_id=? AND id=?")
      .bind(businessId, branchId, webhookId).first();
    if (!rule) return fail(404, "Webhook rule not found.");
  } else {
    const exists = branchId === null
      ? await db.prepare("SELECT 1 FROM businesses WHERE id=?").bind(businessId).first()
      : await db.prepare("SELECT 1 FROM branches WHERE business_id=? AND id=?").bind(businessId, branchId).first();
    if (!exists) return fail(404, branchId === null ? "Business not found." : "Branch not found.");
  }
  const eventScope = branchId === null ? "business_id=?" : "business_id=? AND branch_id=?";
  const eventBindings = branchId === null ? [businessId] : [businessId, branchId];
  const deliveryScope = `event_sequence IN (SELECT sequence FROM branch_webhook_events WHERE ${eventScope})
    ${webhookId === null ? "" : "AND webhook_id=?"}`;
  const deliveryBindings = webhookId === null ? eventBindings : [...eventBindings, webhookId];
  const [deleted, hidden] = await db.batch([
    db.prepare(`DELETE FROM branch_webhook_deliveries
      WHERE ${deliveryScope} AND status IN ('succeeded','expired')`).bind(...deliveryBindings),
    // Unresolved deliveries can still retry or block later deliveries for the same record.
    db.prepare(`UPDATE branch_webhook_deliveries SET history_hidden=1
      WHERE ${deliveryScope} AND history_hidden=0`).bind(...deliveryBindings),
    db.prepare(`DELETE FROM branch_webhook_events
      WHERE ${eventScope} AND NOT EXISTS (
        SELECT 1 FROM branch_webhook_deliveries WHERE event_sequence=branch_webhook_events.sequence
      )`).bind(...eventBindings),
    db.prepare(`INSERT INTO super_admin_audit_log (id,actor_email,action,business_id,details_json)
      VALUES (?,?,'branch.webhook.clear_history',?,?)`)
      .bind("aud_" + crypto.randomUUID(), actor, businessId, JSON.stringify({ branchId, webhookId })),
  ]);
  return success({ cleared: deleted.meta.changes + hidden.meta.changes });
}

function publicRule(row: SavedRule): WebhookRule {
  const { id, revision, name, table, event, url, method } = row;
  return {
    id, revision, name, table, event, url, method,
    enabled: Boolean(row.enabled), archived: Boolean(row.archived),
    includeBookingContact: Boolean(row.includeBookingContact),
    filter: JSON.parse(row.filterJson), body: JSON.parse(row.bodyJson), bodyFormat: row.bodyFormat,
    headerNames: JSON.parse(row.headerNamesJson),
  };
}

function filterConditions(input: unknown, table: WebhookTable, event: WebhookEvent, contact: boolean): WebhookCondition[] {
  if (!Array.isArray(input) || input.length > 12) throw new Error("The filter must be a JSON array of up to 12 conditions.");
  const fields = webhookFields(table, contact);
  return input.map(condition => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition) ||
      typeof condition.field !== "string" || !Object.hasOwn(fields, condition.field) ||
      fields[condition.field] === "items" || !["eq", "neq", "in", "changed"].includes(condition.op) ||
      Object.keys(condition).some(key => !["field", "op", "value"].includes(key)))
      throw new Error("Each condition needs an allowed field and operator.");
    const { field, op, value } = condition;
    const valid = (item: unknown) => item === null || (fields[field] === "number"
      ? typeof item === "number" && Number.isFinite(item)
      : typeof item === "string" && item.length <= 400);
    if (op === "changed") {
      if (event !== "updated" || Object.hasOwn(condition, "value"))
        throw new Error("Changed is available only for Updated and takes no value.");
      return { field, op };
    }
    if (op === "in" ? !Array.isArray(value) || !value.length || value.length > 20 || !value.every(valid) : !valid(value))
      throw new Error("Filter values must match the field type. In requires 1–20 values.");
    return { field, op, value };
  });
}

function parseHeaders(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Headers must be a JSON object with string values.");
  if (new TextEncoder().encode(JSON.stringify(input)).length > 32 * 1024)
    throw new Error("Headers must be at most 32 KB.");
  const headers = new Headers();
  const reserved = new Set(["host", "content-length", "transfer-encoding", "connection", "upgrade", "te",
    "trailer", "keep-alive", "forwarded", "expect"]);
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(input)) {
    const name = key.toLowerCase();
    const accessHeader = name === "cf-access-client-id" || name === "cf-access-client-secret";
    if (reserved.has(name) || (!accessHeader && /^(?:cf-|x-emenu-|x-forwarded-|proxy-|sec-)/.test(name)) ||
      seen.has(name) || typeof value !== "string" || /[\x00-\x08\x0a-\x1f\x7f]/.test(value))
      throw new Error("Use unique, valid header names and string values. System headers are reserved.");
    try {
      headers.set(name, value);
    } catch {
      throw new Error("Use valid HTTP header names and values.");
    }
    seen.add(name);
  }
  return Object.fromEntries([...seen].map(name => [name, headers.get(name)!]));
}

function validateRule(env: Env, input: Input) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100)
    throw new Error("Enter a rule name of up to 100 characters.");
  if (typeof input.table !== "string" || !Object.hasOwn(webhookTables, input.table))
    throw new Error("Select a supported table.");
  const table = input.table as WebhookTable;
  const event = input.event as WebhookEvent;
  if (!webhookDefinition(table).events.includes(event)) throw new Error("Select a supported event.");
  const method = (input.method ?? "POST") as WebhookMethod;
  if (!webhookMethods.includes(method)) throw new Error("Select a supported HTTP method.");
  const contact = input.includeBookingContact === true;
  if ((contact && table !== "bookings") || (input.includeBookingContact !== undefined && typeof input.includeBookingContact !== "boolean"))
    throw new Error("Booking contact data is available only for booking rules.");
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") throw new Error("Invalid enabled value.");
  const destination = webhookDestination(env, input.url);
  const bodyless = method === "GET" || method === "HEAD";
  const bodyFormat = (input.bodyFormat ?? (bodyless ? "none" : "json")) as WebhookBodyFormat;
  if (!["json", "text", "none"].includes(bodyFormat) || (bodyless && bodyFormat !== "none"))
    throw new Error("Select a valid body format. GET and HEAD require no body.");
  const body = bodyFormat === "none" ? null : input.body;
  const filter = filterConditions(input.filter ?? [], table, event, contact);
  validateWebhookTemplate(body, table, event, contact, bodyFormat);
  return { name: input.name.trim(), table, event, method, contact, filter, body, bodyFormat, ...destination };
}

export async function manageBranchWebhooks(
  env: Env, actor: string, businessId: string, branchId: string, action: WebhookAdminAction, id: string | null, input: Input,
) {
  const db = env.DB;
  if (!await db.prepare("SELECT 1 FROM branches WHERE business_id=? AND id=?").bind(businessId, branchId).first())
    return fail(404, "Branch not found.");
  const audit = (operation: string, recordId: string, details: Input = {}) => db.prepare(`
    INSERT INTO super_admin_audit_log (id,actor_email,action,business_id,details_json)
    SELECT ?,?,?,?,? WHERE changes()=1
  `).bind("aud_" + crypto.randomUUID(), actor, "branch.webhook." + operation, businessId,
    JSON.stringify({ branchId, id: recordId, ...details }));
  if (action === "list") {
    const { results } = await db.prepare(`SELECT ${ruleColumns} ${ruleJoin}
      WHERE rule.business_id=? AND rule.branch_id=? ORDER BY rule.archived, rule.name, rule.id`)
      .bind(businessId, branchId).all<SavedRule>();
    return success({ rules: results.map(publicRule) });
  }
  if (action === "deliveries") {
    const { results } = await db.prepare(`
      SELECT d.id, e.id AS eventId, config.name AS ruleName, e.table_key AS "table", e.event, e.record_id AS recordId,
        CASE WHEN d.status='pending' AND ${webhookBlocked} THEN 'blocked' ELSE d.status END AS status,
        d.attempts, e.created_at AS createdAt, d.attempted_at AS attemptedAt,
        CASE WHEN d.status='pending' AND NOT ${webhookBlocked} THEN d.due_at END AS nextAttemptAt,
        d.http_status AS httpStatus, d.error
      FROM branch_webhook_events e JOIN branch_webhook_deliveries d ON d.event_sequence=e.sequence
      JOIN branch_webhook_revisions config ON config.webhook_id=d.webhook_id AND config.revision=d.revision
      WHERE e.business_id=? AND e.branch_id=? AND d.history_hidden=0
        AND e.created_at>unixepoch()-${webhookRetentionSeconds}
      ORDER BY e.sequence DESC, d.id LIMIT 5
    `).bind(businessId, branchId).all<WebhookDelivery>();
    return success({ deliveries: results });
  }
  if (action === "retry") {
    const scope = `FROM branch_webhook_deliveries d JOIN branch_webhook_events e ON e.sequence=d.event_sequence
      JOIN branch_webhooks rule ON rule.id=d.webhook_id WHERE d.id=? AND e.business_id=? AND e.branch_id=?`;
    const current = await db.prepare(`SELECT d.status, rule.enabled ${scope}`)
      .bind(id, businessId, branchId).first<{ status: string; enabled: number }>();
    if (!current) return fail(404, "Delivery not found.");
    if (current.status !== "failed" || !current.enabled) return fail(409, "Only failed deliveries for enabled rules can be retried.");
    const [updated] = await db.batch([
      db.prepare(`UPDATE branch_webhook_deliveries SET status='pending', retry_count=0, due_at=unixepoch()
        WHERE id IN (SELECT d.id ${scope} AND d.status='failed' AND rule.enabled=1 AND rule.archived=0
          AND e.created_at>unixepoch()-${webhookRetentionSeconds} AND NOT ${webhookBlocked})`).bind(id, businessId, branchId),
      audit("retry", id!),
    ]);
    return updated.meta.changes ? success({ id }) : fail(409, "This delivery is blocked, expired, or no longer failed.");
  }

  const current = action === "create" ? null : await db.prepare(`SELECT ${ruleColumns} ${ruleJoin}
    WHERE rule.business_id=? AND rule.branch_id=? AND rule.id=?`).bind(businessId, branchId, id).first<SavedRule>();
  if (action !== "create" && !current) return fail(404, "Webhook rule not found.");
  if (current?.archived) return fail(409, "This webhook rule is archived.");
  const stop = (ruleId: string, revision: number) => db.prepare(`
    UPDATE branch_webhook_deliveries SET status='stopped', error='The rule was disabled or archived.'
    WHERE webhook_id=? AND status IN ('pending','failed') AND EXISTS (
      SELECT 1 FROM branch_webhooks rule WHERE rule.id=? AND rule.revision=? AND rule.enabled=0
    )
  `).bind(ruleId, ruleId, revision);
  if (action === "archive" && current) {
    const [updated] = await db.batch([
      db.prepare("UPDATE branch_webhooks SET enabled=0, archived=1 WHERE id=? AND business_id=? AND branch_id=? AND archived=0 AND revision=?")
        .bind(current.id, businessId, branchId, current.revision),
      audit("archive", current.id),
      stop(current.id, current.revision),
    ]);
    return updated.meta.changes ? success({ id: current.id }) : fail(409, "Reload the rule before archiving.");
  }

  if (current && input.revision !== current.revision) return fail(409, "This rule changed. Reload before saving.");
  if (action === "toggle" && current) {
    if (typeof input.enabled !== "boolean") return fail(400, "Invalid enabled value.");
    const enabled = Number(input.enabled);
    if (enabled === current.enabled) return success({ id: current.id });
    if (enabled) {
      try { webhookDestination(env, current.url); }
      catch (error) { return fail(400, (error as Error).message); }
    }
    const [updated] = await db.batch([
      db.prepare(`UPDATE branch_webhooks SET enabled=?
        WHERE id=? AND business_id=? AND branch_id=? AND revision=? AND archived=0 AND enabled=?`)
        .bind(enabled, current.id, businessId, branchId, current.revision, current.enabled),
      audit(enabled ? "enable" : "disable", current.id),
      ...(!enabled ? [stop(current.id, current.revision)] : []),
    ]);
    return updated.meta.changes ? success({ id: current.id }) : fail(409, "Reload the rule before changing its status.");
  }
  let config: ReturnType<typeof validateRule>;
  let headers: Record<string, string> | undefined;
  try {
    config = validateRule(env, input);
    if (input.headers !== undefined) headers = parseHeaders(input.headers);
    if (current && !headers && JSON.parse(current.headerNamesJson).length &&
      new URL(current.url).origin !== new URL(config.url).origin)
      throw new Error("Replace or clear the saved headers when changing the destination origin.");
  } catch (error) {
    return fail(400, (error as Error).message);
  }
  const ciphertext = headers || !current ? await encryptWebhookHeaders(env, businessId, branchId, headers ?? {}) : current.headersCiphertext;
  const names = headers || !current ? JSON.stringify(Object.keys(headers ?? {})) : current.headerNamesJson;
  const ruleId = current?.id ?? crypto.randomUUID();
  const revision = (current?.revision ?? 0) + 1;
  const enabled = Boolean(current?.enabled);
  const mutation = current
    ? db.prepare(`UPDATE branch_webhooks SET name=?, revision=?, enabled=?
        WHERE id=? AND business_id=? AND branch_id=? AND revision=? AND enabled=? AND archived=0`)
      .bind(config.name, revision, Number(enabled), ruleId, businessId, branchId, current.revision, current.enabled)
    : db.prepare(`INSERT INTO branch_webhooks (id,business_id,branch_id,name)
        SELECT ?,?,?,? WHERE (SELECT count(*) FROM branch_webhooks WHERE business_id=? AND branch_id=? AND archived=0)<20`)
      .bind(ruleId, businessId, branchId, config.name, businessId, branchId);
  const [updated] = await db.batch([
    mutation,
    db.prepare(`INSERT INTO branch_webhook_revisions
      (webhook_id,revision,name,table_key,event,url,host,method,filter_json,body_json,include_contact,header_names_json,headers_ciphertext,body_format)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`)
      .bind(ruleId, revision, config.name, config.table, config.event, config.url, config.host, config.method,
        JSON.stringify(config.filter), JSON.stringify(config.body), Number(config.contact), names, ciphertext, config.bodyFormat),
    audit(action, ruleId, { revision, enabled, table: config.table, event: config.event, host: config.host }),
    ...(!enabled && current ? [stop(ruleId, revision)] : []),
  ]);
  return updated.meta.changes ? success({ id: ruleId }) : fail(409, current ? "This rule changed. Reload before saving." : "This branch already has 20 webhook rules.");
}
