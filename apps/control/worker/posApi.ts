import type { Env } from "./index";
import { getCatalog } from "./posApiCatalog";
import { readRegisterCustomerPhoto, registerCustomerDirectory } from "./posApiCustomers";
import {
  activeDeviceSession,
  allowsCashFloat,
  bodyOf,
  Command,
  conflict,
  digest,
  errorResponse,
  missing,
  pageOf,
  pagination,
  paymentTypes,
  PosError,
  posApiPath,
  privileged,
  profileColumns,
  profileView,
  recordId,
  requirePosPlan,
  respond,
  sql,
  string,
  type PosContext,
  type PosDependencies,
  type PosIdentity,
  type PosProfile,
  type ProfileConfig,
} from "./posApiCore";
import {
  accessLifetime,
  issuePosToken,
  listDevices,
  registerDevice,
  renewDeviceSession,
  revokeDevice,
} from "./posApiDevices";
import { readSales, saleAction, saveSale } from "./posApiSales";
import {
  listStaffUsernames,
  resolveStaffUsername,
  setStaffUsername,
  staffUsername,
} from "./posApiStaff";
import {
  importStoreOperation,
  listStoreRecoveries,
  manageStoreAuthority,
  recoverStoreOperation,
  storeAuthority,
} from "./posApiStore";
import {
  currentOperations,
  readOperations,
  reviewShift,
  writeDay,
  writeShift,
} from "./posApiShifts";
import { posPlanEnabled } from "./subscriptionPlans";

function unauthenticated(): never {
  throw new PosError(401, "INVALID_POS_SESSION", "Sign in to the POS API");
}

function methodNotAllowed() {
  return respond(
    { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    405,
  );
}

const managerOrGrant = `(? IN ('owner','manager') OR EXISTS (
  SELECT 1 FROM pos_profile_grants g WHERE g.profile_id=p.id AND g.business_id=p.business_id AND g.user_id=?
))`;

async function throttle(db: D1Database, request: Request, email: string) {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  const keys = await Promise.all([
    digest("address:" + address),
    digest("account:" + address + ":" + email),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 600);
  const rows = await db.batch<{ attempts: number }>(
    keys.map((key) =>
      sql(
        db,
        `INSERT INTO pos_login_limits
    (bucket,window_start,attempts) VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET
    attempts=CASE WHEN pos_login_limits.window_start=excluded.window_start THEN min(pos_login_limits.attempts+1,121) ELSE 1 END,
    window_start=excluded.window_start RETURNING attempts`,
        key,
        windowStart,
      ),
    ),
  );
  if (rows[0].results[0].attempts > 120 || rows[1].results[0].attempts > 20) {
    throw new PosError(
      429,
      "LOGIN_RATE_LIMIT",
      "Too many login attempts. Retry after the current ten-minute window.",
    );
  }
}

async function login(request: Request, env: Env, deps: PosDependencies) {
  const body = await bodyOf(request);
  const email = string(body.email, "email", 254).toLowerCase();
  const slug = string(body.business_slug, "business_slug", 100).toLowerCase();
  const proof = string(body.password_proof, "password_proof", 64).toLowerCase();
  const version = string(body.auth_version, "auth_version", 80);
  const username =
    body.username === undefined ? null : staffUsername(body.username);
  await throttle(env.DB, request, email);
  const account = await deps.verifyCredentials(email, proof, version, env);
  if (!account)
    throw new PosError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email, password, or business",
    );
  const membership = await sql(
    env.DB,
    `SELECT b.id, ${posPlanEnabled("b.id")} AS pos_enabled FROM businesses b
    JOIN memberships m ON m.business_id=b.id AND m.user_id=?
    WHERE b.is_active=1 AND (b.slug=? OR b.id=(SELECT business_id FROM business_slug_aliases WHERE slug=?))
      AND (? IS NULL OR (m.role<>'owner' AND m.pos_username=?))`,
    account.id, slug, slug, username, username,
  ).first<{ id: string; pos_enabled: number }>();
  if (membership) requirePosPlan(membership.pos_enabled);
  const { token, expiresAt } = issuePosToken(900);
  const result = membership && await sql(
    env.DB,
    `INSERT INTO pos_sessions
    (token_hash,business_id,user_id,credential_version,expires_at)
    SELECT ?,b.id,m.user_id,u.password_salt,? FROM businesses b
    JOIN memberships m ON m.business_id=b.id AND m.user_id=?
    JOIN users u ON u.id=m.user_id AND u.password_salt=?
    WHERE b.is_active=1 AND b.id=? AND ${posPlanEnabled("b.id")}
      AND (? IS NULL OR (m.role<>'owner' AND m.pos_username=?))
    RETURNING business_id,user_id`,
    await digest(token),
    expiresAt,
    account.id,
    account.passwordSalt,
    membership.id,
    username,
    username,
  ).first<{ business_id: string; user_id: string }>();
  if (!result)
    throw new PosError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email, password, or business",
    );
  return respond({
    token,
    expires_at: new Date(expiresAt * 1000).toISOString(),
    ...result,
  });
}

