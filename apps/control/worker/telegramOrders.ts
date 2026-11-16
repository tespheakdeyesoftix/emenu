import type { Env } from "./index";

export const telegramChatIdPattern =
  /^(?:-?[1-9]\d{0,15}|@[A-Za-z0-9_]{5,32})$/;
export const telegramBotTokenPattern = /^\d{1,20}:[A-Za-z0-9_-]{20,100}$/;
const maxAttempts = 3;
const encoder = new TextEncoder();

async function encryptionKey(env: Env, businessId: string) {
  if (!env.AUTH_PEPPER || env.AUTH_PEPPER.length < 32)
    throw new Error("Telegram credential encryption is unavailable");
  const secret = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.AUTH_PEPPER),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("emenu:telegram:v1"),
      info: encoder.encode(businessId),
    },
    secret,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptTelegramToken(
  env: Env,
  businessId: string,
  token: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env, businessId);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(token),
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(ciphertext)));
}

async function decryptTelegramToken(
  env: Env,
  businessId: string,
  value: string,
) {
  const bytes = Uint8Array.from(atob(value), (character) =>
    character.charCodeAt(0),
  );
  const key = await encryptionKey(env, businessId);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, 12) },
    key,
    bytes.subarray(12),
  );
  return new TextDecoder().decode(plaintext);
}

export type TelegramSettings = {
  chatId: string;
  enabled: number;
  encryptedToken: string;
};

function readTelegramSettings(db: D1Database, businessId: string) {
  return db
    .prepare(
      `SELECT chat_id AS chatId, enabled, encrypted_token AS encryptedToken
    FROM business_telegram_notifications WHERE business_id=?`,
    )
    .bind(businessId)
    .first<TelegramSettings>();
}

type TelegramResult =
  { ok: true } | { ok: false; error: string; retryAfter?: number };

export async function sendTelegramMessage(
  env: Env,
  businessId: string,
  settings: TelegramSettings,
  message: string,
  inlineKeyboard?: { text: string; url: string }[][],
): Promise<TelegramResult> {
  let token: string;
  try {
    token = await decryptTelegramToken(
      env,
      businessId,
      settings.encryptedToken,
    );
  } catch {
    return { ok: false, error: "Save the Telegram bot token again." };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          link_preview_options: { is_disabled: true },
          ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }),
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      parameters?: { retry_after?: number };
    } | null;
    if (response.ok && body?.ok === true) return { ok: true };
    const error = `Telegram rejected the message (HTTP ${response.status}). Check the bot token and chat permissions.`;
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(body?.parameters?.retry_after) || 60;
      return {
        ok: false,
        error: `Telegram is temporarily unavailable (HTTP ${response.status}).`,
        retryAfter: Math.max(60, retryAfter),
      };
    }
    return { ok: false, error };
  } catch {
    // Fetch errors can include the request URL, which contains the bot token.
    return {
      ok: false,
      error: "Telegram could not be reached.",
      retryAfter: 60,
    };
  }
}

