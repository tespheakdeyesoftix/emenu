import {
  maxTelegramChatListLength,
  maxTelegramChatsPerRule,
  maxTelegramDeliveryRetentionDays,
  maxTelegramOrderActionUrlLength,
  minTelegramDeliveryRetentionDays,
  telegramDeliveryRetentionDays,
  telegramSources,
  telegramTemplates,
  type TelegramSource,
  type TelegramTestResult,
  type TelegramDeliveryHistoryItem,
} from "../../../shared/telegramNotifications";
import type { Env } from "./index";
import {
  telegramExamples,
  telegramSourceContext,
} from "./telegramNotificationSources";
import {
  encryptTelegramToken,
  sendTelegramMessage,
  telegramBotTokenPattern,
  telegramChatIdPattern,
} from "./telegramOrders";
import {
  renderTelegramTemplate,
  type TemplateRecord,
} from "./telegramTemplate";

const endpoint = "/api/admin/telegram-notifications";
const maxAttempts = 3;
const maxRules = 100;
const historyPageSize = 40;
const notificationIdPattern = /^tgn_[a-f0-9]{32}$/;
export const telegramDeliveryExpiresAt =
  "delivery.created_at + delivery.history_days * 86400";
const json = (body: unknown, status = 200) => Response.json(body, { status });
const error = (message: string, status = 400) =>
  json({ error: message }, status);

export async function canManageTelegramNotifications(
  db: D1Database,
  auth: { businessId: string; role: string },
) {
  if (auth.role !== "owner" && auth.role !== "manager") return false;
  return Boolean(
    await db
      .prepare(
        "SELECT 1 FROM telegram_notification_entitlements WHERE business_id=?",
      )
      .bind(auth.businessId)
      .first(),
  );
}

function renderNotification(
  title: string,
  message: string,
  doc: TemplateRecord,
) {
  const business = doc.business as TemplateRecord;
  const timezone = String(doc.timezone ?? business.timezone ?? "UTC");
  return renderTelegramTemplate(`${title}\n\n${message}`, doc, timezone);
}

type OrderActionSettings = {
  showAcceptButton: number | null;
  acceptUrl: string | null;
  showCancelButton: number | null;
  cancelUrl: string | null;
};

function resolveOrderActionUrl(template: string, doc: TemplateRecord) {
  const url = template.replace(
    /{{\s*doc\.(id|order_number)\s*}}/g,
    (_, field: string) => encodeURIComponent(String(doc[field] ?? "")),
  );
  if (!/^https?:\/\/[^/?#]/i.test(url) || /[\s{}\\]/.test(url)) return;
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return parsed.href;
  } catch {
    return;
  }
}

function orderActionKeyboard(
  env: Env,
  settings: OrderActionSettings,
  doc: TemplateRecord,
  orderId?: string,
) {
  const base = env.ADMIN_APP_URL || "https://angkor-emenu-admin.pages.dev";
  const row: { text: string; url: string }[] = [];
  for (const { action, enabled, template, text } of [
    {
      action: "accept",
      enabled: settings.showAcceptButton,
      template: settings.acceptUrl,
      text: "Accept order",
    },
    {
      action: "cancel",
      enabled: settings.showCancelButton,
      template: settings.cancelUrl,
      text: "Cancel order",
    },
  ]) {
    if (!enabled) continue;
    const customUrl = template && resolveOrderActionUrl(template, doc);
    const url = new URL("/orders", base);
    url.searchParams.set("telegramAction", action);
    if (orderId) url.searchParams.set("telegramOrder", orderId);
    row.push({ text, url: customUrl || url.href });
  }
  return row.length ? [row] : undefined;
}

const activeRoutes = `FROM telegram_notifications route JOIN telegram_notification_entitlements entitlement
  ON entitlement.business_id=route.business_id WHERE route.enabled=1`;

// Manual retries use the original event and chat with the rule's current template and token.
const retryRoute = `SELECT 1 ${activeRoutes}
  AND route.id=delivery.notification_id AND route.business_id=delivery.business_id AND route.source=delivery.source
  AND EXISTS (SELECT 1 FROM telegram_notification_recipients recipient
    WHERE recipient.notification_id=route.id AND recipient.chat_id=delivery.chat_id COLLATE NOCASE)
  AND (
    (delivery.source='Order' AND EXISTS (SELECT 1 FROM orders o WHERE o.id=delivery.source_id
      AND o.business_id=delivery.business_id AND (route.branch_id IS NULL OR route.branch_id=o.branch_id)))
    OR (delivery.source='Booking' AND EXISTS (SELECT 1 FROM bookings bk WHERE bk.id=delivery.source_id
      AND bk.business_id=delivery.business_id AND (route.branch_id IS NULL OR route.branch_id=bk.branch_id)))
  )`;

async function deliveryHistory(db: D1Database, businessId: string, url: URL) {
  const status = url.searchParams.get("status");
  if (status && !["pending", "sent", "failed", "cancelled"].includes(status))
    return error("Choose a valid delivery status.");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0)
    return error("Choose a valid history page.");
  const { results } = await db
    .prepare(
      `SELECT delivery.notification_id AS notificationId,
    delivery.source,delivery.source_id AS sourceId,delivery.source_reference AS reference,delivery.chat_id AS chatId,
    delivery.status,delivery.attempts,delivery.created_at AS createdAt,delivery.updated_at AS updatedAt,delivery.error,
    CASE WHEN delivery.status='failed' THEN EXISTS (${retryRoute}) ELSE 0 END AS canRetry
    FROM telegram_notification_deliveries delivery
    WHERE delivery.business_id=? AND ${telegramDeliveryExpiresAt}>=unixepoch()
      ${status ? "AND delivery.status=?" : ""}
    ORDER BY delivery.created_at DESC,delivery.rowid DESC LIMIT ? OFFSET ?`,
    )
    .bind(businessId, ...(status ? [status] : []), historyPageSize + 1, offset)
    .all<TelegramDeliveryHistoryItem>();
  return json({
    deliveries: results.slice(0, historyPageSize),
    hasMore: results.length > historyPageSize,
    pageSize: historyPageSize,
  });
}