async function authenticate(request: Request, db: D1Database) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (possession_[0-9a-f]{64})$/i)?.[1];
  if (!token) unauthenticated();
  const identity = await sql(
    db,
    `SELECT s.business_id,b.name AS business_name,s.user_id,u.display_name,m.role,s.profile_id,
    b.timezone,b.currency,b.secondary_exchange_rate,b.menu_cache_version AS catalog_version,b.pricing_mode,
    b.default_price_list_id,s.credential_version,s.token_hash,sub.status AS subscriptionStatus,
    sub.current_period_end_at AS currentPeriodEndAt,
    COALESCE(plan.pos_enabled,1) AS pos_enabled
    FROM pos_sessions s JOIN memberships m ON m.business_id=s.business_id AND m.user_id=s.user_id
    JOIN users u ON u.id=m.user_id AND u.password_salt=s.credential_version
    JOIN businesses b ON b.id=m.business_id AND b.is_active=1
    LEFT JOIN business_subscriptions sub ON sub.business_id=b.id
    LEFT JOIN subscription_plans plan ON plan.id=sub.plan_id
    WHERE s.token_hash=? AND s.expires_at>unixepoch() AND ${activeDeviceSession}`,
    await digest(token),
  ).first<PosIdentity & { pos_enabled: number }>();
  if (!identity) unauthenticated();
  return identity;
}

async function startSession(
  request: Request,
  db: D1Database,
  identity: PosIdentity,
) {
  if (identity.profile_id)
    throw new PosError(
      403,
      "DISCOVERY_SESSION_REQUIRED",
      "Sign in to select a POS profile",
    );
  const body = await bodyOf(request);
  const profileId = recordId(body.profile_id, "profile_id");
  const { token, expiresAt } = issuePosToken(accessLifetime);
  const result = await sql(
    db,
    `INSERT INTO pos_sessions
    (token_hash,business_id,user_id,profile_id,credential_version,expires_at)
    SELECT ?,p.business_id,m.user_id,p.id,u.password_salt,? FROM pos_profiles p
    JOIN branches b ON b.id=p.branch_id AND b.is_active=1
    JOIN businesses business ON business.id=p.business_id AND business.is_active=1
    JOIN pos_sessions discovery ON discovery.business_id=p.business_id AND discovery.token_hash=?
      AND discovery.profile_id IS NULL AND discovery.expires_at>unixepoch()
    JOIN memberships m ON m.business_id=p.business_id AND m.user_id=discovery.user_id
    JOIN users u ON u.id=m.user_id AND u.password_salt=discovery.credential_version
    WHERE p.business_id=? AND p.id=? AND p.is_active=1
      AND ${posPlanEnabled("p.business_id")}
      AND (m.role IN ('owner','manager') OR EXISTS (
        SELECT 1 FROM pos_profile_grants g WHERE g.business_id=m.business_id AND g.profile_id=p.id AND g.user_id=m.user_id
      )) RETURNING profile_id`,
    await digest(token),
    expiresAt,
    identity.token_hash,
    identity.business_id,
    profileId,
  ).first<{ profile_id: string }>();
  if (!result) missing("Available POS profile");
  return respond(
    {
      token,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      profile_id: profileId,
    },
    201,
  );
}

