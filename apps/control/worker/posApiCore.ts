import { emptyPosReceiptDefaults } from "../../../shared/posReceipts";
import type { Env } from "./index";
import { planLimitError, posPlanEnabled } from "./subscriptionPlans";
import { posTableStatusColors, type PaymentKind, type PaymentTypeGroup, type PosCurrency, type ProfileConfig, type ProfileConfigView } from "../../../shared/posProfile";

export type { PaymentKind, PosCurrency, ProfileConfig };

export const posApiPath = "/api/integrations/pos/v1";
export const posAdminPath = "/api/admin/pos";
export const isPosApiPath = (path: string) =>
  path === posApiPath || path.startsWith(posApiPath + "/");
export const isPosAdminPath = (path: string) =>
  path === posAdminPath || path.startsWith(posAdminPath + "/");
export type PaymentType = {
  id: string;
  name: string;
  kind: PaymentKind;
  payment_type_group?: PaymentTypeGroup | null;
  currency: PosCurrency;
  allow_cash_float?: boolean;
};

export function allowsCashFloat(type: PaymentType) {
  return type.allow_cash_float ?? (type.kind === "cash");
}

export type PosIdentity = {
  business_id: string;
  business_name: string;
  user_id: string;
  display_name: string;
  role: string;
  profile_id: string | null;
  timezone: string;
  currency: PosCurrency;
  secondary_exchange_rate: number;
  catalog_version: number;
  pricing_mode: string;
  default_price_list_id: string | null;
  credential_version: string;
  token_hash: string;
  subscriptionStatus: string | null;
  currentPeriodEndAt: string | null;
};
export type PosProfile = {
  id: string;
  branch_id: string;
  branch_name: string;
  name: string;
  is_active: number;
  version: number;
  config_json: string;
  pending_config_json: string | null;
};
export type PosContext = {
  db: D1Database;
  identity: PosIdentity;
  profile: PosProfile;
  config: ProfileConfig;
  now: string;
  localDate: string;
  localDateStart?: string | null;
  storeImport?: {
    epoch: string;
    sequence: number;
    resourceId: string;
    shiftPaymentTypes?: PaymentType[];
    baseCurrency?: PosCurrency;
    exchangeRate?: string;
    recovery?: { approvedBy: string; approvedAt: string; reason: string };
  };
};
export type PosDependencies = {
  verifyCredentials: (
    email: string,
    proof: string,
    version: string,
    env: Env,
  ) => Promise<{ id: string; passwordSalt: string } | null>;
  localDate: (date: Date, timezone: string) => string;
  startOfLocalDate: (date: string, timezone: string) => string | null;
  subscription: (identity: PosIdentity) => { readOnly: boolean };
  pricing: (
    env: Env,
    businessId: string,
    mode: string,
    priceList: string | null,
    timezone: string,
  ) => Promise<{ activeId: string; normalId: string; timezone: string }>;
  priceMap: (
    rows: Record<string, unknown>[],
    priceListId: string,
  ) => Map<string, number>;
  pricedProduct: (
    product: Record<string, unknown>,
    normalPrices: Map<string, number>,
    activePrices: Map<string, number>,
    branchId: string,
  ) =>
    | (Record<string, unknown> & {
        portions: Record<string, unknown>[];
        modifierGroups: unknown[];
        priceCents: number;
      })
    | null;
};

export class PosError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof PosError)
    return respond({ error: error.message, code: error.code }, error.status);
  const limit = planLimitError(error);
  if (limit) return respond(limit, 409);
  const message = String(error);
  if (
    message.includes(
      "UNIQUE constraint failed: sales.business_id, sales.profile_id, sales.table_id",
    )
  ) {
    return respond(
      {
        error: "This table already has an open bill on this profile",
        code: "TABLE_OCCUPIED",
      },
      409,
    );
  }
  if (
    message.includes("POS_STATE_CONFLICT") ||
    message.includes("UNIQUE constraint failed:")
  ) {
    return respond(
      {
        error:
          "The requested state conflicts with existing POS data. Refresh and retry.",
        code: "STATE_CONFLICT",
      },
      409,
    );
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return respond(
      {
        error: "A referenced record is no longer available",
        code: "STATE_CONFLICT",
      },
      409,
    );
  }
  throw error;
}

