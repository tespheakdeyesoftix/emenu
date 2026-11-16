import { renderWebhookBody, webhookFields, type WebhookBodyFormat, type WebhookTable } from "../../../shared/branchWebhooks";
import type { Env } from "./index";
import { checkWebhookDns, decryptWebhookHeaders, webhookDestination } from "./webhookDestination";
import { maxWebhookBodyBytes } from "./webhookEvents";

const retryDelays = [60, 300, 1800];
export const webhookRetentionSeconds = 24 * 60 * 60;

// d and e are the candidate delivery and event. Deliveries of the same event
// may run together, but no later event can pass an unresolved predecessor.
export const webhookBlocked = `EXISTS (
  SELECT 1 FROM branch_webhook_events earlier
  JOIN branch_webhook_deliveries prior ON prior.event_sequence=earlier.sequence AND prior.host=d.host
  WHERE earlier.business_id=e.business_id AND earlier.branch_id=e.branch_id
    AND earlier.table_key=e.table_key AND earlier.record_id=e.record_id AND earlier.sequence<e.sequence
    AND prior.status IN ('pending','sending','failed','stopped')
)`;

type DeliveryJob = {
  id: string;
  eventId: string;
  businessId: string;
  branchId: string;
  event: string;
  table: WebhookTable;
  occurredAt: number;
  recordJson: string;
  previousJson: string | null;
  url: string;
  method: string;
  bodyJson: string;
  bodyFormat: WebhookBodyFormat;
  headersCiphertext: string;
  includeContact: number;
};
type Outcome = { httpStatus: number | null; error: string | null; retry: boolean };

function includesOrderItems(template: unknown): boolean {
  if (template && typeof template === "object") return Object.values(template).some(includesOrderItems);
  return template === "{{record.items}}" || template === "{{previous.items}}";
}

