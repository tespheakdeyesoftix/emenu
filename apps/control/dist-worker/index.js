var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../shared/userPermissions.ts
var userPermissionKeys = [
  "allow_start_working_day",
  "allow_close_working_day",
  "allow_start_cashier_shift",
  "allow_close_cashier_shift",
  "allow_change_product_price",
  "allow_free_item",
  "allow_discount_on_item",
  "allow_discount_on_bill",
  "allow_process_payment",
  "allow_cancel_print_bill"
];
function userPermissions(value, role) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  }
  const settings = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  return Object.fromEntries(userPermissionKeys.map((key) => [
    key,
    role === "owner" || (typeof settings[key] === "boolean" ? settings[key] : role === "manager" || !["allow_start_working_day", "allow_close_working_day"].includes(key))
  ]));
}
__name(userPermissions, "userPermissions");

// worker/posPermissions.ts
function permissionSql(key, user = "u", role = "m.role") {
  const fallback = ["allow_start_working_day", "allow_close_working_day"].includes(key) ? `CASE WHEN ${role}='manager' THEN 1 ELSE 0 END` : "1";
  return `(${role}='owner' OR COALESCE(json_extract(${user}.permissions,'$.${key}'),${fallback})=1)`;
}
__name(permissionSql, "permissionSql");
function requirePosPermission(context, key) {
  if (!userPermissions(context.identity.permissions, context.identity.role)[key])
    throw new PosError(403, "PERMISSION_DENIED", "You do not have permission for this action.");
  (context.requiredPermissions ??= /* @__PURE__ */ new Set()).add(key);
}
__name(requirePosPermission, "requirePosPermission");
function requireLinePermissions(context, line, saved) {
  const ids = /* @__PURE__ */ __name((value) => JSON.stringify(Array.isArray(value) ? value.map((v) => typeof v === "object" && v ? v.id : v).sort() : []), "ids");
  const same = saved != null && line.product_id === saved.product_id && (line.portion_id ?? null) === (saved.portion_id ?? null) && Number(line.quantity) === Number(saved.quantity) && ids(line.modifier_ids ?? line.modifiers) === ids(saved.modifiers);
  const changed = /* @__PURE__ */ __name((fields2) => !same || fields2.some((key) => {
    const a = line[key] ?? (key.startsWith("discount_") && key !== "discount_note" ? 0 : null);
    const b = saved?.[key] ?? (key.startsWith("discount_") && key !== "discount_note" ? 0 : null);
    return key === "is_free" ? Boolean(a) !== Boolean(b) : a !== b;
  }), "changed");
  if (changed(["base_price_override_minor", "price_change_reason"]) && (line.base_price_override_minor != null || saved?.base_price_override_minor != null))
    requirePosPermission(context, "allow_change_product_price");
  if (changed(["is_free", "free_reason"]) && (line.is_free || saved?.is_free))
    requirePosPermission(context, "allow_free_item");
  if (changed(["discount_minor", "discount_bps", "discount_note"]) && [line.discount_minor, line.discount_bps, saved?.discount_minor, saved?.discount_bps].some((value) => Number(value ?? 0) > 0))
    requirePosPermission(context, "allow_discount_on_item");
}
__name(requireLinePermissions, "requireLinePermissions");

// ../../shared/posReceipts.ts
var posReceiptTypes = ["receipt", "kitchen_receipt", "qr_label"];
var posReceiptLanguages = ["en", "km", "bilingual"];
var posReceiptTextSizes = ["small", "normal", "large"];
var posReceiptAlignments = ["left", "center", "right"];
var posQrTargets = ["table_menu", "business_menu", "custom_url"];
var posReceiptFields = {
  receipt: [
    "logo",
    "business_details",
    "branch",
    "order_number",
    "date_time",
    "cashier",
    "customer",
    "table",
    "service_type",
    "item_codes",
    "modifiers",
    "item_notes",
    "unit_prices",
    "discount",
    "tax",
    "payments",
    "change",
    "order_notes",
    "signature"
  ],
  kitchen_receipt: [
    "logo",
    "branch",
    "order_number",
    "date_time",
    "cashier",
    "table",
    "service_type",
    "station",
    "item_codes",
    "modifiers",
    "item_notes",
    "order_notes",
    "highlight_notes"
  ],
  qr_label: ["logo", "branch", "table", "show_link"]
};
var posReceiptLimits = {
  width: { min: 30, max: 216 },
  labelHeight: { min: 20, max: 150 },
  qrSize: { min: 15, max: 150 },
  copies: { min: 1, max: 10 }
};
var emptyPosReceiptDefaults = {
  receipt: null,
  kitchen_receipt: null,
  qr_label: null
};

// ../../shared/controlPages.ts
var controlPages = {
  overview: { path: "/", label: "Overview" },
  users: { path: "/users", label: "Users" },
  business: { path: "/business", label: "Business information" },
  appearance: { path: "/appearance", label: "Menu appearance" },
  catalog: { path: "/catalog", label: "Product Catalog" },
  menus: { path: "/menus", label: "Menus" },
  priceLists: { path: "/price-lists", label: "Price lists" },
  managePrices: { path: "/manage-prices", label: "Manage prices" },
  sellingOverview: { path: "/selling", label: "Selling dashboard" },
  posProfiles: { path: "/selling/pos-profiles", label: "POS profile settings" },
  posPaymentTypes: { path: "/selling/payment-types", label: "Payment types" },
  posCustomers: { path: "/selling/customers", label: "Customers" },
  salesList: { path: "/selling/sales", label: "Sales list" },
  orders: { path: "/orders", label: "Orders" },
  bookings: { path: "/bookings", label: "Bookings" },
  telegramNotifications: { path: "/telegram-notifications", label: "Telegram notifications" },
  reports: { path: "/reports", label: "Reports" },
  tables: { path: "/tables", label: "Tables" },
  banners: { path: "/banners", label: "Promotional banners" },
  qrDesigns: { path: "/qr-designs", label: "QR designs" }
};
var controlPageIds = Object.keys(controlPages);
var sellingControlPages = [
  "sellingOverview",
  "posProfiles",
  "posPaymentTypes",
  "posCustomers",
  "salesList"
];
var catalogReaderPages = [
  "overview",
  "appearance",
  "catalog",
  "managePrices",
  "banners"
];
var priceListReaderPages = [
  "business",
  "catalog",
  "priceLists",
  "managePrices"
];

// ../../shared/subscriptionPlans.ts
var MAX_DAILY_ORDERS = 999;

// worker/subscriptionPlans.ts
var DEFAULT_PLAN_ID = "plan_standard";
var planOfferJoin = `
  JOIN subscription_plan_prices price ON price.id=(
    SELECT id FROM subscription_plan_prices
    WHERE plan_id=plan.id AND is_active=1 AND currency='USD'
      AND provider IS NULL AND interval_count=1
    ORDER BY created_at DESC,id DESC LIMIT 1
  )`;
var planOfferFields = `
  plan.id,plan.code,plan.name,plan.description,plan.features_json AS featuresJson,
  plan.max_users AS maxUsers,plan.max_branches AS maxBranches,plan.max_menus AS maxMenus,
  plan.max_products AS maxProducts,plan.max_daily_orders AS maxDailyOrders,
  plan.pos_enabled AS posEnabled,plan.max_pos_profiles AS maxPosProfiles,
  plan.max_daily_pos_sales AS maxDailyPosSales,
  price.id AS priceId,price.amount_minor AS amountMinor,price.billing_interval AS billingInterval`;
var planFeatures = /* @__PURE__ */ __name((value) => {
  try {
    const keys = JSON.parse(value);
    return Array.isArray(keys) ? controlPageIds.filter((key) => keys.includes(key)) : [];
  } catch {
    return [];
  }
}, "planFeatures");
var serializePlan = /* @__PURE__ */ __name(({
  featuresJson,
  maxUsers,
  maxBranches,
  maxMenus,
  maxProducts,
  maxDailyOrders,
  posEnabled,
  maxPosProfiles,
  maxDailyPosSales,
  ...row
}) => ({
  ...row,
  features: planFeatures(featuresJson),
  limits: { users: maxUsers, branches: maxBranches, menus: maxMenus, products: maxProducts, dailyOrders: maxDailyOrders },
  pos: { enabled: Boolean(posEnabled), profiles: maxPosProfiles, dailySales: maxDailyPosSales }
}), "serializePlan");
var isLimit = /* @__PURE__ */ __name((input, minimum, maximum = Number.MAX_SAFE_INTEGER) => input === null || typeof input === "number" && Number.isSafeInteger(input) && input >= minimum && input <= maximum, "isLimit");
function parsePlanLimits(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value;
  const { branches, menus, products, dailyOrders } = input;
  const users = Object.hasOwn(input, "users") ? input.users : null;
  if (Object.keys(input).some((key) => !["users", "branches", "menus", "products", "dailyOrders"].includes(key)) || !isLimit(users, 1) || !isLimit(branches, 1) || !isLimit(menus, 0) || !isLimit(products, 0) || !isLimit(dailyOrders, 0, MAX_DAILY_ORDERS)) return null;
  return { users, branches, menus, products, dailyOrders };
}
__name(parsePlanLimits, "parsePlanLimits");
function parsePlanPos(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { enabled, profiles, dailySales } = value;
  if (Object.keys(value).length !== 3 || typeof enabled !== "boolean" || !isLimit(profiles, 0) || !isLimit(dailySales, 0)) return null;
  return { enabled, profiles, dailySales };
}
__name(parsePlanPos, "parsePlanPos");
var posPlanEnabled = /* @__PURE__ */ __name((businessId) => `NOT EXISTS (
  SELECT 1 FROM business_subscriptions subscription
  JOIN subscription_plans plan ON plan.id=subscription.plan_id
  WHERE subscription.business_id=${businessId} AND plan.pos_enabled=0
)`, "posPlanEnabled");
var limitErrors = {
  PLAN_USER_LIMIT: { code: "PLAN_USER_LIMIT", error: "This business has reached its subscription plan\u2019s user limit, including the owner. Remove a user or upgrade the plan to add another account." },
  PLAN_BRANCH_LIMIT: { code: "PLAN_BRANCH_LIMIT", error: "This business has reached its subscription plan\u2019s branch limit." },
  PLAN_MENU_LIMIT: { code: "PLAN_MENU_LIMIT", error: "This business has reached its subscription plan\u2019s menu limit." },
  PLAN_PRODUCT_LIMIT: { code: "PLAN_PRODUCT_LIMIT", error: "This business has reached its subscription plan\u2019s product limit." },
  PLAN_DAILY_ORDER_LIMIT: { code: "order_limit_reached", error: "The business has reached its daily order limit." },
  PLAN_POS_PROFILE_LIMIT: { code: "PLAN_POS_PROFILE_LIMIT", error: "This business has reached its subscription plan\u2019s active POS profile limit." },
  PLAN_POS_PROFILE_IN_USE: { code: "PLAN_POS_PROFILE_IN_USE", error: "Deactivate excess POS profiles before applying this limit." },
  PLAN_DAILY_POS_SALE_LIMIT: { code: "PLAN_DAILY_POS_SALE_LIMIT", error: "This business has reached its daily POS sales limit." }
};
function planLimitError(error3) {
  const message = String(error3);
  const code = Object.keys(limitErrors).find((key) => message.includes(key));
  return code ? limitErrors[code] : null;
}
__name(planLimitError, "planLimitError");
function selectedPlan(db, planId, publicOnly) {
  return db.prepare(
    `SELECT ${planOfferFields} FROM subscription_plans plan ${planOfferJoin}
     WHERE plan.id=? AND plan.is_active=1 AND (?=0 OR plan.is_public=1)`
  ).bind(planId, Number(publicOnly)).first();
}
__name(selectedPlan, "selectedPlan");
async function publicPlans(db) {
  const { results } = await db.prepare(
    `SELECT ${planOfferFields} FROM subscription_plans plan ${planOfferJoin}
     WHERE plan.is_active=1 AND plan.is_public=1 ORDER BY plan.display_order,plan.name,plan.id`
  ).all();
  return results.map(serializePlan);
}
__name(publicPlans, "publicPlans");

// ../../shared/posProfile.ts
var paymentKindByGroup = {
  Cash: "cash",
  "Credit Card": "card",
  Bank: "other",
  "QR Payment": "qr",
  Other: "other"
};
var paymentTypeGroups = Object.keys(paymentKindByGroup);
var defaultPaymentGroup = {
  cash: "Cash",
  card: "Credit Card",
  qr: "QR Payment",
  other: "Other"
};
var posTaxModes = ["disabled", "inclusive", "exclusive"];
var posTableStatusColors = {
  vacant: "#2F7656",
  occupied: "#245EB2",
  bill_requested: "#B45309",
  hold: "#6B4AA0",
  booked: "#AE356C"
};
var posTableStatuses = Object.keys(posTableStatusColors);

// worker/posApiCore.ts
var posApiPath = "/api/integrations/pos/v1";
var posAdminPath = "/api/admin/pos";
var isPosApiPath = /* @__PURE__ */ __name((path) => path === posApiPath || path.startsWith(posApiPath + "/"), "isPosApiPath");
var isPosAdminPath = /* @__PURE__ */ __name((path) => path === posAdminPath || path.startsWith(posAdminPath + "/"), "isPosAdminPath");
function allowsCashFloat(type) {
  return type.allow_cash_float ?? type.kind === "cash";
}
__name(allowsCashFloat, "allowsCashFloat");
var PosError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
  static {
    __name(this, "PosError");
  }
};
function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store"
    }
  });
}
__name(respond, "respond");
function errorResponse(error3) {
  if (error3 instanceof PosError)
    return respond({ error: error3.message, code: error3.code }, error3.status);
  const limit = planLimitError(error3);
  if (limit) return respond(limit, 409);
  const message = String(error3);
  if (message.includes(
    "UNIQUE constraint failed: sales.business_id, sales.profile_id, sales.table_id"
  )) {
    return respond(
      {
        error: "This table already has an open bill on this profile",
        code: "TABLE_OCCUPIED"
      },
      409
    );
  }
  if (message.includes("POS_STATE_CONFLICT") || message.includes("UNIQUE constraint failed:")) {
    return respond(
      {
        error: "The requested state conflicts with existing POS data. Refresh and retry.",
        code: "STATE_CONFLICT"
      },
      409
    );
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return respond(
      {
        error: "A referenced record is no longer available",
        code: "STATE_CONFLICT"
      },
      409
    );
  }
  throw error3;
}
__name(errorResponse, "errorResponse");
function requirePosPlan(enabled) {
  if (enabled === 0)
    throw new PosError(403, "PLAN_POS_DISABLED", "POS is not included in this business\u2019s subscription plan.");
}
__name(requirePosPlan, "requirePosPlan");
function invalid(message) {
  throw new PosError(400, "INVALID_REQUEST", message);
}
__name(invalid, "invalid");
function conflict(message, code = "STATE_CONFLICT") {
  throw new PosError(409, code, message);
}
__name(conflict, "conflict");
function missing(entity) {
  throw new PosError(404, "NOT_FOUND", `${entity} was not found`);
}
__name(missing, "missing");
var privileged = /* @__PURE__ */ __name((role) => role === "owner" || role === "manager", "privileged");
function requireManager(role) {
  if (!privileged(role))
    throw new PosError(
      403,
      "FORBIDDEN",
      "A business owner or manager is required"
    );
}
__name(requireManager, "requireManager");
var newId = /* @__PURE__ */ __name((prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`, "newId");
var sql = /* @__PURE__ */ __name((db, query, ...bindings) => db.prepare(query).bind(...bindings), "sql");
var MAX_AMOUNT = 1e11;
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Expected a JSON object");
  return value;
}
__name(object, "object");
async function bodyOf(request, maxBytes = 128e3) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new PosError(415, "UNSUPPORTED_MEDIA_TYPE", "Send application/json");
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text2 = "";
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
        `JSON body exceeds ${maxBytes.toLocaleString("en-US")} bytes`
      );
    }
    text2 += decoder.decode(value, { stream: true });
  }
  let parsed;
  try {
    parsed = JSON.parse(text2 + decoder.decode());
  } catch {
    invalid("Malformed JSON");
  }
  return object(parsed);
}
__name(bodyOf, "bodyOf");
function string(value, field, limit = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit)
    invalid(`Invalid ${field}`);
  return value.trim();
}
__name(string, "string");
var optionalText = /* @__PURE__ */ __name((value, field, limit = 500) => value == null || value === "" ? null : string(value, field, limit), "optionalText");
function recordId(value, field) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))
    invalid(`Invalid ${field}`);
  return value;
}
__name(recordId, "recordId");
function integer(value, field, min, max = MAX_AMOUNT) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    invalid(`Invalid ${field}`);
  return value;
}
__name(integer, "integer");
function choice(value, field, options) {
  if (typeof value !== "string" || !options.includes(value))
    invalid(`Invalid ${field}`);
  return value;
}
__name(choice, "choice");
var currencyOf = /* @__PURE__ */ __name((value) => choice(value, "currency", ["USD", "KHR"]), "currencyOf");
function list(value, field, max) {
  if (!Array.isArray(value) || value.length > max) invalid(`Invalid ${field}`);
  return value;
}
__name(list, "list");
function boolean(value, field) {
  if (typeof value !== "boolean") invalid(`Invalid ${field}`);
  return value;
}
__name(boolean, "boolean");
async function digest(text2) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text2)
  );
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(digest, "digest");
var activeDeviceSession = `(s.device_credential_id IS NULL OR EXISTS (
  SELECT 1 FROM pos_device_credentials d
  WHERE d.id=s.device_credential_id AND d.revoked_at IS NULL
    AND d.business_id=s.business_id AND d.profile_id=s.profile_id AND d.user_id=s.user_id
    AND d.credential_version=s.credential_version
))`;
var storeOperatorRegistered = `EXISTS (
  SELECT 1 FROM pos_store_operator_history h
  WHERE h.business_id=authority.business_id AND h.profile_id=? AND h.operator_id=?
    AND h.device_id=authority.device_id AND h.public_key=authority.public_key
)`;
var storeOperatorActive = `EXISTS (
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
var profileColumns = `p.id,p.branch_id,b.name AS branch_name,p.name,
  p.is_active,p.version,p.config_json,p.pending_config_json`;
function normalizeProfileConfig(config) {
  const taxRules = (config.tax_rules ?? []).map((rule, index) => ({
    ...rule,
    id: rule.id ?? "legacy_tax_rule_" + (index + 1),
    tax_mode: rule.tax_mode ?? "disabled"
  }));
  const defaultTaxRule = taxRules.find(({ id: id2 }) => id2 === config.default_tax_rule_id) ?? null;
  return {
    ...config,
    default_menu_id: config.default_menu_id ?? null,
    prompt_guest_cover: config.prompt_guest_cover ?? false,
    table_status_colors: { ...posTableStatusColors, ...config.table_status_colors },
    receipt_templates: config.receipt_templates ?? [],
    default_receipt_templates: { ...emptyPosReceiptDefaults, ...config.default_receipt_templates },
    tax_rules: taxRules,
    default_tax_rule_id: defaultTaxRule?.id ?? null,
    default_tax_rule: defaultTaxRule
  };
}
__name(normalizeProfileConfig, "normalizeProfileConfig");
function registerTaxSettings(profile) {
  const config = normalizeProfileConfig(
    JSON.parse(profile.pending_config_json ?? profile.config_json)
  );
  return {
    tax_rules: config.tax_rules,
    default_tax_rule_id: config.default_tax_rule_id,
    default_tax_rule: config.default_tax_rule,
    tax_mode: config.tax_mode,
    tax_rate_bps: config.tax_rate_bps
  };
}
__name(registerTaxSettings, "registerTaxSettings");
function profileView(profile, admin = false) {
  const { config_json, pending_config_json, is_active, ...fields2 } = profile;
  return {
    ...fields2,
    is_active: Boolean(is_active),
    config: normalizeProfileConfig(JSON.parse(config_json)),
    ...admin ? {
      pending_config: pending_config_json ? normalizeProfileConfig(JSON.parse(pending_config_json)) : null
    } : {}
  };
}
__name(profileView, "profileView");
async function paymentTypes(context) {
  const { results } = await sql(
    context.db,
    `SELECT t.id,t.name,t.kind,t.currency,t.payment_type_group
    FROM pos_payment_types t WHERE t.business_id=? AND t.id IN (SELECT json_extract(value,'$.id') FROM json_each(?))`,
    context.identity.business_id,
    JSON.stringify(context.config.payment_types)
  ).all();
  const types = new Map(results.map((row) => [row.id, row]));
  return context.config.payment_types.flatMap((entry) => {
    const stored = types.get(entry.id);
    if (!stored) return [];
    if (stored.currency && stored.currency !== entry.currency) return [];
    return [{
      ...stored,
      currency: entry.currency,
      allow_cash_float: entry.allow_cash_float ?? (context.config.cashier_shift_enabled && stored.kind === "cash")
    }];
  });
}
__name(paymentTypes, "paymentTypes");
var idleProfile = `NOT EXISTS (
    SELECT 1 FROM cashier_shifts shift WHERE shift.profile_id=pos_profiles.id AND shift.closed_at IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM sales sale WHERE sale.profile_id=pos_profiles.id AND sale.status IN ('open','submitted','bill_requested')
  )`;
function promoteProfile(context) {
  return sql(
    context.db,
    `UPDATE pos_profiles SET config_json=pending_config_json,
    pending_config_json=NULL,version=version+1
    WHERE business_id=? AND id=? AND pending_config_json IS NOT NULL AND ${idleProfile}`,
    context.identity.business_id,
    context.profile.id
  );
}
__name(promoteProfile, "promoteProfile");
function jsonRow(alias, columns, extra = {}) {
  const entries = [
    ...columns.split(/\s+/).filter(Boolean).map((column) => [column, `${alias}.${column}`]),
    ...Object.entries(extra)
  ];
  let expression = "'{}'";
  for (let offset = 0; offset < entries.length; offset += 12) {
    const argumentsSql = entries.slice(offset, offset + 12).map(([key, value]) => `'$.${key}',${value}`).join(",");
    expression = `json_set(${expression},${argumentsSql})`;
  }
  return expression;
}
__name(jsonRow, "jsonRow");
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const row = value;
    return "{" + Object.keys(row).sort().map((key) => JSON.stringify(key) + ":" + canonical(row[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}
__name(canonical, "canonical");
var Command = class _Command {
  constructor(context, key, hash2, body) {
    this.context = context;
    this.key = key;
    this.hash = hash2;
    this.body = body;
  }
  context;
  key;
  hash;
  body;
  static {
    __name(this, "Command");
  }
  static async read(request, context, supplied) {
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
      invalid("A valid Idempotency-Key header is required");
    const body = supplied?.body ?? await bodyOf(request);
    const hash2 = await digest(
      canonical([
        request.method,
        context.storeImport?.recovery ? posApiPath + "/store-operations" : new URL(request.url).pathname,
        context.identity.user_id,
        supplied?.envelope ?? body
      ])
    );
    const command = new _Command(context, key, hash2, body);
    return await command.replay() ?? command;
  }
  async replay() {
    const { db, identity, profile } = this.context;
    const record = await sql(
      db,
      `SELECT request_hash,response_json,response_status FROM pos_commands
      WHERE business_id=? AND profile_id=? AND idempotency_key=?`,
      identity.business_id,
      profile.id,
      this.key
    ).first();
    if (!record) return null;
    if (record.request_hash !== this.hash)
      conflict(
        "The idempotency key was already used for a different request",
        "IDEMPOTENCY_CONFLICT"
      );
    return respond(JSON.parse(record.response_json), record.response_status);
  }
  async commit(status, guard, writes, result) {
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
        ${recovery ? `AND m.role='owner' AND EXISTS (
          SELECT 1 FROM pos_profiles approving
          WHERE approving.id=s.profile_id AND approving.business_id=p.business_id
            AND approving.branch_id=p.branch_id AND approving.is_active=1
        )` : ""}
        AND ${storeImport ? `EXISTS (
            SELECT 1 FROM pos_store_authorities authority
            JOIN pos_device_credentials device ON device.id=s.device_credential_id
            WHERE authority.business_id=p.business_id AND authority.branch_id=p.branch_id
              AND authority.epoch=? AND authority.last_sequence=? AND authority.device_id=device.device_id
              AND (authority.public_key IS NULL OR authority.public_key=device.public_key)
              ${recovery ? `AND ${storeOperatorRegistered} AND NOT ${storeOperatorActive}` : ""}
          )` : guard.allowStoreAuthority ? "1" : `NOT EXISTS (
            SELECT 1 FROM pos_store_authorities authority
            WHERE authority.business_id=p.business_id AND authority.branch_id=p.branch_id
          )`}
        AND ${[...this.context.requiredPermissions ?? []].map((key) => permissionSql(key)).join(" AND ") || "1"}
        AND (m.role IN ('owner','manager') ${guard.manager ? "" : `OR EXISTS (
          SELECT 1 FROM pos_profile_grants g WHERE g.business_id=m.business_id AND g.profile_id=p.id AND g.user_id=m.user_id
        )`})
        ${guard.allowReadOnly ? "" : `AND NOT EXISTS (
          SELECT 1 FROM business_subscriptions sub WHERE sub.business_id=p.business_id
          AND (sub.status IN ('past_due','canceled') OR
            (sub.current_period_end_at IS NOT NULL AND COALESCE(unixepoch(sub.current_period_end_at),0)<=unixepoch()))
        )`}
    )`;
    const results = await db.batch([
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
        ...recovery ? [identity.profile_id] : [],
        businessId,
        profile.id,
        profile.version,
        identity.token_hash,
        ...storeImport ? [storeImport.epoch, storeImport.sequence - 1] : [],
        ...recovery ? [profile.id, actor, profile.id, actor] : [],
        ...guard.params
      ),
      ...writes,
      ...recovery ? [
        sql(
          db,
          `INSERT INTO pos_store_recoveries
          (epoch,sequence,business_id,branch_id,profile_id,command_id,operator_id,approved_by,reason,approved_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
          storeImport.epoch,
          storeImport.sequence,
          businessId,
          profile.branch_id,
          profile.id,
          this.key,
          actor,
          recovery.approvedBy,
          recovery.reason,
          recovery.approvedAt
        )
      ] : [],
      ...storeImport ? [
        sql(
          db,
          "UPDATE pos_store_authorities SET last_sequence=? WHERE epoch=?",
          storeImport.sequence,
          storeImport.epoch
        )
      ] : [],
      sql(
        db,
        `UPDATE pos_commands SET response_json=(${result.query})
          WHERE business_id=? AND profile_id=? AND idempotency_key=? RETURNING response_json`,
        ...result.params,
        businessId,
        profile.id,
        this.key
      )
    ]);
    return respond(
      JSON.parse(results[results.length - 1].results[0].response_json),
      status
    );
  }
};
function pagination(url) {
  const size = url.searchParams.get("page_size") ?? "25";
  const page = url.searchParams.get("page") ?? "1";
  if (!/^\d+$/.test(page) || !/^\d+$/.test(size)) invalid("Invalid pagination");
  const limit = integer(Number(size), "page_size", 1, 100);
  const pageNumber = integer(Number(page), "page", 1, 1e6);
  return { limit, offset: (pageNumber - 1) * limit, page: pageNumber };
}
__name(pagination, "pagination");
async function pageOf(db, url, resource, query, params) {
  const { limit, offset, page } = pagination(url);
  const { results } = await sql(
    db,
    `${query} LIMIT ? OFFSET ?`,
    ...params,
    limit + 1,
    offset
  ).all();
  return {
    [resource]: results.slice(0, limit),
    page,
    page_size: limit,
    has_more: results.length > limit
  };
}
__name(pageOf, "pageOf");

// worker/posApiStaff.ts
function staffUsername(value) {
  const username = string(value, "username", 40);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/.test(username)) {
    invalid(
      "Use 2\u201340 letters, digits, dots, hyphens or underscores, starting with a letter or digit"
    );
  }
  return username.toLowerCase();
}
__name(staffUsername, "staffUsername");
var eligibleStaff = `m.business_id=? AND m.role<>'owner' AND (
  m.role='manager' OR EXISTS (
    SELECT 1 FROM pos_profile_grants g
    WHERE g.business_id=m.business_id AND g.profile_id=? AND g.user_id=m.user_id
  )
)`;
async function resolveStaffUsername(context, request) {
  requireManager(context.identity.role);
  const { username } = await bodyOf(request);
  const member = await sql(
    context.db,
    `SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE ${eligibleStaff} AND m.pos_username=?`,
    context.identity.business_id,
    context.profile.id,
    staffUsername(username)
  ).first();
  if (!member) missing("Staff username");
  return respond(member);
}
__name(resolveStaffUsername, "resolveStaffUsername");
async function listStaffUsernames(context, url) {
  requireManager(context.identity.role);
  return respond(
    await pageOf(
      context.db,
      url,
      "staff",
      `SELECT m.user_id,u.display_name AS name,m.role,m.pos_username AS username
    FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE ${eligibleStaff} ORDER BY u.display_name COLLATE NOCASE,m.user_id`,
      [context.identity.business_id, context.profile.id]
    )
  );
}
__name(listStaffUsernames, "listStaffUsernames");
async function setStaffUsername(context, request, userId) {
  requireManager(context.identity.role);
  const command = await Command.read(request, context);
  if (command instanceof Response) return command;
  const username = command.body.username === null ? null : staffUsername(command.body.username);
  const { db, identity, profile } = context;
  const matching = `FROM memberships m WHERE ${eligibleStaff} AND m.user_id=?`;
  const params = [identity.business_id, profile.id, userId];
  if (!await sql(db, `SELECT 1 ${matching}`, ...params).first())
    missing("Staff member");
  try {
    return await command.commit(
      200,
      {
        query: `EXISTS (SELECT 1 ${matching})`,
        params,
        manager: true,
        allowReadOnly: true,
        allowStoreAuthority: true
      },
      [
        sql(
          db,
          "UPDATE memberships SET pos_username=? WHERE business_id=? AND user_id=?",
          username,
          identity.business_id,
          userId
        )
      ],
      {
        query: `SELECT json_object('user_id',m.user_id,'username',m.pos_username) ${matching}`,
        params
      }
    );
  } catch (error3) {
    const replay = await command.replay();
    if (replay) return replay;
    if (error3 instanceof Error && error3.message.includes(
      "UNIQUE constraint failed: memberships.business_id, memberships.pos_username"
    )) {
      conflict(
        "That username is already in use in this business",
        "POS_USERNAME_TAKEN"
      );
    }
    throw error3;
  }
}
__name(setStaffUsername, "setStaffUsername");

// worker/adminUsers.ts
async function userCapacity(db, businessId) {
  const result = await sql(db, `SELECT
    (SELECT COUNT(*) FROM memberships WHERE business_id=?1) AS current,
    (SELECT p.max_users FROM business_subscriptions s JOIN subscription_plans p
      ON p.id=s.plan_id WHERE s.business_id=?1) AS quota`, businessId).first();
  return { current: result.current, limit: result.quota };
}
__name(userCapacity, "userCapacity");
var members = `FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.business_id=?`;
var fields = `u.id,u.display_name AS name,u.email,m.role,m.pos_username AS username,u.permissions,
  (SELECT COUNT(*) FROM memberships other WHERE other.user_id=u.id) AS memberships,
  (SELECT json_group_array(g.profile_id) FROM pos_profile_grants g
    WHERE g.user_id=u.id AND g.business_id=m.business_id) AS profile_ids`;
async function adminUsers(request, url, db, auth, credential) {
  if (auth.role !== "owner" || auth.sessionType !== "customer")
    return respond({ error: "Only the business owner can manage users." }, 403);
  try {
    const suffix = url.pathname.slice("/api/admin/users".length);
    if (request.method === "GET" && suffix === "/options") {
      const profiles2 = await sql(db, `SELECT p.id,p.name,b.name AS branch FROM pos_profiles p
        JOIN branches b ON b.id=p.branch_id WHERE p.business_id=? ORDER BY b.name,p.name,p.id`, auth.businessId).all();
      return respond({ profiles: profiles2.results });
    }
    if (request.method === "GET" && !suffix) {
      const { results } = await sql(db, `SELECT ${fields} ${members}
        ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,u.display_name COLLATE NOCASE,u.id`, auth.businessId).all();
      return respond({ capacity: await userCapacity(db, auth.businessId), users: results.map((row) => ({
        ...row,
        permissions: userPermissions(row.permissions, row.role),
        profile_ids: JSON.parse(row.profile_ids)
      })) });
    }
    const match = suffix.match(/^\/([a-zA-Z0-9_-]{1,80})$/);
    const id2 = match?.[1];
    if (suffix && !id2 || !id2 && request.method !== "POST" || id2 && !["PATCH", "DELETE"].includes(request.method))
      return respond({ error: "Method not allowed" }, 405);
    const existing = id2 ? await sql(db, `SELECT u.id,u.email,m.role,
      (SELECT COUNT(*) FROM memberships other WHERE other.user_id=u.id) AS memberships
      ${members} AND u.id=?`, auth.businessId, id2).first() : null;
    if (id2 && !existing) missing("Business user");
    if (existing?.role === "owner" || id2 === auth.userId)
      return respond({ error: "Use your account settings to edit the owner account." }, 403);
    if (request.method === "DELETE") {
      const removable = `EXISTS (SELECT 1 FROM memberships target JOIN memberships actor
        ON actor.business_id=target.business_id
        WHERE target.business_id=? AND target.user_id=? AND target.role<>'owner'
          AND actor.user_id=? AND actor.role='owner')`;
      const deletes = ["pos_profile_grants", "pos_sessions", "pos_device_credentials", "sessions", "memberships"].map((table) => sql(
        db,
        `DELETE FROM ${table} WHERE business_id=? AND user_id=? AND ${removable}`,
        auth.businessId,
        id2,
        auth.businessId,
        id2,
        auth.userId
      ));
      const results = await db.batch(deletes);
      if (!results.at(-1)?.meta.changes) conflict("The user changed. Refresh and retry.");
      return respond({ ok: true });
    }
    if (existing && existing.memberships > 1)
      return respond({ error: "This account belongs to multiple businesses. Its account and permissions need to be managed in Super Control." }, 409);
    if (!existing) {
      const capacity = await userCapacity(db, auth.businessId);
      if (capacity.limit !== null && capacity.current >= capacity.limit)
        return respond(planLimitError("PLAN_USER_LIMIT"), 409);
    }
    const body = await bodyOf(request);
    const name = string(body.name, "name", 120);
    const email = existing?.email ?? string(body.email, "email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("Enter a valid email address.");
    const role = choice(body.role, "role", ["manager", "editor"]);
    const username = body.username ? staffUsername(body.username) : null;
    const permissions = body.permissions;
    if (!permissions || typeof permissions !== "object" || Array.isArray(permissions) || Object.keys(permissions).some((key) => !userPermissionKeys.includes(key)) || userPermissionKeys.some((key) => typeof permissions[key] !== "boolean"))
      invalid("Choose valid user permissions.");
    if (!Array.isArray(body.profile_ids) || body.profile_ids.length > 500 || body.profile_ids.some((id3) => typeof id3 !== "string") || new Set(body.profile_ids).size !== body.profile_ids.length)
      invalid("Choose valid POS profiles.");
    const profiles = JSON.stringify(body.profile_ids);
    const total = await sql(db, `SELECT COUNT(*) AS total FROM pos_profiles WHERE business_id=?
      AND id IN (SELECT value FROM json_each(?))`, auth.businessId, profiles).first("total");
    if (total !== body.profile_ids.length) invalid("Choose profiles from this business.");
    let password = null;
    if (!existing || body.passwordProof !== void 0) {
      if (body.authVersion !== "client-pbkdf2-sha256-v1" || typeof body.passwordProof !== "string" || !/^[a-f0-9]{64}$/.test(body.passwordProof)) invalid("Provide a valid password.");
      password = await credential(body.passwordProof);
    }
    const userId = id2 ?? newId("usr");
    const encoded = JSON.stringify(permissions);
    const canEdit = `EXISTS (SELECT 1 FROM memberships WHERE business_id=? AND user_id=? AND role='owner')`;
    if (!existing) {
      const [created] = await db.batch([
        sql(
          db,
          `INSERT INTO users(id,email,display_name,password_hash,password_salt,permissions)
          SELECT ?,?,?,?,?,? WHERE ${canEdit}`,
          userId,
          email,
          name,
          password.hash,
          password.salt,
          encoded,
          auth.businessId,
          auth.userId
        ),
        sql(db, `INSERT INTO memberships(user_id,business_id,role,pos_username)
          SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)`, userId, auth.businessId, role, username, userId),
        sql(
          db,
          `INSERT INTO pos_profile_grants(business_id,profile_id,user_id)
          SELECT ?,value,? FROM json_each(?) WHERE EXISTS(SELECT 1 FROM memberships WHERE user_id=? AND business_id=?)`,
          auth.businessId,
          userId,
          profiles,
          userId,
          auth.businessId
        )
      ]);
      if (!created.meta.changes) conflict("Your access changed. Refresh and retry.");
    } else {
      const [updated] = await db.batch([
        sql(
          db,
          `UPDATE users SET display_name=?,permissions=?,
          password_hash=COALESCE(?,password_hash),password_salt=COALESCE(?,password_salt)
          WHERE id=? AND ${canEdit}
          AND (SELECT COUNT(*) FROM memberships WHERE user_id=users.id)=1
          AND EXISTS(SELECT 1 FROM memberships WHERE user_id=users.id AND business_id=? AND role<>'owner')`,
          name,
          encoded,
          password?.hash ?? null,
          password?.salt ?? null,
          userId,
          auth.businessId,
          auth.userId,
          auth.businessId
        ),
        sql(
          db,
          `UPDATE memberships SET role=CASE WHEN changes()=1 THEN ? ELSE NULL END,pos_username=? WHERE business_id=? AND user_id=? AND role<>'owner'`,
          role,
          username,
          auth.businessId,
          userId
        ),
        sql(db, "DELETE FROM pos_profile_grants WHERE business_id=? AND user_id=? AND profile_id NOT IN (SELECT value FROM json_each(?))", auth.businessId, userId, profiles),
        sql(db, `INSERT INTO pos_profile_grants(business_id,profile_id,user_id)
          SELECT ?,value,? FROM json_each(?) WHERE 1 ON CONFLICT DO NOTHING`, auth.businessId, userId, profiles),
        ...password ? [
          sql(db, "DELETE FROM sessions WHERE user_id=?", userId),
          sql(db, "DELETE FROM pos_sessions WHERE user_id=?", userId),
          sql(db, "DELETE FROM pos_device_credentials WHERE user_id=?", userId)
        ] : []
      ]);
      if (!updated.meta.changes) conflict("The user changed. Refresh and retry.");
    }
    return respond({ id: userId }, existing ? 200 : 201);
  } catch (error3) {
    if (String(error3).includes("UNIQUE constraint failed: users.email"))
      return respond({ error: "This email is already registered. Use another email for the additional user." }, 409);
    if (String(error3).includes("UNIQUE constraint failed: memberships.business_id, memberships.pos_username"))
      return respond({ error: "That POS username is already in use in this business." }, 409);
    return errorResponse(error3);
  }
}
__name(adminUsers, "adminUsers");

// worker/index.ts
import { WorkerEntrypoint } from "cloudflare:workers";

// ../../shared/distanceMeters.ts
function distanceMeters(latitude, longitude, customerLatitude, customerLongitude) {
  const radians = Math.PI / 180;
  const haversine = Math.sin((customerLatitude - latitude) * radians / 2) ** 2 + Math.cos(latitude * radians) * Math.cos(customerLatitude * radians) * Math.sin((customerLongitude - longitude) * radians / 2) ** 2;
  return 2 * 63710088e-1 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
__name(distanceMeters, "distanceMeters");

// ../../shared/menuFonts.ts
var menuKhmerFonts = ["Noto Sans Khmer", "Battambang"];
var defaultMenuKhmerFont = menuKhmerFonts[0];

// ../../shared/qrDesign.ts
var defaultQrFooterText = "\u178A\u17B6\u1780\u17CB\u1780\u17B6\u1798\u17C1\u179A\u17C9\u17B6\u179A\u1794\u179F\u17CB\u17A2\u17D2\u1793\u1780\u178F\u1798\u17D2\u179A\u1784\u17CB\u1791\u17C5\u179B\u17C1\u1781\u1780\u17BC\u178A QR";
var maxQrFooterTextLength = 120;
var maxQrTablePrefixLength = 32;

// worker/catalogScope.ts
var branchOrderOverrides = {
  latitude: "CASE WHEN branch.has_order_location_override=1 THEN branch.latitude END",
  longitude: "CASE WHEN branch.has_order_location_override=1 THEN branch.longitude END",
  radius: "CASE WHEN branch.use_business_order_radius=0 THEN branch.order_radius_meters END"
};
var branchOrderPolicy = {
  latitude: `COALESCE(${branchOrderOverrides.latitude}, business.latitude)`,
  longitude: `COALESCE(${branchOrderOverrides.longitude}, business.longitude)`,
  radius: `COALESCE(${branchOrderOverrides.radius}, business.order_radius_meters)`,
  enabled: "COALESCE(branch.enable_submit_order, business.enable_submit_order)"
};
var branchOrderColumns = `
  ${branchOrderPolicy.latitude} AS latitude,
  ${branchOrderPolicy.longitude} AS longitude,
  ${branchOrderPolicy.radius} AS orderRadiusMeters,
  ${branchOrderPolicy.enabled} AS enableSubmitOrder`;
var branchSelect = `SELECT branch.id,branch.slug,branch.name,branch.is_default AS isDefault,branch.is_active AS isActive,
  CASE WHEN branch.is_default=1 THEN business.address ELSE branch.address END AS address,
  CASE WHEN branch.is_default=1 THEN business.phone ELSE branch.phone END AS phone,
  CASE WHEN branch.is_default=1 THEN business.map_url ELSE branch.map_url END AS mapUrl,
  ${branchOrderOverrides.latitude} AS latitude,${branchOrderOverrides.longitude} AS longitude,
  branch.enable_submit_order AS enableSubmitOrder,${branchOrderOverrides.radius} AS orderRadiusMeters
  FROM branches branch JOIN businesses business ON business.id=branch.business_id`;
function listBranches(db, businessId) {
  return db.prepare(
    `${branchSelect} WHERE branch.business_id=? ORDER BY branch.is_default DESC,branch.name,branch.id`
  ).bind(businessId).all();
}
__name(listBranches, "listBranches");
async function ownsPortionBranches(db, businessId, portions2) {
  const ids = [...new Set(portions2.map((portion) => portion.branchId).filter(Boolean))];
  if (!ids.length) return true;
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM branches
    WHERE business_id=? AND id IN (SELECT value FROM json_each(?))`).bind(businessId, JSON.stringify(ids)).first("count");
  return count === ids.length;
}
__name(ownsPortionBranches, "ownsPortionBranches");
function findBranch(db, businessId, slug2) {
  return db.prepare(
    `${branchSelect} WHERE branch.business_id=?
    AND ((? IS NULL AND branch.is_default=1) OR branch.slug=?)`
  ).bind(businessId, slug2, slug2).first();
}
__name(findBranch, "findBranch");
function findMenuRoot(db, businessId, slug2) {
  return db.prepare(
    `WITH RECURSIVE target AS (
        SELECT id,slug,parent_id,is_active FROM menus
        WHERE business_id=?1 AND slug=?2 AND deleted_in_admin=0
          AND (parent_id IS NULL OR was_qr_root=1)
      ), menu_path(id,parent_id,is_active) AS (
        SELECT id,parent_id,is_active FROM target
        UNION
        SELECT parent.id,parent.parent_id,parent.is_active
        FROM menus parent JOIN menu_path child ON child.parent_id=parent.id
        WHERE parent.business_id=?1
      )
      SELECT id,slug,NOT EXISTS (SELECT 1 FROM menu_path WHERE is_active=0) AS isActive
      FROM target`
  ).bind(businessId, slug2).first();
}
__name(findMenuRoot, "findMenuRoot");
function firstActiveMenuRoot(db, businessId) {
  return db.prepare(
    `SELECT id,slug,is_active AS isActive FROM menus
     WHERE business_id=? AND parent_id IS NULL AND is_active=1 AND deleted_in_admin=0
     ORDER BY sort_order,COALESCE(NULLIF(name_km,''),NULLIF(name_en,''),name_zh),id
     LIMIT 1`
  ).bind(businessId).first();
}
__name(firstActiveMenuRoot, "firstActiveMenuRoot");
var visibleMenuIds = `WITH RECURSIVE visible_menu_ids(id) AS (
  SELECT section.id FROM menus root
  JOIN menus section ON section.business_id=root.business_id
    AND (section.parent_id=root.id OR (root.parent_id IS NOT NULL AND section.id=root.id))
  WHERE root.business_id=? AND root.id=? AND (root.parent_id IS NULL OR root.was_qr_root=1)
    AND root.is_active=1 AND section.is_active=1
  UNION
  SELECT child.id FROM menus child JOIN visible_menu_ids parent ON child.parent_id=parent.id
  WHERE child.business_id=? AND child.is_active=1
)`;
var visibleMenuAssignments = `FROM menu_products assignment
  JOIN visible_menu_ids visible ON visible.id=assignment.menu_id
  WHERE assignment.business_id=product.business_id AND assignment.product_id=product.id`;
function orderMenuSections(rows) {
  const children = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const siblings = children.get(row.parentId) ?? [];
    siblings.push(row);
    children.set(row.parentId, siblings);
  }
  const sorted = [];
  function append(parentId) {
    for (const row of children.get(parentId) ?? []) {
      sorted.push(row);
      append(row.id);
    }
  }
  __name(append, "append");
  append(null);
  return sorted;
}
__name(orderMenuSections, "orderMenuSections");

// worker/webhookEvents.ts
var maxWebhookBodyBytes = 256 * 1024;
var orderLine = `json_object(
  'id', line.id, 'lineNumber', line.line_number, 'productId', line.product_id,
  'productCode', line.product_code, 'productName', line.product_name,
  'quantity', line.quantity, 'price', line.price, 'totalAmount', line.total_amount,
  'portionId', line.portion_id, 'portionName', line.portion_name,
  'modifiers', json(line.modifiers), 'note', line.note
)`;
var lineTextBytes = ["id", "product_id", "product_code", "product_name", "portion_id", "portion_name", "modifiers", "note"].map((column) => `length(CAST(COALESCE(line.${column}, '') AS BLOB))`).join(" + ");
var orderItems = `CASE WHEN (
  SELECT COALESCE(sum(CASE WHEN ${lineTextBytes} > ${maxWebhookBodyBytes} THEN ${maxWebhookBodyBytes} + 1
    ELSE length(CAST(${orderLine} AS BLOB)) + 1 END), 0)
  FROM order_products line WHERE line.order_id=r.id
) < ${maxWebhookBodyBytes}
THEN (SELECT json_group_array(${orderLine} ORDER BY line.line_number) FROM order_products line WHERE line.order_id=r.id)
ELSE NULL END`;
var records = {
  orders: `json_object(
    'id', r.id, 'orderNumber', r.order_number, 'status', r.status,
    'postingDate', r.posting_date, 'submittedAt', r.submitted_at, 'tableId', r.table_id,
    'menuId', r.menu_id, 'totalQuantity', r.total_quantity, 'totalAmount', r.total_amount,
    'currency', r.currency, 'note', r.note,
    'items', json(${orderItems})
  )`,
  bookings: `json_patch(json_object(
    'id', r.id, 'status', r.status, 'arrivalDate', r.arrival_date, 'arrivalTime', r.arrival_time,
    'arrivalAt', r.arrival_at, 'timezone', r.timezone, 'pax', r.pax, 'preference', r.preference,
    'createdAt', r.created_at, 'updatedAt', r.updated_at
  ), CASE WHEN EXISTS (SELECT 1 FROM matching_rules WHERE include_contact=1
    AND business_id=r.business_id AND branch_id=r.branch_id)
    THEN json_object('guestName', r.guest_name, 'guestPhone', r.guest_phone,
      'preferenceText', r.preference_text, 'note', r.note)
    ELSE '{}' END)`
};
function captureWebhook(db, table, event, predicate, bindings, nextStatus) {
  const oldRecord = records[table];
  const newRecord = event === "updated" ? `json_set(${oldRecord}, '$.status', ${nextStatus}${table === "bookings" ? ", '$.updatedAt', CURRENT_TIMESTAMP" : ""})` : oldRecord;
  return db.prepare(`
    WITH matching_rules AS (
      SELECT rule.business_id, rule.branch_id, config.include_contact
      FROM branch_webhooks rule
      JOIN branch_webhook_revisions config ON config.webhook_id=rule.id AND config.revision=rule.revision
      WHERE rule.enabled=1 AND rule.archived=0 AND config.table_key='${table}' AND config.event='${event}'
    )
    INSERT INTO branch_webhook_events
      (business_id, branch_id, table_key, record_id, event, record_json, previous_json)
    SELECT r.business_id, r.branch_id, '${table}', r.id, '${event}', ${newRecord},
      ${event === "updated" ? oldRecord : "NULL"}
    FROM ${table} AS r
    WHERE (${predicate}) AND EXISTS (
      SELECT 1 FROM matching_rules WHERE business_id=r.business_id AND branch_id=r.branch_id
    )
  `).bind(...bindings);
}
__name(captureWebhook, "captureWebhook");

// worker/orderStatus.ts
var orderStatuses = [
  "submitted",
  "accepted",
  "completed",
  "cancelled"
];
function isOrderStatus(value) {
  return orderStatuses.some((status) => status === value);
}
__name(isOrderStatus, "isOrderStatus");
function isOrderStatusUpdate(value) {
  return value !== "submitted" && isOrderStatus(value);
}
__name(isOrderStatusUpdate, "isOrderStatusUpdate");
async function updateOrderStatus(db, businessId, orderId, status) {
  const transition = `business_id=?2 AND id=?3 AND (
    (status='submitted' AND ?1 IN ('accepted','cancelled'))
    OR (status='accepted' AND ?1 IN ('completed','cancelled'))
  )`;
  const bindings = [status, businessId, orderId];
  const [, updated, current] = await db.batch([
    captureWebhook(db, "orders", "updated", transition, bindings, "?1"),
    db.prepare(`UPDATE orders SET status=?1 WHERE ${transition}`).bind(...bindings),
    db.prepare("SELECT status FROM orders WHERE business_id=? AND id=?").bind(businessId, orderId)
  ]);
  const order = current.results[0];
  return order && { ...order, changed: Boolean(updated.meta.changes) };
}
__name(updateOrderStatus, "updateOrderStatus");
async function confirmOrderProducts(db, businessId, orderId, products) {
  const transition = `business_id=?1 AND id=?2 AND status='submitted'
    AND (SELECT COUNT(*) FROM order_products WHERE order_id=?2)=json_array_length(?3)
    AND NOT EXISTS (
      SELECT 1 FROM json_each(?3) AS decision
      WHERE NOT EXISTS (
        SELECT 1 FROM order_products
        WHERE order_id=?2 AND id=json_extract(decision.value,'$.id')
      )
    )`;
  const bindings = [businessId, orderId, JSON.stringify(products)];
  const [, , updated, current, lines] = await db.batch([
    captureWebhook(db, "orders", "updated", transition, bindings, "'accepted'"),
    db.prepare(
      `UPDATE order_products SET status=(
           SELECT json_extract(decision.value,'$.status') FROM json_each(?3) AS decision
           WHERE json_extract(decision.value,'$.id')=order_products.id
         )
         WHERE order_id=?2 AND EXISTS (SELECT 1 FROM orders WHERE ${transition})`
    ).bind(...bindings),
    db.prepare(`UPDATE orders SET status='accepted' WHERE ${transition}`).bind(...bindings),
    db.prepare("SELECT status FROM orders WHERE business_id=? AND id=?").bind(businessId, orderId),
    db.prepare(
      `SELECT line.id, line.status FROM order_products line
         JOIN orders o ON o.id=line.order_id WHERE o.business_id=? AND o.id=?
         ORDER BY line.line_number`
    ).bind(businessId, orderId)
  ]);
  const order = current.results[0];
  if (!order) return null;
  const decisionsById = new Map(products.map(({ id: id2, status }) => [id2, status]));
  const matches = lines.results.length === products.length && lines.results.every(({ id: id2, status }) => decisionsById.get(String(id2)) === status);
  return {
    status: order.status,
    changed: Boolean(updated.meta.changes),
    matches,
    products: lines.results
  };
}
__name(confirmOrderProducts, "confirmOrderProducts");

// worker/orderEvents.ts
import { DurableObject } from "cloudflare:workers";

// worker/posSync.ts
var MAX_BYTES = 8 * 1024 * 1024;
var MAX_PRICE = 1e12;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var RECORD_ID = /^[a-zA-Z0-9_-]{1,80}$/;
var has = /* @__PURE__ */ __name((row, key) => Object.prototype.hasOwnProperty.call(row, key), "has");
var response = /* @__PURE__ */ __name((body, status = 200, extra = {}) => Response.json(body, {
  status,
  headers: { "cache-control": "private, no-store", ...extra }
}), "response");
var SyncError = class extends Error {
  constructor(message, status = 400, code = "INVALID_SYNC_DATA") {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
  static {
    __name(this, "SyncError");
  }
};
function invalid2(field, message) {
  throw new SyncError(
    `${snakeCase(field)}: ${message.replace(
      /\b(?:syncId|sourceUpdatedAt|nameKm|priceCents|priceEntries)\b/g,
      snakeCase
    )}`
  );
}
__name(invalid2, "invalid");
function object2(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid2(field, "must be an object");
  return value;
}
__name(object2, "object");
function knownFields(row, fields2, field) {
  const unknown = Object.keys(row).find((key) => !fields2.includes(key));
  if (unknown)
    throw new SyncError(
      `${field}.${unknown}: is not a supported writable field`
    );
}
__name(knownFields, "knownFields");
function snakeCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
__name(snakeCase, "snakeCase");
function syncFields(row, internalFields, wireNames = {}) {
  const fields2 = {};
  for (const key of internalFields) {
    const wireName = wireNames[key] ?? snakeCase(key);
    if (has(row, wireName)) fields2[key] = row[wireName];
  }
  return fields2;
}
__name(syncFields, "syncFields");
function text(value, field, max, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string") invalid2(field, "must be a string");
  const result = value.trim();
  if (result.length > max) invalid2(field, `must be at most ${max} characters`);
  return result;
}
__name(text, "text");
function number(value, field, max = MAX_PRICE, min = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    invalid2(field, `must be a number between ${min} and ${max}`);
  return value;
}
__name(number, "number");
function integer2(value, field, max = 999999) {
  const result = number(value, field, max);
  if (!Number.isInteger(result)) invalid2(field, "must be a whole number");
  return result;
}
__name(integer2, "integer");
function sortOrder(value) {
  if (typeof value !== "number") return 999999;
  if (value < 0) return 0;
  return Number.isInteger(value) && value <= 999999 ? value : 999999;
}
__name(sortOrder, "sortOrder");
function flag(value, field) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  return invalid2(field, "must be true, false, 1 or 0");
}
__name(flag, "flag");
function uuid(value, field) {
  if (typeof value !== "string" || !UUID.test(value))
    invalid2(field, "must be a hyphenated UUID");
  return value.toLowerCase();
}
__name(uuid, "uuid");
function reference(value, field) {
  if (typeof value !== "string" || !RECORD_ID.test(value))
    invalid2(field, "must be a record ID");
  return UUID.test(value) ? value.toLowerCase() : value;
}
__name(reference, "reference");
function timestamp(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value
  ) || !Number.isFinite(Date.parse(value)))
    invalid2(field, "must be an ISO 8601 timestamp with a timezone");
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth)
    invalid2(field, "contains an invalid calendar date");
  return new Date(value).toISOString();
}
__name(timestamp, "timestamp");
function imageUrl(value, field) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") invalid2(field, "must be a string");
  const result = value.trim();
  return result.length > 2048 ? null : result || null;
}
__name(imageUrl, "imageUrl");
function array(value, field, max) {
  if (!Array.isArray(value) || value.length > max)
    invalid2(field, `must be an array with at most ${max} entries`);
  return value;
}
__name(array, "array");
function unique(values, field) {
  if (new Set(values).size !== values.length)
    invalid2(field, "contains duplicate IDs");
}
__name(unique, "unique");
async function hash(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    )
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
async function readBody(request, limit = MAX_BYTES) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new SyncError(
      "Content-Type must be application/json",
      415,
      "UNSUPPORTED_MEDIA_TYPE"
    );
  if (Number(request.headers.get("content-length")) > limit)
    throw new SyncError("Sync request is too large", 413, "SYNC_TOO_LARGE");
  if (!request.body) invalid2("body", "is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let size = 0;
  let result = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new SyncError("Sync request is too large", 413, "SYNC_TOO_LARGE");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error3) {
    if (error3 instanceof SyncError) throw error3;
    throw new SyncError("Request body must contain valid UTF-8 JSON");
  } finally {
    reader.releaseLock();
  }
}
__name(readBody, "readBody");
function parseJson(raw) {
  try {
    return object2(JSON.parse(raw), "body");
  } catch (error3) {
    if (error3 instanceof SyncError) throw error3;
    throw new SyncError("Request body must contain valid JSON");
  }
}
__name(parseJson, "parseJson");
async function readPosJson(request, limit) {
  return parseJson(await readBody(request, limit));
}
__name(readPosJson, "readPosJson");
function handled(error3) {
  return error3 instanceof SyncError ? response({ error: error3.message, code: error3.code }, error3.status) : null;
}
__name(handled, "handled");
async function getPosIntegration(env, businessId) {
  return env.DB.prepare(
    `SELECT name,key_prefix AS keyPrefix,last_synced_at AS lastSyncedAt,
     last_source_updated_at AS lastSourceUpdatedAt,created_at AS createdAt
     FROM pos_integrations WHERE business_id=?`
  ).bind(businessId).first();
}
__name(getPosIntegration, "getPosIntegration");
async function issuePosApiKey(env, businessId, name, audit) {
  const apiKey = `pos_${[...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const write = env.DB.prepare(
    `INSERT INTO pos_integrations (business_id,name,token_hash,key_prefix)
     VALUES (?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET
     name=excluded.name,token_hash=excluded.token_hash,key_prefix=excluded.key_prefix,
     catalog_version=pos_integrations.catalog_version+1,updated_at=CURRENT_TIMESTAMP`
  ).bind(businessId, name, await hash(apiKey), apiKey.slice(0, 12));
  await env.DB.batch(audit ? [write, audit] : [write]);
  return {
    message: "POS API key created. Store it securely; it is shown only once.",
    apiKey
  };
}
__name(issuePosApiKey, "issuePosApiKey");
async function revokePosIntegration(env, businessId, audit) {
  const write = env.DB.prepare(
    "DELETE FROM pos_integrations WHERE business_id=?"
  ).bind(businessId);
  await env.DB.batch(audit ? [write, audit] : [write]);
  return { message: "POS integration disconnected." };
}
__name(revokePosIntegration, "revokePosIntegration");
async function handlePosIntegration(request, env, auth) {
  try {
    if (auth.role !== "owner")
      return response({ error: "Owner access is required" }, 403);
    if (request.method === "GET") {
      const integration = await getPosIntegration(env, auth.businessId);
      return response({ integration });
    }
    if (request.method === "PUT") {
      const body = parseJson(await readBody(request, 4096));
      knownFields(body, ["name"], "body");
      const name = has(body, "name") ? text(body.name, "name", 120) : "POS";
      if (!name) invalid2("name", "cannot be empty");
      return response(await issuePosApiKey(env, auth.businessId, name));
    }
    if (request.method === "DELETE") {
      return response(await revokePosIntegration(env, auth.businessId));
    }
    return response({ error: "Method not allowed" }, 405, {
      allow: "GET, PUT, DELETE"
    });
  } catch (error3) {
    const result = handled(error3);
    if (result) return result;
    throw error3;
  }
}
__name(handlePosIntegration, "handlePosIntegration");
function localized(row, existing, field) {
  const result = {};
  for (const [api, column] of [
    ["name", "name"],
    ["nameKm", "name_km"],
    ["nameEn", "name_en"],
    ["nameZh", "name_zh"]
  ]) {
    result[column] = has(row, api) ? text(row[api], `${field}.${api}`, 300, api !== "name") : existing[column] ?? null;
  }
  if (!result.name)
    result.name = result.name_km || result.name_en || result.name_zh;
  if (!result.name)
    invalid2(
      field,
      "a new record needs name or nameKm (or another translated name)"
    );
  if (!result.name_km) result.name_km = result.name;
  return result;
}
__name(localized, "localized");
function slug(row, existing, names, id2, field) {
  if (has(row, "slug")) {
    const value = text(row.slug, `${field}.slug`, 200, true);
    if (value) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
        invalid2(
          `${field}.slug`,
          "must contain lowercase letters, digits and single hyphens"
        );
      return value;
    }
  }
  if (existing.slug) return String(existing.slug);
  const prefix = String(names.name_en || names.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  return `${prefix || "pos"}-${id2}`;
}
__name(slug, "slug");
function nullableNumber(row, existing, api, column, field, max, whole = false) {
  if (!has(row, api)) return existing[column] ?? null;
  return row[api] === null ? null : whole ? integer2(row[api], `${field}.${api}`, max) : number(row[api], `${field}.${api}`, max);
}
__name(nullableNumber, "nullableNumber");
function label(row, field) {
  const result = {
    labelKm: text(row.labelKm, `${field}.labelKm`, 120),
    labelEn: has(row, "labelEn") ? text(row.labelEn, `${field}.labelEn`, 120) : "",
    labelZh: has(row, "labelZh") ? text(row.labelZh, `${field}.labelZh`, 120) : ""
  };
  if (!result.labelKm) invalid2(`${field}.labelKm`, "is required");
  return result;
}
__name(label, "label");
function optionId(row, field) {
  if (!has(row, "id")) return crypto.randomUUID();
  const value = reference(row.id, `${field}.id`);
  if (value === "base")
    invalid2(`${field}.id`, "base is reserved for the base price");
  return value;
}
__name(optionId, "optionId");
function portions(value, field) {
  const result = array(value, field, 20).map((entry, index) => {
    const path = `${field}[${index}]`;
    const row = syncFields(
      object2(entry, path),
      [
        "id",
        "labelKm",
        "labelEn",
        "labelZh",
        "priceCents",
        "branchId",
        "priceRule",
        "unit"
      ],
      { priceCents: "price" }
    );
    return {
      id: optionId(row, path),
      ...label(row, path),
      priceCents: number(row.priceCents, `${path}.price`),
      ...has(row, "branchId") && {
        branchId: row.branchId === null ? null : reference(row.branchId, `${path}.branchId`)
      },
      priceRule: has(row, "priceRule") ? text(row.priceRule, `${path}.price_rule`, 120) : "",
      unit: has(row, "unit") ? text(row.unit, `${path}.unit`, 40) : ""
    };
  });
  unique(
    result.map((row) => row.id),
    field
  );
  return result;
}
__name(portions, "portions");
function modifiers(value, field) {
  const result = array(value, field, 12).map((entry, index) => {
    const path = `${field}[${index}]`;
    const row = syncFields(
      object2(entry, path),
      [
        "id",
        "labelKm",
        "labelEn",
        "labelZh",
        "required",
        "multiple",
        "options"
      ]
    );
    const options = array(row.options, `${path}.options`, 30).map(
      (entry2, index2) => {
        const optionPath = `${path}.options[${index2}]`;
        const option = syncFields(
          object2(entry2, optionPath),
          ["id", "labelKm", "labelEn", "labelZh", "priceCents", "prefix"],
          { priceCents: "price" }
        );
        return {
          id: optionId(option, optionPath),
          ...label(option, optionPath),
          priceCents: option.priceCents == null ? null : number(
            option.priceCents,
            `${optionPath}.price`,
            MAX_PRICE,
            -MAX_PRICE
          ),
          prefix: has(option, "prefix") ? text(option.prefix, `${optionPath}.prefix`, 40) : ""
        };
      }
    );
    if (!options.length)
      invalid2(`${path}.options`, "must contain at least one option");
    unique(
      options.map((option) => option.id),
      `${path}.options`
    );
    return {
      id: optionId(row, path),
      ...label(row, path),
      required: has(row, "required") ? Boolean(flag(row.required, `${path}.required`)) : false,
      multiple: has(row, "multiple") ? Boolean(flag(row.multiple, `${path}.multiple`)) : false,
      options
    };
  });
  unique(
    result.map((row) => String(row.id)),
    field
  );
  return result;
}
__name(modifiers, "modifiers");
function photo(row, existing, api, column, field, media, env) {
  if (has(row, api) && row[api] !== null && row[api] !== "") {
    const mediaId = reference(row[api], `${field}.${api}`);
    const owned = media.get(mediaId);
    if (!owned)
      invalid2(`${field}.${api}`, "must reference media owned by this business");
    const base = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "");
    return {
      mediaId,
      image_url: base ? `${base}/${String(owned.object_key).split("/").map(encodeURIComponent).join("/")}` : `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`
    };
  }
  if (has(row, "imageUrl"))
    return {
      image_url: imageUrl(row.imageUrl, `${field}.imageUrl`),
      mediaId: null
    };
  if (has(row, api)) return { image_url: null, mediaId: null };
  return {
    image_url: existing.image_url == null ? null : String(existing.image_url),
    mediaId: existing[column] == null ? null : String(existing[column])
  };
}
__name(photo, "photo");
var CATEGORY_FIELDS = [
  "id",
  "parentId",
  "name",
  "nameKm",
  "nameEn",
  "nameZh",
  "slug",
  "imageUrl",
  "imageMediaId",
  "sortOrder",
  "isActive",
  "createdAt"
];
var PRODUCT_FIELDS = [
  "id",
  "category_id",
  "code",
  "name",
  "nameKm",
  "nameEn",
  "nameZh",
  "slug",
  "description",
  "priceCents",
  "maxPrice",
  "unit",
  "portions",
  "modifierGroups",
  "imageUrl",
  "primaryMediaId",
  "mediaIds",
  "calories",
  "prepMinutes",
  "rating",
  "isFeatured",
  "isAvailable",
  "sortOrder",
  "createdAt",
  "priceEntries"
];
function categoriesForSync(input, existing, media, env) {
  return input.map((inputRow, index) => {
    const field = `categories[${index}]`;
    const row = syncFields(inputRow, CATEGORY_FIELDS);
    const id2 = uuid(row.id, `${field}.id`);
    const old = existing.get(id2) || {};
    const names = localized(row, old, field);
    if (has(row, "imageUrl") && row.imageMediaId)
      invalid2(field, "send image_url or image_media_id, not both");
    const image = photo(
      row,
      old,
      "imageMediaId",
      "image_media_id",
      field,
      media,
      env
    );
    return {
      id: id2,
      ...names,
      slug: slug(row, old, names, id2, field),
      parent_id: has(row, "parentId") ? row.parentId === null ? null : reference(row.parentId, `${field}.parentId`) : old.parent_id ?? null,
      image_url: image.image_url,
      image_media_id: image.mediaId,
      sort_order: has(row, "sortOrder") ? sortOrder(row.sortOrder) : old.sort_order ?? 0,
      is_active: has(row, "isActive") ? flag(row.isActive, `${field}.isActive`) : old.is_active ?? 1,
      created_at: has(row, "createdAt") ? timestamp(row.createdAt, `${field}.createdAt`) : old.created_at ?? null
    };
  });
}
__name(categoriesForSync, "categoriesForSync");
function productsForSync(input, existing, gallery, media, priceLists, normalId, env, sourceTimestamp) {
  return input.map((inputRow, index) => {
    const field = `products[${index}]`;
    const row = syncFields(inputRow, PRODUCT_FIELDS, {
      priceCents: "price"
    });
    const id2 = uuid(row.id, `${field}.id`);
    const old = existing.get(id2) || {};
    const names = localized(row, old, field);
    const productPortions = has(row, "portions") ? portions(row.portions, `${field}.portions`) : JSON.parse(String(old.portions_json || "[]"));
    const productModifiers = has(row, "modifierGroups") ? modifiers(row.modifierGroups, `${field}.modifierGroups`) : JSON.parse(String(old.modifier_groups_json || "[]"));
    const portionsJson = JSON.stringify(productPortions);
    const modifiersJson = JSON.stringify(productModifiers);
    if (portionsJson.length + modifiersJson.length > 64e3)
      invalid2(field, "product options exceed 64,000 characters");
    if (!productPortions.length && !has(row, "priceCents") && !has(old, "price_cents"))
      invalid2(
        `${field}.price`,
        "is required for a new product without portions"
      );
    const base = has(row, "priceCents") ? number(row.priceCents, `${field}.price`) : Number(old.price_cents || 0);
    const minPrice = productPortions.length ? Math.min(...productPortions.map((portion) => portion.priceCents)) : base;
    const maxPrice = productPortions.length ? Math.max(...productPortions.map((portion) => portion.priceCents)) : base;
    if (has(row, "maxPrice") && number(row.maxPrice, `${field}.maxPrice`) !== maxPrice)
      invalid2(
        `${field}.maxPrice`,
        "must match the maximum portion price, or price when there are no portions"
      );
    const validTargets = new Set(
      productPortions.length ? productPortions.map((portion) => portion.id) : ["base"]
    );
    const entries = has(row, "priceEntries") ? array(row.priceEntries, `${field}.priceEntries`, 200).map(
      (entry, index2) => {
        const path = `${field}.priceEntries[${index2}]`;
        const price = syncFields(
          object2(entry, path),
          ["priceListId", "targetKey", "priceCents"]
        );
        const priceListId = reference(
          price.priceListId,
          `${path}.priceListId`
        );
        const targetKey = reference(price.targetKey, `${path}.targetKey`);
        if (!priceLists.has(priceListId))
          invalid2(
            `${path}.priceListId`,
            "price list is not owned by this business or is archived"
          );
        if (!validTargets.has(targetKey))
          invalid2(
            `${path}.targetKey`,
            "must be base or an existing portion ID"
          );
        if (priceListId === normalId)
          invalid2(
            `${path}.priceListId`,
            "Normal Rate is set through price or portions, not priceEntries"
          );
        return {
          priceListId,
          targetKey,
          priceCents: price.priceCents === null ? null : number(price.priceCents, `${path}.priceCents`)
        };
      }
    ) : [];
    unique(
      entries.map((entry) => `${entry.priceListId}:${entry.targetKey}`),
      `${field}.priceEntries`
    );
    let mediaIds = has(row, "mediaIds") ? array(row.mediaIds, `${field}.mediaIds`, 5).map(
      (value) => reference(value, `${field}.mediaIds`)
    ) : [...gallery.get(id2) || []];
    unique(mediaIds, `${field}.mediaIds`);
    let imageRow = row;
    if (has(row, "mediaIds") && !has(row, "primaryMediaId") && !has(row, "imageUrl")) {
      imageRow = {
        ...row,
        primaryMediaId: mediaIds.includes(String(old.primary_media_id)) ? old.primary_media_id : mediaIds[0] || null
      };
    }
    const image = photo(
      imageRow,
      old,
      "primaryMediaId",
      "primary_media_id",
      field,
      media,
      env
    );
    if (image.mediaId && !mediaIds.includes(image.mediaId))
      mediaIds.unshift(image.mediaId);
    if (has(row, "imageUrl") && !image.mediaId && !has(row, "mediaIds"))
      mediaIds = [];
    if (mediaIds.length > 5 || mediaIds.some((mediaId) => !media.has(mediaId)))
      invalid2(
        `${field}.mediaIds`,
        "must contain at most 5 media IDs owned by this business"
      );
    if (has(row, "imageUrl") && image.mediaId)
      invalid2(field, "send image_url or primary_media_id, not both");
    const code = has(row, "code") ? text(row.code, `${field}.code`, 64, true) || null : old.code ?? null;
    return {
      id: id2,
      ...names,
      category_id: has(row, "category_id") ? reference(row.category_id, `${field}.category_id`) : reference(old.category_id, `${field}.category_id`),
      code,
      slug: slug(row, old, names, id2, field),
      description: has(row, "description") ? text(row.description, `${field}.description`, 2e4) : old.description ?? "",
      price_cents: minPrice,
      max_price: maxPrice,
      unit: has(row, "unit") ? text(row.unit, `${field}.unit`, 40) : old.unit ?? "",
      portions_json: portionsJson,
      modifier_groups_json: modifiersJson,
      image_url: image.image_url,
      primary_media_id: image.mediaId,
      calories: nullableNumber(
        row,
        old,
        "calories",
        "calories",
        field,
        1e6,
        true
      ),
      prep_minutes: nullableNumber(
        row,
        old,
        "prepMinutes",
        "prep_minutes",
        field,
        999999,
        true
      ),
      rating: nullableNumber(row, old, "rating", "rating", field, 5),
      is_featured: has(row, "isFeatured") ? flag(row.isFeatured, `${field}.isFeatured`) : old.is_featured ?? 0,
      is_available: has(row, "isAvailable") ? flag(row.isAvailable, `${field}.isAvailable`) : old.is_available ?? 1,
      sort_order: has(row, "sortOrder") ? sortOrder(row.sortOrder) : old.sort_order ?? 0,
      created_at: has(row, "createdAt") ? timestamp(row.createdAt, `${field}.createdAt`) : old.created_at ?? null,
      pos_source_updated_at: sourceTimestamp ?? old.pos_source_updated_at ?? null,
      portions: productPortions,
      mediaIds,
      priceEntries: entries
    };
  });
}
__name(productsForSync, "productsForSync");
function validateGraph(categories, existing, products, kind = "category") {
  const parentField = kind === "menu" ? "menus.parentId" : "categories.parentId";
  const parents = new Map(
    existing.map((row) => [
      String(row.id),
      row.parent_id ? String(row.parent_id) : null
    ])
  );
  for (const row of categories)
    parents.set(String(row.id), row.parent_id ? String(row.parent_id) : null);
  const depths = /* @__PURE__ */ new Map();
  for (const category of categories) {
    const path = /* @__PURE__ */ new Set();
    let current = String(category.id);
    while (current) {
      if (!parents.has(current))
        invalid2(
          parentField,
          `parent ${kind} is not owned by this business or included in this sync`
        );
      if (path.has(current))
        invalid2(parentField, `${kind} hierarchy contains a cycle`);
      path.add(current);
      if (path.size > 32)
        invalid2(parentField, `${kind} hierarchy exceeds 32 levels`);
      current = parents.get(current) ?? null;
    }
    depths.set(String(category.id), path.size);
  }
  for (const product of products)
    if (!parents.has(product.category_id))
      invalid2(
        `products.${product.id}.category_id`,
        "category is not owned by this business or included in this sync"
      );
  return [...categories].sort(
    (a, b) => depths.get(String(a.id)) - depths.get(String(b.id))
  );
}
__name(validateGraph, "validateGraph");
function validateUnique(rows, existing, column, caseInsensitive = false) {
  const incoming = new Set(rows.map((row) => String(row.id)));
  const values = /* @__PURE__ */ new Map();
  for (const row of [
    ...existing.filter((row2) => !incoming.has(String(row2.id))),
    ...rows
  ]) {
    if (row[column] == null || row[column] === "") continue;
    const value = caseInsensitive ? String(row[column]).toLowerCase() : String(row[column]);
    if (values.has(value))
      throw new SyncError(
        `Duplicate ${column} in this business: ${value}`,
        409,
        "CATALOG_VALUE_CONFLICT"
      );
    values.set(value, String(row.id));
  }
}
__name(validateUnique, "validateUnique");
function rowChunks(rows) {
  const chunks = [];
  let current = [];
  let bytes = 2;
  const encoder4 = new TextEncoder();
  for (const row of rows) {
    const json4 = JSON.stringify(row);
    const length = encoder4.encode(json4).byteLength + 1;
    if (current.length && (current.length === 50 || bytes + length > 128 * 1024)) {
      chunks.push(`[${current.join(",")}]`);
      current = [];
      bytes = 2;
    }
    current.push(json4);
    bytes += length;
  }
  if (current.length) chunks.push(`[${current.join(",")}]`);
  return chunks;
}
__name(rowChunks, "rowChunks");
function upsertRows(env, table, rows, businessId, columns) {
  const storedRows = rows.map(
    (row) => Object.fromEntries(columns.map((column) => [column, row[column]]))
  );
  return rowChunks(storedRows).map(
    (chunk) => env.DB.prepare(
      `INSERT INTO ${table} (business_id,${columns.join(",")})
     SELECT ?,${columns.map(
        (column) => column === "created_at" ? "COALESCE(json_extract(value,'$.created_at'),CURRENT_TIMESTAMP)" : `json_extract(value,'$.${column}')`
      ).join(",")}
     FROM json_each(?) WHERE 1
     ON CONFLICT(id) DO UPDATE SET business_id=excluded.business_id,
     ${columns.filter(
        (column) => !["id", "created_at", "public_token"].includes(column)
      ).map((column) => `${column}=excluded.${column}`).join(",")}
     ${table === "categories" || table === "menus" ? "" : ",updated_at=CURRENT_TIMESTAMP"}`
    ).bind(businessId, chunk)
  );
}
__name(upsertRows, "upsertRows");
async function syncReceipt(env, businessId, syncId) {
  return env.DB.prepare(
    "SELECT payload_hash, skipped_tables_json FROM pos_sync_requests WHERE business_id=? AND sync_id=?"
  ).bind(businessId, syncId).first();
}
__name(syncReceipt, "syncReceipt");
function checkReceipt(previous, payloadHash) {
  if (previous === void 0) return false;
  if (previous !== payloadHash)
    throw new SyncError(
      "sync_id was already used for a different request body",
      409,
      "SYNC_ID_REUSED"
    );
  return true;
}
__name(checkReceipt, "checkReceipt");
function readSkippedTables(value) {
  return value === null ? [] : JSON.parse(value);
}
__name(readSkippedTables, "readSkippedTables");
function tableSyncSuccess(skipped) {
  return response({
    message: "POS tables synced successfully.",
    ...skipped.length > 0 && {
      warnings: skipped.map(({ id: id2, code }) => ({
        code: "DUPLICATE_TABLE_CODE",
        table_id: id2,
        table_code: code,
        message: `Table number ${code} is already used in this branch and could not be synced.`
      }))
    }
  });
}
__name(tableSyncSuccess, "tableSyncSuccess");
async function commitTableSync(env, identity, syncId, payloadHash, changes, skipped = []) {
  const { businessId } = identity;
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO pos_sync_requests (business_id,sync_id,payload_hash,source_updated_at,base_version,is_table_sync,skipped_tables_json) VALUES (?,?,?,?,?,1,?)"
      ).bind(
        businessId,
        syncId,
        payloadHash,
        (/* @__PURE__ */ new Date()).toISOString(),
        identity.catalogVersion,
        skipped.length ? JSON.stringify(skipped) : null
      ),
      ...changes,
      env.DB.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1,last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE business_id=?"
      ).bind(businessId)
    ]);
  } catch (error3) {
    const receipt = await syncReceipt(env, businessId, syncId);
    if (receipt && checkReceipt(receipt.payload_hash, payloadHash))
      return readSkippedTables(receipt.skipped_tables_json);
    const message = error3 instanceof Error ? error3.message : String(error3);
    if (/UNIQUE constraint failed: restaurant_tables\.business_id/.test(message))
      throw new SyncError(
        "Table codes changed during sync. Retry with the latest data.",
        409,
        "SYNC_CONFLICT"
      );
    if (/UNIQUE constraint/.test(message))
      throw new SyncError(
        "A table group name or table code already exists in this business",
        409,
        "TABLE_VALUE_CONFLICT"
      );
    if (/POS_SYNC_CONFLICT|CATALOG_TENANT_CONFLICT|FOREIGN KEY constraint/.test(
      message
    ))
      throw new SyncError(
        "The tables or POS connection changed during sync. Retry with the latest data.",
        409,
        "SYNC_CONFLICT"
      );
    throw error3;
  }
  return skipped;
}
__name(commitTableSync, "commitTableSync");
function tableArchiveWrites(env, businessId, input) {
  const archive = syncFields(
    object2(input, "archive"),
    ["tableId", "tableGroupId"]
  );
  const group = has(archive, "tableGroupId");
  if (group === has(archive, "tableId"))
    invalid2("archive", "include exactly one table_id or table_group_id");
  if (!group) {
    const id3 = reference(archive.tableId, "archive.table_id");
    return [
      env.DB.prepare(
        "UPDATE restaurant_tables SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE business_id=? AND id=? AND is_active=1"
      ).bind(businessId, id3)
    ];
  }
  const id2 = reference(archive.tableGroupId, "archive.table_group_id");
  return [
    env.DB.prepare(
      `UPDATE restaurant_tables SET is_active=0,updated_at=CURRENT_TIMESTAMP
       WHERE business_id=? AND is_active=1
       AND group_id=(SELECT id FROM table_groups WHERE id=? AND business_id=?)`
    ).bind(businessId, id2, businessId),
    env.DB.prepare(
      "UPDATE table_groups SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE business_id=? AND id=? AND is_active=1"
    ).bind(businessId, id2)
  ];
}
__name(tableArchiveWrites, "tableArchiveWrites");
function duplicateTableIds(requested, existing) {
  const codeKey = /* @__PURE__ */ __name((table) => JSON.stringify([
    table.branch_id,
    String(table.code).replace(/[A-Z]/g, (letter) => letter.toLowerCase())
  ]), "codeKey");
  const owners = new Map(
    [...existing].map(([id2, table]) => [codeKey(table), id2])
  );
  const claimed = /* @__PURE__ */ new Map();
  const skipped = /* @__PURE__ */ new Set();
  for (const table of requested) {
    const key = codeKey(table);
    const first = claimed.get(key);
    if (first && owners.get(key) !== table.id) {
      skipped.add(table.id);
    } else {
      if (first) skipped.add(first);
      claimed.set(key, table.id);
    }
  }
  const selected = new Set(claimed.values());
  const retained = [...existing].filter(([id2]) => !selected.has(id2));
  for (let i = 0; i < retained.length; i++) {
    const [ownerId, table] = retained[i];
    const claimant = claimed.get(codeKey(table));
    if (!claimant || claimant === ownerId || skipped.has(claimant)) continue;
    skipped.add(claimant);
    const old = existing.get(claimant);
    if (old) retained.push([claimant, old]);
  }
  return skipped;
}
__name(duplicateTableIds, "duplicateTableIds");
async function syncTables(env, identity, raw) {
  const { businessId } = identity;
  const body = syncFields(
    parseJson(raw),
    ["syncId", "tableGroups", "tables", "archive"]
  );
  const syncId = has(body, "syncId") ? uuid(body.syncId, "sync_id") : crypto.randomUUID();
  const payloadHash = await hash(raw);
  const receipt = await syncReceipt(env, businessId, syncId);
  if (receipt && checkReceipt(receipt.payload_hash, payloadHash))
    return tableSyncSuccess(readSkippedTables(receipt.skipped_tables_json));
  if (has(body, "archive")) {
    if (has(body, "tableGroups") || has(body, "tables"))
      invalid2(
        "body",
        "send archive in a separate request from table_groups and tables"
      );
    const skipped2 = await commitTableSync(
      env,
      identity,
      syncId,
      payloadHash,
      tableArchiveWrites(env, businessId, body.archive)
    );
    return tableSyncSuccess(skipped2);
  }
  const groupRows = array(body.tableGroups, "table_groups", 500).map(
    (entry, i) => syncFields(
      object2(entry, `table_groups[${i}]`),
      ["id", "name", "sortOrder", "isActive", "branchId"]
    )
  );
  const tableRows = array(body.tables, "tables", 1e3).map(
    (entry, i) => syncFields(
      object2(entry, `tables[${i}]`),
      ["id", "groupId", "code", "label", "sortOrder", "isActive"]
    )
  );
  if (!groupRows.length && !tableRows.length)
    invalid2("body", "include at least one table group or table");
  const groupIds = groupRows.map(
    (row, i) => reference(row.id, `table_groups[${i}].id`)
  );
  const tableIds = tableRows.map(
    (row, i) => reference(row.id, `tables[${i}].id`)
  );
  unique(groupIds, "table_groups");
  unique(tableIds, "tables");
  const [groupsResult, tablesResult, branchesResult] = await env.DB.batch([
    env.DB.prepare(
      "SELECT * FROM table_groups WHERE business_id=? OR id IN (SELECT value FROM json_each(?))"
    ).bind(businessId, JSON.stringify(groupIds)),
    env.DB.prepare(
      "SELECT * FROM restaurant_tables WHERE business_id=? OR id IN (SELECT value FROM json_each(?))"
    ).bind(businessId, JSON.stringify(tableIds)),
    env.DB.prepare("SELECT id,is_default,is_active FROM branches WHERE business_id=?").bind(businessId)
  ]);
  const existingGroups = groupsResult.results;
  const existingTables = tablesResult.results;
  if ([...existingGroups, ...existingTables].some(
    (row) => row.business_id !== businessId
  ))
    throw new SyncError(
      "A supplied ID already belongs to another business",
      409,
      "TABLE_ID_CONFLICT"
    );
  const groupsById = new Map(
    existingGroups.map((row) => [String(row.id), row])
  );
  const tablesById = new Map(
    existingTables.map((row) => [String(row.id), row])
  );
  const defaultBranchId = branchesResult.results.find((row) => row.is_default === 1)?.id;
  const groups = groupRows.map((row, i) => {
    const field = `table_groups[${i}]`;
    const id2 = groupIds[i];
    const old = groupsById.get(id2);
    if (!old) uuid(id2, `${field}.id`);
    const name = has(row, "name") ? text(row.name, `${field}.name`, 80) : old?.name;
    if (!name) invalid2(`${field}.name`, "is required");
    const branchId = has(row, "branchId") ? reference(row.branchId, `${field}.branchId`) : old?.branch_id ?? defaultBranchId;
    if (old ? branchId !== old.branch_id : !branchesResult.results.some((branch2) => branch2.id === branchId && branch2.is_active === 1))
      invalid2(`${field}.branchId`, "must use the existing group's branch or an active branch of this business");
    const group = {
      id: id2,
      name,
      branch_id: branchId,
      sort_order: has(row, "sortOrder") ? sortOrder(row.sortOrder) : old?.sort_order ?? 0,
      is_active: has(row, "isActive") ? flag(row.isActive, `${field}.isActive`) : old?.is_active ?? 1
    };
    groupsById.set(id2, group);
    return group;
  });
  const requestedTables = tableRows.map((row, i) => {
    const field = `tables[${i}]`;
    const id2 = tableIds[i];
    const old = tablesById.get(id2);
    if (!old) uuid(id2, `${field}.id`);
    const groupId = has(row, "groupId") ? reference(row.groupId, `${field}.groupId`) : old?.group_id;
    if (typeof groupId !== "string" || !groupsById.has(groupId))
      invalid2(
        `${field}.groupId`,
        "must reference a table group owned by this business or included in this sync"
      );
    const code = has(row, "code") ? text(row.code, `${field}.code`, 30) : old?.code;
    if (!code) invalid2(`${field}.code`, "is required");
    const label2 = has(row, "label") ? text(row.label, `${field}.label`, 80) : old?.label ?? code;
    if (!label2) invalid2(`${field}.label`, "must not be empty");
    const isActive = has(row, "isActive") ? flag(row.isActive, `${field}.isActive`) : old?.is_active ?? 1;
    if (isActive === 1 && groupsById.get(groupId)?.is_active !== 1)
      invalid2(`${field}.groupId`, "an active table requires an active group");
    const branchId = groupsById.get(groupId)?.branch_id;
    if (old && old.branch_id !== branchId)
      invalid2(`${field}.groupId`, "must be in the table's branch");
    const table = {
      id: id2,
      group_id: groupId,
      branch_id: branchId,
      code,
      label: label2,
      public_token: old?.public_token ?? `scan_${crypto.randomUUID().replaceAll("-", "")}`,
      sort_order: has(row, "sortOrder") ? sortOrder(row.sortOrder) : old?.sort_order ?? 0,
      is_active: isActive
    };
    return table;
  });
  const duplicateIds = duplicateTableIds(requestedTables, tablesById);
  const skipped = [];
  const tables2 = requestedTables.filter((table) => {
    if (duplicateIds.has(table.id)) {
      skipped.push({ id: table.id, code: String(table.code) });
      return false;
    }
    tablesById.set(table.id, table);
    return true;
  });
  const activeGroups = new Set(
    [...tablesById.values()].filter((row) => row.is_active === 1).map((row) => row.group_id)
  );
  if (groups.some((group) => group.is_active === 0 && activeGroups.has(group.id)))
    throw new SyncError(
      "Move or archive active tables before archiving their group",
      409,
      "TABLE_GROUP_IN_USE"
    );
  const placeholder2 = `pos-${crypto.randomUUID()}-`;
  const savedSkipped = await commitTableSync(env, identity, syncId, payloadHash, [
    // Allow a batch to swap two names or codes without a temporary unique conflict.
    env.DB.prepare(
      "UPDATE table_groups SET name=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))"
    ).bind(placeholder2, businessId, JSON.stringify(groupIds)),
    env.DB.prepare(
      "UPDATE restaurant_tables SET code=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))"
    ).bind(placeholder2, businessId, JSON.stringify(tables2.map((table) => table.id))),
    ...upsertRows(env, "table_groups", groups, businessId, [
      "id",
      "branch_id",
      "name",
      "sort_order",
      "is_active"
    ]),
    ...upsertRows(env, "restaurant_tables", tables2, businessId, [
      "id",
      "branch_id",
      "group_id",
      "code",
      "label",
      "public_token",
      "sort_order",
      "is_active"
    ])
  ], skipped);
  return tableSyncSuccess(savedSkipped);
}
__name(syncTables, "syncTables");
async function withPosIdentity(request, env, run) {
  try {
    const apiKey = request.headers.get("authorization")?.match(/^Bearer (pos_[0-9a-f]{64})$/)?.[1];
    if (!apiKey)
      return response(
        { error: "A POS API key is required", code: "INVALID_POS_KEY" },
        401
      );
    const tokenHash = await hash(apiKey);
    const identity = await env.DB.prepare(
      `SELECT i.business_id AS businessId,i.catalog_version AS catalogVersion,
       i.last_source_updated_at AS lastSourceUpdatedAt,i.last_menu_snapshot_at AS lastMenuSnapshotAt,
       i.last_menu_write_at AS lastMenuWriteAt,b.currency,b.timezone,
       sp.code AS subscriptionPlanCode,sp.name AS subscriptionPlanName,
       bs.source AS subscriptionSource,bs.status AS subscriptionStatus,
       bs.trial_ends_at AS trialEndsAt,bs.current_period_end_at AS currentPeriodEndAt
       FROM pos_integrations i JOIN businesses b ON b.id=i.business_id
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
       LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
       WHERE i.token_hash=? AND b.is_active=1`
    ).bind(tokenHash).first();
    if (!identity)
      return response(
        {
          error: "POS API key is invalid or disconnected",
          code: "INVALID_POS_KEY"
        },
        401
      );
    return await run(identity, tokenHash);
  } catch (error3) {
    const result = handled(error3);
    if (result) return result;
    throw error3;
  }
}
__name(withPosIdentity, "withPosIdentity");
async function menuSnapshotWrites(env, businessId, menuInput, linkInput, productIds, media) {
  const rows = array(menuInput, "menus", 1e3).map((entry, index) => {
    const field = `menus[${index}]`;
    return syncFields(object2(entry, field), CATEGORY_FIELDS.filter((key) => key !== "createdAt"));
  });
  const menuIds = rows.map((row, index) => uuid(row.id, `menus[${index}].id`));
  unique(menuIds, "menus");
  const links = array(linkInput, "menu_products", 1e4).map((entry, index) => {
    const field = `menu_products[${index}]`;
    const row = syncFields(object2(entry, field), ["menuId", "productId"]);
    return { menu_id: uuid(row.menuId, `${field}.menuId`), product_id: uuid(row.productId, `${field}.productId`) };
  });
  unique(links.map((link) => `${link.menu_id}:${link.product_id}`), "menu_products");
  const referencedProducts = [...new Set(links.map((link) => link.product_id))];
  const [existingMenus, existingProducts] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM menus WHERE business_id=? OR id IN (SELECT value FROM json_each(?))").bind(businessId, JSON.stringify(menuIds)),
    env.DB.prepare("SELECT id FROM products WHERE business_id=? AND id IN (SELECT value FROM json_each(?))").bind(businessId, JSON.stringify(referencedProducts))
  ]);
  const menusById = new Map(existingMenus.results.map((row) => [row.id, row]));
  const incomingProducts = /* @__PURE__ */ new Set([...productIds, ...existingProducts.results.map((row) => row.id)]);
  const normalized = rows.map((row, index) => {
    const field = `menus[${index}]`;
    const id2 = menuIds[index];
    const existing = menusById.get(id2);
    if (existing && (existing.business_id !== businessId || existing.source !== "pos"))
      throw new SyncError("A menu ID already belongs to another business or a local menu", 409, "CATALOG_ID_CONFLICT");
    const old = existing ?? {};
    const names = localized(row, old, field);
    const previousPosParent = old.admin_reparented === 1 ? old.pos_parent_id : old.parent_id;
    const parent = has(row, "parentId") ? row.parentId : previousPosParent;
    const parentId = parent == null ? null : uuid(parent, `${field}.parentId`);
    const menuSlug = slug(row, old, names, id2, field);
    if (existing && menuSlug !== old.slug)
      invalid2(field, "an existing menu must keep its slug");
    const image = photo(row, old, "imageMediaId", "image_media_id", field, media, env);
    const sort = has(row, "sortOrder") ? sortOrder(row.sortOrder) : old.sort_order ?? 0;
    const active = has(row, "isActive") ? flag(row.isActive, `${field}.isActive`) : 1;
    const edited = old.admin_active != null;
    return {
      id: id2,
      parent_id: parentId,
      pos_parent_id: parentId,
      slug: menuSlug,
      name_km: edited ? old.name_km : names.name_km,
      name_en: edited ? old.name_en : names.name_en ?? "",
      name_zh: edited ? old.name_zh : names.name_zh ?? "",
      image_media_id: edited ? old.image_media_id : image.mediaId,
      image_url: edited ? old.image_url : image.image_url,
      sort_order: edited || old.admin_sorted === 1 ? old.sort_order : sort,
      is_active: old.admin_active ?? active,
      source: "pos",
      was_qr_root: Number(old.was_qr_root === 1 || old.parent_id === null && parentId !== null)
    };
  });
  const incomingSections = new Set(
    normalized.filter((menu) => menu.parent_id !== null).map((menu) => menu.id)
  );
  for (const link of links) {
    if (!incomingSections.has(link.menu_id)) invalid2("menu_products.menuId", "must reference a submenu in this snapshot");
    if (!incomingProducts.has(link.product_id)) invalid2("menu_products.productId", "must reference a product owned by this business or included in this sync");
  }
  validateGraph(normalized, [], [], "menu");
  const effectiveMenus = normalized.map((menu) => {
    const existing = menusById.get(menu.id);
    return existing?.admin_reparented === 1 ? { ...menu, parent_id: existing.parent_id } : menu;
  });
  const ownedMenus = existingMenus.results.filter((row) => row.business_id === businessId);
  const sorted = validateGraph(effectiveMenus, ownedMenus, [], "menu");
  validateUnique(sorted, ownedMenus, "slug");
  const deletedMenuIds = new Set(existingMenus.results.filter((row) => row.business_id === businessId && row.deleted_in_admin === 1).map(({ id: id2 }) => String(id2)));
  const storedMenus = sorted.map((menu) => {
    const id2 = String(menu.id);
    const deleted = deletedMenuIds.has(id2) || deletedMenuIds.has(String(menu.parent_id ?? ""));
    if (deleted) deletedMenuIds.add(id2);
    return { ...menu, deleted_in_admin: Number(deleted), is_active: deleted ? 0 : menu.is_active };
  });
  const storedLinks = links.filter(({ menu_id }) => !deletedMenuIds.has(menu_id));
  return [
    ...upsertRows(env, "menus", storedMenus, businessId, [
      "id",
      "parent_id",
      "pos_parent_id",
      "slug",
      "name_km",
      "name_en",
      "name_zh",
      "image_media_id",
      "image_url",
      "sort_order",
      "is_active",
      "source",
      "deleted_in_admin",
      "was_qr_root"
    ]),
    // A branch moved under a deleted menu may still have older descendants absent from this snapshot.
    env.DB.prepare(`WITH RECURSIVE deleted_branch(id) AS (
        SELECT id FROM menus WHERE business_id=?1 AND deleted_in_admin=1
        UNION
        SELECT child.id FROM menus child JOIN deleted_branch ON child.parent_id=deleted_branch.id
        WHERE child.business_id=?1 AND child.source='pos'
      )
      UPDATE menus SET is_active=0,
        deleted_in_admin=CASE WHEN id IN (SELECT id FROM deleted_branch) THEN 1 ELSE deleted_in_admin END
      WHERE business_id=?1 AND source='pos' AND id NOT IN (SELECT value FROM json_each(?2))`).bind(businessId, JSON.stringify(menuIds)),
    env.DB.prepare(`DELETE FROM menu_products WHERE business_id=?1
      AND menu_id IN (SELECT id FROM menus WHERE business_id=?1 AND source='pos')
      AND (
        menu_id IN (SELECT id FROM menus WHERE business_id=?1 AND (parent_id IS NULL OR deleted_in_admin=1))
        OR (assigned_in_admin=0 AND (menu_id,product_id) NOT IN (
          SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?2)
        ))
      )`).bind(businessId, JSON.stringify(storedLinks.map(({ menu_id, product_id }) => [menu_id, product_id]))),
    ...rowChunks(storedLinks).map((chunk) => env.DB.prepare(`WITH requested(menu_id,product_id) AS (
        SELECT json_extract(value,'$.menu_id'),json_extract(value,'$.product_id') FROM json_each(?2)
      )
      INSERT INTO menu_products (business_id,menu_id,product_id)
      SELECT ?1,link.menu_id,link.product_id FROM requested link
      WHERE NOT EXISTS (SELECT 1 FROM menu_product_exclusions exclusion
        WHERE exclusion.business_id=?1 AND exclusion.menu_id=link.menu_id AND exclusion.product_id=link.product_id)
      ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId, chunk))
  ];
}
__name(menuSnapshotWrites, "menuSnapshotWrites");
async function productMenuWrites(env, businessId, productId, value, revision) {
  const ids = array(value, "product.menu_ids", 1e3).map((entry, index) => uuid(entry, `product.menu_ids[${index}]`));
  unique(ids, "product.menu_ids");
  const encoded = JSON.stringify(ids);
  const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM menus WHERE business_id=? AND source='pos' AND parent_id IS NOT NULL
    AND id IN (SELECT value FROM json_each(?))`).bind(businessId, encoded).first("count");
  if (count !== ids.length) invalid2("product.menu_ids", "must reference POS submenus owned by this business");
  return [
    env.DB.prepare(`DELETE FROM menu_products WHERE business_id=? AND product_id=? AND assigned_in_admin=0
      AND menu_id IN (SELECT id FROM menus WHERE business_id=? AND source='pos')
      AND menu_id NOT IN (SELECT value FROM json_each(?))`).bind(businessId, productId, businessId, encoded),
    env.DB.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id)
      SELECT ?1,id,?2 FROM menus WHERE business_id=?1 AND source='pos'
        AND parent_id IS NOT NULL AND deleted_in_admin=0 AND id IN (SELECT value FROM json_each(?3))
        AND NOT EXISTS (SELECT 1 FROM menu_product_exclusions exclusion
          WHERE exclusion.business_id=?1 AND exclusion.menu_id=menus.id AND exclusion.product_id=?2)
      ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId, productId, encoded),
    env.DB.prepare("UPDATE products SET pos_menu_updated_at=? WHERE business_id=? AND id=?").bind(revision, businessId, productId)
  ];
}
__name(productMenuWrites, "productMenuWrites");
async function handlePosSync(request, env, subscriptionFor, scope) {
  if (request.method !== "POST")
    return response({ error: "Method not allowed" }, 405, { allow: "POST" });
  const singleProduct = scope === "product";
  const success4 = /* @__PURE__ */ __name(() => response({ message: `POS ${scope} synced successfully.` }), "success");
  return withPosIdentity(request, env, async (identity) => {
    if (subscriptionFor(identity).readOnly)
      return response(
        {
          error: "Subscription has expired; POS sync is read-only",
          code: "SUBSCRIPTION_EXPIRED"
        },
        402
      );
    const raw = await readBody(request);
    if (scope === "tables")
      return await syncTables(env, identity, raw);
    const body = syncFields(
      parseJson(raw),
      [
        "syncId",
        "sourceUpdatedAt",
        "currency",
        "categories",
        singleProduct ? "product" : "products",
        ...singleProduct ? [] : ["menus", "menuProducts"]
      ]
    );
    const syncId = has(body, "syncId") ? uuid(body.syncId, "syncId") : crypto.randomUUID();
    const previousSourceTime = singleProduct ? NaN : Date.parse(identity.lastSourceUpdatedAt || "");
    const sourceTimestamp = has(body, "sourceUpdatedAt") ? timestamp(body.sourceUpdatedAt, "sourceUpdatedAt") : null;
    const sourceUpdatedAt = sourceTimestamp ?? new Date(
      Math.max(
        Date.now(),
        Number.isFinite(previousSourceTime) ? previousSourceTime + 1 : 0
      )
    ).toISOString();
    if (has(body, "currency") && body.currency !== identity.currency)
      invalid2(
        "currency",
        `must match the business currency (${identity.currency})`
      );
    const categories = singleProduct && !has(body, "categories") ? [] : array(body.categories, "categories", 500).map(
      (row, index) => object2(row, `categories[${index}]`)
    );
    const products = singleProduct ? [object2(body.product, "product")] : array(body.products, "products", 1e3).map(
      (row, index) => object2(row, `products[${index}]`)
    );
    const menuSnapshot = has(body, "menus");
    if (menuSnapshot !== has(body, "menuProducts")) invalid2("body", "send menus and menu_products together");
    const productMenus = singleProduct && has(products[0], "menu_ids");
    const menuIds = productMenus ? products[0].menu_ids : void 0;
    if (productMenus) delete products[0].menu_ids;
    if ((menuSnapshot || productMenus) && !sourceTimestamp)
      invalid2("sourceUpdatedAt", "is required for menu updates");
    if (!categories.length && !products.length && !menuSnapshot)
      invalid2("body", "include at least one category or product");
    const categoryIds = categories.map(
      (row, index) => uuid(row.id, `categories[${index}].id`)
    );
    const productIds = products.map(
      (row, index) => uuid(row.id, singleProduct ? "product.id" : `products[${index}].id`)
    );
    unique(categoryIds, "categories");
    unique(productIds, "products");
    const payloadHash = await hash(raw);
    if (checkReceipt(
      (await syncReceipt(env, identity.businessId, syncId))?.payload_hash,
      payloadHash
    ))
      return success4();
    const lastMenuRevision = menuSnapshot ? identity.lastMenuWriteAt : productMenus ? identity.lastMenuSnapshotAt : null;
    if (lastMenuRevision && sourceUpdatedAt <= lastMenuRevision)
      throw new SyncError("A newer menu update has already synced", 409, "STALE_SYNC");
    if (!singleProduct && identity.lastSourceUpdatedAt && sourceUpdatedAt <= identity.lastSourceUpdatedAt)
      throw new SyncError(
        "source_updated_at must be newer than the last successful sync (use the original sync_id and body for retries)",
        409,
        "STALE_SYNC"
      );
    const results = await env.DB.batch([
      env.DB.prepare(
        "SELECT * FROM categories WHERE id IN (SELECT value FROM json_each(?))"
      ).bind(JSON.stringify(categoryIds)),
      env.DB.prepare(
        "SELECT * FROM products WHERE id IN (SELECT value FROM json_each(?))"
      ).bind(JSON.stringify(productIds)),
      env.DB.prepare(
        "SELECT id,parent_id,slug FROM categories WHERE business_id=?"
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT id,code,slug FROM products WHERE business_id=?"
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT id,object_key FROM media WHERE business_id=?"
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT id,is_normal FROM price_lists WHERE business_id=? AND is_archived=0"
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT product_id,media_id FROM product_images WHERE business_id=? AND product_id IN (SELECT value FROM json_each(?)) ORDER BY sort_order"
      ).bind(identity.businessId, JSON.stringify(productIds))
    ]);
    const existingCategories = results[0].results;
    const existingProducts = results[1].results;
    if (productMenus && typeof existingProducts[0]?.pos_menu_updated_at === "string" && sourceUpdatedAt <= existingProducts[0].pos_menu_updated_at)
      throw new SyncError("A newer product menu update has already synced", 409, "STALE_SYNC");
    if ([...existingCategories, ...existingProducts].some(
      (row) => row.business_id !== identity.businessId
    ))
      throw new SyncError(
        "A supplied UUID already belongs to another business",
        409,
        "CATALOG_ID_CONFLICT"
      );
    if (sourceTimestamp) {
      const staleProduct = existingProducts.find(
        (row) => typeof row.pos_source_updated_at === "string" && sourceTimestamp <= row.pos_source_updated_at
      );
      if (staleProduct)
        throw new SyncError(
          `source_updated_at must be newer than the last source timestamp for product ${staleProduct.id}`,
          409,
          "STALE_SYNC"
        );
    }
    const media = new Map(
      results[4].results.map((row) => [String(row.id), row])
    );
    const lists = results[5].results;
    const normalId = String(lists.find((row) => row.is_normal === 1)?.id || "");
    if (!normalId)
      throw new SyncError(
        "The business needs a Normal Rate price list before syncing",
        409,
        "NORMAL_PRICE_LIST_MISSING"
      );
    const gallery = /* @__PURE__ */ new Map();
    for (const row of results[6].results) {
      const id2 = String(row.product_id);
      gallery.set(id2, [...gallery.get(id2) || [], String(row.media_id)]);
    }
    const normalizedCategories = categoriesForSync(
      categories,
      new Map(existingCategories.map((row) => [String(row.id), row])),
      media,
      env
    );
    const normalizedProducts = productsForSync(
      products,
      new Map(existingProducts.map((row) => [String(row.id), row])),
      gallery,
      media,
      new Set(lists.map((row) => String(row.id))),
      normalId,
      env,
      sourceTimestamp
    );
    if (!await ownsPortionBranches(env.DB, identity.businessId, normalizedProducts.flatMap((product) => product.portions)))
      invalid2("products.portions.branchId", "must reference a branch of this business");
    const orderedCategories = validateGraph(
      normalizedCategories,
      results[2].results,
      normalizedProducts
    );
    validateUnique(normalizedCategories, results[2].results, "slug");
    validateUnique(normalizedProducts, results[3].results, "slug");
    validateUnique(
      normalizedProducts,
      results[3].results,
      "code",
      true
    );
    const businessId = identity.businessId;
    const placeholders = crypto.randomUUID();
    const writes = [
      env.DB.prepare(
        "INSERT INTO pos_sync_requests (business_id,sync_id,payload_hash,source_updated_at,base_version,product_id) VALUES (?,?,?,?,?,?)"
      ).bind(
        businessId,
        syncId,
        payloadHash,
        sourceUpdatedAt,
        identity.catalogVersion,
        singleProduct ? productIds[0] : null
      ),
      // Release unique slugs/codes inside the transaction to allow legitimate swaps.
      env.DB.prepare(
        "UPDATE categories SET slug=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))"
      ).bind(`pos-${placeholders}-`, businessId, JSON.stringify(categoryIds)),
      env.DB.prepare(
        "UPDATE products SET code=NULL,slug=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))"
      ).bind(`pos-${placeholders}-`, businessId, JSON.stringify(productIds)),
      ...upsertRows(env, "categories", orderedCategories, businessId, [
        "id",
        "parent_id",
        "name",
        "name_km",
        "name_en",
        "name_zh",
        "slug",
        "image_url",
        "image_media_id",
        "sort_order",
        "is_active",
        "created_at"
      ]),
      ...upsertRows(env, "products", normalizedProducts, businessId, [
        "id",
        "category_id",
        "code",
        "name",
        "name_km",
        "name_en",
        "name_zh",
        "slug",
        "description",
        "price_cents",
        "max_price",
        "unit",
        "portions_json",
        "modifier_groups_json",
        "image_url",
        "primary_media_id",
        "calories",
        "prep_minutes",
        "rating",
        "is_featured",
        "is_available",
        "sort_order",
        "created_at",
        "pos_source_updated_at"
      ]),
      env.DB.prepare(
        "DELETE FROM product_images WHERE business_id=? AND product_id IN (SELECT value FROM json_each(?))"
      ).bind(businessId, JSON.stringify(productIds))
    ];
    if (menuSnapshot) writes.push(...await menuSnapshotWrites(env, businessId, body.menus, body.menuProducts, productIds, media));
    if (productMenus) writes.push(...await productMenuWrites(env, businessId, productIds[0], menuIds, sourceUpdatedAt));
    if (menuSnapshot || productMenus) writes.push(env.DB.prepare(`UPDATE pos_integrations
      SET last_menu_snapshot_at=COALESCE(?,last_menu_snapshot_at),
        last_menu_write_at=MAX(COALESCE(last_menu_write_at,''),?) WHERE business_id=?`).bind(menuSnapshot ? sourceUpdatedAt : null, sourceUpdatedAt, businessId));
    const images = [];
    const prices = [];
    const targets = [];
    const removedPrices = [];
    for (const product of normalizedProducts) {
      product.mediaIds.forEach(
        (mediaId, index) => images.push({
          productId: product.id,
          mediaId,
          sortOrder: index,
          isPrimary: mediaId === product.primary_media_id ? 1 : 0
        })
      );
      const normal = product.portions.length ? product.portions.map((portion) => ({
        targetKey: portion.id,
        priceCents: portion.priceCents
      })) : [{ targetKey: "base", priceCents: product.price_cents }];
      targets.push({
        productId: product.id,
        keys: normal.map((entry) => entry.targetKey)
      });
      for (const entry of normal) {
        prices.push({ productId: product.id, priceListId: normalId, ...entry });
      }
      for (const entry of product.priceEntries)
        (entry.priceCents === null ? removedPrices : prices).push({
          productId: product.id,
          ...entry
        });
    }
    for (const chunk of rowChunks(images))
      writes.push(
        env.DB.prepare(
          `INSERT INTO product_images (business_id,product_id,media_id,sort_order,is_primary)
       SELECT ?,json_extract(value,'$.productId'),json_extract(value,'$.mediaId'),json_extract(value,'$.sortOrder'),json_extract(value,'$.isPrimary') FROM json_each(?)`
        ).bind(businessId, chunk)
      );
    writes.push(
      env.DB.prepare(
        `DELETE FROM product_prices WHERE business_id=? AND product_id IN (SELECT value FROM json_each(?))
       AND NOT EXISTS (SELECT 1 FROM json_each(?) target, json_each(target.value,'$.keys') target_key
         WHERE json_extract(target.value,'$.productId')=product_prices.product_id
         AND target_key.value=product_prices.target_key)`
      ).bind(businessId, JSON.stringify(productIds), JSON.stringify(targets))
    );
    for (const chunk of rowChunks(removedPrices))
      writes.push(
        env.DB.prepare(
          `DELETE FROM product_prices WHERE business_id=? AND EXISTS (SELECT 1 FROM json_each(?) entry
       WHERE json_extract(entry.value,'$.productId')=product_prices.product_id
       AND json_extract(entry.value,'$.priceListId')=product_prices.price_list_id
       AND json_extract(entry.value,'$.targetKey')=product_prices.target_key)`
        ).bind(businessId, chunk)
      );
    for (const chunk of rowChunks(prices))
      writes.push(
        env.DB.prepare(
          `INSERT INTO product_prices (business_id,product_id,price_list_id,target_key,price_amount)
       SELECT ?,json_extract(value,'$.productId'),json_extract(value,'$.priceListId'),json_extract(value,'$.targetKey'),json_extract(value,'$.priceCents') FROM json_each(?) WHERE 1
       ON CONFLICT(price_list_id,product_id,target_key) DO UPDATE SET price_amount=excluded.price_amount,updated_at=CURRENT_TIMESTAMP`
        ).bind(businessId, chunk)
      );
    writes.push(
      env.DB.prepare(
        "UPDATE businesses SET menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(businessId),
      env.DB.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1,last_source_updated_at=COALESCE(?,last_source_updated_at),last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE business_id=?"
      ).bind(singleProduct ? null : sourceUpdatedAt, businessId)
    );
    try {
      await env.DB.batch(writes);
    } catch (error3) {
      if ((await syncReceipt(env, businessId, syncId))?.payload_hash === payloadHash)
        return success4();
      const message = error3 instanceof Error ? error3.message : String(error3);
      if (/POS_SYNC_STALE/.test(message))
        throw new SyncError(
          "A newer catalog snapshot has already synced",
          409,
          "STALE_SYNC"
        );
      if (/POS_SYNC_CONFLICT|UNIQUE constraint|CATALOG_TENANT_CONFLICT|FOREIGN KEY constraint/.test(
        message
      ))
        throw new SyncError(
          "The catalog changed during sync or an ID, code, slug or reference conflicts. Retry using the latest catalog.",
          409,
          "SYNC_CONFLICT"
        );
      throw error3;
    }
    return success4();
  });
}
__name(handlePosSync, "handlePosSync");

// worker/orderEvents.ts
var isUpgrade = /* @__PURE__ */ __name((request) => request.headers.get("upgrade")?.toLowerCase() === "websocket", "isUpgrade");
function connectPosOrderEvents(request, env) {
  if (request.method !== "GET")
    return response({ error: "Method not allowed" }, 405, { allow: "GET" });
  if (!isUpgrade(request))
    return response({ error: "WebSocket upgrade required" }, 426, {
      upgrade: "websocket"
    });
  return withPosIdentity(request, env, async ({ businessId }, tokenHash) => {
    if (!env.ORDER_EVENTS)
      return response({ error: "Order events are unavailable" }, 503);
    const headers = new Headers(request.headers);
    headers.delete("authorization");
    headers.set("x-order-events-key-hash", tokenHash);
    return env.ORDER_EVENTS.getByName(businessId).fetch(
      new Request(request, { headers })
    );
  });
}
__name(connectPosOrderEvents, "connectPosOrderEvents");
var OrderEvents = class extends DurableObject {
  static {
    __name(this, "OrderEvents");
  }
  fetch(request) {
    const tokenHash = request.headers.get("x-order-events-key-hash");
    if (!isUpgrade(request) || !tokenHash)
      return new Response(null, { status: 400 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [tokenHash]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async broadcast(businessId, event) {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;
    const tokenHash = await this.env.DB.prepare(
      `SELECT i.token_hash FROM pos_integrations i JOIN businesses b ON b.id=i.business_id
       WHERE i.business_id=? AND b.is_active=1`
    ).bind(businessId).first("token_hash");
    const message = JSON.stringify(event);
    for (const socket of sockets) {
      try {
        if (tokenHash && this.ctx.getTags(socket).includes(tokenHash))
          socket.send(message);
        else socket.close(4401, "POS key is no longer valid");
      } catch {
      }
    }
  }
};

// ../../shared/booking.ts
var bookingDefaults = {
  slotMinutes: 30,
  noticeMinutes: 120,
  advanceDays: 30,
  minPax: 1,
  maxPax: 20
};
var bookingPreferences = [
  "indoor",
  "outdoor",
  "private-room"
];
var bookingStatuses = [
  "requested",
  "confirmed",
  "declined",
  "cancelled"
];
function validBookingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
__name(validBookingDate, "validBookingDate");
function bookingDateAt(time, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(time);
  const get = /* @__PURE__ */ __name((type) => parts.find((part) => part.type === type)?.value, "get");
  return `${get("year")}-${get("month")}-${get("day")}`;
}
__name(bookingDateAt, "bookingDateAt");
function addBookingDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
}
__name(addBookingDays, "addBookingDays");
function bookingStatusActions(status) {
  if (status === "requested") return ["confirmed", "declined", "cancelled"];
  if (status === "confirmed") return ["cancelled"];
  return [];
}
__name(bookingStatusActions, "bookingStatusActions");

// ../../shared/branchWebhooks.ts
var webhookTables = {
  orders: {
    label: "Orders",
    events: ["inserted", "updated", "deleted"],
    defaultBodyFields: ["id", "status", "items"],
    fields: {
      id: "text",
      orderNumber: "text",
      status: "text",
      postingDate: "text",
      submittedAt: "text",
      tableId: "text",
      menuId: "text",
      totalQuantity: "number",
      totalAmount: "number",
      currency: "text",
      note: "text",
      items: "items"
    },
    sample: {
      id: "example-order",
      orderNumber: "261110-001",
      status: "accepted",
      postingDate: "2026-11-10",
      submittedAt: "2026-11-10T03:00:00Z",
      tableId: "example-table",
      menuId: null,
      totalQuantity: 2,
      totalAmount: 5,
      currency: "USD",
      note: "",
      items: [{
        id: "example-line",
        lineNumber: 1,
        productId: "example-product",
        productCode: "COFFEE",
        productName: "Coffee",
        quantity: 2,
        price: 2.5,
        totalAmount: 5,
        portionId: null,
        portionName: "",
        modifiers: [],
        note: ""
      }]
    },
    previousStatus: "submitted"
  },
  bookings: {
    label: "Bookings",
    events: ["inserted", "updated", "deleted"],
    defaultBodyFields: ["id", "status", "pax"],
    fields: {
      id: "text",
      status: "text",
      arrivalDate: "text",
      arrivalTime: "text",
      arrivalAt: "text",
      timezone: "text",
      pax: "number",
      preference: "text",
      createdAt: "text",
      updatedAt: "text",
      guestName: "text",
      guestPhone: "text",
      preferenceText: "text",
      note: "text"
    },
    contactFields: ["guestName", "guestPhone", "preferenceText", "note"],
    sample: {
      id: "BK-EXAMPLE",
      status: "confirmed",
      arrivalDate: "2026-11-10",
      arrivalTime: "12:00",
      arrivalAt: "2026-11-10T05:00:00Z",
      timezone: "Asia/Phnom_Penh",
      pax: 4,
      preference: "indoor",
      createdAt: "2026-11-10 03:00:00",
      updatedAt: "2026-11-10 04:00:00",
      guestName: "Example Guest",
      guestPhone: "+855 00 000 000",
      preferenceText: "",
      note: ""
    },
    previousStatus: "requested"
  }
};
var webhookMethods = ["POST", "PUT", "PATCH", "DELETE", "GET", "HEAD", "OPTIONS"];
function webhookDefinition(table) {
  return webhookTables[table];
}
__name(webhookDefinition, "webhookDefinition");
function webhookFields(table, includeBookingContact) {
  const definition = webhookDefinition(table);
  return Object.fromEntries(Object.entries(definition.fields).filter(([field]) => includeBookingContact || !definition.contactFields?.includes(field)));
}
__name(webhookFields, "webhookFields");
var contextFields = ["event", "eventId", "deliveryId", "businessId", "branchId", "occurredAt"];
var placeholder = /^\{\{(record\.[a-zA-Z]+|previous\.[a-zA-Z]+|[a-zA-Z]+)\}\}$/;
var textPlaceholder = /\{\{(record\.[a-zA-Z]+|previous\.[a-zA-Z]+|eventId|deliveryId|businessId|branchId|occurredAt|event)\}\}/g;
function validateWebhookTemplate(body, table, event, includeBookingContact, format = "json") {
  if (format === "none") return;
  if (body === void 0 || format === "text" && typeof body !== "string")
    throw new Error(format === "text" ? "Enter a text body." : "Enter a valid JSON value.");
  if (new TextEncoder().encode(JSON.stringify(body)).length > 64 * 1024)
    throw new Error("The body template must be at most 64 KB.");
  const fields2 = webhookFields(table, includeBookingContact);
  function validateToken(token) {
    const [source, field] = token.split(".");
    if (field ? !Object.hasOwn(fields2, field) || source === "previous" && event !== "updated" : !contextFields.includes(source)) throw new Error("Unsupported body placeholder: " + token);
  }
  __name(validateToken, "validateToken");
  if (format === "text") {
    for (const [, token] of body.matchAll(textPlaceholder)) validateToken(token);
    return;
  }
  function validate(value, depth) {
    if (depth > 40) throw new Error("The body template is nested too deeply.");
    if (typeof value === "string") {
      const token = placeholder.exec(value)?.[1];
      if (token) validateToken(token);
    }
    if (value && typeof value === "object")
      for (const child of Object.values(value)) validate(child, depth + 1);
  }
  __name(validate, "validate");
  validate(body, 0);
}
__name(validateWebhookTemplate, "validateWebhookTemplate");
function renderWebhookTemplate(body, values) {
  if (typeof body === "string") {
    const token = placeholder.exec(body)?.[1];
    if (!token) return body;
    const [source, field] = token.split(".");
    if (!field) return Object.hasOwn(values, source) ? values[source] : null;
    const record = source === "previous" ? values.previous : values.record;
    return record && Object.hasOwn(record, field) ? record[field] : null;
  }
  if (Array.isArray(body)) return body.map((value) => renderWebhookTemplate(value, values));
  if (body && typeof body === "object")
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, renderWebhookTemplate(value, values)]));
  return body;
}
__name(renderWebhookTemplate, "renderWebhookTemplate");
function renderWebhookBody(body, values, format) {
  if (format === "none") return void 0;
  if (format === "json") return JSON.stringify(renderWebhookTemplate(body, values));
  return body.replace(textPlaceholder, (match) => {
    const value = renderWebhookTemplate(match, values);
    return value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  });
}
__name(renderWebhookBody, "renderWebhookBody");

// worker/webhookDestination.ts
function isLocalHost(host) {
  if (host === "localhost" || host === "[::1]") return true;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const [first, second] = host.split(".").map(Number);
  return first === 127 || first === 10 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168;
}
__name(isLocalHost, "isLocalHost");
function webhookDestination(env, value) {
  const allowLocalHttp = env.WEBHOOK_ALLOW_LOCAL_HTTP === "true";
  const invalidUrl = allowLocalHttp ? "Use a public HTTPS hostname or an HTTP URL on localhost or a private IPv4 address. Remove URL credentials and fragments." : "Use a public HTTPS hostname without URL credentials, a custom port, or a fragment.";
  if (typeof value !== "string" || value.length > 2048)
    throw new Error(invalidUrl);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidUrl);
  }
  const host = url.hostname;
  if (url.username || url.password || url.href.includes("#")) throw new Error(invalidUrl);
  const localHttp = allowLocalHttp && url.protocol === "http:" && isLocalHost(host);
  if (!localHttp && (url.protocol !== "https:" || url.port || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(host) || /\.(localhost|local|internal|test|invalid|onion|home|lan|arpa)$/.test(host)))
    throw new Error(invalidUrl);
  return { url: url.href, host, localHttp };
}
__name(webhookDestination, "webhookDestination");
function publicAddress(address, type) {
  if (type === 1) {
    const parts = address.split(".");
    if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [a, b, c] = parts.map(Number);
    return a > 0 && a < 224 && ![10, 127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 198 && [18, 19].includes(b)) && !(a === 192 && (b === 168 || b === 0 && [0, 2].includes(c) || b === 88 && c === 99)) && !(a === 198 && b === 51 && c === 100) && !(a === 203 && b === 0 && c === 113);
  }
  if (!/^[\da-f:.]+$/i.test(address)) return false;
  try {
    const [first, second] = new URL(`https://[${address}]`).hostname.slice(1, -1).split(":");
    const prefix = Number.parseInt(first, 16);
    const next = second ? Number.parseInt(second, 16) : 0;
    return prefix >= 8192 && prefix < 16384 && prefix !== 8194 && prefix !== 16383 && !(prefix === 8193 && (next < 512 || next === 3512));
  } catch {
    return false;
  }
}
__name(publicAddress, "publicAddress");
async function checkWebhookDns(host, signal) {
  const records2 = await Promise.all([1, 28].map(async (type) => {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.search = new URLSearchParams({ name: host, type: String(type) }).toString();
    const response2 = await fetch(url, { headers: { accept: "application/dns-json" }, redirect: "manual", signal });
    if (!response2.ok) throw new Error("DNS request failed.");
    const data = await response2.json();
    if (data.TC || data.Status !== 0 && data.Status !== 3) throw new Error("DNS response was incomplete.");
    return (data.Answer ?? []).filter((answer) => answer.type === 1 || answer.type === 28);
  }));
  const addresses = records2.flat();
  if (!addresses.length) throw new Error("The destination has no public DNS address.");
  return addresses.every(({ data, type }) => typeof data === "string" && publicAddress(data, type));
}
__name(checkWebhookDns, "checkWebhookDns");
var encoder = new TextEncoder();
async function headerKey(env, businessId, branchId) {
  if (!env.AUTH_PEPPER || env.AUTH_PEPPER.length < 32)
    throw new Error("Webhook header encryption is unavailable.");
  const secret = await crypto.subtle.importKey("raw", encoder.encode(env.AUTH_PEPPER), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({
    name: "HKDF",
    hash: "SHA-256",
    salt: encoder.encode("emenu:webhook-headers:v1"),
    info: encoder.encode(JSON.stringify([businessId, branchId]))
  }, secret, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
__name(headerKey, "headerKey");
async function encryptWebhookHeaders(env, businessId, branchId, headers) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await headerKey(env, businessId, branchId);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(headers)));
  const bytes = new Uint8Array(encrypted);
  let encoded = String.fromCharCode(...iv);
  for (let offset = 0; offset < bytes.length; offset += 8192)
    encoded += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(encoded);
}
__name(encryptWebhookHeaders, "encryptWebhookHeaders");
async function decryptWebhookHeaders(env, businessId, branchId, value) {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const key = await headerKey(env, businessId, branchId);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return JSON.parse(new TextDecoder().decode(clear));
}
__name(decryptWebhookHeaders, "decryptWebhookHeaders");

// worker/webhookDelivery.ts
var retryDelays = [60, 300, 1800];
var webhookRetentionSeconds = 24 * 60 * 60;
var webhookBlocked = `EXISTS (
  SELECT 1 FROM branch_webhook_events earlier
  JOIN branch_webhook_deliveries prior ON prior.event_sequence=earlier.sequence AND prior.host=d.host
  WHERE earlier.business_id=e.business_id AND earlier.branch_id=e.branch_id
    AND earlier.table_key=e.table_key AND earlier.record_id=e.record_id AND earlier.sequence<e.sequence
    AND prior.status IN ('pending','sending','failed','stopped')
)`;
function includesOrderItems(template) {
  if (template && typeof template === "object") return Object.values(template).some(includesOrderItems);
  return template === "{{record.items}}" || template === "{{previous.items}}";
}
__name(includesOrderItems, "includesOrderItems");
async function send(env, job) {
  let destination;
  try {
    destination = webhookDestination(env, job.url);
  } catch (error3) {
    return { httpStatus: null, error: error3.message, retry: false };
  }
  let headers;
  let body;
  try {
    headers = new Headers(await decryptWebhookHeaders(env, job.businessId, job.branchId, job.headersCiphertext));
    if (!headers.has("content-type") && job.bodyFormat !== "none")
      headers.set("content-type", job.bodyFormat === "json" ? "application/json" : "text/plain; charset=UTF-8");
    headers.set("x-emenu-event-id", job.eventId);
    headers.set("x-emenu-delivery-id", job.id);
    headers.set("x-emenu-event", job.event);
    if (!headers.has("idempotency-key")) headers.set("idempotency-key", job.id);
    const fields2 = webhookFields(job.table, Boolean(job.includeContact));
    const snapshot = /* @__PURE__ */ __name((value) => Object.fromEntries(
      Object.entries(JSON.parse(value)).filter(([field]) => Object.hasOwn(fields2, field))
    ), "snapshot");
    const template = JSON.parse(job.bodyJson);
    const record = snapshot(job.recordJson);
    const previous = job.previousJson ? snapshot(job.previousJson) : null;
    const needsItems = job.bodyFormat === "text" && typeof template === "string" ? template.includes("{{record.items}}") || template.includes("{{previous.items}}") : includesOrderItems(template);
    if (job.table === "orders" && record.items === null && needsItems)
      return { httpStatus: null, error: "The order line items exceed the 256 KB delivery limit.", retry: false };
    body = renderWebhookBody(template, {
      event: job.event,
      eventId: job.eventId,
      deliveryId: job.id,
      businessId: job.businessId,
      branchId: job.branchId,
      occurredAt: new Date(job.occurredAt * 1e3).toISOString(),
      record,
      previous
    }, job.bodyFormat);
  } catch {
    return { httpStatus: null, error: "The saved webhook configuration could not be rendered.", retry: false };
  }
  if (body !== void 0 && new TextEncoder().encode(body).length > maxWebhookBodyBytes)
    return { httpStatus: null, error: "The rendered body exceeds 256 KB.", retry: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1e4);
  try {
    if (!destination.localHttp) {
      const publicDns = await checkWebhookDns(destination.host, controller.signal).catch(() => null);
      if (publicDns === null) return { httpStatus: null, error: "The destination DNS could not be verified.", retry: true };
      if (!publicDns) return { httpStatus: null, error: "The destination resolves to a non-public address.", retry: false };
    }
    const result = await fetch(destination.url, { method: job.method, headers, body, redirect: "manual", signal: controller.signal });
    if (result.body) void result.body.cancel().catch(() => {
    });
    return {
      httpStatus: result.status,
      error: result.ok ? null : result.status >= 300 && result.status < 400 ? "Redirects are not followed." : "The endpoint returned an HTTP error.",
      retry: result.status === 429 || result.status >= 500
    };
  } catch {
    return { httpStatus: null, error: controller.signal.aborted ? "The endpoint timed out." : "The endpoint could not be reached.", retry: true };
  } finally {
    clearTimeout(timeout);
  }
}
__name(send, "send");
async function processJob(env, job) {
  const lease = crypto.randomUUID();
  const claimed = await env.DB.prepare(`
    UPDATE branch_webhook_deliveries SET status='sending', attempts=attempts+1,
      retry_count=retry_count+1, attempted_at=unixepoch(), due_at=unixepoch()+60, lease_token=?
    WHERE id=? AND status='pending' AND due_at<=unixepoch()
      AND EXISTS (SELECT 1 FROM branch_webhook_events event WHERE event.sequence=event_sequence
        AND event.created_at>unixepoch()-${webhookRetentionSeconds})
      AND EXISTS (SELECT 1 FROM branch_webhooks rule WHERE rule.id=webhook_id AND rule.enabled=1 AND rule.archived=0)
    RETURNING retry_count AS retryCount
  `).bind(lease, job.id).first();
  if (!claimed) return;
  const result = await send(env, job);
  const delay = result.retry ? retryDelays[claimed.retryCount - 1] : void 0;
  await env.DB.prepare(`
    UPDATE branch_webhook_deliveries SET status=CASE
      WHEN ?1='succeeded' THEN 'succeeded'
      WHEN NOT EXISTS (SELECT 1 FROM branch_webhooks rule WHERE rule.id=webhook_id AND rule.enabled=1 AND rule.archived=0)
        THEN 'stopped' ELSE ?1 END,
      due_at=unixepoch()+?2, http_status=?3, error=?4, lease_token=NULL, history_hidden=0
    WHERE id=?5 AND status='sending' AND lease_token=?6
  `).bind(
    result.error === null ? "succeeded" : delay === void 0 ? "failed" : "pending",
    delay ?? 0,
    result.httpStatus,
    result.error,
    job.id,
    lease
  ).run();
}
__name(processJob, "processJob");
async function drainBranchWebhooks(env, businessId) {
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
  const { results } = await (businessId ? query.bind(businessId) : query).all();
  for (let index = 0; index < results.length; index += 3)
    await Promise.all(results.slice(index, index + 3).map((job) => processJob(env, job)));
}
__name(drainBranchWebhooks, "drainBranchWebhooks");
function scheduleBranchWebhooks(env, execution, businessId) {
  execution.waitUntil(drainBranchWebhooks(env, businessId).catch(() => {
    console.error("branch_webhook_background_delivery_failed", { businessId });
  }));
}
__name(scheduleBranchWebhooks, "scheduleBranchWebhooks");
async function runBranchWebhookScheduler(env) {
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
    `)
  ]);
  await drainBranchWebhooks(env);
}
__name(runBranchWebhookScheduler, "runBranchWebhookScheduler");

// worker/posOrders.ts
var orderColumns = `o.id, o.order_number, o.status, o.posting_date, o.submitted_at,
  o.total_quantity, o.total_amount, o.currency, o.table_id,
  o.branch_id, branch.slug AS branch_slug, branch.name AS branch_name, o.menu_id,
  t.code AS table_code, t.label AS table_label, g.id AS table_group_id, g.name AS table_group_name`;
var ordersFrom = `FROM orders o
  JOIN restaurant_tables t ON t.id=o.table_id AND t.business_id=o.business_id
  JOIN table_groups g ON g.id=t.group_id AND g.business_id=o.business_id
  JOIN branches branch ON branch.id=o.branch_id AND branch.business_id=o.business_id`;
function parseProductDecisions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30)
    return null;
  const ids = /* @__PURE__ */ new Set();
  const products = [];
  for (const item of value) {
    const { id: id2, status } = item ?? {};
    if (typeof id2 !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id2) || ids.has(id2) || status !== "accepted" && status !== "rejected") return null;
    ids.add(id2);
    products.push({ id: id2, status });
  }
  return products.some(({ status }) => status === "accepted") ? products : null;
}
__name(parseProductDecisions, "parseProductDecisions");
async function orderDetail(db, businessId, orderId) {
  const [headers, lines] = await db.batch([
    db.prepare(
      `SELECT ${orderColumns}, o.note ${ordersFrom} WHERE o.business_id=? AND o.id=?`
    ).bind(businessId, orderId),
    db.prepare(
      `SELECT line.id, line.line_number, line.product_id, line.status,
        COALESCE(line.product_code, product.code) AS product_code,
        COALESCE(line.product_name, NULLIF(product.name_km,''), product.name, line.product_id) AS name,
        product.name_en, line.quantity, line.price, line.portion_id, line.portion_name,
        line.price_list AS price_list_id, price_list.name AS price_list_name,
        line.modifiers, line.total_amount, line.note
       FROM order_products line
       JOIN orders o ON o.id=line.order_id
       LEFT JOIN products product ON product.id=line.product_id AND product.business_id=o.business_id
       LEFT JOIN price_lists price_list ON price_list.id=line.price_list AND price_list.business_id=o.business_id
       WHERE o.business_id=? AND o.id=?
       ORDER BY line.line_number`
    ).bind(businessId, orderId)
  ]);
  const order = headers.results[0];
  if (!order) return response({ error: "Order not found" }, 404);
  return response({
    order,
    products: lines.results.map((line) => ({
      ...line,
      modifiers: JSON.parse(String(line.modifiers)).map((option) => ({
        id: option.id,
        group_id: option.groupId,
        label_km: option.labelKm ?? "",
        label_en: option.labelEn ?? "",
        label_zh: option.labelZh ?? "",
        prefix: option.prefix ?? "",
        price: Number(option.priceCents ?? 0)
      }))
    }))
  });
}
__name(orderDetail, "orderDetail");
async function handlePosOrders(request, env, execution, subscriptionFor, orderId) {
  if (request.method !== "GET" && !(orderId && request.method === "PATCH"))
    return response({ error: "Method not allowed" }, 405, {
      allow: orderId ? "GET, PATCH" : "GET"
    });
  return withPosIdentity(request, env, async (identity) => {
    const { businessId } = identity;
    if (orderId && request.method === "PATCH") {
      if (subscriptionFor(identity).readOnly)
        return response(
          {
            error: "Subscription has expired; orders are read-only",
            code: "SUBSCRIPTION_EXPIRED"
          },
          402
        );
      const body = await readPosJson(request, 4096);
      if ("products" in body) {
        const products = parseProductDecisions(body.products);
        if (body.status !== "accepted" || Object.keys(body).length !== 2 || !products)
          return response({
            error: "Send status accepted with unique product line IDs and accepted or rejected decisions, including at least one accepted line"
          }, 400);
        const order2 = await confirmOrderProducts(env.DB, businessId, orderId, products);
        if (!order2) return response({ error: "Order not found" }, 404);
        if (order2.changed) scheduleBranchWebhooks(env, execution, businessId);
        if (order2.status === "submitted")
          return response({ error: "Send one decision for every line in this order" }, 400);
        if (order2.status !== "accepted" || !order2.matches)
          return response({
            code: "order_status_conflict",
            error: "This order was already reviewed with a different result",
            status: order2.status
          }, 409);
        return response({ id: orderId, status: order2.status, products: order2.products });
      }
      if (!isOrderStatusUpdate(body.status) || Object.keys(body).length !== 1)
        return response(
          { error: "Send only status with accepted, completed, or cancelled" },
          400
        );
      const order = await updateOrderStatus(
        env.DB,
        businessId,
        orderId,
        body.status
      );
      if (!order) return response({ error: "Order not found" }, 404);
      if (order.changed) scheduleBranchWebhooks(env, execution, businessId);
      if (order.status !== body.status)
        return response(
          {
            code: "order_status_conflict",
            error: "This order can no longer be changed to that status",
            status: order.status
          },
          409
        );
      return response({ id: orderId, status: order.status });
    }
    if (orderId) return orderDetail(env.DB, businessId, orderId);
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const branchId = params.get("branch_id");
    const postingDate = params.get("posting_date");
    const page = Number(params.get("page") ?? 1);
    const pageSize = Number(params.get("page_size") ?? 25);
    if (status !== null && !isOrderStatus(status))
      return response({ error: "Invalid order status filter" }, 400);
    if (postingDate !== null && !validBookingDate(postingDate))
      return response(
        { error: "posting_date must be a valid date in YYYY-MM-DD format" },
        400
      );
    if (!Number.isSafeInteger(page) || page < 1 || page > 1e6)
      return response({ error: "Invalid page number" }, 400);
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
      return response(
        { error: "page_size must be an integer between 1 and 100" },
        400
      );
    const filters = ["o.business_id=?"];
    const bindings = [businessId];
    if (status) {
      filters.push("o.status=?");
      bindings.push(status);
    }
    if (branchId) {
      filters.push("o.branch_id=?");
      bindings.push(branchId);
    }
    if (postingDate) {
      filters.push("o.posting_date=?");
      bindings.push(postingDate);
    }
    const filteredOrders = `${ordersFrom} WHERE ${filters.join(" AND ")}`;
    const offset = (page - 1) * pageSize;
    const [orders, count] = await env.DB.batch([
      env.DB.prepare(
        `SELECT ${orderColumns} ${filteredOrders}
         ORDER BY o.posting_date DESC, o.rowid DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, pageSize, offset),
      env.DB.prepare(`SELECT COUNT(*) AS total_record ${filteredOrders}`).bind(...bindings)
    ]);
    const totalRecord = Number(count.results[0].total_record);
    return response({
      orders: orders.results,
      page,
      page_size: pageSize,
      has_more: offset + pageSize < totalRecord,
      total_record: totalRecord
    });
  });
}
__name(handlePosOrders, "handlePosOrders");

// worker/posApiCatalog.ts
function ratio(value) {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match)
    conflict(
      "The configured price or exchange rate is invalid",
      "INVALID_PRICING"
    );
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const scale = fraction.length - Number(exponent);
  if (Math.abs(scale) > 330)
    conflict(
      "The configured price or exchange rate is invalid",
      "INVALID_PRICING"
    );
  const numerator = BigInt(sign + whole + fraction);
  return scale >= 0 ? [numerator, 10n ** BigInt(scale)] : [numerator * 10n ** BigInt(-scale), 1n];
}
__name(ratio, "ratio");
var units = /* @__PURE__ */ __name((currency) => currency === "USD" ? 100n : 1n, "units");
var rounded = /* @__PURE__ */ __name((numerator, denominator) => numerator < 0n ? -((-2n * numerator + denominator) / (2n * denominator)) : (2n * numerator + denominator) / (2n * denominator), "rounded");
function bounded(value) {
  if (value > BigInt(MAX_AMOUNT) || value < -BigInt(MAX_AMOUNT))
    conflict("The amount exceeds the POS limit", "AMOUNT_LIMIT");
  return Number(value);
}
__name(bounded, "bounded");
function saleQuantity(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 999 || Math.round(value * 1e3) / 1e3 !== value)
    invalid("Enter a quantity from 0.001 to 999 with up to three decimal places");
  return value;
}
__name(saleQuantity, "saleQuantity");
function lineGross(unitPrice, quantity) {
  return bounded(rounded(BigInt(unitPrice) * BigInt(Math.round(quantity * 1e3)), 1000n));
}
__name(lineGross, "lineGross");
function priceMinor(value, currency) {
  const [numerator, denominator] = ratio(value);
  return bounded(rounded(numerator * units(currency), denominator));
}
__name(priceMinor, "priceMinor");
function secondaryToPrimary(amount, primary, rate) {
  const [numerator, denominator] = ratio(rate);
  if (numerator <= 0n)
    conflict(
      "The configured exchange rate must be positive",
      "INVALID_PRICING"
    );
  const secondary = primary === "USD" ? "KHR" : "USD";
  return bounded(
    rounded(
      BigInt(amount) * units(primary) * denominator,
      units(secondary) * numerator
    )
  );
}
__name(secondaryToPrimary, "secondaryToPrimary");
function saleLineTotals(gross, mode, bps, rule = null, discount = 0, discountBps = null) {
  const rates = rule ? [rule.tax_1_rate, rule.tax_2_rate, rule.tax_3_rate].map(ratio) : [[BigInt(bps), 100n], [0n, 1n], [0n, 1n]];
  const afterDiscount = rule ? [
    rule.calculate_tax_1_after_discount,
    rule.calculate_tax_2_after_discount,
    rule.calculate_tax_3_after_discount
  ] : [true, true, true];
  const parents = [
    [],
    rule?.calculate_tax_2_after_adding_tax_1 ? [0] : [],
    [
      ...rule?.calculate_tax_3_after_adding_tax_1 ? [0] : [],
      ...rule?.calculate_tax_3_after_adding_tax_2 ? [1] : []
    ]
  ];
  let subtotal = gross;
  let taxes = [0n, 0n, 0n];
  const discountFor = /* @__PURE__ */ __name((base) => discountBps == null ? discount : Number(rounded(BigInt(base) * BigInt(discountBps), 10000n)), "discountFor");
  let amountOff;
  if (mode === "inclusive") {
    const scale = rates.reduce((max, [, d]) => d > max ? d : max, 1n) * 100n;
    const base = scale ** 3n;
    const coefficients = /* @__PURE__ */ __name((discounted) => {
      const parts = [];
      for (const [i, [n, d]] of rates.entries()) {
        const input = !discounted || afterDiscount[i] ? base : 0n;
        const prior = parents[i].reduce((sum, parent) => sum + parts[parent], 0n);
        parts.push((input + prior) * (n * (scale / (d * 100n))) / scale);
      }
      return parts;
    }, "coefficients");
    const shares = coefficients(false);
    const denominator = base + shares.reduce((sum, share) => sum + share, 0n);
    const extract = /* @__PURE__ */ __name((amounts, divisor) => {
      let running = 0n;
      let prior = 0n;
      return amounts.map((amount) => {
        running += amount;
        const cumulative = rounded(running, divisor);
        const component = cumulative - prior;
        prior = cumulative;
        return component;
      });
    }, "extract");
    taxes = extract(shares.map((share) => BigInt(gross) * share), denominator);
    subtotal = gross - Number(taxes.reduce((sum, tax4) => sum + tax4, 0n));
    amountOff = discountFor(subtotal);
    if (amountOff > subtotal) invalid("The discount exceeds the line subtotal");
    if (amountOff) {
      const grossBase = BigInt(gross) * base;
      const discountBase = BigInt(amountOff) * denominator;
      const applied = discountBase > grossBase ? grossBase : discountBase;
      const reductions = coefficients(true);
      taxes = extract(
        shares.map((share, i) => grossBase * share - applied * reductions[i]),
        denominator * base
      );
    }
  } else {
    amountOff = discountFor(subtotal);
    if (amountOff > subtotal) invalid("The discount exceeds the line subtotal");
    if (mode === "exclusive") {
      for (const [i, [n, d]] of rates.entries()) {
        const net = BigInt(subtotal - (afterDiscount[i] ? amountOff : 0));
        const prior = parents[i].reduce((sum, parent) => sum + taxes[parent], 0n);
        taxes[i] = rounded((net + prior) * n, d * 100n);
      }
    }
  }
  const [tax1, tax2, tax3] = taxes.map(bounded);
  const tax = bounded(taxes.reduce((sum, amount) => sum + amount, 0n));
  return {
    subtotal_minor: subtotal,
    discount_minor: amountOff,
    tax_1_amount: tax1,
    tax_2_amount: tax2,
    tax_3_amount: tax3,
    tax_minor: tax,
    total_minor: subtotal - amountOff + tax
  };
}
__name(saleLineTotals, "saleLineTotals");
function activeCatalogNodes(mode) {
  const isMenu = mode === "menu";
  const table = isMenu ? "menus" : "categories";
  return `WITH RECURSIVE active_nodes AS (
      SELECT id,parent_id FROM ${table} WHERE business_id=?1 AND is_active=1 AND parent_id IS NULL
        ${isMenu ? "AND deleted_in_admin=0" : ""}
      UNION
      SELECT node.id,node.parent_id FROM ${table} node JOIN active_nodes parent ON parent.id=node.parent_id
      WHERE node.business_id=?1 AND node.is_active=1 ${isMenu ? "AND node.deleted_in_admin=0" : ""}
    )`;
}
__name(activeCatalogNodes, "activeCatalogNodes");
function catalogScope(context, menuId) {
  const mode = context.config.catalog_mode;
  const isMenu = mode === "menu";
  const table = isMenu ? "menus" : "categories";
  const params = [
    context.identity.business_id,
    JSON.stringify(context.config.selected_ids)
  ];
  let scope = `${activeCatalogNodes(mode)}, selected_nodes(id) AS (
      SELECT id FROM active_nodes
      WHERE CASE WHEN ?2='null' THEN parent_id IS NULL ELSE id IN (SELECT value FROM json_each(?2)) END
      UNION
      SELECT node.id FROM active_nodes node JOIN selected_nodes parent ON node.parent_id=parent.id
    )`;
  let catalogNodes = "selected_nodes";
  if (menuId) {
    params.push(menuId);
    scope += `, menu_subtree(id) AS (
      SELECT id FROM selected_nodes WHERE id=?3
      UNION
      SELECT node.id FROM active_nodes node JOIN menu_subtree parent ON node.parent_id=parent.id
    )`;
    catalogNodes = "menu_subtree";
  }
  const assignment = `FROM menu_products mp JOIN ${catalogNodes} node ON node.id=mp.menu_id
      WHERE mp.business_id=p.business_id AND mp.product_id=p.id
      AND NOT EXISTS (SELECT 1 FROM menu_product_exclusions x
        WHERE x.business_id=mp.business_id AND x.menu_id=mp.menu_id AND x.product_id=mp.product_id)`;
  const products = `${scope}
    SELECT p.id,p.code,p.category_id AS categoryId,COALESCE(NULLIF(p.name_km,''),p.name) AS name,
      p.name_km AS nameKm,p.name_en AS nameEn,p.name_zh AS nameZh,p.description,p.unit,p.image_url AS imageUrl,
      p.price_cents AS priceCents,p.portions_json AS portionsJson,p.modifier_groups_json AS modifierGroupsJson,
      p.allow_discount AS allowDiscount,p.allow_change_price AS allowChangePrice,
      p.is_open_product AS isOpenProduct,p.allow_free AS allowFree,
      ${isMenu ? `(SELECT json_group_array(mp.menu_id) ${assignment})` : "'[]'"} AS menuIds
    FROM products p WHERE p.business_id=?1 AND p.is_available=1
      AND ${isMenu ? `EXISTS (SELECT 1 ${assignment})` : "p.category_id IN (SELECT id FROM selected_nodes)"}
      AND (json_array_length(p.portions_json)=0 OR EXISTS (
        SELECT 1 FROM json_each(p.portions_json) WHERE json_extract(value,'$.branchId') IS NULL
          OR json_extract(value,'$.branchId')=?
      ))`;
  const nodes = `${scope}
    SELECT node.id,CASE WHEN node.parent_id IN (SELECT id FROM ${catalogNodes}) THEN node.parent_id END AS parent_id,
      COALESCE(NULLIF(node.name_km,''),${isMenu ? "NULLIF(node.name_en,''),node.name_zh" : "node.name"}) AS name,
      node.name_km,node.name_en,node.name_zh,node.sort_order,
      node.image_url,node.image_media_id,photo.object_key AS image_object_key
    FROM ${table} node JOIN ${catalogNodes} selected ON selected.id=node.id
    LEFT JOIN media photo ON photo.id=node.image_media_id AND photo.business_id=node.business_id
    WHERE node.business_id=?1 ORDER BY node.sort_order,node.id`;
  return { products, nodes, params };
}
__name(catalogScope, "catalogScope");
async function priced(env, deps, context, products) {
  const identity = context.identity;
  const pricing = await deps.pricing(
    env,
    identity.business_id,
    identity.pricing_mode,
    identity.default_price_list_id,
    identity.timezone
  );
  const prices = await sql(
    context.db,
    `SELECT price_list_id AS priceListId,product_id AS productId,
      target_key AS targetKey,price_amount AS priceCents FROM product_prices
    WHERE business_id=? AND price_list_id IN (?,?) AND product_id IN (SELECT value FROM json_each(?))`,
    identity.business_id,
    pricing.normalId,
    pricing.activeId,
    JSON.stringify(products.map((product) => product.id))
  ).all();
  const normal = deps.priceMap(prices.results, pricing.normalId);
  const active = deps.priceMap(prices.results, pricing.activeId);
  return {
    active,
    pricing,
    products: products.flatMap((product) => {
      const entry = deps.pricedProduct(
        product,
        normal,
        active,
        context.profile.branch_id
      );
      return entry ? [entry] : [];
    })
  };
}
__name(priced, "priced");
function modifierGroups(value, currency) {
  return value.map((group) => ({
    id: group.id,
    required: Boolean(group.required),
    multiple: Boolean(group.multiple),
    label_km: group.labelKm,
    label_en: group.labelEn,
    label_zh: group.labelZh,
    options: group.options.map((option) => ({
      id: String(option.id),
      label_km: String(option.labelKm ?? ""),
      label_en: String(option.labelEn ?? ""),
      label_zh: String(option.labelZh ?? ""),
      prefix: String(option.prefix ?? ""),
      price_minor: priceMinor(Number(option.priceCents ?? 0), currency)
    }))
  }));
}
__name(modifierGroups, "modifierGroups");
async function getCatalog(env, deps, context, url) {
  const rawMenuId = url.searchParams.get("menu_id");
  const menuId = rawMenuId === null ? void 0 : recordId(rawMenuId, "menu_id");
  if (menuId && context.config.catalog_mode !== "menu")
    invalid("menu_id requires a menu-based POS profile");
  const { products, nodes, params } = catalogScope(context, menuId);
  const { limit, offset, page } = pagination(url);
  const [productRows, nodeRows] = await context.db.batch([
    sql(
      context.db,
      products + " ORDER BY p.sort_order,p.id LIMIT ? OFFSET ?",
      ...params,
      context.profile.branch_id,
      limit + 1,
      offset
    ),
    sql(context.db, nodes, ...params)
  ]);
  if (menuId && !nodeRows.results.length) missing("Menu");
  const { currency, catalog_version } = context.identity;
  const publicMediaBase = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "");
  const publicAssetBase = env.PUBLIC_ASSET_BASE?.trim().replace(/\/$/, "");
  const result = await priced(
    env,
    deps,
    context,
    productRows.results.slice(0, limit)
  );
  return respond({
    catalog_version,
    currency,
    price_list_id: result.pricing.activeId,
    mode: context.config.catalog_mode,
    nodes: nodeRows.results.map(({ image_media_id, image_object_key, ...node }) => ({
      ...node,
      image_url: publicMediaBase && image_object_key ? `${publicMediaBase}/${String(image_object_key).split("/").map(encodeURIComponent).join("/")}` : node.image_url || (publicAssetBase && image_media_id ? `${publicAssetBase}/${image_media_id}` : null)
    })),
    page,
    page_size: limit,
    has_more: productRows.results.length > limit,
    products: result.products.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      name_km: product.nameKm,
      name_en: product.nameEn,
      name_zh: product.nameZh,
      description: product.description,
      unit: product.unit,
      allow_discount: Boolean(product.allowDiscount),
      allow_change_price: Boolean(product.allowChangePrice),
      is_open_product: Boolean(product.isOpenProduct),
      allow_free: Boolean(product.allowFree),
      image_url: product.imageUrl,
      category_id: product.categoryId,
      menu_ids: JSON.parse(String(product.menuIds)),
      price_minor: priceMinor(product.priceCents, currency),
      price_list_id: result.active.has(`${product.id}:base`) ? result.pricing.activeId : result.pricing.normalId,
      portions: product.portions.map((portion) => ({
        id: portion.id,
        label: portion.label,
        label_km: portion.labelKm,
        label_en: portion.labelEn,
        label_zh: portion.labelZh,
        price_minor: priceMinor(Number(portion.priceCents), currency),
        price_list_id: result.active.has(`${product.id}:${portion.id}`) ? result.pricing.activeId : result.pricing.normalId
      })),
      modifier_groups: modifierGroups(product.modifierGroups, currency)
    }))
  });
}
__name(getCatalog, "getCatalog");
function saleLineEdits(line) {
  const free = line.is_free === void 0 ? false : boolean(line.is_free, "is_free");
  const discount = integer(line.discount_minor ?? 0, "discount_minor", 0);
  const discountBps = line.discount_bps == null ? null : integer(line.discount_bps, "discount_bps", 1, 1e4);
  const discountNote = optionalText(line.discount_note, "discount note", 250);
  const freeReason = optionalText(line.free_reason, "free item reason", 250);
  if (free && (discount !== 0 || discountBps != null)) invalid("A free item cannot have a line discount");
  if (discountNote != null && discount === 0 && discountBps == null)
    invalid("A discount note requires a line discount");
  if (!free && freeReason != null) invalid("A free item reason requires a free item");
  return {
    base_price_override_minor: line.base_price_override_minor == null ? null : integer(line.base_price_override_minor, "base_price_override_minor", 0),
    is_free: free,
    free_reason: freeReason,
    discount_minor: discount,
    discount_bps: discountBps,
    discount_note: discountNote,
    note: optionalText(line.note, "line note"),
    price_change_reason: optionalText(line.price_change_reason, "price change reason", 250)
  };
}
__name(saleLineEdits, "saleLineEdits");
async function saleLines(env, deps, context, value, currency, taxMode, taxRate, taxRule, saved = []) {
  const inputs = list(value, "lines", 60).map((entry) => {
    const line = object(entry);
    requireLinePermissions(context, line, saved.find((old) => line.line_key != null && old.line_key === line.line_key));
    const modifiers2 = list(line.modifier_ids ?? [], "modifier_ids", 120).map(
      (id2) => recordId(id2, "modifier ID")
    );
    if (new Set(modifiers2).size !== modifiers2.length)
      invalid("Modifier IDs must be distinct");
    return {
      productId: recordId(line.product_id, "product_id"),
      portionId: line.portion_id == null ? null : recordId(line.portion_id, "portion_id"),
      modifiers: modifiers2,
      quantity: saleQuantity(line.quantity),
      edits: saleLineEdits(line)
    };
  });
  if (!inputs.length) invalid("A bill needs at least one line");
  const scope = catalogScope(context);
  const rows = await sql(
    context.db,
    scope.products + " AND p.id IN (SELECT value FROM json_each(?4))",
    ...scope.params,
    context.profile.branch_id,
    JSON.stringify([...new Set(inputs.map((line) => line.productId))])
  ).all();
  const result = await priced(env, deps, context, rows.results);
  const products = new Map(
    result.products.map((product) => [product.id, product])
  );
  return inputs.map((input, index) => {
    const product = products.get(input.productId);
    if (!product)
      conflict(
        "A product is unavailable for this profile",
        "SELECTION_CHANGED"
      );
    const portion = product.portions.find(
      (entry) => entry.id === input.portionId
    );
    if ((product.portions.length || input.portionId) && !portion) {
      conflict("Choose an available portion", "SELECTION_CHANGED");
    }
    const modifiers2 = modifierGroups(product.modifierGroups, currency).flatMap(
      (group) => {
        const selected = group.options.filter(
          (option) => input.modifiers.includes(option.id)
        );
        if (group.required && !selected.length || !group.multiple && selected.length > 1) {
          conflict(
            "Modifier selections do not satisfy this product's rules",
            "SELECTION_CHANGED"
          );
        }
        return selected.map((option) => ({ ...option, group_id: group.id }));
      }
    );
    if (modifiers2.length !== input.modifiers.length)
      conflict("A modifier is unavailable", "SELECTION_CHANGED");
    const base = priceMinor(
      Number(portion?.priceCents ?? product.priceCents),
      currency
    );
    const unitPrice = input.edits.is_free ? 0 : (input.edits.base_price_override_minor ?? base) + modifiers2.reduce((sum, option) => sum + option.price_minor, 0);
    const gross = lineGross(unitPrice, input.quantity);
    if (unitPrice < 0)
      conflict(
        "The selected options produce a negative line price",
        "INVALID_PRICING"
      );
    if (gross > MAX_AMOUNT)
      conflict("The line amount exceeds the POS limit", "AMOUNT_LIMIT");
    const key = `${input.productId}:${input.portionId ?? "base"}`;
    return {
      id: newId("posl"),
      line_number: index + 1,
      product_id: input.productId,
      product_code: product.code,
      product_name: product.name,
      portion_id: input.portionId,
      portion_name: portion ? String(
        portion.label || portion.labelKm || portion.labelEn || portion.labelZh || ""
      ) : null,
      price_list_id: result.active.has(key) ? result.pricing.activeId : result.pricing.normalId,
      modifiers: modifiers2,
      quantity: input.quantity,
      unit_price_minor: unitPrice,
      ...input.edits,
      ...saleLineTotals(gross, taxMode, taxRate, taxRule, input.edits.discount_minor, input.edits.discount_bps)
    };
  });
}
__name(saleLines, "saleLines");

// worker/posApiCustomers.ts
var customerColumns = "id name external_reference is_walk_in phone_number address customer_group_id gender dob email photo customer_code is_membership allow_credit";
var customerFrom = `FROM pos_customers c LEFT JOIN pos_customer_groups g
    ON g.id=c.customer_group_id AND g.business_id=c.business_id
  WHERE c.business_id=?`;
var customerDetails = customerColumns.split(" ").map((key) => "c." + key).join(",") + ", g.name AS customer_group_name";
var hasCustomerPhoto = "EXISTS (SELECT 1 FROM pos_customer_photos p WHERE p.customer_id=c.id)";
var customerSelect = `SELECT ${customerDetails}, ${hasCustomerPhoto} AS has_uploaded_photo ${customerFrom}`;
var groupSelect = "SELECT id,name FROM pos_customer_groups WHERE business_id=?";
var customerOrder = "c.name COLLATE NOCASE,c.id";
var customerFields = {
  external_reference: 120,
  customer_code: 120,
  phone_number: 50,
  address: 1e3,
  customer_group_id: 80,
  gender: 50,
  dob: 10,
  email: 254,
  photo: 2048
};
function parseCustomer(body, creating) {
  const fields2 = {};
  if (creating || body.name !== void 0) fields2.name = string(body.name, "name");
  for (const [field, limit] of Object.entries(customerFields)) {
    if (body[field] !== void 0) fields2[field] = optionalText(body[field], field, limit);
  }
  if (fields2.customer_group_id) recordId(fields2.customer_group_id, "customer_group_id");
  if (fields2.dob && !validBookingDate(fields2.dob)) invalid("Enter a valid date of birth (YYYY-MM-DD)");
  if (fields2.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields2.email)) invalid("Enter a valid email address");
  if (fields2.photo) {
    const url = URL.parse(fields2.photo);
    if (!url || !["https:", "http:"].includes(url.protocol) || url.username || url.password)
      invalid("Enter an HTTP or HTTPS photo URL");
  }
  const flags = {};
  for (const field of ["is_membership", "allow_credit"]) {
    if (body[field] !== void 0) flags[field] = Number(boolean(body[field], field));
  }
  return { ...fields2, ...flags };
}
__name(parseCustomer, "parseCustomer");
function customerWriteError(error3) {
  if (String(error3).includes("pos_customer_membership_requires_code"))
    invalid("Customer code is required for membership");
  throw error3;
}
__name(customerWriteError, "customerWriteError");
function groupCondition(businessId, group) {
  return group ? { query: "EXISTS (SELECT 1 FROM pos_customer_groups WHERE business_id=? AND id=?)", params: [businessId, group] } : { query: "1", params: [] };
}
__name(groupCondition, "groupCondition");
function customerWrite(db, businessId, record, creating, fields2) {
  const columns = Object.keys(fields2);
  if (!columns.length) return null;
  const values = Object.values(fields2);
  const group = groupCondition(businessId, fields2.customer_group_id);
  return creating ? sql(
    db,
    `INSERT INTO pos_customers (id,business_id,${columns.join(",")})
        SELECT ?,?,${columns.map(() => "?").join(",")} WHERE ${group.query}`,
    record,
    businessId,
    ...values,
    ...group.params
  ) : sql(
    db,
    `UPDATE pos_customers SET ${columns.map((field) => field + "=?").join(",")}
        WHERE business_id=? AND id=? AND ${group.query}`,
    ...values,
    businessId,
    record,
    ...group.params
  );
}
__name(customerWrite, "customerWrite");
var maxPhotoBytes = 256 * 1024;
var maxEncodedPhotoBytes = 4 * Math.ceil(maxPhotoBytes / 3);
var imageTypes = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
function validateCustomerPhoto(contentType, image) {
  if (!imageTypes.has(contentType) || image.byteLength === 0 || image.byteLength > maxPhotoBytes)
    invalid("Upload a JPG, PNG or WebP photo up to 256 KB");
  const start = String.fromCharCode(...new Uint8Array(image, 0, Math.min(12, image.byteLength)));
  const valid = contentType === "image/webp" ? start.startsWith("RIFF") && start.slice(8, 12) === "WEBP" : contentType === "image/png" ? start.startsWith("\x89PNG\r\n\n") : start.startsWith("\xFF\xD8\xFF");
  if (!valid) invalid("Upload a valid JPG, PNG or WebP photo");
  return { contentType, image };
}
__name(validateCustomerPhoto, "validateCustomerPhoto");
function registerPhotoUpload(value) {
  if (value === void 0) return;
  const upload = object(value);
  const contentType = string(upload.content_type, "photo content type");
  const encoded = string(upload.image, "photo", maxEncodedPhotoBytes);
  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    invalid("Invalid photo data");
  }
  return validateCustomerPhoto(contentType, Uint8Array.from(decoded, (byte) => byte.charCodeAt(0)).buffer);
}
__name(registerPhotoUpload, "registerPhotoUpload");
async function customerUpload(request) {
  const tooLarge = /* @__PURE__ */ __name(() => new PosError(413, "REQUEST_TOO_LARGE", "Customer photo upload is too large"), "tooLarge");
  const maxRequestBytes = maxPhotoBytes + 32 * 1024;
  if (Number(request.headers.get("content-length")) > maxRequestBytes) throw tooLarge();
  if (!request.body) invalid("Send customer data and a photo");
  let size = 0;
  const limited = request.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxRequestBytes) throw tooLarge();
      controller.enqueue(chunk);
    }
  }));
  const form = await new Response(limited, { headers: request.headers }).formData().catch((error3) => {
    if (error3 instanceof PosError) throw error3;
    invalid("Send customer data and a photo");
  });
  const data = form.get("customer");
  const file = form.get("photo");
  if (typeof data !== "string") invalid("Send customer data");
  if (!(file instanceof File) || file.size === 0 || file.size > maxPhotoBytes || !imageTypes.has(file.type))
    invalid("Upload a JPG, PNG or WebP photo up to 256 KB");
  let body;
  try {
    body = JSON.parse(data);
  } catch {
    invalid("Malformed customer data");
  }
  return { body: object(body), upload: validateCustomerPhoto(file.type, await file.arrayBuffer()) };
}
__name(customerUpload, "customerUpload");
async function customerPhoto(db, businessId, id2) {
  const photo2 = await sql(db, `SELECT p.content_type,p.image FROM pos_customer_photos p
    JOIN pos_customers c ON c.id=p.customer_id WHERE c.business_id=? AND c.id=?`, businessId, id2).first();
  if (!photo2) missing("Customer photo");
  return { contentType: photo2.content_type, bytes: new Uint8Array(photo2.image) };
}
__name(customerPhoto, "customerPhoto");
async function readCustomerPhoto(db, businessId, id2) {
  const { contentType, bytes } = await customerPhoto(db, businessId, id2);
  return new Response(bytes, { headers: { "content-type": contentType } });
}
__name(readCustomerPhoto, "readCustomerPhoto");
async function readRegisterCustomerPhoto(context, id2) {
  const { contentType, bytes } = await customerPhoto(context.db, context.identity.business_id, id2);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return respond({ content_type: contentType, image: btoa(binary) });
}
__name(readRegisterCustomerPhoto, "readRegisterCustomerPhoto");
async function saveCustomer(db, businessId, body, record, creating, upload) {
  const fields2 = parseCustomer(body, creating);
  if (upload) fields2.photo = null;
  const statements = customerWrites(db, businessId, record, creating, fields2, upload);
  if (!statements.length) return;
  const [result] = await db.batch(statements).catch(customerWriteError);
  if (result.meta.changes) return;
  const group = fields2.customer_group_id;
  if (group && !await sql(db, "SELECT 1 FROM pos_customer_groups WHERE business_id=? AND id=?", businessId, group).first())
    invalid("Choose a customer group from this business");
  if (!creating) missing("Customer");
  conflict("The customer group changed. Refresh and retry.");
}
__name(saveCustomer, "saveCustomer");
function customerWrites(db, businessId, record, creating, fields2, upload) {
  const write = customerWrite(db, businessId, record, creating, fields2);
  if (!write) return [];
  const statements = [write];
  if (upload) {
    statements.push(sql(
      db,
      `INSERT INTO pos_customer_photos (customer_id,content_type,image)
      SELECT ?,?,? WHERE changes()=1
      ON CONFLICT(customer_id) DO UPDATE SET content_type=excluded.content_type,image=excluded.image`,
      record,
      upload.contentType,
      upload.image
    ));
  } else if (fields2.photo !== void 0) {
    statements.push(sql(db, "DELETE FROM pos_customer_photos WHERE customer_id=? AND changes()=1", record));
  }
  return statements;
}
__name(customerWrites, "customerWrites");
var deletableCustomer = `FROM pos_customers AS customer
  WHERE business_id=? AND id=? AND is_walk_in=0 AND NOT EXISTS (
    SELECT 1 FROM pos_profiles WHERE business_id=customer.business_id AND (
      json_extract(config_json,'$.default_customer_id')=customer.id OR
      json_extract(pending_config_json,'$.default_customer_id')=customer.id
    )
  )`;
async function customerDeleteError(db, businessId, id2) {
  const walkIn = await sql(db, "SELECT is_walk_in FROM pos_customers WHERE business_id=? AND id=?", businessId, id2).first("is_walk_in");
  if (walkIn === null) missing("Customer");
  if (walkIn) conflict("The walk-in customer cannot be deleted");
  conflict("Change the default customer in all POS profiles that use this customer before deleting");
}
__name(customerDeleteError, "customerDeleteError");
async function registerCustomerDirectory(request, url, context, resource, id2, readOnly) {
  const { db, identity: { business_id: businessId } } = context;
  if (request.method === "GET") {
    if (resource === "customer-groups")
      return respond(await pageOf(db, url, "customer_groups", `${groupSelect} ORDER BY name,id`, [businessId]));
    if (!id2)
      return respond(await pageOf(db, url, "customers", `${customerSelect} ORDER BY c.is_walk_in DESC,${customerOrder}`, [businessId]));
    const row = await sql(db, `${customerSelect} AND c.id=?`, businessId, id2).first();
    if (!row) missing("Customer");
    return respond(row);
  }
  if (resource !== "customers" || !(id2 ? ["PATCH", "DELETE"] : ["POST"]).includes(request.method))
    return respond({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  const body = request.method === "DELETE" ? void 0 : await bodyOf(request, maxEncodedPhotoBytes + 32e3);
  const command = await Command.read(request, context, body && { body, envelope: body });
  if (command instanceof Response) return command;
  if (readOnly)
    throw new PosError(402, "SUBSCRIPTION_EXPIRED", "Customer changes require an active subscription");
  try {
    if (id2 && request.method === "DELETE") {
      const params2 = [businessId, id2];
      const eligible = `SELECT 1 ${deletableCustomer}`;
      if (!await sql(db, eligible, ...params2).first())
        return await customerDeleteError(db, businessId, id2);
      return await command.commit(200, {
        query: `EXISTS (${eligible})`,
        params: params2,
        allowStoreAuthority: true
      }, [sql(db, `DELETE ${deletableCustomer}`, ...params2)], {
        query: `SELECT json_object('success',json('true'))`,
        params: []
      });
    }
    const creating = !id2;
    const record = id2 ?? newId("posc");
    const fields2 = parseCustomer(command.body, creating);
    const upload = registerPhotoUpload(command.body.photo_upload);
    if (upload) fields2.photo = null;
    const group = groupCondition(businessId, fields2.customer_group_id);
    if (!await sql(db, `SELECT 1 WHERE ${group.query}`, ...group.params).first())
      invalid("Choose a customer group from this business");
    const matching = `${customerFrom} AND c.id=?`;
    const params = [businessId, record];
    if (!creating && !await sql(db, `SELECT 1 ${matching}`, ...params).first()) missing("Customer");
    return await command.commit(creating ? 201 : 200, {
      query: creating ? group.query : `${group.query} AND EXISTS (SELECT 1 ${matching})`,
      params: creating ? group.params : [...group.params, ...params],
      allowStoreAuthority: true
    }, customerWrites(db, businessId, record, creating, fields2, upload), {
      query: `SELECT ${jsonRow("c", customerColumns, { customer_group_name: "g.name", has_uploaded_photo: hasCustomerPhoto })} ${matching}`,
      params
    });
  } catch (error3) {
    const replay = await command.replay();
    if (replay) return replay;
    customerWriteError(error3);
  }
}
__name(registerCustomerDirectory, "registerCustomerDirectory");
var customerPhoneDigits = ["' '", "'+'", "'-'", "'('", "')'", "'.'", "char(160)"].reduce((value, separator) => `replace(${value},${separator},'')`, "c.phone_number");
async function adminCustomerPage(db, url, businessId) {
  const sortBy = choice(
    url.searchParams.get("sort_by") ?? "name",
    "sort_by",
    ["name", "phone_number", "customer_code"]
  );
  const direction = choice(
    url.searchParams.get("sort_direction") ?? "asc",
    "sort_direction",
    ["asc", "desc"]
  );
  const search = (url.searchParams.get("search") ?? "").trim();
  if (search.length > 120) invalid("Customer search must be at most 120 characters");
  const params = [businessId];
  let filter = "";
  if (search) {
    const matches = [
      "instr(lower(c.name),lower(?))>0",
      "instr(lower(c.customer_code),lower(?))>0",
      "instr(c.phone_number,?)>0"
    ];
    params.push(search, search, search);
    const digits = /^[+\d\s().-]+$/.test(search) ? search.replace(/\D/g, "") : "";
    if (digits) {
      matches.push(`instr(${customerPhoneDigits},?)>0`);
      params.push(digits);
    }
    filter = ` AND (${matches.join(" OR ")})`;
  }
  const order = sortBy === "name" ? `c.name COLLATE NOCASE ${direction},c.id` : `nullif(c.${sortBy},'') COLLATE NOCASE ${direction} NULLS LAST,${customerOrder}`;
  return pageOf(db, url, "customers", `${customerSelect}${filter} ORDER BY ${order}`, params);
}
__name(adminCustomerPage, "adminCustomerPage");
async function manageCustomerDirectory(request, url, db, businessId, resource, id2) {
  const groups = resource === "customer-groups";
  const entity = groups ? "Customer group" : "Customer";
  const select = groups ? groupSelect : customerSelect;
  const read2 = /* @__PURE__ */ __name((record2) => sql(db, select + (groups ? " AND id=?" : " AND c.id=?"), businessId, record2).first(), "read");
  if (request.method === "GET") {
    if (!id2) {
      return respond(groups ? await pageOf(db, url, "customer_groups", `${groupSelect} ORDER BY name,id`, [businessId]) : await adminCustomerPage(db, url, businessId));
    }
    const existing = await read2(id2);
    if (!existing) missing(entity);
    return respond(existing);
  }
  if (request.method === "DELETE" && id2) {
    if (groups) {
      const result = await sql(db, "DELETE FROM pos_customer_groups WHERE business_id=? AND id=?", businessId, id2).run();
      if (!result.meta.changes) missing(entity);
    } else {
      const result = await sql(db, `DELETE ${deletableCustomer}`, businessId, id2).run();
      if (!result.meta.changes) await customerDeleteError(db, businessId, id2);
    }
    return respond({ success: true });
  }
  if (request.method !== (id2 ? "PATCH" : "POST"))
    return respond({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  const record = id2 ?? newId(groups ? "poscg" : "posc");
  if (groups) {
    const body = await bodyOf(request);
    if (body.name !== void 0 || !id2) {
      const name = string(body.name, "name");
      const result = id2 ? await sql(db, "UPDATE pos_customer_groups SET name=? WHERE business_id=? AND id=?", name, businessId, id2).run() : await sql(db, "INSERT INTO pos_customer_groups (id,business_id,name) VALUES (?,?,?)", record, businessId, name).run();
      if (id2 && !result.meta.changes) missing(entity);
    }
  } else {
    const data = request.headers.get("content-type")?.startsWith("multipart/form-data") ? await customerUpload(request) : { body: await bodyOf(request), upload: void 0 };
    await saveCustomer(db, businessId, data.body, record, !id2, data.upload);
  }
  const saved = await read2(record);
  if (!saved) missing(entity);
  return respond(saved, id2 ? 200 : 201);
}
__name(manageCustomerDirectory, "manageCustomerDirectory");

// worker/posApiDevices.ts
var proofWindow = 120;
var accessLifetime = 43200;
function issuePosToken(lifetime) {
  return {
    token: "possession_" + crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
    expiresAt: Math.floor(Date.now() / 1e3) + lifetime
  };
}
__name(issuePosToken, "issuePosToken");
function hex(value, field, bytes) {
  if (typeof value !== "string" || value.length !== bytes * 2 || !/^[a-f0-9]+$/.test(value))
    invalid(`Invalid ${field}`);
  return value;
}
__name(hex, "hex");
function decodeHex(value) {
  return Uint8Array.from(
    value.match(/../g),
    (byte) => Number.parseInt(byte, 16)
  );
}
__name(decodeHex, "decodeHex");
function invalidProof() {
  throw new PosError(
    401,
    "INVALID_DEVICE_CREDENTIAL",
    "Sign in to enroll this POS device"
  );
}
__name(invalidProof, "invalidProof");
var grantRequired = `(m.role IN ('owner','manager') OR EXISTS (
  SELECT 1 FROM pos_profile_grants g
  WHERE g.business_id=p.business_id AND g.profile_id=p.id AND g.user_id=m.user_id
))`;
var activeCaller = `
  FROM pos_sessions s
  JOIN pos_profiles p ON p.business_id=s.business_id AND p.id=s.profile_id AND p.is_active=1
  JOIN branches b ON b.business_id=p.business_id AND b.id=p.branch_id AND b.is_active=1
  JOIN businesses business ON business.id=p.business_id AND business.is_active=1
  JOIN memberships m ON m.business_id=s.business_id AND m.user_id=s.user_id
  JOIN users u ON u.id=m.user_id AND u.password_salt=s.credential_version
  WHERE s.token_hash=? AND s.expires_at>unixepoch()
    AND ${activeDeviceSession} AND ${grantRequired} AND ${posPlanEnabled("p.business_id")}`;
var credentialFields = "id,device_id,device_name,user_id,created_at,last_used_at,revoked_at";
async function registerDevice(context, request) {
  const body = await bodyOf(request);
  const deviceId = recordId(body.device_id, "device_id");
  const name = string(body.device_name, "device_name", 80);
  const publicKey = hex(body.public_key, "public_key", 32);
  const { db, identity, profile } = context;
  const token = identity.token_hash;
  const device = "posdev_" + crypto.randomUUID().replaceAll("-", "");
  const [registered] = await db.batch([
    sql(
      db,
      `INSERT INTO pos_device_credentials
        (id,business_id,profile_id,user_id,device_id,device_name,public_key,credential_version,created_at,last_used_at)
        SELECT ?,s.business_id,s.profile_id,s.user_id,?,?,?,s.credential_version,unixepoch(),unixepoch()
        ${activeCaller} AND s.issued_by_device=0
        ON CONFLICT (business_id,profile_id,user_id,device_id) DO UPDATE SET
          device_name=excluded.device_name, credential_version=excluded.credential_version,
          revoked_at=NULL, last_used_at=unixepoch()
        WHERE pos_device_credentials.public_key=excluded.public_key
        RETURNING ${credentialFields}`,
      device,
      deviceId,
      name,
      publicKey,
      token
    ),
    sql(
      db,
      `UPDATE pos_sessions SET device_credential_id=(
        SELECT id FROM pos_device_credentials WHERE business_id=? AND profile_id=? AND user_id=?
          AND device_id=? AND public_key=? AND revoked_at IS NULL
      ) WHERE token_hash=? AND issued_by_device=0 AND device_credential_id IS NULL
        AND EXISTS (SELECT 1 ${activeCaller})`,
      identity.business_id,
      profile.id,
      identity.user_id,
      deviceId,
      publicKey,
      token,
      token
    )
  ]);
  if (!registered.results.length) {
    const caller = await sql(
      db,
      `SELECT s.issued_by_device ${activeCaller}`,
      token
    ).first();
    if (!caller || caller.issued_by_device) {
      throw new PosError(
        403,
        "PASSWORD_SESSION_REQUIRED",
        "Sign in with a password to enroll a POS device"
      );
    }
    throw new PosError(
      409,
      "DEVICE_KEY_CHANGED",
      "Use the enrolled key or set up a new device"
    );
  }
  return respond(registered.results[0], 201);
}
__name(registerDevice, "registerDevice");
async function renewDeviceSession(db, request) {
  const body = await bodyOf(request);
  const id2 = recordId(body.credential_id, "credential_id");
  const nonce = hex(body.nonce, "nonce", 32);
  const proof = hex(body.signature, "signature", 64);
  const issuedAt = integer(body.issued_at, "issued_at", 0);
  const now = Math.floor(Date.now() / 1e3);
  if (Math.abs(now - issuedAt) > proofWindow) {
    throw new PosError(
      409,
      "DEVICE_PROOF_EXPIRED",
      "Check the POS device date and time"
    );
  }
  const credential = await sql(
    db,
    `SELECT d.public_key, ${posPlanEnabled("d.business_id")} AS pos_enabled
     FROM pos_device_credentials d WHERE d.id=? AND d.revoked_at IS NULL`,
    id2
  ).first();
  if (!credential) invalidProof();
  let verified = false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      decodeHex(credential.public_key),
      "Ed25519",
      false,
      ["verify"]
    );
    verified = await crypto.subtle.verify(
      "Ed25519",
      key,
      decodeHex(proof),
      new TextEncoder().encode(
        `emenu.pos.device-session.v1
${id2}
${issuedAt}
${nonce}`
      )
    );
  } catch {
    invalidProof();
  }
  if (!verified) invalidProof();
  requirePosPlan(credential.pos_enabled);
  const { token, expiresAt } = issuePosToken(accessLifetime);
  const hash2 = await digest(token);
  const [, , minted] = await db.batch([
    sql(db, "DELETE FROM pos_device_proofs WHERE expires_at<?", now),
    sql(
      db,
      `INSERT INTO pos_device_proofs (credential_id,nonce,session_hash,expires_at)
        SELECT d.id,?,?,? FROM pos_device_credentials d
        JOIN pos_profiles p ON p.business_id=d.business_id AND p.id=d.profile_id AND p.is_active=1
        JOIN branches b ON b.business_id=p.business_id AND b.id=p.branch_id AND b.is_active=1
        JOIN businesses business ON business.id=p.business_id AND business.is_active=1
        JOIN memberships m ON m.business_id=d.business_id AND m.user_id=d.user_id
        JOIN users u ON u.id=m.user_id AND u.password_salt=d.credential_version
        WHERE d.id=? AND d.public_key=? AND d.revoked_at IS NULL AND ${grantRequired}
          AND ${posPlanEnabled("d.business_id")}
        ON CONFLICT (credential_id,nonce) DO NOTHING`,
      nonce,
      hash2,
      issuedAt + proofWindow,
      id2,
      credential.public_key
    ),
    sql(
      db,
      `INSERT INTO pos_sessions
        (token_hash,business_id,user_id,profile_id,credential_version,expires_at,device_credential_id,issued_by_device)
        SELECT ?,d.business_id,d.user_id,d.profile_id,d.credential_version,?,d.id,1
        FROM pos_device_credentials d JOIN pos_device_proofs proof ON proof.credential_id=d.id
        WHERE d.id=? AND proof.nonce=? AND proof.session_hash=?
        RETURNING profile_id,user_id`,
      hash2,
      expiresAt,
      id2,
      nonce,
      hash2
    ),
    sql(
      db,
      `UPDATE pos_device_credentials SET last_used_at=unixepoch()
        WHERE id=? AND EXISTS (SELECT 1 FROM pos_sessions WHERE token_hash=?)`,
      id2,
      hash2
    ),
    sql(
      db,
      "DELETE FROM pos_sessions WHERE device_credential_id=? AND expires_at<=unixepoch()",
      id2
    )
  ]);
  if (!minted.results.length) invalidProof();
  return respond(
    {
      token,
      expires_at: new Date(expiresAt * 1e3).toISOString(),
      ...minted.results[0]
    },
    201
  );
}
__name(renewDeviceSession, "renewDeviceSession");
async function listDevices(context, url) {
  const { db, identity, profile } = context;
  return respond(
    await pageOf(
      db,
      url,
      "devices",
      `SELECT ${credentialFields} FROM pos_device_credentials
      WHERE business_id=? AND profile_id=? AND (?=1 OR user_id=?)
      ORDER BY created_at DESC,id DESC`,
      [
        identity.business_id,
        profile.id,
        Number(privileged(identity.role)),
        identity.user_id
      ]
    )
  );
}
__name(listDevices, "listDevices");
async function revokeDevice(context, id2) {
  const { db, identity, profile } = context;
  const revoked = await sql(
    db,
    `UPDATE pos_device_credentials AS target SET revoked_at=COALESCE(revoked_at,unixepoch())
      WHERE id=? AND business_id=? AND profile_id=?
        AND EXISTS (SELECT 1 ${activeCaller}
          AND (s.user_id=target.user_id OR m.role IN ('owner','manager')))
      RETURNING id`,
    id2,
    identity.business_id,
    profile.id,
    identity.token_hash
  ).first();
  if (!revoked) missing("Device credential");
  return respond({ ok: true });
}
__name(revokeDevice, "revokeDevice");

// worker/posApiTaxRules.ts
function readTaxRules(value) {
  if (!Array.isArray(value)) invalid("tax_rules must be an array");
  const ids = /* @__PURE__ */ new Set();
  return value.map((entry, index) => {
    const rule = object(entry);
    const prefix = "tax_rules[" + index + "].";
    const id2 = rule.id === void 0 ? newId("tax") : recordId(rule.id, prefix + "id");
    if (ids.has(id2)) invalid("Tax rule IDs must be unique within the profile");
    ids.add(id2);
    const name = /* @__PURE__ */ __name((key) => {
      const value2 = rule[key];
      return typeof value2 === "string" && !value2.trim() ? "" : string(value2, prefix + key);
    }, "name");
    const rate = /* @__PURE__ */ __name((key) => {
      const value2 = rule[key];
      if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < 0 || value2 > 100) {
        invalid(prefix + key + " must be between 0 and 100");
      }
      return value2;
    }, "rate");
    const flag2 = /* @__PURE__ */ __name((key) => boolean(rule[key], prefix + key), "flag");
    return {
      id: id2,
      tax_name: string(rule.tax_name, prefix + "tax_name"),
      tax_mode: choice(rule.tax_mode === void 0 ? "disabled" : rule.tax_mode, prefix + "tax_mode", posTaxModes),
      tax_1_name: name("tax_1_name"),
      tax_1_rate: rate("tax_1_rate"),
      calculate_tax_1_after_discount: flag2("calculate_tax_1_after_discount"),
      tax_2_name: name("tax_2_name"),
      tax_2_rate: rate("tax_2_rate"),
      calculate_tax_2_after_adding_tax_1: flag2("calculate_tax_2_after_adding_tax_1"),
      calculate_tax_2_after_discount: flag2("calculate_tax_2_after_discount"),
      tax_3_name: name("tax_3_name"),
      tax_3_rate: rate("tax_3_rate"),
      calculate_tax_3_after_adding_tax_1: flag2("calculate_tax_3_after_adding_tax_1"),
      calculate_tax_3_after_adding_tax_2: flag2("calculate_tax_3_after_adding_tax_2"),
      calculate_tax_3_after_discount: flag2("calculate_tax_3_after_discount")
    };
  });
}
__name(readTaxRules, "readTaxRules");

// worker/posApiShiftReports.ts
var registerManager = /* @__PURE__ */ __name((role) => role === "manager" || role === "owner", "registerManager");
function shiftNameColumns(alias) {
  return `(SELECT display_name FROM users WHERE id=${alias}.opened_by) AS opened_by_name,
    (SELECT display_name FROM users WHERE id=${alias}.closed_by) AS closed_by_name`;
}
__name(shiftNameColumns, "shiftNameColumns");
function saleTotals(context, column, id2) {
  return sql(
    context.db,
    `SELECT currency,secondary_exchange_rate AS exchange_rate,sum(total_minor) AS amount_minor,
      sum(CASE WHEN reverses_sale_id IS NULL THEN 1 ELSE 0 END) AS paid_bills
    FROM sales WHERE ${column}=? AND status='paid' GROUP BY currency,secondary_exchange_rate`,
    id2
  );
}
__name(saleTotals, "saleTotals");
function shiftPayments(context, id2) {
  return sql(
    context.db,
    `SELECT p.payment_type_id,max(p.payment_type_name) AS payment_type_name,p.payment_kind,p.currency,
      sum(p.amount_minor) AS amount_minor,
      sum(CASE WHEN s.reverses_sale_id IS NULL THEN p.amount_minor ELSE 0 END) AS payments_minor,
      sum(CASE WHEN s.reverses_sale_id IS NOT NULL THEN p.amount_minor ELSE 0 END) AS reversals_minor
    FROM sales s JOIN sale_payments p ON p.sale_id=s.id
    WHERE s.shift_id=? AND s.status='paid'
    GROUP BY p.payment_type_id,p.payment_kind,p.currency ORDER BY p.payment_type_id,p.currency`,
    id2
  );
}
__name(shiftPayments, "shiftPayments");
async function shiftSummary(context, id2, drawerCounts) {
  const [sales, payments, cash, activity, drawer] = await context.db.batch([
    saleTotals(context, "shift_id", id2),
    shiftPayments(context, id2),
    sql(
      context.db,
      `SELECT currency,kind,sum(amount_minor) AS amount_minor FROM cash_floats
      WHERE shift_id=? GROUP BY currency,kind`,
      id2
    ),
    sql(
      context.db,
      `SELECT f.*,u.display_name AS created_by_name FROM cash_floats f
      LEFT JOIN users u ON u.id=f.created_by WHERE f.shift_id=? AND f.kind<>'opening'
      ORDER BY f.created_at DESC,f.id DESC LIMIT 10`,
      id2
    ),
    ...drawerCounts == null ? [] : [drawerCounts]
  ]);
  return {
    sales: sales.results,
    payments: payments.results,
    cash: cash.results.filter((row) => row.kind !== "opening" || registerManager(context.identity.role)),
    movements: activity.results,
    drawer_counts: drawer?.results ?? []
  };
}
__name(shiftSummary, "shiftSummary");
async function daySummary(context, id2) {
  requireManager(context.identity.role);
  const db = context.db;
  const [sales, shifts, bills, discrepancies, registers] = await db.batch([
    saleTotals(context, "working_day_id", id2),
    sql(
      db,
      `SELECT s.id,s.profile_id,p.name AS profile_name,s.opened_at,s.closed_at,
        ${shiftNameColumns("s")}
      FROM cashier_shifts s JOIN pos_profiles p ON p.id=s.profile_id
      WHERE s.working_day_id=? ORDER BY s.opened_at,s.id`,
      id2
    ),
    sql(
      db,
      `SELECT s.id,s.profile_id,p.name AS profile_name,s.table_code FROM sales s
      JOIN pos_profiles p ON p.id=s.profile_id WHERE s.working_day_id=? AND s.status IN ('open','submitted','bill_requested')
      ORDER BY p.name,s.id`,
      id2
    ),
    sql(
      db,
      `SELECT c.shift_id,c.payment_type_name,c.currency,c.variance_minor FROM cashier_shift_closing_counts c
      JOIN cashier_shifts s ON s.id=c.shift_id WHERE s.working_day_id=? AND c.variance_minor<>0
      ORDER BY s.opened_at,s.id,c.payment_type_id,c.currency`,
      id2
    ),
    sql(db, `SELECT profile_id FROM sales WHERE working_day_id=? AND status='paid' GROUP BY profile_id`, id2)
  ]);
  return {
    sales: sales.results,
    shifts: shifts.results,
    open_bills: bills.results,
    register_count: new Set([...shifts.results, ...bills.results, ...registers.results].map((row) => row.profile_id)).size,
    discrepancies: discrepancies.results
  };
}
__name(daySummary, "daySummary");
async function readShiftAudit(db, url, businessId) {
  return respond(await pageOf(db, url, "events", `
    WITH lifecycle AS MATERIALIZED (
      SELECT id||':open' AS id,'open_day' AS action,opened_at AS occurred_at,opened_by AS actor_id,
        branch_id,NULL AS profile_id,id AS reference,NULL AS reason,NULL AS reason_code,
        NULL AS currency,NULL AS amount_minor,NULL AS counts_json,NULL AS original_actor_id
      FROM working_days WHERE business_id=?1
      UNION ALL SELECT id||':close','close_day',closed_at,closed_by,branch_id,NULL,id,NULL,NULL,NULL,NULL,NULL,NULL
      FROM working_days WHERE business_id=?1 AND closed_at IS NOT NULL
      UNION ALL SELECT id||':open','open_shift',opened_at,opened_by,branch_id,profile_id,id,NULL,NULL,NULL,NULL,NULL,NULL
      FROM cashier_shifts WHERE business_id=?1
      UNION ALL SELECT s.id||':close','close_shift',s.closed_at,s.closed_by,s.branch_id,s.profile_id,s.id,NULL,NULL,NULL,NULL,
        (SELECT json_group_array(json_object('payment_type_name',payment_type_name,'currency',currency,
          'expected_minor',expected_minor,'declared_minor',declared_minor,'variance_minor',variance_minor))
          FROM cashier_shift_closing_counts WHERE shift_id=s.id),NULL
      FROM cashier_shifts s WHERE s.business_id=?1 AND s.closed_at IS NOT NULL
    ), adjustments AS MATERIALIZED (
      SELECT r.id||':close','close_shift',r.previous_closed_at,r.previous_closed_by,s.branch_id,s.profile_id,s.id,
        NULL,NULL,NULL,NULL,r.previous_counts_json,NULL
      FROM cashier_shift_reopens r JOIN cashier_shifts s ON s.id=r.shift_id WHERE s.business_id=?1
      UNION ALL SELECT r.id,'reopen_shift',r.reopened_at,r.reopened_by,s.branch_id,s.profile_id,s.id,r.reason,NULL,NULL,NULL,NULL,NULL
      FROM cashier_shift_reopens r JOIN cashier_shifts s ON s.id=r.shift_id WHERE s.business_id=?1
      UNION ALL SELECT f.id,f.kind,f.created_at,f.created_by,s.branch_id,s.profile_id,s.id,f.reason,f.reason_code,f.currency,f.amount_minor,NULL,NULL
      FROM cash_floats f JOIN cashier_shifts s ON s.id=f.shift_id WHERE s.business_id=?1
      UNION ALL SELECT r.command_id||':approve','recover_sync',r.approved_at,r.approved_by,r.branch_id,r.profile_id,
        r.command_id,r.reason,NULL,NULL,NULL,NULL,r.operator_id
      FROM pos_store_recoveries r WHERE r.business_id=?1
    ), audit AS (
      SELECT * FROM lifecycle UNION ALL SELECT * FROM adjustments
    )
    SELECT a.*,u.display_name AS actor_name,o.display_name AS original_actor_name,
      b.name AS branch_name,p.name AS profile_name,business.timezone
    FROM audit a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN users o ON o.id=a.original_actor_id
    JOIN branches b ON b.id=a.branch_id LEFT JOIN pos_profiles p ON p.id=a.profile_id
    JOIN businesses business ON business.id=b.business_id
    ORDER BY a.occurred_at DESC,a.id DESC`, [businessId]));
}
__name(readShiftAudit, "readShiftAudit");

// worker/posApiShifts.ts
var dayColumns = "id branch_id business_date timezone opened_at opened_by closed_at closed_by base_currency";
var shiftColumns = "id branch_id profile_id working_day_id opened_at opened_by closed_at closed_by activity_revision base_currency exchange_rate note";
var dayJson = jsonRow("d", dayColumns);
var shiftJson = jsonRow("s", shiftColumns);
function selectDay(context, id2) {
  return sql(
    context.db,
    `SELECT * FROM working_days WHERE business_id=? AND branch_id=?
    AND ${id2 ? "id=?" : "closed_at IS NULL"}`,
    context.identity.business_id,
    context.profile.branch_id,
    ...id2 ? [id2] : []
  ).first();
}
__name(selectDay, "selectDay");
function selectShift(context, id2, branch2 = false) {
  return sql(
    context.db,
    `SELECT * FROM cashier_shifts WHERE business_id=? AND ${branch2 ? "branch_id" : "profile_id"}=?
    AND ${id2 ? "id=?" : "closed_at IS NULL"}`,
    context.identity.business_id,
    branch2 ? context.profile.branch_id : context.profile.id,
    ...id2 ? [id2] : []
  ).first();
}
__name(selectShift, "selectShift");
async function operatingContext(context, requireShift = true) {
  const [day, shift] = await Promise.all([
    context.config.working_day_enabled ? selectDay(context) : null,
    context.config.cashier_shift_enabled && requireShift ? selectShift(context) : null
  ]);
  if (context.config.working_day_enabled && !day)
    conflict("Open the working day first", "WORKING_DAY_REQUIRED");
  if (context.config.cashier_shift_enabled && requireShift && (!shift || shift.working_day_id !== (day?.id ?? null))) {
    conflict("Open a cashier shift first", "CASHIER_SHIFT_REQUIRED");
  }
  return { day, shift, businessDate: day?.business_date ?? context.localDate };
}
__name(operatingContext, "operatingContext");
function openGuard(day, shift) {
  return {
    query: `(? IS NULL OR EXISTS (SELECT 1 FROM working_days WHERE id=? AND closed_at IS NULL))
      AND (? IS NULL OR EXISTS (SELECT 1 FROM cashier_shifts WHERE id=? AND closed_at IS NULL))`,
    params: [
      day?.id ?? null,
      day?.id ?? null,
      shift?.id ?? null,
      shift?.id ?? null
    ]
  };
}
__name(openGuard, "openGuard");
function updateShiftActivity(context, shift) {
  return shift ? [
    sql(
      context.db,
      "UPDATE cashier_shifts SET activity_revision=activity_revision+1 WHERE id=?",
      shift.id
    )
  ] : [];
}
__name(updateShiftActivity, "updateShiftActivity");
var dayResult = /* @__PURE__ */ __name((id2) => ({
  query: `SELECT ${dayJson} FROM working_days d WHERE d.id=?`,
  params: [id2]
}), "dayResult");
var closingCounts = `SELECT payment_type_id,payment_type_name,currency,
  expected_minor,declared_minor,variance_minor FROM cashier_shift_closing_counts`;
var shiftResult = /* @__PURE__ */ __name((id2) => ({
  query: `SELECT ${jsonRow("s", shiftColumns, {
    business_date: "coalesce(d.business_date,s.business_date,date(s.opened_at))",
    opened_by_name: "(SELECT display_name FROM users WHERE id=s.opened_by)",
    closed_by_name: "(SELECT display_name FROM users WHERE id=s.closed_by)",
    profile_name: "p.name",
    closing_counts: `json((SELECT json_group_array(json_object('payment_type_id',payment_type_id,
      'payment_type_name',payment_type_name,'currency',currency,'expected_minor',expected_minor,
      'declared_minor',declared_minor,'variance_minor',variance_minor) ORDER BY payment_type_id,currency)
      FROM cashier_shift_closing_counts WHERE shift_id=s.id))`
  })} AS value FROM cashier_shifts s JOIN pos_profiles p ON p.id=s.profile_id
    LEFT JOIN working_days d ON d.id=s.working_day_id WHERE s.id=?`,
  params: [id2]
}), "shiftResult");
async function currentOperations(context) {
  const { db, identity, profile, config } = context;
  const [day, shift] = await Promise.all([
    config.working_day_enabled ? sql(
      db,
      `SELECT d.*, ${shiftNameColumns("d")} FROM working_days d
      WHERE business_id=? AND branch_id=? AND closed_at IS NULL`,
      identity.business_id,
      profile.branch_id
    ).first() : null,
    config.cashier_shift_enabled ? sql(
      db,
      `SELECT ${shiftColumns.replaceAll(" ", ",")}, ${shiftNameColumns("s")} FROM cashier_shifts s
      WHERE business_id=? AND profile_id=? AND closed_at IS NULL`,
      identity.business_id,
      profile.id
    ).first() : null
  ]);
  return { working_day: day, cashier_shift: shift };
}
__name(currentOperations, "currentOperations");
var latestShift = `s.id=(SELECT newer.id FROM cashier_shifts newer
  WHERE newer.business_id=s.business_id AND newer.profile_id=s.profile_id
  ORDER BY newer.opening_sequence DESC,newer.opened_at DESC,newer.id DESC LIMIT 1)`;
var reopenEligible = `s.closed_at IS NOT NULL AND ${latestShift}
  AND NOT EXISTS(SELECT 1 FROM cashier_shifts active
    WHERE active.profile_id=s.profile_id AND active.closed_at IS NULL)
  AND (s.working_day_id IS NULL OR EXISTS(SELECT 1 FROM working_days d
    WHERE d.id=s.working_day_id AND d.closed_at IS NULL))`;
async function readOperations(context, url, resource, id2, action) {
  const { db, identity, profile } = context;
  const days = resource === "working-days";
  const manager = registerManager(identity.role);
  const branch2 = manager && url.searchParams.get("scope") === "branch";
  if (!id2) {
    const table = days ? "working_days" : "cashier_shifts";
    const date = url.searchParams.get("business_date");
    const businessDate = "coalesce(d.business_date,s.business_date,(SELECT min(business_date) FROM sales WHERE shift_id=s.id),date(s.opened_at))";
    if (!days && (date || branch2 || url.searchParams.has("closed"))) {
      const filters = [`s.business_id=? AND s.${branch2 ? "branch_id" : "profile_id"}=?`];
      const params = [identity.business_id, branch2 ? profile.branch_id : profile.id];
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid("Choose a valid business date");
        filters.push(`${businessDate}=?`);
        params.push(date);
      }
      if (url.searchParams.has("closed")) filters.push("s.closed_at IS NOT NULL");
      for (const column of ["profile_id", "opened_by"]) {
        const filter = url.searchParams.get(column);
        if (branch2 && filter) {
          filters.push(`s.${column}=?`);
          params.push(recordId(filter, column));
        }
      }
      const data = await pageOf(
        db,
        url,
        table,
        `SELECT s.id,s.profile_id,s.working_day_id,s.opened_at,s.opened_by,s.closed_at,s.closed_by,s.note,
          ${businessDate} AS business_date,p.name AS profile_name,${shiftNameColumns("s")}
        FROM cashier_shifts s JOIN pos_profiles p ON s.profile_id=p.id
        LEFT JOIN working_days d ON s.working_day_id=d.id
        WHERE ${filters.join(" AND ")} ORDER BY s.opened_at DESC,s.id DESC`,
        params
      );
      if (!branch2) return respond(data);
      const [registers, operators] = await db.batch([
        sql(
          db,
          "SELECT id,name FROM pos_profiles WHERE business_id=? AND branch_id=? ORDER BY name,id",
          identity.business_id,
          profile.branch_id
        ),
        sql(
          db,
          `SELECT DISTINCT s.opened_by AS id,u.display_name AS name FROM cashier_shifts s
          LEFT JOIN users u ON u.id=s.opened_by WHERE s.business_id=? AND s.branch_id=? ORDER BY u.display_name,s.opened_by`,
          identity.business_id,
          profile.branch_id
        )
      ]);
      return respond({ ...data, registers: registers.results, operators: operators.results });
    }
    const columns = (days ? dayColumns : shiftColumns).replaceAll(" ", ",");
    return respond(
      await pageOf(
        db,
        url,
        table,
        `SELECT ${columns} FROM ${table}
      WHERE business_id=? AND ${days ? "branch_id" : "profile_id"}=? ORDER BY opened_at DESC,id DESC`,
        [identity.business_id, days ? profile.branch_id : profile.id]
      )
    );
  }
  if (days && action === "summary") {
    const day = await selectDay(context, id2);
    if (!day) missing("Working day");
    return respond({ ...day, ...await daySummary(context, id2) });
  }
  if (days && !action) {
    const row2 = await sql(
      db,
      `SELECT ${dayColumns.replaceAll(" ", ",")} FROM working_days
      WHERE business_id=? AND branch_id=? AND id=?`,
      identity.business_id,
      profile.branch_id,
      id2
    ).first();
    if (!row2) missing("Working day");
    return respond(row2);
  }
  if (days) missing("Endpoint");
  const shift = await selectShift(context, id2, branch2 && action === "summary");
  if (!shift) missing("Cashier shift");
  if (action === "summary") {
    if (branch2 && !shift.closed_at && !await selectShift(context, id2)) missing("Cashier shift");
    const result2 = shiftResult(id2);
    const [details, summary, eligible] = await Promise.all([
      sql(db, result2.query, ...result2.params).first("value"),
      shiftSummary(context, id2, manager && !shift.closed_at ? expectedCounts(db, id2) : void 0),
      manager && context.config.cashier_shift_enabled && context.config.working_day_enabled === Boolean(shift.working_day_id) ? sql(
        db,
        `SELECT 1 FROM cashier_shifts s WHERE s.id=? AND s.profile_id=? AND ${reopenEligible}`,
        id2,
        profile.id
      ).first() : null
    ]);
    return respond({ ...JSON.parse(details), ...summary, tenders: shiftTenders(shift), can_reopen: eligible !== null });
  }
  if (action === "cash-floats") {
    return respond(
      await pageOf(
        db,
        url,
        "cash_floats",
        `SELECT * FROM cash_floats
      WHERE shift_id=? ORDER BY created_at,id`,
        [id2]
      )
    );
  }
  if (action === "reconciliation") {
    if (shift.closed_at) {
      const { results } = await sql(
        db,
        `${closingCounts} WHERE shift_id=? ORDER BY payment_type_id,currency`,
        id2
      ).all();
      return respond({
        shift_id: id2,
        activity_revision: shift.activity_revision,
        counts: results
      });
    }
    const { revision, rows } = await reconciliationSnapshot(db, id2);
    return respond({
      shift_id: id2,
      activity_revision: revision.activity_revision,
      counts: manager ? rows : rows.map(({ expected_minor, ...row2 }) => row2)
    });
  }
  if (action) missing("Endpoint");
  const result = shiftResult(id2);
  const row = await sql(db, result.query, ...result.params).first(
    "value"
  );
  return respond(JSON.parse(row));
}
__name(readOperations, "readOperations");
async function writeDay(context, command, id2) {
  const { db, identity, profile, now } = context;
  const { business_id: businessId, user_id: actor } = identity;
  requirePosPermission(context, id2 ? "allow_close_working_day" : "allow_start_working_day");
  if (!id2) {
    if (!context.config.working_day_enabled)
      conflict("Working days are disabled on this profile", "FEATURE_DISABLED");
    if (await selectDay(context))
      conflict(
        "A working day is already open for this branch",
        "WORKING_DAY_OPEN"
      );
    const day2 = context.storeImport?.resourceId ?? newId("posd");
    return command.commit(
      201,
      { query: "1", params: [] },
      [
        sql(
          db,
          `INSERT INTO working_days(id,business_id,branch_id,business_date,timezone,opened_at,opened_by,base_currency)
        VALUES (?,?,?,?,?,?,?,?)`,
          day2,
          businessId,
          profile.branch_id,
          context.localDate,
          identity.timezone,
          now,
          actor,
          context.storeImport?.baseCurrency ?? identity.currency
        )
      ],
      dayResult(day2)
    );
  }
  const day = await selectDay(context, id2);
  if (!day) missing("Working day");
  if (day.closed_at) conflict("This working day is already closed");
  const canClose = `NOT EXISTS (SELECT 1 FROM cashier_shifts WHERE working_day_id=? AND closed_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM sales WHERE working_day_id=? AND status IN ('open','submitted','bill_requested'))`;
  const allowed = await sql(
    db,
    "SELECT " + canClose + " AS allowed",
    id2,
    id2
  ).first("allowed");
  if (!allowed)
    conflict(
      "Close the working day's shifts and settle or cancel its open bills",
      "WORKING_DAY_HAS_ACTIVITY"
    );
  return command.commit(
    200,
    {
      query: `EXISTS (SELECT 1 FROM working_days WHERE id=? AND closed_at IS NULL) AND ${canClose}`,
      params: [id2, id2, id2],
      allowReadOnly: true
    },
    [
      sql(
        db,
        "UPDATE working_days SET closed_at=?,closed_by=? WHERE id=?",
        now,
        actor,
        id2
      )
    ],
    dayResult(id2)
  );
}
__name(writeDay, "writeDay");
var countKey = /* @__PURE__ */ __name((row) => `${row.payment_type_id}:${row.currency}`, "countKey");
function expectedCounts(db, shiftId) {
  return sql(
    db,
    `WITH configured(payment_type_id,payment_type_name,payment_kind,currency) AS (
      SELECT json_extract(t.value,'$.id'),json_extract(t.value,'$.name'),json_extract(t.value,'$.kind'),currency.value
      FROM cashier_shifts s,json_each(s.payment_types_json) t,
        json_each(CASE WHEN json_type(t.value,'$.currency')='text'
          THEN json_array(json_extract(t.value,'$.currency'))
          ELSE json_extract(t.value,'$.currencies') END) currency WHERE s.id=?1
    ), entries(payment_type_id,payment_type_name,payment_kind,currency,amount_minor) AS (
      SELECT payment_type_id,payment_type_name,payment_kind,currency,0 FROM configured
      UNION ALL
      SELECT cf.payment_type_id,tender.payment_type_name,tender.payment_kind,cf.currency,
        CASE WHEN cf.kind='cash_out' THEN -cf.amount_minor ELSE cf.amount_minor END
      FROM cash_floats cf JOIN configured tender
        ON tender.payment_type_id=cf.payment_type_id AND tender.currency=cf.currency
      WHERE cf.shift_id=?1
      UNION ALL
      SELECT COALESCE(drawer.payment_type_id,p.payment_type_id),COALESCE(drawer.payment_type_name,p.payment_type_name),
        p.payment_kind,p.currency,p.amount_minor
      FROM sales sale JOIN sale_payments p ON p.sale_id=sale.id
      LEFT JOIN configured drawer ON p.payment_kind='cash' AND drawer.payment_kind='cash' AND drawer.currency=p.currency
      WHERE sale.shift_id=?1 AND sale.status='paid'
    ) SELECT payment_type_id,max(payment_type_name) AS payment_type_name,max(payment_kind) AS payment_kind,
      currency,sum(amount_minor) AS expected_minor
      FROM entries GROUP BY payment_type_id,currency ORDER BY payment_type_id,currency`,
    shiftId
  );
}
__name(expectedCounts, "expectedCounts");
async function reconciliationSnapshot(db, id2) {
  const [revision, totals] = await db.batch([
    sql(db, "SELECT activity_revision,closed_at FROM cashier_shifts WHERE id=?", id2),
    expectedCounts(db, id2)
  ]);
  return {
    revision: revision.results[0],
    rows: totals.results
  };
}
__name(reconciliationSnapshot, "reconciliationSnapshot");
function declaredCounts(body, rows) {
  const input = list(body.counts, "counts", 1e3).map((raw) => {
    const count = object(raw);
    return {
      payment_type_id: recordId(count.payment_type_id, "payment_type_id"),
      currency: currencyOf(count.currency),
      declared_minor: integer(count.declared_minor, "declared_minor", -MAX_AMOUNT),
      expected_minor: count.expected_minor
    };
  });
  const declared = new Map(input.map((entry) => [countKey(entry), entry]));
  if (input.length !== rows.length || declared.size !== input.length || rows.some((row) => !declared.has(countKey(row))))
    invalid("Send one declared amount for every payment type and currency in the reconciliation");
  if (rows.some((row) => row.payment_kind === "cash" && declared.get(countKey(row)).declared_minor < 0))
    invalid("Declared cash amounts must be zero or positive");
  return declared;
}
__name(declaredCounts, "declaredCounts");
async function reviewShift(context, id2, body) {
  if (!await selectShift(context, id2)) missing("Cashier shift");
  const { revision, rows } = await reconciliationSnapshot(context.db, id2);
  if (revision.closed_at) conflict("This cashier shift is closed", "CASHIER_SHIFT_CLOSED");
  if (integer(body.activity_revision, "activity_revision", 1) !== revision.activity_revision)
    conflict("Refresh the shift reconciliation", "RECONCILIATION_CHANGED");
  const declared = declaredCounts(body, rows);
  return respond({
    shift_id: id2,
    activity_revision: revision.activity_revision,
    counts: rows.map(({ expected_minor, ...row }) => {
      const amount = declared.get(countKey(row)).declared_minor;
      return { ...row, declared_minor: amount, variance_minor: amount - expected_minor };
    })
  });
}
__name(reviewShift, "reviewShift");
function validateFloatTender(entry, types) {
  const currency = currencyOf(entry.currency);
  const id2 = recordId(entry.payment_type_id, "payment_type_id");
  const type = types.find(
    (type2) => type2.id === id2 && type2.currency === currency
  );
  if (!type || !allowsCashFloat(type))
    invalid("Choose a payment type and currency that allow cash floats");
  return { currency, payment_type_id: id2 };
}
__name(validateFloatTender, "validateFloatTender");
function shiftTenders(shift) {
  const types = JSON.parse(shift.payment_types_json);
  return types.flatMap((type) => (type.currency ? [type.currency] : type.currencies ?? []).map((currency) => ({ payment_type_id: type.id, payment_type_name: type.name, currency })));
}
__name(shiftTenders, "shiftTenders");
async function writeShift(context, command, id2, action) {
  if (!id2) requirePosPermission(context, "allow_start_cashier_shift");
  if (action === "close") requirePosPermission(context, "allow_close_cashier_shift");
  const { db, identity, profile, config, now } = context;
  const actor = identity.user_id;
  if (!id2) {
    if (!config.cashier_shift_enabled)
      conflict(
        "Cashier shifts are disabled on this profile",
        "FEATURE_DISABLED"
      );
    if (await selectShift(context))
      conflict(
        "A cashier shift is already open on this profile",
        "CASHIER_SHIFT_OPEN"
      );
    const [{ day }, types] = await Promise.all([
      operatingContext(context, false),
      context.storeImport?.shiftPaymentTypes ?? paymentTypes(context)
    ]);
    const opening = list(
      command.body.opening_cash ?? [],
      "opening_cash",
      40
    ).map((raw) => {
      const entry = object(raw);
      return {
        ...validateFloatTender(entry, types),
        amount_minor: integer(entry.amount_minor, "amount_minor", 0)
      };
    });
    const keys = new Set(opening.map(countKey));
    if (keys.size !== opening.length)
      invalid("Provide one opening balance per payment type and currency");
    const rawNote = command.body.note;
    const note = optionalText(
      typeof rawNote === "string" ? rawNote.trim() : rawNote,
      "shift note"
    );
    const shift2 = context.storeImport?.resourceId ?? newId("poss");
    const writes = [
      sql(
        db,
        `INSERT INTO cashier_shifts
      (id,business_id,branch_id,profile_id,working_day_id,opened_at,opened_by,payment_types_json,base_currency,exchange_rate,business_date,note,opening_sequence)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,(
        SELECT coalesce(max(opening_sequence),0)+1 FROM cashier_shifts WHERE business_id=? AND profile_id=?
      ))`,
        shift2,
        identity.business_id,
        profile.branch_id,
        profile.id,
        day?.id ?? null,
        now,
        actor,
        JSON.stringify(types),
        context.storeImport?.baseCurrency ?? identity.currency,
        context.storeImport?.exchangeRate ?? String(identity.secondary_exchange_rate),
        day?.business_date ?? context.localDate,
        note,
        identity.business_id,
        profile.id
      )
    ];
    for (const type of types.filter(allowsCashFloat)) {
      const amount = opening.find(
        (entry) => entry.payment_type_id === type.id && entry.currency === type.currency
      )?.amount_minor ?? 0;
      writes.push(
        sql(
          db,
          `INSERT INTO cash_floats(id,shift_id,payment_type_id,currency,kind,amount_minor,created_at,created_by)
          VALUES (?,?,?,?,'opening',?,?,?)`,
          newId("posf"),
          shift2,
          type.id,
          type.currency,
          amount,
          now,
          actor
        )
      );
    }
    return command.commit(
      201,
      openGuard(day, null),
      writes,
      shiftResult(shift2)
    );
  }
  const shift = await selectShift(context, id2);
  if (!shift) missing("Cashier shift");
  if (action === "reopen") {
    requireManager(identity.role);
    const reason = string(command.body.reason, "reason", 500);
    const guard = `EXISTS(SELECT 1 FROM cashier_shifts s WHERE s.id=? AND ${reopenEligible})`;
    if (!config.cashier_shift_enabled || config.working_day_enabled !== Boolean(shift.working_day_id) || !await sql(db, `SELECT ${guard} AS allowed`, id2).first("allowed"))
      conflict("Only the latest eligible shift can be reopened", "SHIFT_REOPEN_UNAVAILABLE");
    return command.commit(200, { query: guard, params: [id2], manager: true }, [
      sql(db, `INSERT INTO cashier_shift_reopens
        (id,shift_id,reopened_at,reopened_by,reason,previous_closed_at,previous_closed_by,previous_counts_json)
        SELECT ?,s.id,?,?,?,s.closed_at,s.closed_by,
          (SELECT json_group_array(json_object('payment_type_id',payment_type_id,'payment_type_name',payment_type_name,
            'currency',currency,'expected_minor',expected_minor,'declared_minor',declared_minor,'variance_minor',variance_minor))
            FROM cashier_shift_closing_counts WHERE shift_id=s.id)
        FROM cashier_shifts s WHERE s.id=?`, newId("posr"), now, actor, reason, id2),
      sql(db, "DELETE FROM cashier_shift_closing_counts WHERE shift_id=?", id2),
      sql(db, "UPDATE cashier_shifts SET closed_at=NULL,closed_by=NULL,activity_revision=activity_revision+1 WHERE id=?", id2)
    ], shiftResult(id2));
  }
  if (shift.closed_at)
    conflict("This cashier shift is closed", "CASHIER_SHIFT_CLOSED");
  if (action === "cash-floats") {
    const snapshot = JSON.parse(shift.payment_types_json);
    const { currency, payment_type_id } = validateFloatTender(
      command.body,
      snapshot.flatMap(
        ({ currency: currency2, currencies, ...type }) => (currency2 ? [currency2] : currencies ?? []).map((currency3) => ({ ...type, currency: currency3 }))
      )
    );
    const kind = choice(command.body.kind, "kind", [
      "cash_in",
      "cash_out"
    ]);
    const amount = integer(command.body.amount_minor, "amount_minor", 1);
    const reason = string(command.body.reason, "reason", 500);
    const reasonCode = command.body.reason_code == null ? null : choice(command.body.reason_code, "reason_code", ["add_change", "safe_drop", "petty_cash", "correction", "other"]);
    const float = context.storeImport?.resourceId ?? newId("posf");
    return command.commit(
      201,
      openGuard(null, shift),
      [
        sql(
          db,
          `INSERT INTO cash_floats(id,shift_id,payment_type_id,currency,kind,amount_minor,reason,created_at,created_by,reason_code)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
          float,
          id2,
          payment_type_id,
          currency,
          kind,
          amount,
          reason,
          now,
          actor,
          reasonCode
        ),
        ...updateShiftActivity(context, shift)
      ],
      {
        query: `SELECT ${jsonRow("f", "id shift_id payment_type_id currency kind amount_minor reason created_at created_by")}
      FROM cash_floats f WHERE id=?`,
        params: [float]
      }
    );
  }
  const revision = integer(
    command.body.activity_revision,
    "activity_revision",
    1
  );
  if (revision !== shift.activity_revision)
    conflict("Refresh the shift reconciliation", "RECONCILIATION_CHANGED");
  const { results } = await expectedCounts(db, id2).all();
  const declared = declaredCounts(command.body, results);
  if (context.storeImport) {
    if (results.some((row) => declared.get(countKey(row)).expected_minor !== row.expected_minor)) {
      conflict(
        "The saved drawer amounts differ from the server ledger",
        "RECONCILIATION_CHANGED"
      );
    }
  }
  return command.commit(
    200,
    {
      query: "EXISTS (SELECT 1 FROM cashier_shifts WHERE id=? AND closed_at IS NULL AND activity_revision=?)",
      params: [id2, revision],
      allowReadOnly: true
    },
    [
      sql(
        db,
        "UPDATE cashier_shifts SET closed_at=?,closed_by=? WHERE id=?",
        now,
        actor,
        id2
      ),
      sql(
        db,
        `INSERT INTO cashier_shift_closing_counts
      (shift_id,payment_type_id,payment_type_name,currency,expected_minor,declared_minor)
      SELECT ?,json_extract(value,'$.payment_type_id'),json_extract(value,'$.payment_type_name'),json_extract(value,'$.currency'),
        json_extract(value,'$.expected_minor'),json_extract(value,'$.declared_minor') FROM json_each(?)`,
        id2,
        JSON.stringify(
          results.map((row) => ({
            ...row,
            declared_minor: declared.get(countKey(row)).declared_minor
          }))
        )
      ),
      promoteProfile(context)
    ],
    shiftResult(id2)
  );
}
__name(writeShift, "writeShift");

// worker/posApiSales.ts
var amountColumns = [
  "subtotal_minor",
  "discount_minor",
  "tax_1_amount",
  "tax_2_amount",
  "tax_3_amount",
  "tax_minor",
  "total_minor"
];
var amountFields = amountColumns.join(" ");
var amountInserts = amountColumns.map(() => "?").join(",");
var amountReversal = amountColumns.map((column) => "-" + column).join(",");
var calculatedAmounts = "total_tax_amount total_amount";
var salesColumns = `id branch_id profile_id working_day_id shift_id reverses_sale_id status revision business_date
  currency secondary_exchange_rate tax_mode tax_rate_bps ${amountFields} ${calculatedAmounts} table_id table_code
  table_label guest_cover customer_id customer_name note reason created_at created_by updated_at updated_by settled_at settled_by`;
var lineColumns = `id line_number product_id product_code product_name portion_id portion_name
  price_list_id quantity unit_price_minor ${amountFields} note price_change_reason free_reason discount_bps discount_note`;
var savedLineColumns = `${lineColumns} base_price_override_minor is_free`;
var paymentColumns = `id line_number payment_type_id payment_type_name payment_kind currency
  entry_type amount_minor reference reverses_payment_id`;
var reversalId = "(SELECT r.id FROM sales r WHERE r.reverses_sale_id=s.id)";
var orderColumns2 = "line_key order_session ordered_at ordered_by ordered_by_name";
var lineJson = jsonRow("l", `${lineColumns} ${calculatedAmounts} status ${orderColumns2} void_reason`, {
  modifiers: "json(l.modifiers_json)",
  base_price_override_minor: "l.base_price_override_minor",
  is_free: "json(CASE WHEN l.is_free=1 THEN 'true' ELSE 'false' END)"
});
var paymentJson = jsonRow("p", paymentColumns);
var saleJson = jsonRow("s", salesColumns, {
  tax_rule: "json(s.tax_rule_json)",
  reversed_by_sale_id: reversalId,
  receipt: "json(s.receipt_json)",
  lines: `json((SELECT json_group_array(${lineJson} ORDER BY l.line_number) FROM sale_products l WHERE l.sale_id=s.id AND l.status<>'void'))`,
  voided_lines: `json((SELECT json_group_array(${lineJson} ORDER BY l.ordered_at,l.rowid) FROM sale_products l WHERE l.sale_id=s.id AND l.status='void'))`,
  payments: `json((SELECT json_group_array(${paymentJson} ORDER BY p.line_number) FROM sale_payments p WHERE p.sale_id=s.id))`
});
var resultOf = /* @__PURE__ */ __name((id2) => ({
  query: `SELECT ${saleJson} AS value FROM sales s WHERE s.id=?`,
  params: [id2]
}), "resultOf");
var saleStatuses = ["open", "submitted", "bill_requested", "paid", "cancelled"];
function sumAmounts(lines) {
  return Object.fromEntries(
    amountColumns.map((column) => [column, lines.reduce((sum, line) => sum + line[column], 0)])
  );
}
__name(sumAmounts, "sumAmounts");
function findSale(context, id2) {
  return sql(
    context.db,
    "SELECT * FROM sales WHERE id=? AND business_id=? AND profile_id=?",
    id2,
    context.identity.business_id,
    context.profile.id
  ).first();
}
__name(findSale, "findSale");
function validateBusinessDate(value) {
  const parsed = /* @__PURE__ */ new Date(value + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value)
    invalid("Invalid business_date");
}
__name(validateBusinessDate, "validateBusinessDate");
function billPostingDate(context, input, operatingDate) {
  if (input == null) return operatingDate;
  const value = string(input, "posting_date", 10);
  validateBusinessDate(value);
  if (value.startsWith("0000-")) invalid("Invalid posting_date");
  if (context.config.cashier_shift_enabled && value !== operatingDate)
    conflict("Posting date follows the required cashier shift", "POSTING_DATE_LOCKED");
  return value;
}
__name(billPostingDate, "billPostingDate");
async function readBusinessSales(db, url, businessId) {
  const filters = ["s.business_id=?"];
  const values = [businessId];
  const status = url.searchParams.get("status");
  const date = url.searchParams.get("business_date");
  if (status !== null) {
    choice(status, "status", saleStatuses);
    filters.push("s.status=?");
    values.push(status);
  }
  if (date !== null) {
    validateBusinessDate(date);
    filters.push("s.business_date=?");
    values.push(date);
  }
  return respond(await pageOf(db, url, "sales", `
    SELECT s.id,s.business_date,s.created_at,s.customer_name,s.table_label,s.status,
      s.currency,s.total_minor,s.total_amount,s.total_tax_amount,s.reverses_sale_id,${reversalId} AS reversed_by_sale_id,
      b.name AS branch_name,p.name AS profile_name
    FROM sales s
    JOIN pos_profiles p ON p.id=s.profile_id AND p.business_id=s.business_id
    JOIN branches b ON b.id=s.branch_id AND b.business_id=s.business_id
    WHERE ${filters.join(" AND ")}
    ORDER BY s.created_at DESC,s.id DESC
  `, values));
}
__name(readBusinessSales, "readBusinessSales");
async function readSellingOverview(db, businessId, date) {
  const { results } = await sql(db, `
    SELECT currency,
      COUNT(CASE WHEN status='paid' AND reverses_sale_id IS NULL THEN 1 END) AS completed_count,
      COUNT(CASE WHEN status IN ('open','submitted','bill_requested') THEN 1 END) AS open_count,
      SUM(CASE WHEN status='paid' THEN total_minor ELSE 0 END) AS net_minor
    FROM sales WHERE business_id=? AND (status IN ('open','submitted','bill_requested') OR (status='paid' AND business_date=?))
    GROUP BY currency ORDER BY currency
  `, businessId, date).all();
  return respond({ business_date: date, currencies: results });
}
__name(readSellingOverview, "readSellingOverview");
async function readSales(context, url, id2) {
  const { db, identity, profile } = context;
  if (id2) {
    const result = resultOf(id2);
    const row = await sql(
      db,
      result.query + " AND s.business_id=? AND s.profile_id=?",
      id2,
      identity.business_id,
      profile.id
    ).first("value");
    if (!row) missing("Sale");
    return respond(JSON.parse(row));
  }
  if (url.searchParams.has("history")) {
    if (url.searchParams.get("history") !== "active" || ["status", "business_date", "table_id", "shift_id", "working_day_id"].some((field) => url.searchParams.has(field))) {
      invalid("Use history=active without other sales filters");
    }
    return readActiveSales(context, url);
  }
  const filters = ["s.business_id=?", "s.profile_id=?"];
  const values = [identity.business_id, profile.id];
  for (const field of [
    "status",
    "business_date",
    "table_id",
    "shift_id",
    "working_day_id"
  ]) {
    const value = url.searchParams.get(field);
    if (value === null) continue;
    if (field === "status")
      choice(value, "status", saleStatuses);
    else if (field === "business_date") validateBusinessDate(value);
    else recordId(value, field);
    filters.push(`s.${field}=?`);
    values.push(value);
  }
  const columns = salesColumns.split(/\s+/).map((column) => "s." + column).join(",");
  return respond(
    await pageOf(
      db,
      url,
      "sales",
      `SELECT ${columns},${reversalId} AS reversed_by_sale_id
    FROM sales s WHERE ${filters.join(" AND ")} ORDER BY s.created_at DESC,s.id DESC`,
      values
    )
  );
}
__name(readSales, "readSales");
async function readActiveSales(context, url) {
  const { db, profile, identity, config } = context;
  const { working_day: day, cashier_shift: shift } = await currentOperations(context);
  const kind = config.cashier_shift_enabled ? "shift" : config.working_day_enabled ? "working_day" : "business_date";
  const period = kind === "shift" ? shift : kind === "working_day" ? day : null;
  const scopeId = kind === "business_date" ? context.localDate : period?.id;
  const start = kind === "business_date" ? context.localDateStart : period?.opened_at;
  const scope = typeof scopeId === "string" && typeof start === "string" && (kind !== "shift" || (shift?.working_day_id ?? null) === (day?.id ?? null)) && (!config.working_day_enabled || day) ? { profile_id: profile.id, kind, id: scopeId, opened_at: start } : null;
  const paidScope = kind === "shift" ? "s.shift_id" : kind === "working_day" ? "s.working_day_id" : "s.business_date";
  const columns = salesColumns.split(/\s+/).map((column) => "s." + column).join(",");
  const page = await pageOf(db, url, "sales", `
    SELECT ${columns},${reversalId} AS reversed_by_sale_id,
      (SELECT COALESCE(SUM(l.quantity),0) FROM sale_products l WHERE l.sale_id=s.id AND l.status<>'void') AS item_quantity
    FROM sales s WHERE s.business_id=? AND s.profile_id=? AND ? IS NOT NULL
      AND (s.status IN ('open','submitted','bill_requested') OR (s.status='paid' AND ${paidScope}=?)
        OR (s.status='cancelled' AND julianday(s.updated_at)>=julianday(?)
            AND julianday(s.updated_at)<=julianday(?)))
    ORDER BY CASE s.status WHEN 'paid' THEN COALESCE(s.settled_at,s.created_at)
      ELSE s.updated_at END DESC,s.id DESC
  `, [identity.business_id, profile.id, scope?.id ?? null, scope?.id ?? null, scope?.opened_at ?? null, context.now]);
  return respond({ ...page, history_scope: scope });
}
__name(readActiveSales, "readActiveSales");
async function chooseTable(context, input, previous) {
  const tableId = input === void 0 ? previous?.table_id ?? null : input === null ? null : recordId(input, "table_id");
  if (!tableId) {
    if (context.config.table_mode === "required")
      invalid("This profile requires a table");
    return { id: null, code: null, label: null, check: false };
  }
  if (context.config.table_mode === "disabled")
    invalid("Tables are disabled on this profile");
  if (tableId === previous?.table_id)
    return {
      id: tableId,
      code: previous.table_code,
      label: previous.table_label,
      check: false
    };
  const row = await sql(
    context.db,
    `SELECT t.id,t.code,t.label,t.group_id FROM restaurant_tables t JOIN table_groups g
    ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
    WHERE t.business_id=?1 AND t.branch_id=?2 AND t.id=?3 AND t.is_active=1 AND g.is_active=1
      AND (?4 IS NULL OR g.id IN (SELECT value FROM json_each(?4)))`,
    context.identity.business_id,
    context.profile.branch_id,
    tableId,
    context.config.table_group_ids ? JSON.stringify(context.config.table_group_ids) : null
  ).first();
  if (!row) missing("Table");
  return { ...row, check: true };
}
__name(chooseTable, "chooseTable");
async function chooseCustomer(context, input, previous) {
  if (input === void 0 && previous)
    return { id: previous.customer_id, name: previous.customer_name };
  const id2 = input == null ? context.config.default_customer_id : recordId(input, "customer_id");
  const customer = await sql(
    context.db,
    "SELECT id,name FROM pos_customers WHERE business_id=? AND id=?",
    context.identity.business_id,
    id2
  ).first();
  if (!customer) missing("Customer");
  return customer;
}
__name(chooseCustomer, "chooseCustomer");
function openSaleGuard(guard, sale, revision) {
  return {
    ...guard,
    query: `${guard.query} AND EXISTS (SELECT 1 FROM sales WHERE id=? AND status IN ('open','submitted','bill_requested') AND revision=?)`,
    params: [...guard.params, sale.id, revision]
  };
}
__name(openSaleGuard, "openSaleGuard");
function assertRevision(sale, body, allowRequested = false) {
  const revision = integer(body.revision, "revision", 1);
  if (sale.status !== "open" && sale.status !== "submitted" && !(allowRequested && sale.status === "bill_requested"))
    conflict("This bill is no longer open", "BILL_CLOSED");
  if (revision !== sale.revision)
    conflict("Refresh the bill and use its current revision", "BILL_CHANGED");
  return revision;
}
__name(assertRevision, "assertRevision");
function assertExpectedContext(body, operating) {
  if (body.expected_context === void 0) return;
  const expected = object(body.expected_context);
  const date = string(expected.business_date, "business_date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid("Invalid business date");
  const day = expected.working_day_id === null ? null : recordId(expected.working_day_id, "working_day_id");
  const shift = expected.shift_id === null ? null : recordId(expected.shift_id, "shift_id");
  if (date !== operating.businessDate || day !== (operating.day?.id ?? null) || shift !== (operating.shift?.id ?? null)) {
    conflict(
      "The expected working day or cashier shift has changed",
      "SALE_CONTEXT_CHANGED"
    );
  }
}
__name(assertExpectedContext, "assertExpectedContext");
async function saveSale(env, deps, context, command, id2, submit = false) {
  const { db, identity, profile, config, now } = context;
  const actor = identity.user_id;
  const body = command.body;
  const existing = id2 ? await findSale(context, id2) : null;
  if (body.cancel_print_bill === true && existing)
    return saleAction(context, command, existing.id, "cancel-print-bill");
  if (id2 && !existing && !submit) missing("Sale");
  const revision = existing ? assertRevision(existing, submit ? { revision: existing.revision } : body) : 1;
  const operating = await operatingContext(context);
  if (submit && !operating.day && !operating.shift && body.expected_context !== void 0) {
    const submittedDate = string(object(body.expected_context).business_date, "business_date", 10);
    validateBusinessDate(submittedDate);
    if (submittedDate <= operating.businessDate) operating.businessDate = submittedDate;
  }
  assertExpectedContext(body, operating);
  const { day, shift, businessDate } = operating;
  const receiptData = existing ? object(JSON.parse(existing.receipt_json)) : {};
  const requestedPostingDate = body.posting_date === void 0 ? config.cashier_shift_enabled ? null : receiptData.posting_date : body.posting_date;
  const postingDate = billPostingDate(context, requestedPostingDate, businessDate);
  if (existing && (day?.id ?? null) !== existing.working_day_id)
    conflict("The bill belongs to a different working day");
  const currency = existing?.currency ?? identity.currency;
  const taxSettings = registerTaxSettings(profile);
  const keepSavedQuote = existing != null && body.lines === void 0;
  const taxRule = keepSavedQuote ? JSON.parse(existing.tax_rule_json ?? "null") : taxSettings.default_tax_rule;
  const taxMode = keepSavedQuote ? existing.tax_mode : taxRule?.tax_mode ?? taxSettings.tax_mode;
  const taxRate = keepSavedQuote ? existing.tax_rate_bps : taxSettings.tax_rate_bps;
  const note = body.note === void 0 ? existing?.note ?? null : optionalText(body.note, "note");
  if (body.lines !== void 0 && currency !== identity.currency) {
    conflict(
      "The business currency changed. Settle the existing quote or cancel the bill before starting another.",
      "CURRENCY_CHANGED"
    );
  }
  const savedLines = existing ? (await sql(
    db,
    "SELECT *,json(modifiers_json) AS modifiers FROM sale_products WHERE sale_id=? AND status<>'void'",
    existing.id
  ).all()).results.map((line) => ({
    ...line,
    modifiers: JSON.parse(String(line.modifiers))
  })) : [];
  const [table, customer, lines] = await Promise.all([
    chooseTable(context, body.table_id, existing),
    chooseCustomer(context, body.customer_id, existing),
    !existing || body.lines !== void 0 ? existing?.status === "submitted" && Array.isArray(body.lines) && !body.lines.length ? [] : saleLines(env, deps, context, body.lines, currency, taxMode, taxRate, taxRule, savedLines) : null
  ]);
  const cover = table.id == null ? inputGuestCover(body.guest_cover === void 0 && existing?.table_id == null ? existing?.guest_cover : body.guest_cover, null, config.prompt_guest_cover === true) : body.guest_cover === void 0 ? existing?.table_id === table.id ? existing.guest_cover : null : inputGuestCover(body.guest_cover, table.id);
  const amounts = lines ? sumAmounts(lines) : null;
  if (amounts && amounts.total_minor > MAX_AMOUNT)
    conflict("The bill exceeds the POS amount limit", "AMOUNT_LIMIT");
  if (body.expected_total_minor !== void 0 && integer(body.expected_total_minor, "expected_total_minor", 0) !== (amounts?.total_minor ?? existing?.total_minor))
    conflict("The sale total changed. Refresh the bill and review the total.", "PRICE_CHANGED");
  const sale = id2 ?? newId("possale");
  const guard = existing ? openSaleGuard(openGuard(day, shift), existing, revision) : openGuard(day, shift);
  if (lines) {
    guard.query += " AND EXISTS (SELECT 1 FROM businesses WHERE id=? AND menu_cache_version=?)";
    guard.params.push(identity.business_id, identity.catalog_version);
    guard.query += " AND EXISTS (SELECT 1 FROM pos_profiles WHERE id=? AND config_json IS ? AND pending_config_json IS ?)";
    guard.params.push(profile.id, profile.config_json, profile.pending_config_json);
  }
  if (table.check) {
    guard.query += ` AND EXISTS (SELECT 1 FROM restaurant_tables t JOIN table_groups g
      ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
      WHERE t.id=? AND t.business_id=? AND t.branch_id=? AND t.is_active=1 AND g.is_active=1
        AND t.code=? AND t.label=? AND g.id=?)`;
    guard.params.push(
      table.id,
      identity.business_id,
      profile.branch_id,
      table.code,
      table.label,
      table.group_id
    );
  }
  const writes = [];
  if (existing) {
    writes.push(
      sql(
        db,
        `UPDATE sales SET status=?,table_id=?,table_code=?,table_label=?,guest_cover=?,customer_id=?,customer_name=?,note=?,business_date=?,receipt_json=?,
      tax_mode=?,tax_rate_bps=?,tax_rule_json=?,
      ${amountColumns.map((column) => `${column}=COALESCE(?,${column})`).join(",")},
      revision=revision+1,updated_at=?,updated_by=? WHERE id=?`,
        submit ? body.request_bill === true ? "bill_requested" : "submitted" : existing.status,
        table.id,
        table.code,
        table.label,
        cover,
        customer.id,
        customer.name,
        note,
        requestedPostingDate == null && body.posting_date === void 0 ? existing.business_date : postingDate,
        JSON.stringify({ ...receiptData, posting_date: requestedPostingDate == null ? null : postingDate }),
        taxMode,
        taxRate,
        keepSavedQuote ? existing.tax_rule_json : taxRule ? JSON.stringify(taxRule) : null,
        ...amountColumns.map((column) => amounts?.[column] ?? null),
        now,
        actor,
        sale
      )
    );
  } else {
    const receipt = JSON.stringify({
      ...requestedPostingDate == null ? {} : { posting_date: postingDate },
      business_name: identity.business_name,
      profile_name: profile.name,
      branch_name: profile.branch_name,
      template: config.receipt_template,
      copies: config.print_copies
    });
    writes.push(
      sql(
        db,
        `INSERT INTO sales (id,business_id,branch_id,profile_id,working_day_id,status,business_date,
      currency,secondary_exchange_rate,tax_mode,tax_rate_bps,tax_rule_json,${amountColumns.join(",")},table_id,table_code,
      table_label,guest_cover,customer_id,customer_name,receipt_json,note,created_at,created_by,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,${amountInserts},?,?,?,?,?,?,?,?,?,?,?,?)`,
        sale,
        identity.business_id,
        profile.branch_id,
        profile.id,
        day?.id ?? null,
        submit ? body.request_bill === true ? "bill_requested" : "submitted" : "open",
        postingDate,
        currency,
        String(identity.secondary_exchange_rate),
        taxMode,
        taxRate,
        taxRule ? JSON.stringify(taxRule) : null,
        ...amountColumns.map((column) => amounts[column]),
        table.id,
        table.code,
        table.label,
        cover,
        customer.id,
        customer.name,
        receipt,
        note,
        now,
        actor,
        now,
        actor
      )
    );
  }
  if (lines) {
    writes.push(...await writeOrderLines(context, sale, lines, body, taxMode, taxRate, taxRule));
  }
  return command.commit(existing ? 200 : 201, guard, writes, resultOf(sale));
}
__name(saveSale, "saveSale");
async function writeOrderLines(context, sale, lines, body, taxMode, taxRate, taxRule) {
  const { db, identity, now } = context;
  const session = newId("order");
  const inputs = list(body.lines, "lines", 60);
  const { results: prior } = await sql(db, `SELECT l.line_key,l.line_number,l.product_id,l.status,l.unit_price_minor
    FROM sale_products l JOIN sales s ON s.id=l.sale_id
    WHERE s.id=? AND s.business_id=? AND s.profile_id=?`, sale, identity.business_id, context.profile.id).all();
  const priorKeys = new Map(prior.map((row) => [row.line_key, row]));
  const keys = /* @__PURE__ */ new Set();
  const serialized = JSON.stringify(lines.map((line, i) => {
    const input = object(inputs[i]);
    const legacyKey = `legacy_${i + 1}`;
    const samePosition = prior.find((row) => row.line_number === i + 1 && row.product_id === line.product_id);
    const key = input.line_key == null ? samePosition?.line_key ?? (priorKeys.has(legacyKey) ? newId("line") : legacyKey) : recordId(input.line_key, "line_key");
    if (priorKeys.get(key)?.status === "void") conflict("This order line was voided", "BILL_CHANGED");
    if (keys.has(key)) invalid("Duplicate order line");
    keys.add(key);
    const date = input.ordered_at == null ? now : string(input.ordered_at, "ordered_at", 40);
    if (!Number.isFinite(Date.parse(date))) invalid("Invalid order date");
    return {
      ...line,
      line_key: key,
      order_session: recordId(input.order_session ?? session, "order_session"),
      ordered_at: date,
      ordered_by: identity.user_id,
      ordered_by_name: identity.display_name
    };
  }));
  if (new TextEncoder().encode(serialized).length > 384e3) invalid("The bill contains too much product and modifier data");
  const columns = savedLineColumns.trim().split(/\s+/);
  const insert = [...columns, ...orderColumns2.split(" ")];
  const voidWrites = [];
  const removedKeys = /* @__PURE__ */ new Set();
  for (const raw of list(body.voided_lines ?? [], "voided_lines", 5e3)) {
    const change = object(raw);
    const key = recordId(change.line_key, "line_key");
    const sourceKey = recordId(change.source_line_key, "source_line_key");
    if (removedKeys.has(key) || keys.has(key)) invalid("Duplicate voided line");
    removedKeys.add(key);
    if (priorKeys.get(key)?.status === "void") continue;
    const source = priorKeys.get(sourceKey);
    if (!source || source.status !== "submitted" || key !== sourceKey && priorKeys.has(key)) {
      conflict("The submitted item changed", "BILL_CHANGED");
    }
    const quantity = saleQuantity(change.quantity);
    const reason = string(change.void_reason, "void_reason", 250);
    const edits = saleLineEdits(change);
    const amounts = saleLineTotals(
      lineGross(source.unit_price_minor, quantity),
      taxMode,
      taxRate,
      taxRule,
      edits.discount_minor,
      edits.discount_bps
    );
    const values = {
      quantity,
      ...amounts,
      void_reason: reason,
      discount_bps: edits.discount_bps,
      discount_note: edits.discount_note
    };
    if (key === sourceKey) {
      voidWrites.push(sql(db, `UPDATE sale_products SET ${Object.keys(values).map((c) => c + "=?").join(",")}
        WHERE sale_id=? AND line_key=?`, ...Object.values(values), sale, key));
    } else {
      const fields2 = [...insert, "modifiers_json", "void_reason", "status"];
      Object.assign(values, { id: newId("posl"), line_key: key, status: "void" });
      const expressions = fields2.map((c) => c === "line_number" ? "-(SELECT MAX(rowid)+1 FROM sale_products)" : Object.hasOwn(values, c) ? "?" : c);
      voidWrites.push(sql(
        db,
        `INSERT INTO sale_products(sale_id,${fields2.join(",")})
        SELECT sale_id,${expressions.join(",")} FROM sale_products WHERE sale_id=? AND line_key=?`,
        ...fields2.filter((c) => Object.hasOwn(values, c)).map((c) => values[c]),
        sale,
        sourceKey
      ));
    }
  }
  return [
    sql(db, `DELETE FROM sale_products WHERE sale_id=? AND status='new'
      AND line_key NOT IN (SELECT value FROM json_each(?))`, sale, JSON.stringify([...keys])),
    sql(db, `UPDATE sale_products SET line_number=-rowid,
      status=CASE WHEN line_key IN (SELECT value FROM json_each(?)) THEN status ELSE 'void' END
      WHERE sale_id=? AND status<>'void'`, JSON.stringify([...keys]), sale),
    ...voidWrites,
    sql(
      db,
      `INSERT INTO sale_products(sale_id,${insert.join(",")},modifiers_json)
      SELECT ?,${insert.map((c) => `json_extract(value,'$.${c}')`).join(",")},json_extract(value,'$.modifiers')
      FROM json_each(?) WHERE true ON CONFLICT(sale_id,line_key) DO UPDATE SET
      ${columns.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",")}, modifiers_json=excluded.modifiers_json`,
      sale,
      serialized
    )
  ];
}
__name(writeOrderLines, "writeOrderLines");
function salePayments(input, types, sale) {
  const entries = list(input, "payments", 60).map((raw, index) => {
    const entry = object(raw);
    const id2 = recordId(entry.payment_type_id, "payment_type_id");
    const currency = currencyOf(entry.currency);
    const type = types.find(
      (type2) => type2.id === id2 && type2.currency === currency
    );
    if (!type)
      invalid("Use a payment type and currency accepted by this profile");
    const entryType = choice(entry.entry_type ?? "tender", "entry_type", [
      "tender",
      "change"
    ]);
    if (entryType === "change" && type.kind !== "cash")
      invalid("Change requires a cash payment type");
    const amount = integer(entry.amount_minor, "amount_minor", 1);
    return {
      id: newId("pospay"),
      line_number: index + 1,
      payment_type_id: type.id,
      payment_type_name: type.name,
      payment_kind: type.kind,
      currency,
      entry_type: entryType,
      amount_minor: entryType === "change" ? -amount : amount,
      reference: optionalText(entry.reference, "payment reference", 160),
      reverses_payment_id: null
    };
  });
  const net = { USD: 0, KHR: 0 };
  const cash = { USD: 0, KHR: 0 };
  for (const entry of entries) {
    net[entry.currency] += entry.amount_minor;
    if (entry.payment_kind === "cash")
      cash[entry.currency] += entry.amount_minor;
  }
  if (cash.USD < 0 || cash.KHR < 0)
    invalid("Change cannot exceed cash tendered in that currency");
  const secondary = sale.currency === "USD" ? "KHR" : "USD";
  const paid = net[sale.currency] + secondaryToPrimary(
    net[secondary],
    sale.currency,
    sale.secondary_exchange_rate
  );
  if (paid !== sale.total_minor)
    conflict(
      "Net payments must match the bill total",
      "PAYMENT_TOTAL_MISMATCH"
    );
  return entries;
}
__name(salePayments, "salePayments");
function insertSalePayments(db, id2, entries) {
  return sql(
    db,
    `INSERT INTO sale_payments(sale_id,${paymentColumns.replaceAll(/\s+/g, ",")})
    SELECT ?,${paymentColumns.split(/\s+/).map((column) => `json_extract(value,'$.${column}')`).join(",")}
    FROM json_each(?)`,
    id2,
    JSON.stringify(entries)
  );
}
__name(insertSalePayments, "insertSalePayments");
async function checkout(context, command, sale, revision) {
  requirePosPermission(context, "allow_process_payment");
  const { db, identity, now } = context;
  const expected = integer(
    command.body.expected_total_minor,
    "expected_total_minor",
    0
  );
  if (expected !== sale.total_minor)
    conflict("Refresh the bill and confirm its saved total", "BILL_CHANGED");
  const operating = await operatingContext(context);
  assertExpectedContext(command.body, operating);
  const { day, shift, businessDate } = operating;
  const savedPostingDate = object(JSON.parse(sale.receipt_json)).posting_date;
  const postingDate = billPostingDate(context, command.body.posting_date === void 0 ? context.config.cashier_shift_enabled ? null : savedPostingDate : command.body.posting_date, businessDate);
  if ((day?.id ?? null) !== sale.working_day_id)
    conflict("The bill belongs to a different working day");
  const entries = salePayments(
    command.body.payments,
    await paymentTypes(context),
    sale
  );
  const guard = openSaleGuard(openGuard(day, shift), sale, revision);
  return command.commit(
    200,
    guard,
    [
      sql(
        db,
        `UPDATE sales SET status='paid',revision=revision+1,shift_id=?,business_date=?,
      updated_at=?,updated_by=?,settled_at=?,settled_by=? WHERE id=?`,
        shift?.id ?? null,
        postingDate,
        now,
        identity.user_id,
        now,
        identity.user_id,
        sale.id
      ),
      insertSalePayments(db, sale.id, entries),
      ...updateShiftActivity(context, shift),
      promoteProfile(context)
    ],
    resultOf(sale.id)
  );
}
__name(checkout, "checkout");
async function importStoreSale(context, command, types, status = "paid") {
  const { db, identity, profile, now } = context;
  if (status === "paid") requirePosPermission(context, "allow_process_payment");
  const body = command.body;
  const id2 = context.storeImport.resourceId;
  if (status === "submitted" && body.request_bill === true) status = "bill_requested";
  const previous = await findSale(context, id2);
  const savedLines = previous ? (await sql(
    db,
    "SELECT *,json(modifiers_json) AS modifiers FROM sale_products WHERE sale_id=? AND status<>'void' ORDER BY line_number",
    id2
  ).all()).results.map((line) => ({
    ...line,
    modifiers: JSON.parse(String(line.modifiers))
  })) : [];
  if (previous?.status === "bill_requested" && status !== "paid") conflict("Cancel Print Bill before editing this bill.", "BILL_REQUESTED");
  const currency = currencyOf(body.currency);
  const rate = string(body.exchange_rate, "exchange_rate", 80);
  const taxMode = choice(body.tax_mode, "tax_mode", [
    "disabled",
    "inclusive",
    "exclusive"
  ]);
  const taxRate = integer(body.tax_rate_bps, "tax_rate_bps", 0, 1e4);
  const taxRule = body.tax_rule == null ? null : readTaxRules([body.tax_rule])[0];
  if (taxRule && taxMode !== taxRule.tax_mode)
    invalid("The saved tax rule must match tax_mode");
  const operating = await operatingContext(context);
  if (body.expected_context === void 0)
    invalid("The saved sale needs its operating context");
  assertExpectedContext(body, operating);
  const { day, shift, businessDate } = operating;
  const postingDate = billPostingDate(context, body.posting_date, businessDate);
  const lines = list(body.lines, "lines", 60).map((raw, index) => {
    const line = object(raw);
    const quantity = saleQuantity(line.quantity);
    const unit = integer(line.unit_price_minor, "unit_price_minor", 0);
    const gross = lineGross(unit, quantity);
    const edits = saleLineEdits(line);
    requireLinePermissions(context, { ...line, ...edits }, savedLines.find((old) => line.line_key != null && old.line_key === line.line_key));
    const amounts2 = saleLineTotals(gross, taxMode, taxRate, taxRule, edits.discount_minor, edits.discount_bps);
    if (amounts2.subtotal_minor !== line.subtotal_minor || amounts2.discount_minor !== edits.discount_minor || amounts2.tax_minor !== line.tax_minor || amounts2.total_minor !== line.total_minor || ["tax_1_amount", "tax_2_amount", "tax_3_amount"].some(
      (column) => line[column] !== void 0 && amounts2[column] !== line[column]
    ) || line.total_tax_amount !== void 0 && amounts2.tax_minor !== line.total_tax_amount || line.total_amount !== void 0 && amounts2.total_minor !== line.total_amount) {
      invalid("The saved line amounts do not match the saved price and tax");
    }
    const modifiers2 = list(line.modifiers ?? [], "modifiers", 120).map(
      (rawModifier) => {
        const modifier = object(rawModifier);
        return {
          id: recordId(modifier.id, "modifier_id"),
          group_id: recordId(modifier.group_id, "group_id"),
          label_km: optionalText(modifier.label_km, "modifier label", 250) ?? "",
          label_en: optionalText(modifier.label_en, "modifier label", 250) ?? "",
          label_zh: optionalText(modifier.label_zh, "modifier label", 250) ?? "",
          price_minor: integer(
            modifier.price_minor,
            "modifier price",
            -MAX_AMOUNT
          )
        };
      }
    );
    if (new Set(modifiers2.map((modifier) => modifier.id)).size !== modifiers2.length) {
      invalid("Use distinct modifiers for each line");
    }
    const editedUnit = edits.is_free ? 0 : edits.base_price_override_minor == null ? unit : edits.base_price_override_minor + modifiers2.reduce((sum, option) => sum + option.price_minor, 0);
    if (editedUnit !== unit) invalid("The saved unit price does not match the line edits");
    return {
      id: newId("posl"),
      line_number: index + 1,
      product_id: recordId(line.product_id, "product_id"),
      product_code: optionalText(line.product_code, "product code", 250),
      product_name: string(line.product_name, "product name", 250),
      portion_id: line.portion_id == null ? null : recordId(line.portion_id, "portion_id"),
      portion_name: optionalText(line.portion_name, "portion name", 250),
      price_list_id: line.price_list_id === "" ? "" : recordId(line.price_list_id, "price_list_id"),
      quantity,
      unit_price_minor: unit,
      ...edits,
      ...amounts2,
      modifiers: modifiers2
    };
  });
  if (!lines.length && !["submitted", "bill_requested"].includes(previous?.status ?? ""))
    invalid("A bill needs at least one line");
  const amounts = sumAmounts(lines);
  if (amounts.total_minor > MAX_AMOUNT || amounts.total_minor !== body.total_minor) {
    invalid("The saved total must match the lines");
  }
  const entries = status !== "paid" ? [] : salePayments(body.payments, types, {
    currency,
    secondary_exchange_rate: rate,
    total_minor: amounts.total_minor
  });
  const tableMode = choice(body.table_mode, "table_mode", [
    "disabled",
    "optional",
    "required"
  ]);
  const table = body.table_id == null ? null : recordId(body.table_id, "table_id");
  if (tableMode === "required" && !table || tableMode === "disabled" && table) {
    invalid("The table does not match the saved profile mode");
  }
  const cover = inputGuestCover(body.guest_cover, table, context.config.prompt_guest_cover === true);
  const customer = recordId(body.customer_id, "customer_id");
  const note = optionalText(body.note, "sale note", 500);
  const receipt = object(body.receipt);
  const template = object(receipt.template);
  const savedReceipt = {
    business_name: string(receipt.business_name, "business name", 250),
    profile_name: optionalText(receipt.profile_name, "profile name", 250) ?? profile.name,
    branch_name: optionalText(receipt.branch_name, "branch name", 250) ?? profile.branch_name,
    template: {
      title: optionalText(template.title, "receipt title", 500) ?? "",
      footer: optionalText(template.footer, "receipt footer", 500) ?? "",
      show_tax: boolean(template.show_tax, "show_tax")
    },
    copies: integer(receipt.copies, "copies", 1, 10)
  };
  if (previous?.status === "bill_requested") {
    const equal = /* @__PURE__ */ __name((a, b) => {
      if (a === b) return true;
      if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => equal(value, b[i]));
      if (a && b && typeof a === "object" && typeof b === "object") {
        const left = a, right = b;
        const keys = Object.keys(left).sort();
        return keys.join() === Object.keys(right).sort().join() && keys.every((key) => equal(left[key], right[key]));
      }
      return false;
    }, "equal");
    const columns = [
      "product_id",
      "portion_id",
      "price_list_id",
      "quantity",
      "unit_price_minor",
      "subtotal_minor",
      "discount_minor",
      "discount_bps",
      "tax_minor",
      "total_minor",
      "note",
      "base_price_override_minor",
      "price_change_reason",
      "free_reason",
      "discount_note"
    ];
    const unchanged = lines.length === savedLines.length && lines.every((line, i) => {
      const old = savedLines[i], next = line;
      return columns.every((key) => (next[key] ?? null) === (old[key] ?? null)) && Boolean(next.is_free) === Boolean(old.is_free) && equal(next.modifiers, old.modifiers) && object(body.lines[i]).line_key === old.line_key;
    });
    const voids = list(body.voided_lines ?? [], "voided_lines", 120).map(object);
    const oldVoids = (await sql(db, "SELECT * FROM sale_products WHERE sale_id=? AND status='void'", id2).all()).results;
    const unchangedVoids = voids.every((line) => {
      const old = oldVoids.find((row) => row.line_key === line.line_key);
      return old != null && ["quantity", "discount_minor", "discount_bps", "discount_note", "void_reason"].every((key) => (line[key] ?? null) === (old[key] ?? null));
    });
    if (!unchanged || !unchangedVoids || currency !== previous.currency || rate !== previous.secondary_exchange_rate || taxMode !== previous.tax_mode || taxRate !== previous.tax_rate_bps || !equal(taxRule, JSON.parse(previous.tax_rule_json ?? "null")) || table !== previous.table_id || cover !== previous.guest_cover || customer !== previous.customer_id || note !== previous.note || postingDate !== previous.business_date)
      conflict("Cancel Print Bill before editing this bill.", "BILL_REQUESTED");
  }
  const guard = openGuard(day, shift);
  guard.query += previous ? " AND EXISTS (SELECT 1 FROM sales WHERE id=? AND revision=? AND status=?)" : " AND NOT EXISTS (SELECT 1 FROM sales WHERE id=?)";
  guard.params.push(...previous ? [id2, previous.revision, previous.status] : [id2]);
  guard.query += ` AND NOT EXISTS (
    SELECT 1 FROM restaurant_tables WHERE id=? AND (business_id<>? OR branch_id<>?)
  ) AND NOT EXISTS (
    SELECT 1 FROM pos_customers WHERE id=? AND business_id<>?
  ) AND NOT EXISTS (
    SELECT 1 FROM products WHERE id IN (SELECT value FROM json_each(?)) AND business_id<>?
  ) AND NOT EXISTS (
    SELECT 1 FROM sales WHERE id=?
      AND (business_id<>? OR profile_id<>? OR status NOT IN ('submitted','bill_requested') OR working_day_id IS NOT ?)
  )`;
  guard.params.push(
    table,
    identity.business_id,
    profile.branch_id,
    customer,
    identity.business_id,
    JSON.stringify(lines.map((line) => line.product_id)),
    identity.business_id,
    id2,
    identity.business_id,
    profile.id,
    day?.id ?? null
  );
  return command.commit(
    201,
    guard,
    [
      sql(
        db,
        `INSERT INTO sales (id,business_id,branch_id,profile_id,working_day_id,shift_id,status,business_date,
        currency,secondary_exchange_rate,tax_mode,tax_rate_bps,tax_rule_json,${amountColumns.join(",")},
        table_id,table_code,table_label,guest_cover,customer_id,customer_name,receipt_json,note,
        created_at,created_by,updated_at,updated_by,settled_at,settled_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,${amountInserts},?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status,revision=sales.revision+1,
          shift_id=excluded.shift_id,business_date=excluded.business_date,
          tax_mode=excluded.tax_mode,tax_rate_bps=excluded.tax_rate_bps,tax_rule_json=excluded.tax_rule_json,
          ${amountColumns.map((column) => `${column}=excluded.${column}`).join(",")},
          table_id=excluded.table_id,table_code=excluded.table_code,table_label=excluded.table_label,
          guest_cover=excluded.guest_cover,customer_id=excluded.customer_id,customer_name=excluded.customer_name,
          ${body.note === void 0 ? "" : "note=excluded.note,"}
          receipt_json=excluded.receipt_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by,
          settled_at=excluded.settled_at,settled_by=excluded.settled_by`,
        id2,
        identity.business_id,
        profile.branch_id,
        profile.id,
        day?.id ?? null,
        status === "paid" ? shift?.id ?? null : null,
        status,
        postingDate,
        currency,
        rate,
        taxMode,
        taxRate,
        taxRule ? JSON.stringify(taxRule) : null,
        ...amountColumns.map((column) => amounts[column]),
        table,
        optionalText(body.table_code, "table code", 250),
        optionalText(body.table_label, "table label", 250),
        cover,
        customer,
        string(body.customer_name, "customer name", 250),
        JSON.stringify(savedReceipt),
        note,
        now,
        identity.user_id,
        now,
        identity.user_id,
        status === "paid" ? now : null,
        status === "paid" ? identity.user_id : null
      ),
      ...await writeOrderLines(context, id2, lines, body, taxMode, taxRate, taxRule),
      ...status === "paid" ? [
        insertSalePayments(db, id2, entries),
        ...updateShiftActivity(context, shift),
        promoteProfile(context)
      ] : []
    ],
    resultOf(id2)
  );
}
__name(importStoreSale, "importStoreSale");
function inputGuestCover(value, tableId, acceptsCounter = false) {
  if (value == null) return null;
  if (tableId == null && !acceptsCounter) invalid("A guest count requires a table or guest-cover profile");
  return integer(value, "guest_cover", 1, 1e3);
}
__name(inputGuestCover, "inputGuestCover");
async function reverse(context, command, original) {
  const { db, identity, now } = context;
  requireManager(identity.role);
  const reason = string(command.body.reason, "reason", 500);
  if (original.status !== "paid" || original.reverses_sale_id)
    conflict("Only an original paid sale can be reversed");
  const operating = await operatingContext(context);
  if (context.storeImport && (command.body.expected_context === void 0 || command.body.expected_total_minor === void 0)) {
    invalid("The reversal needs its operating context and original total");
  }
  assertExpectedContext(command.body, operating);
  if (command.body.expected_total_minor !== void 0 && integer(command.body.expected_total_minor, "expected_total_minor", 0) !== original.total_minor) {
    conflict("The original paid total does not match", "BILL_CHANGED");
  }
  if (await sql(
    db,
    "SELECT 1 FROM sales WHERE reverses_sale_id=?",
    original.id
  ).first()) {
    conflict("This sale already has a reversal", "SALE_ALREADY_REVERSED");
  }
  const { day, shift, businessDate } = operating;
  const sale = context.storeImport?.resourceId ?? newId("possale");
  const guard = openGuard(day, shift);
  return command.commit(
    201,
    {
      query: `${guard.query} AND NOT EXISTS (SELECT 1 FROM sales WHERE reverses_sale_id=?)`,
      params: [...guard.params, original.id],
      manager: true
    },
    [
      sql(
        db,
        `INSERT INTO sales(id,business_id,branch_id,profile_id,working_day_id,shift_id,reverses_sale_id,status,
      business_date,currency,secondary_exchange_rate,tax_mode,tax_rate_bps,tax_rule_json,${amountColumns.join(",")},
      table_id,table_code,table_label,guest_cover,customer_id,customer_name,receipt_json,note,reason,created_at,created_by,
      updated_at,updated_by,settled_at,settled_by)
      SELECT ?,business_id,branch_id,profile_id,?,?,id,'paid',?,currency,secondary_exchange_rate,tax_mode,tax_rate_bps,
        tax_rule_json,${amountReversal},table_id,table_code,table_label,guest_cover,customer_id,customer_name,receipt_json,
        note,?,?,?,?,?,?,? FROM sales WHERE id=?`,
        sale,
        day?.id ?? null,
        shift?.id ?? null,
        businessDate,
        reason,
        now,
        identity.user_id,
        now,
        identity.user_id,
        now,
        identity.user_id,
        original.id
      ),
      sql(
        db,
        `INSERT INTO sale_products(id,sale_id,line_number,product_id,product_code,product_name,portion_id,portion_name,
      price_list_id,modifiers_json,quantity,unit_price_minor,${amountColumns.join(",")},note,base_price_override_minor,is_free,price_change_reason,free_reason,discount_bps,discount_note)
      SELECT 'posl_'||lower(hex(randomblob(16))),?,line_number,product_id,product_code,product_name,portion_id,portion_name,
        price_list_id,modifiers_json,-quantity,unit_price_minor,${amountReversal},note,base_price_override_minor,is_free,price_change_reason,free_reason,discount_bps,discount_note
      FROM sale_products WHERE sale_id=? AND status<>'void'`,
        sale,
        original.id
      ),
      sql(
        db,
        `INSERT INTO sale_payments(id,sale_id,line_number,payment_type_id,payment_type_name,payment_kind,currency,
      entry_type,amount_minor,reference,reverses_payment_id)
      SELECT 'pospay_'||lower(hex(randomblob(16))),?,line_number,payment_type_id,payment_type_name,payment_kind,currency,
        'reversal',-amount_minor,reference,id FROM sale_payments WHERE sale_id=?`,
        sale,
        original.id
      ),
      ...updateShiftActivity(context, shift)
    ],
    resultOf(sale)
  );
}
__name(reverse, "reverse");
async function saleAction(context, command, id2, action) {
  const sale = await findSale(context, id2);
  if (!sale) missing("Sale");
  if (action === "reverse") return reverse(context, command, sale);
  if (action === "request-bill" || action === "cancel-print-bill") {
    if (action === "cancel-print-bill") requirePosPermission(context, "allow_cancel_print_bill");
    const revision2 = context.storeImport ? sale.revision : integer(command.body.revision, "revision", 1);
    const allowed = action === "request-bill" ? ["open", "submitted"] : ["bill_requested"];
    if (!allowed.includes(sale.status) || revision2 !== sale.revision)
      conflict("The bill status changed. Refresh the bill.", "BILL_CHANGED");
    const next = action === "request-bill" ? "bill_requested" : "submitted";
    return command.commit(200, {
      query: "EXISTS (SELECT 1 FROM sales WHERE id=? AND status=? AND revision=?)",
      params: [id2, sale.status, revision2]
    }, [sql(
      context.db,
      "UPDATE sales SET status=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=?",
      next,
      context.now,
      context.identity.user_id,
      id2
    )], resultOf(id2));
  }
  const revision = assertRevision(sale, context.storeImport && action === "cancel" ? { revision: sale.revision } : command.body, action === "checkout");
  if (action === "checkout") return checkout(context, command, sale, revision);
  const reason = string(command.body.reason, "reason", 500);
  const guard = openSaleGuard(
    { query: "1", params: [], allowReadOnly: true },
    sale,
    revision
  );
  return command.commit(
    200,
    guard,
    [
      sql(
        context.db,
        `UPDATE sales SET status='cancelled',revision=revision+1,reason=?,updated_at=?,updated_by=? WHERE id=?`,
        reason,
        context.now,
        context.identity.user_id,
        id2
      ),
      promoteProfile(context)
    ],
    resultOf(id2)
  );
}
__name(saleAction, "saleAction");

// worker/posApiReceiptTemplates.ts
function readTemplate(value) {
  const row = object(value);
  const type = choice(row.type, "receipt template type", posReceiptTypes);
  if (!Array.isArray(row.fields)) invalid("Receipt template fields must be an array");
  const fields2 = row.fields.map(
    (field) => choice(field, "receipt template field", posReceiptFields[type])
  );
  if (new Set(fields2).size !== fields2.length) invalid("Receipt template fields must be unique");
  const limits = posReceiptLimits;
  const base = {
    id: recordId(row.id, "receipt template ID"),
    name: string(row.name, "receipt template name"),
    language: choice(row.language, "receipt language", posReceiptLanguages),
    paper_width_mm: integer(row.paper_width_mm, "paper width", limits.width.min, limits.width.max),
    print_copies: integer(row.print_copies, "print copies", limits.copies.min, limits.copies.max),
    title: optionalText(row.title, "receipt title", 120) ?? "",
    footer: optionalText(row.footer, "receipt footer", 500) ?? "",
    text_size: choice(row.text_size, "receipt text size", posReceiptTextSizes),
    heading_alignment: choice(row.heading_alignment, "receipt heading alignment", posReceiptAlignments),
    fields: fields2
  };
  if (type !== "qr_label") {
    if (row.qr !== void 0) invalid("QR label settings require a QR label template");
    return { ...base, type };
  }
  const qr = object(row.qr);
  const labelHeight = integer(
    qr.label_height_mm,
    "label height",
    limits.labelHeight.min,
    limits.labelHeight.max
  );
  const size = integer(qr.size_mm, "QR size", limits.qrSize.min, limits.qrSize.max);
  if (size > Math.min(base.paper_width_mm, labelHeight))
    invalid("The QR code must fit the label width and height");
  const target = choice(qr.target, "QR target", posQrTargets);
  const customUrl = optionalText(qr.custom_url, "custom QR URL", 1e3) ?? "";
  if (target === "custom_url") {
    let url;
    try {
      url = new URL(customUrl);
    } catch {
      invalid("Enter an absolute HTTP or HTTPS URL for the QR label");
    }
    if (!/^https?:\/\//i.test(customUrl) || !["http:", "https:"].includes(url.protocol))
      invalid("Enter an absolute HTTP or HTTPS URL for the QR label");
  }
  return {
    ...base,
    type,
    qr: {
      label_height_mm: labelHeight,
      size_mm: size,
      target,
      custom_url: customUrl,
      caption: optionalText(qr.caption, "QR caption", 120) ?? ""
    }
  };
}
__name(readTemplate, "readTemplate");
function readReceiptSettings(input, saved) {
  let templates = saved?.receipt_templates ?? [];
  if (input.receipt_templates !== void 0) {
    if (!Array.isArray(input.receipt_templates)) invalid("receipt_templates must be an array");
    templates = input.receipt_templates.map(readTemplate);
  }
  const byId = new Map(templates.map((template) => [template.id, template]));
  if (byId.size !== templates.length) invalid("Receipt template IDs must be unique within the profile");
  const requested = input.default_receipt_templates === void 0 ? {} : object(input.default_receipt_templates);
  for (const key of Object.keys(requested))
    choice(key, "receipt default type", posReceiptTypes);
  const defaults = { ...emptyPosReceiptDefaults };
  for (const type of posReceiptTypes) {
    const value = requested[type];
    const id2 = value === void 0 ? saved?.default_receipt_templates?.[type] : value === null ? null : recordId(value, "default receipt template ID");
    const template = id2 ? byId.get(id2) : void 0;
    if (value != null && template?.type !== type)
      invalid("Choose a receipt template of the matching type from this profile");
    defaults[type] = template?.type === type ? template.id : null;
  }
  return { receipt_templates: templates, default_receipt_templates: defaults };
}
__name(readReceiptSettings, "readReceiptSettings");

// worker/posApiSetup.ts
async function findProfile(db, businessId, profileId) {
  return sql(
    db,
    `SELECT ${profileColumns} FROM pos_profiles p JOIN branches b ON b.id=p.branch_id
    WHERE p.business_id=? AND p.id=?`,
    businessId,
    profileId
  ).first();
}
__name(findProfile, "findProfile");
async function readConfig(db, businessId, branchId, currency, value, walkIn, saved) {
  const input = object(value);
  const tableMode = choice(input.table_mode ?? "disabled", "table_mode", [
    "disabled",
    "optional",
    "required"
  ]);
  const promptGuestCover = boolean(input.prompt_guest_cover ?? false, "prompt_guest_cover");
  const colors = input.table_status_colors == null ? {} : object(input.table_status_colors);
  const tableStatusColors = { ...posTableStatusColors };
  for (const status of posTableStatuses) {
    const color = colors[status];
    if (color === void 0) continue;
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))
      invalid(`table_status_colors.${status} must be a six-digit hex color`);
    tableStatusColors[status] = color.toUpperCase();
  }
  const tableGroups = input.table_group_ids == null ? null : list(input.table_group_ids, "table_group_ids", 500).map(
    (id2) => recordId(id2, "table group ID")
  );
  if (tableGroups) {
    if (!tableGroups.length || new Set(tableGroups).size !== tableGroups.length)
      invalid("Choose distinct table groups or use all groups");
    const count = await sql(db, `
      SELECT count(*) AS count FROM table_groups
      WHERE business_id=? AND branch_id=? AND is_active=1
        AND id IN (SELECT value FROM json_each(?))
    `, businessId, branchId, JSON.stringify(tableGroups)).first("count");
    if (count !== tableGroups.length) invalid("Choose active table groups from this branch");
  }
  const catalogMode = choice(input.catalog_mode ?? "category", "catalog_mode", [
    "category",
    "menu"
  ]);
  const selected = input.selected_ids == null ? null : list(input.selected_ids, "selected_ids", 100).map(
    (id2) => recordId(id2, "selected_ids")
  );
  if (selected && (!selected.length || new Set(selected).size !== selected.length)) {
    invalid("selected_ids must be null or a nonempty list of distinct IDs");
  }
  if (selected) {
    const count = await sql(
      db,
      `${activeCatalogNodes(catalogMode)} SELECT count(*) AS count FROM active_nodes
      WHERE id IN (SELECT value FROM json_each(?2))`,
      businessId,
      JSON.stringify(selected)
    ).first("count");
    if (count !== selected.length)
      invalid("Choose active menus or categories from this business");
  }
  const defaultMenu = input.default_menu_id == null ? null : recordId(input.default_menu_id, "default_menu_id");
  if (defaultMenu && (catalogMode !== "menu" || !selected?.includes(defaultMenu) || !await sql(
    db,
    "SELECT 1 FROM menus WHERE business_id=? AND id=? AND parent_id IS NULL AND is_active=1 AND deleted_in_admin=0",
    businessId,
    defaultMenu
  ).first())) {
    invalid("Choose a selected top-level menu as the default");
  }
  const types = list(input.payment_types, "payment_types", 20).map((value2) => {
    const type = object(value2);
    if ("currencies" in type) invalid("Use a single currency for each payment type");
    return {
      id: recordId(type.id, "payment type ID"),
      currency: currencyOf(type.currency),
      ...type.allow_cash_float === void 0 ? {} : { allow_cash_float: boolean(type.allow_cash_float, "allow_cash_float") }
    };
  });
  if (!types.length || new Set(types.map((type) => type.id)).size !== types.length) {
    invalid("Choose at least one payment type and list each type once");
  }
  if (!types.some((type) => type.currency === currency)) {
    invalid("At least one payment type must accept the business currency");
  }
  const defaultType = recordId(
    input.default_payment_type_id,
    "default_payment_type_id"
  );
  if (!types.some((type) => type.id === defaultType))
    invalid("The default payment type must be accepted");
  const { results: storedTypes } = await sql(
    db,
    `SELECT id,kind,currency FROM pos_payment_types
    WHERE business_id=? AND id IN (SELECT value FROM json_each(?))`,
    businessId,
    JSON.stringify(types.map((type) => type.id))
  ).all();
  const paymentTypesById = new Map(storedTypes.map((type) => [type.id, type]));
  const cashCurrencies = types.flatMap((type) => {
    const stored = paymentTypesById.get(type.id);
    if (!stored) invalid("Choose payment types from this business");
    if (stored.currency && type.currency !== stored.currency)
      invalid(`This payment type accepts only ${stored.currency}`);
    return stored.kind === "cash" ? [type.currency] : [];
  });
  if (new Set(cashCurrencies).size !== cashCurrencies.length)
    invalid("Configure at most one cash payment type per currency");
  const customerId = input.default_customer_id == null ? walkIn : recordId(input.default_customer_id, "default_customer_id");
  if (customerId !== walkIn && !await sql(
    db,
    "SELECT 1 FROM pos_customers WHERE business_id=? AND id=?",
    businessId,
    customerId
  ).first())
    invalid("Choose a customer from this business");
  const template = input.receipt_template == null ? {} : object(input.receipt_template);
  const taxMode = choice(input.tax_mode ?? "disabled", "tax_mode", posTaxModes);
  const taxRate = integer(input.tax_rate_bps ?? 0, "tax_rate_bps", 0, 1e4);
  if (taxMode === "disabled" && taxRate)
    invalid("A disabled tax rule must have a zero rate");
  const taxRules = input.tax_rules === void 0 ? saved?.tax_rules ?? [] : readTaxRules(input.tax_rules);
  const defaultTaxRuleId = input.default_tax_rule_id === void 0 ? saved?.default_tax_rule_id : input.default_tax_rule_id === null ? null : recordId(input.default_tax_rule_id, "default_tax_rule_id");
  const defaultTaxRule = taxRules.find(({ id: id2 }) => id2 === defaultTaxRuleId);
  if (input.default_tax_rule_id != null && !defaultTaxRule)
    invalid("Choose a default tax rule from this profile");
  const cashierShiftEnabled = boolean(input.cashier_shift_enabled ?? false, "cashier_shift_enabled");
  return {
    working_day_enabled: boolean(
      input.working_day_enabled ?? false,
      "working_day_enabled"
    ),
    cashier_shift_enabled: cashierShiftEnabled || types.some((type) => type.allow_cash_float === true),
    table_mode: tableMode,
    table_group_ids: tableGroups,
    prompt_guest_cover: promptGuestCover,
    table_status_colors: tableStatusColors,
    catalog_mode: catalogMode,
    selected_ids: selected,
    default_menu_id: defaultMenu,
    payment_types: types,
    default_payment_type_id: defaultType,
    default_customer_id: customerId,
    receipt_template: {
      title: optionalText(template.title, "receipt title", 120) ?? "",
      footer: optionalText(template.footer, "receipt footer", 500) ?? "",
      show_tax: boolean(template.show_tax ?? true, "show_tax")
    },
    print_copies: integer(input.print_copies ?? 1, "print_copies", 1, 10),
    ...readReceiptSettings(input, saved),
    tax_mode: taxMode,
    tax_rate_bps: taxRate,
    tax_rules: taxRules,
    default_tax_rule_id: defaultTaxRule?.id ?? null
  };
}
__name(readConfig, "readConfig");
function duplicateCashCurrencies(config, businessId, kind = "payment.kind") {
  return `SELECT 1 FROM json_each(${config},'$.payment_types') AS entry
    JOIN pos_payment_types AS payment ON payment.business_id=${businessId}
      AND payment.id=json_extract(entry.value,'$.id') AND (${kind})='cash'
    GROUP BY json_extract(entry.value,'$.currency') HAVING count(*)>1`;
}
__name(duplicateCashCurrencies, "duplicateCashCurrencies");
function incompatiblePaymentConfig(config, businessId) {
  return `EXISTS (
    SELECT 1 FROM json_each(${config},'$.payment_types') AS entry
    JOIN pos_payment_types AS payment ON payment.business_id=${businessId}
      AND payment.id=json_extract(entry.value,'$.id')
    WHERE payment.currency IS NOT NULL AND json_extract(entry.value,'$.currency')<>payment.currency
  ) OR EXISTS (${duplicateCashCurrencies(config, businessId)})`;
}
__name(incompatiblePaymentConfig, "incompatiblePaymentConfig");
async function updatePaymentType(db, businessId, id2, name, group, kind, currency, previous) {
  function withCurrency(column) {
    return `COALESCE((
      SELECT json_set(p.${column},'$.payment_types['||entry.key||'].currency',?1)
      FROM json_each(p.${column},'$.payment_types') AS entry
      WHERE json_extract(entry.value,'$.id')=?3 AND ?1 IS NOT NULL AND ?1 IS NOT ?6
        AND json_extract(entry.value,'$.currency')<>?1
    ), p.${column})`;
  }
  __name(withCurrency, "withCurrency");
  function kindChangedIn(config) {
    return `?4<>?5 AND EXISTS (
      SELECT 1 FROM json_each(${config},'$.payment_types') AS entry
      WHERE json_extract(entry.value,'$.id')=?3
    )`;
  }
  __name(kindChangedIn, "kindChangedIn");
  const current = withCurrency("config_json");
  const pending = withCurrency("pending_config_json");
  const currentChanged = `p.config_json IS NOT ${current} OR (${kindChangedIn("p.config_json")})`;
  const settingsConflict = `WITH revised AS (
    SELECT p.id,${current} AS next_config,${pending} AS next_pending,
      (${currentChanged}) AS current_changed,
      (p.pending_config_json IS NOT ${pending} OR (${kindChangedIn("p.pending_config_json")})) AS pending_changed
    FROM pos_profiles AS p WHERE p.business_id=?2
  ), changed_configs(config) AS (
    SELECT next_config FROM revised WHERE current_changed
    UNION ALL
    SELECT next_pending FROM revised WHERE pending_changed
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pos_store_authorities WHERE business_id=?2)
      THEN 'Release the offline POS register before changing payment settings.'
    WHEN EXISTS (
      SELECT 1 FROM pos_profiles JOIN revised ON revised.id=pos_profiles.id
      WHERE revised.current_changed AND NOT (${idleProfile})
    )
      THEN 'Close the affected POS shifts and bills before changing payment settings.'
    WHEN EXISTS (
      SELECT 1 FROM changed_configs AS revised JOIN businesses AS business ON business.id=?2
      WHERE NOT EXISTS (
        SELECT 1 FROM json_each(revised.config,'$.payment_types') AS entry
        WHERE json_extract(entry.value,'$.currency')=business.currency
      )
    )
      THEN 'Add a payment type that accepts the business currency to each affected POS profile first.'
    WHEN EXISTS (
      SELECT 1 FROM changed_configs AS revised WHERE EXISTS (${duplicateCashCurrencies(
    "revised.config",
    "?2",
    "CASE WHEN payment.id=?3 THEN ?4 ELSE payment.kind END"
  )})
    )
      THEN 'Remove the duplicate cash currency from the affected POS profiles first.'
  END AS reason`;
  const bindings = [currency, businessId, id2, kind, previous.kind, previous.currency];
  const [payment] = await db.batch([
    sql(db, `UPDATE pos_payment_types SET name=?7,currency=?1,kind=?4,
      payment_type_group=COALESCE(?8,payment_type_group)
      WHERE business_id=?2 AND id=?3 AND kind=?5 AND currency IS ?6
        AND (${settingsConflict}) IS NULL`, ...bindings, name, group),
    sql(db, `UPDATE pos_profiles AS p SET config_json=${current},pending_config_json=${pending},
      version=version+CASE WHEN (${currentChanged}) THEN 1 ELSE 0 END
      WHERE p.business_id=?2 AND changes()=1
        AND (${currentChanged} OR p.pending_config_json IS NOT ${pending})`, ...bindings)
  ]);
  if (!payment.meta.changes) {
    const reason = await sql(db, settingsConflict, ...bindings).first("reason");
    conflict(reason ?? "The payment type changed. Refresh and retry.");
  }
}
__name(updatePaymentType, "updatePaymentType");
function missingDefaultCustomer(config, businessId) {
  return `json_extract(${config},'$.default_customer_id') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pos_customers c WHERE c.business_id=${businessId}
      AND c.id=json_extract(${config},'$.default_customer_id')
  )`;
}
__name(missingDefaultCustomer, "missingDefaultCustomer");
async function profileSetup(request, url, db, businessId, id2) {
  if (request.method === "GET" && !id2) {
    const page = await pageOf(
      db,
      url,
      "profiles",
      `SELECT ${profileColumns} FROM pos_profiles p
      JOIN branches b ON b.id=p.branch_id WHERE p.business_id=? ORDER BY p.id`,
      [businessId]
    );
    return respond({
      ...page,
      profiles: page.profiles.map(
        (profile2) => profileView(profile2, true)
      )
    });
  }
  const profile = id2 ? await findProfile(db, businessId, id2) : null;
  if (id2 && !profile) missing("POS profile");
  if (profile && request.method === "GET")
    return respond(profileView(profile, true));
  if (!id2 && request.method !== "POST" || id2 && request.method !== "PATCH") {
    return respond(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405
    );
  }
  const body = await bodyOf(request);
  const name = body.name === void 0 && profile ? profile.name : string(body.name, "name");
  const active = body.is_active === void 0 ? profile?.is_active ?? 1 : Number(boolean(body.is_active, "is_active"));
  const branchId = profile?.branch_id ?? recordId(body.branch_id, "branch_id");
  if (profile && body.branch_id !== void 0 && body.branch_id !== branchId)
    invalid("A profile's branch is fixed");
  const business2 = await sql(
    db,
    `SELECT business.currency FROM branches b JOIN businesses business ON business.id=b.business_id
    WHERE b.business_id=? AND b.id=? AND (b.is_active=1 OR ?=0)`,
    businessId,
    branchId,
    active
  ).first();
  if (!business2) invalid("Choose an active branch from this business");
  const walkIn = "walkin_" + businessId;
  const saved = profile && profileView(profile, true);
  const config = body.config === void 0 && profile ? null : JSON.stringify(
    await readConfig(
      db,
      businessId,
      branchId,
      business2.currency,
      body.config,
      walkIn,
      saved?.pending_config ?? saved?.config
    )
  );
  const profileId = id2 ?? newId("posp");
  const ensureWalkIn = sql(
    db,
    `INSERT INTO pos_customers (id,business_id,name,is_walk_in)
    VALUES (?,?,'Walk-in',1) ON CONFLICT DO NOTHING`,
    walkIn,
    businessId
  );
  if (!profile) {
    const [, result] = await db.batch([
      ensureWalkIn,
      sql(
        db,
        `INSERT INTO pos_profiles
      (id,business_id,branch_id,name,is_active,config_json)
      SELECT ?1,?2,?3,?4,?5,?6 WHERE NOT (${incompatiblePaymentConfig("?6", "?2")})
        AND NOT (${missingDefaultCustomer("?6", "?2")})`,
        profileId,
        businessId,
        branchId,
        name,
        active,
        config
      )
    ]);
    if (!result.meta.changes) conflict("A payment type or default customer changed. Refresh and retry.");
  } else {
    const canDeactivate = `${idleProfile} AND NOT EXISTS (
      SELECT 1 FROM pos_store_authorities a
      WHERE a.business_id=pos_profiles.business_id AND a.branch_id=pos_profiles.branch_id
    ) AND (
      NOT EXISTS (SELECT 1 FROM working_days d WHERE d.business_id=pos_profiles.business_id
        AND d.branch_id=pos_profiles.branch_id AND d.closed_at IS NULL)
      OR EXISTS (SELECT 1 FROM pos_profiles other WHERE other.business_id=pos_profiles.business_id
        AND other.branch_id=pos_profiles.branch_id AND other.id<>pos_profiles.id AND other.is_active=1)
    )`;
    const [, result] = await db.batch([
      ensureWalkIn,
      sql(
        db,
        `UPDATE pos_profiles SET
      name=?1,is_active=?2,
      config_json=CASE WHEN ?3 IS NOT NULL AND ${idleProfile} THEN ?3 ELSE config_json END,
      pending_config_json=CASE WHEN ?3 IS NULL THEN pending_config_json
        WHEN ${idleProfile} THEN NULL ELSE ?3 END,
      version=version+CASE WHEN (?3 IS NOT NULL AND ${idleProfile}) OR is_active<>?2 THEN 1 ELSE 0 END
      WHERE business_id=?4 AND id=?5 AND (?2=1 OR (${canDeactivate}))
        AND NOT (${incompatiblePaymentConfig("?3", "?4")})
        AND NOT (${missingDefaultCustomer("?3", "?4")})`,
        name,
        active,
        config,
        businessId,
        profileId
      )
    ]);
    if (!result.meta.changes) {
      if (config && await sql(
        db,
        `SELECT ${missingDefaultCustomer("?1", "?2")} AS missing`,
        config,
        businessId
      ).first("missing"))
        conflict("The default customer changed. Refresh and retry.");
      if (active) conflict("The payment type changed. Refresh and retry.");
      conflict("Resolve open POS activity before deactivating this profile");
    }
  }
  return respond(
    profileView(await findProfile(db, businessId, profileId), true),
    profile ? 200 : 201
  );
}
__name(profileSetup, "profileSetup");
async function grants(request, db, businessId, profileId) {
  if (!await findProfile(db, businessId, profileId)) missing("POS profile");
  if (request.method === "PUT") {
    const body = await bodyOf(request);
    const userIds = list(body.user_ids, "user_ids", 100).map(
      (id2) => recordId(id2, "user ID")
    );
    if (new Set(userIds).size !== userIds.length)
      invalid("Grant IDs must be distinct");
    const ids = JSON.stringify(userIds);
    const count = await sql(
      db,
      `SELECT count(*) AS count FROM memberships
      WHERE business_id=? AND user_id IN (SELECT value FROM json_each(?))`,
      businessId,
      ids
    ).first("count");
    if (count !== userIds.length) invalid("Choose staff from this business");
    await db.batch([
      sql(
        db,
        `DELETE FROM pos_profile_grants WHERE business_id=? AND profile_id=?
          AND user_id NOT IN (SELECT value FROM json_each(?))`,
        businessId,
        profileId,
        ids
      ),
      sql(
        db,
        `INSERT INTO pos_profile_grants(business_id,profile_id,user_id)
        SELECT ?,?,value FROM json_each(?) WHERE 1
        ON CONFLICT (business_id,profile_id,user_id) DO NOTHING`,
        businessId,
        profileId,
        ids
      )
    ]);
  } else if (request.method !== "GET") {
    return respond(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405
    );
  }
  const rows = await sql(
    db,
    `SELECT user_id FROM pos_profile_grants
    WHERE business_id=? AND profile_id=? ORDER BY user_id`,
    businessId,
    profileId
  ).all();
  return respond({ user_ids: rows.results.map((row) => row.user_id) });
}
__name(grants, "grants");
async function paymentDirectory(request, url, db, businessId, id2) {
  const select = "SELECT id,name,kind,currency,payment_type_group FROM pos_payment_types WHERE business_id=?";
  if (request.method === "GET" && !id2)
    return respond(await pageOf(db, url, "payment_types", select + " ORDER BY id", [businessId]));
  const existing = id2 ? await sql(db, select + " AND id=?", businessId, id2).first() : null;
  if (id2 && !existing) missing("Payment type");
  if (request.method === "GET") return respond(existing);
  if (request.method !== (id2 ? "PATCH" : "POST"))
    return respond({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  const body = await bodyOf(request);
  const name = string(body.name ?? existing?.name, "name");
  const record = id2 ?? newId("pospmt");
  const group = body.payment_type_group === void 0 ? null : choice(body.payment_type_group, "payment type group", paymentTypeGroups);
  const legacyKind = body.kind === void 0 ? null : choice(body.kind, "kind", ["cash", "card", "qr", "other"]);
  if (group && legacyKind && paymentKindByGroup[group] !== legacyKind)
    invalid("The kind does not match the payment type group");
  if (existing && !group && legacyKind && legacyKind !== existing.kind)
    invalid("Use the payment type group to change the kind");
  const kind = group ? paymentKindByGroup[group] : existing?.kind ?? legacyKind;
  if (!kind) invalid("Choose a payment type group");
  const currency = body.currency === void 0 ? existing?.currency ?? null : currencyOf(body.currency);
  if (id2 && existing) {
    if (currency !== existing.currency || kind !== existing.kind) {
      await updatePaymentType(db, businessId, id2, name, group, kind, currency, existing);
    } else {
      const result = await sql(
        db,
        `UPDATE pos_payment_types SET name=?1,payment_type_group=COALESCE(?2,payment_type_group)
        WHERE business_id=?3 AND id=?4 AND (?2 IS NULL OR kind=?5)
          AND (?6=0 OR currency IS ?7)`,
        name,
        group,
        businessId,
        id2,
        existing.kind,
        Number(body.currency !== void 0),
        existing.currency
      ).run();
      if (!result.meta.changes) conflict("The payment type changed. Refresh and retry.");
    }
  } else {
    await sql(
      db,
      `INSERT INTO pos_payment_types(id,business_id,name,kind,currency,payment_type_group)
      VALUES (?,?,?,?,?,?)`,
      record,
      businessId,
      name,
      kind,
      currency,
      group ?? defaultPaymentGroup[kind]
    ).run();
  }
  return respond(
    await sql(db, select + " AND id=?", businessId, record).first(),
    id2 ? 200 : 201
  );
}
__name(paymentDirectory, "paymentDirectory");
async function profileOptions(db, businessId) {
  const [branches, tableGroups, categories, menus, payments, customers] = await Promise.all([
    sql(db, `SELECT id,name FROM branches WHERE business_id=? AND is_active=1 ORDER BY is_default DESC,name,id`, businessId).all(),
    sql(db, `SELECT id,name,branch_id FROM table_groups WHERE business_id=? AND is_active=1 ORDER BY sort_order,name,id`, businessId).all(),
    sql(db, `${activeCatalogNodes("category")}
      SELECT node.id,node.parent_id,c.name FROM active_nodes node JOIN categories c ON c.id=node.id
      ORDER BY c.sort_order,c.name,c.id`, businessId).all(),
    sql(db, `${activeCatalogNodes("menu")}
      SELECT node.id,node.parent_id,
        COALESCE(NULLIF(m.name_en,''),NULLIF(m.name_km,''),NULLIF(m.name_zh,''),m.slug) AS name
      FROM active_nodes node JOIN menus m ON m.id=node.id AND m.business_id=?1 ORDER BY m.sort_order,name,m.id`, businessId).all(),
    sql(db, `SELECT id,name,kind,currency,payment_type_group FROM pos_payment_types WHERE business_id=? ORDER BY name,id`, businessId).all(),
    sql(db, `SELECT id,name FROM pos_customers WHERE business_id=? AND is_walk_in=0 ORDER BY name,id`, businessId).all()
  ]);
  return respond({
    branches: branches.results,
    table_groups: tableGroups.results,
    categories: categories.results,
    menus: menus.results,
    payment_types: payments.results,
    customers: customers.results
  });
}
__name(profileOptions, "profileOptions");
async function handlePosSetup(request, url, db, auth, path, businessDate) {
  try {
    requireManager(auth.role);
    if (auth.sessionType !== "customer") {
      return respond(
        { error: "Use a business staff session", code: "FORBIDDEN" },
        403
      );
    }
    const enabled = await sql(db, `SELECT ${posPlanEnabled("?")} AS enabled`, auth.businessId).first("enabled");
    requirePosPlan(enabled ?? 0);
    if (request.method === "GET") {
      if (path === "/overview") return await readSellingOverview(db, auth.businessId, businessDate());
      if (path === "/sales") return await readBusinessSales(db, url, auth.businessId);
      if (path === "/shift-audit") return await readShiftAudit(db, url, auth.businessId);
      if (path === "/profile-options") return await profileOptions(db, auth.businessId);
      const photo2 = path.match(/^\/customers\/([a-zA-Z0-9_-]{1,80})\/photo$/);
      if (photo2) return await readCustomerPhoto(db, auth.businessId, photo2[1]);
    }
    const match = path.match(
      /^\/(profiles|payment-types|customers|customer-groups)(?:\/([a-zA-Z0-9_-]{1,80})(\/grants)?)?$/
    );
    if (!match) missing("Endpoint");
    const [, resource, id2, grantPath] = match;
    if (resource === "profiles") {
      return await (grantPath ? grants(request, db, auth.businessId, id2) : profileSetup(request, url, db, auth.businessId, id2));
    }
    if (grantPath) missing("Endpoint");
    if (resource === "customers" || resource === "customer-groups")
      return await manageCustomerDirectory(request, url, db, auth.businessId, resource, id2);
    return await paymentDirectory(request, url, db, auth.businessId, id2);
  } catch (error3) {
    return errorResponse(error3);
  }
}
__name(handlePosSetup, "handlePosSetup");

// worker/posApiStore.ts
function storeAuthority(context) {
  return sql(
    context.db,
    `SELECT device_id,public_key,epoch,last_sequence,timezone,enrolled_at FROM pos_store_authorities
      WHERE business_id=? AND branch_id=?`,
    context.identity.business_id,
    context.profile.branch_id
  ).first();
}
__name(storeAuthority, "storeAuthority");
function currentDevice(context) {
  return sql(
    context.db,
    `SELECT d.device_id,d.public_key FROM pos_sessions s
      JOIN pos_device_credentials d ON d.id=s.device_credential_id
      WHERE s.token_hash=? AND s.expires_at>unixepoch() AND ${activeDeviceSession}`,
    context.identity.token_hash
  ).first();
}
__name(currentDevice, "currentDevice");
function ownsAuthority(authority, device) {
  return device !== null && authority.device_id === device.device_id && (authority.public_key === null || authority.public_key === device.public_key);
}
__name(ownsAuthority, "ownsAuthority");
var branchIsIdle = `
  NOT EXISTS (SELECT 1 FROM working_days WHERE business_id=?1 AND branch_id=?2 AND closed_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM cashier_shifts WHERE business_id=?1 AND branch_id=?2 AND closed_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM sales WHERE business_id=?1 AND branch_id=?2 AND status IN ('open','submitted','bill_requested'))`;
var ownerSession = `EXISTS (
  SELECT 1 FROM pos_sessions s
  JOIN pos_device_credentials device ON device.id=s.device_credential_id AND device.device_id=?3 AND device.public_key=?5
  JOIN memberships m ON m.business_id=s.business_id AND m.user_id=s.user_id AND m.role='owner'
  JOIN users u ON u.id=m.user_id AND u.password_salt=s.credential_version
  JOIN pos_profiles p ON p.business_id=s.business_id AND p.id=s.profile_id AND p.is_active=1
  JOIN branches b ON b.business_id=p.business_id AND b.id=p.branch_id AND b.is_active=1
  JOIN businesses business ON business.id=p.business_id AND business.is_active=1
  WHERE s.token_hash=?4 AND s.business_id=?1 AND b.id=?2
    AND s.expires_at>unixepoch() AND ${activeDeviceSession}
)`;
async function manageStoreAuthority(context, request) {
  const { db, identity, profile } = context;
  const existing = await storeAuthority(context);
  const device = await currentDevice(context);
  if (request.method === "GET") {
    const owned = existing !== null && ownsAuthority(existing, device);
    return respond({
      authority: existing && {
        epoch: owned ? existing.epoch : null,
        last_sequence: existing.last_sequence,
        timezone: existing.timezone,
        owned_by_device: owned
      }
    });
  }
  if (identity.role !== "owner" || !device) {
    throw new PosError(
      403,
      "STORE_OWNER_REQUIRED",
      "Use an owner's enrolled POS device"
    );
  }
  const scope = [
    identity.business_id,
    profile.branch_id,
    device.device_id,
    identity.token_hash,
    device.public_key
  ];
  if (request.method === "POST") {
    if (!existing) {
      await sql(
        db,
        `INSERT INTO pos_store_authorities
          (business_id,branch_id,device_id,public_key,epoch,timezone,enrolled_at,enrolled_by)
          SELECT ?1,?2,?3,?5,?6,?7,?8,?9 WHERE ${branchIsIdle} AND ${ownerSession}
          ON CONFLICT (business_id,branch_id) DO NOTHING`,
        ...scope,
        newId("posstore"),
        identity.timezone,
        context.now,
        identity.user_id
      ).run();
    }
    const claimed = await storeAuthority(context);
    if (!claimed) {
      conflict(
        "Close existing days, shifts and bills before assigning the register",
        "STORE_BRANCH_BUSY"
      );
    }
    if (!ownsAuthority(claimed, device)) {
      conflict(
        "The branch is assigned to another store register",
        "STORE_REGISTER_REQUIRED"
      );
    }
    return respond(
      {
        epoch: claimed.epoch,
        last_sequence: claimed.last_sequence,
        timezone: claimed.timezone
      },
      existing ? 200 : 201
    );
  }
  const input = await bodyOf(request);
  const epoch = recordId(input.epoch, "epoch");
  const sequence = integer(input.last_sequence, "last_sequence", 0);
  if (!existing || existing.epoch !== epoch) return respond({ ok: true });
  if (!ownsAuthority(existing, device)) {
    conflict(
      "The branch is assigned to another store register",
      "STORE_REGISTER_REQUIRED"
    );
  }
  const released = await sql(
    db,
    `DELETE FROM pos_store_authorities WHERE business_id=?1 AND branch_id=?2 AND device_id=?3
      AND (public_key IS NULL OR public_key=?5) AND epoch=?6 AND last_sequence=?7 AND ${branchIsIdle} AND ${ownerSession}
      RETURNING epoch`,
    ...scope,
    epoch,
    sequence
  ).first();
  if (!released && (await storeAuthority(context))?.epoch === epoch)
    conflict(
      "Close the branch and sync its queued operations before releasing it",
      "STORE_BRANCH_BUSY"
    );
  return respond({ ok: true });
}
__name(manageStoreAuthority, "manageStoreAuthority");
async function recoverStoreOperation(context, request, deps, readOnly) {
  if (context.identity.role !== "owner") {
    throw new PosError(
      403,
      "STORE_OWNER_REQUIRED",
      "An owner must approve the recovery on the store register"
    );
  }
  const input = await bodyOf(request, 1008e3);
  const profileId = recordId(input.profile_id, "profile_id");
  const operator = recordId(input.operator_id, "operator_id");
  const reason = string(input.reason, "reason", 500);
  const operation = object(input.operation);
  const profile = await findProfile(
    context.db,
    context.identity.business_id,
    profileId
  );
  if (!profile?.is_active || profile.branch_id !== context.profile.branch_id) {
    throw new PosError(
      403,
      "WRONG_REGISTER_SESSION",
      "Choose an active profile in this store register's branch"
    );
  }
  return importOperation(
    {
      ...context,
      profile,
      config: JSON.parse(profile.config_json),
      identity: { ...context.identity, user_id: operator }
    },
    request,
    deps,
    readOnly,
    operation,
    {
      approvedBy: context.identity.user_id,
      approvedAt: context.now,
      reason
    }
  );
}
__name(recoverStoreOperation, "recoverStoreOperation");
async function listStoreRecoveries(context, url) {
  requireManager(context.identity.role);
  return respond(
    await pageOf(
      context.db,
      url,
      "recoveries",
      `SELECT epoch,sequence,profile_id,command_id,operator_id,approved_by,reason,approved_at FROM pos_store_recoveries
    WHERE business_id=? AND branch_id=? ORDER BY approved_at DESC,epoch,sequence`,
      [context.identity.business_id, context.profile.branch_id]
    )
  );
}
__name(listStoreRecoveries, "listStoreRecoveries");
async function savedTenderTypes(context, value) {
  const ids = /* @__PURE__ */ new Set();
  const types = list(value, "payment_types", 20).flatMap((raw) => {
    const row = object(raw);
    const id2 = recordId(row.id, "payment type ID");
    if (ids.has(id2)) invalid("Use distinct payment types");
    ids.add(id2);
    const currencies = row.currency === void 0 ? list(row.currencies, "currencies", 2).map(currencyOf) : [currencyOf(row.currency)];
    if (!currencies.length || new Set(currencies).size !== currencies.length) {
      invalid("Use distinct currencies for a payment type");
    }
    const type = {
      id: id2,
      name: string(row.name, "payment type name", 120),
      kind: choice(row.kind, "payment kind", [
        "cash",
        "card",
        "qr",
        "other"
      ]),
      ...row.allow_cash_float === void 0 ? {} : { allow_cash_float: boolean(row.allow_cash_float, "allow_cash_float") }
    };
    return currencies.map((currency) => ({ ...type, currency }));
  });
  const drawerCurrencies = types.filter((row) => row.kind === "cash").map((row) => row.currency);
  if (!types.length || new Set(drawerCurrencies).size !== drawerCurrencies.length) {
    invalid("Use distinct payment types and one cash drawer per currency");
  }
  const invalidType = await sql(
    context.db,
    `SELECT t.business_id,t.currency
    FROM pos_payment_types t JOIN json_each(?) saved ON t.id=json_extract(saved.value,'$.id')
    WHERE t.business_id<>? OR (t.currency IS NOT NULL AND json_extract(saved.value,'$.currency')<>t.currency)`,
    JSON.stringify(types),
    context.identity.business_id
  ).first();
  if (invalidType)
    invalid(invalidType.business_id === context.identity.business_id ? `This payment type accepts only ${invalidType.currency}` : "Use payment types from this business");
  return types;
}
__name(savedTenderTypes, "savedTenderTypes");
async function importStoreOperation(context, request, deps, readOnly) {
  return importOperation(
    context,
    request,
    deps,
    readOnly,
    await bodyOf(request, 1e6)
  );
}
__name(importStoreOperation, "importStoreOperation");
async function importOperation(context, request, deps, readOnly, raw, recovery) {
  if (raw.profile_id !== void 0 && recordId(raw.profile_id, "profile_id") !== context.profile.id) {
    throw new PosError(
      403,
      "WRONG_REGISTER_SESSION",
      "Use the profile that recorded this operation"
    );
  }
  const kind = choice(raw.kind, "kind", [
    "open_day",
    "close_day",
    "open_shift",
    "close_shift",
    "reopen_shift",
    "cash_movement",
    "checkout",
    "submit_sale",
    "cancel_print_bill",
    "cancel_sale",
    "reversal"
  ]);
  const epoch = recordId(raw.epoch, "epoch");
  const sequence = integer(raw.sequence, "sequence", 1);
  const resourceId = recordId(raw.resource_id, "resource_id");
  const timestamp2 = string(raw.occurred_at, "occurred_at", 32);
  const occurredAt = new Date(timestamp2);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?Z$/.test(timestamp2) || !Number.isFinite(occurredAt.valueOf()) || occurredAt.valueOf() > Date.now() + 3e5) {
    invalid("Use an occurred_at timestamp from the register clock");
  }
  const body = object(raw.payload);
  const settings = object(raw.settings);
  const exchangeRate = body.exchange_rate == null ? void 0 : string(body.exchange_rate, "exchange_rate", 80);
  if (exchangeRate != null && (!Number.isFinite(Number(exchangeRate)) || Number(exchangeRate) <= 0))
    invalid("The stored exchange rate must be positive");
  const authority = await storeAuthority(context);
  if (!authority || authority.epoch !== epoch || !ownsAuthority(authority, await currentDevice(context))) {
    conflict(
      "Use the designated store register for this branch",
      "STORE_REGISTER_REQUIRED"
    );
  }
  const imported = {
    ...context,
    identity: { ...context.identity, timezone: authority.timezone },
    config: {
      ...context.config,
      working_day_enabled: boolean(
        settings.working_day_enabled,
        "working_day_enabled"
      ),
      cashier_shift_enabled: boolean(
        settings.cashier_shift_enabled,
        "cashier_shift_enabled"
      )
    },
    now: occurredAt.toISOString(),
    localDate: deps.localDate(occurredAt, authority.timezone),
    storeImport: {
      epoch,
      sequence,
      resourceId,
      recovery,
      baseCurrency: body.base_currency == null ? void 0 : currencyOf(body.base_currency),
      exchangeRate
    }
  };
  const command = await Command.read(request, imported, {
    envelope: raw,
    body
  });
  if (command instanceof Response) return command;
  if (sequence !== authority.last_sequence + 1) {
    conflict(
      "Upload the preceding store operation first",
      "STORE_SEQUENCE_CHANGED"
    );
  }
  if (recovery) {
    const actor = context.identity.user_id;
    const status = await sql(
      context.db,
      `SELECT ${storeOperatorRegistered} AS registered, ${storeOperatorActive} AS active
      FROM pos_store_authorities authority WHERE authority.epoch=?`,
      context.profile.id,
      actor,
      context.profile.id,
      actor,
      epoch
    ).first();
    if (!status?.registered) {
      conflict(
        "The register has no enrollment record for this operator and profile",
        "STORE_OPERATOR_UNKNOWN"
      );
    }
    if (status.active) {
      conflict(
        "The original operator can still synchronize this entry",
        "STORE_OPERATOR_ACTIVE"
      );
    }
  }
  if (readOnly && kind !== "close_day" && kind !== "close_shift" && kind !== "cancel_sale") {
    throw new PosError(
      402,
      "SUBSCRIPTION_EXPIRED",
      "The subscription allows reads and closing existing activity"
    );
  }
  try {
    switch (kind) {
      case "open_day":
        return await writeDay(imported, command);
      case "close_day":
        return await writeDay(imported, command, resourceId);
      case "open_shift":
        imported.storeImport.shiftPaymentTypes = await savedTenderTypes(
          imported,
          body.payment_types
        );
        return await writeShift(imported, command);
      case "close_shift":
        return await writeShift(imported, command, resourceId, "close");
      case "reopen_shift":
        return await writeShift(imported, command, resourceId, "reopen");
      case "cash_movement":
        return await writeShift(
          imported,
          command,
          recordId(body.shift_id, "shift_id"),
          "cash-floats"
        );
      case "checkout":
        return await importStoreSale(
          imported,
          command,
          await savedTenderTypes(imported, body.payment_types)
        );
      case "cancel_print_bill":
        return await saleAction(imported, command, resourceId, "cancel-print-bill");
      case "submit_sale":
        return await importStoreSale(imported, command, [], "submitted");
      case "cancel_sale":
        return await saleAction(imported, command, resourceId, "cancel");
      case "reversal":
        return await saleAction(
          imported,
          command,
          recordId(body.original_sale_id, "original_sale_id"),
          "reverse"
        );
    }
  } catch (error3) {
    const replay = await command.replay();
    if (replay) return replay;
    throw error3;
  }
}
__name(importOperation, "importOperation");

// worker/posApi.ts
function unauthenticated() {
  throw new PosError(401, "INVALID_POS_SESSION", "Sign in to the POS API");
}
__name(unauthenticated, "unauthenticated");
function methodNotAllowed() {
  return respond(
    { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    405
  );
}
__name(methodNotAllowed, "methodNotAllowed");
var managerOrGrant = `(? IN ('owner','manager') OR EXISTS (
  SELECT 1 FROM pos_profile_grants g WHERE g.profile_id=p.id AND g.business_id=p.business_id AND g.user_id=?
))`;
async function throttle(db, request, email) {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  const keys = await Promise.all([
    digest("address:" + address),
    digest("account:" + address + ":" + email)
  ]);
  const now = Math.floor(Date.now() / 1e3);
  const windowStart = now - now % 600;
  const rows = await db.batch(
    keys.map(
      (key) => sql(
        db,
        `INSERT INTO pos_login_limits
    (bucket,window_start,attempts) VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET
    attempts=CASE WHEN pos_login_limits.window_start=excluded.window_start THEN min(pos_login_limits.attempts+1,121) ELSE 1 END,
    window_start=excluded.window_start RETURNING attempts`,
        key,
        windowStart
      )
    )
  );
  if (rows[0].results[0].attempts > 120 || rows[1].results[0].attempts > 20) {
    throw new PosError(
      429,
      "LOGIN_RATE_LIMIT",
      "Too many login attempts. Retry after the current ten-minute window."
    );
  }
}
__name(throttle, "throttle");
async function login(request, env, deps) {
  const body = await bodyOf(request);
  const email = string(body.email, "email", 254).toLowerCase();
  const slug2 = string(body.business_slug, "business_slug", 100).toLowerCase();
  const proof = string(body.password_proof, "password_proof", 64).toLowerCase();
  const version = string(body.auth_version, "auth_version", 80);
  const username = body.username === void 0 ? null : staffUsername(body.username);
  await throttle(env.DB, request, email);
  const account = await deps.verifyCredentials(email, proof, version, env);
  if (!account)
    throw new PosError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email, password, or business"
    );
  const membership = await sql(
    env.DB,
    `SELECT b.id, ${posPlanEnabled("b.id")} AS pos_enabled FROM businesses b
    JOIN memberships m ON m.business_id=b.id AND m.user_id=?
    WHERE b.is_active=1 AND (b.slug=? OR b.id=(SELECT business_id FROM business_slug_aliases WHERE slug=?))
      AND (? IS NULL OR (m.role<>'owner' AND m.pos_username=?))`,
    account.id,
    slug2,
    slug2,
    username,
    username
  ).first();
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
    username
  ).first();
  if (!result)
    throw new PosError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email, password, or business"
    );
  return respond({
    token,
    expires_at: new Date(expiresAt * 1e3).toISOString(),
    ...result
  });
}
__name(login, "login");
async function authenticate(request, db) {
  const token = request.headers.get("authorization")?.match(/^Bearer (possession_[0-9a-f]{64})$/i)?.[1];
  if (!token) unauthenticated();
  const identity = await sql(
    db,
    `SELECT s.business_id,b.name AS business_name,s.user_id,u.display_name,u.permissions,m.role,s.profile_id,
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
    await digest(token)
  ).first();
  if (!identity) unauthenticated();
  return identity;
}
__name(authenticate, "authenticate");
async function startSession(request, db, identity) {
  if (identity.profile_id)
    throw new PosError(
      403,
      "DISCOVERY_SESSION_REQUIRED",
      "Sign in to select a POS profile"
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
    profileId
  ).first();
  if (!result) missing("Available POS profile");
  return respond(
    {
      token,
      expires_at: new Date(expiresAt * 1e3).toISOString(),
      profile_id: profileId
    },
    201
  );
}
__name(startSession, "startSession");
async function activeProfile(db, identity) {
  if (!identity.profile_id)
    throw new PosError(
      403,
      "PROFILE_REQUIRED",
      "Start a session with a POS profile first"
    );
  const profile = await sql(
    db,
    `SELECT ${profileColumns} FROM pos_profiles p JOIN branches b ON b.id=p.branch_id
    WHERE p.business_id=? AND p.id=? AND p.is_active=1 AND b.is_active=1 AND ${managerOrGrant}`,
    identity.business_id,
    identity.profile_id,
    identity.role,
    identity.user_id
  ).first();
  if (!profile)
    throw new PosError(
      403,
      "PROFILE_ACCESS_REVOKED",
      "This POS profile is no longer available to this operator"
    );
  return profile;
}
__name(activeProfile, "activeProfile");
async function tables(context, url) {
  if (context.config.table_mode === "disabled") {
    const { page, limit } = pagination(url);
    return respond({ tables: [], page, page_size: limit, has_more: false });
  }
  const result = await pageOf(
    context.db,
    url,
    "tables",
    `WITH table_sales AS (
      SELECT table_id,MIN(id) AS open_sale_id,
        json_group_array(json_object('id',id,'guest_cover',guest_cover,'total_minor',total_minor))
          FILTER (WHERE status IN ('submitted','bill_requested')) AS submitted_sales
      FROM sales WHERE business_id=?2 AND profile_id=?1 AND table_id IS NOT NULL AND status IN ('open','submitted','bill_requested')
      GROUP BY table_id
    )
    SELECT t.id,t.code,t.label,t.group_id,g.name AS group_name,
    s.id AS open_sale_id,s.guest_cover,bk.arrival_at AS booking_arrival_at,bk.pax AS booking_pax,
    COALESCE(ts.submitted_sales,'[]') AS submitted_sales,
    CASE WHEN s.id IS NOT NULL THEN 'occupied' WHEN bk.id IS NOT NULL THEN 'booked' ELSE 'available' END AS status
    FROM restaurant_tables t JOIN table_groups g ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
    LEFT JOIN table_sales ts ON ts.table_id=t.id
    LEFT JOIN sales s ON s.id=ts.open_sale_id
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
      context.now
    ]
  );
  return respond({
    ...result,
    tables: result.tables.map((row) => ({
      ...row,
      submitted_sales: JSON.parse(row.submitted_sales)
    }))
  });
}
__name(tables, "tables");
function posProfileView(profile) {
  const settings = profileView(profile);
  const { print_copies, tax_mode: _mode, tax_rate_bps: _rate, ...config } = settings.config;
  const pending = profile.pending_config_json ? JSON.parse(profile.pending_config_json) : null;
  const { tax_mode, tax_rate_bps, ...taxSettings } = registerTaxSettings(profile);
  return {
    ...settings,
    config: {
      ...config,
      ...taxSettings,
      table_status_colors: { ...config.table_status_colors, ...pending?.table_status_colors },
      ...!taxSettings.default_tax_rule && tax_mode !== "disabled" && tax_rate_bps > 0 ? { legacy_tax: { tax_mode, tax_rate_bps } } : {}
    }
  };
}
__name(posProfileView, "posProfileView");
function registerConfig(profile) {
  const active = JSON.parse(profile.config_json);
  if (active.catalog_mode !== "menu" || !profile.pending_config_json)
    return active;
  const pending = JSON.parse(profile.pending_config_json);
  if (pending.catalog_mode !== "menu") return active;
  const selectedIds = active.selected_ids && pending.selected_ids ? [.../* @__PURE__ */ new Set([...active.selected_ids, ...pending.selected_ids])] : null;
  return { ...active, selected_ids: selectedIds };
}
__name(registerConfig, "registerConfig");
async function registerDefaultMenu({ db, identity, profile, config }) {
  const saved = config.default_menu_id ?? null;
  if (config.catalog_mode !== "menu" || !profile.pending_config_json)
    return saved;
  const pending = JSON.parse(profile.pending_config_json);
  if (pending.catalog_mode !== "menu") return saved;
  const menu = pending.default_menu_id;
  if (menu === null) return null;
  if (!menu || menu === saved || config.selected_ids && !config.selected_ids.includes(menu))
    return saved;
  const available = await sql(
    db,
    "SELECT 1 FROM menus WHERE business_id=? AND id=? AND parent_id IS NULL AND is_active=1 AND deleted_in_admin=0",
    identity.business_id,
    menu
  ).first();
  return available ? menu : saved;
}
__name(registerDefaultMenu, "registerDefaultMenu");
async function handlePosApi(request, env, deps) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.slice(posApiPath.length);
    if (path === "/auth/login")
      return request.method === "POST" ? await login(request, env, deps) : methodNotAllowed();
    const db = env.DB;
    if (path === "/auth/device-session")
      return request.method === "POST" ? await renewDeviceSession(db, request) : methodNotAllowed();
    const identity = await authenticate(request, db);
    if (path === "/sessions/current") {
      if (request.method !== "DELETE") return methodNotAllowed();
      await sql(
        db,
        "DELETE FROM pos_sessions WHERE token_hash=?",
        identity.token_hash
      ).run();
      return respond({ ok: true });
    }
    requirePosPlan(identity.pos_enabled);
    if (path === "/sessions")
      return request.method === "POST" ? await startSession(request, db, identity) : methodNotAllowed();
    if (path === "/profiles") {
      if (request.method !== "GET") return methodNotAllowed();
      if (identity.profile_id)
        throw new PosError(
          403,
          "DISCOVERY_SESSION_REQUIRED",
          "Sign in to list available POS profiles"
        );
      const page = await pageOf(
        db,
        url,
        "profiles",
        `SELECT ${profileColumns} FROM pos_profiles p
        JOIN branches b ON b.id=p.branch_id AND b.is_active=1
        WHERE p.business_id=? AND p.is_active=1 AND ${managerOrGrant} ORDER BY b.name,p.name,p.id`,
        [identity.business_id, identity.role, identity.user_id]
      );
      return respond({
        ...page,
        profiles: page.profiles.map(
          (profile2) => posProfileView(profile2)
        )
      });
    }
    const profile = await activeProfile(db, identity);
    const now = /* @__PURE__ */ new Date();
    const context = {
      db,
      identity,
      profile,
      config: registerConfig(profile),
      now: now.toISOString(),
      localDate: deps.localDate(now, identity.timezone)
    };
    const { readOnly } = deps.subscription(identity);
    const pendingCommand = path.match(/^\/commands\/([a-zA-Z0-9_-]{8,128})$/);
    if (pendingCommand && request.method === "GET") {
      const row = await sql(
        db,
        `SELECT response_json,response_status FROM pos_commands
        WHERE business_id=? AND profile_id=? AND actor_id=? AND idempotency_key=?`,
        identity.business_id,
        profile.id,
        identity.user_id,
        pendingCommand[1]
      ).first();
      if (!row) missing("Command");
      return respond({ result: JSON.parse(row.response_json), status: row.response_status });
    }
    if (path === "/auth/resolve-username")
      return request.method === "POST" ? await resolveStaffUsername(context, request) : methodNotAllowed();
    if (path === "/staff")
      return request.method === "GET" ? await listStaffUsernames(context, url) : methodNotAllowed();
    const staff = path.match(/^\/staff\/([a-zA-Z0-9_-]{1,80})\/username$/);
    if (staff)
      return request.method === "PUT" ? await setStaffUsername(context, request, staff[1]) : methodNotAllowed();
    if (path === "/store-authority")
      return ["GET", "POST", "DELETE"].includes(request.method) ? await manageStoreAuthority(context, request) : methodNotAllowed();
    if (path === "/store-operations")
      return request.method === "POST" ? await importStoreOperation(context, request, deps, readOnly) : methodNotAllowed();
    if (path === "/store-operations/recover")
      return request.method === "POST" ? await recoverStoreOperation(context, request, deps, readOnly) : methodNotAllowed();
    if (path === "/store-operations/recoveries")
      return request.method === "GET" ? await listStoreRecoveries(context, url) : methodNotAllowed();
    if (path === "/context") {
      if (request.method !== "GET") return methodNotAllowed();
      const settings = posProfileView(profile);
      const [current, accepted, authority, defaultMenu] = await Promise.all([
        currentOperations(context),
        paymentTypes(context),
        storeAuthority(context),
        registerDefaultMenu(context)
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
              allow_cash_float: allowsCashFloat(type)
            }))
          }
        },
        operator: {
          id: identity.user_id,
          name: identity.display_name,
          role: identity.role,
          permissions: userPermissions(identity.permissions, identity.role)
        },
        business: {
          id: identity.business_id,
          name: identity.business_name,
          timezone: identity.timezone,
          currency: identity.currency,
          secondary_currency: identity.currency === "USD" ? "KHR" : "USD",
          secondary_exchange_rate: String(identity.secondary_exchange_rate)
        },
        payment_types: accepted,
        local_date: context.localDate,
        read_only: readOnly,
        store_authority_required: authority !== null,
        capabilities: {
          user_permissions: true,
          bill_request_lock: true,
          sale_context_guard: true,
          device_sessions: true,
          store_operations: true,
          store_recovery: true,
          reversal_context_guard: true,
          staff_usernames: true,
          cart_line_edits: true,
          bill_information: true,
          submit_orders: true,
          order_line_history: true,
          order_line_void_reasons: true,
          price_change_reasons: true,
          free_item_reasons: true,
          item_discount_details: true,
          sale_notes: true,
          shift_management: true,
          customer_directory: true,
          customer_photo_upload: true,
          customer_credit: true
        },
        ...current
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
      return request.method === "DELETE" ? await revokeDevice(context, device[1]) : methodNotAllowed();
    if (path === "/catalog")
      return request.method === "GET" ? await getCatalog(env, deps, context, url) : methodNotAllowed();
    if (path === "/tables")
      return request.method === "GET" ? await tables(context, url) : methodNotAllowed();
    const customerPhoto2 = path.match(/^\/customers\/([a-zA-Z0-9_-]{1,80})\/photo$/);
    if (customerPhoto2)
      return request.method === "GET" ? await readRegisterCustomerPhoto(context, customerPhoto2[1]) : methodNotAllowed();
    const customer = path.match(/^\/customers(?:\/([a-zA-Z0-9_-]{1,80}))?$/);
    if (customer || path === "/customer-groups")
      return await registerCustomerDirectory(
        request,
        url,
        context,
        customer ? "customers" : "customer-groups",
        customer?.[1],
        readOnly
      );
    const match = path.match(
      /^\/(working-days|cashier-shifts|sales)(?:\/([a-zA-Z0-9_-]{1,80})(?:\/([a-z-]+))?)?$/
    );
    if (!match) missing("Endpoint");
    const [, resource, id2, action] = match;
    if (resource === "sales") {
      if (action && !["checkout", "cancel", "reverse", "submit", "request-bill", "cancel-print-bill"].includes(action))
        missing("Endpoint");
      if (request.method === "GET" && !action) {
        if (!id2 && url.searchParams.get("history") === "active" && !context.config.cashier_shift_enabled && !context.config.working_day_enabled) {
          context.localDateStart = deps.startOfLocalDate(context.localDate, identity.timezone);
        }
        return await readSales(context, url, id2);
      }
      if (!id2 && request.method !== "POST" || id2 && request.method !== (action ? "POST" : "PATCH")) {
        return methodNotAllowed();
      }
    } else {
      const actions = resource === "working-days" ? ["close", "summary"] : ["close", "cash-floats", "reconciliation", "summary", "reopen"];
      if (action && !actions.includes(action)) missing("Endpoint");
      if (request.method === "GET" && action !== "close" && action !== "reopen")
        return await readOperations(context, url, resource, id2, action);
      if (resource === "cashier-shifts" && id2 && action === "reconciliation" && request.method === "POST")
        return await reviewShift(context, id2, await bodyOf(request));
      if (request.method !== "POST" || id2 && (!action || action === "reconciliation" || action === "summary"))
        return methodNotAllowed();
    }
    const command = await Command.read(request, context);
    if (command instanceof Response) return command;
    try {
      if (await storeAuthority(context)) {
        conflict(
          "Use the designated store register for this branch",
          "STORE_REGISTER_REQUIRED"
        );
      }
      if (readOnly && action !== "close" && action !== "cancel") {
        throw new PosError(
          402,
          "SUBSCRIPTION_EXPIRED",
          "The subscription allows reads and closing existing activity"
        );
      }
      if (resource === "working-days")
        return await writeDay(context, command, id2);
      if (resource === "cashier-shifts")
        return await writeShift(context, command, id2, action);
      if (action === "submit") return await saveSale(env, deps, context, command, id2, true);
      if (action) return await saleAction(context, command, id2, action);
      return await saveSale(env, deps, context, command, id2);
    } catch (error3) {
      const replay = await command.replay();
      if (replay) return replay;
      if (id2 && action === "close" && String(error3).includes("POS_STATE_CONFLICT")) {
        if (resource === "cashier-shifts") {
          const current = await sql(
            db,
            `SELECT activity_revision FROM cashier_shifts
            WHERE business_id=? AND profile_id=? AND id=? AND closed_at IS NULL`,
            identity.business_id,
            profile.id,
            id2
          ).first("activity_revision");
          if (current != null && current !== command.body.activity_revision)
            conflict("Refresh the shift reconciliation", "RECONCILIATION_CHANGED");
        } else if (resource === "working-days") {
          const blocked = await sql(
            db,
            `SELECT 1 FROM working_days d
            WHERE d.business_id=? AND d.branch_id=? AND d.id=? AND d.closed_at IS NULL
              AND (EXISTS(SELECT 1 FROM cashier_shifts WHERE working_day_id=d.id AND closed_at IS NULL)
                OR EXISTS(SELECT 1 FROM sales WHERE working_day_id=d.id AND status IN ('open','submitted','bill_requested')))`,
            identity.business_id,
            profile.branch_id,
            id2
          ).first();
          if (blocked) conflict("Close the working day's shifts and bills", "WORKING_DAY_HAS_ACTIVITY");
        }
      }
      throw error3;
    }
  } catch (error3) {
    return errorResponse(error3);
  }
}
__name(handlePosApi, "handlePosApi");

// worker/bookingSettings.ts
var bookingPolicyJoins = `
  LEFT JOIN business_booking_settings settings ON settings.business_id=b.id
  LEFT JOIN business_subscriptions subscription ON subscription.business_id=b.id
  LEFT JOIN subscription_plans plan ON plan.id=subscription.plan_id`;
var planIncludesBooking = `EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(plan.features_json) THEN plan.features_json ELSE '[]' END)
  WHERE value='bookings'
)`;
var bookingEnabled = `b.is_active=1 AND COALESCE(settings.enabled,0)=1
  AND ${planIncludesBooking} AND subscription.status NOT IN ('past_due','canceled')
  AND (subscription.current_period_end_at IS NULL OR julianday(subscription.current_period_end_at)>julianday('now'))`;
var bookingSettingsColumns = `settings.slot_minutes AS slotMinutes, settings.notice_minutes AS noticeMinutes,
  settings.advance_days AS advanceDays, settings.min_pax AS minPax, settings.max_pax AS maxPax,
  settings.terms_km AS termsKm, settings.terms_en AS termsEn, settings.terms_version AS termsVersion`;
var success = /* @__PURE__ */ __name((data) => ({ ok: true, data }), "success");
var failure = /* @__PURE__ */ __name((status, error3) => ({
  ok: false,
  status,
  error: error3
}), "failure");
function parseBookingDates(json4) {
  try {
    const dates = JSON.parse(json4 ?? "[]");
    return Array.isArray(dates) ? dates.filter(
      (date) => typeof date === "string" && validBookingDate(date)
    ) : [];
  } catch {
    return [];
  }
}
__name(parseBookingDates, "parseBookingDates");
async function bookingWorkspaceAccess(db, auth) {
  const manager = auth.role === "owner" || auth.role === "manager";
  if (!manager && auth.canViewBookings !== 1)
    return { visible: false, canManage: false };
  const row = await db.prepare(
    `SELECT (${bookingEnabled}) AS enabled,
    EXISTS (SELECT 1 FROM bookings WHERE business_id=b.id) AS hasBookings
    FROM businesses b ${bookingPolicyJoins} WHERE b.id=?`
  ).bind(auth.businessId).first();
  return {
    visible: Boolean(row?.enabled || row?.hasBookings),
    canManage: Boolean(manager && row?.enabled)
  };
}
__name(bookingWorkspaceAccess, "bookingWorkspaceAccess");
async function readBookingFeature(db, businessId) {
  const feature = await db.prepare(
    `SELECT COALESCE(settings.enabled,0) AS enabled, ${planIncludesBooking} AS planIncluded,
      plan.name AS planName, (${bookingEnabled}) AS effective
      FROM businesses b ${bookingPolicyJoins} WHERE b.id=?`
  ).bind(businessId).first();
  return {
    enabled: Boolean(feature?.enabled),
    planIncluded: Boolean(feature?.planIncluded),
    planName: feature?.planName ?? null,
    effective: Boolean(feature?.effective)
  };
}
__name(readBookingFeature, "readBookingFeature");
async function featureSummary(db, businessId) {
  const [{ enabled, planIncluded, effective }, staff] = await Promise.all([
    readBookingFeature(db, businessId),
    db.prepare(
      `SELECT u.id AS userId,u.display_name AS name,u.email,m.can_view_bookings AS canView
      FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.business_id=? AND m.role NOT IN ('owner','manager')
      ORDER BY u.display_name,u.id`
    ).bind(businessId).all()
  ]);
  return {
    enabled,
    planIncluded,
    effective,
    staff: staff.results.map((member) => ({
      ...member,
      canView: Boolean(member.canView)
    }))
  };
}
__name(featureSummary, "featureSummary");
async function settingsSummary(db, businessId) {
  const [rules, branches, feature] = await Promise.all([
    db.prepare(
      `SELECT ${bookingSettingsColumns}
      FROM business_booking_settings settings WHERE business_id=?`
    ).bind(businessId).first(),
    db.prepare(
      `SELECT br.id,br.slug,br.name,br.is_active AS active,COALESCE(bs.enabled,0) AS enabled,
      COALESCE(bs.blocked_dates_json,'[]') AS blockedDatesJson
      FROM branches br LEFT JOIN branch_booking_settings bs ON bs.business_id=br.business_id AND bs.branch_id=br.id
      WHERE br.business_id=? ORDER BY br.is_default DESC,br.name,br.id`
    ).bind(businessId).all(),
    readBookingFeature(db, businessId)
  ]);
  return {
    ...bookingDefaults,
    termsKm: "",
    termsEn: "",
    termsVersion: "",
    ...rules,
    publication: {
      ...feature,
      termsPublished: Boolean(rules?.termsVersion)
    },
    branches: branches.results.map(
      ({ active, enabled, blockedDatesJson, ...branch2 }) => ({
        ...branch2,
        active: Boolean(active),
        enabled: Boolean(enabled),
        blockedDates: parseBookingDates(blockedDatesJson)
      })
    )
  };
}
__name(settingsSummary, "settingsSummary");
function validInteger(value, min, max) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
__name(validInteger, "validInteger");
async function bookingHash(value) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value))
  );
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(bookingHash, "bookingHash");
async function manageBookingSettings(env, businessId, action, method, input, audit) {
  const db = env.DB;
  const business2 = await db.prepare("SELECT 1 FROM businesses WHERE id=?").bind(businessId).first();
  if (!business2) return failure(404, "Business not found");
  if (action === "feature") {
    if (method === "GET") return success(await featureSummary(db, businessId));
    if (typeof input.enabled === "boolean" && Object.keys(input).length === 1) {
      await db.batch([
        db.prepare(
          `INSERT INTO business_booking_settings (business_id,enabled,min_pax,max_pax) VALUES (?,?,?,?)
          ON CONFLICT(business_id) DO UPDATE SET enabled=excluded.enabled,revision=revision+1`
        ).bind(
          businessId,
          Number(input.enabled),
          bookingDefaults.minPax,
          bookingDefaults.maxPax
        ),
        audit("booking.feature_updated")
      ]);
    } else if (typeof input.userId === "string" && typeof input.canView === "boolean" && Object.keys(input).length === 2) {
      const membership = await db.prepare(
        `SELECT role FROM memberships WHERE business_id=? AND user_id=?
        AND role NOT IN ('owner','manager')`
      ).bind(businessId, input.userId).first();
      if (!membership) return failure(404, "Staff membership not found");
      await db.batch([
        db.prepare(
          `UPDATE memberships SET can_view_bookings=? WHERE business_id=? AND user_id=?
          AND role NOT IN ('owner','manager')`
        ).bind(Number(input.canView), businessId, input.userId),
        audit("booking.staff_access_updated")
      ]);
    } else
      return failure(
        400,
        "Provide the business switch or a staff Booking grant"
      );
    return success(await featureSummary(db, businessId));
  }
  if (method === "GET") return success(await settingsSummary(db, businessId));
  const { slotMinutes, noticeMinutes, advanceDays, minPax, maxPax } = input;
  if (!validInteger(slotMinutes, 5, 240) || !validInteger(noticeMinutes, 0, 525600) || !validInteger(advanceDays, 0, 365) || !validInteger(minPax, 1, 1e3) || !validInteger(maxPax, minPax, 1e3))
    return failure(
      400,
      "Enter valid slot, booking window, and party size limits"
    );
  if (typeof input.termsKm !== "string" || typeof input.termsEn !== "string" || input.termsKm.length > 1e4 || input.termsEn.length > 1e4 || !Array.isArray(input.branches))
    return failure(400, "Enter valid booking terms and branch settings");
  const termsKm = input.termsKm.trim(), termsEn = input.termsEn.trim();
  const termsVersion = termsKm && termsEn ? await bookingHash([termsKm, termsEn]) : "";
  const branches = await db.prepare("SELECT id FROM branches WHERE business_id=?").bind(businessId).all();
  const allowed = new Set(branches.results.map((branch2) => branch2.id));
  const updates = [];
  for (const branch2 of input.branches) {
    if (!branch2 || typeof branch2 !== "object" || typeof branch2.id !== "string" || !allowed.delete(branch2.id) || typeof branch2.enabled !== "boolean" || !Array.isArray(branch2.blockedDates) || branch2.blockedDates.length > 366 || !branch2.blockedDates.every(
      (date) => typeof date === "string" && validBookingDate(date)
    ))
      return failure(
        400,
        "Enter valid, distinct branches and blocked dates for this business"
      );
    updates.push(
      db.prepare(
        `INSERT INTO branch_booking_settings (business_id,branch_id,enabled,blocked_dates_json)
      VALUES (?,?,?,?) ON CONFLICT(business_id,branch_id) DO UPDATE SET enabled=excluded.enabled,
      blocked_dates_json=excluded.blocked_dates_json`
      ).bind(
        businessId,
        branch2.id,
        Number(branch2.enabled),
        JSON.stringify([...new Set(branch2.blockedDates)].sort())
      )
    );
  }
  await db.batch([
    db.prepare(
      `INSERT INTO business_booking_settings
      (business_id,slot_minutes,notice_minutes,advance_days,min_pax,max_pax,terms_km,terms_en,terms_version)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(business_id) DO UPDATE SET slot_minutes=excluded.slot_minutes,notice_minutes=excluded.notice_minutes,
      advance_days=excluded.advance_days,min_pax=excluded.min_pax,max_pax=excluded.max_pax,
      terms_km=excluded.terms_km,terms_en=excluded.terms_en,terms_version=excluded.terms_version,revision=revision+1`
    ).bind(
      businessId,
      slotMinutes,
      noticeMinutes,
      advanceDays,
      minPax,
      maxPax,
      termsKm,
      termsEn,
      termsVersion
    ),
    ...updates,
    audit("booking.settings_updated")
  ]);
  return success(await settingsSummary(db, businessId));
}
__name(manageBookingSettings, "manageBookingSettings");

// worker/telegramOrders.ts
var telegramChatIdPattern = /^(?:-?[1-9]\d{0,15}|@[A-Za-z0-9_]{5,32})$/;
var telegramBotTokenPattern = /^\d{1,20}:[A-Za-z0-9_-]{20,100}$/;
var maxAttempts = 3;
var encoder2 = new TextEncoder();
async function encryptionKey(env, businessId) {
  if (!env.AUTH_PEPPER || env.AUTH_PEPPER.length < 32)
    throw new Error("Telegram credential encryption is unavailable");
  const secret = await crypto.subtle.importKey(
    "raw",
    encoder2.encode(env.AUTH_PEPPER),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder2.encode("emenu:telegram:v1"),
      info: encoder2.encode(businessId)
    },
    secret,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
__name(encryptionKey, "encryptionKey");
async function encryptTelegramToken(env, businessId, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env, businessId);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder2.encode(token)
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(ciphertext)));
}
__name(encryptTelegramToken, "encryptTelegramToken");
async function decryptTelegramToken(env, businessId, value) {
  const bytes = Uint8Array.from(
    atob(value),
    (character) => character.charCodeAt(0)
  );
  const key = await encryptionKey(env, businessId);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, 12) },
    key,
    bytes.subarray(12)
  );
  return new TextDecoder().decode(plaintext);
}
__name(decryptTelegramToken, "decryptTelegramToken");
function readTelegramSettings(db, businessId) {
  return db.prepare(
    `SELECT chat_id AS chatId, enabled, encrypted_token AS encryptedToken
    FROM business_telegram_notifications WHERE business_id=?`
  ).bind(businessId).first();
}
__name(readTelegramSettings, "readTelegramSettings");
async function sendTelegramMessage(env, businessId, settings, message, inlineKeyboard) {
  let token;
  try {
    token = await decryptTelegramToken(
      env,
      businessId,
      settings.encryptedToken
    );
  } catch {
    return { ok: false, error: "Save the Telegram bot token again." };
  }
  try {
    const response2 = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          link_preview_options: { is_disabled: true },
          ...inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(8e3)
      }
    );
    const body = await response2.json().catch(() => null);
    if (response2.ok && body?.ok === true) return { ok: true };
    const error3 = `Telegram rejected the message (HTTP ${response2.status}). Check the bot token and chat permissions.`;
    if (response2.status === 429 || response2.status >= 500) {
      const retryAfter = Number(body?.parameters?.retry_after) || 60;
      return {
        ok: false,
        error: `Telegram is temporarily unavailable (HTTP ${response2.status}).`,
        retryAfter: Math.max(60, retryAfter)
      };
    }
    return { ok: false, error: error3 };
  } catch {
    return {
      ok: false,
      error: "Telegram could not be reached.",
      retryAfter: 60
    };
  }
}
__name(sendTelegramMessage, "sendTelegramMessage");
function money(amount, currency) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: currency === "USD" ? 2 : 0, minimumFractionDigits: currency === "USD" ? 2 : 0 }).format(amount)} ${currency}`;
}
__name(money, "money");
async function orderMessage(db, businessId, orderId) {
  const order = await db.prepare(
    `SELECT o.order_number AS number, o.posting_date AS date,
    o.total_amount AS total, o.currency, o.note, b.name AS business, t.label AS tableLabel, g.name AS tableGroup
    FROM orders o JOIN businesses b ON b.id=o.business_id
    JOIN restaurant_tables t ON t.id=o.table_id AND t.business_id=o.business_id
    JOIN table_groups g ON g.id=t.group_id AND g.business_id=o.business_id
    WHERE o.id=? AND o.business_id=?`
  ).bind(orderId, businessId).first();
  if (!order) return null;
  const { results } = await db.prepare(
    `SELECT product_name AS name, product_id AS productId, quantity,
    portion_name AS portion, modifiers, note, total_amount AS total FROM order_products
    WHERE order_id=? ORDER BY line_number`
  ).bind(orderId).all();
  const header = `New eMenu order ${order.number}
${order.business}
Table: ${order.tableGroup} \xB7 ${order.tableLabel}
Date: ${order.date}
Total: ${money(order.total, order.currency)}`;
  let message = header;
  if (order.note) message += `
Order note: ${order.note}`;
  for (const line of results) {
    const options = JSON.parse(line.modifiers).map(
      (option) => [option.prefix, option.labelKm || option.labelEn || option.labelZh].filter(Boolean).join(" ")
    ).filter(Boolean);
    const product = `${line.quantity} \xD7 ${line.name || line.productId}${line.portion ? ` (${line.portion})` : ""} \xB7 ${money(line.total, order.currency)}`;
    const detail = [
      product,
      options.length ? `  Options: ${options.join(", ")}` : "",
      line.note ? `  Note: ${line.note}` : ""
    ].filter(Boolean).join("\n");
    if (message.length + detail.length + 2 > 3900)
      return `${message}

See the full item list in eMenu Orders.`;
    message += `

${detail}`;
  }
  return message;
}
__name(orderMessage, "orderMessage");
async function deliverTelegramOrder(env, orderId) {
  const delivery = await env.DB.prepare(
    `UPDATE telegram_order_deliveries
    SET attempts=attempts+1, next_attempt_at=unixepoch()+120, updated_at=unixepoch()
    WHERE order_id=? AND status='pending' AND next_attempt_at<=unixepoch()
      AND EXISTS (SELECT 1 FROM business_telegram_notifications c JOIN businesses b ON b.id=c.business_id
        WHERE c.business_id=telegram_order_deliveries.business_id AND c.enabled=1 AND b.is_active=1)
    RETURNING business_id AS businessId, attempts`
  ).bind(orderId).first();
  if (!delivery) return;
  const { businessId, attempts } = delivery;
  let result = {
    ok: false,
    error: "Telegram delivery could not be completed."
  };
  if (attempts <= maxAttempts) {
    const message = await orderMessage(env.DB, businessId, orderId);
    const settings = await readTelegramSettings(env.DB, businessId);
    if (settings?.enabled && message) {
      const stillQueued = await env.DB.prepare(
        "SELECT 1 FROM telegram_order_deliveries WHERE order_id=? AND attempts=? AND status='pending'"
      ).bind(orderId, attempts).first();
      if (stillQueued)
        result = await sendTelegramMessage(env, businessId, settings, message);
    }
  }
  const retryIn = !result.ok && result.retryAfter && attempts < maxAttempts ? Math.max(result.retryAfter, attempts * 60) : 0;
  await env.DB.prepare(
    `UPDATE telegram_order_deliveries SET status=?, error=?,
    next_attempt_at=unixepoch()+?, updated_at=unixepoch() WHERE order_id=? AND attempts=?`
  ).bind(
    result.ok ? "sent" : retryIn ? "pending" : "failed",
    result.ok ? null : result.error,
    retryIn,
    orderId,
    attempts
  ).run();
}
__name(deliverTelegramOrder, "deliverTelegramOrder");
async function retryTelegramOrders(env) {
  const { results } = await env.DB.prepare(
    `SELECT d.order_id AS orderId FROM telegram_order_deliveries d
    JOIN business_telegram_notifications c ON c.business_id=d.business_id AND c.enabled=1
    JOIN businesses b ON b.id=d.business_id AND b.is_active=1
    WHERE d.status='pending' AND d.next_attempt_at<=unixepoch() ORDER BY d.next_attempt_at LIMIT 10`
  ).all();
  await Promise.allSettled(
    results.map(({ orderId }) => deliverTelegramOrder(env, orderId))
  );
}
__name(retryTelegramOrders, "retryTelegramOrders");

// worker/bookingTelegram.ts
var preferences = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  "private-room": "Private room"
};
var maxAttempts2 = 3;
async function deliverBookingAlert(env, id2) {
  const delivery = await env.DB.prepare(
    `UPDATE telegram_booking_deliveries
    SET attempts=attempts+1,next_attempt_at=unixepoch()+120,updated_at=unixepoch()
    WHERE booking_id=? AND status='pending' AND next_attempt_at<=unixepoch()
    RETURNING chat_id AS chatId,attempts`
  ).bind(id2).first();
  if (!delivery) return;
  const booking = delivery.attempts <= maxAttempts2 ? await env.DB.prepare(
    `SELECT bk.business_id AS businessId,
    b.name AS businessName,br.name AS branchName,bk.timezone,bk.arrival_date AS arrivalDate,bk.arrival_time AS arrivalTime,
    bk.pax,bk.guest_name AS guestName,bk.guest_phone AS guestPhone,bk.preference,
    bk.preference_text AS preferenceText,bk.note,settings.encrypted_token AS encryptedToken
    FROM bookings bk JOIN businesses b ON b.id=bk.business_id
    JOIN branches br ON br.business_id=bk.business_id AND br.id=bk.branch_id
    JOIN business_booking_settings settings ON settings.business_id=bk.business_id
    JOIN branch_booking_settings branch ON branch.business_id=bk.business_id AND branch.branch_id=bk.branch_id
    WHERE bk.id=? AND b.is_active=1 AND settings.telegram_enabled=1 AND settings.encrypted_token IS NOT NULL
      AND branch.chat_id=?`
  ).bind(id2, delivery.chatId).first() : null;
  let result = {
    ok: false,
    error: delivery.attempts > maxAttempts2 ? "Retry limit reached" : "Booking alert configuration changed"
  };
  if (booking) {
    const message = [
      `New eMenu booking request \xB7 ${id2}`,
      `${booking.businessName} \xB7 ${booking.branchName}`,
      `Arrival: ${booking.arrivalDate} ${booking.arrivalTime} (${booking.timezone})`,
      `Guests: ${booking.pax}`,
      `Name: ${booking.guestName.replace(/\s+/g, " ")}`,
      `Phone: ${booking.guestPhone}`,
      booking.preference && `Preference: ${preferences[booking.preference]}`,
      booking.preferenceText && `Preference details: ${booking.preferenceText}`,
      booking.note && `Note: ${booking.note}`
    ].filter(Boolean).join("\n");
    result = await sendTelegramMessage(
      env,
      booking.businessId,
      {
        enabled: 1,
        chatId: delivery.chatId,
        encryptedToken: booking.encryptedToken
      },
      message
    );
  }
  const retry = !result.ok && result.retryAfter && delivery.attempts < maxAttempts2 ? result.retryAfter : null;
  await env.DB.prepare(
    `UPDATE telegram_booking_deliveries SET status=?,error=?,
    next_attempt_at=unixepoch()+?,updated_at=unixepoch()
    WHERE booking_id=? AND status='pending' AND attempts=?`
  ).bind(
    result.ok ? "sent" : retry ? "pending" : "failed",
    result.ok ? null : result.error,
    retry ?? 0,
    id2,
    delivery.attempts
  ).run();
}
__name(deliverBookingAlert, "deliverBookingAlert");
async function retryBookingAlerts(env) {
  const { results } = await env.DB.prepare(
    `SELECT booking_id AS id FROM telegram_booking_deliveries
    WHERE status='pending' AND next_attempt_at<=unixepoch() ORDER BY next_attempt_at LIMIT 30`
  ).all();
  for (const { id: id2 } of results) await deliverBookingAlert(env, id2);
}
__name(retryBookingAlerts, "retryBookingAlerts");

// ../../shared/telegramNotifications.ts
var telegramSources = ["Order", "Booking"];
var maxTelegramChatsPerRule = 20;
var maxTelegramChatListLength = maxTelegramChatsPerRule * 35;
var maxTelegramOrderActionUrlLength = 2048;
var telegramDeliveryRetentionDays = 7;
var minTelegramDeliveryRetentionDays = 1;
var maxTelegramDeliveryRetentionDays = 90;
var telegramTemplates = {
  Order: {
    title: "New order {{doc.order_number}}",
    message: `{{doc.business.name}} \xB7 {{doc.branch.name}}
Table: {{doc.table.label}}
Date: {{format_date(doc.posting_date)}}
Total: {{format_currency(doc.total_amount)}}
{% for op in doc.products %}
{{op.quantity}} \xD7 {{op.product_name}} \xB7 {{format_currency(op.total_amount)}}
{% endfor %}`
  },
  Booking: {
    title: "New booking {{doc.id}}",
    message: `{{doc.business.name}} \xB7 {{doc.branch.name}}
Arrival: {{format_date(doc.arrival_date)}} at {{doc.arrival_time}}
Guests: {{doc.pax}}
Name: {{doc.guest_name}}
Phone: {{doc.guest_phone}}
Note: {{doc.note}}`
  }
};

// worker/telegramNotificationSources.ts
var business = {
  id: "business_demo",
  name: "Sample Cafe",
  slug: "sample-cafe",
  currency: "USD",
  timezone: "Asia/Phnom_Penh"
};
var branch = {
  id: "branch_demo",
  name: "Main Branch",
  slug: "main",
  address: "1 Market Street",
  phone: "012 345 678"
};
var sampleCommon = {
  business_id: business.id,
  branch_id: branch.id,
  business,
  branch
};
var sampleProduct = {
  id: "product_demo",
  code: "C01",
  name: "Coffee",
  name_km: "\u1780\u17B6\u17A0\u17D2\u179C\u17C1",
  name_en: "Coffee",
  name_zh: "\u5496\u5561",
  unit: "Cup",
  category: { id: "category_demo", name: "Drinks", slug: "drinks" }
};
var modifierFields = {
  id: "option_demo",
  groupId: "group_demo",
  labelKm: "",
  labelEn: "Oat milk",
  labelZh: "",
  prefix: "",
  priceCents: 0.5
};
var telegramExamples = {
  Order: {
    ...sampleCommon,
    id: "order_demo",
    order_number: "261110-001",
    posting_date: "2026-11-10",
    submitted_at: "2026-11-10T05:00:00Z",
    status: "submitted",
    currency: "USD",
    total_quantity: 2,
    total_amount: 7,
    note: "Please serve the drinks first.",
    table_id: "table_demo",
    table: {
      id: "table_demo",
      code: "T01",
      label: "Table 1",
      group: { id: "tables_demo", name: "Main Area" }
    },
    menu_id: "menu_demo",
    menu: {
      id: "menu_demo",
      slug: "dinner",
      name_km: "",
      name_en: "Dinner",
      name_zh: ""
    },
    products: [
      {
        order_id: "order_demo",
        line_number: 1,
        product_id: sampleProduct.id,
        product_code: sampleProduct.code,
        product_name: sampleProduct.name,
        quantity: 2,
        price: 3.5,
        total_amount: 7,
        note: "Less ice",
        portion_id: "portion_demo",
        portion_name: "Large",
        price_list: "normal_demo",
        portion: {
          id: "portion_demo",
          labelKm: "",
          labelEn: "Large",
          labelZh: "",
          unit: "Cup",
          priceCents: 3
        },
        price_list_record: { id: "normal_demo", name: "Normal Rate" },
        product: sampleProduct,
        modifiers: [modifierFields]
      }
    ]
  },
  Booking: {
    ...sampleCommon,
    id: "BK-0000000000000001",
    arrival_date: "2026-11-12",
    arrival_time: "18:30",
    arrival_at: "2026-11-12T11:30:00Z",
    timezone: business.timezone,
    pax: 4,
    guest_name: "Sample Guest",
    guest_phone: "012 345 678",
    preference: "outdoor",
    preference_text: "Covered area",
    note: "Birthday dinner",
    status: "requested",
    terms_language: "en",
    terms_version: "1",
    terms_text: "Example booking terms",
    terms_accepted_at: "2026-11-10 05:00:00",
    created_at: "2026-11-10 05:00:00",
    updated_at: "2026-11-10 05:00:00"
  }
};
var businessJson = `json_object('id',b.id,'name',b.name,'slug',b.slug,'currency',b.currency,'timezone',b.timezone)`;
var branchJson = `CASE WHEN br.id IS NOT NULL THEN
  json_object('id',br.id,'name',br.name,'slug',br.slug,'address',br.address,'phone',br.phone) END`;
function parseFields(row, fields2) {
  for (const name of fields2) {
    const value = row[name];
    if (typeof value === "string")
      row[name] = JSON.parse(value);
  }
  return row;
}
__name(parseFields, "parseFields");
async function orderContext(db, businessId, sourceId) {
  const [orders, lines] = await db.batch([
    db.prepare(
      `SELECT o.id,o.business_id,o.branch_id,o.table_id,o.menu_id,o.order_number,o.posting_date,
      o.submitted_at,o.status,o.currency,o.total_quantity,o.total_amount,o.note,
      ${businessJson} AS business,${branchJson} AS branch,
      CASE WHEN tbl.id IS NOT NULL THEN json_object('id',tbl.id,'code',tbl.code,'label',tbl.label,
        'group',CASE WHEN grp.id IS NOT NULL THEN json_object('id',grp.id,'name',grp.name) END) END AS 'table',
      CASE WHEN m.id IS NOT NULL THEN json_object('id',m.id,'slug',m.slug,'name_km',m.name_km,
        'name_en',m.name_en,'name_zh',m.name_zh) END AS menu
      FROM orders o JOIN businesses b ON b.id=o.business_id
      LEFT JOIN branches br ON br.business_id=o.business_id AND br.id=o.branch_id
      LEFT JOIN restaurant_tables tbl ON tbl.business_id=o.business_id AND tbl.id=o.table_id
      LEFT JOIN table_groups grp ON grp.business_id=o.business_id AND grp.id=tbl.group_id
      LEFT JOIN menus m ON m.business_id=o.business_id AND m.id=o.menu_id
      WHERE o.business_id=? AND o.id=?`
    ).bind(businessId, sourceId),
    db.prepare(
      `SELECT line.order_id,line.line_number,line.product_id,line.product_code,
      COALESCE(NULLIF(line.product_name,''),p.name,line.product_id) AS product_name,
      line.quantity,line.price,line.total_amount,line.note,line.portion_id,line.portion_name,line.price_list,line.modifiers,
      (SELECT json_object('id',json_extract(value,'$.id'),'labelKm',json_extract(value,'$.labelKm'),
        'labelEn',json_extract(value,'$.labelEn'),'labelZh',json_extract(value,'$.labelZh'),
        'unit',json_extract(value,'$.unit'),'priceCents',json_extract(value,'$.priceCents'))
        FROM json_each(CASE WHEN json_valid(p.portions_json) THEN p.portions_json ELSE '[]' END)
        WHERE json_extract(value,'$.id')=line.portion_id LIMIT 1) AS portion,
      CASE WHEN pl.id IS NOT NULL THEN json_object('id',pl.id,'name',pl.name) END AS price_list_record,
      CASE WHEN p.id IS NOT NULL THEN json_object('id',p.id,'code',p.code,'name',p.name,'name_km',p.name_km,
        'name_en',p.name_en,'name_zh',p.name_zh,'unit',p.unit,'category',
        CASE WHEN c.id IS NOT NULL THEN json_object('id',c.id,'name',c.name,'slug',c.slug) END) END AS product
      FROM order_products line JOIN orders o ON o.id=line.order_id
      LEFT JOIN products p ON p.business_id=o.business_id AND p.id=line.product_id
      LEFT JOIN categories c ON c.business_id=o.business_id AND c.id=p.category_id
      LEFT JOIN price_lists pl ON pl.business_id=o.business_id AND pl.id=line.price_list
      WHERE o.business_id=? AND o.id=? ORDER BY line.line_number`
    ).bind(businessId, sourceId)
  ]);
  const order = orders.results[0];
  if (!order) return null;
  order.products = lines.results.map((line) => {
    parseFields(line, ["product", "price_list_record", "portion", "modifiers"]);
    if (Array.isArray(line.modifiers))
      line.modifiers = line.modifiers.map((modifier) => ({
        ...Object.fromEntries(
          Object.keys(modifierFields).map((key) => [key, null])
        ),
        ...modifier && typeof modifier === "object" && !Array.isArray(modifier) ? modifier : {}
      }));
    return line;
  });
  return parseFields(order, ["business", "branch", "table", "menu"]);
}
__name(orderContext, "orderContext");
async function telegramSourceContext(db, businessId, source, sourceId) {
  if (source === "Order") return orderContext(db, businessId, sourceId);
  const booking = await db.prepare(
    `SELECT bk.id,bk.business_id,bk.branch_id,bk.arrival_date,bk.arrival_time,
    bk.arrival_at,bk.timezone,bk.pax,bk.guest_name,bk.guest_phone,bk.preference,bk.preference_text,bk.note,bk.status,
    bk.terms_language,bk.terms_version,bk.terms_text,bk.terms_accepted_at,bk.created_at,bk.updated_at,
    ${businessJson} AS business,${branchJson} AS branch
    FROM bookings bk JOIN businesses b ON b.id=bk.business_id
    JOIN branches br ON br.business_id=bk.business_id AND br.id=bk.branch_id
    WHERE bk.business_id=? AND bk.id=?`
  ).bind(businessId, sourceId).first();
  return booking ? parseFields(booking, ["business", "branch"]) : null;
}
__name(telegramSourceContext, "telegramSourceContext");

// worker/telegramTemplate.ts
var identifier = /^[a-zA-Z][a-zA-Z0-9_]*$/;
var reserved = /* @__PURE__ */ new Set(["constructor", "prototype", "__proto__"]);
var outputLimit = 3900;
function pathFrom(expression) {
  const path = expression.trim().split(".");
  if (path.length > 12 || path.some((part) => !identifier.test(part) || reserved.has(part)))
    throw new Error(`Invalid template field: ${expression}`);
  return path;
}
__name(pathFrom, "pathFrom");
function parseTemplate(template) {
  const root = [];
  const stack = [root];
  let offset = 0;
  for (const match of template.matchAll(
    /\{\{([\s\S]*?)\}\}|\{%([\s\S]*?)%\}|(\{\{|\{%)/g
  )) {
    const body = stack[stack.length - 1];
    if (match.index > offset)
      body.push({ kind: "text", text: template.slice(offset, match.index) });
    offset = match.index + match[0].length;
    if (match[3]) throw new Error("Close the template tag before continuing.");
    if (match[1] !== void 0) {
      const expression = match[1].trim();
      const helper = /^(format_date|format_datetime|format_currency)\(([^(),]+)(?:,([^(),]+))?\)$/.exec(
        expression
      );
      if (helper?.[3] && helper[1] !== "format_currency")
        throw new Error("Only format_currency accepts a second argument.");
      body.push({
        kind: "value",
        path: pathFrom(helper?.[2] ?? expression),
        format: helper?.[1],
        currency: helper?.[3] ? pathFrom(helper[3]) : void 0
      });
      continue;
    }
    const directive = match[2].trim();
    if (directive === "endfor") {
      if (stack.length === 1)
        throw new Error("An endfor tag has no matching for tag.");
      stack.pop();
      continue;
    }
    const loop = /^for\s+([a-zA-Z][a-zA-Z0-9_]*)\s+in\s+(.+)$/.exec(directive);
    if (!loop || loop[1] === "doc" || reserved.has(loop[1]))
      throw new Error("Use {% for item in doc.list %} to start a loop.");
    if (stack.length > 6)
      throw new Error("Templates can nest up to six loops.");
    const children = [];
    body.push({
      kind: "loop",
      alias: loop[1],
      path: pathFrom(loop[2]),
      body: children
    });
    stack.push(children);
  }
  if (stack.length !== 1)
    throw new Error("Close every loop with {% endfor %}.");
  root.push({ kind: "text", text: template.slice(offset) });
  return root;
}
__name(parseTemplate, "parseTemplate");
function read(scope, path) {
  let value = scope;
  for (const part of path) {
    if (value === null) return null;
    if (typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, part))
      throw new Error(`Unknown template field: ${path.join(".")}`);
    value = value[part];
  }
  return value;
}
__name(read, "read");
function dateText(value, timezone, includeTime) {
  if (typeof value !== "string")
    throw new Error("Use a date field with the date formatter.");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(
    value
  ) ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()))
    throw new Error("Use a valid date field with the date formatter.");
  const options = {
    dateStyle: "medium",
    timeZone: dateOnly ? "UTC" : timezone
  };
  if (includeTime && !dateOnly) options.timeStyle = "short";
  return new Intl.DateTimeFormat("en-GB", options).format(date);
}
__name(dateText, "dateText");
function renderTelegramTemplate(template, doc, timezone) {
  let output = "";
  let remaining = 25e3;
  const visit = /* @__PURE__ */ __name((nodes, scope) => {
    for (const node of nodes) {
      if (--remaining <= 0 || output.length > outputLimit) return;
      if (node.kind === "text") {
        output += node.text;
        continue;
      }
      const value = read(scope, node.path);
      if (value === null) continue;
      if (node.kind === "loop") {
        if (!Array.isArray(value))
          throw new Error(`Loop over a list: ${node.path.join(".")}`);
        for (const item of value) {
          if (--remaining <= 0 || output.length > outputLimit) break;
          visit(node.body, { ...scope, [node.alias]: item });
        }
      } else if (node.format === "format_currency") {
        const currency = node.currency ? read(scope, node.currency) : doc.currency;
        if (typeof value !== "number" || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency))
          throw new Error(
            "Use a numeric amount and currency with format_currency."
          );
        output += new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          currencyDisplay: "code"
        }).format(value);
      } else if (node.format) {
        output += dateText(value, timezone, node.format === "format_datetime");
      } else {
        if (typeof value === "object")
          throw new Error(
            `Choose a field or loop over a list: ${node.path.join(".")}`
          );
        output += String(value);
      }
    }
  }, "visit");
  visit(parseTemplate(template), { doc });
  return output.length > outputLimit || remaining <= 0 ? `${output.slice(0, outputLimit - 2).replace(/[\uD800-\uDBFF]$/, "").trimEnd()}\u2026` : output.trim();
}
__name(renderTelegramTemplate, "renderTelegramTemplate");

// worker/telegramNotifications.ts
var endpoint = "/api/admin/telegram-notifications";
var maxAttempts3 = 3;
var maxRules = 100;
var historyPageSize = 40;
var notificationIdPattern = /^tgn_[a-f0-9]{32}$/;
var telegramDeliveryExpiresAt = "delivery.created_at + delivery.history_days * 86400";
var json = /* @__PURE__ */ __name((body, status = 200) => Response.json(body, { status }), "json");
var error = /* @__PURE__ */ __name((message, status = 400) => json({ error: message }, status), "error");
async function canManageTelegramNotifications(db, auth) {
  if (auth.role !== "owner" && auth.role !== "manager") return false;
  return Boolean(
    await db.prepare(
      "SELECT 1 FROM telegram_notification_entitlements WHERE business_id=?"
    ).bind(auth.businessId).first()
  );
}
__name(canManageTelegramNotifications, "canManageTelegramNotifications");
function renderNotification(title, message, doc) {
  const business2 = doc.business;
  const timezone = String(doc.timezone ?? business2.timezone ?? "UTC");
  return renderTelegramTemplate(`${title}

${message}`, doc, timezone);
}
__name(renderNotification, "renderNotification");
function resolveOrderActionUrl(template, doc) {
  const url = template.replace(
    /{{\s*doc\.(id|order_number)\s*}}/g,
    (_, field) => encodeURIComponent(String(doc[field] ?? ""))
  );
  if (!/^https?:\/\/[^/?#]/i.test(url) || /[\s{}\\]/.test(url)) return;
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return parsed.href;
  } catch {
    return;
  }
}
__name(resolveOrderActionUrl, "resolveOrderActionUrl");
function orderActionKeyboard(env, settings, doc, orderId) {
  const base = env.ADMIN_APP_URL || "https://angkor-emenu-admin.pages.dev";
  const row = [];
  for (const { action, enabled, template, text: text2 } of [
    {
      action: "accept",
      enabled: settings.showAcceptButton,
      template: settings.acceptUrl,
      text: "Accept order"
    },
    {
      action: "cancel",
      enabled: settings.showCancelButton,
      template: settings.cancelUrl,
      text: "Cancel order"
    }
  ]) {
    if (!enabled) continue;
    const customUrl = template && resolveOrderActionUrl(template, doc);
    const url = new URL("/orders", base);
    url.searchParams.set("telegramAction", action);
    if (orderId) url.searchParams.set("telegramOrder", orderId);
    row.push({ text: text2, url: customUrl || url.href });
  }
  return row.length ? [row] : void 0;
}
__name(orderActionKeyboard, "orderActionKeyboard");
var activeRoutes = `FROM telegram_notifications route JOIN telegram_notification_entitlements entitlement
  ON entitlement.business_id=route.business_id WHERE route.enabled=1`;
var retryRoute = `SELECT 1 ${activeRoutes}
  AND route.id=delivery.notification_id AND route.business_id=delivery.business_id AND route.source=delivery.source
  AND EXISTS (SELECT 1 FROM telegram_notification_recipients recipient
    WHERE recipient.notification_id=route.id AND recipient.chat_id=delivery.chat_id COLLATE NOCASE)
  AND (
    (delivery.source='Order' AND EXISTS (SELECT 1 FROM orders o WHERE o.id=delivery.source_id
      AND o.business_id=delivery.business_id AND (route.branch_id IS NULL OR route.branch_id=o.branch_id)))
    OR (delivery.source='Booking' AND EXISTS (SELECT 1 FROM bookings bk WHERE bk.id=delivery.source_id
      AND bk.business_id=delivery.business_id AND (route.branch_id IS NULL OR route.branch_id=bk.branch_id)))
  )`;
async function deliveryHistory(db, businessId, url) {
  const status = url.searchParams.get("status");
  if (status && !["pending", "sent", "failed", "cancelled"].includes(status))
    return error("Choose a valid delivery status.");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0)
    return error("Choose a valid history page.");
  const { results } = await db.prepare(
    `SELECT delivery.notification_id AS notificationId,
    delivery.source,delivery.source_id AS sourceId,delivery.source_reference AS reference,delivery.chat_id AS chatId,
    delivery.status,delivery.attempts,delivery.created_at AS createdAt,delivery.updated_at AS updatedAt,delivery.error,
    CASE WHEN delivery.status='failed' THEN EXISTS (${retryRoute}) ELSE 0 END AS canRetry
    FROM telegram_notification_deliveries delivery
    WHERE delivery.business_id=? AND ${telegramDeliveryExpiresAt}>=unixepoch()
      ${status ? "AND delivery.status=?" : ""}
    ORDER BY delivery.created_at DESC,delivery.rowid DESC LIMIT ? OFFSET ?`
  ).bind(businessId, ...status ? [status] : [], historyPageSize + 1, offset).all();
  return json({
    deliveries: results.slice(0, historyPageSize),
    hasMore: results.length > historyPageSize,
    pageSize: historyPageSize
  });
}
__name(deliveryHistory, "deliveryHistory");
function cancelPending(db, businessId, id2, reason) {
  return db.prepare(
    `UPDATE telegram_notification_deliveries SET status='cancelled',error=?,updated_at=unixepoch()
    WHERE notification_id=? AND business_id=? AND status='pending'`
  ).bind(reason, id2, businessId);
}
__name(cancelPending, "cancelPending");
async function adminTelegramNotifications(request, env, path, businessId) {
  const db = env.DB;
  if (path === `${endpoint}/history` && request.method === "GET")
    return deliveryHistory(db, businessId, new URL(request.url));
  if (path === `${endpoint}/history/retry` && request.method === "POST") {
    const body2 = await request.json().catch(() => null);
    const { notificationId, sourceId, chatId: chatId2 } = body2 ?? {};
    if (typeof notificationId !== "string" || !notificationIdPattern.test(notificationId) || typeof sourceId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(sourceId) || typeof chatId2 !== "string" || !telegramChatIdPattern.test(chatId2))
      return error("Choose a valid Telegram delivery.");
    const attempted = await deliver(
      env,
      { notificationId, sourceId, chatId: chatId2 },
      businessId
    );
    return attempted ? json({ ok: true }) : error("This delivery is no longer available to retry.", 409);
  }
  if (path === endpoint && request.method === "GET") {
    const [rules, branches] = await db.batch([
      db.prepare(
        `SELECT rule.id,rule.branch_id AS branchId,rule.source,replace(rule.chat_id,',',', ') AS chatId,
        rule.title,rule.message,rule.enabled,rule.history_days AS historyDays,rule.updated_at AS updatedAt,
        rule.show_accept_button AS showAcceptButton,rule.accept_url AS acceptUrl,
        rule.show_cancel_button AS showCancelButton,rule.cancel_url AS cancelUrl,
        (SELECT delivery.status FROM telegram_notification_deliveries delivery WHERE delivery.notification_id=rule.id
          AND ${telegramDeliveryExpiresAt}>=unixepoch() ORDER BY delivery.updated_at DESC,delivery.rowid DESC LIMIT 1) AS lastStatus
        FROM telegram_notifications rule WHERE rule.business_id=? ORDER BY rule.source,rule.title,rule.id`
      ).bind(businessId),
      db.prepare(
        "SELECT id,name,is_active AS isActive FROM branches WHERE business_id=? ORDER BY is_default DESC,name"
      ).bind(businessId)
    ]);
    return json({
      rules: rules.results,
      branches: branches.results,
      examples: telegramExamples,
      templates: telegramTemplates
    });
  }
  const id2 = /^\/api\/admin\/telegram-notifications\/(tgn_[a-f0-9]{32})$/.exec(
    path
  )?.[1];
  if (id2 && request.method === "DELETE") {
    const [result] = await db.batch([
      db.prepare(
        "DELETE FROM telegram_notifications WHERE business_id=? AND id=?"
      ).bind(businessId, id2),
      cancelPending(
        db,
        businessId,
        id2,
        "Notification rule was deleted before delivery."
      )
    ]);
    return result.meta.changes ? json({ ok: true }) : error("Notification not found.", 404);
  }
  const preview = path === `${endpoint}/preview` && request.method === "POST";
  const testing = path === `${endpoint}/test` && request.method === "POST";
  const creating = path === endpoint && request.method === "POST";
  if (!preview && !testing && !creating && !(id2 && request.method === "PUT"))
    return error("Notification not found.", 404);
  const body = await request.json().catch(() => null);
  const source = telegramSources.find((entry) => entry === body?.source);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!source || !title || title.length > 160 || !message || message.length > 6e3)
    return error(
      "Choose a source and enter a title and message within the length limits."
    );
  let text2;
  try {
    text2 = renderNotification(title, message, telegramExamples[source]);
  } catch (cause) {
    return error(
      cause instanceof Error ? cause.message : "Invalid Telegram template."
    );
  }
  if (!text2) return error("The template renders an empty message.");
  if (preview) return json({ text: text2 });
  const { showAcceptButton, acceptUrl, showCancelButton, cancelUrl } = source === "Order" ? body ?? {} : {};
  if ([showAcceptButton, showCancelButton].some(
    (value) => value !== void 0 && typeof value !== "boolean"
  ))
    return error("Choose whether to show each order button.");
  for (const [label2, show, url] of [
    ["Accept", showAcceptButton, acceptUrl],
    ["Cancel", showCancelButton, cancelUrl]
  ]) {
    const needsUrl = show === true || id2 && show === void 0 && url !== void 0;
    if (needsUrl && (url === void 0 || typeof url === "string" && !url.trim()))
      return error(`Enter a ${label2} URL or turn off the ${label2} button.`);
    if (url === void 0) continue;
    if (typeof url !== "string" || url.length > maxTelegramOrderActionUrlLength || url.trim() && !resolveOrderActionUrl(url.trim(), telegramExamples.Order))
      return error(`Enter a valid HTTP or HTTPS URL for ${label2}.`);
  }
  const orderActions = {
    showAcceptButton: showAcceptButton === void 0 ? null : Number(showAcceptButton),
    acceptUrl: typeof acceptUrl === "string" ? acceptUrl.trim() : null,
    showCancelButton: showCancelButton === void 0 ? null : Number(showCancelButton),
    cancelUrl: typeof cancelUrl === "string" ? cancelUrl.trim() : null
  };
  const chatList = typeof body?.chatId === "string" ? body.chatId.trim() : "";
  if (chatList.length > maxTelegramChatListLength)
    return error(`Enter up to ${maxTelegramChatsPerRule} Telegram chat IDs.`);
  const entries = chatList.split(",").map((entry) => entry.trim()).filter(Boolean);
  const chats = new Map(entries.map((entry) => [entry.toLowerCase(), entry]));
  if (!chats.size || chats.size > maxTelegramChatsPerRule || entries.some((entry) => !telegramChatIdPattern.test(entry)))
    return error(
      `Enter valid Telegram chat IDs separated by commas (up to ${maxTelegramChatsPerRule}).`
    );
  const chatIds = [...chats.values()];
  const token = typeof body?.botToken === "string" ? body.botToken.trim() : "";
  if ((creating || token) && !telegramBotTokenPattern.test(token))
    return error("Enter a valid Telegram bot token.");
  if (testing) {
    const savedId = body?.notificationId;
    if (savedId != null && (typeof savedId !== "string" || !notificationIdPattern.test(savedId)))
      return error("Choose a valid notification.");
    const savedToken = savedId ? await db.prepare(
      "SELECT telegram_token FROM telegram_notifications WHERE id=? AND business_id=?"
    ).bind(savedId, businessId).first("telegram_token") : null;
    if (savedId && !savedToken) return error("Notification not found.", 404);
    const encryptedToken = token ? await encryptTelegramToken(env, businessId, token) : savedToken;
    if (!encryptedToken)
      return error("Enter a Telegram bot token to send a test.");
    const results = [];
    const testMessage = `eMenu test message

${text2}`;
    const keyboard = source === "Order" ? orderActionKeyboard(env, orderActions, telegramExamples.Order) : void 0;
    for (let offset = 0; offset < chatIds.length; offset += 5) {
      const batch = await Promise.all(
        chatIds.slice(offset, offset + 5).map(async (chatId2) => {
          const result = await sendTelegramMessage(
            env,
            businessId,
            { enabled: 1, chatId: chatId2, encryptedToken },
            testMessage,
            keyboard
          );
          return result.ok ? { chatId: chatId2, ok: true } : { chatId: chatId2, ok: false, error: result.error };
        })
      );
      results.push(...batch);
    }
    return json({ results });
  }
  const chatId = chatIds.join(",");
  const branchId = body?.branchId;
  const enabled = body?.enabled;
  const historyDays = body?.historyDays;
  if (branchId !== null && (typeof branchId !== "string" || !await db.prepare("SELECT 1 FROM branches WHERE business_id=? AND id=?").bind(businessId, branchId).first()))
    return error("Choose a branch from this business.");
  if (typeof enabled !== "boolean")
    return error("Choose a notification status.");
  if (historyDays !== void 0 && (typeof historyDays !== "number" || !Number.isInteger(historyDays) || historyDays < minTelegramDeliveryRetentionDays || historyDays > maxTelegramDeliveryRetentionDays))
    return error(
      `Enter a whole number from ${minTelegramDeliveryRetentionDays} to ${maxTelegramDeliveryRetentionDays} for history days.`
    );
  const encrypted = token ? await encryptTelegramToken(env, businessId, token) : null;
  try {
    if (creating) {
      const newId2 = `tgn_${crypto.randomUUID().replaceAll("-", "")}`;
      const result2 = await db.prepare(
        `INSERT INTO telegram_notifications
        (id,business_id,branch_id,source,telegram_token,chat_id,title,message,enabled,history_days,
        show_accept_button,accept_url,show_cancel_button,cancel_url)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM telegram_notifications WHERE business_id=?)<?`
      ).bind(
        newId2,
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
        maxRules
      ).run();
      return result2.meta.changes ? json({ id: newId2 }, 201) : error(`This business can have up to ${maxRules} notifications.`, 409);
    }
    if (!id2) return error("Notification not found.", 404);
    const result = await db.prepare(
      `UPDATE telegram_notifications SET branch_id=?,source=?,telegram_token=COALESCE(?,telegram_token),
        chat_id=?,title=?,message=?,enabled=?,history_days=COALESCE(?,history_days),
        show_accept_button=COALESCE(?,show_accept_button),accept_url=COALESCE(?,accept_url),
        show_cancel_button=COALESCE(?,show_cancel_button),cancel_url=COALESCE(?,cancel_url),updated_at=CURRENT_TIMESTAMP
        WHERE business_id=? AND id=?`
    ).bind(
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
      id2
    ).run();
    return result.meta.changes ? json({ id: id2 }) : error("Notification not found.", 404);
  } catch (cause) {
    if (String(cause).includes("TELEGRAM_DUPLICATE_RECIPIENT"))
      return error(
        "One or more chats already have a notification for that source and branch.",
        409
      );
    throw cause;
  }
}
__name(adminTelegramNotifications, "adminTelegramNotifications");
async function deliver(env, { notificationId, sourceId, chatId }, retryBusinessId) {
  const db = env.DB;
  const claimScope = retryBusinessId ? `delivery.business_id=? AND EXISTS (${retryRoute})` : `delivery.next_attempt_at<=unixepoch() AND EXISTS (SELECT 1 ${activeRoutes}
      AND route.id=delivery.notification_id AND route.business_id=delivery.business_id AND route.source=delivery.source)`;
  const claim = await db.prepare(
    `UPDATE telegram_notification_deliveries AS delivery
    SET status='pending',attempts=attempts+1,next_attempt_at=unixepoch()+120,updated_at=unixepoch()
    WHERE notification_id=? AND source_id=? AND chat_id=? AND status=?
      AND ${telegramDeliveryExpiresAt}>=unixepoch() AND ${claimScope}
    RETURNING attempts,business_id AS businessId,source`
  ).bind(
    notificationId,
    sourceId,
    chatId,
    retryBusinessId ? "failed" : "pending",
    ...retryBusinessId ? [retryBusinessId] : []
  ).first();
  if (!claim) return false;
  const route = await db.prepare(
    `SELECT route.business_id AS businessId,route.source,route.title,route.message,
    route.telegram_token AS encryptedToken,route.enabled,
    route.show_accept_button AS showAcceptButton,route.accept_url AS acceptUrl,
    route.show_cancel_button AS showCancelButton,route.cancel_url AS cancelUrl
    ${activeRoutes} AND route.id=? AND route.business_id=? AND route.source=?`
  ).bind(notificationId, claim.businessId, claim.source).first();
  let result = {
    ok: false,
    error: "Notification or source record is unavailable."
  };
  if (route && (retryBusinessId || claim.attempts <= maxAttempts3)) {
    const doc = await telegramSourceContext(
      db,
      route.businessId,
      route.source,
      sourceId
    );
    if (doc) {
      let text2 = "";
      try {
        text2 = renderNotification(route.title, route.message, doc);
      } catch {
        result = {
          ok: false,
          error: "The message could not be rendered. Review the notification template."
        };
      }
      if (text2 && await db.prepare(
        `SELECT 1 FROM telegram_notification_deliveries
        WHERE notification_id=? AND source_id=? AND chat_id=? AND status='pending' AND attempts=?
          AND EXISTS (SELECT 1 ${activeRoutes} AND route.id=notification_id)`
      ).bind(notificationId, sourceId, chatId, claim.attempts).first())
        result = await sendTelegramMessage(
          env,
          route.businessId,
          { ...route, chatId },
          text2,
          route.source === "Order" && doc.status === "submitted" ? orderActionKeyboard(env, route, doc, sourceId) : void 0
        );
    }
  }
  const retryIn = !result.ok && !retryBusinessId && claim.attempts < maxAttempts3 ? result.retryAfter ?? 0 : 0;
  await db.prepare(
    `UPDATE telegram_notification_deliveries SET status=?,error=?,next_attempt_at=unixepoch()+?,updated_at=unixepoch()
    WHERE notification_id=? AND source_id=? AND chat_id=? AND attempts=?
      AND (status='pending' OR (status='cancelled' AND ?=1))`
  ).bind(
    result.ok ? "sent" : retryIn ? "pending" : "failed",
    result.ok ? null : result.error,
    retryIn,
    notificationId,
    sourceId,
    chatId,
    claim.attempts,
    Number(result.ok)
  ).run();
  return true;
}
__name(deliver, "deliver");
async function deliverTelegramNotifications(env, source, sourceId) {
  const base = `SELECT delivery.notification_id AS notificationId,delivery.source_id AS sourceId,delivery.chat_id AS chatId
    FROM telegram_notification_deliveries delivery
    JOIN telegram_notifications route ON route.id=delivery.notification_id
    JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=route.business_id
    WHERE delivery.status='pending' AND delivery.next_attempt_at<=unixepoch()
      AND ${telegramDeliveryExpiresAt}>=unixepoch() AND route.enabled=1`;
  const statement = source ? env.DB.prepare(
    `${base} AND route.source=? AND delivery.source_id=? ORDER BY delivery.next_attempt_at LIMIT 10`
  ).bind(source, sourceId) : env.DB.prepare(`${base} ORDER BY delivery.next_attempt_at LIMIT 30`);
  const { results } = await statement.all();
  for (let offset = 0; offset < results.length; offset += 5)
    await Promise.allSettled(
      results.slice(offset, offset + 5).map((delivery) => deliver(env, delivery))
    );
}
__name(deliverTelegramNotifications, "deliverTelegramNotifications");

// worker/bookings.ts
var json2 = /* @__PURE__ */ __name((body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } }), "json");
var error2 = /* @__PURE__ */ __name((status, message, code) => json2({ error: message, code }, status), "error");
var unavailable = /* @__PURE__ */ __name(() => error2(
  404,
  "Booking is unavailable for this business or branch",
  "BOOKING_UNAVAILABLE"
), "unavailable");
var clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
var uuid2 = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
var bookingId = /^BK-[A-F0-9]{16}$/;
function parseHours(value) {
  try {
    const rows = JSON.parse(value);
    return Array.isArray(rows) ? rows.filter(
      (row) => row && Number.isInteger(row.day) && row.day >= 0 && row.day <= 6 && row.enabled === true && clockTime.test(row.open) && clockTime.test(row.close)
    ) : [];
  } catch {
    return [];
  }
}
__name(parseHours, "parseHours");
function dayLimits(business2, now) {
  const today = bookingDateAt(now, business2.timezone);
  return { today, lastDate: addBookingDays(today, business2.advanceDays) };
}
__name(dayLimits, "dayLimits");
function arrivalSlots(date, business2, blockedDates, now) {
  const { today, lastDate } = dayLimits(business2, now);
  if (!validBookingDate(date) || date < today || date > lastDate || blockedDates.includes(date))
    return [];
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  const weekday = new Date(dayStart).getUTCDay();
  const hours = parseHours(business2.hoursJson);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: business2.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  function localStamp(instant) {
    const fields2 = Object.fromEntries(
      formatter.formatToParts(instant).map(({ type, value }) => [type, value])
    );
    return Date.parse(
      `${fields2.year}-${fields2.month}-${fields2.day}T${fields2.hour}:${fields2.minute}:00Z`
    );
  }
  __name(localStamp, "localStamp");
  const offsets = [
    ...new Set(
      [-1, 0, 1].map((day) => {
        const stamp = dayStart + day * 864e5;
        return localStamp(stamp) - stamp;
      })
    )
  ];
  const minutes = /* @__PURE__ */ __name((value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)), "minutes");
  const firstAllowed = now + business2.noticeMinutes * 6e4;
  const slots = /* @__PURE__ */ new Map();
  for (const offset of [-1, 0]) {
    const schedule = hours.find(
      (row) => row.day === (weekday + offset + 7) % 7
    );
    if (!schedule) continue;
    const open = minutes(schedule.open);
    const close = minutes(schedule.close);
    if (open === close) continue;
    const end = close + (close < open ? 1440 : 0);
    for (let minute = open; minute < end; minute += business2.slotMinutes) {
      const localMinute = minute + offset * 1440;
      if (localMinute < 0 || localMinute >= 1440) continue;
      const wall = dayStart + localMinute * 6e4;
      const arrival = offsets.map((zoneOffset) => wall - zoneOffset).filter((instant) => localStamp(instant) === wall).sort((a, b) => a - b)[0];
      if (arrival === void 0 || arrival < firstAllowed || arrival <= now)
        continue;
      slots.set(
        new Date(wall).toISOString().slice(11, 16),
        new Date(arrival).toISOString()
      );
    }
  }
  return [...slots].sort(([a], [b]) => a.localeCompare(b)).map(([time, arrivalAt]) => ({ time, arrivalAt }));
}
__name(arrivalSlots, "arrivalSlots");
function readBusiness(db, slug2) {
  return db.prepare(
    `SELECT b.id,b.name,b.timezone,b.business_hours_json AS hoursJson,
    (${bookingEnabled}) AS enabled,settings.revision,${bookingSettingsColumns}
    FROM businesses b ${bookingPolicyJoins} WHERE b.slug=? AND b.is_active=1`
  ).bind(slug2).first();
}
__name(readBusiness, "readBusiness");
function readBranch(db, businessId, slug2) {
  return db.prepare(
    `SELECT br.id,br.slug,br.name,br.is_active AS active,
    CASE WHEN b.show_header_phones=1 THEN CASE WHEN br.is_default=1 THEN b.phone ELSE br.phone END ELSE '' END AS phone,
    COALESCE(branch.enabled,0) AS enabled,COALESCE(branch.blocked_dates_json,'[]') AS blockedDatesJson
    FROM branches br JOIN businesses b ON b.id=br.business_id
    LEFT JOIN branch_booking_settings branch ON branch.business_id=br.business_id AND branch.branch_id=br.id
    WHERE br.business_id=? AND br.slug=?`
  ).bind(businessId, slug2).first();
}
__name(readBranch, "readBranch");
var receiptColumns = `bk.id AS reference, br.name AS branchName,bk.arrival_date AS arrivalDate,
  bk.arrival_time AS arrivalTime,bk.pax`;
var summaryColumns = `${receiptColumns},bk.id,bk.branch_id AS branchId,bk.guest_name AS guestName,bk.status`;
var bookingsJoin = "FROM bookings bk JOIN branches br ON br.business_id=bk.business_id AND br.id=bk.branch_id";
async function readBody2(request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return null;
  const value = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
__name(readBody2, "readBody");
function parseSubmission(body) {
  if (!body) return null;
  const {
    submissionId,
    arrivalDate,
    arrivalTime,
    pax,
    termsAccepted,
    termsLanguage,
    termsVersion
  } = body;
  const readText = /* @__PURE__ */ __name((key, limit, required = false) => {
    const value = body[key] ?? "";
    return typeof value === "string" && value.length <= limit && (!required || value.trim()) ? value.trim() : null;
  }, "readText");
  const guestName = readText("guestName", 100, true);
  const guestPhone = readText("guestPhone", 32, true)?.replace(
    /[០-៩]/g,
    (digit) => String(digit.charCodeAt(0) - 6112)
  );
  const preference = readText("preference", 24);
  const preferenceText = readText("preferenceText", 200);
  const note = readText("note", 500);
  if (typeof submissionId !== "string" || !uuid2.test(submissionId) || typeof arrivalDate !== "string" || !validBookingDate(arrivalDate) || typeof arrivalTime !== "string" || !clockTime.test(arrivalTime) || typeof pax !== "number" || !Number.isInteger(pax) || pax < 1 || pax > 1e3 || !guestName || !guestPhone || !/^\+?[\d ()-]+$/.test(guestPhone) || !/^\d{6,20}$/.test(guestPhone.replace(/\D/g, "")) || preference === null || preference !== "" && !bookingPreferences.some((option) => option === preference) || preferenceText === null || note === null || termsAccepted !== true || termsLanguage !== "km" && termsLanguage !== "en" || typeof termsVersion !== "string" || !/^[a-f0-9]{64}$/.test(termsVersion))
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
    termsVersion
  };
}
__name(parseSubmission, "parseSubmission");
async function publicBookings(request, url, env, slug2, execution) {
  if (request.method !== "GET" && request.method !== "POST")
    return error2(405, "Method not allowed");
  const branches = url.searchParams.getAll("branch");
  if (branches.length > 1 || branches.length === 1 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branches[0]))
    return unavailable();
  const business2 = await readBusiness(env.DB, slug2);
  if (!business2) return unavailable();
  const ready = Boolean(business2.enabled && business2.termsVersion);
  if (!branches.length) {
    if (request.method === "POST")
      return error2(400, "Select a branch", "BOOKING_BRANCH_REQUIRED");
    if (!ready) return unavailable();
    const { results } = await env.DB.prepare(
      `SELECT br.id,br.slug,br.name
      FROM branches br JOIN branch_booking_settings branch ON branch.business_id=br.business_id AND branch.branch_id=br.id
      WHERE br.business_id=? AND br.is_active=1 AND branch.enabled=1 ORDER BY br.is_default DESC,br.name,br.id`
    ).bind(business2.id).all();
    return results.length ? json2({ businessName: business2.name, branches: results }) : unavailable();
  }
  const branch2 = await readBranch(env.DB, business2.id, branches[0]);
  if (!branch2) return unavailable();
  const now = Date.now();
  const blockedDates = parseBookingDates(branch2.blockedDatesJson);
  if (request.method === "GET") {
    if (!ready || !branch2.active || !branch2.enabled) return unavailable();
    const date = url.searchParams.get("date");
    if (date !== null && !validBookingDate(date))
      return error2(400, "Select a valid arrival date", "BOOKING_INVALID_DATE");
    return json2({
      businessName: business2.name,
      branch: {
        id: branch2.id,
        slug: branch2.slug,
        name: branch2.name,
        phone: branch2.phone
      },
      timezone: business2.timezone,
      ...dayLimits(business2, now),
      businessHours: parseHours(business2.hoursJson),
      blockedDates,
      minPax: business2.minPax,
      maxPax: business2.maxPax,
      slotMinutes: business2.slotMinutes,
      noticeMinutes: business2.noticeMinutes,
      advanceDays: business2.advanceDays,
      preferences: bookingPreferences,
      terms: {
        km: business2.termsKm,
        en: business2.termsEn,
        version: business2.termsVersion
      },
      slots: date ? arrivalSlots(date, business2, blockedDates, now).map(
        ({ time }) => time
      ) : []
    });
  }
  const submission = parseSubmission(await readBody2(request));
  if (!submission)
    return error2(
      400,
      "Enter valid booking details and accept the terms",
      "BOOKING_INVALID_DETAILS"
    );
  const requestHash = await bookingHash([branch2.id, submission]);
  const existing = /* @__PURE__ */ __name(async () => env.DB.prepare(
    `SELECT ${receiptColumns},bk.request_hash AS requestHash
    ${bookingsJoin} WHERE bk.business_id=? AND bk.submission_id=?`
  ).bind(business2.id, submission.submissionId).first(), "existing");
  const replay = /* @__PURE__ */ __name(({
    requestHash: previousHash,
    ...receipt
  }) => previousHash === requestHash ? json2(receipt) : error2(
    409,
    "This submission ID was already used",
    "BOOKING_REPLAY_CONFLICT"
  ), "replay");
  const saved = await existing();
  if (saved) return replay(saved);
  if (!ready || !branch2.active || !branch2.enabled) return unavailable();
  if (submission.termsVersion !== business2.termsVersion)
    return error2(
      409,
      "The booking terms have changed",
      "BOOKING_TERMS_CHANGED"
    );
  if (submission.pax < business2.minPax || submission.pax > business2.maxPax)
    return error2(
      400,
      "The party size is outside the allowed range",
      "BOOKING_INVALID_PARTY"
    );
  const slot = arrivalSlots(
    submission.arrivalDate,
    business2,
    blockedDates,
    Date.now()
  ).find(({ time }) => time === submission.arrivalTime);
  if (!slot)
    return error2(
      409,
      "That arrival slot is unavailable",
      "BOOKING_SLOT_UNAVAILABLE"
    );
  const reference2 = `BK-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const insert = env.DB.prepare(
    `INSERT INTO bookings
    (id,business_id,branch_id,submission_id,request_hash,arrival_date,arrival_time,arrival_at,timezone,pax,
      guest_name,guest_phone,preference,preference_text,note,terms_language,terms_version,terms_text)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    WHERE EXISTS (SELECT 1 FROM businesses b ${bookingPolicyJoins}
      JOIN branches br ON br.business_id=b.id AND br.id=? AND br.is_active=1
      JOIN branch_booking_settings branch ON branch.business_id=b.id AND branch.branch_id=br.id AND branch.enabled=1
      WHERE b.id=? AND (${bookingEnabled}) AND settings.revision=? AND b.timezone=? AND b.business_hours_json=?)
    ON CONFLICT(business_id,submission_id) DO NOTHING RETURNING id`
  ).bind(
    reference2,
    business2.id,
    branch2.id,
    submission.submissionId,
    requestHash,
    submission.arrivalDate,
    submission.arrivalTime,
    slot.arrivalAt,
    business2.timezone,
    submission.pax,
    submission.guestName,
    submission.guestPhone,
    submission.preference,
    submission.preferenceText,
    submission.note,
    submission.termsLanguage,
    submission.termsVersion,
    submission.termsLanguage === "km" ? business2.termsKm : business2.termsEn,
    branch2.id,
    business2.id,
    business2.revision,
    business2.timezone,
    business2.hoursJson
  );
  const [insertedBooking] = await env.DB.batch([
    insert,
    captureWebhook(env.DB, "bookings", "inserted", "r.business_id=? AND r.id=?", [business2.id, reference2])
  ]);
  const inserted = insertedBooking.results[0];
  if (!inserted) {
    const concurrent = await existing();
    return concurrent ? replay(concurrent) : error2(409, "Booking settings have changed", "BOOKING_RULES_CHANGED");
  }
  execution.waitUntil(deliverBookingAlert(env, reference2));
  scheduleBranchWebhooks(env, execution, business2.id);
  execution.waitUntil(deliverTelegramNotifications(env, "Booking", reference2).catch(() => {
    console.error("custom_telegram_booking_delivery_failed", { reference: reference2 });
  }));
  return json2(
    {
      reference: reference2,
      branchName: branch2.name,
      arrivalDate: submission.arrivalDate,
      arrivalTime: submission.arrivalTime,
      pax: submission.pax
    },
    201
  );
}
__name(publicBookings, "publicBookings");
async function assignBookingTable(db, businessId, id2, body) {
  const tableId = body?.tableId;
  const expected = body?.expectedTableId;
  const valid = /* @__PURE__ */ __name((value) => value === null || typeof value === "string" && value.length > 0 && value.length <= 250, "valid");
  if (!valid(tableId) || !valid(expected)) return error2(400, "Invalid booking table");
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
    RETURNING table_id AS tableId`
  ).bind(tableId, businessId, id2, expected).first();
  return assigned ? json2(assigned) : error2(409, "The table is unavailable or the booking changed");
}
__name(assignBookingTable, "assignBookingTable");
async function adminBookings(request, url, env, path, businessId, access, execution) {
  if (!access.visible) return error2(403, "Booking access is required");
  if (path === "/api/admin/bookings" && request.method === "GET") {
    const from = url.searchParams.get("from"), to = url.searchParams.get("to"), branchId = url.searchParams.get("branchId");
    const page = Number(url.searchParams.get("page") ?? 1);
    if (from !== null && !validBookingDate(from) || to !== null && !validBookingDate(to) || from && to && from > to || !Number.isSafeInteger(page) || page < 1 || page > 1e5)
      return error2(400, "Enter a valid booking date range and page");
    const filters = ["bk.business_id=?"];
    const bindings2 = [businessId];
    if (from) {
      filters.push("bk.arrival_date>=?");
      bindings2.push(from);
    }
    if (to) {
      filters.push("bk.arrival_date<=?");
      bindings2.push(to);
    }
    if (branchId) {
      filters.push("bk.branch_id=?");
      bindings2.push(branchId);
    }
    const limit = 100;
    const [bookings, branches, business2] = await Promise.all([
      env.DB.prepare(
        `SELECT ${summaryColumns} ${bookingsJoin} WHERE ${filters.join(" AND ")}
        ORDER BY bk.arrival_date,bk.arrival_time,bk.id LIMIT ? OFFSET ?`
      ).bind(...bindings2, limit + 1, (page - 1) * limit).all(),
      env.DB.prepare(
        "SELECT id,name,slug FROM branches WHERE business_id=? ORDER BY name,id"
      ).bind(businessId).all(),
      env.DB.prepare("SELECT timezone FROM businesses WHERE id=?").bind(businessId).first()
    ]);
    return json2({
      bookings: bookings.results.slice(0, limit),
      branches: branches.results,
      hasMore: bookings.results.length > limit,
      canManage: access.canManage,
      timezone: business2?.timezone || "UTC"
    });
  }
  const match = /^\/api\/admin\/bookings\/([^/]+)(\/status|\/table)?$/.exec(path);
  if (!match || !bookingId.test(match[1]))
    return error2(404, "Booking not found");
  const [, id2, action] = match;
  if (request.method === "GET" && !action) {
    const booking = await env.DB.prepare(
      `SELECT ${summaryColumns},bk.guest_phone AS guestPhone,bk.preference,
      bk.preference_text AS preferenceText,bk.note,bk.timezone,bk.terms_language AS termsLanguage,bk.terms_version AS termsVersion,
      bk.terms_text AS termsText,bk.terms_accepted_at AS termsAcceptedAt,bk.created_at AS createdAt,
      bk.table_id AS tableId,rt.label AS tableLabel
      ${bookingsJoin}
      LEFT JOIN restaurant_tables rt ON rt.id=bk.table_id AND rt.business_id=bk.business_id AND rt.branch_id=bk.branch_id
      WHERE bk.business_id=? AND bk.id=?`
    ).bind(businessId, id2).first();
    if (!booking) return error2(404, "Booking not found");
    const tableOptions = access.canManage && booking.status === "confirmed" ? (await env.DB.prepare(
      `SELECT t.id,t.label,g.name AS groupName
          FROM restaurant_tables t JOIN table_groups g
            ON g.id=t.group_id AND g.business_id=t.business_id AND g.branch_id=t.branch_id
          WHERE t.business_id=? AND t.branch_id=? AND t.is_active=1 AND g.is_active=1
          ORDER BY g.sort_order,g.name,t.sort_order,t.id`
    ).bind(businessId, booking.branchId).all()).results : [];
    return json2({ booking, tableOptions, canManage: access.canManage });
  }
  if (request.method !== "PATCH" || !action)
    return error2(405, "Method not allowed");
  if (!access.canManage)
    return error2(403, "Booking changes are unavailable");
  const body = await readBody2(request);
  if (action === "/table") return assignBookingTable(env.DB, businessId, id2, body);
  const current = bookingStatuses.find(
    (status) => status === body?.expectedStatus
  );
  const next = bookingStatuses.find((status) => status === body?.status);
  if (!current || !next || !bookingStatusActions(current).includes(next))
    return error2(400, "Invalid booking status change");
  const transition = `r.business_id=?2 AND r.id=?3 AND r.status=?4 AND EXISTS (
    SELECT 1 FROM businesses b ${bookingPolicyJoins} WHERE b.id=r.business_id AND (${bookingEnabled})
  )`;
  const bindings = [next, businessId, id2, current];
  const [, updated] = await env.DB.batch([
    captureWebhook(env.DB, "bookings", "updated", transition, bindings, "?1"),
    env.DB.prepare(`UPDATE bookings AS r SET status=?1,updated_at=CURRENT_TIMESTAMP
      WHERE ${transition} RETURNING status`).bind(...bindings)
  ]);
  const changed = updated.results[0];
  if (changed) {
    scheduleBranchWebhooks(env, execution, businessId);
    return json2(changed);
  }
  const exists = await env.DB.prepare(
    "SELECT 1 FROM bookings WHERE business_id=? AND id=?"
  ).bind(businessId, id2).first();
  return exists ? error2(409, "Booking or settings changed. Reload the booking.") : error2(404, "Booking not found");
}
__name(adminBookings, "adminBookings");

// ../../shared/businessReset.ts
var branchResetOptions = {
  orders: "Orders",
  sales: "POS sales",
  workingDays: "Working days",
  cashierShifts: "Cashier shifts",
  bookings: "Bookings",
  tables: "Tables",
  tableGroups: "Table groups",
  telegramLogs: "Telegram delivery logs",
  analytics: "Menu analytics"
};
var businessResetOptions = {
  orders: "Orders across all branches",
  sales: "POS sales across all branches",
  workingDays: "Working days across all branches",
  cashierShifts: "Cashier shifts across all branches",
  products: "Products",
  menus: "Menus",
  categories: "Categories",
  banners: "Promotional banners",
  qrDesigns: "Saved QR designs",
  telegramLogs: "Telegram delivery logs across all branches"
};

// worker/businessReset.ts
var encoder3 = new TextEncoder();
var maxTableBytes = 15e5;
var maxBackupBytes = 8e6;
var maxTableRows = 25e3;
var backupDurationMs = 15 * 6e4;
var own = "business_id=?1";
var branchOnly = `${own} AND branch_id=?2`;
var sourceOrders = "SELECT id FROM orders";
var sourceBookings = "SELECT id FROM bookings";
var quote = /* @__PURE__ */ __name((name) => '"' + name.replaceAll('"', '""') + '"', "quote");
var fail = /* @__PURE__ */ __name((status, error3, code) => ({ ok: false, status, error: error3, code }), "fail");
var success2 = /* @__PURE__ */ __name((data) => ({ ok: true, data }), "success");
function targetsFor(scope, selections) {
  const selected = /* @__PURE__ */ __name((key) => selections.has(key), "selected");
  const targets = [];
  const add = /* @__PURE__ */ __name((name, where = own) => targets.push({ name, where }), "add");
  const resetScope = scope === "business" ? own : branchOnly;
  const workingDays = selected("workingDays");
  const cashierShifts = selected("cashierShifts") || workingDays;
  const dayIds = `SELECT id FROM working_days WHERE ${resetScope}`;
  const shiftsWhere = selected("cashierShifts") ? resetScope : `${resetScope} AND working_day_id IN (${dayIds})`;
  const shiftIds = `SELECT id FROM cashier_shifts WHERE ${shiftsWhere}`;
  const relatedSales = [];
  if (workingDays) relatedSales.push(`working_day_id IN (${dayIds})`);
  if (cashierShifts) relatedSales.push(`shift_id IN (${shiftIds})`);
  const salesWhere = selected("sales") ? resetScope : `${resetScope} AND (${relatedSales.join(" OR ")})`;
  const orders = selected("orders");
  const tables2 = selected("tables") || selected("tableGroups");
  const bookings = selected("bookings");
  const ordersWhere = orders ? resetScope : `${branchOnly} AND table_id IN (
    SELECT id FROM restaurant_tables WHERE ${branchOnly})`;
  const orderIds = `${sourceOrders} WHERE ${ordersWhere}`;
  const bookingIds = `${sourceBookings} WHERE ${branchOnly}`;
  const logOrders = selected("telegramLogs") ? `${sourceOrders} WHERE ${branchOnly}` : orderIds;
  const logs = selected("telegramLogs");
  const allLogs = logs && scope === "business";
  if (logs || orders || tables2 || bookings) {
    const sources = [];
    if (logs || orders || tables2) sources.push(`(source='Order' AND source_id IN (${logOrders}))`);
    if (logs || bookings) sources.push(`(source='Booking' AND source_id IN (${bookingIds}))`);
    add("telegram_notification_deliveries", allLogs ? own : `${own} AND (${sources.join(" OR ")})`);
  }
  if (logs || orders || tables2)
    add("telegram_order_deliveries", `${own} AND order_id IN (${allLogs ? `${sourceOrders} WHERE ${own}` : logOrders})`);
  if (logs || bookings)
    add("telegram_booking_deliveries", `booking_id IN (${allLogs ? `${sourceBookings} WHERE ${own}` : bookingIds})`);
  if (orders || tables2) {
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
    add("pos_commands", `${own} AND (${commands.map((condition) => `(${condition})`).join(" OR ")})`);
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
  if (tables2) add("restaurant_tables", branchOnly);
  if (selected("tableGroups")) add("table_groups", branchOnly);
  if (selected("analytics")) add("analytics_events", branchOnly);
  const products = selected("products") || selected("categories");
  const menus = selected("menus");
  if (products || menus) {
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
__name(targetsFor, "targetsFor");
function snapshotQuery(target, columns) {
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
__name(snapshotQuery, "snapshotQuery");
async function readSnapshot(db, targets, businessId, branchId) {
  const schemas = await db.batch(
    targets.map(({ name }) => db.prepare(`PRAGMA table_info(${name})`))
  );
  const tables2 = targets.map((target, index) => {
    const columns = schemas[index].results.map(({ name }) => name);
    return { ...target, columns, query: snapshotQuery(target, columns) };
  });
  const values = await db.batch(
    tables2.map(({ query }) => db.prepare(query).bind(...scopeBindings(query, businessId, branchId)))
  );
  const snapshots = [];
  let totalBytes = 0;
  for (const [index, table] of tables2.entries()) {
    const { count, content } = values[index].results[0];
    if (content === null) return null;
    totalBytes += encoder3.encode(content).length;
    if (totalBytes > maxBackupBytes) return null;
    snapshots.push({ ...table, content, count });
  }
  return snapshots;
}
__name(readSnapshot, "readSnapshot");
function scopeBindings(sql2, businessId, branchId) {
  return sql2.includes("?2") ? [businessId, branchId] : [businessId];
}
__name(scopeBindings, "scopeBindings");
async function snapshotSignature(secret, metadata, snapshots, signature) {
  const key = await crypto.subtle.importKey("raw", encoder3.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const content = encoder3.encode(JSON.stringify([
    "business-data-reset-v1",
    metadata,
    snapshots.map(({ name, columns, content: content2 }) => [name, columns, content2])
  ]));
  if (signature) {
    const bytes = Uint8Array.from(signature.match(/../g) ?? [], (part) => Number.parseInt(part, 16));
    return await crypto.subtle.verify("HMAC", key, bytes, content);
  }
  const signed = await crypto.subtle.sign("HMAC", key, content);
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(snapshotSignature, "snapshotSignature");
var menuOrderReference = /* @__PURE__ */ __name((resettingBusinessOrders) => `EXISTS (
  SELECT 1 FROM orders WHERE menu_id IN (SELECT id FROM menus WHERE ${own})
  ${resettingBusinessOrders ? "AND business_id<>?1" : ""}
)`, "menuOrderReference");
function tenantChecks(targets) {
  const checks = [];
  for (const { name, where } of targets) {
    if (name === "sales") checks.push(`NOT EXISTS (
      SELECT 1 FROM sales WHERE reverses_sale_id IN (SELECT id FROM sales WHERE ${where})
        AND id NOT IN (SELECT id FROM sales WHERE ${where})
    )`);
    const relations = name === "orders" ? [["telegram_order_deliveries", "order_id"]] : name === "products" ? [["product_images", "product_id"], ["product_prices", "product_id"]] : name === "categories" ? [["categories", "parent_id"]] : [];
    for (const [table, key] of relations) {
      checks.push(`NOT EXISTS (SELECT 1 FROM ${table} WHERE business_id<>?1
        AND ${key} IN (SELECT id FROM ${name} WHERE ${where}))`);
    }
  }
  return checks;
}
__name(tenantChecks, "tenantChecks");
async function resetBusinessData(env, actor, businessId, action, input) {
  const { branchId, scope, selection, confirmation, token } = input;
  const sendDeletedWebhooks = input.sendDeletedWebhooks === true;
  if (input.sendDeletedWebhooks !== void 0 && typeof input.sendDeletedWebhooks !== "boolean")
    return fail(400, "Invalid Deleted webhook selection.");
  if (typeof branchId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(branchId))
    return fail(400, "Select a valid branch");
  if (scope !== "branch" && scope !== "business") return fail(400, "Select a reset scope");
  const options = scope === "branch" ? branchResetOptions : businessResetOptions;
  if (!Array.isArray(selection) || !selection.length || selection.some((value) => typeof value !== "string" || !Object.hasOwn(options, value)) || new Set(selection).size !== selection.length)
    return fail(400, "Select valid data for this reset scope");
  if (typeof env.AUTH_PEPPER !== "string" || env.AUTH_PEPPER.length < 32)
    return fail(503, "Backup verification is unavailable");
  const db = env.DB;
  const branch2 = await db.prepare("SELECT id,name FROM branches WHERE business_id=? AND id=?").bind(businessId, branchId).first();
  if (!branch2) return fail(404, "Branch does not belong to this business");
  const deleting = action === "delete";
  if (deleting && confirmation !== branch2.name) return fail(400, "Type the exact branch name to confirm");
  if (deleting && input.backupSaved !== true) return fail(400, "Confirm that the CSV ZIP backup was saved");
  if (deleting && scope === "business" && input.confirmBusinessWide !== true)
    return fail(400, "Confirm that this reset applies across the whole business");
  const stale = /* @__PURE__ */ __name(() => fail(409, "The backup expired or the data changed. Prepare and download a new backup.", "RESET_BACKUP_STALE"), "stale");
  const proof = typeof token === "string" ? /^(\d{13})\.([a-f0-9]{64})$/.exec(token) : null;
  if (deleting && (!proof || Number(proof[1]) <= Date.now())) return stale();
  const selected = new Set(selection);
  const menus = selected.has("menus");
  const remainingMenuOrders = menuOrderReference(scope === "business" && selected.has("orders"));
  const targets = targetsFor(scope, selected);
  const sales = targets.find(({ name }) => name === "sales");
  const resettingOperations = selected.has("workingDays") || selected.has("cashierShifts");
  const commandReset = JSON.stringify({
    code: resettingOperations ? "POS_DATA_RESET" : "SALE_RESET",
    error: resettingOperations ? "This POS working day, shift or sale was cleared by an administrator." : "This POS sale was cleared by an administrator."
  });
  if (sendDeletedWebhooks && !targets.some(({ name }) => name === "orders" || name === "bookings"))
    return fail(400, "Select a reset that removes orders or bookings to send Deleted webhooks.");
  const ownership = tenantChecks(targets);
  const blockers = menus && await db.prepare(`SELECT ${remainingMenuOrders} AS inUse`).bind(businessId).first("inUse") ? ["Saved orders outside this reset still reference these menus."] : [];
  if (ownership.length) {
    const sql2 = `SELECT (${ownership.join(" AND ")}) AS valid`;
    if (!await db.prepare(sql2).bind(...scopeBindings(sql2, businessId, branchId)).first("valid"))
      blockers.push("A related record outside this reset references the selection. Include its data in the reset or reset it first.");
  }
  if (deleting && blockers.length) return fail(409, blockers[0]);
  const snapshots = await readSnapshot(db, targets, businessId, branchId);
  if (!snapshots) return fail(413, "This backup is too large. Select fewer data types and try again.");
  const counts = snapshots.map(({ name, count }) => ({ name, count }));
  if (sendDeletedWebhooks && counts.reduce((total, { name, count }) => total + (name === "orders" || name === "bookings" ? count : 0), 0) > 100) {
    const limit = "Deleted webhooks are limited to 100 orders and bookings combined. Turn off Deleted webhooks and prepare a fresh backup.";
    if (deleting) return fail(409, limit);
    blockers.push(limit);
  }
  const hasRows = counts.some(({ count }) => count > 0);
  const expiresAt = proof && deleting ? Number(proof[1]) : Date.now() + backupDurationMs;
  const metadata = [
    actor,
    businessId,
    branch2,
    scope,
    [...selection].sort(),
    expiresAt,
    ...sendDeletedWebhooks ? ["send-deleted-webhooks"] : []
  ];
  if (!deleting) {
    const backup = {
      branch: branch2,
      expiresAt,
      blockers,
      token: hasRows && !blockers.length ? `${expiresAt}.${await snapshotSignature(env.AUTH_PEPPER, metadata, snapshots)}` : null,
      tables: snapshots.map(({ name, columns, content }) => ({
        name,
        columns,
        rows: JSON.parse(content).map((row) => row.flat())
      }))
    };
    return success2(backup);
  }
  if (!hasRows || !await snapshotSignature(env.AUTH_PEPPER, metadata, snapshots, proof[2]) || Date.now() >= expiresAt)
    return stale();
  const auditId = `aud_${crypto.randomUUID().replaceAll("-", "")}`;
  const checks = snapshots.map(
    ({ query }, index) => `?${index + 7} = (SELECT content FROM (${query}))`
  );
  checks.push(...ownership);
  const guarded = "EXISTS (SELECT 1 FROM super_admin_audit_log WHERE id=?3)";
  const audit = db.prepare(`INSERT INTO super_admin_audit_log (id,actor_email,action,business_id,details_json)
    SELECT ?3,?4,'business.data_reset',?1,?5
    WHERE EXISTS (SELECT 1 FROM branches WHERE business_id=?1 AND id=?2 AND name=?6 COLLATE BINARY)
    ${menus ? `AND NOT ${remainingMenuOrders}` : ""}
    AND ${checks.join(" AND ")}`).bind(
    businessId,
    branchId,
    auditId,
    actor,
    JSON.stringify({
      branchId,
      branchName: branch2.name,
      scope,
      selection,
      tables: counts,
      ...sendDeletedWebhooks ? { sendDeletedWebhooks } : {}
    }),
    branch2.name,
    ...snapshots.map(({ content }) => content)
  );
  try {
    const [logged] = await db.batch([
      audit,
      ...sendDeletedWebhooks ? targets.flatMap(({ name, where }) => name === "orders" || name === "bookings" ? [captureWebhook(db, name, "deleted", `(${where}) AND ${guarded}`, [businessId, branchId, auditId])] : []) : [],
      ...sales ? [db.prepare(`UPDATE cashier_shifts SET activity_revision=activity_revision+1
        WHERE business_id=?1 AND closed_at IS NULL AND id IN (
          SELECT shift_id FROM sales WHERE ${sales.where}
        ) AND ${guarded}`).bind(businessId, branchId, auditId)] : [],
      ...snapshots.map(({ name, where }) => {
        const statement = name === "pos_commands" ? `UPDATE pos_commands SET response_status=410,response_json='${commandReset}'` : `DELETE FROM ${name}`;
        return db.prepare(`${statement} WHERE (${where}) AND ${guarded}`).bind(businessId, branchId, auditId);
      }),
      db.prepare(`UPDATE businesses SET menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP
        WHERE id=?1 AND ?2 IS NOT NULL AND ${guarded}`).bind(businessId, branchId, auditId)
    ]);
    return logged.meta.changes ? success2({ tables: counts }) : stale();
  } catch (error3) {
    if (String(error3).includes("FOREIGN KEY constraint failed"))
      return fail(409, "Other records still reference this selection. The reset was rolled back.");
    throw error3;
  }
}
__name(resetBusinessData, "resetBusinessData");

// worker/webhookAdmin.ts
var ruleColumns = `rule.id, rule.revision, rule.name, rule.enabled, rule.archived,
  config.table_key AS "table", config.event, config.url, config.host, config.method, config.filter_json AS filterJson,
  config.body_json AS bodyJson, config.body_format AS bodyFormat, config.include_contact AS includeBookingContact,
  config.header_names_json AS headerNamesJson, config.headers_ciphertext AS headersCiphertext`;
var ruleJoin = `FROM branch_webhooks rule JOIN branch_webhook_revisions config
  ON config.webhook_id=rule.id AND config.revision=rule.revision`;
var fail2 = /* @__PURE__ */ __name((status, error3) => ({ ok: false, status, error: error3 }), "fail");
var success3 = /* @__PURE__ */ __name((data) => ({ ok: true, data }), "success");
async function clearWebhookHistory(env, actor, businessId, branchId, webhookId) {
  const db = env.DB;
  if (webhookId !== null) {
    const rule = await db.prepare("SELECT 1 FROM branch_webhooks WHERE business_id=? AND branch_id=? AND id=?").bind(businessId, branchId, webhookId).first();
    if (!rule) return fail2(404, "Webhook rule not found.");
  } else {
    const exists = branchId === null ? await db.prepare("SELECT 1 FROM businesses WHERE id=?").bind(businessId).first() : await db.prepare("SELECT 1 FROM branches WHERE business_id=? AND id=?").bind(businessId, branchId).first();
    if (!exists) return fail2(404, branchId === null ? "Business not found." : "Branch not found.");
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
      VALUES (?,?,'branch.webhook.clear_history',?,?)`).bind("aud_" + crypto.randomUUID(), actor, businessId, JSON.stringify({ branchId, webhookId }))
  ]);
  return success3({ cleared: deleted.meta.changes + hidden.meta.changes });
}
__name(clearWebhookHistory, "clearWebhookHistory");
function publicRule(row) {
  const { id: id2, revision, name, table, event, url, method } = row;
  return {
    id: id2,
    revision,
    name,
    table,
    event,
    url,
    method,
    enabled: Boolean(row.enabled),
    archived: Boolean(row.archived),
    includeBookingContact: Boolean(row.includeBookingContact),
    filter: JSON.parse(row.filterJson),
    body: JSON.parse(row.bodyJson),
    bodyFormat: row.bodyFormat,
    headerNames: JSON.parse(row.headerNamesJson)
  };
}
__name(publicRule, "publicRule");
function filterConditions(input, table, event, contact) {
  if (!Array.isArray(input) || input.length > 12) throw new Error("The filter must be a JSON array of up to 12 conditions.");
  const fields2 = webhookFields(table, contact);
  return input.map((condition) => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition) || typeof condition.field !== "string" || !Object.hasOwn(fields2, condition.field) || fields2[condition.field] === "items" || !["eq", "neq", "in", "changed"].includes(condition.op) || Object.keys(condition).some((key) => !["field", "op", "value"].includes(key)))
      throw new Error("Each condition needs an allowed field and operator.");
    const { field, op, value } = condition;
    const valid = /* @__PURE__ */ __name((item) => item === null || (fields2[field] === "number" ? typeof item === "number" && Number.isFinite(item) : typeof item === "string" && item.length <= 400), "valid");
    if (op === "changed") {
      if (event !== "updated" || Object.hasOwn(condition, "value"))
        throw new Error("Changed is available only for Updated and takes no value.");
      return { field, op };
    }
    if (op === "in" ? !Array.isArray(value) || !value.length || value.length > 20 || !value.every(valid) : !valid(value))
      throw new Error("Filter values must match the field type. In requires 1\u201320 values.");
    return { field, op, value };
  });
}
__name(filterConditions, "filterConditions");
function parseHeaders(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Headers must be a JSON object with string values.");
  if (new TextEncoder().encode(JSON.stringify(input)).length > 32 * 1024)
    throw new Error("Headers must be at most 32 KB.");
  const headers = new Headers();
  const reserved2 = /* @__PURE__ */ new Set([
    "host",
    "content-length",
    "transfer-encoding",
    "connection",
    "upgrade",
    "te",
    "trailer",
    "keep-alive",
    "forwarded",
    "expect"
  ]);
  const seen = /* @__PURE__ */ new Set();
  for (const [key, value] of Object.entries(input)) {
    const name = key.toLowerCase();
    const accessHeader = name === "cf-access-client-id" || name === "cf-access-client-secret";
    if (reserved2.has(name) || !accessHeader && /^(?:cf-|x-emenu-|x-forwarded-|proxy-|sec-)/.test(name) || seen.has(name) || typeof value !== "string" || /[\x00-\x08\x0a-\x1f\x7f]/.test(value))
      throw new Error("Use unique, valid header names and string values. System headers are reserved.");
    try {
      headers.set(name, value);
    } catch {
      throw new Error("Use valid HTTP header names and values.");
    }
    seen.add(name);
  }
  return Object.fromEntries([...seen].map((name) => [name, headers.get(name)]));
}
__name(parseHeaders, "parseHeaders");
function validateRule(env, input) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100)
    throw new Error("Enter a rule name of up to 100 characters.");
  if (typeof input.table !== "string" || !Object.hasOwn(webhookTables, input.table))
    throw new Error("Select a supported table.");
  const table = input.table;
  const event = input.event;
  if (!webhookDefinition(table).events.includes(event)) throw new Error("Select a supported event.");
  const method = input.method ?? "POST";
  if (!webhookMethods.includes(method)) throw new Error("Select a supported HTTP method.");
  const contact = input.includeBookingContact === true;
  if (contact && table !== "bookings" || input.includeBookingContact !== void 0 && typeof input.includeBookingContact !== "boolean")
    throw new Error("Booking contact data is available only for booking rules.");
  if (input.enabled !== void 0 && typeof input.enabled !== "boolean") throw new Error("Invalid enabled value.");
  const destination = webhookDestination(env, input.url);
  const bodyless = method === "GET" || method === "HEAD";
  const bodyFormat = input.bodyFormat ?? (bodyless ? "none" : "json");
  if (!["json", "text", "none"].includes(bodyFormat) || bodyless && bodyFormat !== "none")
    throw new Error("Select a valid body format. GET and HEAD require no body.");
  const body = bodyFormat === "none" ? null : input.body;
  const filter = filterConditions(input.filter ?? [], table, event, contact);
  validateWebhookTemplate(body, table, event, contact, bodyFormat);
  return { name: input.name.trim(), table, event, method, contact, filter, body, bodyFormat, ...destination };
}
__name(validateRule, "validateRule");
async function manageBranchWebhooks(env, actor, businessId, branchId, action, id2, input) {
  const db = env.DB;
  if (!await db.prepare("SELECT 1 FROM branches WHERE business_id=? AND id=?").bind(businessId, branchId).first())
    return fail2(404, "Branch not found.");
  const audit = /* @__PURE__ */ __name((operation, recordId2, details = {}) => db.prepare(`
    INSERT INTO super_admin_audit_log (id,actor_email,action,business_id,details_json)
    SELECT ?,?,?,?,? WHERE changes()=1
  `).bind(
    "aud_" + crypto.randomUUID(),
    actor,
    "branch.webhook." + operation,
    businessId,
    JSON.stringify({ branchId, id: recordId2, ...details })
  ), "audit");
  if (action === "list") {
    const { results } = await db.prepare(`SELECT ${ruleColumns} ${ruleJoin}
      WHERE rule.business_id=? AND rule.branch_id=? ORDER BY rule.archived, rule.name, rule.id`).bind(businessId, branchId).all();
    return success3({ rules: results.map(publicRule) });
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
    `).bind(businessId, branchId).all();
    return success3({ deliveries: results });
  }
  if (action === "retry") {
    const scope = `FROM branch_webhook_deliveries d JOIN branch_webhook_events e ON e.sequence=d.event_sequence
      JOIN branch_webhooks rule ON rule.id=d.webhook_id WHERE d.id=? AND e.business_id=? AND e.branch_id=?`;
    const current2 = await db.prepare(`SELECT d.status, rule.enabled ${scope}`).bind(id2, businessId, branchId).first();
    if (!current2) return fail2(404, "Delivery not found.");
    if (current2.status !== "failed" || !current2.enabled) return fail2(409, "Only failed deliveries for enabled rules can be retried.");
    const [updated2] = await db.batch([
      db.prepare(`UPDATE branch_webhook_deliveries SET status='pending', retry_count=0, due_at=unixepoch()
        WHERE id IN (SELECT d.id ${scope} AND d.status='failed' AND rule.enabled=1 AND rule.archived=0
          AND e.created_at>unixepoch()-${webhookRetentionSeconds} AND NOT ${webhookBlocked})`).bind(id2, businessId, branchId),
      audit("retry", id2)
    ]);
    return updated2.meta.changes ? success3({ id: id2 }) : fail2(409, "This delivery is blocked, expired, or no longer failed.");
  }
  const current = action === "create" ? null : await db.prepare(`SELECT ${ruleColumns} ${ruleJoin}
    WHERE rule.business_id=? AND rule.branch_id=? AND rule.id=?`).bind(businessId, branchId, id2).first();
  if (action !== "create" && !current) return fail2(404, "Webhook rule not found.");
  if (current?.archived) return fail2(409, "This webhook rule is archived.");
  const stop = /* @__PURE__ */ __name((ruleId2, revision2) => db.prepare(`
    UPDATE branch_webhook_deliveries SET status='stopped', error='The rule was disabled or archived.'
    WHERE webhook_id=? AND status IN ('pending','failed') AND EXISTS (
      SELECT 1 FROM branch_webhooks rule WHERE rule.id=? AND rule.revision=? AND rule.enabled=0
    )
  `).bind(ruleId2, ruleId2, revision2), "stop");
  if (action === "archive" && current) {
    const [updated2] = await db.batch([
      db.prepare("UPDATE branch_webhooks SET enabled=0, archived=1 WHERE id=? AND business_id=? AND branch_id=? AND archived=0 AND revision=?").bind(current.id, businessId, branchId, current.revision),
      audit("archive", current.id),
      stop(current.id, current.revision)
    ]);
    return updated2.meta.changes ? success3({ id: current.id }) : fail2(409, "Reload the rule before archiving.");
  }
  if (current && input.revision !== current.revision) return fail2(409, "This rule changed. Reload before saving.");
  if (action === "toggle" && current) {
    if (typeof input.enabled !== "boolean") return fail2(400, "Invalid enabled value.");
    const enabled2 = Number(input.enabled);
    if (enabled2 === current.enabled) return success3({ id: current.id });
    if (enabled2) {
      try {
        webhookDestination(env, current.url);
      } catch (error3) {
        return fail2(400, error3.message);
      }
    }
    const [updated2] = await db.batch([
      db.prepare(`UPDATE branch_webhooks SET enabled=?
        WHERE id=? AND business_id=? AND branch_id=? AND revision=? AND archived=0 AND enabled=?`).bind(enabled2, current.id, businessId, branchId, current.revision, current.enabled),
      audit(enabled2 ? "enable" : "disable", current.id),
      ...!enabled2 ? [stop(current.id, current.revision)] : []
    ]);
    return updated2.meta.changes ? success3({ id: current.id }) : fail2(409, "Reload the rule before changing its status.");
  }
  let config;
  let headers;
  try {
    config = validateRule(env, input);
    if (input.headers !== void 0) headers = parseHeaders(input.headers);
    if (current && !headers && JSON.parse(current.headerNamesJson).length && new URL(current.url).origin !== new URL(config.url).origin)
      throw new Error("Replace or clear the saved headers when changing the destination origin.");
  } catch (error3) {
    return fail2(400, error3.message);
  }
  const ciphertext = headers || !current ? await encryptWebhookHeaders(env, businessId, branchId, headers ?? {}) : current.headersCiphertext;
  const names = headers || !current ? JSON.stringify(Object.keys(headers ?? {})) : current.headerNamesJson;
  const ruleId = current?.id ?? crypto.randomUUID();
  const revision = (current?.revision ?? 0) + 1;
  const enabled = Boolean(current?.enabled);
  const mutation = current ? db.prepare(`UPDATE branch_webhooks SET name=?, revision=?, enabled=?
        WHERE id=? AND business_id=? AND branch_id=? AND revision=? AND enabled=? AND archived=0`).bind(config.name, revision, Number(enabled), ruleId, businessId, branchId, current.revision, current.enabled) : db.prepare(`INSERT INTO branch_webhooks (id,business_id,branch_id,name)
        SELECT ?,?,?,? WHERE (SELECT count(*) FROM branch_webhooks WHERE business_id=? AND branch_id=? AND archived=0)<20`).bind(ruleId, businessId, branchId, config.name, businessId, branchId);
  const [updated] = await db.batch([
    mutation,
    db.prepare(`INSERT INTO branch_webhook_revisions
      (webhook_id,revision,name,table_key,event,url,host,method,filter_json,body_json,include_contact,header_names_json,headers_ciphertext,body_format)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`).bind(
      ruleId,
      revision,
      config.name,
      config.table,
      config.event,
      config.url,
      config.host,
      config.method,
      JSON.stringify(config.filter),
      JSON.stringify(config.body),
      Number(config.contact),
      names,
      ciphertext,
      config.bodyFormat
    ),
    audit(action, ruleId, { revision, enabled, table: config.table, event: config.event, host: config.host }),
    ...!enabled && current ? [stop(ruleId, revision)] : []
  ]);
  return updated.meta.changes ? success3({ id: ruleId }) : fail2(409, current ? "This rule changed. Reload before saving." : "This branch already has 20 webhook rules.");
}
__name(manageBranchWebhooks, "manageBranchWebhooks");

// worker/index.ts
var json3 = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers }
}), "json");
var slugify = /* @__PURE__ */ __name((value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), "slugify");
var recordSlug = /* @__PURE__ */ __name((value, fallback, recordId2) => `${slugify(value) || fallback}-${recordId2.slice(-8)}`, "recordSlug");
var catalogCacheKey = /* @__PURE__ */ __name((slug2, version, priceListId, bannerState, env) => {
  const mediaBase = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "") || "worker";
  return `catalog:v13:${mediaBase}:${slug2}:${version}:${priceListId}:${bannerState}`;
}, "catalogCacheKey");
var workerMediaUrl = /* @__PURE__ */ __name((env, mediaId) => `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`, "workerMediaUrl");
var mediaUrl = /* @__PURE__ */ __name((env, objectKey, fallback = "") => {
  const publicBase = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "");
  if (!publicBase || !objectKey) return fallback;
  const encodedKey = String(objectKey).split("/").map(encodeURIComponent).join("/");
  return `${publicBase}/${encodedKey}`;
}, "mediaUrl");
var id = /* @__PURE__ */ __name((prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`, "id");
var RECORD_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
var PRODUCT_OPTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
var visibleCategoryIds = `WITH RECURSIVE visible_category_ids(id) AS (
  SELECT id FROM categories
  WHERE business_id = ? AND is_active = 1 AND parent_id IS NULL
  UNION ALL
  SELECT child.id FROM categories child
  JOIN visible_category_ids parent ON child.parent_id = parent.id
  WHERE child.business_id = ? AND child.is_active = 1
)`;
var LOCAL_DATE_TIME_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d$/;
var bytesToHex = /* @__PURE__ */ __name((bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""), "bytesToHex");
var AUTH_SCHEME = "client-pbkdf2-sha256-v1";
var PASSWORD_PROOF_PATTERN = /^[a-f0-9]{64}$/;
var BUSINESS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var businessSlugOwner = /* @__PURE__ */ __name((db, slug2) => db.prepare(
  `SELECT id FROM businesses WHERE slug=?1
   UNION ALL SELECT business_id AS id FROM business_slug_aliases WHERE slug=?1`
).bind(slug2).first(), "businessSlugOwner");
var businessSlugConflict = /* @__PURE__ */ __name((error3) => /BUSINESS_SLUG_IN_USE|UNIQUE constraint failed: businesses\.slug/.test(String(error3)), "businessSlugConflict");
var LOCAL_DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
var ANALYTICS_EVENT_TYPES = /* @__PURE__ */ new Set([
  "menu_open",
  "product_view",
  "favourite_add",
  "favourite_remove",
  "category_select",
  "search",
  "banner_impression",
  "banner_open",
  "banner_cta_click",
  "contact_click",
  "language_change"
]);
var ANALYTICS_LANGUAGES = /* @__PURE__ */ new Set(["km", "en", "zh"]);
var ANALYTICS_ACTIONS = /* @__PURE__ */ new Set([
  "phone",
  "email",
  "website",
  "map",
  "social",
  "wifi"
]);
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function localDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${value.year}-${value.month}-${value.day}`;
}
__name(localDateKey, "localDateKey");
function endOfLocalDateUtc(value, timeZone, dayOffset = 1) {
  if (!LOCAL_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(parsed);
  } catch {
    return null;
  }
  const target = Date.UTC(year, month - 1, day + dayOffset);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value])
    );
    const rendered = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    guess += target - rendered;
  }
  return new Date(guess).toISOString();
}
__name(endOfLocalDateUtc, "endOfLocalDateUtc");
function subscriptionSummary(row, timeZone = "UTC", now = Date.now()) {
  const expiresAt = row.currentPeriodEndAt || null;
  const end = expiresAt ? Date.parse(expiresAt) : Number.POSITIVE_INFINITY;
  const lifecycleBlocked = ["past_due", "canceled"].includes(
    String(row.subscriptionStatus || "active")
  );
  const expired = lifecycleBlocked || Number.isNaN(end) || end <= now;
  const status = expired ? "expired" : !expiresAt ? "unlimited" : row.subscriptionStatus === "trialing" ? "trialing" : "active";
  let expiresOn = null;
  if (expiresAt && !Number.isNaN(end)) {
    try {
      expiresOn = localDateKey(new Date(end - 1), timeZone);
    } catch {
      expiresOn = expiresAt.slice(0, 10);
    }
  }
  return {
    planCode: row.subscriptionPlanCode || "standard",
    planName: row.subscriptionPlanName || "Standard",
    source: row.subscriptionSource || "manual",
    status,
    expiresAt,
    expiresOn,
    daysRemaining: expiresAt && !Number.isNaN(end) ? Math.max(0, Math.ceil((end - now) / 864e5)) : null,
    readOnly: expired
  };
}
__name(subscriptionSummary, "subscriptionSummary");
var QR_PRESETS = /* @__PURE__ */ new Set([
  "table-card",
  "table-tent",
  "acrylic-stand",
  "a4-poster"
]);
var QR_FONTS = /* @__PURE__ */ new Set([
  "Manrope",
  "DM Sans",
  "Noto Sans Khmer",
  "Noto Sans SC"
]);
var HEX_COLOR = /^#[0-9a-f]{6}$/i;
var blendHexColors = /* @__PURE__ */ __name((foreground, background, opacity = 0.5) => {
  const channel = /* @__PURE__ */ __name((hex2, offset) => Number.parseInt(hex2.slice(offset, offset + 2), 16), "channel");
  return `#${[1, 3, 5].map(
    (offset) => Math.round(
      channel(foreground, offset) * opacity + channel(background, offset) * (1 - opacity)
    ).toString(16).padStart(2, "0")
  ).join("")}`;
}, "blendHexColors");
var relativeLuminance = /* @__PURE__ */ __name((hex2) => {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex2.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}, "relativeLuminance");
var colorContrastRatio = /* @__PURE__ */ __name((first, second) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}, "colorContrastRatio");
var readableColor = /* @__PURE__ */ __name((background) => relativeLuminance(background) > 0.42 ? "#111111" : "#ffffff", "readableColor");
var MENU_THEME_PRESETS = /* @__PURE__ */ new Set(["warm", "minimal", "garden", "elegant"]);
var MENU_THEME_MODES = /* @__PURE__ */ new Set(["light", "dark"]);
var MENU_THEME_FONTS = /* @__PURE__ */ new Set([
  "Manrope",
  "DM Sans",
  "Noto Sans Khmer",
  "Noto Sans SC",
  "System UI"
]);
var MENU_THEME_KHMER_FONTS = new Set(menuKhmerFonts);
var MENU_CARD_STYLES = /* @__PURE__ */ new Set(["flat", "bordered", "shadow"]);
var MENU_CORNER_STYLES = /* @__PURE__ */ new Set(["square", "soft", "rounded"]);
var MENU_IMAGE_RATIOS = /* @__PURE__ */ new Set(["square", "landscape", "portrait"]);
var MENU_PRODUCT_VIEWS = /* @__PURE__ */ new Set(["grid", "list"]);
var MENU_BOTTOM_NAV_STYLES = /* @__PURE__ */ new Set([
  "simple",
  "modern",
  "floating",
  "glass"
]);
var MENU_HEADER_STYLES = /* @__PURE__ */ new Set(["banner", "solid", "minimal"]);
var MENU_CATEGORY_STYLES = /* @__PURE__ */ new Set(["pills", "underline", "images"]);
var MENU_BACKGROUND_TYPES = /* @__PURE__ */ new Set(["color", "pattern", "image"]);
var MENU_BACKGROUND_PATTERNS = /* @__PURE__ */ new Set([
  "dots",
  "waves",
  "grid",
  "khmer-diamond",
  "terrazzo",
  "paper",
  "khmer-new-year",
  "pchum-ben",
  "water-festival",
  "visak-bochea",
  "rice-harvest",
  "khmer-heritage"
]);
var MENU_BACKGROUND_FITS = /* @__PURE__ */ new Set(["cover", "tile"]);
var menuThemeImageFields = [
  {
    mediaId: "backgroundImageMediaId",
    url: "backgroundImageUrl",
    missingMessage: "Background image was not found"
  },
  {
    mediaId: "productPlaceholderMediaId",
    url: "productPlaceholderUrl",
    missingMessage: "Product photo placeholder was not found"
  }
];
var defaultMenuTheme = /* @__PURE__ */ __name((primaryColor = "#e84231") => ({
  version: 1,
  preset: "warm",
  mode: "light",
  primaryColor: HEX_COLOR.test(primaryColor) ? primaryColor.toLowerCase() : "#e84231",
  accentColor: "#b7e46c",
  backgroundColor: "#faf8f2",
  surfaceColor: "#ffffff",
  textColor: "#1b1b19",
  businessNameColor: "#1b1b19",
  businessNameFontSize: 24,
  menuItemTitleColor: "#1b1b19",
  menuItemTitleFontSize: 16,
  categoryTitleColor: "#1b1b19",
  categoryTitleFontSize: 30,
  categoryFilterColor: "#1b1b19",
  categoryFilterFontSize: 14,
  descriptionColor: "#8d8d8c",
  descriptionFontSize: 14,
  primaryPriceColor: HEX_COLOR.test(primaryColor) ? primaryColor.toLowerCase() : "#e84231",
  primaryPriceFontSize: 16,
  secondaryPriceColor: HEX_COLOR.test(primaryColor) ? primaryColor.toLowerCase() : "#e84231",
  secondaryPriceFontSize: 12,
  headingFont: "Manrope",
  bodyFont: "DM Sans",
  khmerFont: defaultMenuKhmerFont,
  cardStyle: "shadow",
  cornerStyle: "rounded",
  imageRatio: "landscape",
  productPlaceholderMediaId: "",
  productPlaceholderUrl: "",
  defaultProductView: "grid",
  showItemCode: false,
  itemCodeColor: "#8d8d8c",
  itemCodeFontSize: 10,
  showBottomNav: true,
  showSearchNav: true,
  bottomNavStyle: "modern",
  bottomNavBackgroundColor: "#ffffff",
  bottomNavTextColor: "#666660",
  bottomNavActiveColor: HEX_COLOR.test(primaryColor) ? primaryColor.toLowerCase() : "#e84231",
  bottomNavFontSize: 13,
  headerStyle: "banner",
  categoryStyle: "images",
  backgroundType: "color",
  backgroundPattern: "paper",
  backgroundPatternColor: HEX_COLOR.test(primaryColor) ? primaryColor.toLowerCase() : "#e84231",
  backgroundPatternOpacity: 8,
  backgroundImageMediaId: "",
  backgroundImageUrl: "",
  backgroundImageFit: "cover",
  backgroundImagePositionX: 50,
  backgroundImagePositionY: 50,
  backgroundOverlayColor: "#1b1b19",
  backgroundOverlayOpacity: 20
}), "defaultMenuTheme");
function menuTheme(value, legacyPrimary = "#e84231") {
  const input = value && typeof value === "object" ? value : {};
  const base = defaultMenuTheme(legacyPrimary);
  const choice2 = /* @__PURE__ */ __name((key, allowed, fallback) => {
    const candidate = String(input[key] ?? "");
    return allowed.has(candidate) ? candidate : fallback;
  }, "choice");
  const color = /* @__PURE__ */ __name((key, fallback) => {
    const candidate = String(input[key] ?? "");
    return HEX_COLOR.test(candidate) ? candidate.toLowerCase() : fallback;
  }, "color");
  const number2 = /* @__PURE__ */ __name((key, fallback, min, max) => {
    const candidate = Number(input[key]);
    return Number.isFinite(candidate) && candidate >= min && candidate <= max ? Math.round(candidate) : fallback;
  }, "number");
  const clampedNumber = /* @__PURE__ */ __name((key, fallback, min, max) => {
    const candidate = Number(input[key]);
    return Number.isFinite(candidate) ? Math.min(max, Math.max(min, Math.round(candidate))) : fallback;
  }, "clampedNumber");
  const mediaId = String(input.backgroundImageMediaId ?? "").trim();
  const placeholderId = String(input.productPlaceholderMediaId ?? "").trim();
  const storedImageUrl = String(input.backgroundImageUrl ?? "").trim().slice(0, 1e3);
  const resolvedTextColor = color("textColor", base.textColor);
  const resolvedSurfaceColor = color("surfaceColor", base.surfaceColor);
  const resolvedDescriptionColor = color(
    "descriptionColor",
    blendHexColors(resolvedTextColor, resolvedSurfaceColor)
  );
  const resolvedPrimaryColor = color("primaryColor", base.primaryColor);
  const resolvedAccentColor = color("accentColor", base.accentColor);
  const legacyBottomNavTextColor = blendHexColors(
    readableColor(resolvedSurfaceColor),
    resolvedSurfaceColor,
    0.58
  );
  const legacyBottomNavActiveColor = [resolvedPrimaryColor, resolvedAccentColor, resolvedTextColor].find(
    (candidate) => colorContrastRatio(candidate, resolvedSurfaceColor) >= 3
  ) || readableColor(resolvedSurfaceColor);
  return {
    version: 1,
    preset: choice2("preset", MENU_THEME_PRESETS, base.preset),
    mode: choice2("mode", MENU_THEME_MODES, base.mode),
    primaryColor: resolvedPrimaryColor,
    accentColor: resolvedAccentColor,
    backgroundColor: color("backgroundColor", base.backgroundColor),
    surfaceColor: resolvedSurfaceColor,
    textColor: resolvedTextColor,
    businessNameColor: color("businessNameColor", resolvedTextColor),
    businessNameFontSize: clampedNumber(
      "businessNameFontSize",
      base.businessNameFontSize,
      18,
      36
    ),
    menuItemTitleColor: color("menuItemTitleColor", resolvedTextColor),
    menuItemTitleFontSize: clampedNumber(
      "menuItemTitleFontSize",
      base.menuItemTitleFontSize,
      12,
      24
    ),
    categoryTitleColor: color("categoryTitleColor", resolvedTextColor),
    categoryTitleFontSize: clampedNumber(
      "categoryTitleFontSize",
      base.categoryTitleFontSize,
      20,
      40
    ),
    categoryFilterColor: color("categoryFilterColor", resolvedTextColor),
    categoryFilterFontSize: clampedNumber(
      "categoryFilterFontSize",
      base.categoryFilterFontSize,
      10,
      20
    ),
    descriptionColor: resolvedDescriptionColor,
    descriptionFontSize: clampedNumber(
      "descriptionFontSize",
      base.descriptionFontSize,
      11,
      20
    ),
    primaryPriceColor: color(
      "primaryPriceColor",
      color("primaryColor", base.primaryColor)
    ),
    primaryPriceFontSize: number2(
      "primaryPriceFontSize",
      base.primaryPriceFontSize,
      10,
      32
    ),
    secondaryPriceColor: color(
      "secondaryPriceColor",
      color("primaryColor", base.primaryColor)
    ),
    secondaryPriceFontSize: number2(
      "secondaryPriceFontSize",
      base.secondaryPriceFontSize,
      8,
      24
    ),
    headingFont: choice2("headingFont", MENU_THEME_FONTS, base.headingFont),
    bodyFont: choice2("bodyFont", MENU_THEME_FONTS, base.bodyFont),
    khmerFont: choice2("khmerFont", MENU_THEME_KHMER_FONTS, base.khmerFont),
    cardStyle: choice2("cardStyle", MENU_CARD_STYLES, base.cardStyle),
    cornerStyle: choice2("cornerStyle", MENU_CORNER_STYLES, base.cornerStyle),
    imageRatio: choice2("imageRatio", MENU_IMAGE_RATIOS, base.imageRatio),
    defaultProductView: choice2(
      "defaultProductView",
      MENU_PRODUCT_VIEWS,
      base.defaultProductView
    ),
    showItemCode: typeof input.showItemCode === "boolean" ? input.showItemCode : base.showItemCode,
    itemCodeColor: color("itemCodeColor", resolvedDescriptionColor),
    itemCodeFontSize: clampedNumber(
      "itemCodeFontSize",
      base.itemCodeFontSize,
      8,
      18
    ),
    showBottomNav: typeof input.showBottomNav === "boolean" ? input.showBottomNav : base.showBottomNav,
    showSearchNav: typeof input.showSearchNav === "boolean" ? input.showSearchNav : base.showSearchNav,
    bottomNavStyle: choice2(
      "bottomNavStyle",
      MENU_BOTTOM_NAV_STYLES,
      base.bottomNavStyle
    ),
    bottomNavBackgroundColor: color(
      "bottomNavBackgroundColor",
      resolvedSurfaceColor
    ),
    bottomNavTextColor: color("bottomNavTextColor", legacyBottomNavTextColor),
    bottomNavActiveColor: color(
      "bottomNavActiveColor",
      legacyBottomNavActiveColor
    ),
    bottomNavFontSize: clampedNumber(
      "bottomNavFontSize",
      base.bottomNavFontSize,
      10,
      18
    ),
    headerStyle: choice2("headerStyle", MENU_HEADER_STYLES, base.headerStyle),
    categoryStyle: choice2(
      "categoryStyle",
      MENU_CATEGORY_STYLES,
      base.categoryStyle
    ),
    backgroundType: choice2(
      "backgroundType",
      MENU_BACKGROUND_TYPES,
      base.backgroundType
    ),
    backgroundPattern: choice2(
      "backgroundPattern",
      MENU_BACKGROUND_PATTERNS,
      base.backgroundPattern
    ),
    backgroundPatternColor: color(
      "backgroundPatternColor",
      base.backgroundPatternColor
    ),
    backgroundPatternOpacity: number2(
      "backgroundPatternOpacity",
      base.backgroundPatternOpacity,
      0,
      40
    ),
    backgroundImageMediaId: RECORD_ID_PATTERN.test(mediaId) ? mediaId : "",
    backgroundImageUrl: storedImageUrl,
    productPlaceholderMediaId: RECORD_ID_PATTERN.test(placeholderId) ? placeholderId : "",
    productPlaceholderUrl: String(input.productPlaceholderUrl ?? "").trim().slice(0, 1e3),
    backgroundImageFit: choice2(
      "backgroundImageFit",
      MENU_BACKGROUND_FITS,
      base.backgroundImageFit
    ),
    backgroundImagePositionX: number2(
      "backgroundImagePositionX",
      base.backgroundImagePositionX,
      0,
      100
    ),
    backgroundImagePositionY: number2(
      "backgroundImagePositionY",
      base.backgroundImagePositionY,
      0,
      100
    ),
    backgroundOverlayColor: color(
      "backgroundOverlayColor",
      base.backgroundOverlayColor
    ),
    backgroundOverlayOpacity: number2(
      "backgroundOverlayOpacity",
      base.backgroundOverlayOpacity,
      0,
      90
    )
  };
}
__name(menuTheme, "menuTheme");
function parseMenuTheme(value, legacyPrimary, env) {
  try {
    const theme = menuTheme(
      JSON.parse(String(value || "{}")),
      String(legacyPrimary || "#e84231")
    );
    theme.productPlaceholderUrl = theme.productPlaceholderMediaId ? workerMediaUrl(env, theme.productPlaceholderMediaId) : "";
    return theme;
  } catch {
    return defaultMenuTheme(String(legacyPrimary || "#e84231"));
  }
}
__name(parseMenuTheme, "parseMenuTheme");
var defaultQrConfig = /* @__PURE__ */ __name(() => ({
  version: 1,
  branchSlug: "",
  menuSlug: "",
  showTableGroup: true,
  tablePrefix: "",
  businessNameMode: "profile",
  taglineMode: "profile",
  customBusinessName: "",
  customTagline: "",
  ctaText: "Scan to view our menu",
  showFooterText: true,
  footerText: defaultQrFooterText,
  showLogo: true,
  showBusinessName: true,
  backgroundType: "color",
  backgroundColor: "#10231d",
  backgroundImageUrl: "",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  overlayColor: "#10231d",
  overlayOpacity: 20,
  textColor: "#ffffff",
  accentColor: "#a6ef67",
  qrDarkColor: "#10231d",
  qrLightColor: "#ffffff",
  fontFamily: "Manrope",
  headingSize: 34,
  taglineSize: 16,
  ctaSize: 17,
  logoScale: 20,
  qrScale: 46,
  qrPositionY: 46,
  alignment: "center",
  customWidthMm: 100,
  customHeightMm: 150
}), "defaultQrConfig");
function qrConfig(value) {
  const input = value ?? {};
  const base = defaultQrConfig();
  const text2 = /* @__PURE__ */ __name((key, fallback, max) => String(input[key] ?? fallback).trim().slice(0, max), "text");
  const number2 = /* @__PURE__ */ __name((key, fallback, min, max) => {
    const parsed = Number(input[key] ?? fallback);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
  }, "number");
  const scopeSlug = /* @__PURE__ */ __name((key) => {
    const slug2 = text2(key, "", 80);
    return BUSINESS_SLUG_PATTERN.test(slug2) ? slug2 : "";
  }, "scopeSlug");
  const color = /* @__PURE__ */ __name((key, fallback) => {
    const parsed = String(input[key] ?? fallback);
    return HEX_COLOR.test(parsed) ? parsed.toLowerCase() : fallback;
  }, "color");
  const businessNameMode = input.businessNameMode === "custom" ? "custom" : "profile";
  const taglineMode = input.taglineMode === "custom" ? "custom" : "profile";
  const backgroundType = input.backgroundType === "image" ? "image" : "color";
  const alignment = ["left", "center", "right"].includes(
    String(input.alignment)
  ) ? String(input.alignment) : base.alignment;
  const fontFamily = QR_FONTS.has(String(input.fontFamily)) ? String(input.fontFamily) : base.fontFamily;
  return {
    version: 1,
    branchSlug: scopeSlug("branchSlug"),
    menuSlug: scopeSlug("menuSlug"),
    showTableGroup: input.showTableGroup !== false,
    tablePrefix: text2("tablePrefix", base.tablePrefix, maxQrTablePrefixLength),
    businessNameMode,
    taglineMode,
    customBusinessName: text2("customBusinessName", "", 100),
    customTagline: text2("customTagline", "", 180),
    ctaText: text2("ctaText", base.ctaText, 120),
    showFooterText: input.showFooterText !== false,
    footerText: text2("footerText", base.footerText, maxQrFooterTextLength),
    showLogo: input.showLogo !== false,
    showBusinessName: input.showBusinessName !== false,
    backgroundType,
    backgroundColor: color("backgroundColor", base.backgroundColor),
    backgroundImageUrl: text2("backgroundImageUrl", "", 1e3),
    backgroundPositionX: number2("backgroundPositionX", 50, 0, 100),
    backgroundPositionY: number2("backgroundPositionY", 50, 0, 100),
    overlayColor: color("overlayColor", base.overlayColor),
    overlayOpacity: number2("overlayOpacity", 20, 0, 90),
    textColor: color("textColor", base.textColor),
    accentColor: color("accentColor", base.accentColor),
    qrDarkColor: color("qrDarkColor", base.qrDarkColor),
    qrLightColor: color("qrLightColor", base.qrLightColor),
    fontFamily,
    headingSize: number2("headingSize", 34, 16, 72),
    taglineSize: number2("taglineSize", 16, 8, 36),
    ctaSize: number2("ctaSize", 17, 8, 36),
    logoScale: number2("logoScale", 20, 8, 38),
    qrScale: number2("qrScale", 46, 28, 62),
    qrPositionY: number2("qrPositionY", 46, 42, 60),
    alignment,
    customWidthMm: number2("customWidthMm", 100, 50, 420),
    customHeightMm: number2("customHeightMm", 150, 50, 420)
  };
}
__name(qrConfig, "qrConfig");
function hydrateQrDesign(row, env) {
  const {
    configJson,
    backgroundObjectKey: _backgroundObjectKey,
    ...design
  } = row;
  let config = defaultQrConfig();
  try {
    config = qrConfig(JSON.parse(String(configJson || "{}")));
  } catch {
  }
  if (design.backgroundMediaId) {
    config.backgroundImageUrl = `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${design.backgroundMediaId}`;
  }
  return { ...design, config };
}
__name(hydrateQrDesign, "hydrateQrDesign");
async function qrCategoryBrowsingEnabled(db, businessId) {
  const enabled = await db.prepare("SELECT allow_category_browsing FROM businesses WHERE id=?").bind(businessId).first("allow_category_browsing");
  return enabled === 1;
}
__name(qrCategoryBrowsingEnabled, "qrCategoryBrowsingEnabled");
async function hashToken(token) {
  return bytesToHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  );
}
__name(hashToken, "hashToken");
function authConfigured(env) {
  return typeof env.AUTH_PEPPER === "string" && env.AUTH_PEPPER.length >= 32;
}
__name(authConfigured, "authConfigured");
async function credentialHash(passwordProof, pepper, storedSalt) {
  const saltHex = storedSalt?.startsWith(`${AUTH_SCHEME}$`) ? storedSalt.slice(AUTH_SCHEME.length + 1) : bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  if (!/^[a-f0-9]{32}$/.test(saltHex)) throw new Error("Invalid auth salt");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const hash2 = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${AUTH_SCHEME}:${saltHex}:${passwordProof}`)
  );
  return {
    hash: bytesToHex(hash2),
    salt: `${AUTH_SCHEME}$${saltHex}`
  };
}
__name(credentialHash, "credentialHash");
function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
__name(safeEqual, "safeEqual");
async function verifyAccount(env, email, proof) {
  const account = await env.DB.prepare(
    "SELECT id,email,display_name AS displayName,password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE email=?"
  ).bind(email).first();
  if (!account) return { status: "invalid" };
  if (!account.passwordSalt.startsWith(`${AUTH_SCHEME}$`)) return { status: "reset_required" };
  const incoming = await credentialHash(proof, env.AUTH_PEPPER, account.passwordSalt);
  return safeEqual(incoming.hash, account.passwordHash) ? { status: "verified", account } : { status: "invalid" };
}
__name(verifyAccount, "verifyAccount");
function cors(request, env) {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/public/")) {
    return { "access-control-allow-origin": "*" };
  }
  const origin = request.headers.get("origin") ?? "";
  if (isPosApiPath(path)) {
    const allowed2 = (env.POS_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim());
    return origin && allowed2.includes(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : { vary: "Origin" };
  }
  const allowed = env.ALLOWED_ORIGINS.split(",").map((x) => x.trim());
  return allowed.includes(origin) ? {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    vary: "Origin"
  } : {};
}
__name(cors, "cors");
async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Expected JSON body");
  return request.json();
}
__name(readJson, "readJson");
function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
__name(jsonArray, "jsonArray");
function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
__name(validTimezone, "validTimezone");
function localDateTimeNow(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(/* @__PURE__ */ new Date());
  const part = /* @__PURE__ */ __name((type) => parts.find((item) => item.type === type)?.value || "", "part");
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
__name(localDateTimeNow, "localDateTimeNow");
function analyticsLocalNow(timeZone) {
  const value = localDateTimeNow(timeZone);
  return {
    localDate: value.slice(0, 10),
    localHour: Number(value.slice(11, 13))
  };
}
__name(analyticsLocalNow, "analyticsLocalNow");
function normalizeSearchTerm(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase().slice(0, 80);
}
__name(normalizeSearchTerm, "normalizeSearchTerm");
function parseLocalDate(value) {
  if (!LOCAL_DATE_PATTERN.test(value)) return null;
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}
__name(parseLocalDate, "parseLocalDate");
function shiftDate(value, days) {
  const parsed = parseLocalDate(value);
  if (!parsed) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
__name(shiftDate, "shiftDate");
function analyticsFilter(businessId, from, to, language, tableId, groupId, branchId, alias = "event") {
  return {
    sql: `${alias}.business_id=? AND ${alias}.local_date BETWEEN ? AND ?
      AND (?='' OR ${alias}.language=?)
      AND (?='' OR ${alias}.table_id=?)
      AND (?='' OR ${alias}.branch_id=?)
      AND (?='' OR ${alias}.table_id IN (
        SELECT id FROM restaurant_tables
        WHERE business_id=? AND group_id=?
      ))`,
    values: [
      businessId,
      from,
      to,
      language,
      language,
      tableId,
      tableId,
      branchId,
      branchId,
      groupId,
      businessId,
      groupId
    ]
  };
}
__name(analyticsFilter, "analyticsFilter");
function csvCell(value) {
  const text2 = value == null ? "" : String(value);
  return /[",\r\n]/.test(text2) ? `"${text2.replaceAll('"', '""')}"` : text2;
}
__name(csvCell, "csvCell");
function csvResponse(rows, filename) {
  const columns = rows.length ? Object.keys(rows[0]) : ["message"];
  const data = rows.length ? rows : [{ message: "No data for the selected period" }];
  const csv = [
    columns.map(csvCell).join(","),
    ...data.map(
      (row) => columns.map((column) => csvCell(row[column])).join(",")
    )
  ].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}
__name(csvResponse, "csvResponse");
async function analyticsReport(env, businessId, range) {
  const current = analyticsFilter(
    businessId,
    range.from,
    range.to,
    range.language,
    range.tableId,
    range.groupId,
    range.branchId,
    "event"
  );
  const previous = analyticsFilter(
    businessId,
    range.previousFrom,
    range.previousTo,
    range.language,
    range.tableId,
    range.groupId,
    range.branchId,
    "event"
  );
  const summarySql = /* @__PURE__ */ __name((filter) => `SELECT
    SUM(CASE WHEN event.event_type='menu_open' THEN 1 ELSE 0 END) AS menuOpens,
    COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
    COUNT(DISTINCT CASE WHEN event.event_type IN
      ('product_view','favourite_add','favourite_remove','category_select','search',
       'banner_open','banner_cta_click','contact_click','language_change')
      THEN event.session_id END) AS engagedSessions,
    SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews,
    SUM(CASE WHEN event.event_type='favourite_add' THEN 1 ELSE 0 END) AS favouriteAdds
    FROM analytics_events event WHERE ${filter}`, "summarySql");
  const [
    summaryResult,
    previousResult,
    dailyResult,
    hourlyResult,
    productResult,
    categoryResult,
    tableResult,
    searchResult,
    promotionResult,
    actionResult,
    languageResult,
    sourceResult
  ] = await Promise.all([
    env.DB.prepare(summarySql(current.sql)).bind(...current.values).first(),
    env.DB.prepare(summarySql(previous.sql)).bind(...previous.values).first(),
    env.DB.prepare(
      `SELECT event.local_date AS date,
        SUM(CASE WHEN event.event_type='menu_open' THEN 1 ELSE 0 END) AS menuOpens,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        COUNT(DISTINCT CASE WHEN event.event_type IN
          ('product_view','favourite_add','favourite_remove','category_select','search',
           'banner_open','banner_cta_click','contact_click','language_change')
          THEN event.session_id END) AS engagedSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.local_date ORDER BY event.local_date`
    ).bind(...current.values).all(),
    env.DB.prepare(
      `SELECT event.local_hour AS hour,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.local_hour ORDER BY event.local_hour`
    ).bind(...current.values).all(),
    env.DB.prepare(
      `SELECT product.id,COALESCE(product.name_km,product.name) AS name,
        COUNT(CASE WHEN event.event_type='product_view' THEN 1 END) AS views,
        COUNT(DISTINCT CASE WHEN event.event_type='product_view' THEN event.session_id END) AS viewingSessions,
        COUNT(CASE WHEN event.event_type='favourite_add' THEN 1 END) AS favouriteAdds,
        COUNT(CASE WHEN event.event_type='favourite_remove' THEN 1 END) AS favouriteRemoves
       FROM products product LEFT JOIN analytics_events event
        ON event.product_id=product.id AND ${current.sql}
       WHERE product.business_id=?
       GROUP BY product.id,product.name_km,product.name
       HAVING views>0 OR viewingSessions>0 OR favouriteAdds>0 OR favouriteRemoves>0
       ORDER BY views DESC,favouriteAdds DESC,name LIMIT 5000`
    ).bind(...current.values, businessId).all(),
    env.DB.prepare(
      `SELECT category.id,COALESCE(category.name_km,category.name) AS name,
        COUNT(CASE WHEN event.event_type='category_select' THEN 1 END) AS selections,
        COUNT(DISTINCT CASE WHEN event.event_type='category_select' THEN event.session_id END) AS sessions
       FROM categories category LEFT JOIN analytics_events event
        ON event.category_id=category.id AND ${current.sql}
       WHERE category.business_id=?
       GROUP BY category.id,category.name_km,category.name
       HAVING selections>0 OR sessions>0
       ORDER BY selections DESC,name`
    ).bind(...current.values, businessId).all(),
    env.DB.prepare(
      `SELECT tables.id,tables.group_id AS groupId,tables.branch_id AS branchId,tables.code,tables.label,groups.name AS groupName,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        COUNT(DISTINCT CASE WHEN event.event_type IN
          ('product_view','favourite_add','favourite_remove','category_select','search',
           'banner_open','banner_cta_click','contact_click','language_change')
          THEN event.session_id END) AS engagedSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM restaurant_tables tables
       JOIN table_groups groups ON groups.id=tables.group_id
        AND groups.business_id=tables.business_id
       LEFT JOIN analytics_events event ON event.table_id=tables.id AND ${current.sql}
       WHERE tables.business_id=?
       GROUP BY tables.id,tables.group_id,tables.branch_id,tables.code,tables.label,groups.name
       HAVING menuSessions>0 OR engagedSessions>0 OR productViews>0
       ORDER BY menuSessions DESC,groups.name,tables.sort_order`
    ).bind(...current.values, businessId).all(),
    env.DB.prepare(
      `SELECT event.search_term AS term,COUNT(*) AS searches,
        SUM(CASE WHEN event.search_result_count=0 THEN 1 ELSE 0 END) AS noResultSearches,
        MAX(event.search_result_count) AS maxResults
       FROM analytics_events event
       WHERE ${current.sql} AND event.event_type='search'
       GROUP BY event.search_term ORDER BY searches DESC,term LIMIT 100`
    ).bind(...current.values).all(),
    env.DB.prepare(
      `SELECT banner.id,banner.title,
        COUNT(CASE WHEN event.event_type='banner_impression' THEN 1 END) AS impressions,
        COUNT(CASE WHEN event.event_type='banner_open' THEN 1 END) AS opens,
        COUNT(CASE WHEN event.event_type='banner_cta_click' THEN 1 END) AS ctaClicks
       FROM banners banner LEFT JOIN analytics_events event
        ON event.banner_id=banner.id AND ${current.sql}
       WHERE banner.business_id=?
       GROUP BY banner.id,banner.title
       HAVING impressions>0 OR opens>0 OR ctaClicks>0
       ORDER BY impressions DESC,banner.title`
    ).bind(...current.values, businessId).all(),
    env.DB.prepare(
      `SELECT event.action_kind AS action,COUNT(*) AS actions,
        COUNT(DISTINCT event.session_id) AS sessions
       FROM analytics_events event
       WHERE ${current.sql} AND event.event_type='contact_click'
       GROUP BY event.action_kind ORDER BY actions DESC`
    ).bind(...current.values).all(),
    env.DB.prepare(
      `SELECT event.language,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.language ORDER BY menuSessions DESC`
    ).bind(...current.values).all(),
    env.DB.prepare(
      `SELECT event.source_type AS source,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.source_type ORDER BY menuSessions DESC`
    ).bind(...current.values).all()
  ]);
  const numbers = /* @__PURE__ */ __name((row) => {
    const value = row || {};
    const menuSessions = Number(value.menuSessions || 0);
    const engagedSessions = Number(value.engagedSessions || 0);
    return {
      menuOpens: Number(value.menuOpens || 0),
      menuSessions,
      engagedSessions,
      engagementRate: menuSessions ? engagedSessions / menuSessions : 0,
      productViews: Number(value.productViews || 0),
      averageProductViews: menuSessions ? Number(value.productViews || 0) / menuSessions : 0,
      favouriteAdds: Number(value.favouriteAdds || 0)
    };
  }, "numbers");
  return {
    range,
    summary: numbers(summaryResult || null),
    previous: numbers(
      previousResult || null
    ),
    daily: dailyResult.results,
    hourly: hourlyResult.results,
    products: productResult.results,
    categories: categoryResult.results,
    tables: tableResult.results,
    searches: searchResult.results,
    promotions: promotionResult.results,
    actions: actionResult.results,
    languages: languageResult.results,
    sources: sourceResult.results
  };
}
__name(analyticsReport, "analyticsReport");
function validLocalDateTime(value) {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) return false;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day && parsed.getUTCHours() === hour && parsed.getUTCMinutes() === minute;
}
__name(validLocalDateTime, "validLocalDateTime");
function validPriceAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 999999999 ? amount : null;
}
__name(validPriceAmount, "validPriceAmount");
function parsePriceEntries(value) {
  if (!Array.isArray(value) || value.length > 1e3) return null;
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of value) {
    const item = raw ?? {};
    const priceListId = String(item.priceListId ?? "");
    const portionId = item.portionId == null ? "" : String(item.portionId);
    const targetKey = portionId || "base";
    const priceCents = item.priceCents === "" || item.priceCents == null ? null : validPriceAmount(item.priceCents);
    if (!RECORD_ID_PATTERN.test(priceListId) || targetKey !== "base" && !PRODUCT_OPTION_ID_PATTERN.test(targetKey) || item.priceCents !== "" && item.priceCents != null && priceCents == null)
      return null;
    const key = `${priceListId}:${targetKey}`;
    if (seen.has(key)) return null;
    seen.add(key);
    entries.push({ priceListId, targetKey, priceCents });
  }
  return entries;
}
__name(parsePriceEntries, "parsePriceEntries");
async function normalPriceListId(env, businessId) {
  const row = await env.DB.prepare(
    "SELECT id FROM price_lists WHERE business_id=? AND is_normal=1"
  ).bind(businessId).first();
  return row?.id || "";
}
__name(normalPriceListId, "normalPriceListId");
async function resolvePriceList(env, businessId, pricingMode, defaultPriceListId, timezone) {
  const zone = validTimezone(String(timezone || "")) ? String(timezone) : "Asia/Phnom_Penh";
  const normalId = await normalPriceListId(env, businessId);
  let activeId = String(defaultPriceListId || normalId);
  const selected = activeId ? await env.DB.prepare(
    "SELECT id FROM price_lists WHERE id=? AND business_id=? AND is_archived=0"
  ).bind(activeId, businessId).first() : null;
  if (!selected) activeId = normalId;
  if (pricingMode === "automatic") {
    const now = localDateTimeNow(zone);
    const scheduled = await env.DB.prepare(
      `SELECT id FROM price_lists
       WHERE business_id=? AND is_archived=0 AND schedule_enabled=1
         AND schedule_start_local<=? AND schedule_end_local>?
       ORDER BY schedule_start_local DESC LIMIT 1`
    ).bind(businessId, now, now).first();
    if (scheduled?.id) activeId = scheduled.id;
  }
  return { activeId: activeId || normalId, normalId, timezone: zone };
}
__name(resolvePriceList, "resolvePriceList");
function priceMap(rows, priceListId) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (row.priceListId !== priceListId) continue;
    const amount = Number(row.priceCents);
    if (Number.isFinite(amount))
      map.set(`${row.productId}:${row.targetKey}`, amount);
  }
  return map;
}
__name(priceMap, "priceMap");
function applyResolvedPrices(product, normalPrices, activePrices, branchId) {
  const hydrated = hydrateProduct(product);
  const visiblePortions = hydrated.portions.filter(
    (portion) => portion.branchId == null || portion.branchId === branchId
  );
  if (hydrated.portions.length && !visiblePortions.length) return null;
  const productId = String(product.id);
  const baseKey = `${productId}:base`;
  hydrated.priceCents = activePrices.get(baseKey) ?? normalPrices.get(baseKey) ?? Number(product.priceCents || 0);
  hydrated.portions = visiblePortions.map((portion) => {
    const key = `${productId}:${String(portion.id)}`;
    return {
      ...portion,
      priceCents: activePrices.get(key) ?? normalPrices.get(key) ?? Number(portion.priceCents || 0)
    };
  });
  if (hydrated.portions.length) {
    const portionPrices = hydrated.portions.map(
      (portion) => Number(portion.priceCents || 0)
    );
    hydrated.priceCents = Math.min(...portionPrices);
    hydrated.maxPrice = Math.max(...portionPrices);
  } else {
    hydrated.maxPrice = hydrated.priceCents;
  }
  return hydrated;
}
__name(applyResolvedPrices, "applyResolvedPrices");
function safeHttpUrl(value) {
  const raw = String(value ?? "").trim().slice(0, 1e3);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
__name(safeHttpUrl, "safeHttpUrl");
function normalizeMenuHostname(value) {
  const hostname = String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.length > 253 || !hostname.includes("."))
    return null;
  const labels = hostname.split(".");
  if (labels.some(
    (label2) => !label2 || label2.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label2)
  ))
    return null;
  return hostname;
}
__name(normalizeMenuHostname, "normalizeMenuHostname");
function customMenuOrigin(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { url: "", hostname: "" };
  try {
    const parsed = new URL(raw);
    const hostname = normalizeMenuHostname(parsed.hostname);
    if (parsed.protocol !== "https:" || !hostname || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.port && parsed.port !== "443")
      return null;
    return { url: `https://${hostname}`, hostname };
  } catch {
    return null;
  }
}
__name(customMenuOrigin, "customMenuOrigin");
function bannerFields(body) {
  const title = String(body.title ?? "").trim().slice(0, 160);
  const subtitle = String(body.subtitle ?? "").trim().slice(0, 500);
  const detailText = String(body.detailText ?? "").trim().slice(0, 1e4);
  const ctaLabel = String(body.ctaLabel ?? "").trim().slice(0, 80);
  const imageUrl2 = safeHttpUrl(body.imageUrl);
  const ctaUrl = safeHttpUrl(body.ctaUrl);
  const startsAt = String(body.startsAt ?? "").trim();
  const endsAt = String(body.endsAt ?? "").trim();
  const hasSchedule = Boolean(startsAt || endsAt);
  if (!title) return { error: "Banner headline is required" };
  if (!imageUrl2)
    return { error: "Choose a valid HTTP or HTTPS banner image URL" };
  if (ctaUrl === null)
    return { error: "Banner link must be a valid HTTP or HTTPS URL" };
  if (ctaUrl && !detailText)
    return { error: "Add banner details before adding a link" };
  if (hasSchedule && (!validLocalDateTime(startsAt) || !validLocalDateTime(endsAt) || startsAt >= endsAt))
    return {
      error: "Schedule end must be after a valid schedule start"
    };
  return {
    title,
    subtitle,
    imageUrl: imageUrl2,
    detailText,
    ctaLabel,
    ctaUrl,
    isActive: body.isActive === false || body.isActive === 0 ? 0 : 1,
    startsAt: hasSchedule ? startsAt : null,
    endsAt: hasSchedule ? endsAt : null
  };
}
__name(bannerFields, "bannerFields");
function businessShopInformation(body, current = {}) {
  const rawContacts = Array.isArray(body.contactNumbers) ? body.contactNumbers : [];
  const contactNumbers = rawContacts.slice(0, 10).map((value) => {
    const item = value ?? {};
    return {
      label: String(item.label ?? "Main").trim().slice(0, 30) || "Main",
      number: String(item.number ?? "").trim().slice(0, 40)
    };
  }).filter((item) => item.number);
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const rawHours = Array.isArray(body.businessHours) ? body.businessHours : [];
  const businessHours = rawHours.slice(0, 7).map((value) => {
    const item = value ?? {};
    return {
      day: Number(item.day),
      enabled: Boolean(item.enabled),
      open: String(item.open ?? "08:00"),
      close: String(item.close ?? "22:00")
    };
  }).filter(
    (item) => Number.isInteger(item.day) && item.day >= 0 && item.day <= 6 && timePattern.test(item.open) && timePattern.test(item.close)
  );
  if (new Set(businessHours.map((item) => item.day)).size !== businessHours.length)
    return { error: "Business hours contain duplicate days" };
  const allowedPlatforms = /* @__PURE__ */ new Set([
    "Facebook",
    "Instagram",
    "TikTok",
    "Telegram",
    "YouTube",
    "X",
    "Other"
  ]);
  const rawSocials = Array.isArray(body.socialLinks) ? body.socialLinks : [];
  const socialLinks = [];
  for (const value of rawSocials.slice(0, 10)) {
    const item = value ?? {};
    const platform = allowedPlatforms.has(String(item.platform)) ? String(item.platform) : "Other";
    const url = safeHttpUrl(item.url);
    if (url === null) return { error: "Social links must use http or https" };
    if (url) socialLinks.push({ platform, url });
  }
  const websiteUrl = safeHttpUrl(body.websiteUrl);
  if (websiteUrl === null)
    return { error: "Website must be a valid http or https URL" };
  const locationsWereSubmitted = Array.isArray(body.locations);
  const existingLocations = jsonArray(current.locationsJson);
  const rawLocations = locationsWereSubmitted ? body.locations : existingLocations;
  const locations = [];
  for (const [index, value] of rawLocations.slice(0, 20).entries()) {
    const item = value ?? {};
    const address = String(item.address ?? "").trim().slice(0, 240);
    const locationMapUrl = safeHttpUrl(item.mapUrl);
    if (locationMapUrl === null)
      return {
        error: `Map location ${index + 1} must be a valid http or https URL`
      };
    if (!address && !locationMapUrl) continue;
    locations.push({
      label: String(item.label ?? "").trim().slice(0, 80) || `Branch ${index + 1}`,
      address,
      mapUrl: locationMapUrl,
      showInMenu: item.showInMenu == null ? true : Boolean(item.showInMenu)
    });
  }
  const legacyMapUrl = safeHttpUrl(body.mapUrl ?? current.mapUrl);
  if (legacyMapUrl === null)
    return { error: "Map location must be a valid http or https URL" };
  const legacyAddress = String(body.address ?? current.address ?? "").trim().slice(0, 240);
  const legacyMapLabel = String(body.mapLabel ?? current.mapLabel ?? "").trim().slice(0, 80);
  if (!locationsWereSubmitted && !locations.length && (legacyMapUrl || legacyAddress)) {
    locations.push({
      label: legacyMapLabel || "Main branch",
      address: legacyAddress,
      mapUrl: legacyMapUrl,
      showInMenu: true
    });
  }
  const mapUrl = locations[0]?.mapUrl || (locationsWereSubmitted ? "" : legacyMapUrl);
  const email = String(body.email ?? "").trim().slice(0, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email address is invalid" };
  const mapLabel = locations[0]?.label || (locationsWereSubmitted ? "" : legacyMapLabel);
  const wifiSsid = String(body.wifiSsid ?? current.wifiSsid ?? "").trim().slice(0, 64);
  const wifiPassword = String(
    body.wifiPassword ?? current.wifiPassword ?? ""
  ).slice(0, 128);
  const wifiSecurity = (body.wifiSecurity ?? current.wifiSecurity) === "open" ? "open" : "wpa";
  const setting = /* @__PURE__ */ __name((key, fallback) => body[key] == null ? current[key] == null ? fallback : Boolean(current[key]) : Boolean(body[key]), "setting");
  const showHeaderLocation = setting("showHeaderLocation", true);
  const showHeaderPhones = setting("showHeaderPhones", false);
  const showHeaderWifi = setting("showHeaderWifi", false);
  const showHeaderSocials = setting("showHeaderSocials", false);
  const showHeaderTagline = setting("showHeaderTagline", true);
  const showBusinessHours = setting("showBusinessHours", true);
  if (showHeaderWifi && !wifiSsid)
    return { error: "Enter the Wi-Fi network name before showing Wi-Fi" };
  if (showHeaderWifi && wifiSecurity === "wpa" && !wifiPassword)
    return { error: "Enter the Wi-Fi password before showing Wi-Fi" };
  return {
    contactNumbers,
    businessHours,
    socialLinks,
    email,
    websiteUrl,
    locations,
    mapUrl,
    mapLabel,
    wifiSsid,
    wifiPassword,
    wifiSecurity,
    showHeaderLocation,
    showHeaderPhones,
    showHeaderWifi,
    showHeaderSocials,
    showHeaderTagline,
    showBusinessHours
  };
}
__name(businessShopInformation, "businessShopInformation");
function hydrateProduct(product) {
  const { portionsJson, modifierGroupsJson, ...rest } = product;
  return {
    ...rest,
    portions: jsonArray(portionsJson),
    modifierGroups: jsonArray(modifierGroupsJson)
  };
}
__name(hydrateProduct, "hydrateProduct");
function parseSortItems(value) {
  if (!Array.isArray(value) || value.length > 500) return null;
  const items = value.map((entry) => {
    const item = entry ?? {};
    return {
      id: String(item.id ?? ""),
      sortOrder: Number(item.sortOrder)
    };
  });
  if (items.some(
    (item) => !/^[a-zA-Z0-9_-]+$/.test(item.id) || !Number.isInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 999999
  ) || new Set(items.map((item) => item.id)).size !== items.length)
    return null;
  return items;
}
__name(parseSortItems, "parseSortItems");
function parseSortOrder(value) {
  const order = Number(value ?? 0);
  return Number.isInteger(order) && order >= 0 && order <= 999999 ? order : null;
}
__name(parseSortOrder, "parseSortOrder");
async function productOptions(body, db, businessId) {
  const posFields = ["allowDiscount", "allowChangePrice", "isOpenProduct", "allowFree"];
  for (const field of posFields) {
    const value = body[field];
    if (value !== void 0 && typeof value !== "boolean" && value !== 0 && value !== 1)
      return { error: `${field} must be a boolean` };
  }
  const posOptions = Object.fromEntries(posFields.map(
    (field) => [field, body[field] === void 0 ? null : Number(body[field])]
  ));
  const unit = String(body.unit ?? "").trim().slice(0, 40);
  const rawPortions = Array.isArray(body.portions) ? body.portions : [];
  const rawGroups = Array.isArray(body.modifierGroups) ? body.modifierGroups : [];
  if (rawPortions.length > 20)
    return { error: "A product can have up to 20 portions" };
  if (rawGroups.length > 12)
    return { error: "A product can have up to 12 modifier groups" };
  const label2 = /* @__PURE__ */ __name((item, key) => String(item[key] ?? "").trim().slice(0, 120), "label");
  const validLabels = /* @__PURE__ */ __name((item) => Boolean(label2(item, "labelKm")), "validLabels");
  const price = /* @__PURE__ */ __name((value, { optional = false, minimum = 0 } = {}) => {
    if (optional && (value === "" || value == null)) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= minimum ? amount : NaN;
  }, "price");
  const portions2 = rawPortions.map((value) => {
    const item = value ?? {};
    return {
      id: String(item.id || id("portion")).slice(0, 80),
      labelKm: label2(item, "labelKm"),
      labelEn: label2(item, "labelEn"),
      labelZh: label2(item, "labelZh"),
      priceCents: price(item.priceCents),
      ...item.branchId === void 0 ? {} : { branchId: item.branchId },
      priceRule: label2(item, "priceRule"),
      unit: String(item.unit ?? "").trim().slice(0, 40)
    };
  });
  if (portions2.some(
    (portion) => !PRODUCT_OPTION_ID_PATTERN.test(portion.id) || portion.id === "base" || !validLabels(portion) || !Number.isFinite(portion.priceCents)
  ) || new Set(portions2.map((portion) => portion.id)).size !== portions2.length)
    return {
      error: "Every portion needs a unique ID, Khmer label and valid price"
    };
  if (portions2.some(({ branchId }) => branchId != null && (typeof branchId !== "string" || !PRODUCT_OPTION_ID_PATTERN.test(branchId))))
    return { error: "Every portion branch must be a valid branch ID or null" };
  const modifierGroups2 = rawGroups.map((value) => {
    const group = value ?? {};
    const rawOptions = Array.isArray(group.options) ? group.options : [];
    return {
      id: String(group.id || id("group")).slice(0, 80),
      labelKm: label2(group, "labelKm"),
      labelEn: label2(group, "labelEn"),
      labelZh: label2(group, "labelZh"),
      required: Boolean(group.required),
      multiple: Boolean(group.multiple),
      options: rawOptions.map((optionValue) => {
        const option = optionValue ?? {};
        return {
          id: String(option.id || id("option")).slice(0, 80),
          labelKm: label2(option, "labelKm"),
          labelEn: label2(option, "labelEn"),
          labelZh: label2(option, "labelZh"),
          priceCents: price(option.priceCents, {
            optional: true,
            minimum: -Infinity
          }),
          prefix: String(option.prefix ?? "").trim().slice(0, 40)
        };
      })
    };
  });
  if (modifierGroups2.some(
    (group) => !validLabels(group) || !group.options.length || group.options.length > 30 || group.options.some(
      (option) => !validLabels(option) || option.priceCents != null && !Number.isFinite(option.priceCents)
    )
  ))
    return {
      error: "Every modifier group and option needs a Khmer label"
    };
  const portionsJson = JSON.stringify(portions2);
  const modifierGroupsJson = JSON.stringify(modifierGroups2);
  if (portionsJson.length + modifierGroupsJson.length > 64e3)
    return { error: "Product options are too large" };
  if (!await ownsPortionBranches(db, businessId, portions2))
    return { error: "Choose portion branches that belong to this business" };
  return { unit, portions: portions2, modifierGroups: modifierGroups2, posOptions };
}
__name(productOptions, "productOptions");
function productPriceRange(portions2, fallbackPrice) {
  if (!portions2.length)
    return { minPrice: fallbackPrice, maxPrice: fallbackPrice };
  const prices = portions2.map((portion) => Number(portion.priceCents));
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices)
  };
}
__name(productPriceRange, "productPriceRange");
async function sessionFrom(request, env) {
  const token = sessionTokenFrom(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  return env.DB.prepare(
    `
    SELECT s.user_id AS userId, m.business_id AS businessId, m.role AS role,
      s.session_type AS sessionType, s.actor_email AS actorEmail,
      s.expires_at AS expiresAt, b.timezone,
      b.disabled_control_pages_json AS disabledControlPagesJson, m.can_view_bookings AS canViewBookings,
      sp.features_json AS subscriptionFeaturesJson,
      COALESCE(sp.pos_enabled,1) AS posEnabled,
      sp.code AS subscriptionPlanCode, sp.name AS subscriptionPlanName,
      bs.source AS subscriptionSource, bs.status AS subscriptionStatus,
      bs.trial_ends_at AS trialEndsAt,
      bs.current_period_end_at AS currentPeriodEndAt
    FROM sessions s
    JOIN memberships m ON m.user_id = s.user_id
      AND (s.business_id IS NULL OR m.business_id = s.business_id)
    JOIN businesses b ON b.id = m.business_id
    LEFT JOIN business_subscriptions bs ON bs.business_id = b.id
    LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
      AND (b.is_active = 1 OR s.session_type = 'support')
    ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
    LIMIT 1
  `
  ).bind(tokenHash).first();
}
__name(sessionFrom, "sessionFrom");
function controlPagesForResource(path, method) {
  const resource = path.split("/")[3];
  const readOnly = method === "GET" || method === "HEAD";
  switch (resource) {
    case "overview":
      return ["overview"];
    case "business":
      return ["business"];
    case "menu-theme":
      return ["appearance"];
    case "catalog":
      return readOnly ? catalogReaderPages : ["catalog"];
    case "categories":
    case "products":
      return ["catalog"];
    case "branches":
      return ["catalog", "tables", "qrDesigns", "orders", "reports"];
    case "menus":
      return readOnly && path === "/api/admin/menus" ? ["menus", "catalog", "qrDesigns", "tables"] : ["menus"];
    case "price-lists":
      return readOnly ? priceListReaderPages : ["priceLists"];
    case "product-prices":
      return ["managePrices"];
    case "orders":
      return ["orders"];
    case "reports":
      return ["reports"];
    case "pos":
      if (path === `${posAdminPath}/overview`) return ["sellingOverview"];
      if (path === `${posAdminPath}/sales` || path === `${posAdminPath}/shift-audit`) return ["salesList"];
      if (path === `${posAdminPath}/payment-types` || path.startsWith(`${posAdminPath}/payment-types/`))
        return ["posPaymentTypes"];
      if (/^\/api\/admin\/pos\/(customers|customer-groups)(?:\/|$)/.test(path))
        return ["posCustomers"];
      return ["posProfiles"];
    case "tables":
    case "table-groups":
      return readOnly ? ["tables", "qrDesigns"] : ["tables"];
    case "banners":
      return ["banners"];
    case "readiness":
    case "qr-designs":
      return ["qrDesigns"];
    case "media":
      return ["business", "appearance", "catalog", "banners", "qrDesigns", "menus"];
  }
}
__name(controlPagesForResource, "controlPagesForResource");
function sessionTokenFrom(request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)mf_session=([^;]+)/)?.[1];
  return bearer ?? cookie ?? "";
}
__name(sessionTokenFrom, "sessionTokenFrom");
async function createSession(userId, env) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
    "-",
    ""
  );
  const expires = new Date(Date.now() + 30 * 864e5).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(id("ses"), userId, await hashToken(token), expires).run();
  return { token, expires };
}
__name(createSession, "createSession");
async function registrationPlan(db, input, publicSignup) {
  const { planId, priceId } = input;
  if (planId === void 0 && priceId === void 0)
    return selectedPlan(db, DEFAULT_PLAN_ID, publicSignup);
  if (typeof planId !== "string" || typeof priceId !== "string") return null;
  const plan = await selectedPlan(db, planId, publicSignup);
  return plan?.priceId === priceId ? plan : null;
}
__name(registrationPlan, "registrationPlan");
function planChangedDuringSignup(error3) {
  return String(error3).includes("NOT NULL constraint failed: business_subscriptions.plan_id");
}
__name(planChangedDuringSignup, "planChangedDuringSignup");
async function provisionBusiness(env, input) {
  const userId = id("usr");
  const businessId = id("biz");
  const priceListId = id("prl");
  const groupId = id("grp");
  const designId = id("qrd");
  const subscriptionId = id("sub");
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const trialEndsAt = input.plan.amountMinor > 0 ? new Date(Date.parse(createdAt) + 30 * 864e5).toISOString() : null;
  const passwordData = await credentialHash(
    input.passwordProof,
    env.AUTH_PEPPER
  );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      userId,
      input.email,
      input.displayName || input.businessName,
      passwordData.hash,
      passwordData.salt
    ),
    env.DB.prepare(
      `INSERT INTO businesses
       (id, name, slug, tagline, locale, currency, timezone, pricing_mode,
        default_price_list_id, disabled_control_pages_json)
       VALUES (?, ?, ?, ?, 'km', 'KHR', 'Asia/Phnom_Penh', 'automatic', ?, ?)`
    ).bind(
      businessId,
      input.businessName,
      input.businessSlug,
      "Freshly made, beautifully served.",
      priceListId,
      JSON.stringify(["sellingOverview", "posProfiles", "posPaymentTypes"])
    ),
    env.DB.prepare(
      `INSERT INTO price_lists (id,business_id,name,is_normal)
       VALUES (?,?,'Normal Rate',1)`
    ).bind(priceListId, businessId),
    env.DB.prepare(
      "INSERT INTO memberships (user_id, business_id, role) VALUES (?, ?, 'owner')"
    ).bind(userId, businessId),
    env.DB.prepare(
      `INSERT INTO business_subscriptions
       (id,business_id,plan_id,price_id,source,status,trial_ends_at,
        current_period_start_at,current_period_end_at,created_at,updated_at)
       VALUES (?,?,
         (SELECT plan.id FROM subscription_plans plan ${planOfferJoin}
          WHERE plan.id=? AND price.id=? AND plan.is_active=1 AND (?=0 OR plan.is_public=1)),
         ?,'manual',?,?,?,?,?,?)`
    ).bind(
      subscriptionId,
      businessId,
      input.plan.id,
      input.plan.priceId,
      Number(input.publicSignup),
      input.plan.priceId,
      trialEndsAt ? "trialing" : "active",
      trialEndsAt,
      createdAt,
      trialEndsAt,
      createdAt,
      createdAt
    ),
    env.DB.prepare(
      "INSERT INTO table_groups (id, business_id, name, sort_order, is_active) VALUES (?, ?, 'Main Area', 0, 1)"
    ).bind(groupId, businessId),
    env.DB.prepare(
      `INSERT INTO qr_designs
       (id, business_id, name, preset_key, target_type, config_json, is_default)
       VALUES (?, ?, 'My QR Menu', 'table-card', 'menu', ?, 1)`
    ).bind(designId, businessId, JSON.stringify(defaultQrConfig())),
    ...input.actorEmail ? [
      auditStatement(env, input.actorEmail, "business.created", businessId, userId, {
        businessName: input.businessName,
        slug: input.businessSlug,
        ownerEmail: input.email,
        planId: input.plan.id,
        priceId: input.plan.priceId
      })
    ] : []
  ]);
  return {
    user: {
      id: userId,
      email: input.email,
      displayName: input.displayName || input.businessName
    },
    business: {
      id: businessId,
      name: input.businessName,
      slug: input.businessSlug
    }
  };
}
__name(provisionBusiness, "provisionBusiness");
async function invalidatePublicMenu(env, businessId) {
  await publicMenuVersionStatement(env.DB, businessId).run();
}
__name(invalidatePublicMenu, "invalidatePublicMenu");
function publicMenuVersionStatement(db, businessId, onlyAfterChanges = false) {
  return db.prepare(
    `UPDATE businesses SET menu_cache_version=menu_cache_version+1,
     updated_at=CURRENT_TIMESTAMP WHERE id=?${onlyAfterChanges ? " AND changes()>0" : ""}`
  ).bind(businessId);
}
__name(publicMenuVersionStatement, "publicMenuVersionStatement");
function menuPlacements(value) {
  if (!Array.isArray(value) || !value.length || value.length > 1e4) return null;
  const ids = /* @__PURE__ */ new Set();
  const placements = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { id: id2, parentId, sortOrder: sortOrder2 } = item;
    if (typeof id2 !== "string" || !RECORD_ID_PATTERN.test(id2) || ids.has(id2) || parentId !== null && (typeof parentId !== "string" || !RECORD_ID_PATTERN.test(parentId)) || typeof sortOrder2 !== "number" || parseSortOrder(sortOrder2) === null) return null;
    ids.add(id2);
    placements.push({ id: id2, parentId, sortOrder: sortOrder2 });
  }
  return placements;
}
__name(menuPlacements, "menuPlacements");
async function deleteUnorderedProducts(db, businessId, productIds) {
  const encoded = JSON.stringify(productIds);
  const [deleted, , retained] = await db.batch([
    db.prepare(`DELETE FROM products
      WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?2))
      AND id NOT IN (
        SELECT line.product_id FROM orders purchase
        JOIN order_products line ON line.order_id=purchase.id
        WHERE purchase.business_id=?1 AND line.product_id IN (SELECT value FROM json_each(?2))
      )
      RETURNING id`).bind(businessId, encoded),
    publicMenuVersionStatement(db, businessId, true),
    db.prepare(`SELECT id FROM products
      WHERE business_id=? AND id IN (SELECT value FROM json_each(?))`).bind(businessId, encoded)
  ]);
  return {
    deletedIds: deleted.results.map(({ id: id2 }) => id2),
    protectedIds: retained.results.map(({ id: id2 }) => id2)
  };
}
__name(deleteUnorderedProducts, "deleteUnorderedProducts");
async function localMenuAssignments(db, businessId, productId, value) {
  if (value === void 0) return [];
  if (!Array.isArray(value) || value.length > 1e3 || value.some((entry) => typeof entry !== "string" || !RECORD_ID_PATTERN.test(entry)))
    return null;
  const ids = [...new Set(value)];
  const encoded = JSON.stringify(ids);
  const valid = await db.prepare(`SELECT COUNT(*) AS count FROM menus
    WHERE business_id=? AND source='local' AND parent_id IS NOT NULL
      AND id IN (SELECT value FROM json_each(?))`).bind(businessId, encoded).first("count");
  if (valid !== ids.length) return null;
  return [
    db.prepare(`DELETE FROM menu_products WHERE business_id=? AND product_id=?
      AND menu_id IN (SELECT id FROM menus WHERE business_id=? AND source='local')
      AND menu_id NOT IN (SELECT value FROM json_each(?))`).bind(businessId, productId, businessId, encoded),
    db.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id)
      SELECT ?,value,? FROM json_each(?) WHERE true
      ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId, productId, encoded)
  ];
}
__name(localMenuAssignments, "localMenuAssignments");
var adminCategoryScope = `filtered_category_ids(id) AS (
  SELECT id FROM categories WHERE business_id=? AND id=?
  UNION
  SELECT child.id FROM categories child
  JOIN filtered_category_ids parent ON child.parent_id=parent.id
  WHERE child.business_id=?
)`;
var adminVisibleCategoryScope = `visible_category_ids(id) AS (
  SELECT id FROM categories
  WHERE business_id = ? AND is_active = 1 AND parent_id IS NULL
  UNION ALL
  SELECT child.id FROM categories child
  JOIN visible_category_ids parent ON child.parent_id = parent.id
  WHERE child.business_id = ? AND child.is_active = 1
)`;
var adminProductFilters = {
  published: "product.is_available = 1",
  unpublished: "product.is_available = 0",
  featured: "product.is_featured = 1",
  "missing-photos": `product.is_available = 1
    AND product.category_id IN (SELECT id FROM visible_category_ids)
    AND COALESCE(TRIM(product.image_url), '') = ''
    AND NOT EXISTS (
      SELECT 1 FROM product_images missing_image
      WHERE missing_image.business_id = product.business_id
        AND missing_image.product_id = product.id
    )`
};
function adminProductFilter(filter) {
  return Object.hasOwn(adminProductFilters, filter) ? adminProductFilters[filter] : "";
}
__name(adminProductFilter, "adminProductFilter");
var adminProductCounts = `COUNT(*) AS "all",
  COUNT(CASE WHEN ${adminProductFilters.published} THEN 1 END) AS published,
  COUNT(CASE WHEN ${adminProductFilters.unpublished} THEN 1 END) AS unpublished,
  COUNT(CASE WHEN ${adminProductFilters.featured} THEN 1 END) AS featured,
  COUNT(CASE WHEN ${adminProductFilters["missing-photos"]} THEN 1 END) AS missingPhotos`;
var adminUnassignedMenuProduct = `NOT EXISTS (
  SELECT 1 FROM menu_products assignment
  JOIN menus section ON section.business_id=assignment.business_id AND section.id=assignment.menu_id
  WHERE assignment.business_id=product.business_id AND assignment.product_id=product.id
    AND section.parent_id IS NOT NULL
)`;
function countAdminCatalogProducts(db, businessId, includeMenuCounts = false) {
  const menuCounts = includeMenuCounts ? `, COUNT(CASE WHEN ${adminUnassignedMenuProduct} THEN 1 END) AS unassignedMenu` : "";
  return db.prepare(`WITH RECURSIVE ${adminVisibleCategoryScope}
    SELECT ${adminProductCounts}${menuCounts}
    FROM products product WHERE product.business_id=?`).bind(businessId, businessId, businessId);
}
__name(countAdminCatalogProducts, "countAdminCatalogProducts");
var maxProductSelection = 1e4;
async function matchingProductIds(db, sql2, bindings) {
  const { results } = await db.prepare(`${sql2} LIMIT ?`).bind(...bindings, maxProductSelection + 1).all();
  if (results.length > maxProductSelection)
    return json3({ error: "Select up to 10,000 products at a time. Narrow your search or category." }, 400);
  return json3({ productIds: results.map(({ id: id2 }) => id2) });
}
__name(matchingProductIds, "matchingProductIds");
async function listAdminMenuProducts(env, url, businessId, menuId, isRoot, orderOnly, unassigned) {
  const categoryId = orderOnly ? "" : (url.searchParams.get("categoryId") ?? "").trim();
  const filter = orderOnly ? "" : url.searchParams.get("filter") ?? "";
  const filterPredicate = filter === "unassigned-menu" ? adminUnassignedMenuProduct : adminProductFilter(filter);
  const needsVisibleCategories = filter === "missing-photos";
  const idMode = url.searchParams.get("ids");
  const assignmentIds = !orderOnly && !isRoot && idMode === "1";
  const catalog = !orderOnly && !unassigned && !assignmentIds && url.searchParams.get("catalog") === "1";
  const includeDescendants = isRoot || !orderOnly && !unassigned && !assignmentIds && !catalog && url.searchParams.get("includeDescendants") === "1";
  const menuScope = includeDescendants ? `sections(id) AS (
    SELECT id FROM menus WHERE business_id=? AND parent_id=?
    UNION
    SELECT child.id FROM menus child JOIN sections parent ON child.parent_id=parent.id
    WHERE child.business_id=?
  )` : "";
  const menuScopeBindings = includeDescendants ? [businessId, menuId, businessId] : [];
  const scopes = [
    menuScope,
    categoryId ? adminCategoryScope : "",
    needsVisibleCategories ? adminVisibleCategoryScope : ""
  ].filter(Boolean);
  const scope = scopes.length ? `WITH RECURSIVE ${scopes.join(", ")}` : "";
  const descendantAssignment = `EXISTS (SELECT 1 FROM menu_products child_placement
    JOIN sections ON sections.id=child_placement.menu_id
    WHERE child_placement.business_id=product.business_id AND child_placement.product_id=product.id)`;
  const assignment = isRoot ? descendantAssignment : "placement.product_id IS NOT NULL";
  const browseAssignment = includeDescendants && !isRoot ? `(${assignment} OR ${descendantAssignment})` : assignment;
  const query = orderOnly ? "" : (url.searchParams.get("query") ?? "").trim().toLowerCase().slice(0, 160);
  const from = `FROM products product
    ${isRoot ? "" : `LEFT JOIN menu_products placement ON placement.business_id=product.business_id
      AND placement.product_id=product.id AND placement.menu_id=?`}`;
  const where = `WHERE product.business_id=?
    ${catalog ? "" : unassigned ? `AND NOT (${assignment})` : `AND ${browseAssignment}`}
    ${filterPredicate ? `AND ${filterPredicate}` : ""}
    ${categoryId ? "AND product.category_id IN (SELECT id FROM filtered_category_ids)" : ""}
    ${query ? `AND LOWER(COALESCE(product.code,'') || ' ' || product.name || ' ' ||
      COALESCE(product.name_km,'') || ' ' || COALESCE(product.name_en,'') || ' ' ||
      COALESCE(product.name_zh,'')) LIKE ?` : ""}`;
  const assignedBindings = isRoot ? [businessId] : [menuId, businessId];
  const bindings = [
    ...menuScopeBindings,
    ...categoryId ? [businessId, categoryId, businessId] : [],
    ...needsVisibleCategories ? [businessId, businessId] : [],
    ...assignedBindings,
    ...query ? [`%${query}%`] : []
  ];
  if (assignmentIds || !orderOnly && idMode === "matches")
    return matchingProductIds(env.DB, `${scope} SELECT product.id ${from} ${where}`, bindings);
  const page = Math.min(1e6, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "", 10) || 1));
  const pageSize = 48;
  const select = `${scope}
    SELECT product.id,product.code,product.name,product.name_km AS nameKm,
      product.name_en AS nameEn,product.name_zh AS nameZh,product.price_cents AS priceCents,
      product.unit,product.is_available AS isAvailable,product.image_url AS imageUrl,
      product.primary_media_id AS primaryMediaId,photo.object_key AS objectKey,
      COALESCE(category.name_km,category.name) AS categoryName,
      (${assignment}) AS isAssigned,
      ${isRoot ? "0" : "COALESCE(placement.assigned_in_admin,0)"} AS assignedInAdmin,
      ${isRoot ? "product.sort_order" : "COALESCE(placement.sort_order,product.sort_order)"} AS sortOrder
    ${from}
    LEFT JOIN categories category ON category.id=product.category_id AND category.business_id=product.business_id
    LEFT JOIN media photo ON photo.id=product.primary_media_id AND photo.business_id=product.business_id
    ${where}
    ORDER BY sortOrder,product.sort_order,product.name,product.id`;
  const statements = [
    orderOnly ? env.DB.prepare(select).bind(...bindings) : env.DB.prepare(`${select} LIMIT ? OFFSET ?`).bind(...bindings, pageSize, (page - 1) * pageSize),
    env.DB.prepare(`${scope} SELECT COUNT(*) AS total ${from} ${where}`).bind(...bindings)
  ];
  if (!orderOnly && !unassigned && url.searchParams.get("includeCounts") === "1") {
    statements.push(countAdminCatalogProducts(env.DB, businessId, true));
  }
  const [products, count, counts] = await env.DB.batch(statements);
  return json3({
    products: products.results.map(({ objectKey, primaryMediaId, ...product }) => ({
      ...product,
      imageUrl: mediaUrl(env, objectKey, String(product.imageUrl ?? (primaryMediaId ? `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${primaryMediaId}` : "")))
    })),
    pagination: { page, pageSize, total: Number(count.results[0]?.total ?? 0) },
    counts: counts?.results[0]
  });
}
__name(listAdminMenuProducts, "listAdminMenuProducts");
async function adminMenuProducts(request, url, env, businessId, menuId, orderOnly) {
  const db = env.DB;
  const menu = await db.prepare(
    "SELECT parent_id AS parentId,source FROM menus WHERE business_id=? AND id=? AND deleted_in_admin=0"
  ).bind(businessId, menuId).first();
  if (!menu) return json3({ error: "Menu not found" }, 404);
  const unassigned = url.searchParams.get("unassigned") === "1";
  if (request.method === "GET" && (!unassigned && !orderOnly || menu.parentId))
    return listAdminMenuProducts(env, url, businessId, menuId, !menu.parentId, orderOnly, unassigned);
  if (!menu.parentId) return json3({ error: "Choose a submenu" }, 400);
  if (orderOnly ? request.method !== "PUT" : !["POST", "DELETE"].includes(request.method))
    return json3({ error: "Method not allowed" }, 405);
  const body = await readJson(request).catch(() => null);
  const ids = body?.productIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > maxProductSelection || ids.some((id2) => typeof id2 !== "string" || !RECORD_ID_PATTERN.test(id2)))
    return json3({ error: "Choose products for this menu" }, 400);
  const productIds = [...new Set(ids)];
  const encoded = JSON.stringify(productIds);
  if (orderOnly) {
    if (ids.length !== productIds.length) return json3({ error: "Product order contains duplicates" }, 400);
    const [saved] = await db.batch([
      db.prepare(`WITH requested(product_id, position) AS (SELECT value, key FROM json_each(?1))
        UPDATE menu_products SET sort_order=requested.position FROM requested
        WHERE menu_products.business_id=?2 AND menu_products.menu_id=?3
          AND menu_products.product_id=requested.product_id
          AND EXISTS (SELECT 1 FROM menus WHERE business_id=?2 AND id=?3
            AND parent_id IS NOT NULL AND deleted_in_admin=0)
          AND (SELECT COUNT(*) FROM menu_products WHERE business_id=?2 AND menu_id=?3)=?4
          AND NOT EXISTS (SELECT 1 FROM menu_products current
            WHERE current.business_id=?2 AND current.menu_id=?3
              AND current.product_id NOT IN (SELECT product_id FROM requested))`).bind(encoded, businessId, menuId, productIds.length),
      publicMenuVersionStatement(db, businessId, true)
    ]);
    if (saved.meta.changes !== productIds.length)
      return json3({ error: "The menu's products changed. Reopen the order dialog and try again." }, 409);
    return json3({ ok: true });
  }
  if (request.method === "POST") {
    const count = await db.prepare(`SELECT COUNT(*) AS count FROM products WHERE business_id=?
      AND id IN (SELECT value FROM json_each(?))`).bind(businessId, encoded).first("count");
    if (count !== productIds.length) return json3({ error: "Choose products owned by this business" }, 400);
  }
  const target = "SELECT 1 FROM menus WHERE business_id=?1 AND id=?2 AND parent_id IS NOT NULL AND deleted_in_admin=0";
  const posMenu = Number(menu.source === "pos");
  const assign = request.method === "POST";
  const selected = `business_id=?1 AND menu_id=?2 AND product_id IN (SELECT value FROM json_each(?3))
    AND EXISTS (${target})`;
  const write = assign ? db.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id,assigned_in_admin)
        SELECT ?1,?2,value,?4 FROM json_each(?3) WHERE EXISTS (${target})
        ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId, menuId, encoded, posMenu) : db.prepare(`DELETE FROM menu_products WHERE ${selected}`).bind(businessId, menuId, encoded);
  const override = assign ? `DELETE FROM menu_product_exclusions WHERE ${selected}` : `INSERT INTO menu_product_exclusions (business_id,menu_id,product_id)
        SELECT ?1,?2,id FROM products WHERE business_id=?1
          AND id IN (SELECT value FROM json_each(?3)) AND EXISTS (${target})
        ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`;
  const [current] = await db.batch([
    db.prepare(target).bind(businessId, menuId),
    ...posMenu ? [db.prepare(override).bind(businessId, menuId, encoded)] : [],
    write,
    publicMenuVersionStatement(db, businessId, true)
  ]);
  if (!current.results.length) return json3({ error: "This submenu is no longer available" }, 409);
  return json3({ ok: true });
}
__name(adminMenuProducts, "adminMenuProducts");
async function activeBanners(env, businessId, timezone) {
  const now = localDateTimeNow(timezone);
  return (await env.DB.prepare(
    `SELECT id, title, subtitle, image_url AS imageUrl,
        detail_text AS detailText, cta_label AS ctaLabel, cta_url AS ctaUrl
       FROM banners
       WHERE business_id=? AND is_active=1
         AND ((starts_at IS NULL AND ends_at IS NULL)
           OR (starts_at<=? AND ends_at>?))
       ORDER BY sort_order, created_at`
  ).bind(businessId, now, now).all()).results;
}
__name(activeBanners, "activeBanners");
async function bannerStateKey(banners) {
  const ids = banners.map((banner) => String(banner.id)).join(":");
  const digest2 = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ids)
  );
  return bytesToHex(digest2).slice(0, 16);
}
__name(bannerStateKey, "bannerStateKey");
async function cachedPublicMenu(slug2, env, branchSlug, menuSlug) {
  const context = await env.DB.prepare(
    `SELECT id, pricing_mode AS pricingMode,
      default_price_list_id AS defaultPriceListId, timezone,
      allow_category_browsing AS allowCategoryBrowsing,
      menu_cache_version AS menuCacheVersion
     FROM businesses WHERE slug=? AND is_active=1`
  ).bind(slug2).first();
  if (!context) return { menu: null, cacheStatus: "MISS" };
  const businessId = String(context.id);
  const requiresMenu = menuSlug !== null || !context.allowCategoryBrowsing;
  const [branch2, root] = await Promise.all([
    findBranch(env.DB, businessId, branchSlug),
    menuSlug !== null ? findMenuRoot(env.DB, businessId, menuSlug) : requiresMenu ? firstActiveMenuRoot(env.DB, businessId) : null
  ]);
  if (!branch2?.isActive || requiresMenu && !root?.isActive)
    return { menu: null, cacheStatus: "MISS" };
  const pricing = await resolvePriceList(
    env,
    String(context.id),
    context.pricingMode,
    context.defaultPriceListId,
    context.timezone
  );
  const banners = await activeBanners(
    env,
    String(context.id),
    pricing.timezone
  );
  const key = catalogCacheKey(
    `${slug2}:${branch2.id}:${root?.id ?? "categories"}`,
    Number(context.menuCacheVersion || 1),
    pricing.activeId,
    await bannerStateKey(banners),
    env
  );
  const cached = await env.CATALOG_CACHE.get(key, "json");
  if (cached) return { menu: cached, cacheStatus: "HIT" };
  const menu = await publicMenu(slug2, env, branch2, root, pricing, banners);
  if (menu)
    await env.CATALOG_CACHE.put(key, JSON.stringify(menu), {
      expirationTtl: 86400
    });
  return { menu, cacheStatus: "MISS" };
}
__name(cachedPublicMenu, "cachedPublicMenu");
async function publicMenu(slug2, env, branch2, root, resolvedPricing, resolvedBanners) {
  const business2 = await env.DB.prepare(
    `
    SELECT business.id, business.name, business.slug, business.tagline,
      business.description, business.logo_url AS logoUrl,
      business.logo_media_id AS logoMediaId, logo_media.object_key AS logoObjectKey,
      business.phone, business.address, business.currency,
      business.secondary_currency AS secondaryCurrency,
      business.secondary_exchange_rate AS secondaryExchangeRate,
      business.show_secondary_currency AS showSecondaryCurrency,
      business.enable_add_to_order AS enableAddToOrder,
      ${branchOrderColumns},
      business.locale,
      business.business_hours_json AS businessHoursJson,
      business.contact_numbers_json AS contactNumbersJson,
      business.email, business.website_url AS websiteUrl,
      business.custom_menu_url AS customMenuUrl,
      business.social_links_json AS socialLinksJson,
      business.locations_json AS locationsJson,
      business.map_url AS mapUrl, business.map_label AS mapLabel,
      business.wifi_ssid AS wifiSsid,
      business.wifi_password AS wifiPassword,
      business.wifi_security AS wifiSecurity,
      business.show_header_location AS showHeaderLocation,
      business.show_header_phones AS showHeaderPhones,
      business.show_header_wifi AS showHeaderWifi,
      business.show_header_socials AS showHeaderSocials,
      business.show_header_tagline AS showHeaderTagline,
      business.show_business_hours AS showBusinessHours,
      business.theme_color AS themeColor,
      business.menu_theme_json AS menuThemeJson, business.enable_en AS enableEn,
      business.enable_zh AS enableZh, business.timezone,
      business.pricing_mode AS pricingMode,
      business.default_price_list_id AS defaultPriceListId
    FROM businesses business
    JOIN branches branch ON branch.business_id=business.id AND branch.id=? AND branch.is_active=1
    LEFT JOIN media logo_media
      ON logo_media.id=business.logo_media_id AND logo_media.business_id=business.id
    WHERE business.slug = ? AND business.is_active = 1
  `
  ).bind(branch2.id, slug2).first();
  if (!business2) return null;
  const businessId = String(business2.id);
  const pricing = resolvedPricing || await resolvePriceList(
    env,
    businessId,
    business2.pricingMode,
    business2.defaultPriceListId,
    business2.timezone
  );
  const scopeBindings2 = root ? [businessId, root.id, businessId] : [businessId, businessId];
  const categoryQuery = root ? `${visibleMenuIds}
       SELECT node.id,node.parent_id AS parentId,node.slug,node.name_km AS nameKm,
        node.name_en AS nameEn,node.name_zh AS nameZh,
        COALESCE(NULLIF(node.name_km,''),NULLIF(node.name_en,''),node.name_zh) AS name,
        node.image_url AS imageUrl,node.image_media_id AS imageMediaId,
        photo.object_key AS imageObjectKey,node.sort_order AS sortOrder
       FROM menus node JOIN visible_menu_ids visible ON visible.id=node.id
       LEFT JOIN media photo ON photo.id=node.image_media_id AND photo.business_id=node.business_id
       WHERE node.business_id=? ORDER BY node.sort_order,name,node.id` : `${visibleCategoryIds}
       SELECT category.id, category.parent_id AS parentId,
        COALESCE(category.name_km, category.name) AS name,
        category.name_km AS nameKm, category.name_en AS nameEn,
        category.name_zh AS nameZh, category.slug,
        category.image_url AS imageUrl, category.image_media_id AS imageMediaId,
        category_media.object_key AS imageObjectKey,
        category.sort_order AS sortOrder
       FROM categories category
       JOIN visible_category_ids visible ON visible.id = category.id
       LEFT JOIN media category_media
        ON category_media.id=category.image_media_id
        AND category_media.business_id=category.business_id
       WHERE category.business_id = ?
       ORDER BY category.sort_order, category.name`;
  const [categories, products, productImages, productPrices] = await env.DB.batch([
    env.DB.prepare(categoryQuery).bind(...scopeBindings2, businessId),
    env.DB.prepare(
      `${root ? visibleMenuIds : visibleCategoryIds}
       SELECT product.id, product.code, product.rating,
        product.category_id AS categoryId,
        ${root ? `(SELECT json_group_array(json_array(assignment.menu_id,
          COALESCE(assignment.sort_order,product.sort_order))) ${visibleMenuAssignments}) AS menuOrdersJson,` : ""}
        COALESCE(product.name_km, product.name) AS name,
        product.name_km AS nameKm, product.name_en AS nameEn,
        product.name_zh AS nameZh, product.slug, product.description,
        product.price_cents AS priceCents, product.max_price AS maxPrice,
        product.unit,
        product.portions_json AS portionsJson,
        product.modifier_groups_json AS modifierGroupsJson,
        product.image_url AS imageUrl, product.calories,
        product.primary_media_id AS primaryMediaId,
        product.prep_minutes AS prepMinutes,
        product.is_featured AS isFeatured
       FROM products product
       ${root ? "" : "JOIN visible_category_ids visible ON visible.id = product.category_id"}
       WHERE product.business_id = ? AND product.is_available = 1
       ${root ? `AND EXISTS (SELECT 1 ${visibleMenuAssignments})` : ""}
       ORDER BY product.sort_order, product.name, product.id`
    ).bind(...scopeBindings2, businessId),
    env.DB.prepare(
      `SELECT pi.product_id AS productId, m.id, m.object_key AS objectKey,
        pi.sort_order AS sortOrder, pi.is_primary AS isPrimary
       FROM product_images pi JOIN media m ON m.id = pi.media_id
       WHERE pi.business_id = ? ORDER BY pi.product_id, pi.sort_order`
    ).bind(businessId),
    env.DB.prepare(
      `SELECT price_list_id AS priceListId, product_id AS productId,
        target_key AS targetKey, price_amount AS priceCents
       FROM product_prices
       WHERE business_id=? AND price_list_id IN (?,?)`
    ).bind(businessId, pricing.normalId, pricing.activeId)
  ]);
  const categoryRows = categories.results.map(
    (category) => root && (category.id === root.id || category.parentId === root.id) ? { ...category, parentId: null } : category
  );
  const priceRows = productPrices.results;
  const normalPrices = priceMap(priceRows, pricing.normalId);
  const activePrices = priceMap(priceRows, pricing.activeId);
  const productRows = products.results.flatMap(
    ({ menuOrdersJson, ...product }) => {
      const priced2 = applyResolvedPrices(product, normalPrices, activePrices, branch2.id);
      const menuOrders = root ? jsonArray(menuOrdersJson) : null;
      return priced2 ? [{ product: priced2, menuOrders }] : [];
    }
  );
  const parentByCategoryId = new Map(
    categoryRows.map(({ id: id2, parentId }) => [id2, parentId])
  );
  const populatedCategoryIds = /* @__PURE__ */ new Set();
  for (const { product, menuOrders } of productRows) {
    for (const section of menuOrders?.map(([id2]) => id2) ?? [product.categoryId]) {
      let categoryId = String(section);
      while (categoryId && !populatedCategoryIds.has(categoryId)) {
        populatedCategoryIds.add(categoryId);
        categoryId = parentByCategoryId.get(categoryId) ?? null;
      }
    }
  }
  const imagesByProduct = /* @__PURE__ */ new Map();
  for (const image of productImages.results) {
    const productId = String(image.productId);
    const { objectKey, ...publicImage } = image;
    imagesByProduct.set(productId, [
      ...imagesByProduct.get(productId) ?? [],
      {
        ...publicImage,
        url: mediaUrl(
          env,
          objectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${image.id}`
        )
      }
    ]);
  }
  const {
    logoObjectKey,
    businessHoursJson,
    contactNumbersJson,
    socialLinksJson,
    locationsJson,
    latitude,
    longitude,
    wifiSsid,
    wifiPassword,
    wifiSecurity,
    menuThemeJson,
    defaultPriceListId: _defaultPriceListId,
    pricingMode: _pricingMode,
    ...publicBusiness
  } = business2;
  publicBusiness.logoUrl = mediaUrl(
    env,
    logoObjectKey,
    String(publicBusiness.logoUrl ?? "")
  );
  publicBusiness.businessHours = jsonArray(businessHoursJson);
  publicBusiness.contactNumbers = jsonArray(contactNumbersJson);
  publicBusiness.socialLinks = jsonArray(socialLinksJson);
  publicBusiness.locations = jsonArray(locationsJson).map((value) => {
    const location = value ?? {};
    return {
      ...location,
      showInMenu: location.showInMenu == null ? true : Boolean(location.showInMenu)
    };
  }).filter((location) => location.showInMenu);
  const primaryPublicLocation = publicBusiness.locations[0];
  publicBusiness.mapUrl = String(primaryPublicLocation?.mapUrl ?? "");
  publicBusiness.mapLabel = String(primaryPublicLocation?.label ?? "");
  if (!branch2.isDefault) {
    publicBusiness.address = branch2.address;
    publicBusiness.phone = branch2.phone;
    publicBusiness.contactNumbers = branch2.phone ? [{ label: branch2.name, number: branch2.phone }] : [];
    publicBusiness.mapUrl = branch2.mapUrl;
    publicBusiness.mapLabel = branch2.name;
    publicBusiness.locations = branch2.address || branch2.mapUrl ? [{ label: branch2.name, address: branch2.address, mapUrl: branch2.mapUrl, showInMenu: true }] : [];
  }
  publicBusiness.enableAddToOrder = Boolean(publicBusiness.enableAddToOrder);
  const orderLocation = validCoordinate(latitude, 90) && validCoordinate(longitude, 180) ? { latitude, longitude } : null;
  publicBusiness.enableSubmitOrder = Boolean(publicBusiness.enableSubmitOrder && orderLocation);
  publicBusiness.orderLocation = publicBusiness.enableSubmitOrder ? orderLocation : null;
  publicBusiness.showHeaderLocation = Boolean(
    publicBusiness.showHeaderLocation
  );
  publicBusiness.showHeaderPhones = Boolean(publicBusiness.showHeaderPhones);
  publicBusiness.showHeaderWifi = Boolean(publicBusiness.showHeaderWifi);
  publicBusiness.showHeaderSocials = Boolean(publicBusiness.showHeaderSocials);
  publicBusiness.showHeaderTagline = Boolean(publicBusiness.showHeaderTagline);
  publicBusiness.showBusinessHours = Boolean(publicBusiness.showBusinessHours);
  if (publicBusiness.showHeaderWifi) {
    publicBusiness.wifiSsid = wifiSsid;
    publicBusiness.wifiPassword = wifiSecurity === "wpa" ? wifiPassword : "";
    publicBusiness.wifiSecurity = wifiSecurity;
  }
  publicBusiness.menuTheme = parseMenuTheme(
    menuThemeJson,
    publicBusiness.themeColor,
    env
  );
  return {
    business: publicBusiness,
    branch: { id: branch2.id, slug: branch2.slug, name: branch2.name, isDefault: Boolean(branch2.isDefault) },
    menu: root ? { id: root.id, slug: root.slug } : null,
    categories: (root ? orderMenuSections(categoryRows) : categoryRows).filter((category) => populatedCategoryIds.has(category.id)).map((category) => {
      const { imageObjectKey, ...publicCategory } = category;
      return {
        ...publicCategory,
        imageUrl: mediaUrl(
          env,
          imageObjectKey,
          String(publicCategory.imageUrl ?? (publicCategory.imageMediaId ? `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${publicCategory.imageMediaId}` : ""))
        )
      };
    }),
    products: productRows.map(({ product, menuOrders }) => {
      const images = imagesByProduct.get(String(product.id)) ?? [];
      const primaryImage = images.find(
        (image) => image.isPrimary === 1 || image.id === product.primaryMediaId
      );
      return {
        ...product,
        ...menuOrders ? {
          menuIds: menuOrders.map(([id2]) => id2),
          menuSortOrders: Object.fromEntries(menuOrders)
        } : {},
        imageUrl: String(primaryImage?.url ?? product.imageUrl ?? ""),
        images
      };
    }),
    banners: resolvedBanners ?? await activeBanners(env, businessId, pricing.timezone)
  };
}
__name(publicMenu, "publicMenu");
function parseOrderLines(value) {
  if (!Array.isArray(value) || !value.length || value.length > 30) return null;
  const lines = [];
  for (const raw of value) {
    const {
      productId,
      portionId = null,
      modifierIds = [],
      quantity,
      expectedPrice,
      note = ""
    } = raw ?? {};
    if (typeof productId !== "string" || !PRODUCT_OPTION_ID_PATTERN.test(productId) || portionId !== null && (typeof portionId !== "string" || !PRODUCT_OPTION_ID_PATTERN.test(portionId)) || !Array.isArray(modifierIds) || modifierIds.length > 360 || modifierIds.some(
      (option) => typeof option !== "string" || !option.length || option.length > 80
    ) || new Set(modifierIds).size !== modifierIds.length || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 || typeof expectedPrice !== "number" || !Number.isFinite(expectedPrice) || expectedPrice < 0 || typeof note !== "string" || note.length > 500)
      return null;
    lines.push({
      productId,
      portionId,
      modifierIds: [...modifierIds].sort(),
      quantity,
      expectedPrice,
      note: note.trim()
    });
  }
  return lines;
}
__name(parseOrderLines, "parseOrderLines");
var orderReceiptSql = `SELECT id AS orderId, table_id AS tableId, order_number AS orderNumber, posting_date AS postingDate,
  submitted_at AS submittedAt, total_quantity AS totalQuantity, total_amount AS totalAmount, currency, status,
  note, submission_hash AS submissionHash
  FROM orders WHERE business_id=? AND table_id=? AND submission_id=?`;
var DEVICE_ORDER_WINDOW_MS = 60 * 60 * 1e3;
function orderResponse(order, hash2, status) {
  const { submissionHash, ...receipt } = order;
  return submissionHash === hash2 ? json3(receipt, status, { "cache-control": "no-store" }) : json3(
    {
      code: "submission_conflict",
      error: "This submission ID belongs to a different order"
    },
    409
  );
}
__name(orderResponse, "orderResponse");
function validCoordinate(value, limit) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}
__name(validCoordinate, "validCoordinate");
async function submitOrder(request, env, slug2, execution) {
  const body = await readJson(request).catch(() => null);
  const lines = parseOrderLines(body?.items);
  const {
    submissionId,
    tableToken,
    tableId: scannedTableId,
    expectedCurrency,
    note: rawNote = "",
    branch: branchSlug = null,
    menu: menuSlug = null
  } = body ?? {};
  if (!lines || typeof submissionId !== "string" || !UUID_PATTERN.test(submissionId) || typeof tableToken !== "string" || !PRODUCT_OPTION_ID_PATTERN.test(tableToken) || typeof rawNote !== "string" || rawNote.length > 500 || branchSlug !== null && typeof branchSlug !== "string" || menuSlug !== null && typeof menuSlug !== "string" || expectedCurrency !== "USD" && expectedCurrency !== "KHR")
    return json3(
      {
        code: "invalid_order",
        error: "Invalid order data or missing table QR token"
      },
      400
    );
  const context = await env.DB.prepare(
    `SELECT business.id AS businessId, business.currency, business.timezone,
      business.is_active AS businessActive, business.enable_add_to_order AS orderingEnabled,
      business.allow_category_browsing AS allowCategoryBrowsing,
      ${branchOrderColumns},
      branch.id AS branchId, branch.is_active AS branchActive, business.menu_cache_version AS catalogVersion,
      business.pricing_mode AS pricingMode, business.default_price_list_id AS defaultPriceListId,
      tables.id AS tableId, tables.is_active AND groups.is_active AS tableActive
     FROM businesses business
     JOIN restaurant_tables tables ON tables.business_id=business.id
     JOIN table_groups groups ON groups.id=tables.group_id AND groups.business_id=business.id
     JOIN branches branch ON branch.id=tables.branch_id AND branch.id=groups.branch_id AND branch.business_id=business.id
     WHERE business.slug=? AND tables.public_token=?
       AND ((? IS NULL AND branch.is_default=1) OR branch.slug=?)`
  ).bind(slug2, tableToken, branchSlug, branchSlug).first();
  if (!context || scannedTableId !== void 0 && scannedTableId !== context.tableId)
    return json3(
      { code: "table_unavailable", error: "Table is unavailable" },
      404
    );
  const { businessId, tableId, branchId, currency } = context;
  const root = menuSlug === null ? null : await findMenuRoot(env.DB, businessId, menuSlug);
  if (menuSlug !== null && !root)
    return json3({ code: "menu_unavailable", error: "Menu is unavailable" }, 404);
  const receipt = env.DB.prepare(orderReceiptSql).bind(
    businessId,
    tableId,
    submissionId
  );
  const note = rawNote.trim();
  const hash2 = bytesToHex(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({
        expectedCurrency,
        lines,
        ...root ? { menuId: root.id } : {},
        ...note ? { note } : {}
      }))
    )
  );
  const existing = await receipt.first();
  if (existing) return orderResponse(existing, hash2, 200);
  const deviceId = body?.deviceId;
  if (typeof deviceId !== "string" || !UUID_PATTERN.test(deviceId))
    return json3(
      { code: "invalid_device", error: "Refresh the menu before submitting a new order" },
      400
    );
  const normalizedDeviceId = deviceId.toLowerCase();
  if (!context.businessActive || !context.tableActive || !context.branchActive)
    return json3(
      { code: "table_unavailable", error: "Table is unavailable" },
      404
    );
  if (root ? !root.isActive : !context.allowCategoryBrowsing)
    return json3({ code: "menu_unavailable", error: "Menu is unavailable" }, 404);
  const { latitude, longitude, orderRadiusMeters } = context;
  if (!context.orderingEnabled || !context.enableSubmitOrder || latitude === null || longitude === null)
    return json3(
      { code: "ordering_disabled", error: "Ordering is disabled" },
      403
    );
  const customerLatitude = body?.latitude;
  const customerLongitude = body?.longitude;
  if (!validCoordinate(customerLatitude, 90) || !validCoordinate(customerLongitude, 180))
    return json3(
      {
        code: "location_required",
        error: "A valid customer location is required"
      },
      400
    );
  if (distanceMeters(latitude, longitude, customerLatitude, customerLongitude) > orderRadiusMeters)
    return json3(
      {
        code: "outside_order_radius",
        error: "Customer is outside the ordering radius",
        orderRadiusMeters
      },
      403
    );
  const priceChanged = /* @__PURE__ */ __name(() => json3(
    {
      code: "price_changed",
      error: "Menu prices changed. Review the latest prices."
    },
    409
  ), "priceChanged");
  if (expectedCurrency !== currency) return priceChanged();
  const pricing = await resolvePriceList(
    env,
    businessId,
    context.pricingMode,
    context.defaultPriceListId,
    context.timezone
  );
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const placeholders = productIds.map(() => "?").join(",");
  const scopeBindings2 = root ? [businessId, root.id, businessId] : [businessId, businessId];
  const [products, prices] = await env.DB.batch([
    env.DB.prepare(
      `${root ? visibleMenuIds : visibleCategoryIds}
       SELECT product.id, product.code, COALESCE(NULLIF(product.name_km,''),product.name) AS name,
         product.price_cents AS priceCents,
         product.portions_json AS portionsJson, product.modifier_groups_json AS modifierGroupsJson
       FROM products product
       ${root ? "" : "JOIN visible_category_ids visible ON visible.id=product.category_id"}
       WHERE product.business_id=? AND product.is_available=1 AND product.id IN (${placeholders})
       ${root ? `AND EXISTS (SELECT 1 ${visibleMenuAssignments})` : ""}`
    ).bind(...scopeBindings2, businessId, ...productIds),
    env.DB.prepare(
      `SELECT price_list_id AS priceListId, product_id AS productId,
        target_key AS targetKey, price_amount AS priceCents
       FROM product_prices WHERE business_id=? AND price_list_id IN (?,?)
         AND product_id IN (${placeholders})`
    ).bind(businessId, pricing.normalId, pricing.activeId, ...productIds)
  ]);
  const normalPrices = priceMap(prices.results, pricing.normalId);
  const activePrices = priceMap(prices.results, pricing.activeId);
  const catalog = new Map(
    products.results.flatMap((product) => {
      const priced2 = applyResolvedPrices(product, normalPrices, activePrices, branchId);
      return priced2 ? [[product.id, priced2]] : [];
    })
  );
  const invalidSelection = /* @__PURE__ */ __name(() => json3(
    {
      code: "selection_changed",
      error: "A product, portion, or modifier is unavailable"
    },
    409
  ), "invalidSelection");
  const orderId = id("ord");
  const insertLine = env.DB.prepare(
    `INSERT INTO order_products
      (order_id,line_number,product_id,quantity,price,portion_name,price_list,modifiers,total_amount,note,
       portion_id,product_code,product_name)
     SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)`
  );
  const inserts = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  for (const line of lines) {
    const product = catalog.get(line.productId);
    if (!product) return invalidSelection();
    const portion = product.portions.find(
      (entry) => entry.id === line.portionId
    );
    if (line.portionId && !portion || product.portions.length && !portion)
      return invalidSelection();
    const modifiers2 = [];
    const groups = product.modifierGroups;
    for (const group of groups) {
      const selected = group.options.filter(
        (option) => line.modifierIds.includes(String(option.id))
      );
      if (group.required && !selected.length || !group.multiple && selected.length > 1)
        return invalidSelection();
      modifiers2.push(
        ...selected.map((option) => ({ ...option, groupId: group.id }))
      );
    }
    if (modifiers2.length !== line.modifierIds.length) return invalidSelection();
    const basePrice = Number(portion?.priceCents ?? product.priceCents);
    const price = basePrice + modifiers2.reduce(
      (sum, option) => sum + Number(option.priceCents || 0),
      0
    );
    const amount = price * line.quantity;
    if (!Number.isFinite(amount) || amount < 0) return invalidSelection();
    if (Math.abs(price - line.expectedPrice) > Number.EPSILON * Math.max(1, price) * 4)
      return priceChanged();
    const target = `${line.productId}:${line.portionId ?? "base"}`;
    const priceList = activePrices.has(target) ? pricing.activeId : pricing.normalId;
    totalQuantity += line.quantity;
    totalAmount += amount;
    inserts.push(
      insertLine.bind(
        orderId,
        inserts.length + 1,
        line.productId,
        line.quantity,
        price,
        String(portion?.labelKm || ""),
        priceList,
        JSON.stringify(modifiers2),
        amount,
        line.note,
        line.portionId,
        product.code ?? null,
        product.name,
        orderId
      )
    );
  }
  if (!Number.isFinite(totalAmount)) return invalidSelection();
  const submittedAt = /* @__PURE__ */ new Date();
  const deviceWindowStart = new Date(
    submittedAt.getTime() - DEVICE_ORDER_WINDOW_MS
  ).toISOString();
  const postingDate = localDateKey(submittedAt, pricing.timezone);
  const numberPrefix = postingDate.slice(2).replaceAll("-", "");
  const [header, ...results] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders
        (id,business_id,posting_date,table_id,branch_id,menu_id,total_quantity,total_amount,currency,submission_id,submission_hash,submitted_at,device_id,note,order_number)
       SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? || '-' || printf('%03d', serial)
       FROM (
         SELECT COALESCE(CAST(substr(MAX(order_number), 8) AS INTEGER), 0) + 1 AS serial
         FROM orders WHERE business_id=? AND posting_date=?
       )
       WHERE serial <= ${MAX_DAILY_ORDERS} AND EXISTS (
         SELECT 1 FROM businesses business
         JOIN branches branch ON branch.business_id=business.id
         JOIN restaurant_tables tables ON tables.business_id=business.id AND tables.branch_id=branch.id
         JOIN table_groups groups ON groups.id=tables.group_id AND groups.is_active=1
         WHERE business.id=? AND business.is_active=1 AND enable_add_to_order=1
           AND ${branchOrderPolicy.enabled}=1
           AND branch.id=? AND branch.is_active=1 AND tables.id=? AND tables.is_active=1
           AND ${branchOrderPolicy.latitude}=?
           AND ${branchOrderPolicy.longitude}=?
           AND (${branchOrderPolicy.radius})=?
           AND business.menu_cache_version=?
           AND (
             hourly_device_order_limit=0 OR (
               SELECT COUNT(*) FROM orders
               WHERE business_id=business.id AND device_id=? AND submitted_at>?
             ) < hourly_device_order_limit
           )
       )
       ON CONFLICT (business_id,table_id,submission_id) DO NOTHING`
    ).bind(
      orderId,
      businessId,
      postingDate,
      tableId,
      branchId,
      root?.id ?? null,
      totalQuantity,
      totalAmount,
      currency,
      submissionId,
      hash2,
      submittedAt.toISOString(),
      normalizedDeviceId,
      note,
      numberPrefix,
      businessId,
      postingDate,
      businessId,
      branchId,
      tableId,
      latitude,
      longitude,
      orderRadiusMeters,
      context.catalogVersion,
      normalizedDeviceId,
      deviceWindowStart
    ),
    ...inserts,
    captureWebhook(env.DB, "orders", "inserted", "r.business_id=? AND r.id=?", [businessId, orderId]),
    receipt
  ]);
  const saved = results.at(-1)?.results[0];
  if (!saved) {
    const atLimit = await env.DB.prepare(
      "SELECT 1 FROM orders WHERE business_id=? AND posting_date=? AND order_number=?"
    ).bind(businessId, postingDate, `${numberPrefix}-${MAX_DAILY_ORDERS}`).first();
    if (atLimit)
      return json3(
        {
          code: "order_limit_reached",
          error: "The business has reached its daily order limit"
        },
        409
      );
    const limitingOrder = await env.DB.prepare(
      `WITH quota AS (
         SELECT hourly_device_order_limit FROM businesses WHERE id=? AND hourly_device_order_limit>0
       )
       SELECT submitted_at FROM orders WHERE business_id=? AND device_id=? AND submitted_at>?
         AND EXISTS (SELECT 1 FROM quota)
       ORDER BY submitted_at DESC LIMIT 1
       OFFSET COALESCE((SELECT hourly_device_order_limit - 1 FROM quota), 0)`
    ).bind(businessId, businessId, normalizedDeviceId, deviceWindowStart).first();
    if (limitingOrder) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((Date.parse(limitingOrder.submitted_at) + DEVICE_ORDER_WINDOW_MS - Date.now()) / 1e3)
      );
      return json3(
        {
          code: "device_order_limit_reached",
          error: "This device has reached its hourly order limit",
          retryAfterSeconds
        },
        429,
        { "retry-after": String(retryAfterSeconds), "cache-control": "no-store" }
      );
    }
    return json3(
      {
        code: "ordering_settings_changed",
        error: "Ordering settings changed. Reload the menu and try again."
      },
      409
    );
  }
  if (header.meta.changes) {
    scheduleBranchWebhooks(env, execution, businessId);
    execution.waitUntil(deliverTelegramOrder(env, orderId).catch(() => {
      console.error("telegram_order_delivery_failed", { orderId });
    }));
    execution.waitUntil(deliverTelegramNotifications(env, "Order", orderId).catch(() => {
      console.error("custom_telegram_order_delivery_failed", { orderId });
    }));
    const orderEvents = env.ORDER_EVENTS?.getByName(businessId);
    if (orderEvents) {
      execution.waitUntil(orderEvents.broadcast(businessId, {
        type: "order.submitted",
        order: {
          id: saved.orderId,
          order_number: saved.orderNumber,
          table_id: saved.tableId,
          branch_id: branchId,
          posting_date: saved.postingDate,
          submitted_at: saved.submittedAt,
          total_quantity: saved.totalQuantity,
          total_amount: saved.totalAmount,
          currency: saved.currency
        }
      }).catch(() => console.error("order_websocket_broadcast_failed", { orderId })));
    }
  }
  return orderResponse(saved, hash2, header.meta.changes ? 201 : 200);
}
__name(submitOrder, "submitOrder");
function priceListFields(body, isNormal = false) {
  const name = String(body.name ?? "").trim().slice(0, 80);
  const scheduleEnabled = !isNormal && Boolean(body.scheduleEnabled);
  const scheduleStartLocal = scheduleEnabled ? String(body.scheduleStartLocal ?? "") : "";
  const scheduleEndLocal = scheduleEnabled ? String(body.scheduleEndLocal ?? "") : "";
  if (!name) return { error: "Price list name is required" };
  if (scheduleEnabled && (!validLocalDateTime(scheduleStartLocal) || !validLocalDateTime(scheduleEndLocal) || scheduleStartLocal >= scheduleEndLocal))
    return {
      error: "Schedule end must be after a valid schedule start"
    };
  return {
    name,
    scheduleEnabled,
    scheduleStartLocal: scheduleStartLocal || null,
    scheduleEndLocal: scheduleEndLocal || null
  };
}
__name(priceListFields, "priceListFields");
async function overlappingPriceList(env, businessId, start, end, excludeId = "") {
  return env.DB.prepare(
    `SELECT id, name FROM price_lists
     WHERE business_id=? AND is_archived=0 AND schedule_enabled=1
       AND id<>? AND schedule_start_local<? AND schedule_end_local>?
     LIMIT 1`
  ).bind(businessId, excludeId, end, start).first();
}
__name(overlappingPriceList, "overlappingPriceList");
async function productPriceStatements(env, businessId, productId, basePrice, portions2, submitted) {
  const normalId = await normalPriceListId(env, businessId);
  if (!normalId)
    return { error: "Normal Rate price list was not found" };
  const validTargets = /* @__PURE__ */ new Set([
    ...portions2.length ? [] : ["base"],
    ...portions2.map((portion) => portion.id)
  ]);
  if (submitted?.some((entry) => !validTargets.has(entry.targetKey)))
    return {
      error: "A price references a portion that does not exist"
    };
  const specialListIds = [
    ...new Set(
      (submitted || []).map((entry) => entry.priceListId).filter((listId) => listId !== normalId)
    )
  ];
  if (specialListIds.length) {
    const placeholders = specialListIds.map(() => "?").join(",");
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM price_lists
       WHERE business_id=? AND is_archived=0 AND id IN (${placeholders})`
    ).bind(businessId, ...specialListIds).first();
    if (Number(owned?.total || 0) !== specialListIds.length)
      return { error: "A selected price list was not found" };
  }
  const upsert = /* @__PURE__ */ __name((priceListId, targetKey, amount) => env.DB.prepare(
    `INSERT INTO product_prices
       (business_id,price_list_id,product_id,target_key,price_amount)
       VALUES (?,?,?,?,?)
       ON CONFLICT(price_list_id,product_id,target_key) DO UPDATE SET
        price_amount=excluded.price_amount,updated_at=CURRENT_TIMESTAMP`
  ).bind(businessId, priceListId, productId, targetKey, amount), "upsert");
  const statements = [];
  if (submitted) {
    for (const priceListId of specialListIds)
      statements.push(
        env.DB.prepare(
          "DELETE FROM product_prices WHERE business_id=? AND product_id=? AND price_list_id=?"
        ).bind(businessId, productId, priceListId)
      );
  }
  const targets = [...validTargets];
  const targetPlaceholders = targets.map(() => "?").join(",");
  statements.push(
    env.DB.prepare(
      `DELETE FROM product_prices
       WHERE business_id=? AND product_id=? AND target_key NOT IN (${targetPlaceholders})`
    ).bind(businessId, productId, ...targets)
  );
  if (!portions2.length) statements.push(upsert(normalId, "base", basePrice));
  for (const portion of portions2)
    statements.push(upsert(normalId, portion.id, Number(portion.priceCents)));
  for (const entry of submitted || []) {
    if (entry.priceListId === normalId || entry.priceCents == null) continue;
    statements.push(
      upsert(entry.priceListId, entry.targetKey, entry.priceCents)
    );
  }
  return { statements, normalId };
}
__name(productPriceStatements, "productPriceStatements");
async function handle(request, env, execution) {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        ...cors(request, env),
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": isPosApiPath(path) ? "content-type,authorization,idempotency-key" : "content-type,authorization"
      }
    });
  const publicBusiness = path.match(/^\/api\/public\/businesses\/([a-z0-9-]+)(\/.*)$/);
  if (publicBusiness) {
    const canonical2 = await env.DB.prepare(
      `SELECT b.slug FROM business_slug_aliases a JOIN businesses b ON b.id=a.business_id
       WHERE a.slug=?`
    ).bind(publicBusiness[1]).first("slug");
    if (canonical2) path = `/api/public/businesses/${canonical2}${publicBusiness[2]}`;
  }
  if (path === "/health")
    return json3({ ok: true, service: "angkor-emenu-api" });
  if (isPosApiPath(path)) return handlePosApi(request, env, {
    verifyCredentials: /* @__PURE__ */ __name(async (email, proof, version, bindings) => {
      if (version !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(proof)) return null;
      if (!authConfigured(bindings)) return null;
      const result = await verifyAccount(bindings, email, proof);
      return result.status === "verified" ? result.account : null;
    }, "verifyCredentials"),
    localDate: localDateKey,
    startOfLocalDate: /* @__PURE__ */ __name((date, timezone) => endOfLocalDateUtc(date, timezone, 0), "startOfLocalDate"),
    subscription: /* @__PURE__ */ __name((identity) => subscriptionSummary(identity, identity.timezone), "subscription"),
    pricing: resolvePriceList,
    priceMap,
    pricedProduct: applyResolvedPrices
  });
  if (path === "/api/integrations/pos/orders/ws")
    return connectPosOrderEvents(request, env);
  const posOrderMatch = path.match(
    /^\/api\/integrations\/pos\/orders(?:\/([a-zA-Z0-9_-]{1,80}))?$/
  );
  if (posOrderMatch)
    return handlePosOrders(
      request,
      env,
      execution,
      (identity) => subscriptionSummary(identity, identity.timezone),
      posOrderMatch[1]
    );
  if (path === "/api/integrations/pos/sync" || path === "/api/integrations/pos/sync/product" || path === "/api/integrations/pos/sync/tables")
    return handlePosSync(
      request,
      env,
      (identity) => subscriptionSummary(identity, identity.timezone),
      path.endsWith("/tables") ? "tables" : path.endsWith("/product") ? "product" : "catalog"
    );
  const publicDomainMatch = path.match(/^\/api\/public\/domains\/([^/]+)$/);
  if (request.method === "GET" && publicDomainMatch) {
    let hostname = null;
    try {
      hostname = normalizeMenuHostname(
        decodeURIComponent(publicDomainMatch[1])
      );
    } catch {
      hostname = null;
    }
    if (!hostname) return json3({ error: "Menu domain not found" }, 404);
    const business2 = await env.DB.prepare(
      `SELECT slug FROM businesses
       WHERE custom_menu_hostname = ? COLLATE NOCASE AND is_active = 1`
    ).bind(hostname).first();
    return business2 ? json3({ slug: business2.slug }, 200, { "cache-control": "no-store" }) : json3({ error: "Menu domain not found" }, 404, {
      "cache-control": "no-store"
    });
  }
  const publicMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/menu$/
  );
  if (request.method === "GET" && publicMatch) {
    const { menu, cacheStatus } = await cachedPublicMenu(
      publicMatch[1],
      env,
      url.searchParams.get("branch"),
      url.searchParams.get("menu")
    );
    return menu ? json3(menu, 200, {
      "cache-control": "no-store",
      "x-catalog-cache": cacheStatus
    }) : json3({ error: "Menu not found" }, 404, { "cache-control": "no-store" });
  }
  const bookingMatch = path.match(/^\/api\/public\/businesses\/([a-z0-9-]+)\/bookings$/);
  if (bookingMatch) return publicBookings(request, url, env, bookingMatch[1], execution);
  const orderMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/orders$/
  );
  if (request.method === "POST" && orderMatch) {
    return submitOrder(request, env, orderMatch[1], execution);
  }
  const orderStatusMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/orders\/(ord_[a-f0-9]{32})$/
  );
  if (request.method === "GET" && orderStatusMatch) {
    const [, slug2, orderId] = orderStatusMatch;
    const receiptKey = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const headers = { "cache-control": "private, no-store" };
    if (!receiptKey || !UUID_PATTERN.test(receiptKey))
      return json3({ error: "Order not found" }, 404, headers);
    const order = await env.DB.prepare(
      `SELECT orders.status, orders.posting_date AS postingDate, orders.submitted_at AS submittedAt,
        orders.table_id AS tableId, orders.total_amount AS totalAmount, orders.currency, orders.note
       FROM orders
       JOIN businesses ON businesses.id=orders.business_id
       WHERE businesses.slug=? AND orders.id=? AND orders.submission_id=?`
    ).bind(slug2, orderId, receiptKey).first();
    if (!order) return json3({ error: "Order not found" }, 404, headers);
    if (url.searchParams.get("details") !== "1")
      return json3({ status: order.status }, 200, headers);
    const items = await env.DB.prepare(
      `SELECT line.product_id AS productId, line.quantity, line.portion_name AS portionName, line.modifiers, line.status,
        COALESCE(NULLIF(product.name_km,''),product.name,line.product_id) AS name,
        product.name_en AS nameEn, product.name_zh AS nameZh
       FROM order_products line
       JOIN orders ON orders.id=line.order_id
       LEFT JOIN products product ON product.id=line.product_id AND product.business_id=orders.business_id
       WHERE line.order_id=?
       ORDER BY line.line_number`
    ).bind(orderId).all();
    return json3({
      ...order,
      items: items.results.map((line) => ({
        ...line,
        modifiers: jsonArray(line.modifiers)
      }))
    }, 200, headers);
  }
  const tableContextMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/table-context\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "GET" && tableContextMatch) {
    const tableId = url.searchParams.get("table_id");
    const branchSlug = url.searchParams.get("branch");
    const context = await env.DB.prepare(
      `SELECT restaurant_tables.id AS tableId, restaurant_tables.code, restaurant_tables.label,
        table_groups.name AS groupName, branch.id AS branchId
       FROM restaurant_tables
       JOIN table_groups ON table_groups.id = restaurant_tables.group_id
        AND table_groups.business_id = restaurant_tables.business_id
       JOIN businesses ON businesses.id = restaurant_tables.business_id
       JOIN branches branch ON branch.id=restaurant_tables.branch_id AND branch.business_id=businesses.id
       WHERE businesses.slug = ? AND businesses.is_active = 1
        AND restaurant_tables.public_token = ?
        AND (? IS NULL OR restaurant_tables.id = ?)
        AND branch.is_active=1 AND ((? IS NULL AND branch.is_default=1) OR branch.slug=?)
        AND restaurant_tables.is_active = 1 AND table_groups.is_active = 1`
    ).bind(tableContextMatch[1], tableContextMatch[2], tableId, tableId, branchSlug, branchSlug).first();
    return context ? json3(context, 200, { "cache-control": "no-store" }) : json3({ error: "Table is unavailable" }, 404);
  }
  const analyticsEventMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/analytics\/events$/
  );
  if (request.method === "POST" && analyticsEventMatch) {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 32768)
      return json3({ error: "Analytics batch is too large" }, 413);
    const body = await readJson(request);
    const sessionId = String(body.sessionId ?? "");
    const rawEvents = Array.isArray(body.events) ? body.events : [];
    if (!UUID_PATTERN.test(sessionId) || !rawEvents.length || rawEvents.length > 25)
      return json3({ error: "Invalid analytics batch" }, 400);
    const business2 = await env.DB.prepare(
      `SELECT id,timezone FROM businesses WHERE slug=? AND is_active=1`
    ).bind(analyticsEventMatch[1]).first();
    if (!business2) return json3({ error: "Menu not found" }, 404);
    const branch2 = await findBranch(env.DB, business2.id, typeof body.branch === "string" ? body.branch : null);
    if (!branch2?.isActive) return json3({ error: "Branch is unavailable" }, 404);
    const tableToken = String(body.tableToken ?? "");
    let tableId = "";
    if (tableToken) {
      if (!RECORD_ID_PATTERN.test(tableToken))
        return json3({ error: "Invalid table context" }, 400);
      const table = await env.DB.prepare(
        `SELECT tables.id FROM restaurant_tables tables
         JOIN table_groups groups ON groups.id=tables.group_id
          AND groups.business_id=tables.business_id
         WHERE tables.business_id=? AND tables.public_token=?
          AND tables.branch_id=?
          AND tables.is_active=1 AND groups.is_active=1`
      ).bind(business2.id, tableToken, branch2.id).first();
      if (!table) return json3({ error: "Table is unavailable" }, 400);
      tableId = table.id;
    }
    const [products, categories, banners] = await env.DB.batch([
      env.DB.prepare(
        "SELECT id,COALESCE(name_km,name) AS label FROM products WHERE business_id=?"
      ).bind(business2.id),
      env.DB.prepare(
        "SELECT id,COALESCE(name_km,name) AS label FROM categories WHERE business_id=?"
      ).bind(business2.id),
      env.DB.prepare(
        "SELECT id,title AS label FROM banners WHERE business_id=?"
      ).bind(business2.id)
    ]);
    const labels = /* @__PURE__ */ __name((rows) => new Map(
      rows.results.map((row) => [
        String(row.id),
        String(row.label || "")
      ])
    ), "labels");
    const productLabels = labels(products);
    const categoryLabels = labels(categories);
    const bannerLabels = labels(banners);
    const local = analyticsLocalNow(business2.timezone || "UTC");
    const statements = [];
    for (const value of rawEvents) {
      const event = value ?? {};
      const eventId = String(event.id ?? "");
      const eventType = String(event.type ?? "");
      const language = ANALYTICS_LANGUAGES.has(String(event.language)) ? String(event.language) : "km";
      if (!UUID_PATTERN.test(eventId) || !ANALYTICS_EVENT_TYPES.has(eventType))
        return json3({ error: "Invalid analytics event" }, 400);
      const productId = String(event.productId ?? "");
      const categoryId = String(event.categoryId ?? "");
      const bannerId = String(event.bannerId ?? "");
      if (productId && !productLabels.has(productId))
        return json3({ error: "Analytics product was not found" }, 400);
      if (categoryId && !categoryLabels.has(categoryId))
        return json3({ error: "Analytics category was not found" }, 400);
      if (bannerId && !bannerLabels.has(bannerId))
        return json3({ error: "Analytics banner was not found" }, 400);
      const searchTerm = eventType === "search" ? normalizeSearchTerm(event.searchTerm) : "";
      if (eventType === "search" && searchTerm.length < 2)
        return json3({ error: "Search phrase is too short" }, 400);
      const resultCount = eventType === "search" ? Math.max(
        0,
        Math.min(1e5, Math.floor(Number(event.resultCount) || 0))
      ) : null;
      const actionKind = eventType === "contact_click" && ANALYTICS_ACTIONS.has(String(event.actionKind)) ? String(event.actionKind) : "";
      if (eventType === "contact_click" && !actionKind)
        return json3({ error: "Invalid contact action" }, 400);
      const entityLabel = productLabels.get(productId) || categoryLabels.get(categoryId) || bannerLabels.get(bannerId) || "";
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO analytics_events
           (id,business_id,session_id,event_type,table_id,branch_id,product_id,category_id,
            banner_id,entity_label,language,search_term,search_result_count,
            action_kind,source_type,local_date,local_hour)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          eventId,
          business2.id,
          sessionId,
          eventType,
          tableId || null,
          branch2.id,
          productId || null,
          categoryId || null,
          bannerId || null,
          entityLabel,
          language,
          searchTerm,
          resultCount,
          actionKind,
          tableId ? "table" : "general",
          local.localDate,
          local.localHour
        )
      );
    }
    await env.DB.batch(statements);
    return json3({ accepted: statements.length }, 202, {
      "cache-control": "no-store"
    });
  }
  const publicMediaMatch = path.match(/^\/media\/([a-zA-Z0-9_-]+)$/);
  if (request.method === "GET" && publicMediaMatch) {
    const item = await env.DB.prepare(
      `SELECT m.object_key AS objectKey, m.content_type AS contentType
       FROM media m
       JOIN businesses b ON b.id = m.business_id
       WHERE m.id = ? AND b.is_active = 1`
    ).bind(publicMediaMatch[1]).first();
    if (!item) return json3({ error: "Media not found" }, 404);
    const object3 = await env.MEDIA.get(item.objectKey);
    return object3 ? new Response(object3.body, {
      headers: {
        "content-type": item.contentType,
        "cache-control": "public, max-age=86400",
        etag: object3.httpEtag
      }
    }) : json3({ error: "Media not found" }, 404);
  }
  if (request.method === "GET" && path === "/api/public/subscription-plans")
    return json3({ plans: await publicPlans(env.DB) }, 200, { "cache-control": "no-store" });
  if (request.method === "POST" && path === "/api/auth/register") {
    const body = await readJson(request);
    const email = String(body.email ?? "").toLowerCase().trim();
    const passwordProof = String(body.passwordProof ?? "").toLowerCase();
    const authVersion = String(body.authVersion ?? "");
    const businessName = String(body.businessName ?? "").trim();
    const displayName = String(body.displayName ?? "").trim();
    const businessSlug = String(body.slug ?? "");
    if (!email.includes("@") || authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(passwordProof) || businessName.length < 2)
      return json3({ error: "Please provide valid registration details" }, 400);
    if (businessSlug.length < 3 || businessSlug.length > 48 || !BUSINESS_SLUG_PATTERN.test(businessSlug))
      return json3(
        {
          code: "INVALID_MENU_SLUG",
          error: "Menu link must be 3-48 lowercase letters, numbers, or single hyphens"
        },
        400
      );
    if (!authConfigured(env))
      return json3({ error: "Authentication is not configured" }, 503);
    const [existingUser, existingBusiness] = await Promise.all([
      env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first(),
      businessSlugOwner(env.DB, businessSlug)
    ]);
    if (existingUser)
      return json3(
        { code: "EMAIL_IN_USE", error: "Email is already in use" },
        409
      );
    if (existingBusiness)
      return json3(
        {
          code: "MENU_SLUG_IN_USE",
          error: "Menu link is already in use"
        },
        409
      );
    const plan = await registrationPlan(env.DB, body, true);
    if (!plan) return json3({ code: "PLAN_UNAVAILABLE", error: "Choose a currently offered plan" }, 409);
    let created;
    try {
      created = await provisionBusiness(env, {
        email,
        displayName,
        businessName,
        businessSlug,
        passwordProof,
        plan,
        publicSignup: true
      });
    } catch (error3) {
      if (planChangedDuringSignup(error3))
        return json3({ code: "PLAN_UNAVAILABLE", error: "Choose a currently offered plan" }, 409);
      if (businessSlugConflict(error3))
        return json3({ code: "MENU_SLUG_IN_USE", error: "Menu link is already in use" }, 409);
      return json3(
        {
          code: "REGISTRATION_CONFLICT",
          error: "Email or menu link is already in use"
        },
        409
      );
    }
    const session = await createSession(created.user.id, env);
    return json3(
      {
        user: created.user,
        business: created.business,
        token: session.token
      },
      201,
      {
        "set-cookie": `mf_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
      }
    );
  }
  if (request.method === "POST" && path === "/api/auth/recovery-reset") {
    const resetKey = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!env.PASSWORD_RESET_KEY || !resetKey || !safeEqual(resetKey, env.PASSWORD_RESET_KEY))
      return json3({ error: "Recovery is not available" }, 404);
    if (!authConfigured(env))
      return json3({ error: "Authentication is not configured" }, 503);
    const body = await readJson(request);
    const email = String(body.email ?? "").toLowerCase().trim();
    const newEmail = String(body.newEmail ?? email).toLowerCase().trim();
    const passwordProof = String(body.passwordProof ?? "").toLowerCase();
    const authVersion = String(body.authVersion ?? "");
    if (!email.includes("@") || !newEmail.includes("@") || authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(passwordProof))
      return json3({ error: "Invalid recovery details" }, 400);
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (!user) return json3({ error: "Account not found" }, 404);
    if (newEmail !== email) {
      const duplicate = await env.DB.prepare(
        "SELECT id FROM users WHERE email=? AND id<>?"
      ).bind(newEmail, user.id).first();
      if (duplicate) return json3({ error: "New email is already in use" }, 409);
    }
    const passwordData = await credentialHash(passwordProof, env.AUTH_PEPPER);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET email=?, password_hash=?, password_salt=? WHERE id=?"
      ).bind(newEmail, passwordData.hash, passwordData.salt, user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id)
    ]);
    return json3({ ok: true });
  }
  if (request.method === "POST" && path === "/api/auth/login") {
    const body = await readJson(request);
    const email = String(body.email ?? "").toLowerCase().trim();
    const passwordProof = String(body.passwordProof ?? "").toLowerCase();
    const authVersion = String(body.authVersion ?? "");
    if (authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(passwordProof))
      return json3({ error: "Invalid email or password" }, 401);
    if (!authConfigured(env))
      return json3({ error: "Authentication is not configured" }, 503);
    const result = await verifyAccount(env, email, passwordProof);
    if (result.status === "reset_required")
      return json3({ error: "This account requires a password reset" }, 409);
    if (result.status !== "verified")
      return json3({ error: "Invalid email or password" }, 401);
    const user = result.account;
    const session = await createSession(user.id, env);
    return json3(
      {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        token: session.token
      },
      200,
      {
        "set-cookie": `mf_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
      }
    );
  }
  const auth = await sessionFrom(request, env);
  if (!auth) return json3(isPosAdminPath(path) ? { error: "Authentication required", code: "AUTHENTICATION_REQUIRED" } : { error: "Authentication required" }, 401);
  if (request.method === "POST" && path === "/api/auth/logout") {
    const token = sessionTokenFrom(request);
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
    }
    return json3({ ok: true }, 200, {
      "set-cookie": "mf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    });
  }
  if (request.method === "POST" && path === "/api/auth/change-password") {
    const body = await readJson(request);
    const authVersion = String(body.authVersion ?? "");
    const currentPasswordProof = String(
      body.currentPasswordProof ?? ""
    ).toLowerCase();
    const newPasswordProof = String(body.newPasswordProof ?? "").toLowerCase();
    if (authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(currentPasswordProof) || !PASSWORD_PROOF_PATTERN.test(newPasswordProof) || currentPasswordProof === newPasswordProof) {
      return json3({ error: "Please provide valid password details" }, 400);
    }
    if (!authConfigured(env))
      return json3({ error: "Authentication is not configured" }, 503);
    const user = await env.DB.prepare(
      `SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt
       FROM users WHERE id = ?`
    ).bind(auth.userId).first();
    if (!user) return json3({ error: "Account not found" }, 404);
    if (!user.passwordSalt.startsWith(`${AUTH_SCHEME}$`)) {
      return json3({ error: "This account requires a password reset" }, 409);
    }
    const currentCredential = await credentialHash(
      currentPasswordProof,
      env.AUTH_PEPPER,
      user.passwordSalt
    );
    if (!safeEqual(currentCredential.hash, user.passwordHash)) {
      return json3({ error: "Current password is incorrect" }, 400);
    }
    const nextCredential = await credentialHash(
      newPasswordProof,
      env.AUTH_PEPPER
    );
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?"
      ).bind(nextCredential.hash, nextCredential.salt, auth.userId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(
        auth.userId
      )
    ]);
    const session = await createSession(auth.userId, env);
    return json3({ ok: true, token: session.token }, 200, {
      "set-cookie": `mf_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    });
  }
  const disabledControlPages = new Set(
    jsonArray(auth.disabledControlPagesJson)
  );
  if (auth.subscriptionFeaturesJson !== null) {
    const included = new Set(planFeatures(auth.subscriptionFeaturesJson));
    for (const page of controlPageIds)
      if (!sellingControlPages.includes(page) && !included.has(page)) disabledControlPages.add(page);
  }
  const canViewBusinessActivity = auth.role === "owner" || auth.role === "manager";
  const canAccessSelling = canViewBusinessActivity && auth.sessionType === "customer" && Boolean(auth.posEnabled);
  const workspaceAccessPath = ["/api/admin/workspace", "/api/admin/workspace-access", "/api/admin/overview"].includes(path);
  const bookingPath = path === "/api/admin/bookings" || path.startsWith("/api/admin/bookings/");
  const bookingAccess = bookingPath || workspaceAccessPath ? await bookingWorkspaceAccess(env.DB, auth) : { visible: false, canManage: false };
  if (bookingPath) return adminBookings(request, url, env, path, auth.businessId, bookingAccess, execution);
  const telegramPath = path === "/api/admin/telegram-notifications" || path.startsWith("/api/admin/telegram-notifications/");
  const telegramAccess = (telegramPath || workspaceAccessPath) && await canManageTelegramNotifications(env.DB, auth);
  if (telegramPath) return telegramAccess ? adminTelegramNotifications(request, env, path, auth.businessId) : json3({ error: "Telegram notifications are unavailable for this account or plan" }, 403);
  const accessibleControlPages = controlPageIds.filter(
    (page) => page === "users" ? auth.role === "owner" && auth.sessionType === "customer" : page === "bookings" ? bookingAccess.visible : page === "telegramNotifications" ? telegramAccess : sellingControlPages.includes(page) ? canAccessSelling && !disabledControlPages.has(page) : !disabledControlPages.has(page) && (page !== "orders" && page !== "reports" || canViewBusinessActivity)
  );
  if (request.method === "GET" && path === "/api/admin/workspace-access")
    return json3({ accessibleControlPages });
  if (path.startsWith("/api/admin/")) {
    const requiredPages = controlPagesForResource(path, request.method);
    if (requiredPages?.every((page) => disabledControlPages.has(page)))
      return json3(
        {
          code: "CONTROL_PAGE_DISABLED",
          error: "This page is disabled for your business"
        },
        403
      );
  }
  const subscription = subscriptionSummary(auth, auth.timezone);
  if (path.startsWith("/api/admin/") && !["GET", "HEAD"].includes(request.method) && subscription.readOnly && auth.sessionType !== "support") {
    return json3(
      {
        code: "SUBSCRIPTION_EXPIRED",
        error: "Your subscription has expired. This workspace is available in read-only mode.",
        subscription
      },
      402
    );
  }
  if (path === "/api/admin/users" || path.startsWith("/api/admin/users/"))
    return adminUsers(request, url, env.DB, auth, (proof) => credentialHash(proof, env.AUTH_PEPPER));
  if (path === "/api/admin/integrations/pos")
    return handlePosIntegration(request, env, auth);
  if (isPosAdminPath(path))
    return handlePosSetup(
      request,
      url,
      env.DB,
      auth,
      path.slice(posAdminPath.length),
      () => localDateKey(/* @__PURE__ */ new Date(), auth.timezone || "UTC")
    );
  if (request.method === "GET" && path === "/api/admin/branches") {
    const { results } = await listBranches(env.DB, auth.businessId);
    return json3({ branches: results.map(({ id: id2, slug: slug2, name, isDefault, isActive }) => ({ id: id2, slug: slug2, name, isDefault, isActive })) });
  }
  if (request.method === "GET" && path === "/api/admin/menus") {
    const menus = env.DB.prepare(`SELECT m.id,m.slug,m.parent_id AS parentId,
      m.name_km AS nameKm,m.name_en AS nameEn,m.name_zh AS nameZh,m.source,m.is_active AS isActive,
      m.sort_order AS sortOrder,m.image_media_id AS imageMediaId,m.image_url AS imageUrl,photo.object_key AS objectKey
      FROM menus m LEFT JOIN media photo ON photo.id=m.image_media_id AND photo.business_id=m.business_id
      WHERE m.business_id=? AND m.deleted_in_admin=0
      ORDER BY m.sort_order,COALESCE(NULLIF(m.name_km,''),NULLIF(m.name_en,''),m.name_zh),m.id`).bind(auth.businessId);
    const categories = url.searchParams.get("includeCategories") === "1" && !disabledControlPages.has("menus") ? env.DB.prepare(`SELECT id,parent_id AS parentId,name,name_km AS nameKm,
          name_en AS nameEn,name_zh AS nameZh
          FROM categories WHERE business_id=? ORDER BY sort_order,name,id`).bind(auth.businessId) : null;
    const [menuResult, categoryResult] = await env.DB.batch(categories ? [menus, categories] : [menus]);
    return json3({
      menus: menuResult.results.map(({ objectKey, ...menu }) => ({ ...menu, imageUrl: mediaUrl(
        env,
        objectKey,
        String(menu.imageUrl ?? (menu.imageMediaId ? `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${menu.imageMediaId}` : ""))
      ) })),
      ...categoryResult ? { categories: categoryResult.results } : {}
    });
  }
  const menuProductsMatch = path.match(/^\/api\/admin\/menus\/([a-zA-Z0-9_-]+)\/products(?:\/(order))?$/);
  if (menuProductsMatch)
    return adminMenuProducts(request, url, env, auth.businessId, menuProductsMatch[1], Boolean(menuProductsMatch[2]));
  if (request.method === "POST" && path === "/api/admin/menus/assign-product") {
    const body = await readJson(request).catch(() => null);
    const productId = body?.productId;
    const menuIds = body?.menuIds;
    if (typeof productId !== "string" || !RECORD_ID_PATTERN.test(productId) || !Array.isArray(menuIds) || !menuIds.length || menuIds.length > 1e3 || menuIds.some((id2) => typeof id2 !== "string" || !RECORD_ID_PATTERN.test(id2))) {
      return json3({ error: "Choose a product and the menus to assign it to" }, 400);
    }
    const ids = [...new Set(menuIds)];
    const businessId = auth.businessId;
    const encoded = JSON.stringify(ids);
    const [, , assigned] = await env.DB.batch([
      env.DB.prepare(`WITH targets AS (
        SELECT id FROM menus
        WHERE business_id=?1 AND source='local' AND parent_id IS NOT NULL
          AND id IN (SELECT value FROM json_each(?2))
      )
      INSERT INTO menu_products (business_id, menu_id, product_id)
      SELECT ?1, id, ?3 FROM targets
      WHERE (SELECT COUNT(*) FROM targets)=?4
        AND EXISTS (SELECT 1 FROM products WHERE business_id=?1 AND id=?3)
      ON CONFLICT (business_id,menu_id,product_id) DO NOTHING`).bind(businessId, encoded, productId, ids.length),
      publicMenuVersionStatement(env.DB, businessId, true),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM menu_products placement
        JOIN menus menu ON menu.business_id=placement.business_id AND menu.id=placement.menu_id
        WHERE placement.business_id=? AND placement.product_id=?
          AND menu.source='local' AND menu.parent_id IS NOT NULL
          AND menu.id IN (SELECT value FROM json_each(?))`).bind(businessId, productId, encoded)
    ]);
    if (assigned.results[0]?.total !== ids.length)
      return json3({ error: "Choose an existing product and local submenus from this business" }, 400);
    return json3({ ok: true });
  }
  if (request.method === "PUT" && path === "/api/admin/menus/tree-order") {
    const body = await readJson(request).catch(() => null);
    const before = menuPlacements(body?.before);
    const updates = menuPlacements(body?.updates);
    if (!before || !updates) return json3({ error: "Choose valid menus to reorder" }, 400);
    const parents = new Map(before.map(({ id: id2, parentId }) => [id2, parentId]));
    for (const { id: id2, parentId } of updates) {
      const previousParentId = parents.get(id2);
      if (previousParentId === void 0 || previousParentId === null !== (parentId === null) || parentId !== null && !parents.has(parentId))
        return json3({ error: "Choose a valid parent menu. Top-level menus must stay at the top level." }, 400);
      parents.set(id2, parentId);
    }
    for (const id2 of parents.keys()) {
      const ancestors = /* @__PURE__ */ new Set();
      let current = id2;
      while (current !== null && parents.has(current)) {
        if (ancestors.has(current)) return json3({ error: "A menu cannot be moved under itself or its submenus" }, 400);
        if (ancestors.size === 32) return json3({ error: "Menus can be nested up to 32 levels" }, 400);
        ancestors.add(current);
        current = parents.get(current) ?? null;
      }
    }
    const businessId = auth.businessId;
    const db = env.DB;
    const [saved] = await db.batch([
      db.prepare(`WITH expected AS (
          SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.parentId') AS parent_id,
            json_extract(value,'$.sortOrder') AS sort_order FROM json_each(?1)
        ), requested AS (
          SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.parentId') AS parent_id,
            json_extract(value,'$.sortOrder') AS sort_order FROM json_each(?2)
        ), unchanged AS MATERIALIZED (
          SELECT 1
          WHERE (SELECT COUNT(*) FROM menus WHERE business_id=?3 AND deleted_in_admin=0)=json_array_length(?1)
            AND NOT EXISTS (
              SELECT 1 FROM expected LEFT JOIN menus current
                ON current.id=expected.id AND current.business_id=?3 AND current.deleted_in_admin=0
              WHERE current.id IS NULL OR current.parent_id IS NOT expected.parent_id
                OR current.sort_order IS NOT expected.sort_order
            )
        )
        UPDATE menus SET
          pos_parent_id=CASE WHEN menus.source='pos' AND menus.admin_reparented=0
            AND menus.parent_id IS NOT requested.parent_id THEN menus.parent_id ELSE menus.pos_parent_id END,
          admin_reparented=CASE WHEN menus.source='pos' AND menus.parent_id IS NOT requested.parent_id
            THEN 1 ELSE menus.admin_reparented END,
          admin_sorted=CASE WHEN menus.source='pos' THEN 1 ELSE menus.admin_sorted END,
          parent_id=requested.parent_id, sort_order=requested.sort_order
        FROM requested
        WHERE menus.id=requested.id AND menus.business_id=?3 AND menus.deleted_in_admin=0
          AND EXISTS (SELECT 1 FROM unchanged)`).bind(JSON.stringify(before), JSON.stringify(updates), businessId),
      publicMenuVersionStatement(db, businessId, true),
      db.prepare("UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0").bind(businessId)
    ]);
    if (saved.meta.changes !== updates.length)
      return json3({ error: "The menu tree changed. Close and reopen Sort Order to try again." }, 409);
    return json3({ ok: true });
  }
  if (request.method === "PUT" && path === "/api/admin/menus/reorder") {
    const body = await readJson(request).catch(() => null);
    const parentId = body?.parentId;
    const menuIds = body?.menuIds;
    const includePos = body?.includePos === true;
    const move = body?.move;
    const movedMenuId = move?.id ?? null;
    const fromParentId = move?.fromParentId ?? null;
    if (parentId !== null && (typeof parentId !== "string" || !RECORD_ID_PATTERN.test(parentId)) || !Array.isArray(menuIds) || menuIds.length < (move === void 0 ? 2 : 1) || menuIds.length > 1e4 || menuIds.some((id2) => typeof id2 !== "string" || !RECORD_ID_PATTERN.test(id2)) || new Set(menuIds).size !== menuIds.length) {
      return json3({ error: "Choose sibling menus to reorder" }, 400);
    }
    if (move !== void 0 && (includePos || !parentId || typeof movedMenuId !== "string" || !menuIds.includes(movedMenuId) || typeof fromParentId !== "string" || !RECORD_ID_PATTERN.test(fromParentId) || fromParentId === parentId)) {
      return json3({ error: "Choose a submenu and a different parent menu" }, 400);
    }
    const businessId = auth.businessId;
    const [saved] = await env.DB.batch([
      env.DB.prepare(`WITH RECURSIVE requested(id, position) AS (
          SELECT value, key FROM json_each(?1)
        ), moving AS (
          SELECT id FROM menus
          WHERE business_id=?2 AND id=?5 AND parent_id=?6 AND source='local'
        ), ancestors(id, parent_id) AS (
          SELECT id, parent_id FROM menus
          WHERE business_id=?2 AND id=?3 AND source='local' AND ?5 IS NOT NULL
          UNION
          SELECT menu.id, menu.parent_id FROM menus menu
          JOIN ancestors ON menu.id=ancestors.parent_id
          WHERE menu.business_id=?2
        ), siblings AS (
          SELECT id FROM menus
          WHERE business_id=?2 AND deleted_in_admin=0 AND (?7=1 OR source='local')
            AND (parent_id IS ?3 OR id IN (SELECT id FROM moving))
        ), matched AS (
          SELECT requested.id, requested.position
          FROM requested JOIN siblings USING (id)
        )
        UPDATE menus SET parent_id=?3, sort_order=matched.position,
          admin_sorted=CASE WHEN ?7=1 AND menus.source='pos' THEN 1 ELSE menus.admin_sorted END
        FROM matched
        WHERE menus.id=matched.id AND menus.business_id=?2
          AND (SELECT COUNT(*) FROM matched)=?4
          AND (SELECT COUNT(*) FROM siblings)=?4
          AND (?3 IS NULL OR EXISTS (SELECT 1 FROM menus parent
            WHERE parent.id=?3 AND parent.business_id=?2 AND parent.deleted_in_admin=0))
          AND (?5 IS NULL OR (
            EXISTS (SELECT 1 FROM moving)
            AND EXISTS (SELECT 1 FROM ancestors WHERE id=?3)
            AND NOT EXISTS (SELECT 1 FROM ancestors WHERE id=?5)
          ))`).bind(JSON.stringify(menuIds), businessId, parentId, menuIds.length, movedMenuId, fromParentId, Number(includePos)),
      publicMenuVersionStatement(env.DB, businessId, true),
      // Reject any in-flight POS snapshot that read the previous order.
      ...includePos || move ? [env.DB.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0"
      ).bind(businessId)] : []
    ]);
    if (saved.meta.changes !== menuIds.length)
      return json3({
        error: move ? "The submenu could not be moved. Choose a local parent outside its branch and try again." : "The editable menus at this level changed. Refresh and try again."
      }, 409);
    return json3({ ok: true });
  }
  const menuEditMatch = path.match(/^\/api\/admin\/menus(?:\/([a-zA-Z0-9_-]+))?$/);
  if (request.method === "DELETE" && menuEditMatch?.[1]) {
    const businessId = auth.businessId;
    const menuId = menuEditMatch[1];
    const includeSubmenus = url.searchParams.get("includeSubmenus") === "1";
    const db = env.DB;
    const menu = await db.prepare("SELECT id FROM menus WHERE business_id=? AND id=? AND deleted_in_admin=0").bind(businessId, menuId).first();
    if (!menu) return json3({ error: "Menu not found" }, 404);
    const eligible = `WITH RECURSIVE subtree(id, source, deleted_in_admin) AS (
      SELECT id, source, deleted_in_admin FROM menus
      WHERE business_id=?1 AND id=?2 AND deleted_in_admin=0
      UNION
      SELECT child.id, child.source, child.deleted_in_admin FROM menus child
      JOIN subtree ON child.parent_id=subtree.id
      WHERE child.business_id=?1
    ), eligible AS (
      SELECT id, source FROM subtree
      WHERE ?3=1 OR NOT EXISTS (SELECT 1 FROM subtree WHERE id<>?2 AND deleted_in_admin=0)
    )`;
    const scope = [businessId, menuId, Number(includeSubmenus)];
    const [, , , removed] = await db.batch([
      db.prepare(`${eligible}
        UPDATE businesses SET menu_cache_version=menu_cache_version+1, updated_at=CURRENT_TIMESTAMP
        WHERE id=?1 AND EXISTS (SELECT 1 FROM eligible)`).bind(...scope),
      db.prepare(`${eligible}
        UPDATE pos_integrations SET catalog_version=catalog_version+1
        WHERE business_id=?1 AND EXISTS (SELECT 1 FROM eligible WHERE source='pos')`).bind(...scope),
      db.prepare(`${eligible}
        UPDATE orders SET menu_id=NULL
        WHERE business_id=?1 AND menu_id IN (SELECT id FROM eligible)`).bind(...scope),
      db.prepare(`${eligible}
        DELETE FROM menus
        WHERE business_id=?1 AND id IN (SELECT id FROM eligible) RETURNING id`).bind(...scope)
    ]);
    const deleted = removed.results;
    if (!deleted.length)
      return json3({ error: "The menu or its submenus changed. Reopen the delete confirmation and try again." }, 409);
    return json3({ deletedIds: deleted.map(({ id: id2 }) => id2) });
  }
  if (menuEditMatch && (request.method === "POST" && !menuEditMatch[1] || request.method === "PUT" && menuEditMatch[1])) {
    const businessId = auth.businessId;
    const db = env.DB;
    const body = await readJson(request);
    const existingId = menuEditMatch[1];
    const existing = existingId ? await db.prepare(`SELECT parent_id AS parentId, source FROM menus
      WHERE id=? AND business_id=? AND deleted_in_admin=0`).bind(existingId, businessId).first() : null;
    if (existingId && !existing) return json3({ error: "Editable menu not found" }, 404);
    const menuId = existingId || id("mnu");
    const parentId = String(body.parentId || "") || null;
    const nameKm = String(body.nameKm ?? "").trim().slice(0, 160);
    const nameEn = String(body.nameEn ?? "").trim().slice(0, 160);
    const nameZh = String(body.nameZh ?? "").trim().slice(0, 160);
    const slug2 = String(body.slug || recordSlug((nameEn || nameKm || nameZh).slice(0, 65), "menu", menuId)).trim();
    const sortOrder2 = parseSortOrder(body.sortOrder);
    const imageMediaId = String(body.imageMediaId || "") || null;
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    if (!(nameKm || nameEn || nameZh) || sortOrder2 === null || !existingId && (slug2.length > 80 || !BUSINESS_SLUG_PATTERN.test(slug2)))
      return json3({ error: "Enter a menu name, a valid slug and a whole sort order" }, 400);
    if (existing && Boolean(existing.parentId) !== Boolean(parentId))
      return json3({ error: "A menu must remain a root or a submenu" }, 400);
    if (parentId && !await db.prepare("SELECT id FROM menus WHERE business_id=? AND id=? AND deleted_in_admin=0").bind(businessId, parentId).first()) return json3({ error: "Choose an available parent menu" }, 400);
    if (imageMediaId && !await db.prepare("SELECT id FROM media WHERE business_id=? AND id=?").bind(businessId, imageMediaId).first()) return json3({ error: "Menu photo not found" }, 400);
    if (existing?.source === "pos") {
      if (parentId !== existing.parentId)
        return json3({ error: "POS controls this menu's parent" }, 409);
      const [saved2] = await db.batch([
        db.prepare(`UPDATE menus SET name_km=?,name_en=?,name_zh=?,sort_order=?,image_media_id=?,
          image_url=CASE WHEN ? THEN image_url ELSE NULL END,is_active=?,admin_active=?
          WHERE business_id=? AND id=? AND parent_id IS ? AND source='pos' AND deleted_in_admin=0`).bind(
          nameKm,
          nameEn,
          nameZh,
          sortOrder2,
          imageMediaId,
          Number(body.imageMediaId === ""),
          isActive,
          isActive,
          businessId,
          menuId,
          parentId
        ),
        db.prepare("UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0").bind(businessId),
        publicMenuVersionStatement(db, businessId)
      ]);
      if (!saved2.meta.changes) return json3({ error: "The menu changed. Reopen it and try again." }, 409);
      return json3({ id: menuId });
    }
    const fields2 = [parentId, nameKm, nameEn, nameZh, sortOrder2, imageMediaId, isActive];
    const write = existingId ? db.prepare(`WITH RECURSIVE ancestors(id,parent_id) AS (
          SELECT id,parent_id FROM menus WHERE business_id=? AND id=?
          UNION SELECT m.id,m.parent_id FROM menus m JOIN ancestors a ON a.parent_id=m.id WHERE m.business_id=?
        ) UPDATE menus SET parent_id=?,name_km=?,name_en=?,name_zh=?,sort_order=?,image_media_id=?,is_active=?
        WHERE id=? AND business_id=? AND source='local' AND NOT EXISTS (SELECT 1 FROM ancestors WHERE id=?)
          AND (? IS NULL OR EXISTS (SELECT 1 FROM ancestors JOIN menus parent USING (id)
            WHERE parent.id=? AND parent.deleted_in_admin=0))`).bind(businessId, parentId, businessId, ...fields2, menuId, businessId, menuId, parentId, parentId) : db.prepare(`INSERT INTO menus (id,business_id,slug,parent_id,name_km,name_en,name_zh,sort_order,image_media_id,is_active)
        SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10
        WHERE ?4 IS NULL OR EXISTS (SELECT 1 FROM menus WHERE business_id=?2 AND id=?4 AND deleted_in_admin=0)
        ON CONFLICT (business_id,slug) DO NOTHING`).bind(menuId, businessId, slug2, ...fields2);
    const [saved] = await db.batch([
      write,
      publicMenuVersionStatement(db, businessId, true),
      ...existing && existing.parentId !== parentId ? [db.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0"
      ).bind(businessId)] : []
    ]);
    if (!saved.meta.changes) return json3({ error: existingId ? "Choose a parent outside this submenu" : "This menu slug is already in use" }, 409);
    return json3({ id: menuId }, existingId ? 200 : 201);
  }
  if (request.method === "GET" && path === "/api/admin/orders/filters/options") {
    if (!canViewBusinessActivity)
      return json3({ error: "Owner or manager access is required" }, 403);
    const [branches, tables2] = await Promise.all([
      listBranches(env.DB, auth.businessId),
      env.DB.prepare(
        `SELECT t.id, t.branch_id AS branchId, t.code, t.label, g.name AS groupName
         FROM restaurant_tables t
         JOIN table_groups g ON g.id=t.group_id AND g.business_id=t.business_id
         WHERE t.business_id=?
         ORDER BY g.sort_order, t.sort_order, t.code, t.id`
      ).bind(auth.businessId).all()
    ]);
    return json3({
      branches: branches.results.map(({ id: id2, name }) => ({ id: id2, name })),
      tables: tables2.results
    });
  }
  const adminOrderMatch = path.match(
    /^\/api\/admin\/orders(?:\/([a-zA-Z0-9_-]+))?$/
  );
  if (adminOrderMatch && (request.method === "GET" || request.method === "PATCH" && adminOrderMatch[1])) {
    if (!canViewBusinessActivity)
      return json3({ error: "Owner or manager access is required" }, 403);
    const orderId = adminOrderMatch[1];
    if (request.method === "PATCH") {
      const { status: status2 } = await readJson(request).catch(() => null) ?? {};
      if (!isOrderStatusUpdate(status2))
        return json3({ error: "Invalid order status" }, 400);
      const order = await updateOrderStatus(
        env.DB,
        auth.businessId,
        orderId,
        status2
      );
      if (!order) return json3({ error: "Order not found" }, 404);
      if (order.changed) scheduleBranchWebhooks(env, execution, auth.businessId);
      if (order.status !== status2)
        return json3(
          {
            code: "order_status_conflict",
            error: "This order can no longer be changed to that status"
          },
          409
        );
      return json3({ status: order.status });
    }
    const summarySql = /* @__PURE__ */ __name((details = false) => `SELECT o.id, o.order_number AS orderNumber, o.status, o.posting_date AS postingDate,
        o.total_quantity AS totalQuantity, o.total_amount AS totalAmount, o.currency,
        t.code AS tableCode, t.label AS tableLabel, g.name AS groupName,
        o.branch_id AS branchId, branch.name AS branchName, o.menu_id AS menuId${details ? ", o.note" : ""}
      FROM orders o
      JOIN restaurant_tables t ON t.id=o.table_id AND t.business_id=o.business_id
      JOIN table_groups g ON g.id=t.group_id AND g.business_id=o.business_id
      JOIN branches branch ON branch.id=o.branch_id AND branch.business_id=o.business_id
      WHERE o.business_id=?`, "summarySql");
    if (orderId) {
      const [headers, lines] = await env.DB.batch([
        env.DB.prepare(`${summarySql(true)} AND o.id=?`).bind(
          auth.businessId,
          orderId
        ),
        env.DB.prepare(
          `SELECT line.line_number AS lineNumber, line.product_id AS productId,
            COALESCE(NULLIF(product.name_km,''),product.name) AS name,
            product.name_en AS nameEn, line.quantity, line.price, line.status,
            line.portion_name AS portionName, line.price_list AS priceList,
            price_list.name AS priceListName, line.modifiers,
            line.total_amount AS totalAmount, line.note
          FROM order_products line
          JOIN orders o ON o.id=line.order_id
          LEFT JOIN products product ON product.id=line.product_id AND product.business_id=o.business_id
          LEFT JOIN price_lists price_list ON price_list.id=line.price_list AND price_list.business_id=o.business_id
          WHERE o.business_id=? AND o.id=?
          ORDER BY line.line_number`
        ).bind(auth.businessId, orderId)
      ]);
      const order = headers.results[0];
      if (!order) return json3({ error: "Order not found" }, 404);
      return json3({
        order,
        products: lines.results.map((line) => ({
          ...line,
          modifiers: jsonArray(line.modifiers)
        }))
      });
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1e6)
      return json3({ error: "Invalid page number" }, 400);
    const pageSize = 25;
    const status = url.searchParams.get("status") || "";
    if (status && !isOrderStatus(status))
      return json3({ error: "Invalid order status filter" }, 400);
    const branchId = url.searchParams.get("branchId") || "";
    const tableId = url.searchParams.get("tableId") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    if (from && !parseLocalDate(from) || to && !parseLocalDate(to) || from && to && from > to)
      return json3({ error: "Invalid order date range" }, 400);
    const filters = [];
    const bindings = [auth.businessId];
    if (branchId) {
      filters.push(" AND o.branch_id=?");
      bindings.push(branchId);
    }
    if (status) {
      filters.push(" AND o.status=?");
      bindings.push(status);
    }
    if (tableId) {
      filters.push(" AND o.table_id=?");
      bindings.push(tableId);
    }
    if (from) {
      filters.push(" AND o.posting_date>=?");
      bindings.push(from);
    }
    if (to) {
      filters.push(" AND o.posting_date<=?");
      bindings.push(to);
    }
    const { results } = await env.DB.prepare(
      `${summarySql()}${filters.join("")} ORDER BY o.posting_date DESC, o.rowid DESC LIMIT ? OFFSET ?`
    ).bind(...bindings, pageSize + 1, (page - 1) * pageSize).all();
    return json3({
      orders: results.slice(0, pageSize),
      hasMore: results.length > pageSize
    });
  }
  if (request.method === "GET" && (path === "/api/admin/reports/menu-analytics" || path === "/api/admin/reports/menu-analytics.csv")) {
    if (!(/* @__PURE__ */ new Set(["owner", "manager"])).has(auth.role))
      return json3({ error: "Owner or manager access is required" }, 403);
    const today = localDateKey(/* @__PURE__ */ new Date(), auth.timezone || "UTC");
    const from = url.searchParams.get("from") || shiftDate(today, -29);
    const to = url.searchParams.get("to") || today;
    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);
    if (!fromDate || !toDate || fromDate > toDate)
      return json3({ error: "Invalid report date range" }, 400);
    const duration = Math.floor((toDate.getTime() - fromDate.getTime()) / 864e5) + 1;
    if (duration > 397)
      return json3({ error: "Reports are limited to 13 months" }, 400);
    const language = String(url.searchParams.get("language") || "");
    const tableId = String(url.searchParams.get("tableId") || "");
    const groupId = String(url.searchParams.get("groupId") || "");
    const branchId = String(url.searchParams.get("branchId") || "");
    if (language && !ANALYTICS_LANGUAGES.has(language))
      return json3({ error: "Invalid report language" }, 400);
    if (tableId && !RECORD_ID_PATTERN.test(tableId) || groupId && !RECORD_ID_PATTERN.test(groupId) || branchId && !RECORD_ID_PATTERN.test(branchId))
      return json3({ error: "Invalid report filter" }, 400);
    const report = await analyticsReport(env, auth.businessId, {
      from,
      to,
      previousFrom: shiftDate(from, -duration),
      previousTo: shiftDate(from, -1),
      language,
      tableId,
      groupId,
      branchId
    });
    if (path.endsWith(".csv")) {
      const dataset = String(url.searchParams.get("dataset") || "daily");
      const datasets = {
        daily: report.daily,
        hourly: report.hourly,
        products: report.products,
        categories: report.categories,
        tables: report.tables,
        searches: report.searches,
        promotions: report.promotions,
        actions: report.actions,
        languages: report.languages,
        sources: report.sources
      };
      if (!Object.hasOwn(datasets, dataset))
        return json3({ error: "Unknown export dataset" }, 400);
      return csvResponse(
        datasets[dataset],
        `menu-analytics-${dataset}-${from}-to-${to}.csv`
      );
    }
    return json3(report);
  }
  if (request.method === "GET" && (path === "/api/admin/workspace" || path === "/api/admin/overview")) {
    const business2 = await env.DB.prepare(
      `SELECT id, name, slug, tagline, description, logo_url AS logoUrl,
        logo_media_id AS logoMediaId, phone, address, currency,
        secondary_currency AS secondaryCurrency,
        secondary_exchange_rate AS secondaryExchangeRate,
        show_secondary_currency AS showSecondaryCurrency,
        enable_add_to_order AS enableAddToOrder, locale,
        business_hours_json AS businessHoursJson,
        contact_numbers_json AS contactNumbersJson, email,
        website_url AS websiteUrl, custom_menu_url AS customMenuUrl,
        social_links_json AS socialLinksJson,
        locations_json AS locationsJson,
        map_url AS mapUrl, map_label AS mapLabel,
        wifi_ssid AS wifiSsid, wifi_password AS wifiPassword,
        wifi_security AS wifiSecurity,
        show_header_location AS showHeaderLocation,
        show_header_phones AS showHeaderPhones,
        show_header_wifi AS showHeaderWifi,
        show_header_socials AS showHeaderSocials,
        show_header_tagline AS showHeaderTagline,
        show_business_hours AS showBusinessHours,
        theme_color AS themeColor, menu_theme_json AS menuThemeJson,
        enable_en AS enableEn, enable_zh AS enableZh,
        timezone, pricing_mode AS pricingMode, is_active AS isActive,
        default_price_list_id AS defaultPriceListId,
        first_qr_downloaded_at AS firstQrDownloadedAt
       FROM businesses WHERE id = ?`
    ).bind(auth.businessId).first();
    let firstQrDownloadedAt = null;
    if (business2) {
      firstQrDownloadedAt = business2.firstQrDownloadedAt ? String(business2.firstQrDownloadedAt) : null;
      delete business2.firstQrDownloadedAt;
      business2.businessHours = jsonArray(business2.businessHoursJson);
      business2.contactNumbers = jsonArray(business2.contactNumbersJson);
      business2.socialLinks = jsonArray(business2.socialLinksJson);
      business2.locations = jsonArray(business2.locationsJson);
      business2.enableAddToOrder = Boolean(business2.enableAddToOrder);
      business2.showHeaderLocation = Boolean(business2.showHeaderLocation);
      business2.showHeaderPhones = Boolean(business2.showHeaderPhones);
      business2.showHeaderWifi = Boolean(business2.showHeaderWifi);
      business2.showHeaderSocials = Boolean(business2.showHeaderSocials);
      business2.showHeaderTagline = Boolean(business2.showHeaderTagline);
      business2.showBusinessHours = Boolean(business2.showBusinessHours);
      business2.menuTheme = parseMenuTheme(
        business2.menuThemeJson,
        business2.themeColor,
        env
      );
      delete business2.businessHoursJson;
      delete business2.contactNumbersJson;
      delete business2.socialLinksJson;
      delete business2.locationsJson;
      delete business2.menuThemeJson;
      const pricing = await resolvePriceList(
        env,
        auth.businessId,
        business2.pricingMode,
        business2.defaultPriceListId,
        business2.timezone
      );
      business2.activePriceListId = pricing.activeId;
    }
    const user = await env.DB.prepare(
      `SELECT id, email, display_name AS displayName
       FROM users WHERE id = ?`
    ).bind(auth.userId).first();
    const [counts, catalogReadiness] = disabledControlPages.has("overview") ? [null, null] : await Promise.all([
      env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM products WHERE business_id = ?) AS products,
          (SELECT COUNT(*) FROM categories WHERE business_id = ?) AS categories,
          (SELECT COUNT(*) FROM banners WHERE business_id = ?) AS banners`
      ).bind(auth.businessId, auth.businessId, auth.businessId).first(),
      env.DB.prepare(
        `WITH RECURSIVE visible_category_ids(id) AS (
          SELECT id FROM categories
          WHERE business_id = ? AND is_active = 1 AND parent_id IS NULL
          UNION ALL
          SELECT child.id FROM categories child
          JOIN visible_category_ids parent ON child.parent_id = parent.id
          WHERE child.business_id = ? AND child.is_active = 1
        )
        SELECT COUNT(*) AS publishedProducts,
          SUM(CASE WHEN COALESCE(TRIM(product.image_url), '') = ''
            AND NOT EXISTS (
              SELECT 1 FROM product_images image
              WHERE image.business_id = product.business_id
                AND image.product_id = product.id
            ) THEN 1 ELSE 0 END) AS missingPhotoProducts
        FROM products product
        JOIN visible_category_ids visible ON visible.id = product.category_id
        WHERE product.business_id = ? AND product.is_available = 1`
      ).bind(auth.businessId, auth.businessId, auth.businessId).first()
    ]);
    return json3({
      business: business2,
      accessibleControlPages,
      counts,
      readiness: {
        firstQrDownloadedAt,
        publishedProducts: Number(catalogReadiness?.publishedProducts || 0),
        missingPhotoProducts: Number(
          catalogReadiness?.missingPhotoProducts || 0
        )
      },
      subscription,
      role: auth.role,
      user,
      supportSession: auth.sessionType === "support" ? {
        active: true,
        actorEmail: auth.actorEmail,
        expiresAt: auth.expiresAt
      } : null
    });
  }
  if (request.method === "POST" && path === "/api/admin/readiness/qr-download") {
    await env.DB.prepare(
      `UPDATE businesses
       SET first_qr_downloaded_at=COALESCE(first_qr_downloaded_at,CURRENT_TIMESTAMP)
       WHERE id=?`
    ).bind(auth.businessId).run();
    const readiness = await env.DB.prepare(
      `SELECT first_qr_downloaded_at AS firstQrDownloadedAt
       FROM businesses WHERE id=?`
    ).bind(auth.businessId).first();
    return json3({
      firstQrDownloadedAt: readiness?.firstQrDownloadedAt ?? null
    });
  }
  if (request.method === "PUT" && path === "/api/admin/business") {
    const body = await readJson(request);
    const currency = String(body.currency ?? "KHR").toUpperCase();
    if (currency !== "USD" && currency !== "KHR") {
      return json3({ error: "Currency must be USD or KHR" }, 400);
    }
    const currentPricing = await env.DB.prepare(
      `SELECT currency, timezone, pricing_mode AS pricingMode,
        default_price_list_id AS defaultPriceListId,
        secondary_currency AS secondaryCurrency,
        secondary_exchange_rate AS secondaryExchangeRate,
        show_secondary_currency AS showSecondaryCurrency,
        enable_add_to_order AS enableAddToOrder,
        locations_json AS locationsJson, map_url AS mapUrl,
        map_label AS mapLabel, address, wifi_ssid AS wifiSsid,
        wifi_password AS wifiPassword, wifi_security AS wifiSecurity,
        show_header_location AS showHeaderLocation,
        show_header_phones AS showHeaderPhones,
        show_header_wifi AS showHeaderWifi,
        show_header_socials AS showHeaderSocials,
        show_header_tagline AS showHeaderTagline,
        show_business_hours AS showBusinessHours
       FROM businesses WHERE id=?`
    ).bind(auth.businessId).first();
    const secondaryCurrencyWasSubmitted = body.secondaryCurrency != null;
    let secondaryCurrency = String(
      body.secondaryCurrency ?? currentPricing?.secondaryCurrency ?? (currency === "USD" ? "KHR" : "USD")
    ).toUpperCase();
    if (!secondaryCurrencyWasSubmitted && secondaryCurrency === currency) {
      secondaryCurrency = currency === "USD" ? "KHR" : "USD";
    }
    if (secondaryCurrency !== "USD" && secondaryCurrency !== "KHR") {
      return json3({ error: "Secondary currency must be USD or KHR" }, 400);
    }
    if (secondaryCurrency === currency) {
      return json3(
        { error: "Primary and secondary currencies must be different" },
        400
      );
    }
    let secondaryExchangeRate = Number(
      body.secondaryExchangeRate ?? currentPricing?.secondaryExchangeRate ?? (currency === "USD" ? 4e3 : 25e-5)
    );
    if (body.secondaryExchangeRate == null && currentPricing?.currency && currentPricing.currency !== currency && secondaryExchangeRate > 0) {
      secondaryExchangeRate = 1 / secondaryExchangeRate;
    }
    if (!Number.isFinite(secondaryExchangeRate) || secondaryExchangeRate <= 0 || secondaryExchangeRate > 1e9) {
      return json3({ error: "Enter a valid positive exchange rate" }, 400);
    }
    const showSecondaryCurrency = body.showSecondaryCurrency == null ? currentPricing?.showSecondaryCurrency ? 1 : 0 : body.showSecondaryCurrency ? 1 : 0;
    const enableAddToOrder = body.enableAddToOrder == null ? currentPricing?.enableAddToOrder ? 1 : 0 : body.enableAddToOrder ? 1 : 0;
    const shopInformation = businessShopInformation(body, currentPricing || {});
    if ("error" in shopInformation)
      return json3({ error: shopInformation.error }, 400);
    const timezone = String(
      body.timezone ?? currentPricing?.timezone ?? "Asia/Phnom_Penh"
    ).trim();
    const pricingMode = body.pricingMode === "manual" ? "manual" : "automatic";
    const defaultPriceListId = String(
      body.defaultPriceListId ?? currentPricing?.defaultPriceListId ?? ""
    );
    if (!validTimezone(timezone))
      return json3({ error: "Choose a valid IANA business timezone" }, 400);
    const defaultPriceList = await env.DB.prepare(
      `SELECT id FROM price_lists
       WHERE id=? AND business_id=? AND is_archived=0`
    ).bind(defaultPriceListId, auth.businessId).first();
    if (!defaultPriceList)
      return json3({ error: "Choose an active default price list" }, 400);
    const logoMediaId = String(body.logoMediaId ?? "");
    let logoObjectKey = "";
    if (logoMediaId) {
      const logo = await env.DB.prepare(
        "SELECT id, object_key AS objectKey FROM media WHERE id=? AND business_id=?"
      ).bind(logoMediaId, auth.businessId).first();
      if (!logo) return json3({ error: "Business logo was not found" }, 404);
      logoObjectKey = logo.objectKey;
    }
    const logoUrl = logoMediaId ? mediaUrl(
      env,
      logoObjectKey,
      `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${logoMediaId}`
    ) : null;
    await env.DB.prepare(
      `UPDATE businesses SET name=?, tagline=?, description=?, phone=?, address=?, currency=?,
       secondary_currency=?,secondary_exchange_rate=?,show_secondary_currency=?,
       enable_add_to_order=?,
       business_hours_json=?,contact_numbers_json=?,email=?,website_url=?,
       social_links_json=?,locations_json=?,map_url=?,map_label=?,wifi_ssid=?,wifi_password=?,
       wifi_security=?,show_header_location=?,show_header_phones=?,
       show_header_wifi=?,show_header_socials=?,show_header_tagline=?,show_business_hours=?,
       locale='km', enable_en=?, enable_zh=?, theme_color=?, logo_url=?, logo_media_id=?,
       timezone=?,pricing_mode=?,default_price_list_id=?,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).bind(
      String(body.name ?? ""),
      String(body.tagline ?? ""),
      String(body.description ?? ""),
      shopInformation.contactNumbers[0]?.number || String(body.phone ?? ""),
      shopInformation.locations[0]?.address || String(body.address ?? ""),
      currency,
      secondaryCurrency,
      secondaryExchangeRate,
      showSecondaryCurrency,
      enableAddToOrder,
      JSON.stringify(shopInformation.businessHours),
      JSON.stringify(shopInformation.contactNumbers),
      shopInformation.email,
      shopInformation.websiteUrl,
      JSON.stringify(shopInformation.socialLinks),
      JSON.stringify(shopInformation.locations),
      shopInformation.mapUrl,
      shopInformation.mapLabel,
      shopInformation.wifiSsid,
      shopInformation.wifiPassword,
      shopInformation.wifiSecurity,
      shopInformation.showHeaderLocation ? 1 : 0,
      shopInformation.showHeaderPhones ? 1 : 0,
      shopInformation.showHeaderWifi ? 1 : 0,
      shopInformation.showHeaderSocials ? 1 : 0,
      shopInformation.showHeaderTagline ? 1 : 0,
      shopInformation.showBusinessHours ? 1 : 0,
      body.enableEn ? 1 : 0,
      body.enableZh ? 1 : 0,
      String(body.themeColor ?? "#de3c2f"),
      logoUrl,
      logoMediaId || null,
      timezone,
      pricingMode,
      defaultPriceListId,
      auth.businessId
    ).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true });
  }
  if (request.method === "PUT" && path === "/api/admin/menu-theme") {
    const body = await readJson(request);
    const current = await env.DB.prepare(
      "SELECT theme_color AS themeColor FROM businesses WHERE id=?"
    ).bind(auth.businessId).first();
    const nextTheme = menuTheme(
      body.menuTheme,
      current?.themeColor || "#e84231"
    );
    const imageIds = menuThemeImageFields.map(
      ({ mediaId }) => nextTheme[mediaId]
    );
    const images = imageIds.some(Boolean) ? (await env.DB.prepare("SELECT id, object_key AS objectKey FROM media WHERE business_id=? AND id IN (?,?)").bind(auth.businessId, ...imageIds).all()).results : [];
    for (const { mediaId, url: url2, missingMessage } of menuThemeImageFields) {
      nextTheme[url2] = "";
      const imageId = nextTheme[mediaId];
      if (!imageId) continue;
      const image = images.find(({ id: id2 }) => id2 === imageId);
      if (!image) return json3({ error: missingMessage }, 404);
      const assetUrl = workerMediaUrl(env, imageId);
      nextTheme[url2] = url2 === "productPlaceholderUrl" ? assetUrl : mediaUrl(env, image.objectKey, assetUrl);
    }
    if (nextTheme.backgroundType === "image" && !nextTheme.backgroundImageMediaId) {
      return json3(
        { error: "Upload a background image before publishing" },
        400
      );
    }
    await env.DB.prepare(
      `UPDATE businesses
       SET menu_theme_json=?, theme_color=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(JSON.stringify(nextTheme), nextTheme.primaryColor, auth.businessId).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true, menuTheme: nextTheme });
  }
  if (request.method === "GET" && path === "/api/admin/price-lists") {
    const [lists, business2] = await Promise.all([
      env.DB.prepare(
        `SELECT list.id, list.name, list.is_normal AS isNormal,
          list.schedule_enabled AS scheduleEnabled,
          list.schedule_start_local AS scheduleStartLocal,
          list.schedule_end_local AS scheduleEndLocal,
          list.is_archived AS isArchived,
          COUNT(price.product_id) AS overrideCount
         FROM price_lists list
         LEFT JOIN product_prices price
          ON price.price_list_id=list.id AND price.business_id=list.business_id
         WHERE list.business_id=?
         GROUP BY list.id
         ORDER BY list.is_normal DESC, list.is_archived, list.created_at`
      ).bind(auth.businessId).all(),
      env.DB.prepare(
        `SELECT timezone, pricing_mode AS pricingMode,
          default_price_list_id AS defaultPriceListId
         FROM businesses WHERE id=?`
      ).bind(auth.businessId).first()
    ]);
    const pricing = await resolvePriceList(
      env,
      auth.businessId,
      business2?.pricingMode,
      business2?.defaultPriceListId,
      business2?.timezone
    );
    return json3({
      priceLists: lists.results,
      activePriceListId: pricing.activeId
    });
  }
  if (request.method === "POST" && path === "/api/admin/price-lists") {
    const body = await readJson(request);
    const fields2 = priceListFields(body);
    if ("error" in fields2) return json3({ error: fields2.error }, 400);
    if (fields2.scheduleEnabled) {
      const overlap = await overlappingPriceList(
        env,
        auth.businessId,
        String(fields2.scheduleStartLocal),
        String(fields2.scheduleEndLocal)
      );
      if (overlap)
        return json3({ error: `Schedule overlaps ${overlap.name}` }, 409);
    }
    const priceListId = id("prl");
    try {
      await env.DB.prepare(
        `INSERT INTO price_lists
         (id,business_id,name,schedule_enabled,schedule_start_local,schedule_end_local)
         VALUES (?,?,?,?,?,?)`
      ).bind(
        priceListId,
        auth.businessId,
        fields2.name,
        fields2.scheduleEnabled ? 1 : 0,
        fields2.scheduleStartLocal,
        fields2.scheduleEndLocal
      ).run();
    } catch {
      return json3({ error: "A price list with this name already exists" }, 409);
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ id: priceListId }, 201);
  }
  const priceListMatch = path.match(
    /^\/api\/admin\/price-lists\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "PUT" && priceListMatch) {
    const priceListId = priceListMatch[1];
    const existing = await env.DB.prepare(
      `SELECT id,name,is_normal AS isNormal,is_archived AS isArchived
       FROM price_lists WHERE id=? AND business_id=?`
    ).bind(priceListId, auth.businessId).first();
    if (!existing) return json3({ error: "Price list not found" }, 404);
    const body = await readJson(request);
    const fields2 = priceListFields(body, Boolean(existing.isNormal));
    if ("error" in fields2) return json3({ error: fields2.error }, 400);
    const isArchived = existing.isNormal ? false : Boolean(body.isArchived);
    if (fields2.scheduleEnabled && !isArchived) {
      const overlap = await overlappingPriceList(
        env,
        auth.businessId,
        String(fields2.scheduleStartLocal),
        String(fields2.scheduleEndLocal),
        priceListId
      );
      if (overlap)
        return json3({ error: `Schedule overlaps ${overlap.name}` }, 409);
    }
    if (isArchived) {
      const business2 = await env.DB.prepare(
        `SELECT default_price_list_id AS defaultPriceListId, timezone
         FROM businesses WHERE id=?`
      ).bind(auth.businessId).first();
      if (business2?.defaultPriceListId === priceListId)
        return json3(
          {
            error: "Choose another default price list before archiving this one"
          },
          409
        );
      if (fields2.scheduleEnabled && String(fields2.scheduleEndLocal) > localDateTimeNow(String(business2?.timezone || "Asia/Phnom_Penh")))
        return json3(
          { error: "Disable the current or future schedule before archiving" },
          409
        );
    }
    try {
      await env.DB.prepare(
        `UPDATE price_lists SET name=?,schedule_enabled=?,schedule_start_local=?,
          schedule_end_local=?,is_archived=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND business_id=?`
      ).bind(
        existing.isNormal ? "Normal Rate" : fields2.name,
        fields2.scheduleEnabled ? 1 : 0,
        fields2.scheduleStartLocal,
        fields2.scheduleEndLocal,
        isArchived ? 1 : 0,
        priceListId,
        auth.businessId
      ).run();
    } catch {
      return json3({ error: "A price list with this name already exists" }, 409);
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true });
  }
  if (request.method === "PUT" && path === "/api/admin/product-prices") {
    const body = await readJson(request);
    const productId = String(body.productId ?? "");
    const priceListId = String(body.priceListId ?? "");
    const portionId = body.portionId == null ? "" : String(body.portionId);
    const targetKey = portionId || "base";
    if (!RECORD_ID_PATTERN.test(productId) || !RECORD_ID_PATTERN.test(priceListId) || targetKey !== "base" && !PRODUCT_OPTION_ID_PATTERN.test(targetKey))
      return json3({ error: "Invalid product price target" }, 400);
    const amount = body.priceCents === "" || body.priceCents == null ? null : validPriceAmount(body.priceCents);
    if (body.priceCents !== "" && body.priceCents != null && amount == null)
      return json3({ error: "Price must be zero or greater" }, 400);
    const [product, list2] = await Promise.all([
      env.DB.prepare(
        `SELECT id,price_cents AS priceCents,max_price AS maxPrice,
          portions_json AS portionsJson
         FROM products WHERE id=? AND business_id=?`
      ).bind(productId, auth.businessId).first(),
      env.DB.prepare(
        `SELECT id,is_normal AS isNormal FROM price_lists
         WHERE id=? AND business_id=? AND is_archived=0`
      ).bind(priceListId, auth.businessId).first()
    ]);
    if (!product) return json3({ error: "Menu item not found" }, 404);
    if (!list2) return json3({ error: "Price list not found" }, 404);
    const portions2 = jsonArray(product.portionsJson);
    const portion = portions2.find((item) => item.id === targetKey);
    if (targetKey === "base" && portions2.length)
      return json3(
        { error: "Products with portions do not have a base price row" },
        400
      );
    if (targetKey !== "base" && !portion)
      return json3({ error: "Product portion not found" }, 404);
    if (list2.isNormal && amount == null)
      return json3({ error: "Normal Rate prices cannot be empty" }, 400);
    const statements = [];
    if (amount == null) {
      statements.push(
        env.DB.prepare(
          `DELETE FROM product_prices
           WHERE business_id=? AND price_list_id=? AND product_id=? AND target_key=?`
        ).bind(auth.businessId, priceListId, productId, targetKey)
      );
    } else {
      statements.push(
        env.DB.prepare(
          `INSERT INTO product_prices
           (business_id,price_list_id,product_id,target_key,price_amount)
           VALUES (?,?,?,?,?)
           ON CONFLICT(price_list_id,product_id,target_key) DO UPDATE SET
            price_amount=excluded.price_amount,updated_at=CURRENT_TIMESTAMP`
        ).bind(auth.businessId, priceListId, productId, targetKey, amount)
      );
    }
    if (list2.isNormal && amount != null) {
      if (targetKey === "base")
        statements.push(
          env.DB.prepare(
            `UPDATE products SET price_cents=?,max_price=?,updated_at=CURRENT_TIMESTAMP
             WHERE id=? AND business_id=?`
          ).bind(amount, amount, productId, auth.businessId)
        );
      else {
        const nextPortions = portions2.map(
          (item) => item.id === targetKey ? { ...item, priceCents: amount } : item
        );
        const prices = nextPortions.map((item) => Number(item.priceCents || 0));
        statements.push(
          env.DB.prepare(
            `UPDATE products SET portions_json=?,price_cents=?,max_price=?,
              updated_at=CURRENT_TIMESTAMP
             WHERE id=? AND business_id=?`
          ).bind(
            JSON.stringify(nextPortions),
            Math.min(...prices),
            Math.max(...prices),
            productId,
            auth.businessId
          )
        );
      }
    }
    await env.DB.batch(statements);
    const normalId = await normalPriceListId(env, auth.businessId);
    let effectivePriceCents = amount;
    let inherited = false;
    if (!list2.isNormal && amount == null) {
      inherited = true;
      const normal = await env.DB.prepare(
        `SELECT price_amount AS priceCents FROM product_prices
         WHERE business_id=? AND price_list_id=? AND product_id=? AND target_key=?`
      ).bind(auth.businessId, normalId, productId, targetKey).first();
      effectivePriceCents = Number(
        normal?.priceCents ?? (targetKey === "base" ? product.priceCents : portion?.priceCents) ?? 0
      );
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true, effectivePriceCents, inherited });
  }
  if (request.method === "GET" && path === "/api/admin/qr-designs") {
    const browsing = qrCategoryBrowsingEnabled(env.DB, auth.businessId);
    if (url.searchParams.get("settings") === "1")
      return json3({ allowCategoryBrowsing: await browsing });
    const designs = env.DB.prepare(
      `SELECT design.id, design.name, design.preset_key AS presetKey,
        design.target_type AS targetType, design.config_json AS configJson,
        design.background_media_id AS backgroundMediaId,
        background.object_key AS backgroundObjectKey,
        design.is_default AS isDefault, design.created_at AS createdAt,
        design.updated_at AS updatedAt
       FROM qr_designs design
       LEFT JOIN media background ON background.id = design.background_media_id
        AND background.business_id = design.business_id
       WHERE design.business_id = ?
       ORDER BY design.is_default DESC, design.updated_at DESC`
    ).bind(auth.businessId).all();
    const [result, allowCategoryBrowsing] = await Promise.all([designs, browsing]);
    return json3({
      designs: result.results.map((row) => hydrateQrDesign(row, env)),
      allowCategoryBrowsing
    });
  }
  if (request.method === "POST" && path === "/api/admin/qr-designs") {
    const body = await readJson(request);
    const name = String(body.name ?? "Untitled QR design").trim().slice(0, 100);
    const presetKey = String(body.presetKey ?? "table-card");
    const targetType = body.targetType === "table" ? "table" : "menu";
    const backgroundMediaId = String(body.backgroundMediaId ?? "");
    if (!name) return json3({ error: "Design name is required" }, 400);
    if (!QR_PRESETS.has(presetKey))
      return json3({ error: "Unknown QR preset" }, 400);
    if (backgroundMediaId) {
      const media = await env.DB.prepare(
        "SELECT id FROM media WHERE id=? AND business_id=?"
      ).bind(backgroundMediaId, auth.businessId).first();
      if (!media) return json3({ error: "Background image was not found" }, 404);
    }
    const config = qrConfig(body.config);
    if (!config.menuSlug && !await qrCategoryBrowsingEnabled(env.DB, auth.businessId))
      return json3({ error: "Choose an active menu before saving this QR design" }, 400);
    const designId = id("qrd");
    config.backgroundImageUrl = "";
    await env.DB.prepare(
      `INSERT INTO qr_designs
       (id,business_id,name,preset_key,target_type,config_json,background_media_id,is_default)
       VALUES (?,?,?,?,?,?,?,0)`
    ).bind(
      designId,
      auth.businessId,
      name,
      presetKey,
      targetType,
      JSON.stringify(config),
      backgroundMediaId || null
    ).run();
    return json3({ id: designId }, 201);
  }
  const qrDuplicateMatch = path.match(
    /^\/api\/admin\/qr-designs\/([a-zA-Z0-9_-]+)\/duplicate$/
  );
  if (request.method === "POST" && qrDuplicateMatch) {
    const source = await env.DB.prepare(
      `SELECT name,preset_key AS presetKey,target_type AS targetType,
        config_json AS configJson,background_media_id AS backgroundMediaId
       FROM qr_designs WHERE id=? AND business_id=?`
    ).bind(qrDuplicateMatch[1], auth.businessId).first();
    if (!source) return json3({ error: "QR design not found" }, 404);
    const designId = id("qrd");
    await env.DB.prepare(
      `INSERT INTO qr_designs
       (id,business_id,name,preset_key,target_type,config_json,background_media_id,is_default)
       VALUES (?,?,?,?,?,?,?,0)`
    ).bind(
      designId,
      auth.businessId,
      `${String(source.name).slice(0, 90)} copy`,
      source.presetKey,
      source.targetType,
      source.configJson,
      source.backgroundMediaId || null
    ).run();
    return json3({ id: designId }, 201);
  }
  const qrDefaultMatch = path.match(
    /^\/api\/admin\/qr-designs\/([a-zA-Z0-9_-]+)\/default$/
  );
  if (request.method === "PATCH" && qrDefaultMatch) {
    const design = await env.DB.prepare(
      "SELECT id FROM qr_designs WHERE id=? AND business_id=?"
    ).bind(qrDefaultMatch[1], auth.businessId).first();
    if (!design) return json3({ error: "QR design not found" }, 404);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE qr_designs SET is_default=0 WHERE business_id=?"
      ).bind(auth.businessId),
      env.DB.prepare(
        "UPDATE qr_designs SET is_default=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?"
      ).bind(qrDefaultMatch[1], auth.businessId)
    ]);
    return json3({ ok: true });
  }
  const qrDesignMatch = path.match(
    /^\/api\/admin\/qr-designs\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "PUT" && qrDesignMatch) {
    const body = await readJson(request);
    const name = String(body.name ?? "").trim().slice(0, 100);
    const presetKey = String(body.presetKey ?? "table-card");
    const targetType = body.targetType === "table" ? "table" : "menu";
    const backgroundMediaId = String(body.backgroundMediaId ?? "");
    if (!name) return json3({ error: "Design name is required" }, 400);
    if (!QR_PRESETS.has(presetKey))
      return json3({ error: "Unknown QR preset" }, 400);
    if (backgroundMediaId) {
      const media = await env.DB.prepare(
        "SELECT id FROM media WHERE id=? AND business_id=?"
      ).bind(backgroundMediaId, auth.businessId).first();
      if (!media) return json3({ error: "Background image was not found" }, 404);
    }
    const config = qrConfig(body.config);
    if (!config.menuSlug && !await qrCategoryBrowsingEnabled(env.DB, auth.businessId))
      return json3({ error: "Choose an active menu before saving this QR design" }, 400);
    config.backgroundImageUrl = "";
    const result = await env.DB.prepare(
      `UPDATE qr_designs SET name=?,preset_key=?,target_type=?,config_json=?,
       background_media_id=?,updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND business_id=?`
    ).bind(
      name,
      presetKey,
      targetType,
      JSON.stringify(config),
      backgroundMediaId || null,
      qrDesignMatch[1],
      auth.businessId
    ).run();
    return result.meta.changes ? json3({ ok: true }) : json3({ error: "QR design not found" }, 404);
  }
  if (request.method === "DELETE" && qrDesignMatch) {
    const design = await env.DB.prepare(
      "SELECT is_default AS isDefault FROM qr_designs WHERE id=? AND business_id=?"
    ).bind(qrDesignMatch[1], auth.businessId).first();
    if (!design) return json3({ error: "QR design not found" }, 404);
    if (design.isDefault)
      return json3(
        { error: "Choose another default before deleting this design" },
        409
      );
    await env.DB.prepare("DELETE FROM qr_designs WHERE id=? AND business_id=?").bind(qrDesignMatch[1], auth.businessId).run();
    return json3({ ok: true });
  }
  if (request.method === "GET" && path === "/api/admin/table-groups") {
    const branchId = url.searchParams.get("branchId") || "";
    const groups = await env.DB.prepare(
      `SELECT groups.id,groups.name,groups.sort_order AS sortOrder,groups.branch_id AS branchId,
        groups.is_active AS isActive,
        COUNT(tables.id) AS tableCount,
        SUM(CASE WHEN tables.is_active=1 THEN 1 ELSE 0 END) AS activeTableCount
       FROM table_groups groups
       LEFT JOIN restaurant_tables tables ON tables.group_id=groups.id
        AND tables.business_id=groups.business_id
       WHERE groups.business_id=? AND (?='' OR groups.branch_id=?)
       GROUP BY groups.id
       ORDER BY groups.sort_order,groups.name`
    ).bind(auth.businessId, branchId, branchId).all();
    return json3({ groups: groups.results });
  }
  if (request.method === "POST" && path === "/api/admin/table-groups") {
    const body = await readJson(request);
    const name = String(body.name ?? "").trim().slice(0, 80);
    const sortOrder2 = parseSortOrder(body.sortOrder);
    if (!name) return json3({ error: "Group name is required" }, 400);
    if (sortOrder2 == null) return json3({ error: "Invalid group order" }, 400);
    const branchId = String(body.branchId ?? "");
    const branch2 = await env.DB.prepare(`SELECT id FROM branches WHERE business_id=? AND is_active=1
      AND ((?='' AND is_default=1) OR id=?)`).bind(auth.businessId, branchId, branchId).first();
    if (!branch2) return json3({ error: "Choose an active branch" }, 400);
    const groupId = id("grp");
    try {
      await env.DB.prepare(
        "INSERT INTO table_groups (id,business_id,branch_id,name,sort_order,is_active) VALUES (?,?,?,?,?,1)"
      ).bind(groupId, auth.businessId, branch2.id, name, sortOrder2).run();
    } catch {
      return json3(
        { error: "A table group with this name already exists" },
        409
      );
    }
    return json3({ id: groupId }, 201);
  }
  if (request.method === "PUT" && path === "/api/admin/table-groups/reorder") {
    const body = await readJson(request);
    const items = parseSortItems(body.items);
    if (!items) return json3({ error: "Invalid table group order" }, 400);
    await env.DB.batch(
      items.map(
        (item) => env.DB.prepare(
          "UPDATE table_groups SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?"
        ).bind(item.sortOrder, item.id, auth.businessId)
      )
    );
    return json3({ ok: true });
  }
  const tableGroupMatch = path.match(
    /^\/api\/admin\/table-groups\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "PUT" && tableGroupMatch) {
    const body = await readJson(request);
    const name = String(body.name ?? "").trim().slice(0, 80);
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    if (!name) return json3({ error: "Group name is required" }, 400);
    if (!isActive) {
      const activeTables = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM restaurant_tables WHERE group_id=? AND business_id=? AND is_active=1"
      ).bind(tableGroupMatch[1], auth.businessId).first();
      if (Number(activeTables?.count || 0) > 0)
        return json3(
          {
            error: "Move or archive active tables before archiving this group"
          },
          409
        );
    }
    try {
      const result = await env.DB.prepare(
        `UPDATE table_groups SET name=?,is_active=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND business_id=?`
      ).bind(name, isActive, tableGroupMatch[1], auth.businessId).run();
      return result.meta.changes ? json3({ ok: true }) : json3({ error: "Table group not found" }, 404);
    } catch {
      return json3(
        { error: "A table group with this name already exists" },
        409
      );
    }
  }
  if (request.method === "DELETE" && tableGroupMatch) {
    const activeTables = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM restaurant_tables WHERE group_id=? AND business_id=? AND is_active=1"
    ).bind(tableGroupMatch[1], auth.businessId).first();
    if (Number(activeTables?.count || 0) > 0)
      return json3(
        { error: "Move or archive active tables before archiving this group" },
        409
      );
    await env.DB.prepare(
      "UPDATE table_groups SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?"
    ).bind(tableGroupMatch[1], auth.businessId).run();
    return json3({ ok: true });
  }
  if (request.method === "GET" && path === "/api/admin/tables") {
    const branchId = url.searchParams.get("branchId") || "";
    const tables2 = await env.DB.prepare(
      `SELECT tables.id,tables.group_id AS groupId,tables.branch_id AS branchId,tables.code,tables.label,
        tables.public_token AS publicToken,tables.sort_order AS sortOrder,
        tables.is_active AS isActive,groups.name AS groupName,
        groups.is_active AS groupIsActive
       FROM restaurant_tables tables
       JOIN table_groups groups ON groups.id=tables.group_id
        AND groups.business_id=tables.business_id
       WHERE tables.business_id=? AND (?='' OR tables.branch_id=?)
       ORDER BY groups.sort_order,tables.sort_order,tables.code`
    ).bind(auth.businessId, branchId, branchId).all();
    return json3({ tables: tables2.results });
  }
  if (request.method === "POST" && path === "/api/admin/tables/bulk-delete") {
    const body = await readJson(request).catch(() => null);
    const tableIds = body?.tableIds ?? [];
    const groupIds = body?.groupIds ?? [];
    const includeGroupTables = body?.includeGroupTables ?? false;
    if (!Array.isArray(tableIds) || !Array.isArray(groupIds) || typeof includeGroupTables !== "boolean" || tableIds.length + groupIds.length === 0 || tableIds.length + groupIds.length > 1e4 || [...tableIds, ...groupIds].some((id2) => typeof id2 !== "string" || !RECORD_ID_PATTERN.test(id2))) {
      return json3({ error: "Choose the tables or table groups to delete" }, 400);
    }
    const businessId = auth.businessId;
    const tables2 = JSON.stringify([...new Set(tableIds)]);
    const groups = JSON.stringify([...new Set(groupIds)]);
    const [deletedTables, deletedGroups, retained] = await env.DB.batch([
      env.DB.prepare(`WITH selected_tables AS (
          SELECT value AS id FROM json_each(?2)
        ), selected_groups AS (
          SELECT id FROM table_groups
          WHERE business_id=?1 AND ?4=1 AND id IN (SELECT value FROM json_each(?3))
        ), protected_tables AS (
          SELECT id, group_id FROM restaurant_tables
          WHERE (id IN (SELECT id FROM selected_tables) OR group_id IN (SELECT id FROM selected_groups))
            AND (business_id<>?1 OR id IN (SELECT table_id FROM orders))
        )
        DELETE FROM restaurant_tables
        WHERE business_id=?1 AND (
          group_id IN (
            SELECT id FROM selected_groups
            WHERE id NOT IN (SELECT group_id FROM protected_tables)
          )
          OR (
            id IN (SELECT id FROM selected_tables)
            AND group_id NOT IN (SELECT id FROM selected_groups)
            AND id NOT IN (SELECT id FROM protected_tables)
          )
        )
        RETURNING id`).bind(businessId, tables2, groups, includeGroupTables ? 1 : 0),
      env.DB.prepare(`DELETE FROM table_groups
        WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?2))
          AND id NOT IN (
            SELECT group_id FROM restaurant_tables WHERE group_id IN (SELECT value FROM json_each(?2))
          )
        RETURNING id`).bind(businessId, groups),
      env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM restaurant_tables
          WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?2))) AS keptTableCount,
        (SELECT COUNT(*) FROM table_groups
          WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?3))) AS keptGroupCount`).bind(businessId, tables2, groups)
    ]);
    return json3({
      deletedTableIds: deletedTables.results.map(({ id: id2 }) => id2),
      deletedGroupIds: deletedGroups.results.map(({ id: id2 }) => id2),
      ...retained.results[0]
    });
  }
  if (request.method === "POST" && path === "/api/admin/tables") {
    const body = await readJson(request);
    const groupId = String(body.groupId ?? "");
    const code = String(body.code ?? "").trim().slice(0, 30);
    const label2 = String(body.label ?? code).trim().slice(0, 80);
    const sortOrder2 = parseSortOrder(body.sortOrder);
    if (!code || !label2)
      return json3({ error: "Table code and label are required" }, 400);
    if (sortOrder2 == null) return json3({ error: "Invalid table order" }, 400);
    const group = await env.DB.prepare(
      `SELECT groups.branch_id AS branchId FROM table_groups groups JOIN branches branch ON branch.id=groups.branch_id
       WHERE groups.id=? AND groups.business_id=? AND groups.is_active=1 AND branch.is_active=1`
    ).bind(groupId, auth.businessId).first();
    if (!group) return json3({ error: "Choose an active table group" }, 400);
    const tableId = id("tbl");
    const publicToken = id("scan");
    try {
      await env.DB.prepare(
        `INSERT INTO restaurant_tables
         (id,business_id,group_id,branch_id,code,label,public_token,sort_order,is_active)
         VALUES (?,?,?,?,?,?,?,?,1)`
      ).bind(
        tableId,
        auth.businessId,
        groupId,
        group.branchId,
        code,
        label2,
        publicToken,
        sortOrder2
      ).run();
    } catch {
      return json3({ error: "A table with this code already exists" }, 409);
    }
    return json3({ id: tableId, publicToken }, 201);
  }
  if (request.method === "PUT" && path === "/api/admin/tables/reorder") {
    const body = await readJson(request);
    const groupId = String(body.groupId ?? "");
    const items = parseSortItems(body.items);
    if (!groupId || !items) return json3({ error: "Invalid table order" }, 400);
    await env.DB.batch(
      items.map(
        (item) => env.DB.prepare(
          `UPDATE restaurant_tables SET sort_order=?,updated_at=CURRENT_TIMESTAMP
           WHERE id=? AND business_id=? AND group_id=?`
        ).bind(item.sortOrder, item.id, auth.businessId, groupId)
      )
    );
    return json3({ ok: true });
  }
  const restaurantTableMatch = path.match(
    /^\/api\/admin\/tables\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "PUT" && restaurantTableMatch) {
    const body = await readJson(request);
    const groupId = String(body.groupId ?? "");
    const code = String(body.code ?? "").trim().slice(0, 30);
    const label2 = String(body.label ?? code).trim().slice(0, 80);
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    if (!code || !label2)
      return json3({ error: "Table code and label are required" }, 400);
    const group = await env.DB.prepare(
      `SELECT groups.id FROM table_groups groups JOIN restaurant_tables tables
         ON tables.business_id=groups.business_id AND tables.branch_id=groups.branch_id
       WHERE groups.id=? AND groups.business_id=? AND groups.is_active=1 AND tables.id=?`
    ).bind(groupId, auth.businessId, restaurantTableMatch[1]).first();
    if (!group) return json3({ error: "Choose an active table group in the same branch" }, 400);
    try {
      const result = await env.DB.prepare(
        `UPDATE restaurant_tables SET group_id=?,code=?,label=?,is_active=?,
         updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?`
      ).bind(
        groupId,
        code,
        label2,
        isActive,
        restaurantTableMatch[1],
        auth.businessId
      ).run();
      return result.meta.changes ? json3({ ok: true }) : json3({ error: "Table not found" }, 404);
    } catch {
      return json3({ error: "A table with this code already exists" }, 409);
    }
  }
  if (request.method === "DELETE" && restaurantTableMatch) {
    await env.DB.prepare(
      "UPDATE restaurant_tables SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?"
    ).bind(restaurantTableMatch[1], auth.businessId).run();
    return json3({ ok: true });
  }
  if (request.method === "GET" && path === "/api/admin/catalog") {
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") || "1", 10) || 1
    );
    const pageSize = Math.min(
      1e3,
      Math.max(
        1,
        Number.parseInt(url.searchParams.get("pageSize") || "50", 10) || 50
      )
    );
    const search = String(url.searchParams.get("query") || "").trim().toLowerCase();
    const categoryId = String(url.searchParams.get("categoryId") || "").trim();
    const productId = (url.searchParams.get("productId") ?? "").trim();
    const filter = String(url.searchParams.get("filter") || "all");
    const requestedSort = String(
      url.searchParams.get("sortBy") || "sort-order"
    );
    const sortColumns = {
      "sort-order": "product.sort_order",
      "name-km": "COALESCE(NULLIF(TRIM(product.name_km), ''), product.name, '') COLLATE NOCASE",
      "name-en": "COALESCE(NULLIF(TRIM(product.name_en), ''), product.name_km, product.name, '') COLLATE NOCASE",
      "name-zh": "COALESCE(NULLIF(TRIM(product.name_zh), ''), product.name_km, product.name, '') COLLATE NOCASE",
      "created-at": "product.created_at",
      "updated-at": "product.updated_at"
    };
    const sortColumn = sortColumns[requestedSort] || sortColumns["sort-order"];
    const sortDirection = String(url.searchParams.get("sortDirection") || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
    const sortTieBreaker = requestedSort === "created-at" || requestedSort === "updated-at" ? `, product.rowid ${sortDirection}` : "";
    const visibleCategoryCte = `WITH RECURSIVE ${adminVisibleCategoryScope}`;
    let filterCte = visibleCategoryCte;
    const filterCteBindings = [auth.businessId, auth.businessId];
    const where = ["product.business_id = ?"];
    const whereBindings = [auth.businessId];
    if (productId) {
      where.push("product.id = ?");
      whereBindings.push(productId);
    }
    if (categoryId) {
      filterCte += `, ${adminCategoryScope}`;
      filterCteBindings.push(auth.businessId, categoryId, auth.businessId);
      where.push("product.category_id IN (SELECT id FROM filtered_category_ids)");
    }
    if (search) {
      where.push(`LOWER(
        COALESCE(product.code, '') || ' ' ||
        COALESCE(product.name_km, product.name, '') || ' ' ||
        COALESCE(product.name_en, '') || ' ' ||
        COALESCE(product.name_zh, '')
      ) LIKE ?`);
      whereBindings.push(`%${search}%`);
    }
    const filterPredicate = adminProductFilter(filter);
    if (filterPredicate) where.push(filterPredicate);
    const whereSql = where.join(" AND ");
    const commonBindings = [...filterCteBindings, ...whereBindings];
    if (url.searchParams.get("ids") === "matches")
      return matchingProductIds(env.DB, `${filterCte}
        SELECT product.id FROM products product WHERE ${whereSql}`, commonBindings);
    const [
      categories,
      banners,
      totalResult,
      products,
      globalCounts,
      categoryCounts
    ] = await env.DB.batch([
      env.DB.prepare(
        `SELECT id, parent_id AS parentId, COALESCE(name_km, name) AS name,
          name_km AS nameKm, name_en AS nameEn, name_zh AS nameZh,
          slug, image_url AS imageUrl, image_media_id AS imageMediaId,
          sort_order AS sortOrder, is_active AS isActive
         FROM categories WHERE business_id=? ORDER BY sort_order, name`
      ).bind(auth.businessId),
      env.DB.prepare(
        `SELECT id, title, subtitle, image_url AS imageUrl,
            detail_text AS detailText, cta_label AS ctaLabel,
            cta_url AS ctaUrl, starts_at AS startsAt, ends_at AS endsAt,
            sort_order AS sortOrder, is_active AS isActive
           FROM banners WHERE business_id=? ORDER BY sort_order, created_at`
      ).bind(auth.businessId),
      env.DB.prepare(
        `${filterCte}
           SELECT COUNT(*) AS total FROM products product WHERE ${whereSql}`
      ).bind(...commonBindings),
      env.DB.prepare(
        `${filterCte}
           SELECT product.id, product.code, product.rating,
            product.category_id AS categoryId,
            (SELECT json_group_array(assignment.menu_id) FROM menu_products assignment
              JOIN menus section ON section.business_id=assignment.business_id AND section.id=assignment.menu_id
              WHERE assignment.business_id=product.business_id AND assignment.product_id=product.id
                AND section.parent_id IS NOT NULL) AS assignedMenuIdsJson,
            COALESCE(product.name_km, product.name) AS name,
            product.name_km AS nameKm, product.name_en AS nameEn,
            product.name_zh AS nameZh, product.slug, product.description,
            product.price_cents AS priceCents, product.max_price AS maxPrice,
            product.unit,
            product.portions_json AS portionsJson,
            product.modifier_groups_json AS modifierGroupsJson,
            product.image_url AS imageUrl,
            product.primary_media_id AS primaryMediaId,
            product.is_featured AS isFeatured,
            product.allow_discount AS allowDiscount, product.allow_change_price AS allowChangePrice,
            product.is_open_product AS isOpenProduct, product.allow_free AS allowFree,
             product.is_available AS isAvailable, product.sort_order AS sortOrder,
             product.created_at AS createdAt, product.updated_at AS updatedAt
           FROM products product WHERE ${whereSql}
            ORDER BY ${sortColumn} ${sortDirection}${sortTieBreaker}, product.sort_order ASC,
             product.name ASC, product.id ASC LIMIT ? OFFSET ?`
      ).bind(...commonBindings, pageSize, (page - 1) * pageSize),
      countAdminCatalogProducts(env.DB, auth.businessId),
      env.DB.prepare(
        `SELECT category_id AS categoryId, COUNT(*) AS total
           FROM products WHERE business_id = ? GROUP BY category_id`
      ).bind(auth.businessId)
    ]);
    const pageProducts = products.results;
    const productIds = pageProducts.map((product) => String(product.id));
    let productImages = { results: [] };
    let productPrices = { results: [] };
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      [productImages, productPrices] = await env.DB.batch([
        env.DB.prepare(
          `SELECT pi.product_id AS productId, m.id, (? || '/' || m.id) AS url,
           m.filename, pi.sort_order AS sortOrder, pi.is_primary AS isPrimary
           FROM product_images pi JOIN media m ON m.id = pi.media_id
           WHERE pi.business_id=? AND pi.product_id IN (${placeholders})
           ORDER BY pi.product_id, pi.sort_order`
        ).bind(
          env.PUBLIC_ASSET_BASE.replace(/\/$/, ""),
          auth.businessId,
          ...productIds
        ),
        env.DB.prepare(
          `SELECT product_id AS productId, price_list_id AS priceListId,
           CASE WHEN target_key='base' THEN NULL ELSE target_key END AS portionId,
           price_amount AS priceCents
           FROM product_prices WHERE business_id=?
             AND product_id IN (${placeholders})
           ORDER BY product_id,price_list_id,target_key`
        ).bind(auth.businessId, ...productIds)
      ]);
    }
    const imagesByProduct = /* @__PURE__ */ new Map();
    for (const image of productImages.results) {
      const productId2 = String(image.productId);
      imagesByProduct.set(productId2, [
        ...imagesByProduct.get(productId2) ?? [],
        image
      ]);
    }
    return json3({
      categories: categories.results,
      products: pageProducts.map(({ assignedMenuIdsJson, ...product }) => ({
        ...hydrateProduct(product),
        menuIds: jsonArray(assignedMenuIdsJson),
        images: imagesByProduct.get(String(product.id)) ?? []
      })),
      banners: banners.results,
      priceEntries: productPrices.results,
      pagination: {
        page,
        pageSize,
        total: Number(totalResult.results[0]?.total ?? 0)
      },
      counts: {
        ...globalCounts.results[0],
        byCategory: Object.fromEntries(
          categoryCounts.results.map((item) => [item.categoryId, Number(item.total || 0)])
        )
      }
    });
  }
  if (request.method === "POST" && path === "/api/admin/categories") {
    const body = await readJson(request);
    const categoryId = id("cat");
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim() || nameKm;
    const nameZh = String(body.nameZh ?? "").trim() || nameKm;
    const imageMediaId = String(body.imageMediaId ?? "");
    let imageObjectKey = "";
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    const sortOrder2 = parseSortOrder(body.sortOrder);
    if (!nameKm) return json3({ error: "Khmer category name is required" }, 400);
    if (sortOrder2 == null)
      return json3(
        { error: "Sort order must be zero or a positive whole number" },
        400
      );
    if (imageMediaId) {
      const categoryMedia = await env.DB.prepare(
        "SELECT id, object_key AS objectKey FROM media WHERE id=? AND business_id=?"
      ).bind(imageMediaId, auth.businessId).first();
      if (!categoryMedia)
        return json3({ error: "Category photo not found" }, 404);
      imageObjectKey = categoryMedia.objectKey;
    }
    const parentId = body.parentId ? String(body.parentId) : null;
    if (parentId) {
      const parent = await env.DB.prepare(
        "SELECT id FROM categories WHERE id=? AND business_id=?"
      ).bind(parentId, auth.businessId).first();
      if (!parent) return json3({ error: "Parent category not found" }, 404);
    }
    await env.DB.prepare(
      `INSERT INTO categories
       (id,business_id,parent_id,name,name_km,name_en,name_zh,slug,image_url,image_media_id,sort_order,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      categoryId,
      auth.businessId,
      parentId,
      nameKm,
      nameKm,
      nameEn || null,
      nameZh || null,
      recordSlug(
        String(body.slug || nameEn || nameKm),
        "category",
        categoryId
      ),
      imageMediaId ? mediaUrl(
        env,
        imageObjectKey,
        `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${imageMediaId}`
      ) : null,
      imageMediaId || null,
      sortOrder2,
      isActive
    ).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ id: categoryId }, 201);
  }
  if (request.method === "POST" && path === "/api/admin/products") {
    const body = await readJson(request);
    const productId = id("prd");
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim();
    const nameZh = String(body.nameZh ?? "").trim();
    const options = await productOptions(body, env.DB, auth.businessId);
    if ("error" in options) return json3({ error: options.error }, 400);
    const submittedPriceEntries = body.priceEntries === void 0 ? void 0 : parsePriceEntries(body.priceEntries);
    if (body.priceEntries !== void 0 && !submittedPriceEntries)
      return json3({ error: "Product price entries are invalid" }, 400);
    const submittedBasePrice = Number(body.priceCents ?? 0);
    const { minPrice: basePrice, maxPrice } = productPriceRange(
      options.portions,
      submittedBasePrice
    );
    const sortOrder2 = parseSortOrder(body.sortOrder);
    const code = String(body.code ?? "").trim() || null;
    const ratingInput = body.rating;
    const rating = ratingInput == null || String(ratingInput).trim() === "" ? null : Number(ratingInput);
    const mediaIds = Array.isArray(body.mediaIds) ? [...new Set(body.mediaIds.map(String))].slice(0, 6) : [];
    const primaryMediaId = String(body.primaryMediaId ?? "");
    let primaryObjectKey = "";
    if (!nameKm) return json3({ error: "Khmer menu name is required" }, 400);
    if (sortOrder2 == null)
      return json3(
        { error: "Sort order must be zero or a positive whole number" },
        400
      );
    if (!Number.isFinite(submittedBasePrice) || submittedBasePrice < 0)
      return json3({ error: "Product price must be zero or greater" }, 400);
    if (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5))
      return json3({ error: "Guest rating must be between 0 and 5" }, 400);
    if (code && code.length > 64)
      return json3(
        { error: "Menu item code must be 64 characters or less" },
        400
      );
    if (code) {
      const duplicateCode = await env.DB.prepare(
        "SELECT id FROM products WHERE business_id=? AND code=? COLLATE NOCASE"
      ).bind(auth.businessId, code).first();
      if (duplicateCode)
        return json3(
          { error: "This menu item code is already used by your business" },
          409
        );
    }
    if (mediaIds.length > 5)
      return json3({ error: "Upload no more than 5 product photos" }, 400);
    if (mediaIds.length > 0 && !mediaIds.includes(primaryMediaId))
      return json3(
        { error: "Select one uploaded photo as the product photo" },
        400
      );
    if (mediaIds.length > 0) {
      const mediaPlaceholders = mediaIds.map(() => "?").join(",");
      const ownedMedia = await env.DB.prepare(
        `SELECT id, object_key AS objectKey FROM media
         WHERE business_id=? AND id IN (${mediaPlaceholders})`
      ).bind(auth.businessId, ...mediaIds).all();
      if (ownedMedia.results.length !== mediaIds.length)
        return json3(
          { error: "One or more product photos were not found" },
          404
        );
      primaryObjectKey = String(
        ownedMedia.results.find(
          (media) => media.id === primaryMediaId
        )?.objectKey ?? ""
      );
    }
    const categoryId = String(body.categoryId ?? "");
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?"
    ).bind(categoryId, auth.businessId).first();
    if (!category) return json3({ error: "Category not found" }, 404);
    const primaryUrl = primaryMediaId ? mediaUrl(
      env,
      primaryObjectKey,
      `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${primaryMediaId}`
    ) : null;
    if (body.menuIds !== void 0 && disabledControlPages.has("menus"))
      return json3({ error: "The Menus module is disabled" }, 403);
    const assignments = await localMenuAssignments(env.DB, auth.businessId, productId, body.menuIds);
    if (!assignments) return json3({ error: "Choose submenus managed by this business" }, 400);
    const pricing = await productPriceStatements(
      env,
      auth.businessId,
      productId,
      basePrice,
      options.portions,
      submittedPriceEntries || void 0
    );
    if ("error" in pricing) return json3({ error: pricing.error }, 400);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO products
         (id,business_id,category_id,code,rating,name,name_km,name_en,name_zh,slug,description,
          price_cents,max_price,unit,portions_json,modifier_groups_json,image_url,primary_media_id,
          is_featured,is_available,sort_order,allow_discount,allow_change_price,is_open_product,allow_free)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        productId,
        auth.businessId,
        categoryId,
        code,
        rating,
        nameKm,
        nameKm,
        nameEn || null,
        nameZh || null,
        recordSlug(
          String(body.slug || nameEn || nameKm),
          "menu-item",
          productId
        ),
        String(body.description ?? ""),
        basePrice,
        maxPrice,
        options.unit,
        JSON.stringify(options.portions),
        JSON.stringify(options.modifierGroups),
        primaryUrl,
        primaryMediaId || null,
        body.isFeatured ? 1 : 0,
        body.isAvailable === false ? 0 : 1,
        sortOrder2,
        options.posOptions.allowDiscount ?? 1,
        options.posOptions.allowChangePrice ?? 1,
        options.posOptions.isOpenProduct ?? 0,
        options.posOptions.allowFree ?? 1
      ),
      ...mediaIds.map(
        (mediaId, index) => env.DB.prepare(
          `INSERT INTO product_images
           (product_id,media_id,business_id,sort_order,is_primary)
           VALUES (?,?,?,?,?)`
        ).bind(
          productId,
          mediaId,
          auth.businessId,
          index,
          mediaId === primaryMediaId ? 1 : 0
        )
      ),
      ...pricing.statements,
      ...assignments,
      publicMenuVersionStatement(env.DB, auth.businessId)
    ]);
    return json3({ id: productId }, 201);
  }
  if (request.method === "PUT" && path === "/api/admin/categories/reorder") {
    const body = await readJson(request);
    const items = parseSortItems(body.items);
    if (!items) return json3({ error: "Invalid category sort order" }, 400);
    if (!items.length) return json3({ ok: true });
    const sortJson = JSON.stringify(items);
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM categories
       WHERE business_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`
    ).bind(auth.businessId, sortJson).first();
    if (Number(owned?.total ?? 0) !== items.length)
      return json3({ error: "One or more categories were not found" }, 404);
    await env.DB.prepare(
      `UPDATE categories
       SET sort_order=CAST((
         SELECT json_extract(value, '$.sortOrder') FROM json_each(?)
         WHERE json_extract(value, '$.id')=categories.id
       ) AS INTEGER)
       WHERE business_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`
    ).bind(sortJson, auth.businessId, sortJson).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true });
  }
  if (request.method === "PUT" && path === "/api/admin/products/reorder") {
    const body = await readJson(request);
    const categoryId = String(body.categoryId ?? "");
    const items = parseSortItems(body.items);
    if (!items || !categoryId)
      return json3({ error: "Invalid menu item sort order" }, 400);
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?"
    ).bind(categoryId, auth.businessId).first();
    if (!category) return json3({ error: "Category not found" }, 404);
    if (!items.length) return json3({ ok: true });
    const sortJson = JSON.stringify(items);
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM products
       WHERE business_id=? AND category_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`
    ).bind(auth.businessId, categoryId, sortJson).first();
    if (Number(owned?.total ?? 0) !== items.length)
      return json3({ error: "One or more menu items were not found" }, 404);
    await env.DB.prepare(
      `UPDATE products
       SET sort_order=CAST((
         SELECT json_extract(value, '$.sortOrder') FROM json_each(?)
         WHERE json_extract(value, '$.id')=products.id
       ) AS INTEGER), updated_at=CURRENT_TIMESTAMP
       WHERE business_id=? AND category_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`
    ).bind(sortJson, auth.businessId, categoryId, sortJson).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true });
  }
  const categoryUpdateMatch = path.match(
    /^\/api\/admin\/categories\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "PUT" && categoryUpdateMatch) {
    const categoryId = categoryUpdateMatch[1];
    const existing = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?"
    ).bind(categoryId, auth.businessId).first();
    if (!existing) return json3({ error: "Category not found" }, 404);
    const body = await readJson(request);
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim() || nameKm;
    const nameZh = String(body.nameZh ?? "").trim() || nameKm;
    const imageMediaId = String(body.imageMediaId ?? "");
    let imageObjectKey = "";
    const parentId = body.parentId ? String(body.parentId) : null;
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    const sortOrder2 = parseSortOrder(body.sortOrder);
    if (!nameKm) return json3({ error: "Khmer category name is required" }, 400);
    if (sortOrder2 == null)
      return json3(
        { error: "Sort order must be zero or a positive whole number" },
        400
      );
    if (parentId === categoryId)
      return json3({ error: "A category cannot be its own parent" }, 400);
    if (parentId) {
      const parent = await env.DB.prepare(
        "SELECT id FROM categories WHERE id=? AND business_id=?"
      ).bind(parentId, auth.businessId).first();
      if (!parent) return json3({ error: "Parent category not found" }, 404);
    }
    if (imageMediaId) {
      const image = await env.DB.prepare(
        "SELECT id, object_key AS objectKey FROM media WHERE id=? AND business_id=?"
      ).bind(imageMediaId, auth.businessId).first();
      if (!image) return json3({ error: "Category photo not found" }, 404);
      imageObjectKey = image.objectKey;
    }
    await env.DB.prepare(
      `UPDATE categories SET parent_id=?, name=?, name_km=?, name_en=?, name_zh=?,
       slug=?, image_url=?, image_media_id=?, sort_order=?, is_active=?
       WHERE id=? AND business_id=?`
    ).bind(
      parentId,
      nameKm,
      nameKm,
      nameEn || null,
      nameZh || null,
      recordSlug(
        String(body.slug || nameEn || nameKm),
        "category",
        categoryId
      ),
      imageMediaId ? mediaUrl(
        env,
        imageObjectKey,
        `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${imageMediaId}`
      ) : null,
      imageMediaId || null,
      sortOrder2,
      isActive,
      categoryId,
      auth.businessId
    ).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true });
  }
  if (request.method === "PUT" && path === "/api/admin/products/bulk-info") {
    const body = await readJson(request);
    if (!Array.isArray(body.items) || body.items.length === 0)
      return json3({ error: "At least one menu item is required" }, 400);
    if (body.items.length > 500)
      return json3({ error: "Update no more than 500 menu items at once" }, 400);
    const items = [];
    const productIds = /* @__PURE__ */ new Set();
    const productCodes = /* @__PURE__ */ new Set();
    for (const value of body.items) {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return json3({ error: "Invalid menu item update" }, 400);
      const item = value;
      const productId = String(item.id ?? "").trim();
      const code = String(item.code ?? "").trim();
      const nameKm = String(item.nameKm ?? "").trim();
      const nameEn = String(item.nameEn ?? "").trim();
      const nameZh = String(item.nameZh ?? "").trim();
      const unit = String(item.unit ?? "").trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(productId) || productIds.has(productId))
        return json3({ error: "Invalid or duplicate menu item" }, 400);
      if (code.length > 64)
        return json3(
          { error: "Menu item code must be 64 characters or less" },
          400
        );
      const normalizedCode = code.toLocaleLowerCase();
      if (normalizedCode && productCodes.has(normalizedCode))
        return json3(
          { error: `Menu item code ${code} is used more than once` },
          409
        );
      if (!nameKm) return json3({ error: "Khmer menu name is required" }, 400);
      if (nameKm.length > 240 || nameEn.length > 240 || nameZh.length > 240)
        return json3(
          { error: "Menu item names must be 240 characters or less" },
          400
        );
      if (unit.length > 40)
        return json3(
          { error: "Menu item unit must be 40 characters or less" },
          400
        );
      productIds.add(productId);
      if (normalizedCode) productCodes.add(normalizedCode);
      items.push({ id: productId, code, nameKm, nameEn, nameZh, unit });
    }
    const chunks = Array.from(
      { length: Math.ceil(items.length / 50) },
      (_, index) => items.slice(index * 50, index * 50 + 50)
    );
    const ownedProductIds = /* @__PURE__ */ new Set();
    const existingCodes = /* @__PURE__ */ new Map();
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => "?").join(",");
      const ownedProducts = await env.DB.prepare(
        `SELECT id,code FROM products WHERE business_id=? AND id IN (${placeholders})`
      ).bind(auth.businessId, ...chunk.map((item) => item.id)).all();
      for (const product of ownedProducts.results) {
        ownedProductIds.add(product.id);
        existingCodes.set(product.id, product.code || "");
      }
    }
    if (ownedProductIds.size !== items.length)
      return json3({ error: "One or more menu items were not found" }, 404);
    const requestedCodes = [...productCodes];
    for (let index = 0; index < requestedCodes.length; index += 50) {
      const codeChunk = requestedCodes.slice(index, index + 50);
      const placeholders = codeChunk.map(() => "?").join(",");
      const conflicts = await env.DB.prepare(
        `SELECT id,code FROM products
         WHERE business_id=? AND lower(code) IN (${placeholders})`
      ).bind(auth.businessId, ...codeChunk).all();
      const conflict2 = conflicts.results.find(
        (product) => !productIds.has(product.id)
      );
      if (conflict2)
        return json3(
          {
            error: `Menu item code ${conflict2.code} is already used by your business`
          },
          409
        );
    }
    const changedCodeIds = items.filter(
      (item) => item.code.toLocaleLowerCase() !== (existingCodes.get(item.id) || "").trim().toLocaleLowerCase()
    ).map((item) => item.id);
    for (let index = 0; index < changedCodeIds.length; index += 50) {
      const idChunk = changedCodeIds.slice(index, index + 50);
      const placeholders = idChunk.map(() => "?").join(",");
      await env.DB.prepare(
        `UPDATE products SET code=NULL
         WHERE business_id=? AND id IN (${placeholders})`
      ).bind(auth.businessId, ...idChunk).run();
    }
    for (const chunk of chunks) {
      await env.DB.batch(
        chunk.map(
          (item) => env.DB.prepare(
            `UPDATE products SET code=?, name=?, name_km=?, name_en=?, name_zh=?, slug=?, unit=?,
             updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?`
          ).bind(
            item.code || null,
            item.nameKm,
            item.nameKm,
            item.nameEn || null,
            item.nameZh || null,
            recordSlug(item.nameEn || item.nameKm, "menu-item", item.id),
            item.unit,
            item.id,
            auth.businessId
          )
        )
      );
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true, updated: items.length });
  }
  const productUpdateMatch = path.match(
    /^\/api\/admin\/products\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "PUT" && productUpdateMatch) {
    const productId = productUpdateMatch[1];
    const existing = await env.DB.prepare(
      "SELECT id FROM products WHERE id=? AND business_id=?"
    ).bind(productId, auth.businessId).first();
    if (!existing) return json3({ error: "Menu item not found" }, 404);
    const body = await readJson(request);
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim();
    const nameZh = String(body.nameZh ?? "").trim();
    const options = await productOptions(body, env.DB, auth.businessId);
    if ("error" in options) return json3({ error: options.error }, 400);
    const submittedPriceEntries = body.priceEntries === void 0 ? void 0 : parsePriceEntries(body.priceEntries);
    if (body.priceEntries !== void 0 && !submittedPriceEntries)
      return json3({ error: "Product price entries are invalid" }, 400);
    const submittedBasePrice = Number(body.priceCents ?? 0);
    const { minPrice: basePrice, maxPrice } = productPriceRange(
      options.portions,
      submittedBasePrice
    );
    const sortOrder2 = parseSortOrder(body.sortOrder);
    const code = String(body.code ?? "").trim() || null;
    const ratingInput = body.rating;
    const rating = ratingInput == null || String(ratingInput).trim() === "" ? null : Number(ratingInput);
    const categoryId = String(body.categoryId ?? "");
    const mediaIds = Array.isArray(body.mediaIds) ? [...new Set(body.mediaIds.map(String))].slice(0, 6) : [];
    const primaryMediaId = String(body.primaryMediaId ?? "");
    let primaryObjectKey = "";
    if (!nameKm) return json3({ error: "Khmer menu name is required" }, 400);
    if (sortOrder2 == null)
      return json3(
        { error: "Sort order must be zero or a positive whole number" },
        400
      );
    if (!Number.isFinite(submittedBasePrice) || submittedBasePrice < 0)
      return json3({ error: "Product price must be zero or greater" }, 400);
    if (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5))
      return json3({ error: "Guest rating must be between 0 and 5" }, 400);
    if (code && code.length > 64)
      return json3(
        { error: "Menu item code must be 64 characters or less" },
        400
      );
    if (code) {
      const duplicateCode = await env.DB.prepare(
        `SELECT id FROM products
         WHERE business_id=? AND code=? COLLATE NOCASE AND id<>?`
      ).bind(auth.businessId, code, productId).first();
      if (duplicateCode)
        return json3(
          { error: "This menu item code is already used by your business" },
          409
        );
    }
    if (mediaIds.length > 5)
      return json3({ error: "Upload no more than 5 product photos" }, 400);
    if (mediaIds.length > 0 && !mediaIds.includes(primaryMediaId))
      return json3(
        { error: "Select one uploaded photo as the product photo" },
        400
      );
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?"
    ).bind(categoryId, auth.businessId).first();
    if (!category) return json3({ error: "Category not found" }, 404);
    if (mediaIds.length > 0) {
      const mediaPlaceholders = mediaIds.map(() => "?").join(",");
      const ownedMedia = await env.DB.prepare(
        `SELECT id, object_key AS objectKey FROM media
         WHERE business_id=? AND id IN (${mediaPlaceholders})`
      ).bind(auth.businessId, ...mediaIds).all();
      if (ownedMedia.results.length !== mediaIds.length)
        return json3(
          { error: "One or more product photos were not found" },
          404
        );
      primaryObjectKey = String(
        ownedMedia.results.find(
          (media) => media.id === primaryMediaId
        )?.objectKey ?? ""
      );
    }
    const primaryUrl = primaryMediaId ? mediaUrl(
      env,
      primaryObjectKey,
      `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${primaryMediaId}`
    ) : null;
    if (body.menuIds !== void 0 && disabledControlPages.has("menus"))
      return json3({ error: "The Menus module is disabled" }, 403);
    const assignments = await localMenuAssignments(env.DB, auth.businessId, productId, body.menuIds);
    if (!assignments) return json3({ error: "Choose submenus managed by this business" }, 400);
    const pricing = await productPriceStatements(
      env,
      auth.businessId,
      productId,
      basePrice,
      options.portions,
      submittedPriceEntries || void 0
    );
    if ("error" in pricing) return json3({ error: pricing.error }, 400);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE products SET code=?, rating=?, category_id=?, name=?, name_km=?, name_en=?, name_zh=?,
          slug=?, description=?, price_cents=?, max_price=?, unit=?, portions_json=?, modifier_groups_json=?,
         image_url=?, primary_media_id=?,
         is_featured=?, is_available=?, sort_order=?,
         allow_discount=COALESCE(?,allow_discount), allow_change_price=COALESCE(?,allow_change_price),
         is_open_product=COALESCE(?,is_open_product), allow_free=COALESCE(?,allow_free),
         updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND business_id=?`
      ).bind(
        code,
        rating,
        categoryId,
        nameKm,
        nameKm,
        nameEn || null,
        nameZh || null,
        recordSlug(
          String(body.slug || nameEn || nameKm),
          "menu-item",
          productId
        ),
        String(body.description ?? ""),
        basePrice,
        maxPrice,
        options.unit,
        JSON.stringify(options.portions),
        JSON.stringify(options.modifierGroups),
        primaryUrl,
        primaryMediaId || null,
        body.isFeatured ? 1 : 0,
        body.isAvailable === false ? 0 : 1,
        sortOrder2,
        options.posOptions.allowDiscount,
        options.posOptions.allowChangePrice,
        options.posOptions.isOpenProduct,
        options.posOptions.allowFree,
        productId,
        auth.businessId
      ),
      env.DB.prepare(
        "DELETE FROM product_images WHERE product_id=? AND business_id=?"
      ).bind(productId, auth.businessId),
      ...mediaIds.map(
        (mediaId, index) => env.DB.prepare(
          `INSERT INTO product_images
           (product_id,media_id,business_id,sort_order,is_primary)
           VALUES (?,?,?,?,?)`
        ).bind(
          productId,
          mediaId,
          auth.businessId,
          index,
          mediaId === primaryMediaId ? 1 : 0
        )
      ),
      ...pricing.statements,
      ...assignments,
      publicMenuVersionStatement(env.DB, auth.businessId)
    ]);
    return json3({ ok: true });
  }
  if (request.method === "POST" && path === "/api/admin/banners") {
    const body = await readJson(request);
    const fields2 = bannerFields(body);
    if ("error" in fields2) return json3({ error: fields2.error }, 400);
    const bannerId = id("ban");
    await env.DB.prepare(
      `INSERT INTO banners
       (id,business_id,title,subtitle,image_url,detail_text,cta_label,cta_url,
        is_active,starts_at,ends_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      bannerId,
      auth.businessId,
      fields2.title,
      fields2.subtitle,
      fields2.imageUrl,
      fields2.detailText,
      fields2.ctaLabel,
      fields2.ctaUrl,
      fields2.isActive,
      fields2.startsAt,
      fields2.endsAt
    ).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ id: bannerId }, 201);
  }
  const bannerMatch = path.match(/^\/api\/admin\/banners\/([a-zA-Z0-9_-]+)$/);
  if (request.method === "PUT" && bannerMatch) {
    const bannerId = bannerMatch[1];
    const existing = await env.DB.prepare(
      "SELECT id FROM banners WHERE id=? AND business_id=?"
    ).bind(bannerId, auth.businessId).first();
    if (!existing) return json3({ error: "Banner not found" }, 404);
    const body = await readJson(request);
    const fields2 = bannerFields(body);
    if ("error" in fields2) return json3({ error: fields2.error }, 400);
    await env.DB.prepare(
      `UPDATE banners SET title=?,subtitle=?,image_url=?,detail_text=?,
        cta_label=?,cta_url=?,is_active=?,starts_at=?,ends_at=?
       WHERE id=? AND business_id=?`
    ).bind(
      fields2.title,
      fields2.subtitle,
      fields2.imageUrl,
      fields2.detailText,
      fields2.ctaLabel,
      fields2.ctaUrl,
      fields2.isActive,
      fields2.startsAt,
      fields2.endsAt,
      bannerId,
      auth.businessId
    ).run();
    await invalidatePublicMenu(env, auth.businessId);
    return json3({ ok: true });
  }
  const categoryDeleteMatch = path.match(
    /^\/api\/admin\/categories\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "DELETE" && categoryDeleteMatch) {
    const categoryId = categoryDeleteMatch[1];
    const businessId = auth.businessId;
    const [deleted, , remaining] = await env.DB.batch([
      env.DB.prepare(`DELETE FROM categories WHERE id=?1 AND business_id=?2
        AND NOT EXISTS (SELECT 1 FROM products WHERE category_id=?1 AND business_id=?2)
        AND NOT EXISTS (SELECT 1 FROM categories WHERE parent_id=?1 AND business_id=?2)
        RETURNING id`).bind(categoryId, businessId),
      publicMenuVersionStatement(env.DB, businessId, true),
      env.DB.prepare(`SELECT category.id,
          (SELECT COUNT(*) FROM products WHERE category_id=?1 AND business_id=?2) AS productCount,
          (SELECT COUNT(*) FROM categories WHERE parent_id=?1 AND business_id=?2) AS childCount
        FROM categories category WHERE category.id=?1 AND category.business_id=?2`).bind(categoryId, businessId)
    ]);
    if (deleted.results.length) return json3({ ok: true });
    const category = remaining.results[0];
    if (!category) return json3({ error: "Category not found" }, 404);
    return json3({
      error: "Remove menu items and child categories before deleting this category",
      productCount: category.productCount,
      childCount: category.childCount
    }, 409);
  }
  const deleteMatch = path.match(
    /^\/api\/admin\/(products|banners)\/([a-zA-Z0-9_-]+)$/
  );
  if (request.method === "POST" && path === "/api/admin/products/bulk-delete") {
    const body = await readJson(request).catch(() => null);
    const productIds = body?.productIds;
    if (!Array.isArray(productIds) || !productIds.length || productIds.length > maxProductSelection || productIds.some((id2) => typeof id2 !== "string" || !RECORD_ID_PATTERN.test(id2))) {
      return json3({ error: "Select between 1 and 10,000 products to delete" }, 400);
    }
    return json3(await deleteUnorderedProducts(env.DB, auth.businessId, [...new Set(productIds)]));
  }
  if (request.method === "DELETE" && deleteMatch) {
    const table = deleteMatch[1];
    if (table === "products") {
      const { protectedIds } = await deleteUnorderedProducts(env.DB, auth.businessId, [deleteMatch[2]]);
      if (protectedIds.length)
        return json3({ error: "Products with orders cannot be deleted" }, 409);
      return json3({ ok: true });
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM banners WHERE id=? AND business_id=?").bind(deleteMatch[2], auth.businessId),
      publicMenuVersionStatement(env.DB, auth.businessId)
    ]);
    return json3({ ok: true });
  }
  if (request.method === "POST" && path === "/api/admin/media") {
    const form = await request.formData();
    const file = form.get("file");
    const allowedImageTypes = /* @__PURE__ */ new Set([
      "image/jpeg",
      "image/png",
      "image/webp"
    ]);
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !allowedImageTypes.has(file.type))
      return json3({ error: "Upload a JPG, PNG or WebP image up to 8 MB" }, 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectKey = `businesses/${auth.businessId}/${crypto.randomUUID()}-${safeName}`;
    await env.MEDIA.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable"
      }
    });
    const mediaId = id("med");
    await env.DB.prepare(
      "INSERT INTO media (id,business_id,object_key,filename,content_type,size_bytes) VALUES (?,?,?,?,?,?)"
    ).bind(
      mediaId,
      auth.businessId,
      objectKey,
      file.name,
      file.type,
      file.size
    ).run();
    return json3(
      {
        id: mediaId,
        url: mediaUrl(
          env,
          objectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`
        )
      },
      201
    );
  }
  return json3({ error: "Not found" }, 404);
}
__name(handle, "handle");
var rpcSuccess = /* @__PURE__ */ __name((data) => ({ ok: true, data }), "rpcSuccess");
var rpcFailure = /* @__PURE__ */ __name((status, error3, code) => ({ ok: false, status, error: error3, ...code ? { code } : {} }), "rpcFailure");
function auditStatement(env, actorEmail, action, businessId, userId, details = {}, onlyAfterChanges = false) {
  return env.DB.prepare(
    `INSERT INTO super_admin_audit_log
     (id,actor_email,action,business_id,user_id,details_json)
     SELECT ?,?,?,?,?,?${onlyAfterChanges ? " WHERE changes()>0" : ""}`
  ).bind(
    id("aud"),
    actorEmail,
    action,
    businessId,
    userId,
    JSON.stringify(details)
  );
}
__name(auditStatement, "auditStatement");
function normalizedAdminEmail(value) {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}
__name(normalizedAdminEmail, "normalizedAdminEmail");
function validAccountEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
__name(validAccountEmail, "validAccountEmail");
function withSubscription(row) {
  const item = { ...row };
  const subscription = subscriptionSummary(
    item,
    String(item.timezone || "UTC")
  );
  delete item.subscriptionPlanCode;
  delete item.subscriptionPlanName;
  delete item.subscriptionSource;
  delete item.subscriptionStatus;
  delete item.trialEndsAt;
  delete item.currentPeriodEndAt;
  return { ...item, subscription };
}
__name(withSubscription, "withSubscription");
var CLONE_SECTION_ORDER = [
  "categories",
  "products",
  "pricing",
  "theme",
  "businessSettings"
];
var CLONE_SECTIONS = new Set(CLONE_SECTION_ORDER);
var CloneDataError = class extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
  static {
    __name(this, "CloneDataError");
  }
};
function effectiveCloneSections(value) {
  if (!Array.isArray(value) || !value.length)
    throw new CloneDataError("Choose at least one data section to clone");
  const requested = /* @__PURE__ */ new Set();
  for (const section of value) {
    if (typeof section !== "string" || !CLONE_SECTIONS.has(section))
      throw new CloneDataError("One or more clone sections are invalid");
    requested.add(section);
  }
  if (requested.has("pricing")) requested.add("products");
  if (requested.has("products")) requested.add("categories");
  return CLONE_SECTION_ORDER.filter((section) => requested.has(section));
}
__name(effectiveCloneSections, "effectiveCloneSections");
function parsedJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
__name(parsedJsonObject, "parsedJsonObject");
async function cloneRows(env, sql2, ...bindings) {
  return (await env.DB.prepare(sql2).bind(...bindings).all()).results;
}
__name(cloneRows, "cloneRows");
function cloneCountRow(row) {
  return {
    categories: Number(row?.categories || 0),
    products: Number(row?.products || 0),
    priceLists: Number(row?.priceLists || 0),
    productPrices: Number(row?.productPrices || 0)
  };
}
__name(cloneCountRow, "cloneCountRow");
async function prepareCloneContext(env, targetBusinessId, sourceBusinessId, requestedSections) {
  const sections = effectiveCloneSections(requestedSections);
  if (sourceBusinessId === targetBusinessId)
    throw new CloneDataError(
      "Source and target businesses must be different",
      409,
      "SAME_BUSINESS"
    );
  const countSql = `SELECT
    (SELECT COUNT(*) FROM categories WHERE business_id=?) AS categories,
    (SELECT COUNT(*) FROM products WHERE business_id=?) AS products,
    (SELECT COUNT(*) FROM price_lists WHERE business_id=?) AS priceLists,
    (SELECT COUNT(*) FROM product_prices WHERE business_id=?) AS productPrices`;
  const [source, target, sourceCountResult, targetCountResult] = await Promise.all([
    env.DB.prepare("SELECT * FROM businesses WHERE id=?").bind(sourceBusinessId).first(),
    env.DB.prepare("SELECT * FROM businesses WHERE id=?").bind(targetBusinessId).first(),
    env.DB.prepare(countSql).bind(
      sourceBusinessId,
      sourceBusinessId,
      sourceBusinessId,
      sourceBusinessId
    ).first(),
    env.DB.prepare(countSql).bind(
      targetBusinessId,
      targetBusinessId,
      targetBusinessId,
      targetBusinessId
    ).first()
  ]);
  if (!source) throw new CloneDataError("Source business not found", 404);
  if (!target) throw new CloneDataError("Target business not found", 404);
  const wantsCategories = sections.includes("categories");
  const wantsProducts = sections.includes("products");
  const wantsPricing = sections.includes("pricing");
  const [categories, products, productImages, priceLists, productPrices] = await Promise.all([
    wantsCategories ? cloneRows(
      env,
      "SELECT * FROM categories WHERE business_id=? ORDER BY sort_order,created_at",
      sourceBusinessId
    ) : Promise.resolve([]),
    wantsProducts ? cloneRows(
      env,
      "SELECT * FROM products WHERE business_id=? ORDER BY sort_order,created_at",
      sourceBusinessId
    ) : Promise.resolve([]),
    wantsProducts ? cloneRows(
      env,
      "SELECT * FROM product_images WHERE business_id=? ORDER BY product_id,sort_order",
      sourceBusinessId
    ) : Promise.resolve([]),
    wantsPricing ? cloneRows(
      env,
      "SELECT * FROM price_lists WHERE business_id=? ORDER BY is_normal DESC,created_at",
      sourceBusinessId
    ) : Promise.resolve([]),
    wantsPricing ? cloneRows(
      env,
      "SELECT * FROM product_prices WHERE business_id=?",
      sourceBusinessId
    ) : Promise.resolve([])
  ]);
  const referencedMediaIds = /* @__PURE__ */ new Set();
  if (wantsCategories) {
    for (const category of categories)
      if (category.image_media_id)
        referencedMediaIds.add(String(category.image_media_id));
  }
  if (wantsProducts) {
    for (const product of products)
      if (product.primary_media_id)
        referencedMediaIds.add(String(product.primary_media_id));
    for (const image of productImages)
      if (image.media_id) referencedMediaIds.add(String(image.media_id));
  }
  if (sections.includes("theme")) {
    const theme = parsedJsonObject(source.menu_theme_json);
    for (const { mediaId } of menuThemeImageFields)
      if (theme[mediaId]) referencedMediaIds.add(String(theme[mediaId]));
  }
  if (sections.includes("businessSettings") && source.logo_media_id)
    referencedMediaIds.add(String(source.logo_media_id));
  const allSourceMedia = referencedMediaIds.size ? await cloneRows(
    env,
    "SELECT * FROM media WHERE business_id=?",
    sourceBusinessId
  ) : [];
  const media = allSourceMedia.filter(
    (item) => referencedMediaIds.has(String(item.id))
  );
  const foundMediaIds = new Set(media.map((item) => String(item.id)));
  const missingMediaIds = [...referencedMediaIds].filter(
    (mediaId) => !foundMediaIds.has(mediaId)
  );
  const sourceCounts = cloneCountRow(sourceCountResult);
  const targetCounts = cloneCountRow(targetCountResult);
  const warnings = [];
  const blockers = [];
  const productPortions = products.map((product) => jsonArray(product.portions_json));
  const portionBranchIds = [...new Set(productPortions.flat().flatMap(
    ({ branchId }) => typeof branchId === "string" ? [branchId] : []
  ))];
  if (portionBranchIds.length) {
    const matches = await env.DB.prepare(`SELECT source.id, target.id AS targetId FROM branches source
      JOIN branches target ON target.slug=source.slug AND target.business_id=?
      WHERE source.business_id=? AND source.id IN (SELECT value FROM json_each(?))`).bind(targetBusinessId, sourceBusinessId, JSON.stringify(portionBranchIds)).all();
    if (matches.results.length !== portionBranchIds.length) {
      blockers.push("Create branches with matching link slugs in the target business before cloning branch-specific portions.");
    } else {
      const branchIds = new Map(matches.results.map(({ id: id2, targetId }) => [id2, targetId]));
      for (const [index, portions2] of productPortions.entries()) {
        if (portions2.some((portion) => portion.branchId != null))
          products[index].portions_json = JSON.stringify(portions2.map(
            (portion) => typeof portion.branchId === "string" ? { ...portion, branchId: branchIds.get(portion.branchId) } : portion
          ));
      }
    }
  }
  if (wantsCategories && !wantsProducts && targetCounts.products > 0)
    blockers.push(
      "Products must also be selected because the target currently has products linked to its categories."
    );
  if (missingMediaIds.length)
    blockers.push(
      `${missingMediaIds.length} referenced source image${missingMediaIds.length === 1 ? " is" : "s are"} missing.`
    );
  if (wantsProducts && !wantsPricing)
    warnings.push(
      "Target price-list definitions will be kept, but existing product overrides will be removed and the normal list will be seeded from the cloned products."
    );
  if (wantsCategories && targetCounts.categories > 0 || wantsProducts && targetCounts.products > 0 || wantsPricing && targetCounts.priceLists > 0)
    warnings.push(
      "Existing data in the selected target sections will be replaced."
    );
  let targetNormalPriceListId = null;
  if (wantsProducts && !wantsPricing) {
    const normal = await env.DB.prepare(
      "SELECT id FROM price_lists WHERE business_id=? AND is_normal=1"
    ).bind(targetBusinessId).first();
    targetNormalPriceListId = normal?.id || null;
    if (!targetNormalPriceListId)
      blockers.push("The target business does not have a normal price list.");
  }
  return {
    source,
    target,
    sections,
    categories,
    products,
    productImages,
    priceLists,
    productPrices,
    media,
    referencedMediaIds,
    sourceCounts,
    targetCounts,
    warnings,
    blockers,
    targetNormalPriceListId
  };
}
__name(prepareCloneContext, "prepareCloneContext");
function clonePreviewPayload(context) {
  return {
    source: {
      id: String(context.source.id),
      name: String(context.source.name)
    },
    target: {
      id: String(context.target.id),
      name: String(context.target.name)
    },
    effectiveSections: context.sections,
    sourceCounts: context.sourceCounts,
    targetCounts: context.targetCounts,
    referencedMediaCount: context.referencedMediaIds.size,
    warnings: context.warnings,
    blockers: context.blockers,
    canClone: context.blockers.length === 0
  };
}
__name(clonePreviewPayload, "clonePreviewPayload");
function jsonRowChunks(rows) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  const encoder4 = new TextEncoder();
  for (const row of rows) {
    const bytes = encoder4.encode(JSON.stringify(row)).byteLength + 1;
    if (current.length && currentBytes + bytes > 15e5) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += bytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
__name(jsonRowChunks, "jsonRowChunks");
function cloneInsertStatements(env, rows, sql2, ...bindings) {
  return jsonRowChunks(rows).map(
    (chunk) => env.DB.prepare(sql2).bind(...bindings, JSON.stringify(chunk))
  );
}
__name(cloneInsertStatements, "cloneInsertStatements");
async function withConcurrency(items, limit, operation) {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        await operation(item);
      }
    }
  );
  const results = await Promise.allSettled(workers);
  const failure2 = results.find(
    (result) => result.status === "rejected"
  );
  if (failure2) throw failure2.reason;
}
__name(withConcurrency, "withConcurrency");
async function discardStagedMedia(env, keys) {
  await withConcurrency(keys, 4, async (key) => {
    try {
      await env.MEDIA.delete(key);
    } catch {
      console.warn("clone_media_cleanup_failed", { key });
    }
  });
}
__name(discardStagedMedia, "discardStagedMedia");
async function stageCloneMedia(env, targetBusinessId, sourceMedia) {
  const mediaMap = /* @__PURE__ */ new Map();
  const stagedKeys = [];
  try {
    await withConcurrency(sourceMedia, 2, async (item) => {
      const sourceKey = String(item.object_key || "");
      const object3 = sourceKey ? await env.MEDIA.get(sourceKey) : null;
      if (!object3)
        throw new CloneDataError(
          `Source image ${String(item.filename || item.id)} could not be read`,
          409,
          "SOURCE_MEDIA_MISSING"
        );
      const filename = String(item.filename || "image").slice(0, 255);
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const objectKey = `businesses/${targetBusinessId}/${crypto.randomUUID()}-${safeName}`;
      await env.MEDIA.put(objectKey, object3.body, {
        httpMetadata: object3.httpMetadata,
        customMetadata: object3.customMetadata
      });
      stagedKeys.push(objectKey);
      const mediaId = id("med");
      mediaMap.set(String(item.id), {
        id: mediaId,
        objectKey,
        url: mediaUrl(
          env,
          objectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`
        ),
        filename,
        contentType: String(
          item.content_type || object3.httpMetadata?.contentType || ""
        ),
        sizeBytes: Number(item.size_bytes || object3.size || 0)
      });
    });
    return { mediaMap, stagedKeys };
  } catch (error3) {
    await discardStagedMedia(env, stagedKeys);
    throw error3;
  }
}
__name(stageCloneMedia, "stageCloneMedia");
function cloneIdMap(rows, prefix) {
  return new Map(rows.map((row) => [String(row.id), id(prefix)]));
}
__name(cloneIdMap, "cloneIdMap");
async function executeBusinessClone(env, context, actorEmail) {
  if (context.blockers.length)
    throw new CloneDataError(context.blockers[0], 409, "CLONE_BLOCKED");
  const targetId = String(context.target.id);
  const categoryIds = cloneIdMap(context.categories, "cat");
  const productIds = cloneIdMap(context.products, "prd");
  const priceListIds = cloneIdMap(context.priceLists, "prl");
  const { mediaMap, stagedKeys } = await stageCloneMedia(
    env,
    targetId,
    context.media
  );
  const mappedMedia = [...mediaMap.values()].map((item) => ({
    id: item.id,
    object_key: item.objectKey,
    filename: item.filename,
    content_type: item.contentType,
    size_bytes: item.sizeBytes
  }));
  const mappedCategories = context.categories.map((row) => {
    const image = row.image_media_id ? mediaMap.get(String(row.image_media_id)) : void 0;
    return {
      ...row,
      id: categoryIds.get(String(row.id)),
      parent_id: row.parent_id ? categoryIds.get(String(row.parent_id)) || null : null,
      image_media_id: image?.id || null,
      image_url: image?.url || row.image_url || null
    };
  });
  const mappedCategoryById = new Map(
    mappedCategories.map((row) => [String(row.id), row])
  );
  const categoryDepth = /* @__PURE__ */ __name((row) => {
    let depth = 0;
    let parentId = String(row.parent_id || "");
    const visited = /* @__PURE__ */ new Set();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = mappedCategoryById.get(parentId);
      if (!parent) break;
      depth += 1;
      parentId = String(parent.parent_id || "");
    }
    return depth;
  }, "categoryDepth");
  mappedCategories.sort(
    (left, right) => categoryDepth(left) - categoryDepth(right)
  );
  const mappedProducts = context.products.map(
    (row) => {
      const image = row.primary_media_id ? mediaMap.get(String(row.primary_media_id)) : void 0;
      return {
        ...row,
        id: productIds.get(String(row.id)),
        category_id: categoryIds.get(String(row.category_id)),
        primary_media_id: image?.id || null,
        image_url: image?.url || row.image_url || null
      };
    }
  );
  const mappedProductImages = context.productImages.map((row) => ({
    product_id: productIds.get(String(row.product_id)),
    media_id: mediaMap.get(String(row.media_id))?.id,
    sort_order: row.sort_order,
    is_primary: row.is_primary
  }));
  const mappedPriceLists = context.priceLists.map((row) => ({
    ...row,
    id: priceListIds.get(String(row.id))
  }));
  const mappedProductPrices = context.productPrices.filter(
    (row) => productIds.has(String(row.product_id)) && priceListIds.has(String(row.price_list_id))
  ).map((row) => ({
    price_list_id: priceListIds.get(String(row.price_list_id)),
    product_id: productIds.get(String(row.product_id)),
    target_key: row.target_key,
    price_amount: row.price_amount
  }));
  if (context.sections.includes("products") && !context.sections.includes("pricing")) {
    const normalId = String(context.targetNormalPriceListId);
    for (const product of mappedProducts) {
      const portions2 = (() => {
        try {
          const value = JSON.parse(String(product.portions_json || "[]"));
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })();
      if (!portions2.length)
        mappedProductPrices.push({
          price_list_id: normalId,
          product_id: product.id,
          target_key: "base",
          price_amount: product.price_cents
        });
      for (const portion of portions2)
        if (portion.id != null && portion.priceCents != null)
          mappedProductPrices.push({
            price_list_id: normalId,
            product_id: product.id,
            target_key: String(portion.id),
            price_amount: Number(portion.priceCents)
          });
    }
  }
  const statements = [];
  if (context.sections.includes("pricing"))
    statements.push(
      env.DB.prepare(
        "UPDATE businesses SET default_price_list_id=NULL WHERE id=?"
      ).bind(targetId)
    );
  if (context.sections.includes("products"))
    statements.push(
      env.DB.prepare("DELETE FROM products WHERE business_id=?").bind(targetId)
    );
  if (context.sections.includes("categories"))
    statements.push(
      env.DB.prepare("DELETE FROM categories WHERE business_id=?").bind(
        targetId
      )
    );
  if (context.sections.includes("pricing"))
    statements.push(
      env.DB.prepare("DELETE FROM price_lists WHERE business_id=?").bind(
        targetId
      )
    );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedMedia,
      `INSERT INTO media
       (id,business_id,object_key,filename,content_type,size_bytes)
       SELECT json_extract(value,'$.id'),?,
        json_extract(value,'$.object_key'),json_extract(value,'$.filename'),
        json_extract(value,'$.content_type'),json_extract(value,'$.size_bytes')
       FROM json_each(?)`,
      targetId
    )
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedCategories,
      `INSERT INTO categories
       (id,business_id,parent_id,name,slug,image_url,sort_order,is_active,
        name_km,name_en,name_zh,image_media_id)
       SELECT json_extract(value,'$.id'),?,json_extract(value,'$.parent_id'),
        json_extract(value,'$.name'),json_extract(value,'$.slug'),
        json_extract(value,'$.image_url'),json_extract(value,'$.sort_order'),
        json_extract(value,'$.is_active'),json_extract(value,'$.name_km'),
        json_extract(value,'$.name_en'),json_extract(value,'$.name_zh'),
        json_extract(value,'$.image_media_id')
       FROM json_each(?)`,
      targetId
    )
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedProducts,
      `INSERT INTO products
       (id,business_id,category_id,name,slug,description,price_cents,max_price,
        image_url,calories,prep_minutes,is_featured,is_available,sort_order,
        name_km,name_en,name_zh,primary_media_id,code,unit,portions_json,
        modifier_groups_json,rating,allow_discount,allow_change_price,is_open_product,allow_free)
       SELECT json_extract(value,'$.id'),?,json_extract(value,'$.category_id'),
        json_extract(value,'$.name'),json_extract(value,'$.slug'),
        json_extract(value,'$.description'),json_extract(value,'$.price_cents'),
        json_extract(value,'$.max_price'),json_extract(value,'$.image_url'),
        json_extract(value,'$.calories'),json_extract(value,'$.prep_minutes'),
        json_extract(value,'$.is_featured'),json_extract(value,'$.is_available'),
        json_extract(value,'$.sort_order'),json_extract(value,'$.name_km'),
        json_extract(value,'$.name_en'),json_extract(value,'$.name_zh'),
        json_extract(value,'$.primary_media_id'),json_extract(value,'$.code'),
        json_extract(value,'$.unit'),json_extract(value,'$.portions_json'),
        json_extract(value,'$.modifier_groups_json'),json_extract(value,'$.rating'),
        COALESCE(json_extract(value,'$.allow_discount'),1),
        COALESCE(json_extract(value,'$.allow_change_price'),1),
        COALESCE(json_extract(value,'$.is_open_product'),0),
        COALESCE(json_extract(value,'$.allow_free'),1)
       FROM json_each(?)`,
      targetId
    )
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedProductImages,
      `INSERT INTO product_images
       (product_id,media_id,business_id,sort_order,is_primary)
       SELECT json_extract(value,'$.product_id'),
        json_extract(value,'$.media_id'),?,json_extract(value,'$.sort_order'),
        json_extract(value,'$.is_primary') FROM json_each(?)`,
      targetId
    )
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedPriceLists,
      `INSERT INTO price_lists
       (id,business_id,name,is_normal,schedule_enabled,schedule_start_local,
        schedule_end_local,is_archived)
       SELECT json_extract(value,'$.id'),?,json_extract(value,'$.name'),
        json_extract(value,'$.is_normal'),
        json_extract(value,'$.schedule_enabled'),
        json_extract(value,'$.schedule_start_local'),
        json_extract(value,'$.schedule_end_local'),
        json_extract(value,'$.is_archived') FROM json_each(?)`,
      targetId
    )
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedProductPrices,
      `INSERT INTO product_prices
       (business_id,price_list_id,product_id,target_key,price_amount)
       SELECT ?,json_extract(value,'$.price_list_id'),
        json_extract(value,'$.product_id'),json_extract(value,'$.target_key'),
        json_extract(value,'$.price_amount') FROM json_each(?)`,
      targetId
    )
  );
  const businessChanges = /* @__PURE__ */ new Map();
  const setFromSource = /* @__PURE__ */ __name((column) => {
    const value = context.source[column];
    businessChanges.set(
      column,
      value == null ? null : typeof value === "number" || typeof value === "string" ? value : String(value)
    );
  }, "setFromSource");
  if (context.sections.includes("businessSettings")) {
    for (const column of [
      "tagline",
      "description",
      "phone",
      "address",
      "currency",
      "locale",
      "enable_en",
      "enable_zh",
      "business_hours_json",
      "contact_numbers_json",
      "email",
      "website_url",
      "social_links_json",
      "map_url",
      "map_label",
      "wifi_ssid",
      "wifi_password",
      "wifi_security",
      "show_header_location",
      "show_header_phones",
      "show_header_wifi",
      "show_header_socials",
      "show_header_tagline",
      "show_business_hours",
      "locations_json",
      "secondary_currency",
      "secondary_exchange_rate",
      "show_secondary_currency",
      "enable_add_to_order",
      "timezone",
      "pricing_mode"
    ])
      setFromSource(column);
    const sourceLogoId = String(context.source.logo_media_id || "");
    const logo = sourceLogoId ? mediaMap.get(sourceLogoId) : void 0;
    businessChanges.set("logo_media_id", logo?.id || null);
    businessChanges.set(
      "logo_url",
      logo?.url || String(context.source.logo_url || "") || null
    );
  }
  if (context.sections.includes("pricing")) {
    for (const column of [
      "currency",
      "secondary_currency",
      "secondary_exchange_rate",
      "show_secondary_currency",
      "timezone",
      "pricing_mode"
    ])
      setFromSource(column);
    const sourceDefaultId = String(context.source.default_price_list_id || "");
    const mappedDefault = priceListIds.get(sourceDefaultId) || mappedPriceLists.find((list2) => Number(list2.is_normal) === 1)?.id;
    if (!mappedDefault) {
      await discardStagedMedia(env, stagedKeys);
      throw new CloneDataError(
        "The source business does not have a usable normal price list",
        409,
        "SOURCE_PRICING_INVALID"
      );
    }
    businessChanges.set("default_price_list_id", String(mappedDefault));
  }
  if (context.sections.includes("theme")) {
    const theme = parsedJsonObject(context.source.menu_theme_json);
    for (const { mediaId, url } of menuThemeImageFields) {
      const sourceId = String(theme[mediaId] || "");
      if (!sourceId) continue;
      const image = mediaMap.get(sourceId);
      theme[mediaId] = image?.id || "";
      theme[url] = image?.url || "";
    }
    businessChanges.set("menu_theme_json", JSON.stringify(theme));
    setFromSource("theme_color");
  }
  const assignments = [...businessChanges.keys()].map(
    (column) => `${column}=?`
  );
  const values = [...businessChanges.values()];
  assignments.push(
    "menu_cache_version=menu_cache_version+1",
    "updated_at=CURRENT_TIMESTAMP"
  );
  statements.push(
    env.DB.prepare(
      `UPDATE businesses SET ${assignments.join(",")} WHERE id=?`
    ).bind(...values, targetId)
  );
  const auditId = id("aud");
  statements.push(
    env.DB.prepare(
      `INSERT INTO super_admin_audit_log
       (id,actor_email,action,business_id,user_id,details_json)
       VALUES (?,?,'business.data_cloned',?,NULL,?)`
    ).bind(
      auditId,
      actorEmail,
      targetId,
      JSON.stringify({
        sourceBusinessId: String(context.source.id),
        sourceBusinessName: String(context.source.name),
        targetBusinessName: String(context.target.name),
        sections: context.sections,
        copied: {
          categories: mappedCategories.length,
          products: mappedProducts.length,
          priceLists: mappedPriceLists.length,
          productPrices: mappedProductPrices.length,
          media: mappedMedia.length
        }
      })
    )
  );
  try {
    await env.DB.batch(statements);
  } catch (error3) {
    await discardStagedMedia(env, stagedKeys);
    throw error3;
  }
  return {
    auditId,
    sourceBusinessId: String(context.source.id),
    targetBusinessId: targetId,
    effectiveSections: context.sections,
    copied: {
      categories: mappedCategories.length,
      products: mappedProducts.length,
      priceLists: mappedPriceLists.length,
      productPrices: mappedProductPrices.length,
      media: mappedMedia.length
    }
  };
}
__name(executeBusinessClone, "executeBusinessClone");
var SuperAdminService = class extends WorkerEntrypoint {
  static {
    __name(this, "SuperAdminService");
  }
  async listSubscriptionPlans(actorEmail) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const { results } = await this.env.DB.prepare(
      `SELECT ${planOfferFields},plan.display_order AS displayOrder,
         plan.is_public AS isPublic,plan.is_active AS isActive,
         (SELECT COUNT(*) FROM business_subscriptions WHERE plan_id=plan.id) AS assignedBusinesses
       FROM subscription_plans plan ${planOfferJoin}
       ORDER BY plan.display_order,plan.name,plan.id`
    ).all();
    const plans = results.map((row) => ({
      ...serializePlan(row),
      isPublic: Boolean(row.isPublic),
      isActive: Boolean(row.isActive)
    }));
    return rpcSuccess({ plans });
  }
  async saveSubscriptionPlan(actorEmail, planId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    const { name, description, displayOrder, isPublic, isActive, features, amountMinor, billingInterval } = input;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 80 || typeof description !== "string" || description.length > 500 || typeof displayOrder !== "number" || !Number.isSafeInteger(displayOrder) || displayOrder < 0 || typeof isPublic !== "boolean" || typeof isActive !== "boolean")
      return rpcFailure(400, "Enter valid plan details");
    if (!Array.isArray(features) || controlPageIds.filter((page) => features.includes(page)).length !== features.length)
      return rpcFailure(400, "Select valid Control features");
    if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0 || billingInterval !== "month" && billingInterval !== "year")
      return rpcFailure(400, "Enter a valid USD price and billing period");
    if (!isActive && (isPublic || planId === DEFAULT_PLAN_ID))
      return rpcFailure(400, "Only active plans can be public and Standard must stay active");
    const limits = input.limits === void 0 ? null : parsePlanLimits(input.limits);
    if (input.limits !== void 0 && !limits)
      return rpcFailure(400, "Enter valid whole-number plan limits or leave them blank");
    const hasUserLimit = limits !== null && Object.hasOwn(input.limits, "users");
    const pos = input.pos === void 0 ? null : parsePlanPos(input.pos);
    if (input.pos !== void 0 && !pos)
      return rpcFailure(400, "Choose whether to include POS and enter whole-number POS limits or leave them blank");
    const db = this.env.DB;
    const recordId2 = planId ?? id("plan");
    const planValues = [
      name.trim(),
      description.trim(),
      JSON.stringify(features),
      Number(isActive),
      Number(isPublic),
      displayOrder
    ];
    const interval = amountMinor === 0 ? "month" : billingInterval;
    const priceId = id("price");
    const limitValues = limits ? [limits.branches, limits.menus, limits.products, limits.dailyOrders] : [null, null, null, null];
    const limitUpdate = limits ? ",max_branches=?,max_menus=?,max_products=?,max_daily_orders=?" : "";
    const userLimitUpdate = hasUserLimit ? ",max_users=?" : "";
    const posValues = pos ? [Number(pos.enabled), pos.profiles, pos.dailySales] : [0, null, null];
    const posUpdate = pos ? ",pos_enabled=?,max_pos_profiles=?,max_daily_pos_sales=?" : "";
    const planStatement = planId ? db.prepare(`UPDATE subscription_plans SET name=?,description=?,features_json=?,
          is_active=?,is_public=?,display_order=?,updated_at=CURRENT_TIMESTAMP${limitUpdate}${userLimitUpdate}${posUpdate} WHERE id=?`).bind(...planValues, ...limits ? limitValues : [], ...hasUserLimit ? [limits.users] : [], ...pos ? posValues : [], recordId2) : db.prepare(`INSERT INTO subscription_plans
          (id,code,name,description,features_json,is_active,is_public,display_order,
           max_branches,max_menus,max_products,max_daily_orders,max_users,pos_enabled,max_pos_profiles,max_daily_pos_sales)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(recordId2, recordSlug(name, "plan", recordId2), ...planValues, ...limitValues, limits?.users ?? null, ...posValues);
    const writes = [
      planStatement,
      db.prepare(`UPDATE subscription_plan_prices SET is_active=0,updated_at=CURRENT_TIMESTAMP
        WHERE plan_id=? AND is_active=1 AND currency='USD' AND provider IS NULL AND interval_count=1
          AND (amount_minor<>? OR billing_interval<>?)`).bind(recordId2, amountMinor, interval),
      db.prepare(`INSERT INTO subscription_plan_prices
        (id,plan_id,code,currency,amount_minor,billing_interval)
        SELECT ?,plan.id,?,'USD',?,? FROM subscription_plans plan WHERE plan.id=?
          AND NOT EXISTS (SELECT 1 FROM subscription_plan_prices
            WHERE plan_id=plan.id AND is_active=1 AND currency='USD' AND provider IS NULL AND interval_count=1)`).bind(priceId, priceId, amountMinor, interval, recordId2),
      auditStatement(
        this.env,
        actor,
        planId ? "subscription.plan_updated" : "subscription.plan_created",
        null,
        null,
        {
          planId: recordId2,
          name: name.trim(),
          isPublic,
          isActive,
          features,
          amountMinor,
          billingInterval: interval,
          ...limits ? { limits: input.limits } : {},
          ...pos ? { pos } : {}
        }
      )
    ];
    try {
      const [planWrite] = await db.batch(writes);
      if (!planWrite.meta.changes) return rpcFailure(404, "Plan not found");
    } catch (error3) {
      const limit = planLimitError(error3);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error3;
    }
    return rpcSuccess({ id: recordId2 });
  }
  async removeSubscriptionPlan(actorEmail, planId) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (planId === DEFAULT_PLAN_ID) return rpcFailure(400, "Standard cannot be deleted or archived");
    const db = this.env.DB;
    const [archive, deletion] = await db.batch([
      db.prepare(`UPDATE subscription_plans SET is_active=0,is_public=0,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND EXISTS (SELECT 1 FROM business_subscriptions WHERE plan_id=?)`).bind(planId, planId),
      db.prepare(`DELETE FROM subscription_plans
        WHERE id=? AND NOT EXISTS (SELECT 1 FROM business_subscriptions WHERE plan_id=?)`).bind(planId, planId),
      auditStatement(this.env, actor, "subscription.plan_removed", null, null, { planId })
    ]);
    if (!archive.meta.changes && !deletion.meta.changes) return rpcFailure(404, "Plan not found");
    return rpcSuccess({ archived: Boolean(archive.meta.changes) });
  }
  async assignSubscriptionPlan(actorEmail, businessId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (typeof input.planId !== "string" || typeof input.priceId !== "string")
      return rpcFailure(400, "Choose a plan and price");
    const db = this.env.DB;
    const business2 = await db.prepare("SELECT id FROM businesses WHERE id=?").bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    const plan = await registrationPlan(db, input, false);
    if (!plan) return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
    try {
      await db.batch([
        db.prepare(`INSERT INTO business_subscriptions (id,business_id,plan_id,price_id,source,status)
          VALUES (?,?,(SELECT plan.id FROM subscription_plans plan ${planOfferJoin}
            WHERE plan.id=? AND price.id=? AND plan.is_active=1),?,'manual','active')
          ON CONFLICT(business_id) DO UPDATE SET plan_id=excluded.plan_id,price_id=excluded.price_id,
            updated_at=CURRENT_TIMESTAMP`).bind(id("sub"), businessId, plan.id, plan.priceId, plan.priceId),
        auditStatement(
          this.env,
          actor,
          "subscription.plan_assigned",
          businessId,
          null,
          { planId: plan.id, priceId: plan.priceId }
        )
      ]);
    } catch (error3) {
      if (planChangedDuringSignup(error3)) return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
      const limit = planLimitError(error3);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error3;
    }
    return rpcSuccess({ planId: plan.id });
  }
  async businessBranches(actorEmail, businessId, branchId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    const db = this.env.DB;
    const business2 = await db.prepare("SELECT latitude,longitude FROM businesses WHERE id=?").bind(businessId).first();
    if (!business2)
      return rpcFailure(404, "Business not found");
    if (!input) return rpcSuccess({ branches: (await listBranches(db, businessId)).results });
    const existing = branchId ? await db.prepare(`SELECT id,slug,name,address,phone,map_url AS mapUrl,
      ${branchOrderOverrides.latitude} AS latitude,${branchOrderOverrides.longitude} AS longitude,
      enable_submit_order AS enableSubmitOrder,
      ${branchOrderOverrides.radius} AS orderRadiusMeters,
      is_default AS isDefault,is_active AS isActive
      FROM branches branch WHERE business_id=? AND id=?`).bind(businessId, branchId).first() : null;
    if (branchId && !existing) return rpcFailure(404, "Branch not found");
    const name = String(input.name ?? existing?.name ?? "").trim().slice(0, 160);
    const slug2 = String(input.slug ?? "").trim();
    const active = input.isActive ?? existing?.isActive ?? 1;
    const isActive = active === false || active === 0 ? 0 : 1;
    if (!name || !branchId && (slug2.length > 80 || !BUSINESS_SLUG_PATTERN.test(slug2)))
      return rpcFailure(400, "Enter a branch name and a valid slug");
    if (existing?.isDefault && !isActive) return rpcFailure(400, "The default branch must stay active");
    const branchAddress = String(input.address ?? existing?.address ?? "").trim().slice(0, 500);
    const phone = String(input.phone ?? existing?.phone ?? "").trim().slice(0, 80);
    const mapUrl = input.mapUrl === void 0 ? existing?.mapUrl ?? "" : safeHttpUrl(input.mapUrl);
    const latitude = input.latitude === void 0 ? existing?.latitude ?? null : input.latitude;
    const longitude = input.longitude === void 0 ? existing?.longitude ?? null : input.longitude;
    const radius = input.orderRadiusMeters === void 0 ? existing?.orderRadiusMeters ?? null : input.orderRadiusMeters;
    const enabled = input.enableSubmitOrder === void 0 ? existing?.enableSubmitOrder == null ? null : Boolean(existing.enableSubmitOrder) : input.enableSubmitOrder;
    if (latitude === null !== (longitude === null) || latitude !== null && !validCoordinate(latitude, 90) || longitude !== null && !validCoordinate(longitude, 180))
      return rpcFailure(400, "Enter both valid coordinates or leave both blank");
    if (radius !== null && (typeof radius !== "number" || !Number.isSafeInteger(radius) || radius < 1))
      return rpcFailure(400, "Enter a positive whole ordering radius or leave it blank");
    if (enabled !== null && typeof enabled !== "boolean")
      return rpcFailure(400, "Choose whether to inherit, enable, or disable order submission");
    if (enabled && (!validCoordinate(latitude ?? business2.latitude, 90) || !validCoordinate(longitude ?? business2.longitude, 180)))
      return rpcFailure(400, "Set the branch or business location before enabling order submission");
    if (!existing?.isDefault && input.mapUrl && !mapUrl) return rpcFailure(400, "Enter a valid map URL");
    const recordId2 = branchId ?? id("br");
    const policy = [
      latitude,
      longitude,
      Number(latitude !== null),
      enabled === null ? null : Number(enabled),
      radius ?? 100,
      Number(radius === null)
    ];
    const updatePolicy = `latitude=COALESCE(?,latitude),longitude=COALESCE(?,longitude),
      has_order_location_override=?,enable_submit_order=?,order_radius_meters=?,use_business_order_radius=?`;
    const profile = [branchAddress, phone, mapUrl ?? "", isActive];
    const write = existing?.isDefault ? db.prepare(`UPDATE branches SET name=?,${updatePolicy}
          WHERE business_id=? AND id=?`).bind(name, ...policy, businessId, recordId2) : branchId ? db.prepare(`UPDATE branches SET name=?,address=?,phone=?,map_url=?,is_active=?,${updatePolicy}
            WHERE business_id=? AND id=?`).bind(name, ...profile, ...policy, businessId, recordId2) : db.prepare(`INSERT INTO branches (id,business_id,slug,name,address,phone,map_url,is_active,
            latitude,longitude,has_order_location_override,enable_submit_order,order_radius_meters,use_business_order_radius)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(recordId2, businessId, slug2, name, ...profile, ...policy);
    try {
      await db.batch([
        write,
        publicMenuVersionStatement(db, businessId),
        auditStatement(this.env, actor, branchId ? "branch.updated" : "branch.created", businessId, null, { branchId: recordId2, name, isActive })
      ]);
    } catch (error3) {
      if (String(error3).includes("UNIQUE constraint failed: branches.business_id, branches.slug"))
        return rpcFailure(409, "This branch slug is already in use");
      if (String(error3).includes("POS_BRANCH_HAS_ACTIVITY"))
        return rpcFailure(409, "Resolve this branch's open POS bills, shifts, and working day before disabling it", "POS_BRANCH_HAS_ACTIVITY");
      const limit = planLimitError(error3);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error3;
    }
    return rpcSuccess({ branches: (await listBranches(db, businessId)).results });
  }
  async branchWebhooks(actorEmail, businessId, branchId, action, id2, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId) || !RECORD_ID_PATTERN.test(branchId) || id2 !== null && !RECORD_ID_PATTERN.test(id2)) return rpcFailure(400, "Invalid webhook scope or ID");
    const result = await manageBranchWebhooks(this.env, actor, businessId, branchId, action, id2, input);
    if (result.ok && action === "retry") scheduleBranchWebhooks(this.env, this.ctx, businessId);
    return result;
  }
  async clearWebhookHistory(actorEmail, businessId, branchId, webhookId) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId) || branchId !== null && !RECORD_ID_PATTERN.test(branchId) || webhookId !== null && (branchId === null || !RECORD_ID_PATTERN.test(webhookId)))
      return rpcFailure(400, "Invalid webhook scope or ID");
    return clearWebhookHistory(this.env, actor, businessId, branchId, webhookId);
  }
  async resetData(actorEmail, businessId, action, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    if (action !== "backup" && action !== "delete" || !input || typeof input !== "object" || Array.isArray(input))
      return rpcFailure(400, "Expected a valid reset request");
    const result = await resetBusinessData(this.env, actor, businessId, action, input);
    if (result.ok && action === "delete" && input.sendDeletedWebhooks === true)
      scheduleBranchWebhooks(this.env, this.ctx, businessId);
    return result;
  }
  async manageBooking(actorEmail, businessId, action, method, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    if (!input || typeof input !== "object" || Array.isArray(input))
      return rpcFailure(400, "Expected a valid JSON object");
    return manageBookingSettings(
      this.env,
      businessId,
      action,
      method,
      input,
      (event) => auditStatement(this.env, actor, event, businessId, null)
    );
  }
  async manageBusinessPosIntegration(actorEmail, businessId, method, input = {}) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const business2 = await this.env.DB.prepare(
      "SELECT id FROM businesses WHERE id=?"
    ).bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    const syncUrl = new URL(
      "/api/integrations/pos/sync",
      this.env.PUBLIC_ASSET_BASE
    ).href;
    if (method === "GET")
      return rpcSuccess({
        integration: await getPosIntegration(this.env, businessId),
        syncUrl
      });
    if (method === "PUT") {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => key !== "name"))
        return rpcFailure(400, "Provide only an integration name");
      const name = input.name === void 0 ? "POS" : input.name;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 120)
        return rpcFailure(
          400,
          "Integration name must be between 1 and 120 characters"
        );
      const result = await issuePosApiKey(
        this.env,
        businessId,
        name.trim(),
        auditStatement(
          this.env,
          actor,
          "pos_integration.key_issued",
          businessId,
          null,
          { name: name.trim() }
        )
      );
      return rpcSuccess({
        ...result,
        integration: await getPosIntegration(this.env, businessId),
        syncUrl
      });
    }
    if (method === "DELETE") {
      const result = await revokePosIntegration(
        this.env,
        businessId,
        auditStatement(
          this.env,
          actor,
          "pos_integration.disconnected",
          businessId,
          null
        )
      );
      return rpcSuccess({ ...result, integration: null, syncUrl });
    }
    return rpcFailure(405, "Method not allowed");
  }
  async dashboard(actorEmail) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const [users, businesses, recent, activity] = await Promise.all([
      this.env.DB.prepare("SELECT COUNT(*) AS total FROM users").first(),
      this.env.DB.prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) AS disabled,
          SUM(CASE WHEN bs.status IN ('past_due','canceled') OR
            (bs.current_period_end_at IS NOT NULL
             AND datetime(bs.current_period_end_at)<=datetime('now')) THEN 1 ELSE 0 END) AS expired,
          SUM(CASE WHEN bs.status IN ('trialing','active') AND bs.current_period_end_at IS NOT NULL
            AND datetime(bs.current_period_end_at)>datetime('now')
            AND datetime(bs.current_period_end_at)<=datetime('now','+7 days') THEN 1 ELSE 0 END) AS expiringSoon,
          SUM(CASE WHEN bs.id IS NULL OR
            (bs.status IN ('trialing','active') AND bs.current_period_end_at IS NULL) THEN 1 ELSE 0 END) AS unlimited
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id=b.id`
      ).first(),
      this.env.DB.prepare(
        `SELECT b.id,b.name,b.slug,b.timezone,b.is_active AS isActive,b.created_at AS createdAt,
          sp.code AS subscriptionPlanCode,sp.name AS subscriptionPlanName,
          bs.source AS subscriptionSource,bs.status AS subscriptionStatus,
          bs.trial_ends_at AS trialEndsAt,bs.current_period_end_at AS currentPeriodEndAt,
          (SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id
           WHERE m.business_id=b.id AND m.role='owner'
           ORDER BY m.created_at LIMIT 1) AS ownerEmail
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
         LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
         ORDER BY b.created_at DESC LIMIT 6`
      ).all(),
      this.env.DB.prepare(
        `SELECT id,actor_email AS actorEmail,action,business_id AS businessId,
          user_id AS userId,details_json AS detailsJson,created_at AS createdAt
         FROM super_admin_audit_log ORDER BY created_at DESC LIMIT 10`
      ).all()
    ]);
    return rpcSuccess({
      totals: {
        users: Number(users?.total || 0),
        businesses: Number(businesses?.total || 0),
        active: Number(businesses?.active || 0),
        disabled: Number(businesses?.disabled || 0),
        expired: Number(businesses?.expired || 0),
        expiringSoon: Number(businesses?.expiringSoon || 0),
        unlimited: Number(businesses?.unlimited || 0)
      },
      recentBusinesses: recent.results.map(
        (row) => withSubscription(row)
      ),
      recentActivity: activity.results.map((entry) => {
        const { detailsJson, ...item } = entry;
        let details = {};
        try {
          details = JSON.parse(String(detailsJson || "{}"));
        } catch {
        }
        return { ...item, details };
      })
    });
  }
  async listBusinesses(actorEmail, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const query = String(input.q || "").trim().slice(0, 100);
    const status = ["active", "disabled"].includes(String(input.status)) ? String(input.status) : "all";
    const subscriptionStatus = [
      "current",
      "expiring",
      "expired",
      "unlimited"
    ].includes(String(input.subscriptionStatus)) ? String(input.subscriptionStatus) : "all";
    const page = Math.max(1, Math.floor(Number(input.page) || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Math.floor(Number(input.pageSize) || 25))
    );
    const clauses = [];
    const bindings = [];
    if (query) {
      clauses.push(
        `(b.name LIKE ? OR b.slug LIKE ? OR EXISTS (
          SELECT 1 FROM memberships sm JOIN users su ON su.id=sm.user_id
          WHERE sm.business_id=b.id AND su.email LIKE ?))`
      );
      const like = `%${query}%`;
      bindings.push(like, like, like);
    }
    if (status !== "all") {
      clauses.push("b.is_active=?");
      bindings.push(status === "active" ? 1 : 0);
    }
    if (subscriptionStatus === "current")
      clauses.push(
        `(bs.id IS NULL OR (bs.status IN ('trialing','active') AND
          (bs.current_period_end_at IS NULL OR datetime(bs.current_period_end_at)>datetime('now'))))`
      );
    if (subscriptionStatus === "expiring")
      clauses.push(
        `bs.status IN ('trialing','active') AND bs.current_period_end_at IS NOT NULL AND
         datetime(bs.current_period_end_at)>datetime('now') AND
         datetime(bs.current_period_end_at)<=datetime('now','+7 days')`
      );
    if (subscriptionStatus === "expired")
      clauses.push(
        `(bs.status IN ('past_due','canceled') OR
          (bs.current_period_end_at IS NOT NULL AND datetime(bs.current_period_end_at)<=datetime('now')))`
      );
    if (subscriptionStatus === "unlimited")
      clauses.push(
        `(bs.id IS NULL OR (bs.status IN ('trialing','active') AND bs.current_period_end_at IS NULL))`
      );
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = await this.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM businesses b
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id ${where}`
    ).bind(...bindings).first();
    const rows = await this.env.DB.prepare(
      `SELECT b.id,b.name,b.slug,b.timezone,b.is_active AS isActive,b.created_at AS createdAt,
        b.updated_at AS updatedAt,sp.code AS subscriptionPlanCode,
        sp.name AS subscriptionPlanName,bs.source AS subscriptionSource,
        bs.status AS subscriptionStatus,bs.trial_ends_at AS trialEndsAt,
        bs.current_period_end_at AS currentPeriodEndAt,
        (SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id
         WHERE m.business_id=b.id AND m.role='owner'
         ORDER BY m.created_at LIMIT 1) AS ownerEmail,
        (SELECT COUNT(*) FROM memberships m WHERE m.business_id=b.id) AS memberCount,
        (SELECT COUNT(*) FROM products p WHERE p.business_id=b.id) AS productCount
       FROM businesses b
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
       LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id ${where}
       ORDER BY b.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...bindings, pageSize, (page - 1) * pageSize).all();
    return rpcSuccess({
      items: rows.results.map(
        (row) => withSubscription(row)
      ),
      page,
      pageSize,
      total: Number(total?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(total?.total || 0) / pageSize))
    });
  }
  async businessDetail(actorEmail, businessId) {
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const [business2, members2, counts] = await Promise.all([
      this.env.DB.prepare(
        `SELECT b.id,b.name,b.slug,b.tagline,b.description,b.phone,b.address,
          b.email AS contactEmail,b.website_url AS websiteUrl,
          b.custom_menu_url AS customMenuUrl,b.currency,b.locale,b.timezone,
          b.allow_category_browsing AS allowCategoryBrowsing,
          b.latitude,b.longitude,b.enable_submit_order AS enableSubmitOrder,
          b.order_radius_meters AS orderRadiusMeters,
          b.hourly_device_order_limit AS hourlyDeviceOrderLimit,
          b.disabled_control_pages_json AS disabledControlPagesJson,
          b.subscription_plan_id AS subscriptionPlanId,
          b.is_active AS isActive,b.created_at AS createdAt,b.updated_at AS updatedAt,
          sp.code AS subscriptionPlanCode,sp.name AS subscriptionPlanName,
          bs.source AS subscriptionSource,bs.status AS subscriptionStatus,
          bs.trial_ends_at AS trialEndsAt,bs.current_period_end_at AS currentPeriodEndAt
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
         LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
         WHERE b.id=?`
      ).bind(businessId).first(),
      this.env.DB.prepare(
        `SELECT u.id,u.email,u.display_name AS displayName,m.role,
          u.created_at AS createdAt
         FROM memberships m JOIN users u ON u.id=m.user_id
         WHERE m.business_id=? ORDER BY
          CASE m.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
          m.created_at`
      ).bind(businessId).all(),
      this.env.DB.prepare(
        `SELECT
          (SELECT COUNT(*) FROM products WHERE business_id=?) AS products,
          (SELECT COUNT(*) FROM categories WHERE business_id=?) AS categories,
          (SELECT COUNT(*) FROM banners WHERE business_id=?) AS banners,
          (SELECT COUNT(*) FROM restaurant_tables WHERE business_id=?) AS tables,
          (SELECT COUNT(*) FROM memberships WHERE business_id=?) AS members`
      ).bind(businessId, businessId, businessId, businessId, businessId).first()
    ]);
    if (!business2) return rpcFailure(404, "Business not found");
    const { disabledControlPagesJson, ...businessDetail } = business2;
    return rpcSuccess({
      business: {
        ...withSubscription(businessDetail),
        allowCategoryBrowsing: Boolean(business2.allowCategoryBrowsing),
        enableSubmitOrder: Boolean(business2.enableSubmitOrder),
        disabledControlPages: jsonArray(disabledControlPagesJson)
      },
      members: members2.results,
      counts
    });
  }
  async previewBusinessClone(actorEmail, targetBusinessId, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const sourceBusinessId = String(input.sourceBusinessId || "");
    if (!RECORD_ID_PATTERN.test(targetBusinessId) || !RECORD_ID_PATTERN.test(sourceBusinessId))
      return rpcFailure(400, "Source or target business ID is invalid");
    try {
      const context = await prepareCloneContext(
        this.env,
        targetBusinessId,
        sourceBusinessId,
        input.sections
      );
      return rpcSuccess(clonePreviewPayload(context));
    } catch (error3) {
      if (error3 instanceof CloneDataError)
        return rpcFailure(error3.status, error3.message, error3.code);
      throw error3;
    }
  }
  async cloneBusinessData(actorEmail, targetBusinessId, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const sourceBusinessId = String(input.sourceBusinessId || "");
    if (!RECORD_ID_PATTERN.test(targetBusinessId) || !RECORD_ID_PATTERN.test(sourceBusinessId))
      return rpcFailure(400, "Source or target business ID is invalid");
    try {
      const context = await prepareCloneContext(
        this.env,
        targetBusinessId,
        sourceBusinessId,
        input.sections
      );
      if (String(input.confirmationName || "") !== String(context.target.name))
        return rpcFailure(
          400,
          "Type the target business name exactly to confirm",
          "CONFIRMATION_MISMATCH"
        );
      return rpcSuccess(
        await executeBusinessClone(
          this.env,
          context,
          normalizedAdminEmail(actorEmail)
        )
      );
    } catch (error3) {
      if (error3 instanceof CloneDataError)
        return rpcFailure(error3.status, error3.message, error3.code);
      const limit = planLimitError(error3);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error3;
    }
  }
  async createBusiness(actorEmail, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const email = normalizedAdminEmail(input.ownerEmail);
    const displayName = String(input.ownerDisplayName || "").trim().slice(0, 120);
    const businessName = String(input.businessName || "").trim().slice(0, 160);
    const businessSlug = String(input.slug || "").trim().toLowerCase();
    const passwordProof = String(input.passwordProof || "").toLowerCase();
    if (!validAccountEmail(email) || !displayName || businessName.length < 2 || businessSlug.length < 3 || businessSlug.length > 48 || !BUSINESS_SLUG_PATTERN.test(businessSlug) || input.authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(passwordProof))
      return rpcFailure(400, "Please provide valid registration details");
    if (!authConfigured(this.env))
      return rpcFailure(503, "Authentication is not configured");
    const [existingUser, existingBusiness] = await Promise.all([
      this.env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first(),
      businessSlugOwner(this.env.DB, businessSlug)
    ]);
    if (existingUser)
      return rpcFailure(409, "Email is already in use", "EMAIL_IN_USE");
    if (existingBusiness)
      return rpcFailure(409, "Menu link is already in use", "SLUG_IN_USE");
    const plan = await registrationPlan(this.env.DB, input, false);
    if (!plan) return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
    try {
      const created = await provisionBusiness(this.env, {
        email,
        displayName,
        businessName,
        businessSlug,
        passwordProof,
        plan,
        publicSignup: false,
        actorEmail: normalizedAdminEmail(actorEmail)
      });
      return rpcSuccess(created);
    } catch (error3) {
      if (planChangedDuringSignup(error3))
        return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
      if (businessSlugConflict(error3))
        return rpcFailure(409, "Menu link is already in use", "SLUG_IN_USE");
      return rpcFailure(
        409,
        "Email or menu link is already in use",
        "REGISTRATION_CONFLICT"
      );
    }
  }
  async createBusinessMember(actorEmail, businessId, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const email = normalizedAdminEmail(input.email);
    const displayName = String(input.displayName || "").trim().slice(0, 120);
    const passwordProof = String(input.passwordProof || "").toLowerCase();
    if (!validAccountEmail(email) || !displayName || input.authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(passwordProof))
      return rpcFailure(400, "Please provide valid account details");
    if (!authConfigured(this.env))
      return rpcFailure(503, "Authentication is not configured");
    const [business2, existingUser] = await Promise.all([
      this.env.DB.prepare("SELECT id,name FROM businesses WHERE id=?").bind(businessId).first(),
      this.env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first()
    ]);
    if (!business2) return rpcFailure(404, "Business not found");
    if (existingUser)
      return rpcFailure(409, "Email is already in use", "EMAIL_IN_USE");
    const userId = id("usr");
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const credential = await credentialHash(
      passwordProof,
      this.env.AUTH_PEPPER
    );
    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `INSERT INTO users
            (id,email,display_name,password_hash,password_salt,created_at)
           VALUES (?,?,?,?,?,?)`
        ).bind(
          userId,
          email,
          displayName,
          credential.hash,
          credential.salt,
          createdAt
        ),
        this.env.DB.prepare(
          `INSERT INTO memberships
            (user_id,business_id,role,created_at)
           VALUES (?,?,'manager',?)`
        ).bind(userId, businessId, createdAt),
        auditStatement(
          this.env,
          normalizedAdminEmail(actorEmail),
          "business.member_created",
          businessId,
          userId,
          { businessName: business2.name, displayName, email, role: "manager" }
        )
      ]);
      return rpcSuccess({
        id: userId,
        email,
        displayName,
        role: "manager",
        createdAt
      });
    } catch (error3) {
      const limit = planLimitError(error3);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      return rpcFailure(
        409,
        "Email is already in use",
        "MEMBER_CREATION_CONFLICT"
      );
    }
  }
  async setBusinessStatus(actorEmail, businessId, isActive) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const business2 = await this.env.DB.prepare(
      "SELECT id,name,is_active AS isActive FROM businesses WHERE id=?"
    ).bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE businesses SET is_active=?,menu_cache_version=menu_cache_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).bind(isActive ? 1 : 0, businessId),
      ...!isActive ? [
        this.env.DB.prepare(
          `DELETE FROM sessions WHERE business_id=? OR user_id IN
                (SELECT user_id FROM memberships WHERE business_id=?)`
        ).bind(businessId, businessId)
      ] : [],
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        isActive ? "business.enabled" : "business.disabled",
        businessId,
        null,
        { businessName: business2.name }
      )
    ]);
    return rpcSuccess({ id: businessId, isActive });
  }
  async updateBusinessSubscription(actorEmail, businessId, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    if (!(input.expiresOn === null || typeof input.expiresOn === "string"))
      return rpcFailure(400, "expiresOn must be a date or null");
    const business2 = await this.env.DB.prepare(
      `SELECT b.id,b.name,b.timezone,sp.code AS subscriptionPlanCode,
        sp.name AS subscriptionPlanName,bs.source AS subscriptionSource,
        bs.status AS subscriptionStatus,bs.trial_ends_at AS trialEndsAt,
        bs.current_period_end_at AS currentPeriodEndAt
       FROM businesses b
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
       LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
       WHERE b.id=?`
    ).bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    const expiresOn = input.expiresOn;
    const periodEnd = expiresOn ? endOfLocalDateUtc(expiresOn, String(business2.timezone || "UTC")) : null;
    if (expiresOn && !periodEnd)
      return rpcFailure(400, "Expiry date or business timezone is invalid");
    const previous = subscriptionSummary(
      business2,
      String(business2.timezone || "UTC")
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO business_subscriptions
          (id,business_id,plan_id,price_id,source,status,trial_ends_at,
           current_period_start_at,current_period_end_at,created_at,updated_at)
         VALUES (?,?,?,(SELECT price.id FROM subscription_plans plan ${planOfferJoin} WHERE plan.id=?),
           ?,'active',NULL,?,?,?,?)
         ON CONFLICT(business_id) DO UPDATE SET
           source='manual',status='active',trial_ends_at=NULL,
           current_period_end_at=excluded.current_period_end_at,
           cancel_at_period_end=0,provider=NULL,provider_customer_id=NULL,
           provider_subscription_id=NULL,updated_at=excluded.updated_at`
      ).bind(
        id("sub"),
        businessId,
        DEFAULT_PLAN_ID,
        DEFAULT_PLAN_ID,
        "manual",
        now,
        periodEnd,
        now,
        now
      ),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        "subscription.expiry_updated",
        businessId,
        null,
        {
          businessName: business2.name,
          previousExpiresOn: previous.expiresOn,
          expiresOn
        }
      )
    ]);
    return rpcSuccess(
      subscriptionSummary(
        {
          subscriptionPlanCode: String(
            business2.subscriptionPlanCode || "standard"
          ),
          subscriptionPlanName: String(
            business2.subscriptionPlanName || "Standard"
          ),
          subscriptionSource: "manual",
          subscriptionStatus: "active",
          trialEndsAt: null,
          currentPeriodEndAt: periodEnd
        },
        String(business2.timezone || "UTC")
      )
    );
  }
  async updateBusinessControlPages(actorEmail, businessId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const requested = input.disabledControlPages;
    if (!Array.isArray(requested) || requested.length > controlPageIds.length)
      return rpcFailure(400, "Provide a list of disabled Control pages");
    const disabledControlPages = controlPageIds.filter(
      (page) => requested.includes(page)
    );
    if (disabledControlPages.length !== requested.length)
      return rpcFailure(
        400,
        "The list contains an unknown or duplicate Control page"
      );
    const business2 = await this.env.DB.prepare(
      "SELECT id FROM businesses WHERE id=?"
    ).bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    const settings = { disabledControlPages };
    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE businesses SET disabled_control_pages_json=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=?`
      ).bind(JSON.stringify(disabledControlPages), businessId),
      auditStatement(
        this.env,
        actor,
        "business.control_pages_updated",
        businessId,
        null,
        settings
      )
    ]);
    return rpcSuccess(settings);
  }
  async updateBusinessOrderingSettings(actorEmail, businessId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const {
      latitude,
      longitude,
      enableSubmitOrder,
      orderRadiusMeters,
      hourlyDeviceOrderLimit
    } = input;
    if (latitude !== null && !validCoordinate(latitude, 90))
      return rpcFailure(400, "Latitude must be between -90 and 90");
    if (longitude !== null && !validCoordinate(longitude, 180))
      return rpcFailure(400, "Longitude must be between -180 and 180");
    if (typeof enableSubmitOrder !== "boolean")
      return rpcFailure(400, "Select whether order submission is enabled");
    if (latitude === null !== (longitude === null) || enableSubmitOrder && latitude === null)
      return rpcFailure(
        400,
        "Enter both latitude and longitude to set the business location"
      );
    if (typeof orderRadiusMeters !== "number" || !Number.isSafeInteger(orderRadiusMeters) || orderRadiusMeters < 1)
      return rpcFailure(
        400,
        "Order radius must be a positive whole number of meters"
      );
    if (hourlyDeviceOrderLimit !== void 0 && (typeof hourlyDeviceOrderLimit !== "number" || !Number.isInteger(hourlyDeviceOrderLimit) || hourlyDeviceOrderLimit < 0 || hourlyDeviceOrderLimit > 999))
      return rpcFailure(
        400,
        "Hourly QR order limit per device must be a whole number from 0 to 999"
      );
    const business2 = await this.env.DB.prepare(
      "SELECT id FROM businesses WHERE id=?"
    ).bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    const settings = {
      latitude,
      longitude,
      enableSubmitOrder,
      orderRadiusMeters,
      hourlyDeviceOrderLimit
    };
    const [update] = await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE businesses SET latitude=?,longitude=?,enable_submit_order=?,order_radius_meters=?,
         hourly_device_order_limit=COALESCE(?,hourly_device_order_limit),
         menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?
         RETURNING hourly_device_order_limit AS hourlyDeviceOrderLimit`
      ).bind(
        latitude,
        longitude,
        Number(enableSubmitOrder),
        orderRadiusMeters,
        hourlyDeviceOrderLimit ?? null,
        businessId
      ),
      auditStatement(
        this.env,
        actor,
        "business.ordering_settings_updated",
        businessId,
        null,
        settings
      )
    ]);
    return rpcSuccess({ ...settings, ...update.results[0] });
  }
  async renameBusinessSlug(actorEmail, businessId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    const slug2 = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
    if (slug2.length < 3 || slug2.length > 48 || !BUSINESS_SLUG_PATTERN.test(slug2))
      return rpcFailure(400, "Use 3\u201348 lowercase letters, numbers, or single hyphens", "INVALID_MENU_SLUG");
    const db = this.env.DB;
    const previous = await db.prepare("SELECT slug FROM businesses WHERE id=?").bind(businessId).first("slug");
    if (previous === null) return rpcFailure(404, "Business not found");
    if (slug2 === previous) return rpcSuccess({ slug: slug2 });
    const stale = /* @__PURE__ */ __name(() => rpcFailure(409, "The menu link changed. Reload this page and try again", "SLUG_CHANGED"), "stale");
    if (input.previousSlug !== previous) return stale();
    try {
      const [updated] = await db.batch([
        db.prepare(`UPDATE businesses SET slug=?,menu_cache_version=menu_cache_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=? AND slug=?`).bind(slug2, businessId, previous),
        auditStatement(this.env, actor, "business.slug_updated", businessId, null, { previousSlug: previous, slug: slug2 }, true)
      ]);
      return updated.meta.changes ? rpcSuccess({ slug: slug2 }) : stale();
    } catch (error3) {
      if (businessSlugConflict(error3)) return rpcFailure(409, "Menu link is already in use", "SLUG_IN_USE");
      throw error3;
    }
  }
  async updateBusinessMenuBrowsing(actorEmail, businessId, input) {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    const { allowCategoryBrowsing } = input;
    if (typeof allowCategoryBrowsing !== "boolean")
      return rpcFailure(400, "Select whether browsing by product category is allowed");
    const db = this.env.DB;
    if (!await db.prepare("SELECT id FROM businesses WHERE id=?").bind(businessId).first())
      return rpcFailure(404, "Business not found");
    const settings = { allowCategoryBrowsing };
    await db.batch([
      db.prepare(`UPDATE businesses SET allow_category_browsing=?,
        menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(Number(allowCategoryBrowsing), businessId),
      auditStatement(this.env, actor, "business.menu_browsing_updated", businessId, null, settings)
    ]);
    return rpcSuccess(settings);
  }
  async updateBusinessCustomMenuUrl(actorEmail, businessId, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const customMenu = customMenuOrigin(input.customMenuUrl);
    if (customMenu === null)
      return rpcFailure(
        400,
        "Custom menu URL must be an HTTPS origin without a path, query, or fragment"
      );
    const business2 = await this.env.DB.prepare(
      "SELECT id,name FROM businesses WHERE id=?"
    ).bind(businessId).first();
    if (!business2) return rpcFailure(404, "Business not found");
    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `UPDATE businesses SET custom_menu_url=?,custom_menu_hostname=?,
           menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP
           WHERE id=?`
        ).bind(customMenu.url, customMenu.hostname, businessId),
        auditStatement(
          this.env,
          normalizedAdminEmail(actorEmail),
          "business.custom_menu_url_updated",
          businessId,
          null,
          {
            businessName: business2.name,
            customMenuUrl: customMenu.url,
            customMenuHostname: customMenu.hostname
          }
        )
      ]);
    } catch (error3) {
      if (String(error3).toLowerCase().includes("unique"))
        return rpcFailure(
          409,
          "This custom menu domain is already assigned to another business"
        );
      throw error3;
    }
    await invalidatePublicMenu(this.env, businessId);
    return rpcSuccess({
      id: businessId,
      customMenuUrl: customMenu.url,
      customMenuHostname: customMenu.hostname
    });
  }
  async updateCredentials(actorEmail, userId, input) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(userId))
      return rpcFailure(400, "User ID is invalid");
    const newEmail = normalizedAdminEmail(input.email);
    const passwordProof = String(input.passwordProof || "").toLowerCase();
    if (!validAccountEmail(newEmail) || input.authVersion !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(passwordProof))
      return rpcFailure(400, "Please provide valid credential details");
    if (!authConfigured(this.env))
      return rpcFailure(503, "Authentication is not configured");
    const user = await this.env.DB.prepare(
      `SELECT u.id,u.email,m.business_id AS businessId
       FROM users u LEFT JOIN memberships m ON m.user_id=u.id
       WHERE u.id=? ORDER BY m.created_at LIMIT 1`
    ).bind(userId).first();
    if (!user) return rpcFailure(404, "User not found");
    const duplicate = await this.env.DB.prepare(
      "SELECT id FROM users WHERE email=? AND id<>?"
    ).bind(newEmail, userId).first();
    if (duplicate)
      return rpcFailure(409, "New email is already in use", "EMAIL_IN_USE");
    const credential = await credentialHash(
      passwordProof,
      this.env.AUTH_PEPPER
    );
    await this.env.DB.batch([
      this.env.DB.prepare(
        "UPDATE users SET email=?,password_hash=?,password_salt=? WHERE id=?"
      ).bind(newEmail, credential.hash, credential.salt, userId),
      this.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        newEmail === user.email ? "user.password_reset" : "user.credentials_changed",
        user.businessId || null,
        userId,
        { previousEmail: user.email, email: newEmail }
      )
    ]);
    return rpcSuccess({
      id: userId,
      email: newEmail,
      emailChanged: newEmail !== user.email
    });
  }
  async createSupportSession(actorEmail, businessId) {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const owner = await this.env.DB.prepare(
      `SELECT u.id AS userId,u.email,b.name AS businessName
       FROM businesses b
       JOIN memberships m ON m.business_id=b.id AND m.role='owner'
       JOIN users u ON u.id=m.user_id
       WHERE b.id=? ORDER BY m.created_at LIMIT 1`
    ).bind(businessId).first();
    if (!owner) return rpcFailure(409, "Business has no owner account");
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
      "-",
      ""
    );
    const expiresAt = new Date(Date.now() + 15 * 6e4).toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO sessions
          (id,user_id,token_hash,expires_at,business_id,session_type,actor_email)
         VALUES (?,?,?,?,?,'support',?)`
      ).bind(
        id("ses"),
        owner.userId,
        await hashToken(token),
        expiresAt,
        businessId,
        normalizedAdminEmail(actorEmail)
      ),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        "support_session.created",
        businessId,
        owner.userId,
        { expiresAt, ownerEmail: owner.email }
      )
    ]);
    const adminUrl = (this.env.ADMIN_APP_URL || "https://angkor-emenu-admin.pages.dev").replace(/\/$/, "");
    return rpcSuccess({
      expiresAt,
      handoffUrl: `${adminUrl}/#auth=${encodeURIComponent(token)}`
    });
  }
};
var index_default = {
  async fetch(request, env, execution) {
    try {
      const response2 = await handle(request, env, execution);
      if (response2.status === 101) return response2;
      const headers = new Headers(response2.headers);
      Object.entries(cors(request, env)).forEach(
        ([key, value]) => headers.set(key, value)
      );
      const path = new URL(request.url).pathname;
      if (path.startsWith("/api/admin/") || path.startsWith("/api/auth/") || path.startsWith("/api/integrations/")) {
        headers.set("cache-control", "private, no-store");
      }
      headers.set("x-content-type-options", "nosniff");
      headers.set("referrer-policy", "strict-origin-when-cross-origin");
      return new Response(response2.body, { status: response2.status, headers });
    } catch (error3) {
      const limit = planLimitError(error3);
      if (limit) return json3(limit, 409, { ...cors(request, env), "cache-control": "no-store" });
      const requestId = crypto.randomUUID();
      const details = error3 instanceof Error ? { name: error3.name, message: error3.message, stack: error3.stack } : { message: String(error3) };
      console.error("request_failed", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        ...details
      });
      const failurePath = new URL(request.url).pathname;
      if (isPosApiPath(failurePath) || isPosAdminPath(failurePath)) return json3(
        { error: "Request could not be completed", code: "INTERNAL_ERROR", request_id: requestId },
        500,
        { ...cors(request, env), "cache-control": "private, no-store" }
      );
      return json3(
        { error: "Request could not be completed", requestId },
        500,
        cors(request, env)
      );
    }
  },
  async scheduled(controller, env, _context) {
    if (controller.cron === "* * * * *") {
      await Promise.all([
        retryTelegramOrders(env),
        retryBookingAlerts(env),
        deliverTelegramNotifications(env),
        runBranchWebhookScheduler(env)
      ]);
      return;
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM analytics_events WHERE created_at < datetime('now','-13 months')"),
      env.DB.prepare("DELETE FROM telegram_order_deliveries WHERE updated_at < unixepoch() - 604800"),
      env.DB.prepare(`DELETE FROM telegram_notification_deliveries AS delivery WHERE ${telegramDeliveryExpiresAt}<unixepoch()`),
      env.DB.prepare("DELETE FROM pos_sessions WHERE expires_at<=unixepoch()"),
      env.DB.prepare("DELETE FROM pos_login_limits WHERE window_start<unixepoch()-1200")
    ]);
  }
};
export {
  OrderEvents,
  SuperAdminService,
  index_default as default
};
//# sourceMappingURL=index.js.map
