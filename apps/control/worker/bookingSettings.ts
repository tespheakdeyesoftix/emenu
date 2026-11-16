import {
  bookingDefaults,
  validBookingDate,
  type BookingBranch,
} from "../../../shared/booking";
import type { Env } from "./index";

export const bookingPolicyJoins = `
  LEFT JOIN business_booking_settings settings ON settings.business_id=b.id
  LEFT JOIN business_subscriptions subscription ON subscription.business_id=b.id
  LEFT JOIN subscription_plans plan ON plan.id=subscription.plan_id`;

const planIncludesBooking = `EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(plan.features_json) THEN plan.features_json ELSE '[]' END)
  WHERE value='bookings'
)`;

export const bookingEnabled = `b.is_active=1 AND COALESCE(settings.enabled,0)=1
  AND ${planIncludesBooking} AND subscription.status NOT IN ('past_due','canceled')
  AND (subscription.current_period_end_at IS NULL OR julianday(subscription.current_period_end_at)>julianday('now'))`;

export const bookingSettingsColumns = `settings.slot_minutes AS slotMinutes, settings.notice_minutes AS noticeMinutes,
  settings.advance_days AS advanceDays, settings.min_pax AS minPax, settings.max_pax AS maxPax,
  settings.terms_km AS termsKm, settings.terms_en AS termsEn, settings.terms_version AS termsVersion`;

export type BookingRules = typeof bookingDefaults & {
  termsKm: string;
  termsEn: string;
  termsVersion: string;
};

const success = (data: unknown) => ({ ok: true as const, data });
const failure = (status: number, error: string) => ({
  ok: false as const,
  status,
  error,
});

export function parseBookingDates(json: string | null) {
  try {
    const dates: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(dates)
      ? dates.filter(
          (date): date is string =>
            typeof date === "string" && validBookingDate(date),
        )
      : [];
  } catch {
    return [];
  }
}

export async function bookingWorkspaceAccess(
  db: D1Database,
  auth: { businessId: string; role: string; canViewBookings: number },
) {
  const manager = auth.role === "owner" || auth.role === "manager";
  if (!manager && auth.canViewBookings !== 1)
    return { visible: false, canManage: false };
  const row = await db
    .prepare(
      `SELECT (${bookingEnabled}) AS enabled,
    EXISTS (SELECT 1 FROM bookings WHERE business_id=b.id) AS hasBookings
    FROM businesses b ${bookingPolicyJoins} WHERE b.id=?`,
    )
    .bind(auth.businessId)
    .first<{ enabled: number; hasBookings: number }>();
  return {
    visible: Boolean(row?.enabled || row?.hasBookings),
    canManage: Boolean(manager && row?.enabled),
  };
}

async function readBookingFeature(db: D1Database, businessId: string) {
  const feature = await db
    .prepare(
      `SELECT COALESCE(settings.enabled,0) AS enabled, ${planIncludesBooking} AS planIncluded,
      plan.name AS planName, (${bookingEnabled}) AS effective
      FROM businesses b ${bookingPolicyJoins} WHERE b.id=?`,
    )
    .bind(businessId)
    .first<{
      enabled: number;
      planIncluded: number;
      planName: string | null;
      effective: number | null;
    }>();
  return {
    enabled: Boolean(feature?.enabled),
    planIncluded: Boolean(feature?.planIncluded),
    planName: feature?.planName ?? null,
    effective: Boolean(feature?.effective),
  };
}

async function featureSummary(db: D1Database, businessId: string) {
  const [{ enabled, planIncluded, effective }, staff] = await Promise.all([
    readBookingFeature(db, businessId),
    db
      .prepare(
        `SELECT u.id AS userId,u.display_name AS name,u.email,m.can_view_bookings AS canView
      FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.business_id=? AND m.role NOT IN ('owner','manager')
      ORDER BY u.display_name,u.id`,
      )
      .bind(businessId)
      .all<{ userId: string; name: string; email: string; canView: number }>(),
  ]);
  return {
    enabled,
    planIncluded,
    effective,
    staff: staff.results.map((member) => ({
      ...member,
      canView: Boolean(member.canView),
    })),
  };
}

type SettingsBranch = BookingBranch & {
  active: number;
  enabled: number;
  blockedDatesJson: string;
};

async function settingsSummary(db: D1Database, businessId: string) {
  const [rules, branches, feature] = await Promise.all([
    db
      .prepare(
        `SELECT ${bookingSettingsColumns}
      FROM business_booking_settings settings WHERE business_id=?`,
      )
      .bind(businessId)
      .first<BookingRules>(),
    db
      .prepare(
        `SELECT br.id,br.slug,br.name,br.is_active AS active,COALESCE(bs.enabled,0) AS enabled,
      COALESCE(bs.blocked_dates_json,'[]') AS blockedDatesJson
      FROM branches br LEFT JOIN branch_booking_settings bs ON bs.business_id=br.business_id AND bs.branch_id=br.id
      WHERE br.business_id=? ORDER BY br.is_default DESC,br.name,br.id`,
      )
      .bind(businessId)
      .all<SettingsBranch>(),
    readBookingFeature(db, businessId),
  ]);
  return {
    ...bookingDefaults,
    termsKm: "",
    termsEn: "",
    termsVersion: "",
    ...rules,
    publication: {
      ...feature,
      termsPublished: Boolean(rules?.termsVersion),
    },
    branches: branches.results.map(
      ({ active, enabled, blockedDatesJson, ...branch }) => ({
        ...branch,
        active: Boolean(active),
        enabled: Boolean(enabled),
        blockedDates: parseBookingDates(blockedDatesJson),
      }),
    ),
  };
}