function money(amount: number, currency: string) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: currency === "USD" ? 2 : 0, minimumFractionDigits: currency === "USD" ? 2 : 0 }).format(amount)} ${currency}`;
}

async function orderMessage(
  db: D1Database,
  businessId: string,
  orderId: string,
) {
  const order = await db
    .prepare(
      `SELECT o.order_number AS number, o.posting_date AS date,
    o.total_amount AS total, o.currency, o.note, b.name AS business, t.label AS tableLabel, g.name AS tableGroup
    FROM orders o JOIN businesses b ON b.id=o.business_id
    JOIN restaurant_tables t ON t.id=o.table_id AND t.business_id=o.business_id
    JOIN table_groups g ON g.id=t.group_id AND g.business_id=o.business_id
    WHERE o.id=? AND o.business_id=?`,
    )
    .bind(orderId, businessId)
    .first<{
      number: string;
      date: string;
      total: number;
      currency: string;
      note: string;
      business: string;
      tableLabel: string;
      tableGroup: string;
    }>();
  if (!order) return null;
  const { results } = await db
    .prepare(
      `SELECT product_name AS name, product_id AS productId, quantity,
    portion_name AS portion, modifiers, note, total_amount AS total FROM order_products
    WHERE order_id=? ORDER BY line_number`,
    )
    .bind(orderId)
    .all<{
      name: string | null;
      productId: string;
      quantity: number;
      portion: string;
      modifiers: string;
      note: string;
      total: number;
    }>();
  const header = `New eMenu order ${order.number}\n${order.business}\nTable: ${order.tableGroup} · ${order.tableLabel}\nDate: ${order.date}\nTotal: ${money(order.total, order.currency)}`;
  let message = header;
  if (order.note) message += `\nOrder note: ${order.note}`;
  for (const line of results) {
    const options = (
      JSON.parse(line.modifiers) as {
        labelKm?: string;
        labelEn?: string;
        labelZh?: string;
        prefix?: string;
      }[]
    )
      .map((option) =>
        [option.prefix, option.labelKm || option.labelEn || option.labelZh]
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean);
    const product = `${line.quantity} × ${line.name || line.productId}${line.portion ? ` (${line.portion})` : ""} · ${money(line.total, order.currency)}`;
    const detail = [
      product,
      options.length ? `  Options: ${options.join(", ")}` : "",
      line.note ? `  Note: ${line.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (message.length + detail.length + 2 > 3900)
      return `${message}\n\nSee the full item list in eMenu Orders.`;
    message += `\n\n${detail}`;
  }
  return message;
}

export async function deliverTelegramOrder(env: Env, orderId: string) {
  const delivery = await env.DB.prepare(
    `UPDATE telegram_order_deliveries
    SET attempts=attempts+1, next_attempt_at=unixepoch()+120, updated_at=unixepoch()
    WHERE order_id=? AND status='pending' AND next_attempt_at<=unixepoch()
      AND EXISTS (SELECT 1 FROM business_telegram_notifications c JOIN businesses b ON b.id=c.business_id
        WHERE c.business_id=telegram_order_deliveries.business_id AND c.enabled=1 AND b.is_active=1)
    RETURNING business_id AS businessId, attempts`,
  )
    .bind(orderId)
    .first<{ businessId: string; attempts: number }>();
  if (!delivery) return;
  const { businessId, attempts } = delivery;
  let result: TelegramResult = {
    ok: false,
    error: "Telegram delivery could not be completed.",
  };
  if (attempts <= maxAttempts) {
    const message = await orderMessage(env.DB, businessId, orderId);
    const settings = await readTelegramSettings(env.DB, businessId);
    if (settings?.enabled && message) {
      // Changing the destination deletes queued work before enabling the new chat.
      const stillQueued = await env.DB.prepare(
        "SELECT 1 FROM telegram_order_deliveries WHERE order_id=? AND attempts=? AND status='pending'",
      )
        .bind(orderId, attempts)
        .first();
      if (stillQueued)
        result = await sendTelegramMessage(env, businessId, settings, message);
    }
  }
  const retryIn =
    !result.ok && result.retryAfter && attempts < maxAttempts
      ? Math.max(result.retryAfter, attempts * 60)
      : 0;
  await env.DB.prepare(
    `UPDATE telegram_order_deliveries SET status=?, error=?,
    next_attempt_at=unixepoch()+?, updated_at=unixepoch() WHERE order_id=? AND attempts=?`,
  )
    .bind(
      result.ok ? "sent" : retryIn ? "pending" : "failed",
      result.ok ? null : result.error,
      retryIn,
      orderId,
      attempts,
    )
    .run();
}

export async function retryTelegramOrders(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT d.order_id AS orderId FROM telegram_order_deliveries d
    JOIN business_telegram_notifications c ON c.business_id=d.business_id AND c.enabled=1
    JOIN businesses b ON b.id=d.business_id AND b.is_active=1
    WHERE d.status='pending' AND d.next_attempt_at<=unixepoch() ORDER BY d.next_attempt_at LIMIT 10`,
  ).all<{ orderId: string }>();
  await Promise.allSettled(
    results.map(({ orderId }) => deliverTelegramOrder(env, orderId)),
  );
}