function cancelPending(
  db: D1Database,
  businessId: string,
  id: string,
  reason: string,
) {
  return db
    .prepare(
      `UPDATE telegram_notification_deliveries SET status='cancelled',error=?,updated_at=unixepoch()
    WHERE notification_id=? AND business_id=? AND status='pending'`,
    )
    .bind(reason, id, businessId);
}

export async function adminTelegramNotifications(
  request: Request,
  env: Env,
  path: string,
  businessId: string,
) {
  const db = env.DB;
  if (path === `${endpoint}/history` && request.method === "GET")
    return deliveryHistory(db, businessId, new URL(request.url));
  if (path === `${endpoint}/history/retry` && request.method === "POST") {
    const body = await request
      .json<Record<string, unknown>>()
      .catch(() => null);
    const { notificationId, sourceId, chatId } = body ?? {};
    if (
      typeof notificationId !== "string" ||
      !notificationIdPattern.test(notificationId) ||
      typeof sourceId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(sourceId) ||
      typeof chatId !== "string" ||
      !telegramChatIdPattern.test(chatId)
    )
      return error("Choose a valid Telegram delivery.");
    const attempted = await deliver(
      env,
      { notificationId, sourceId, chatId },
      businessId,
    );
    return attempted
      ? json({ ok: true })
      : error("This delivery is no longer available to retry.", 409);
  }
  if (path === endpoint && request.method === "GET") {
    const [rules, branches] = await db.batch([
      db
        .prepare(
          `SELECT rule.id,rule.branch_id AS branchId,rule.source,replace(rule.chat_id,',',', ') AS chatId,
        rule.title,rule.message,rule.enabled,rule.history_days AS historyDays,rule.updated_at AS updatedAt,
        rule.show_accept_button AS showAcceptButton,rule.accept_url AS acceptUrl,
        rule.show_cancel_button AS showCancelButton,rule.cancel_url AS cancelUrl,
        (SELECT delivery.status FROM telegram_notification_deliveries delivery WHERE delivery.notification_id=rule.id
          AND ${telegramDeliveryExpiresAt}>=unixepoch() ORDER BY delivery.updated_at DESC,delivery.rowid DESC LIMIT 1) AS lastStatus
        FROM telegram_notifications rule WHERE rule.business_id=? ORDER BY rule.source,rule.title,rule.id`,
        )
        .bind(businessId),
      db
        .prepare(
          "SELECT id,name,is_active AS isActive FROM branches WHERE business_id=? ORDER BY is_default DESC,name",
        )
        .bind(businessId),
    ]);
    return json({
      rules: rules.results,
      branches: branches.results,
      examples: telegramExamples,
      templates: telegramTemplates,
    });
  }

  const id = /^\/api\/admin\/telegram-notifications\/(tgn_[a-f0-9]{32})$/.exec(
    path,
  )?.[1];
  if (id && request.method === "DELETE") {
    const [result] = await db.batch([
      db
        .prepare(
          "DELETE FROM telegram_notifications WHERE business_id=? AND id=?",
        )
        .bind(businessId, id),
      cancelPending(
        db,
        businessId,
        id,
        "Notification rule was deleted before delivery.",
      ),
    ]);
    return result.meta.changes
      ? json({ ok: true })
      : error("Notification not found.", 404);
  }
  const preview = path === `${endpoint}/preview` && request.method === "POST";
  const testing = path === `${endpoint}/test` && request.method === "POST";
  const creating = path === endpoint && request.method === "POST";
  if (!preview && !testing && !creating && !(id && request.method === "PUT"))
    return error("Notification not found.", 404);
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  const source = telegramSources.find((entry) => entry === body?.source);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (
    !source ||
    !title ||
    title.length > 160 ||
    !message ||
    message.length > 6000
  )
    return error(
      "Choose a source and enter a title and message within the length limits.",
    );
  let text: string;
  try {
    text = renderNotification(title, message, telegramExamples[source]);
  } catch (cause) {
    return error(
      cause instanceof Error ? cause.message : "Invalid Telegram template.",
    );
  }
  if (!text) return error("The template renders an empty message.");
  if (preview) return json({ text });

  const { showAcceptButton, acceptUrl, showCancelButton, cancelUrl } =
    source === "Order" ? (body ?? {}) : {};
  if (
    [showAcceptButton, showCancelButton].some(
      (value) => value !== undefined && typeof value !== "boolean",
    )
  )
    return error("Choose whether to show each order button.");
  for (const [label, show, url] of [
    ["Accept", showAcceptButton, acceptUrl],
    ["Cancel", showCancelButton, cancelUrl],
  ] as const) {
    // A partial update must explicitly turn off a button before clearing its URL.
    const needsUrl =
      show === true || (id && show === undefined && url !== undefined);
    if (
      needsUrl &&
      (url === undefined || (typeof url === "string" && !url.trim()))
    )
      return error(`Enter a ${label} URL or turn off the ${label} button.`);
    if (url === undefined) continue;
    if (
      typeof url !== "string" ||
      url.length > maxTelegramOrderActionUrlLength ||
      (url.trim() && !resolveOrderActionUrl(url.trim(), telegramExamples.Order))
    )
      return error(`Enter a valid HTTP or HTTPS URL for ${label}.`);
  }
  const orderActions: OrderActionSettings = {
    showAcceptButton:
      showAcceptButton === undefined ? null : Number(showAcceptButton),
    acceptUrl: typeof acceptUrl === "string" ? acceptUrl.trim() : null,
    showCancelButton:
      showCancelButton === undefined ? null : Number(showCancelButton),
    cancelUrl: typeof cancelUrl === "string" ? cancelUrl.trim() : null,
  };

  const chatList = typeof body?.chatId === "string" ? body.chatId.trim() : "";
  if (chatList.length > maxTelegramChatListLength)
    return error(`Enter up to ${maxTelegramChatsPerRule} Telegram chat IDs.`);
  const entries = chatList
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const chats = new Map(entries.map((entry) => [entry.toLowerCase(), entry]));
  if (
    !chats.size ||
    chats.size > maxTelegramChatsPerRule ||
    entries.some((entry) => !telegramChatIdPattern.test(entry))
  )
    return error(
      `Enter valid Telegram chat IDs separated by commas (up to ${maxTelegramChatsPerRule}).`,
    );
  const chatIds = [...chats.values()];
  const token = typeof body?.botToken === "string" ? body.botToken.trim() : "";
  if ((creating || token) && !telegramBotTokenPattern.test(token))
    return error("Enter a valid Telegram bot token.");
  if (testing) {
    const savedId = body?.notificationId;
    if (
      savedId != null &&
      (typeof savedId !== "string" || !notificationIdPattern.test(savedId))
    )
      return error("Choose a valid notification.");
    const savedToken = savedId
      ? await db
          .prepare(
            "SELECT telegram_token FROM telegram_notifications WHERE id=? AND business_id=?",
          )
          .bind(savedId, businessId)
          .first<string>("telegram_token")
      : null;
    if (savedId && !savedToken) return error("Notification not found.", 404);
    const encryptedToken = token
      ? await encryptTelegramToken(env, businessId, token)
      : savedToken;
    if (!encryptedToken)
      return error("Enter a Telegram bot token to send a test.");
    const results: TelegramTestResult[] = [];
    const testMessage = `eMenu test message\n\n${text}`;
    const keyboard =
      source === "Order"
        ? orderActionKeyboard(env, orderActions, telegramExamples.Order)
        : undefined;
    for (let offset = 0; offset < chatIds.length; offset += 5) {
      const batch = await Promise.all(
        chatIds
          .slice(offset, offset + 5)
          .map(async (chatId): Promise<TelegramTestResult> => {
            const result = await sendTelegramMessage(
              env,
              businessId,
              { enabled: 1, chatId, encryptedToken },
              testMessage,
              keyboard,
            );
            return result.ok
              ? { chatId, ok: true }
              : { chatId, ok: false, error: result.error };
          }),
      );
      results.push(...batch);
    }
    return json({ results });
  }

  const chatId = chatIds.join(",");
  const branchId = body?.branchId;
  const enabled = body?.enabled;
  const historyDays = body?.historyDays;
  if (
    branchId !== null &&
    (typeof branchId !== "string" ||
      !(await db
        .prepare("SELECT 1 FROM branches WHERE business_id=? AND id=?")
        .bind(businessId, branchId)
        .first()))
  )
    return error("Choose a branch from this business.");
  if (typeof enabled !== "boolean")
    return error("Choose a notification status.");
  if (
    historyDays !== undefined &&
    (typeof historyDays !== "number" ||
      !Number.isInteger(historyDays) ||
      historyDays < minTelegramDeliveryRetentionDays ||
      historyDays > maxTelegramDeliveryRetentionDays)
  )
    return error(
      `Enter a whole number from ${minTelegramDeliveryRetentionDays} to ${maxTelegramDeliveryRetentionDays} for history days.`,
    );
  const encrypted = token
    ? await encryptTelegramToken(env, businessId, token)
    : null;
  try {
    if (creating) {
      const newId = `tgn_${crypto.randomUUID().replaceAll("-", "")}`;
      const result = await db
        .prepare(
          `INSERT INTO telegram_notifications
        (id,business_id,branch_id,source,telegram_token,chat_id,title,message,enabled,history_days,
        show_accept_button,accept_url,show_cancel_button,cancel_url)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM telegram_notifications WHERE business_id=?)<?`,
        )
        .bind(
          newId,
          businessId,
          branchId,
          source,
          encrypted,
          chatId,
          title,
          message,
          Number(enabled),
          historyDays ?? telegramDeliveryRetentionDays,
          orderActions.showAcceptButton ?? 0,
          orderActions.acceptUrl ?? "",
          orderActions.showCancelButton ?? 0,
          orderActions.cancelUrl ?? "",
          businessId,
          maxRules,
        )
        .run();
      return result.meta.changes
        ? json({ id: newId }, 201)
        : error(`This business can have up to ${maxRules} notifications.`, 409);
    }
    if (!id) return error("Notification not found.", 404);
    const result = await db
      .prepare(
        `UPDATE telegram_notifications SET branch_id=?,source=?,telegram_token=COALESCE(?,telegram_token),
        chat_id=?,title=?,message=?,enabled=?,history_days=COALESCE(?,history_days),
        show_accept_button=COALESCE(?,show_accept_button),accept_url=COALESCE(?,accept_url),
        show_cancel_button=COALESCE(?,show_cancel_button),cancel_url=COALESCE(?,cancel_url),updated_at=CURRENT_TIMESTAMP
        WHERE business_id=? AND id=?`,
      )
      .bind(
        branchId,
        source,
        encrypted,
        chatId,
        title,
        message,
        Number(enabled),
        historyDays ?? null,
        orderActions.showAcceptButton,
        orderActions.acceptUrl,
        orderActions.showCancelButton,
        orderActions.cancelUrl,
        businessId,
        id,
      )
      .run();
    return result.meta.changes
      ? json({ id })
      : error("Notification not found.", 404);
  } catch (cause) {
    if (String(cause).includes("TELEGRAM_DUPLICATE_RECIPIENT"))
      return error(
        "One or more chats already have a notification for that source and branch.",
        409,
      );
    throw cause;
  }
}