export function requirePosPlan(enabled: number) {
  if (enabled === 0)
    throw new PosError(403, "PLAN_POS_DISABLED", "POS is not included in this business’s subscription plan.");
}

export function invalid(message: string): never {
  throw new PosError(400, "INVALID_REQUEST", message);
}

export function conflict(message: string, code = "STATE_CONFLICT"): never {
  throw new PosError(409, code, message);
}

export function missing(entity: string): never {
  throw new PosError(404, "NOT_FOUND", `${entity} was not found`);
}

export const privileged = (role: string) =>
  role === "owner" || role === "manager";
export function requireManager(role: string) {
  if (!privileged(role))
    throw new PosError(
      403,
      "FORBIDDEN",
      "A business owner or manager is required",
    );
}

export const newId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
export const sql = (db: D1Database, query: string, ...bindings: unknown[]) =>
  db.prepare(query).bind(...bindings);
export const MAX_AMOUNT = 100_000_000_000;

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Expected a JSON object");
  return value as Record<string, unknown>;
}

export async function bodyOf(request: Request, maxBytes = 128_000) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new PosError(415, "UNSUPPORTED_MEDIA_TYPE", "Send application/json");
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  if (!reader) invalid("Expected a JSON body");
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new PosError(
        413,
        "REQUEST_TOO_LARGE",
        `JSON body exceeds ${maxBytes.toLocaleString("en-US")} bytes`,
      );
    }
    text += decoder.decode(value, { stream: true });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text + decoder.decode());
  } catch {
    invalid("Malformed JSON");
  }
  return object(parsed);
}

export function string(value: unknown, field: string, limit = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit)
    invalid(`Invalid ${field}`);
  return value.trim();
}

export const optionalText = (value: unknown, field: string, limit = 500) =>
  value == null || value === "" ? null : string(value, field, limit);

export function recordId(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))
    invalid(`Invalid ${field}`);
  return value;
}

export function integer(
  value: unknown,
  field: string,
  min: number,
  max = MAX_AMOUNT,
) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    invalid(`Invalid ${field}`);
  return value;
}

export function choice<T extends string>(
  value: unknown,
  field: string,
  options: readonly T[],
): T {
  if (typeof value !== "string" || !options.includes(value as T))
    invalid(`Invalid ${field}`);
  return value as T;
}

export const currencyOf = (value: unknown) =>
  choice(value, "currency", ["USD", "KHR"] as const);
export function list(value: unknown, field: string, max: number) {
  if (!Array.isArray(value) || value.length > max) invalid(`Invalid ${field}`);
  return value as unknown[];
}

export function boolean(value: unknown, field: string) {
  if (typeof value !== "boolean") invalid(`Invalid ${field}`);
  return value;
}