function validInteger(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export async function bookingHash(value: unknown) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function manageBookingSettings(
  env: Env,
  businessId: string,
  action: "feature" | "settings",
  method: "GET" | "PUT",
  input: Record<string, unknown>,
  audit: (event: string) => D1PreparedStatement,
) {
  const db = env.DB;
  const business = await db
    .prepare("SELECT 1 FROM businesses WHERE id=?")
    .bind(businessId)
    .first();
  if (!business) return failure(404, "Business not found");
  if (action === "feature") {
    if (method === "GET") return success(await featureSummary(db, businessId));
    if (typeof input.enabled === "boolean" && Object.keys(input).length === 1) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO business_booking_settings (business_id,enabled,min_pax,max_pax) VALUES (?,?,?,?)
          ON CONFLICT(business_id) DO UPDATE SET enabled=excluded.enabled,revision=revision+1`,
          )
          .bind(
            businessId,
            Number(input.enabled),
            bookingDefaults.minPax,
            bookingDefaults.maxPax,
          ),
        audit("booking.feature_updated"),
      ]);
    } else if (
      typeof input.userId === "string" &&
      typeof input.canView === "boolean" &&
      Object.keys(input).length === 2
    ) {
      const membership = await db
        .prepare(
          `SELECT role FROM memberships WHERE business_id=? AND user_id=?
        AND role NOT IN ('owner','manager')`,
        )
        .bind(businessId, input.userId)
        .first();
      if (!membership) return failure(404, "Staff membership not found");
      await db.batch([
        db
          .prepare(
            `UPDATE memberships SET can_view_bookings=? WHERE business_id=? AND user_id=?
          AND role NOT IN ('owner','manager')`,
          )
          .bind(Number(input.canView), businessId, input.userId),
        audit("booking.staff_access_updated"),
      ]);
    } else
      return failure(
        400,
        "Provide the business switch or a staff Booking grant",
      );
    return success(await featureSummary(db, businessId));
  }

  if (method === "GET") return success(await settingsSummary(db, businessId));
  const { slotMinutes, noticeMinutes, advanceDays, minPax, maxPax } = input;
  if (
    !validInteger(slotMinutes, 5, 240) ||
    !validInteger(noticeMinutes, 0, 525600) ||
    !validInteger(advanceDays, 0, 365) ||
    !validInteger(minPax, 1, 1000) ||
    !validInteger(maxPax, minPax, 1000)
  )
    return failure(
      400,
      "Enter valid slot, booking window, and party size limits",
    );
  if (
    typeof input.termsKm !== "string" ||
    typeof input.termsEn !== "string" ||
    input.termsKm.length > 10000 ||
    input.termsEn.length > 10000 ||
    !Array.isArray(input.branches)
  )
    return failure(400, "Enter valid booking terms and branch settings");
  const termsKm = input.termsKm.trim(),
    termsEn = input.termsEn.trim();
  const termsVersion =
    termsKm && termsEn ? await bookingHash([termsKm, termsEn]) : "";
  const branches = await db
    .prepare("SELECT id FROM branches WHERE business_id=?")
    .bind(businessId)
    .all<{ id: string }>();
  const allowed = new Set(branches.results.map((branch) => branch.id));
  const updates: D1PreparedStatement[] = [];
  for (const branch of input.branches) {
    if (
      !branch ||
      typeof branch !== "object" ||
      typeof branch.id !== "string" ||
      !allowed.delete(branch.id) ||
      typeof branch.enabled !== "boolean" ||
      !Array.isArray(branch.blockedDates) ||
      branch.blockedDates.length > 366 ||
      !branch.blockedDates.every(
        (date: unknown) => typeof date === "string" && validBookingDate(date),
      )
    )
      return failure(
        400,
        "Enter valid, distinct branches and blocked dates for this business",
      );
    updates.push(
      db
        .prepare(
          `INSERT INTO branch_booking_settings (business_id,branch_id,enabled,blocked_dates_json)
      VALUES (?,?,?,?) ON CONFLICT(business_id,branch_id) DO UPDATE SET enabled=excluded.enabled,
      blocked_dates_json=excluded.blocked_dates_json`,
        )
        .bind(
          businessId,
          branch.id,
          Number(branch.enabled),
          JSON.stringify([...new Set(branch.blockedDates)].sort()),
        ),
    );
  }
  await db.batch([
    db
      .prepare(
        `INSERT INTO business_booking_settings
      (business_id,slot_minutes,notice_minutes,advance_days,min_pax,max_pax,terms_km,terms_en,terms_version)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(business_id) DO UPDATE SET slot_minutes=excluded.slot_minutes,notice_minutes=excluded.notice_minutes,
      advance_days=excluded.advance_days,min_pax=excluded.min_pax,max_pax=excluded.max_pax,
      terms_km=excluded.terms_km,terms_en=excluded.terms_en,terms_version=excluded.terms_version,revision=revision+1`,
      )
      .bind(
        businessId,
        slotMinutes,
        noticeMinutes,
        advanceDays,
        minPax,
        maxPax,
        termsKm,
        termsEn,
        termsVersion,
      ),
    ...updates,
    audit("booking.settings_updated"),
  ]);
  return success(await settingsSummary(db, businessId));
}