type DeliveryKey = { notificationId: string; sourceId: string; chatId: string };

async function deliver(
  env: Env,
  { notificationId, sourceId, chatId }: DeliveryKey,
  retryBusinessId?: string,
) {
  const db = env.DB;
  const claimScope = retryBusinessId
    ? `delivery.business_id=? AND EXISTS (${retryRoute})`
    : `delivery.next_attempt_at<=unixepoch() AND EXISTS (SELECT 1 ${activeRoutes}
      AND route.id=delivery.notification_id AND route.business_id=delivery.business_id AND route.source=delivery.source)`;
  const claim = await db
    .prepare(
      `UPDATE telegram_notification_deliveries AS delivery
    SET status='pending',attempts=attempts+1,next_attempt_at=unixepoch()+120,updated_at=unixepoch()
    WHERE notification_id=? AND source_id=? AND chat_id=? AND status=?
      AND ${telegramDeliveryExpiresAt}>=unixepoch() AND ${claimScope}
    RETURNING attempts,business_id AS businessId,source`,
    )
    .bind(
      notificationId,
      sourceId,
      chatId,
      retryBusinessId ? "failed" : "pending",
      ...(retryBusinessId ? [retryBusinessId] : []),
    )
    .first<{ attempts: number; businessId: string; source: TelegramSource }>();
  if (!claim) return false;
  const route = await db
    .prepare(
      `SELECT route.business_id AS businessId,route.source,route.title,route.message,
    route.telegram_token AS encryptedToken,route.enabled,
    route.show_accept_button AS showAcceptButton,route.accept_url AS acceptUrl,
    route.show_cancel_button AS showCancelButton,route.cancel_url AS cancelUrl
    ${activeRoutes} AND route.id=? AND route.business_id=? AND route.source=?`,
    )
    .bind(notificationId, claim.businessId, claim.source)
    .first<
      OrderActionSettings & {
        businessId: string;
        source: TelegramSource;
        title: string;
        message: string;
        encryptedToken: string;
        enabled: number;
      }
    >();
  let result: Awaited<ReturnType<typeof sendTelegramMessage>> = {
    ok: false,
    error: "Notification or source record is unavailable.",
  };
  if (route && (retryBusinessId || claim.attempts <= maxAttempts)) {
    const doc = await telegramSourceContext(
      db,
      route.businessId,
      route.source,
      sourceId,
    );
    if (doc) {
      let text = "";
      try {
        text = renderNotification(route.title, route.message, doc);
      } catch {
        result = {
          ok: false,
          error:
            "The message could not be rendered. Review the notification template.",
        };
      }
      if (
        text &&
        (await db
          .prepare(
            `SELECT 1 FROM telegram_notification_deliveries
        WHERE notification_id=? AND source_id=? AND chat_id=? AND status='pending' AND attempts=?
          AND EXISTS (SELECT 1 ${activeRoutes} AND route.id=notification_id)`,
          )
          .bind(notificationId, sourceId, chatId, claim.attempts)
          .first())
      )
        result = await sendTelegramMessage(
          env,
          route.businessId,
          { ...route, chatId },
          text,
          route.source === "Order" && doc.status === "submitted"
            ? orderActionKeyboard(env, route, doc, sourceId)
            : undefined,
        );
    }
  }
  const retryIn =
    !result.ok && !retryBusinessId && claim.attempts < maxAttempts
      ? (result.retryAfter ?? 0)
      : 0;
  await db
    .prepare(
      `UPDATE telegram_notification_deliveries SET status=?,error=?,next_attempt_at=unixepoch()+?,updated_at=unixepoch()
    WHERE notification_id=? AND source_id=? AND chat_id=? AND attempts=?
      AND (status='pending' OR (status='cancelled' AND ?=1))`,
    )
    .bind(
      result.ok ? "sent" : retryIn ? "pending" : "failed",
      result.ok ? null : result.error,
      retryIn,
      notificationId,
      sourceId,
      chatId,
      claim.attempts,
      Number(result.ok),
    )
    .run();
  return true;
}

export async function deliverTelegramNotifications(
  env: Env,
  source?: TelegramSource,
  sourceId?: string,
) {
  const base = `SELECT delivery.notification_id AS notificationId,delivery.source_id AS sourceId,delivery.chat_id AS chatId
    FROM telegram_notification_deliveries delivery
    JOIN telegram_notifications route ON route.id=delivery.notification_id
    JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=route.business_id
    WHERE delivery.status='pending' AND delivery.next_attempt_at<=unixepoch()
      AND ${telegramDeliveryExpiresAt}>=unixepoch() AND route.enabled=1`;
  const statement = source
    ? env.DB.prepare(
        `${base} AND route.source=? AND delivery.source_id=? ORDER BY delivery.next_attempt_at LIMIT 10`,
      ).bind(source, sourceId)
    : env.DB.prepare(`${base} ORDER BY delivery.next_attempt_at LIMIT 30`);
  const { results } = await statement.all<DeliveryKey>();
  for (let offset = 0; offset < results.length; offset += 5)
    await Promise.allSettled(
      results
        .slice(offset, offset + 5)
        .map((delivery) => deliver(env, delivery)),
    );
}
