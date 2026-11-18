import {
  addBookingDays,
  bookingDateAt,
  bookingPreferences,
  bookingStatusActions,
  bookingStatuses,
  validBookingDate,
  type BookingBranch,
  type BookingDetail,
  type BookingLanguage,
  type BookingReceipt,
  type BookingStatus,
  type BookingSummary,
} from "../../../shared/booking";
import {
  bookingEnabled,
  bookingHash,
  bookingPolicyJoins,
  bookingSettingsColumns,
  parseBookingDates,
  type BookingRules,
} from "./bookingSettings";
import { deliverBookingAlert } from "./bookingTelegram";
import { deliverTelegramNotifications } from "./telegramNotifications";
import { scheduleBranchWebhooks } from "./webhookDelivery";
import { captureWebhook } from "./webhookEvents";
import type { Env } from "./index";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const error = (status: number, message: string, code?: string) =>
  json({ error: message, code }, status);
const unavailable = () =>
  error(
    404,
    "Booking is unavailable for this business or branch",
    "BOOKING_UNAVAILABLE",
  );
const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const bookingId = /^BK-[A-F0-9]{16}$/;

type BookingBusiness = BookingRules & {
  id: string;
  name: string;
  timezone: string;
  hoursJson: string;
  enabled: number;
  revision: number;
};
type BranchRules = BookingBranch & {
  active: number;
  enabled: number;
  blockedDatesJson: string;
  phone: string;
};
type BusinessHours = {
  day: number;
  enabled: boolean;
  open: string;
  close: string;
};

function parseHours(value: string): BusinessHours[] {
  try {
    const rows: unknown = JSON.parse(value);
    return Array.isArray(rows)
      ? rows.filter(
          (row) =>
            row &&
            Number.isInteger(row.day) &&
            row.day >= 0 &&
            row.day <= 6 &&
            row.enabled === true &&
            clockTime.test(row.open) &&
            clockTime.test(row.close),
        )
      : [];
  } catch {
    return [];
  }
}

function dayLimits(business: BookingBusiness, now: number) {
  const today = bookingDateAt(now, business.timezone);
  return { today, lastDate: addBookingDays(today, business.advanceDays) };
}

function arrivalSlots(
  date: string,
  business: BookingBusiness,
  blockedDates: string[],
  now: number,
) {
  const { today, lastDate } = dayLimits(business, now);
  if (
    !validBookingDate(date) ||
    date < today ||
    date > lastDate ||
    blockedDates.includes(date)
  )
    return [];
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  const weekday = new Date(dayStart).getUTCDay();
  const hours = parseHours(business.hoursJson);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  function localStamp(instant: number) {
    const fields = Object.fromEntries(
      formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
    );
    return Date.parse(
      `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:00Z`,
    );
  }
  // Sample both sides of local daylight transitions. Skip gaps and use the first occurrence in an overlap.
  const offsets = [
    ...new Set(
      [-1, 0, 1].map((day) => {
        const stamp = dayStart + day * 86_400_000;
        return localStamp(stamp) - stamp;
      }),
    ),
  ];
  const minutes = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const firstAllowed = now + business.noticeMinutes * 60_000;
  const slots = new Map<string, string>();
  for (const offset of [-1, 0]) {
    const schedule = hours.find(
      (row) => row.day === (weekday + offset + 7) % 7,
    );
    if (!schedule) continue;
    const open = minutes(schedule.open);
    const close = minutes(schedule.close);
    if (open === close) continue;
    const end = close + (close < open ? 1440 : 0);
    for (let minute = open; minute < end; minute += business.slotMinutes) {
      const localMinute = minute + offset * 1440;
      if (localMinute < 0 || localMinute >= 1440) continue;
      const wall = dayStart + localMinute * 60_000;
      const arrival = offsets
        .map((zoneOffset) => wall - zoneOffset)
        .filter((instant) => localStamp(instant) === wall)
        .sort((a, b) => a - b)[0];
      if (arrival === undefined || arrival < firstAllowed || arrival <= now)
        continue;
      slots.set(
        new Date(wall).toISOString().slice(11, 16),
        new Date(arrival).toISOString(),
      );
    }
  }
  return [...slots]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, arrivalAt]) => ({ time, arrivalAt }));
}