async function activeProfile(db: D1Database, identity: PosIdentity) {
  if (!identity.profile_id)
    throw new PosError(
      403,
      "PROFILE_REQUIRED",
      "Start a session with a POS profile first",
    );
  const profile = await sql(
    db,
    `SELECT ${profileColumns} FROM pos_profiles p JOIN branches b ON b.id=p.branch_id
    WHERE p.business_id=? AND p.id=? AND p.is_active=1 AND b.is_active=1 AND ${managerOrGrant}`,
    identity.business_id,
    identity.profile_id,
    identity.role,
    identity.user_id,
  ).first<PosProfile>();
  if (!profile)
    throw new PosError(
      403,
      "PROFILE_ACCESS_REVOKED",
      "This POS profile is no longer available to this operator",
    );
  return profile;
}

async function tables(context: PosContext, url: URL) {
  if (context.config.table_mode === "disabled") {
    const { page, limit } = pagination(url);
    return respond({ tables: [], page, page_size: limit, has_more: false });
  }
  return respond(
    await pageOf(
      context.db,
      url,
      "tables",
      `SELECT t.id,t.code,t.label,t.group_id,g.name AS group_name,
    s.id AS open_sale_id,s.guest_cover,bk.arrival_at AS booking_arrival_at,bk.pax AS booking_pax,
    CASE WHEN s.id IS NOT NULL THEN 'occupied' WHEN bk.id IS NOT NULL THEN 'booked' ELSE 'available' END AS status
    FROM restaurant_tables t JOIN table_groups g ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
    LEFT JOIN sales s ON s.business_id=t.business_id AND s.profile_id=?1 AND s.table_id=t.id AND s.status='open'
    LEFT JOIN bookings bk ON bk.id=(
      SELECT reservation.id FROM bookings reservation
      WHERE reservation.business_id=t.business_id AND reservation.branch_id=t.branch_id
        AND reservation.table_id=t.id AND reservation.status='confirmed'
        AND reservation.arrival_at > strftime('%Y-%m-%dT%H:%M:%fZ',?5,'-2 hours')
        AND reservation.arrival_at <= strftime('%Y-%m-%dT%H:%M:%fZ',?5,'+30 minutes')
      ORDER BY reservation.arrival_at,reservation.id LIMIT 1
    )
    LEFT JOIN json_each(?4) selected ON selected.value=g.id
    WHERE t.business_id=?2 AND t.branch_id=?3 AND t.is_active=1 AND g.is_active=1
      AND (?4 IS NULL OR selected.key IS NOT NULL)
    ORDER BY selected.key,g.sort_order,g.name,g.id,t.sort_order,t.id`,
      [
        context.profile.id,
        context.identity.business_id,
        context.profile.branch_id,
        context.config.table_group_ids ? JSON.stringify(context.config.table_group_ids) : null,
        context.now,
      ],
    ),
  );
}

function posProfileView(profile: PosProfile) {
  const settings = profileView(profile);
  const { print_copies, tax_mode, tax_rate_bps, ...config } = settings.config;
  return {
    ...settings,
    config: {
      ...config,
      ...(!config.default_tax_rule && tax_mode !== "disabled" && tax_rate_bps > 0
        ? { legacy_tax: { tax_mode, tax_rate_bps } }
        : {}),
    },
  };
}

