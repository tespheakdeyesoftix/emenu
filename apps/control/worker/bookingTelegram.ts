import { sendTelegramMessage } from "./telegramOrders";
import type { Env } from "./index";

type BookingAlert = {
  businessId: string;
  businessName: string;
  branchName: string;
  timezone: string;
  arrivalDate: string;
  arrivalTime: string;
  pax: number;
  guestName: string;
  guestPhone: string;
  preference: string;
  preferenceText: string;
  note: string;
  encryptedToken: string;
};

const preferences: Record<string, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  "private-room": "Private room",
};
const maxAttempts = 3;

export async function deliverBookingAlert(env: Env, id: string) {
  const delivery = await env.DB.prepare(
    `UPDATE telegram_booking_deliveries
    SET attempts=attempts+1,next_attempt_at=unixepoch()+120,updated_at=unixepoch()
    WHERE booking_id=? AND status='pending' AND next_attempt_at<=unixepoch()
    RETURNING chat_id AS chatId,attempts`,
  )
    .bind(id)
    .first<{ chatId: string; attempts: number }>();
  if (!delivery) return;

  const booking =
    delivery.attempts <= maxAttempts
      ? await env.DB.prepare(
          `SELECT bk.business_id AS businessId,
    b.name AS businessName,br.name AS branchName,bk.timezone,bk.arrival_date AS arrivalDate,bk.arrival_time AS arrivalTime,
    bk.pax,bk.guest_name AS guestName,bk.guest_phone AS guestPhone,bk.preference,
    bk.preference_text AS preferenceText,bk.note,settings.encrypted_token AS encryptedToken
    FROM bookings bk JOIN businesses b ON b.id=bk.business_id
    JOIN branches br ON br.business_id=bk.business_id AND br.id=bk.branch_id
    JOIN business_booking_settings settings ON settings.business_id=bk.business_id
    JOIN branch_booking_settings branch ON branch.business_id=bk.business_id AND branch.branch_id=bk.branch_id
    WHERE bk.id=? AND b.is_active=1 AND settings.telegram_enabled=1 AND settings.encrypted_token IS NOT NULL
      AND branch.chat_id=?`,
        )
          .bind(id, delivery.chatId)
          .first<BookingAlert>()
      : null;

  let result: Awaited<ReturnType<typeof sendTelegramMessage>> = {
    ok: false,
    error:
      delivery.attempts > maxAttempts
        ? "Retry limit reached"
        : "Booking alert configuration changed",
  };
  if (booking) {
    const message = [
      `New eMenu booking request · ${id}`,
      `${booking.businessName} · ${booking.branchName}`,
      `Arrival: ${booking.arrivalDate} ${booking.arrivalTime} (${booking.timezone})`,
      `Guests: ${booking.pax}`,
      `Name: ${booking.guestName.replace(/\s+/g, " ")}`,
      `Phone: ${booking.guestPhone}`,
      booking.preference && `Preference: ${preferences[booking.preference]}`,
      booking.preferenceText && `Preference details: ${booking.preferenceText}`,
      booking.note && `Note: ${booking.note}`,
    ]
      .filter(Boolean)
      .join("\n");
    result = await sendTelegramMessage(
      env,
      booking.businessId,
      {
        enabled: 1,
        chatId: delivery.chatId,
        encryptedToken: booking.encryptedToken,
      },
      message,
    );
  }

  const retry =
    !result.ok && result.retryAfter && delivery.attempts < maxAttempts
      ? result.retryAfter
      : null;
  await env.DB.prepare(
    `UPDATE telegram_booking_deliveries SET status=?,error=?,
    next_attempt_at=unixepoch()+?,updated_at=unixepoch()
    WHERE booking_id=? AND status='pending' AND attempts=?`,
  )
    .bind(
      result.ok ? "sent" : retry ? "pending" : "failed",
      result.ok ? null : result.error,
      retry ?? 0,
      id,
      delivery.attempts,
    )
    .run();
}

export async function retryBookingAlerts(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT booking_id AS id FROM telegram_booking_deliveries
    WHERE status='pending' AND next_attempt_at<=unixepoch() ORDER BY next_attempt_at LIMIT 30`,
  ).all<{ id: string }>();
  for (const { id } of results) await deliverBookingAlert(env, id);
}