function readBusiness(db: D1Database, slug: string) {
  return db
    .prepare(
      `SELECT b.id,b.name,b.timezone,b.business_hours_json AS hoursJson,
    (${bookingEnabled}) AS enabled,settings.revision,${bookingSettingsColumns}
    FROM businesses b ${bookingPolicyJoins} WHERE b.slug=? AND b.is_active=1`,
    )
    .bind(slug)
    .first<BookingBusiness>();
}

function readBranch(db: D1Database, businessId: string, slug: string) {
  return db
    .prepare(
      `SELECT br.id,br.slug,br.name,br.is_active AS active,
    CASE WHEN b.show_header_phones=1 THEN CASE WHEN br.is_default=1 THEN b.phone ELSE br.phone END ELSE '' END AS phone,
    COALESCE(branch.enabled,0) AS enabled,COALESCE(branch.blocked_dates_json,'[]') AS blockedDatesJson
    FROM branches br JOIN businesses b ON b.id=br.business_id
    LEFT JOIN branch_booking_settings branch ON branch.business_id=br.business_id AND branch.branch_id=br.id
    WHERE br.business_id=? AND br.slug=?`,
    )
    .bind(businessId, slug)
    .first<BranchRules>();
}

const receiptColumns = `bk.id AS reference, br.name AS branchName,bk.arrival_date AS arrivalDate,
  bk.arrival_time AS arrivalTime,bk.pax`;
const summaryColumns = `${receiptColumns},bk.id,bk.branch_id AS branchId,bk.guest_name AS guestName,bk.status`;
const bookingsJoin =
  "FROM bookings bk JOIN branches br ON br.business_id=bk.business_id AND br.id=bk.branch_id";

async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return null;
  const value: unknown = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseSubmission(body: Record<string, unknown> | null) {
  if (!body) return null;
  const {
    submissionId,
    arrivalDate,
    arrivalTime,
    pax,
    termsAccepted,
    termsLanguage,
    termsVersion,
  } = body;
  const readText = (key: string, limit: number, required = false) => {
    const value = body[key] ?? "";
    return typeof value === "string" &&
      value.length <= limit &&
      (!required || value.trim())
      ? value.trim()
      : null;
  };
  const guestName = readText("guestName", 100, true);
  const guestPhone = readText("guestPhone", 32, true)?.replace(
    /[០-៩]/g,
    (digit) => String(digit.charCodeAt(0) - 0x17e0),
  );
  const preference = readText("preference", 24);
  const preferenceText = readText("preferenceText", 200);
  const note = readText("note", 500);
  if (
    typeof submissionId !== "string" ||
    !uuid.test(submissionId) ||
    typeof arrivalDate !== "string" ||
    !validBookingDate(arrivalDate) ||
    typeof arrivalTime !== "string" ||
    !clockTime.test(arrivalTime) ||
    typeof pax !== "number" ||
    !Number.isInteger(pax) ||
    pax < 1 ||
    pax > 1000 ||
    !guestName ||
    !guestPhone ||
    !/^\+?[\d ()-]+$/.test(guestPhone) ||
    !/^\d{6,20}$/.test(guestPhone.replace(/\D/g, "")) ||
    preference === null ||
    (preference !== "" &&
      !bookingPreferences.some((option) => option === preference)) ||
    preferenceText === null ||
    note === null ||
    termsAccepted !== true ||
    (termsLanguage !== "km" && termsLanguage !== "en") ||
    typeof termsVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(termsVersion)
  )
    return null;
  return {
    submissionId: submissionId.toLowerCase(),
    arrivalDate,
    arrivalTime,
    pax,
    guestName,
    guestPhone,
    preference,
    preferenceText,
    note,
    termsLanguage,
    termsVersion,
  };
}