function registerConfig(profile: PosProfile): ProfileConfig {
  const active: ProfileConfig = JSON.parse(profile.config_json);
  if (active.catalog_mode !== "menu" || !profile.pending_config_json)
    return active;

  const pending: ProfileConfig = JSON.parse(profile.pending_config_json);
  if (pending.catalog_mode !== "menu") return active;

  // Add newly selected menus now. Keep existing menus available until any
  // open bills and shifts finish and the pending profile is promoted.
  const selectedIds = active.selected_ids && pending.selected_ids
    ? [...new Set([...active.selected_ids, ...pending.selected_ids])]
    : null;
  return { ...active, selected_ids: selectedIds };
}

async function registerDefaultMenu(
  { db, identity, profile, config }: PosContext,
) {
  const saved = config.default_menu_id ?? null;
  if (config.catalog_mode !== "menu" || !profile.pending_config_json)
    return saved;
  const pending: ProfileConfig = JSON.parse(profile.pending_config_json);
  if (pending.catalog_mode !== "menu") return saved;
  const menu = pending.default_menu_id;
  if (menu === null) return null;
  if (
    !menu || menu === saved ||
    (config.selected_ids && !config.selected_ids.includes(menu))
  )
    return saved;

  const available = await sql(
    db,
    "SELECT 1 FROM menus WHERE business_id=? AND id=? AND parent_id IS NULL AND is_active=1 AND deleted_in_admin=0",
    identity.business_id,
    menu,
  ).first();
  return available ? menu : saved;
}