export async function digest(text: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const activeDeviceSession = `(s.device_credential_id IS NULL OR EXISTS (
  SELECT 1 FROM pos_device_credentials d
  WHERE d.id=s.device_credential_id AND d.revoked_at IS NULL
    AND d.business_id=s.business_id AND d.profile_id=s.profile_id AND d.user_id=s.user_id
    AND d.credential_version=s.credential_version
))`;

// Both checks run again in the batch that advances the branch journal.
export const storeOperatorRegistered = `EXISTS (
  SELECT 1 FROM pos_store_operator_history h
  WHERE h.business_id=authority.business_id AND h.profile_id=? AND h.operator_id=?
    AND h.device_id=authority.device_id AND h.public_key=authority.public_key
)`;

export const storeOperatorActive = `EXISTS (
  SELECT 1 FROM pos_device_credentials d
  JOIN memberships member ON member.business_id=d.business_id AND member.user_id=d.user_id
  JOIN users account ON account.id=d.user_id AND account.password_salt=d.credential_version
  WHERE d.business_id=authority.business_id AND d.profile_id=? AND d.user_id=? AND d.revoked_at IS NULL
    AND d.device_id=authority.device_id AND d.public_key=authority.public_key
    AND (member.role IN ('owner','manager') OR EXISTS (
      SELECT 1 FROM pos_profile_grants g
      WHERE g.business_id=d.business_id AND g.profile_id=d.profile_id AND g.user_id=d.user_id
    ))
)`;

export const profileColumns = `p.id,p.branch_id,b.name AS branch_name,p.name,
  p.is_active,p.version,p.config_json,p.pending_config_json`;

function normalizeProfileConfig(config: ProfileConfig): ProfileConfigView {
  const taxRules = (config.tax_rules ?? []).map((rule, index) => ({
    ...rule,
    id: rule.id ?? "legacy_tax_rule_" + (index + 1),
    tax_mode: rule.tax_mode ?? "disabled",
  } satisfies ProfileConfig["tax_rules"][number]));
  const defaultTaxRule = taxRules.find(({ id }) => id === config.default_tax_rule_id) ?? null;
  return {
    ...config,
    default_menu_id: config.default_menu_id ?? null,
    prompt_guest_cover: config.prompt_guest_cover ?? false,
    table_status_colors: { ...posTableStatusColors, ...config.table_status_colors },
    receipt_templates: config.receipt_templates ?? [],
    default_receipt_templates: { ...emptyPosReceiptDefaults, ...config.default_receipt_templates },
    tax_rules: taxRules,
    default_tax_rule_id: defaultTaxRule?.id ?? null,
    default_tax_rule: defaultTaxRule,
  };
}

export function registerTaxSettings(profile: PosProfile) {
  const config = normalizeProfileConfig(
    JSON.parse(profile.pending_config_json ?? profile.config_json),
  );
  return {
    tax_rules: config.tax_rules,
    default_tax_rule_id: config.default_tax_rule_id,
    default_tax_rule: config.default_tax_rule,
    tax_mode: config.tax_mode,
    tax_rate_bps: config.tax_rate_bps,
  };
}

export function profileView(profile: PosProfile, admin = false) {
  const { config_json, pending_config_json, is_active, ...fields } = profile;
  return {
    ...fields,
    is_active: Boolean(is_active),
    config: normalizeProfileConfig(JSON.parse(config_json)),
    ...(admin
      ? {
          pending_config: pending_config_json
            ? normalizeProfileConfig(JSON.parse(pending_config_json))
            : null,
        }
      : {}),
  };
}

export async function paymentTypes(
  context: PosContext,
): Promise<PaymentType[]> {
  const { results } = await sql(
    context.db,
    `SELECT t.id,t.name,t.kind,t.currency,t.payment_type_group
    FROM pos_payment_types t WHERE t.business_id=? AND t.id IN (SELECT json_extract(value,'$.id') FROM json_each(?))`,
    context.identity.business_id,
    JSON.stringify(context.config.payment_types),
  ).all<Omit<PaymentType, "currency"> & { currency: PosCurrency | null }>();
  const types = new Map(results.map((row) => [row.id, row]));
  return context.config.payment_types.flatMap((entry) => {
    const stored = types.get(entry.id);
    if (!stored) return [];
    if (stored.currency && stored.currency !== entry.currency) return [];
    return [{
      ...stored,
      currency: entry.currency,
      allow_cash_float: entry.allow_cash_float ??
        (context.config.cashier_shift_enabled && stored.kind === "cash"),
    }];
  });
}

export type Guard = {
  query: string;
  params: unknown[];
  manager?: boolean;
  allowReadOnly?: boolean;
  allowStoreAuthority?: boolean;
};

export const idleProfile = `NOT EXISTS (
    SELECT 1 FROM cashier_shifts shift WHERE shift.profile_id=pos_profiles.id AND shift.closed_at IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM sales sale WHERE sale.profile_id=pos_profiles.id AND sale.status IN ('open','submitted')
  )`;

export function promoteProfile(context: PosContext) {
  return sql(
    context.db,
    `UPDATE pos_profiles SET config_json=pending_config_json,
    pending_config_json=NULL,version=version+1
    WHERE business_id=? AND id=? AND pending_config_json IS NOT NULL AND ${idleProfile}`,
    context.identity.business_id,
    context.profile.id,
  );
}

export function jsonRow(
  alias: string,
  columns: string,
  extra: Record<string, string> = {},
) {
  const entries = [
    ...columns
      .split(/\s+/)
      .filter(Boolean)
      .map((column) => [column, `${alias}.${column}`]),
    ...Object.entries(extra),
  ];
  let expression = "'{}'";
  for (let offset = 0; offset < entries.length; offset += 12) {
    const argumentsSql = entries
      .slice(offset, offset + 12)
      .map(([key, value]) => `'$.${key}',${value}`)
      .join(",");
    expression = `json_set(${expression},${argumentsSql})`;
  }
  return expression;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(row)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(row[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

export class Command {
  private constructor(
    private readonly context: PosContext,
    private readonly key: string,
    private readonly hash: string,
    readonly body: Record<string, unknown>,
  ) {}

  static async read(
    request: Request,
    context: PosContext,
    supplied?: {
      envelope: Record<string, unknown>;
      body: Record<string, unknown>;
    },
  ) {
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
      invalid("A valid Idempotency-Key header is required");
    const body = supplied?.body ?? (await bodyOf(request));
    const hash = await digest(
      canonical([
        request.method,
        context.storeImport?.recovery
          ? posApiPath + "/store-operations"
          : new URL(request.url).pathname,
        context.identity.user_id,
        supplied?.envelope ?? body,
      ]),
    );
    const command = new Command(context, key, hash, body);
    return (await command.replay()) ?? command;
  }

  async replay() {
    const { db, identity, profile } = this.context;
    const record = await sql(
      db,
      `SELECT request_hash,response_json,response_status FROM pos_commands
      WHERE business_id=? AND profile_id=? AND idempotency_key=?`,
      identity.business_id,
      profile.id,
      this.key,
    ).first<{
      request_hash: string;
      response_json: string;
      response_status: number;
    }>();
    if (!record) return null;
    if (record.request_hash !== this.hash)
      conflict(
        "The idempotency key was already used for a different request",
        "IDEMPOTENCY_CONFLICT",
      );
    return respond(JSON.parse(record.response_json), record.response_status);
  }

  async commit(
    status: number,
    guard: Guard,
    writes: D1PreparedStatement[],
    result: { query: string; params: unknown[] },
  ) {
    const { db, identity, profile, now, storeImport } = this.context;
    const { business_id: businessId, user_id: actor } = identity;
    const recovery = storeImport?.recovery;
    const eligible = `EXISTS (
      SELECT 1 FROM pos_profiles p
      JOIN branches b ON b.id=p.branch_id AND b.business_id=p.business_id AND b.is_active=1
      JOIN businesses business ON business.id=b.business_id AND business.is_active=1
      JOIN pos_sessions s ON s.business_id=p.business_id AND ${recovery ? "s.profile_id=?" : "s.profile_id=p.id"}
      JOIN memberships m ON m.business_id=s.business_id AND m.user_id=s.user_id
      JOIN users u ON u.id=m.user_id AND u.password_salt=s.credential_version
      WHERE p.business_id=? AND p.id=? AND p.version=? AND p.is_active=1
        AND s.token_hash=? AND s.expires_at>unixepoch() AND ${activeDeviceSession}
        AND ${posPlanEnabled("p.business_id")}
        ${
          recovery
            ? `AND m.role='owner' AND EXISTS (
          SELECT 1 FROM pos_profiles approving
          WHERE approving.id=s.profile_id AND approving.business_id=p.business_id
            AND approving.branch_id=p.branch_id AND approving.is_active=1
        )`
            : ""
        }
        AND ${
          storeImport
            ? `EXISTS (
            SELECT 1 FROM pos_store_authorities authority
            JOIN pos_device_credentials device ON device.id=s.device_credential_id
            WHERE authority.business_id=p.business_id AND authority.branch_id=p.branch_id
              AND authority.epoch=? AND authority.last_sequence=? AND authority.device_id=device.device_id
              AND (authority.public_key IS NULL OR authority.public_key=device.public_key)
              ${recovery ? `AND ${storeOperatorRegistered} AND NOT ${storeOperatorActive}` : ""}
          )`
            : guard.allowStoreAuthority
              ? "1"
              : `NOT EXISTS (
            SELECT 1 FROM pos_store_authorities authority
            WHERE authority.business_id=p.business_id AND authority.branch_id=p.branch_id
          )`
        }
        AND (m.role IN ('owner','manager') ${
          guard.manager
            ? ""
            : `OR EXISTS (
          SELECT 1 FROM pos_profile_grants g WHERE g.business_id=m.business_id AND g.profile_id=p.id AND g.user_id=m.user_id
        )`
        })
        ${
          guard.allowReadOnly
            ? ""
            : `AND NOT EXISTS (
          SELECT 1 FROM business_subscriptions sub WHERE sub.business_id=p.business_id
          AND (sub.status IN ('past_due','canceled') OR
            (sub.current_period_end_at IS NOT NULL AND COALESCE(unixepoch(sub.current_period_end_at),0)<=unixepoch()))
        )`
        }
    )`;
    const results = await db.batch<{ response_json: string }>([
      sql(
        db,
        `INSERT INTO pos_commands
          (business_id,profile_id,idempotency_key,request_hash,actor_id,created_at,response_status,state_valid)
          SELECT ?,?,?,?,?,?,?,CASE WHEN ${eligible} AND (${guard.query}) THEN 1 ELSE 0 END`,
        businessId,
        profile.id,
        this.key,
        this.hash,
        actor,
        now,
        status,
        ...(recovery ? [identity.profile_id] : []),
        businessId,
        profile.id,
        profile.version,
        identity.token_hash,
        ...(storeImport ? [storeImport.epoch, storeImport.sequence - 1] : []),
        ...(recovery ? [profile.id, actor, profile.id, actor] : []),
        ...guard.params,
      ),
      ...writes,
      ...(recovery
        ? [
            sql(
              db,
              `INSERT INTO pos_store_recoveries
          (epoch,sequence,business_id,branch_id,profile_id,command_id,operator_id,approved_by,reason,approved_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
              storeImport!.epoch,
              storeImport!.sequence,
              businessId,
              profile.branch_id,
              profile.id,
              this.key,
              actor,
              recovery.approvedBy,
              recovery.reason,
              recovery.approvedAt,
            ),
          ]
        : []),
      ...(storeImport
        ? [
            sql(
              db,
              "UPDATE pos_store_authorities SET last_sequence=? WHERE epoch=?",
              storeImport.sequence,
              storeImport.epoch,
            ),
          ]
        : []),
      sql(
        db,
        `UPDATE pos_commands SET response_json=(${result.query})
          WHERE business_id=? AND profile_id=? AND idempotency_key=? RETURNING response_json`,
        ...result.params,
        businessId,
        profile.id,
        this.key,
      ),
    ]);
    return respond(
      JSON.parse(results[results.length - 1].results[0].response_json),
      status,
    );
  }
}

export function pagination(url: URL) {
  const size = url.searchParams.get("page_size") ?? "25";
  const page = url.searchParams.get("page") ?? "1";
  if (!/^\d+$/.test(page) || !/^\d+$/.test(size)) invalid("Invalid pagination");
  const limit = integer(Number(size), "page_size", 1, 100);
  const pageNumber = integer(Number(page), "page", 1, 1_000_000);
  return { limit, offset: (pageNumber - 1) * limit, page: pageNumber };
}

export async function pageOf(
  db: D1Database,
  url: URL,
  resource: string,
  query: string,
  params: unknown[],
) {
  const { limit, offset, page } = pagination(url);
  const { results } = await sql(
    db,
    `${query} LIMIT ? OFFSET ?`,
    ...params,
    limit + 1,
    offset,
  ).all();
  return {
    [resource]: results.slice(0, limit),
    page,
    page_size: limit,
    has_more: results.length > limit,
  };
}