async function send(env: Env, job: DeliveryJob): Promise<Outcome> {
  let destination: ReturnType<typeof webhookDestination>;
  try {
    destination = webhookDestination(env, job.url);
  } catch (error) {
    return { httpStatus: null, error: (error as Error).message, retry: false };
  }
  let headers: Headers;
  let body: string | undefined;
  try {
    headers = new Headers(await decryptWebhookHeaders(env, job.businessId, job.branchId, job.headersCiphertext));
    if (!headers.has("content-type") && job.bodyFormat !== "none")
      headers.set("content-type", job.bodyFormat === "json" ? "application/json" : "text/plain; charset=UTF-8");
    headers.set("x-emenu-event-id", job.eventId);
    headers.set("x-emenu-delivery-id", job.id);
    headers.set("x-emenu-event", job.event);
    if (!headers.has("idempotency-key")) headers.set("idempotency-key", job.id);
    const fields = webhookFields(job.table, Boolean(job.includeContact));
    const snapshot = (value: string): Record<string, unknown> => Object.fromEntries(
      Object.entries(JSON.parse(value)).filter(([field]) => Object.hasOwn(fields, field)),
    );
    const template = JSON.parse(job.bodyJson);
    const record = snapshot(job.recordJson);
    const previous = job.previousJson ? snapshot(job.previousJson) : null;
    const needsItems = job.bodyFormat === "text" && typeof template === "string"
      ? template.includes("{{record.items}}") || template.includes("{{previous.items}}")
      : includesOrderItems(template);
    if (job.table === "orders" && record.items === null && needsItems)
      return { httpStatus: null, error: "The order line items exceed the 256 KB delivery limit.", retry: false };
    body = renderWebhookBody(template, {
      event: job.event, eventId: job.eventId, deliveryId: job.id, businessId: job.businessId, branchId: job.branchId,
      occurredAt: new Date(job.occurredAt * 1000).toISOString(),
      record, previous,
    }, job.bodyFormat);
  } catch {
    return { httpStatus: null, error: "The saved webhook configuration could not be rendered.", retry: false };
  }
  if (body !== undefined && new TextEncoder().encode(body).length > maxWebhookBodyBytes)
    return { httpStatus: null, error: "The rendered body exceeds 256 KB.", retry: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    if (!destination.localHttp) {
      const publicDns = await checkWebhookDns(destination.host, controller.signal).catch(() => null);
      if (publicDns === null) return { httpStatus: null, error: "The destination DNS could not be verified.", retry: true };
      if (!publicDns) return { httpStatus: null, error: "The destination resolves to a non-public address.", retry: false };
    }
    const result = await fetch(destination.url, { method: job.method, headers, body, redirect: "manual", signal: controller.signal });
    if (result.body) void result.body.cancel().catch(() => {});
    return {
      httpStatus: result.status,
      error: result.ok ? null : result.status >= 300 && result.status < 400
        ? "Redirects are not followed." : "The endpoint returned an HTTP error.",
      retry: result.status === 429 || result.status >= 500,
    };
  } catch {
    return { httpStatus: null, error: controller.signal.aborted ? "The endpoint timed out." : "The endpoint could not be reached.", retry: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function processJob(env: Env, job: DeliveryJob) {
  const lease = crypto.randomUUID();
  const claimed = await env.DB.prepare(`
    UPDATE branch_webhook_deliveries SET status='sending', attempts=attempts+1,
      retry_count=retry_count+1, attempted_at=unixepoch(), due_at=unixepoch()+60, lease_token=?
    WHERE id=? AND status='pending' AND due_at<=unixepoch()
      AND EXISTS (SELECT 1 FROM branch_webhook_events event WHERE event.sequence=event_sequence
        AND event.created_at>unixepoch()-${webhookRetentionSeconds})
      AND EXISTS (SELECT 1 FROM branch_webhooks rule WHERE rule.id=webhook_id AND rule.enabled=1 AND rule.archived=0)
    RETURNING retry_count AS retryCount
  `).bind(lease, job.id).first<{ retryCount: number }>();
  if (!claimed) return;
  const result = await send(env, job);
  const delay = result.retry ? retryDelays[claimed.retryCount - 1] : undefined;
  await env.DB.prepare(`
    UPDATE branch_webhook_deliveries SET status=CASE
      WHEN ?1='succeeded' THEN 'succeeded'
      WHEN NOT EXISTS (SELECT 1 FROM branch_webhooks rule WHERE rule.id=webhook_id AND rule.enabled=1 AND rule.archived=0)
        THEN 'stopped' ELSE ?1 END,
      due_at=unixepoch()+?2, http_status=?3, error=?4, lease_token=NULL, history_hidden=0
    WHERE id=?5 AND status='sending' AND lease_token=?6
  `).bind(result.error === null ? "succeeded" : delay === undefined ? "failed" : "pending",
    delay ?? 0, result.httpStatus, result.error, job.id, lease).run();
}

export async function drainBranchWebhooks(env: Env, businessId?: string) {
  const scope = businessId ? "AND e.business_id=?" : "";
  const query = env.DB.prepare(`
    SELECT d.id, e.id AS eventId, e.business_id AS businessId, e.branch_id AS branchId,
      e.event, e.table_key AS "table", e.created_at AS occurredAt, e.record_json AS recordJson,
      e.previous_json AS previousJson, config.url, config.method, config.body_json AS bodyJson,
      config.body_format AS bodyFormat, config.headers_ciphertext AS headersCiphertext, config.include_contact AS includeContact
    FROM branch_webhook_deliveries d
    JOIN branch_webhook_events e ON e.sequence=d.event_sequence
    JOIN branch_webhooks rule ON rule.id=d.webhook_id AND rule.enabled=1 AND rule.archived=0
    JOIN branch_webhook_revisions config ON config.webhook_id=d.webhook_id AND config.revision=d.revision
    WHERE d.status='pending' AND d.due_at<=unixepoch() AND e.created_at>unixepoch()-${webhookRetentionSeconds}
      ${scope} AND NOT ${webhookBlocked}
    ORDER BY e.sequence, d.id LIMIT 8
  `);
  const { results } = await (businessId ? query.bind(businessId) : query).all<DeliveryJob>();
  for (let index = 0; index < results.length; index += 3)
    await Promise.all(results.slice(index, index + 3).map(job => processJob(env, job)));
}

export function scheduleBranchWebhooks(env: Env, execution: ExecutionContext, businessId: string) {
  execution.waitUntil(drainBranchWebhooks(env, businessId).catch(() => {
    console.error("branch_webhook_background_delivery_failed", { businessId });
  }));
}

export async function runBranchWebhookScheduler(env: Env) {
  await env.DB.prepare(`
    UPDATE branch_webhook_deliveries SET status=CASE
      WHEN NOT EXISTS (SELECT 1 FROM branch_webhooks rule WHERE rule.id=webhook_id AND rule.enabled=1 AND rule.archived=0)
        THEN 'stopped' WHEN retry_count>=4 THEN 'failed' ELSE 'pending' END,
      due_at=unixepoch()+CASE retry_count WHEN 1 THEN 0 WHEN 2 THEN 240 WHEN 3 THEN 1740 ELSE 0 END,
      lease_token=NULL, error='The previous attempt did not finish.'
    WHERE status='sending' AND due_at<=unixepoch()
  `).run();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE branch_webhook_deliveries AS target SET status='expired', lease_token=NULL,
        error='An earlier delivery expired before it succeeded.'
      WHERE target.status IN ('pending','failed','stopped') AND EXISTS (
        SELECT 1 FROM branch_webhook_events e
        JOIN branch_webhook_events earlier ON earlier.business_id=e.business_id AND earlier.branch_id=e.branch_id
          AND earlier.table_key=e.table_key AND earlier.record_id=e.record_id AND earlier.sequence<e.sequence
        JOIN branch_webhook_deliveries prior ON prior.event_sequence=earlier.sequence AND prior.host=target.host
        WHERE e.sequence=target.event_sequence AND earlier.created_at<=unixepoch()-${webhookRetentionSeconds}
          AND prior.status IN ('pending','sending','failed','stopped')
      )
    `),
    env.DB.prepare(`DELETE FROM branch_webhook_events WHERE created_at<=unixepoch()-${webhookRetentionSeconds}`),
    env.DB.prepare(`
      DELETE FROM branch_webhook_revisions AS config
      WHERE config.revision<>(SELECT revision FROM branch_webhooks rule WHERE rule.id=config.webhook_id)
        AND NOT EXISTS (SELECT 1 FROM branch_webhook_deliveries d WHERE d.webhook_id=config.webhook_id AND d.revision=config.revision)
    `),
  ]);
  await drainBranchWebhooks(env);
}