export async function publicBookings(
  request: Request,
  url: URL,
  env: Env,
  slug: string,
  execution: ExecutionContext,
) {
  if (request.method !== "GET" && request.method !== "POST")
    return error(405, "Method not allowed");
  const branches = url.searchParams.getAll("branch");
  if (
    branches.length > 1 ||
    (branches.length === 1 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branches[0]))
  )
    return unavailable();
  const business = await readBusiness(env.DB, slug);
  if (!business) return unavailable();
  const ready = Boolean(business.enabled && business.termsVersion);
  if (!branches.length) {
    if (request.method === "POST")
      return error(400, "Select a branch", "BOOKING_BRANCH_REQUIRED");
    if (!ready) return unavailable();
    const { results } = await env.DB.prepare(
      `SELECT br.id,br.slug,br.name
      FROM branches br JOIN branch_booking_settings branch ON branch.business_id=br.business_id AND branch.branch_id=br.id
      WHERE br.business_id=? AND br.is_active=1 AND branch.enabled=1 ORDER BY br.is_default DESC,br.name,br.id`,
    )
      .bind(business.id)
      .all<BookingBranch>();
    return results.length
      ? json({ businessName: business.name, branches: results })
      : unavailable();
  }
  const branch = await readBranch(env.DB, business.id, branches[0]);
  if (!branch) return unavailable();
  const now = Date.now();
  const blockedDates = parseBookingDates(branch.blockedDatesJson);
  if (request.method === "GET") {
    if (!ready || !branch.active || !branch.enabled) return unavailable();
    const date = url.searchParams.get("date");
    if (date !== null && !validBookingDate(date))
      return error(400, "Select a valid arrival date", "BOOKING_INVALID_DATE");
    return json({
      businessName: business.name,
      branch: {
        id: branch.id,
        slug: branch.slug,
        name: branch.name,
        phone: branch.phone,
      },
      timezone: business.timezone,
      ...dayLimits(business, now),
      businessHours: parseHours(business.hoursJson),
      blockedDates,
      minPax: business.minPax,
      maxPax: business.maxPax,
      slotMinutes: business.slotMinutes,
      noticeMinutes: business.noticeMinutes,
      advanceDays: business.advanceDays,
      preferences: bookingPreferences,
      terms: {
        km: business.termsKm,
        en: business.termsEn,
        version: business.termsVersion,
      },
      slots: date
        ? arrivalSlots(date, business, blockedDates, now).map(
            ({ time }) => time,
          )
        : [],
    });
  }

  const submission = parseSubmission(await readBody(request));
  if (!submission)
    return error(
      400,
      "Enter valid booking details and accept the terms",
      "BOOKING_INVALID_DETAILS",
    );
  const requestHash = await bookingHash([branch.id, submission]);
  const existing = async () =>
    env.DB.prepare(
      `SELECT ${receiptColumns},bk.request_hash AS requestHash
    ${bookingsJoin} WHERE bk.business_id=? AND bk.submission_id=?`,
    )
      .bind(business.id, submission.submissionId)
      .first<BookingReceipt & { requestHash: string }>();
  const replay = ({
    requestHash: previousHash,
    ...receipt
  }: BookingReceipt & { requestHash: string }) =>
    previousHash === requestHash
      ? json(receipt)
      : error(
          409,
          "This submission ID was already used",
          "BOOKING_REPLAY_CONFLICT",
        );
  const saved = await existing();
  if (saved) return replay(saved);
  if (!ready || !branch.active || !branch.enabled) return unavailable();
  if (submission.termsVersion !== business.termsVersion)
    return error(
      409,
      "The booking terms have changed",
      "BOOKING_TERMS_CHANGED",
    );
  if (submission.pax < business.minPax || submission.pax > business.maxPax)
    return error(
      400,
      "The party size is outside the allowed range",
      "BOOKING_INVALID_PARTY",
    );
  const slot = arrivalSlots(
    submission.arrivalDate,
    business,
    blockedDates,
    Date.now(),
  ).find(({ time }) => time === submission.arrivalTime);
  if (!slot)
    return error(
      409,
      "That arrival slot is unavailable",
      "BOOKING_SLOT_UNAVAILABLE",
    );

  const reference = `BK-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const insert = env.DB.prepare(
    `INSERT INTO bookings
    (id,business_id,branch_id,submission_id,request_hash,arrival_date,arrival_time,arrival_at,timezone,pax,
      guest_name,guest_phone,preference,preference_text,note,terms_language,terms_version,terms_text)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    WHERE EXISTS (SELECT 1 FROM businesses b ${bookingPolicyJoins}
      JOIN branches br ON br.business_id=b.id AND br.id=? AND br.is_active=1
      JOIN branch_booking_settings branch ON branch.business_id=b.id AND branch.branch_id=br.id AND branch.enabled=1
      WHERE b.id=? AND (${bookingEnabled}) AND settings.revision=? AND b.timezone=? AND b.business_hours_json=?)
    ON CONFLICT(business_id,submission_id) DO NOTHING RETURNING id`,
  )
    .bind(
      reference,
      business.id,
      branch.id,
      submission.submissionId,
      requestHash,
      submission.arrivalDate,
      submission.arrivalTime,
      slot.arrivalAt,
      business.timezone,
      submission.pax,
      submission.guestName,
      submission.guestPhone,
      submission.preference,
      submission.preferenceText,
      submission.note,
      submission.termsLanguage,
      submission.termsVersion,
      submission.termsLanguage === "km" ? business.termsKm : business.termsEn,
      branch.id,
      business.id,
      business.revision,
      business.timezone,
      business.hoursJson,
    );
  const [insertedBooking] = await env.DB.batch<{ id: string }>([
    insert,
    captureWebhook(env.DB, "bookings", "inserted", "r.business_id=? AND r.id=?", [business.id, reference]),
  ]);
  const inserted = insertedBooking.results[0];
  if (!inserted) {
    const concurrent = await existing();
    return concurrent
      ? replay(concurrent)
      : error(409, "Booking settings have changed", "BOOKING_RULES_CHANGED");
  }
  execution.waitUntil(deliverBookingAlert(env, reference));
  scheduleBranchWebhooks(env, execution, business.id);
  execution.waitUntil(deliverTelegramNotifications(env, "Booking", reference).catch(() => {
    console.error("custom_telegram_booking_delivery_failed", { reference });
  }));
  return json(
    {
      reference,
      branchName: branch.name,
      arrivalDate: submission.arrivalDate,
      arrivalTime: submission.arrivalTime,
      pax: submission.pax,
    } satisfies BookingReceipt,
    201,
  );
}

async function assignBookingTable(
  db: D1Database,
  businessId: string,
  id: string,
  body: Record<string, unknown> | null,
) {
  const tableId = body?.tableId;
  const expected = body?.expectedTableId;
  const valid = (value: unknown) =>
    value === null || (typeof value === "string" && value.length > 0 && value.length <= 250);
  if (!valid(tableId) || !valid(expected)) return error(400, "Invalid booking table");
  const assigned = await db.prepare(
    `UPDATE bookings AS bk SET table_id=?1,updated_at=CURRENT_TIMESTAMP
    WHERE bk.business_id=?2 AND bk.id=?3 AND bk.status='confirmed' AND bk.table_id IS ?4
      AND EXISTS (
        SELECT 1 FROM businesses b ${bookingPolicyJoins} WHERE b.id=bk.business_id AND (${bookingEnabled})
      )
      AND (?1 IS NULL OR (
        EXISTS (
          SELECT 1 FROM restaurant_tables t JOIN table_groups g
            ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
          WHERE t.id=?1 AND t.business_id=bk.business_id AND t.branch_id=bk.branch_id
            AND t.is_active=1 AND g.is_active=1
        )
        AND NOT EXISTS (
          SELECT 1 FROM bookings other
          WHERE other.business_id=bk.business_id AND other.branch_id=bk.branch_id
            AND other.table_id=?1 AND other.id<>bk.id AND other.status='confirmed'
            AND other.arrival_at > strftime('%Y-%m-%dT%H:%M:%fZ',bk.arrival_at,'-2 hours')
            AND other.arrival_at < strftime('%Y-%m-%dT%H:%M:%fZ',bk.arrival_at,'+2 hours')
        )
      ))
    RETURNING table_id AS tableId`,
  ).bind(tableId, businessId, id, expected).first();
  return assigned ? json(assigned) : error(409, "The table is unavailable or the booking changed");
}

export async function adminBookings(
  request: Request,
  url: URL,
  env: Env,
  path: string,
  businessId: string,
  access: { visible: boolean; canManage: boolean },
  execution: ExecutionContext,
) {
  if (!access.visible) return error(403, "Booking access is required");
  if (path === "/api/admin/bookings" && request.method === "GET") {
    const from = url.searchParams.get("from"),
      to = url.searchParams.get("to"),
      branchId = url.searchParams.get("branchId");
    const page = Number(url.searchParams.get("page") ?? 1);
    if (
      (from !== null && !validBookingDate(from)) ||
      (to !== null && !validBookingDate(to)) ||
      (from && to && from > to) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    )
      return error(400, "Enter a valid booking date range and page");
    const filters = ["bk.business_id=?"];
    const bindings = [businessId];
    if (from) {
      filters.push("bk.arrival_date>=?");
      bindings.push(from);
    }
    if (to) {
      filters.push("bk.arrival_date<=?");
      bindings.push(to);
    }
    if (branchId) {
      filters.push("bk.branch_id=?");
      bindings.push(branchId);
    }
    const limit = 100;
    const [bookings, branches, business] = await Promise.all([
      env.DB.prepare(
        `SELECT ${summaryColumns} ${bookingsJoin} WHERE ${filters.join(" AND ")}
        ORDER BY bk.arrival_date,bk.arrival_time,bk.id LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, limit + 1, (page - 1) * limit)
        .all<BookingSummary>(),
      env.DB.prepare(
        "SELECT id,name,slug FROM branches WHERE business_id=? ORDER BY name,id",
      )
        .bind(businessId)
        .all<BookingBranch>(),
      env.DB.prepare("SELECT timezone FROM businesses WHERE id=?")
        .bind(businessId)
        .first<{ timezone: string }>(),
    ]);
    return json({
      bookings: bookings.results.slice(0, limit),
      branches: branches.results,
      hasMore: bookings.results.length > limit,
      canManage: access.canManage,
      timezone: business?.timezone || "UTC",
    });
  }
  const match = /^\/api\/admin\/bookings\/([^/]+)(\/status|\/table)?$/.exec(path);
  if (!match || !bookingId.test(match[1]))
    return error(404, "Booking not found");
  const [, id, action] = match;
  if (request.method === "GET" && !action) {
    const booking = await env.DB.prepare(
      `SELECT ${summaryColumns},bk.guest_phone AS guestPhone,bk.preference,
      bk.preference_text AS preferenceText,bk.note,bk.timezone,bk.terms_language AS termsLanguage,bk.terms_version AS termsVersion,
      bk.terms_text AS termsText,bk.terms_accepted_at AS termsAcceptedAt,bk.created_at AS createdAt,
      bk.table_id AS tableId,rt.label AS tableLabel
      ${bookingsJoin}
      LEFT JOIN restaurant_tables rt ON rt.id=bk.table_id AND rt.business_id=bk.business_id AND rt.branch_id=bk.branch_id
      WHERE bk.business_id=? AND bk.id=?`,
    )
      .bind(businessId, id)
      .first<BookingDetail>();
    if (!booking) return error(404, "Booking not found");
    const tableOptions = access.canManage && booking.status === "confirmed"
      ? (await env.DB.prepare(
          `SELECT t.id,t.label,g.name AS groupName
          FROM restaurant_tables t JOIN table_groups g
            ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
          WHERE t.business_id=? AND t.branch_id=? AND t.is_active=1 AND g.is_active=1
          ORDER BY g.sort_order,g.name,t.sort_order,t.id`,
        ).bind(businessId, booking.branchId).all()).results
      : [];
    return json({ booking, tableOptions, canManage: access.canManage });
  }
  if (request.method !== "PATCH" || !action)
    return error(405, "Method not allowed");
  if (!access.canManage)
    return error(403, "Booking changes are unavailable");
  const body = await readBody(request);
  if (action === "/table") return assignBookingTable(env.DB, businessId, id, body);
  const current = bookingStatuses.find(
    (status) => status === body?.expectedStatus,
  );
  const next = bookingStatuses.find((status) => status === body?.status);
  if (!current || !next || !bookingStatusActions(current).includes(next))
    return error(400, "Invalid booking status change");
  const transition = `r.business_id=?2 AND r.id=?3 AND r.status=?4 AND EXISTS (
    SELECT 1 FROM businesses b ${bookingPolicyJoins} WHERE b.id=r.business_id AND (${bookingEnabled})
  )`;
  const bindings = [next, businessId, id, current];
  const [, updated] = await env.DB.batch<{ status: BookingStatus }>([
    captureWebhook(env.DB, "bookings", "updated", transition, bindings, "?1"),
    env.DB.prepare(`UPDATE bookings AS r SET status=?1,updated_at=CURRENT_TIMESTAMP
      WHERE ${transition} RETURNING status`).bind(...bindings),
  ]);
  const changed = updated.results[0];
  if (changed) {
    scheduleBranchWebhooks(env, execution, businessId);
    return json(changed);
  }
  const exists = await env.DB.prepare(
    "SELECT 1 FROM bookings WHERE business_id=? AND id=?",
  )
    .bind(businessId, id)
    .first();
  return exists
    ? error(409, "Booking or settings changed. Reload the booking.")
    : error(404, "Booking not found");
}