export async function handlePosApi(
  request: Request,
  env: Env,
  deps: PosDependencies,
) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.slice(posApiPath.length);
    if (path === "/auth/login")
      return request.method === "POST"
        ? await login(request, env, deps)
        : methodNotAllowed();
    const db = env.DB;
    if (path === "/auth/device-session")
      return request.method === "POST"
        ? await renewDeviceSession(db, request)
        : methodNotAllowed();
    const identity = await authenticate(request, db);
    if (path === "/sessions/current") {
      if (request.method !== "DELETE") return methodNotAllowed();
      await sql(
        db,
        "DELETE FROM pos_sessions WHERE token_hash=?",
        identity.token_hash,
      ).run();
      return respond({ ok: true });
    }
    requirePosPlan(identity.pos_enabled);
    if (path === "/sessions")
      return request.method === "POST"
        ? await startSession(request, db, identity)
        : methodNotAllowed();
    if (path === "/profiles") {
      if (request.method !== "GET") return methodNotAllowed();
      if (identity.profile_id)
        throw new PosError(
          403,
          "DISCOVERY_SESSION_REQUIRED",
          "Sign in to list available POS profiles",
        );
      const page = await pageOf(
        db,
        url,
        "profiles",
        `SELECT ${profileColumns} FROM pos_profiles p
        JOIN branches b ON b.id=p.branch_id AND b.is_active=1
        WHERE p.business_id=? AND p.is_active=1 AND ${managerOrGrant} ORDER BY b.name,p.name,p.id`,
        [identity.business_id, identity.role, identity.user_id],
      );
      return respond({
        ...page,
        profiles: (page.profiles as PosProfile[]).map((profile) =>
          posProfileView(profile),
        ),
      });
    }

    const profile = await activeProfile(db, identity);
    const now = new Date();
    const context: PosContext = {
      db,
      identity,
      profile,
      config: registerConfig(profile),
      now: now.toISOString(),
      localDate: deps.localDate(now, identity.timezone),
    };
    const { readOnly } = deps.subscription(identity);
    const pendingCommand = path.match(/^\/commands\/([a-zA-Z0-9_-]{8,128})$/);
    if (pendingCommand && request.method === "GET") {
      const row = await sql(db, `SELECT response_json,response_status FROM pos_commands
        WHERE business_id=? AND profile_id=? AND actor_id=? AND idempotency_key=?`,
        identity.business_id, profile.id, identity.user_id, pendingCommand[1])
        .first<{ response_json: string; response_status: number }>();
      if (!row) missing("Command");
      return respond({ result: JSON.parse(row.response_json), status: row.response_status });
    }
    if (path === "/auth/resolve-username")
      return request.method === "POST"
        ? await resolveStaffUsername(context, request)
        : methodNotAllowed();
    if (path === "/staff")
      return request.method === "GET"
        ? await listStaffUsernames(context, url)
        : methodNotAllowed();
    const staff = path.match(/^\/staff\/([a-zA-Z0-9_-]{1,80})\/username$/);
    if (staff)
      return request.method === "PUT"
        ? await setStaffUsername(context, request, staff[1])
        : methodNotAllowed();
    if (path === "/store-authority")
      return ["GET", "POST", "DELETE"].includes(request.method)
        ? await manageStoreAuthority(context, request)
        : methodNotAllowed();
    if (path === "/store-operations")
      return request.method === "POST"
        ? await importStoreOperation(context, request, deps, readOnly)
        : methodNotAllowed();
    if (path === "/store-operations/recover")
      return request.method === "POST"
        ? await recoverStoreOperation(context, request, deps, readOnly)
        : methodNotAllowed();
    if (path === "/store-operations/recoveries")
      return request.method === "GET"
        ? await listStoreRecoveries(context, url)
        : methodNotAllowed();
    if (path === "/context") {
      if (request.method !== "GET") return methodNotAllowed();
      const settings = posProfileView(profile);
      const [current, accepted, authority, defaultMenu] = await Promise.all([
        currentOperations(context),
        paymentTypes(context),
        storeAuthority(context),
        registerDefaultMenu(context),
      ]);
      return respond({
        profile: {
          ...settings,
          config: {
            ...settings.config,
            selected_ids: context.config.selected_ids ?? null,
            default_menu_id: defaultMenu,
            payment_types: accepted.map((type) => ({
              id: type.id,
              payment_type: type.name,
              currency: type.currency,
              allow_cash_float: allowsCashFloat(type),
            })),
          },
        },
        operator: {
          id: identity.user_id,
          name: identity.display_name,
          role: identity.role,
        },
        business: {
          id: identity.business_id,
          name: identity.business_name,
          timezone: identity.timezone,
          currency: identity.currency,
          secondary_currency: identity.currency === "USD" ? "KHR" : "USD",
          secondary_exchange_rate: String(identity.secondary_exchange_rate),
        },
        payment_types: accepted,
        local_date: context.localDate,
        read_only: readOnly,
        store_authority_required: authority !== null,
        capabilities: {
          sale_context_guard: true,
          device_sessions: true,
          store_operations: true,
          store_recovery: true,
          reversal_context_guard: true,
          staff_usernames: true,
          cart_line_edits: true,
          bill_information: true,
          shift_management: true,
          customer_directory: true,
          customer_photo_upload: true,
        },
        ...current,
      });
    }
    if (path === "/devices") {
      if (request.method === "POST")
        return await registerDevice(context, request);
      if (request.method === "GET") return await listDevices(context, url);
      return methodNotAllowed();
    }
    const device = path.match(/^\/devices\/([a-zA-Z0-9_-]{1,80})$/);
    if (device)
      return request.method === "DELETE"
        ? await revokeDevice(context, device[1])
        : methodNotAllowed();
    if (path === "/catalog")
      return request.method === "GET"
        ? await getCatalog(env, deps, context, url)
        : methodNotAllowed();
    if (path === "/tables")
      return request.method === "GET"
        ? await tables(context, url)
        : methodNotAllowed();
    const customerPhoto = path.match(/^\/customers\/([a-zA-Z0-9_-]{1,80})\/photo$/);
    if (customerPhoto)
      return request.method === "GET"
        ? await readRegisterCustomerPhoto(context, customerPhoto[1])
        : methodNotAllowed();
    const customer = path.match(/^\/customers(?:\/([a-zA-Z0-9_-]{1,80}))?$/);
    if (customer || path === "/customer-groups")
      return await registerCustomerDirectory(
        request, url, context, customer ? "customers" : "customer-groups", customer?.[1], readOnly,
      );
    const match = path.match(
      /^\/(working-days|cashier-shifts|sales)(?:\/([a-zA-Z0-9_-]{1,80})(?:\/([a-z-]+))?)?$/,
    );
    if (!match) missing("Endpoint");
    const [, resource, id, action] = match;
    if (resource === "sales") {
      if (action && !["checkout", "cancel", "reverse"].includes(action))
        missing("Endpoint");
      if (request.method === "GET" && !action) {
        if (!id && url.searchParams.get("history") === "active" &&
            !context.config.cashier_shift_enabled && !context.config.working_day_enabled) {
          context.localDateStart = deps.startOfLocalDate(context.localDate, identity.timezone);
        }
        return await readSales(context, url, id);
      }
      if (
        (!id && request.method !== "POST") ||
        (id && request.method !== (action ? "POST" : "PATCH"))
      ) {
        return methodNotAllowed();
      }
    } else {
      const actions =
        resource === "working-days"
          ? ["close", "summary"]
          : ["close", "cash-floats", "reconciliation", "summary", "reopen"];
      if (action && !actions.includes(action)) missing("Endpoint");
      if (request.method === "GET" && action !== "close" && action !== "reopen")
        return await readOperations(context, url, resource, id, action);
      if (resource === "cashier-shifts" && id && action === "reconciliation" && request.method === "POST")
        return await reviewShift(context, id, await bodyOf(request));
      if (
        request.method !== "POST" ||
        (id && (!action || action === "reconciliation" || action === "summary"))
      )
        return methodNotAllowed();
    }
    const command = await Command.read(request, context);
    if (command instanceof Response) return command;
    try {
      if (await storeAuthority(context)) {
        conflict(
          "Use the designated store register for this branch",
          "STORE_REGISTER_REQUIRED",
        );
      }
      if (readOnly && action !== "close" && action !== "cancel") {
        throw new PosError(
          402,
          "SUBSCRIPTION_EXPIRED",
          "The subscription allows reads and closing existing activity",
        );
      }
      if (resource === "working-days")
        return await writeDay(context, command, id);
      if (resource === "cashier-shifts")
        return await writeShift(context, command, id, action);
      if (action) return await saleAction(context, command, id, action);
      return await saveSale(env, deps, context, command, id);
    } catch (error) {
      const replay = await command.replay();
      if (replay) return replay;
      if (id && action === "close" && String(error).includes("POS_STATE_CONFLICT")) {
        if (resource === "cashier-shifts") {
          const current = await sql(db, `SELECT activity_revision FROM cashier_shifts
            WHERE business_id=? AND profile_id=? AND id=? AND closed_at IS NULL`,
            identity.business_id, profile.id, id).first<number>("activity_revision");
          if (current != null && current !== command.body.activity_revision)
            conflict("Refresh the shift reconciliation", "RECONCILIATION_CHANGED");
        } else if (resource === "working-days") {
          const blocked = await sql(db, `SELECT 1 FROM working_days d
            WHERE d.business_id=? AND d.branch_id=? AND d.id=? AND d.closed_at IS NULL
              AND (EXISTS(SELECT 1 FROM cashier_shifts WHERE working_day_id=d.id AND closed_at IS NULL)
                OR EXISTS(SELECT 1 FROM sales WHERE working_day_id=d.id AND status='open'))`,
            identity.business_id, profile.branch_id, id).first();
          if (blocked) conflict("Close the working day's shifts and bills", "WORKING_DAY_HAS_ACTIVITY");
        }
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
