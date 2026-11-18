import { defaultPaymentGroup, paymentKindByGroup, paymentTypeGroups, posTableStatusColors, posTableStatuses, posTaxModes, type PaymentTypeGroup, type PosTableStatusColors } from "../../../shared/posProfile";
import {
  boolean,
  bodyOf,
  choice,
  conflict,
  currencyOf,
  errorResponse,
  idleProfile,
  integer,
  invalid,
  list,
  missing,
  newId,
  object,
  optionalText,
  pageOf,
  profileColumns,
  profileView,
  recordId,
  requireManager,
  requirePosPlan,
  respond,
  sql,
  string,
  type PaymentKind,
  type PosCurrency,
  type PosProfile,
  type ProfileConfig,
} from "./posApiCore";
import { posPlanEnabled } from "./subscriptionPlans";
import { activeCatalogNodes } from "./posApiCatalog";
import { readTaxRules } from "./posApiTaxRules";
import { readReceiptSettings } from "./posApiReceiptTemplates";
import { readBusinessSales, readSellingOverview } from "./posApiSales";
import { readShiftAudit } from "./posApiShiftReports";
import { manageCustomerDirectory, readCustomerPhoto } from "./posApiCustomers";

export async function findProfile(
  db: D1Database,
  businessId: string,
  profileId: string,
) {
  return sql(
    db,
    `SELECT ${profileColumns} FROM pos_profiles p JOIN branches b ON b.id=p.branch_id
    WHERE p.business_id=? AND p.id=?`,
    businessId,
    profileId,
  ).first<PosProfile>();
}

async function readConfig(
  db: D1Database,
  businessId: string,
  branchId: string,
  currency: PosCurrency,
  value: unknown,
  walkIn: string,
  saved: ProfileConfig | undefined,
): Promise<ProfileConfig> {
  const input = object(value);
  const tableMode = choice(input.table_mode ?? "disabled", "table_mode", [
    "disabled",
    "optional",
    "required",
  ] as const);
  const promptGuestCover = boolean(input.prompt_guest_cover ?? false, "prompt_guest_cover");
  const colors = input.table_status_colors == null ? {} : object(input.table_status_colors);
  const tableStatusColors = { ...posTableStatusColors } as PosTableStatusColors;
  for (const status of posTableStatuses) {
    const color = colors[status];
    if (color === undefined) continue;
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))
      invalid(`table_status_colors.${status} must be a six-digit hex color`);
    tableStatusColors[status] = color.toUpperCase();
  }
  const tableGroups = input.table_group_ids == null
    ? null
    : list(input.table_group_ids, "table_group_ids", 500).map((id) =>
        recordId(id, "table group ID"),
      );
  if (tableGroups) {
    if (!tableGroups.length || new Set(tableGroups).size !== tableGroups.length)
      invalid("Choose distinct table groups or use all groups");
    const count = await sql(db, `
      SELECT count(*) AS count FROM table_groups
      WHERE business_id=? AND branch_id=? AND is_active=1
        AND id IN (SELECT value FROM json_each(?))
    `, businessId, branchId, JSON.stringify(tableGroups)).first<number>("count");
    if (count !== tableGroups.length) invalid("Choose active table groups from this branch");
  }
  const catalogMode = choice(input.catalog_mode ?? "category", "catalog_mode", [
    "category",
    "menu",
  ] as const);
  const selected =
    input.selected_ids == null
      ? null
      : list(input.selected_ids, "selected_ids", 100).map((id) =>
          recordId(id, "selected_ids"),
        );
  if (
    selected &&
    (!selected.length || new Set(selected).size !== selected.length)
  ) {
    invalid("selected_ids must be null or a nonempty list of distinct IDs");
  }
  if (selected) {
    const count = await sql(
      db,
      `${activeCatalogNodes(catalogMode)} SELECT count(*) AS count FROM active_nodes
      WHERE id IN (SELECT value FROM json_each(?2))`,
      businessId,
      JSON.stringify(selected),
    ).first<number>("count");
    if (count !== selected.length)
      invalid("Choose active menus or categories from this business");
  }

  const defaultMenu = input.default_menu_id == null
    ? null
    : recordId(input.default_menu_id, "default_menu_id");
  if (defaultMenu && (
    catalogMode !== "menu" ||
    !selected?.includes(defaultMenu) ||
    !(await sql(db,
      "SELECT 1 FROM menus WHERE business_id=? AND id=? AND parent_id IS NULL AND is_active=1 AND deleted_in_admin=0",
      businessId,
      defaultMenu,
    ).first())
  )) {
    invalid("Choose a selected top-level menu as the default");
  }

  const types = list(input.payment_types, "payment_types", 20).map((value) => {
    const type = object(value);
    if ("currencies" in type) invalid("Use a single currency for each payment type");
    return {
      id: recordId(type.id, "payment type ID"),
      currency: currencyOf(type.currency),
      ...(type.allow_cash_float === undefined
        ? {}
        : { allow_cash_float: boolean(type.allow_cash_float, "allow_cash_float") }),
    };
  });
  if (
    !types.length ||
    new Set(types.map((type) => type.id)).size !== types.length
  ) {
    invalid("Choose at least one payment type and list each type once");
  }
  if (!types.some((type) => type.currency === currency)) {
    invalid("At least one payment type must accept the business currency");
  }
  const defaultType = recordId(
    input.default_payment_type_id,
    "default_payment_type_id",
  );
  if (!types.some((type) => type.id === defaultType))
    invalid("The default payment type must be accepted");
  const { results: storedTypes } = await sql(
    db,
    `SELECT id,kind,currency FROM pos_payment_types
    WHERE business_id=? AND id IN (SELECT value FROM json_each(?))`,
    businessId,
    JSON.stringify(types.map((type) => type.id)),
  ).all<{ id: string; kind: string; currency: PosCurrency | null }>();
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

  const customerId =
    input.default_customer_id == null
      ? walkIn
      : recordId(input.default_customer_id, "default_customer_id");
  if (
    customerId !== walkIn &&
    !(await sql(
      db,
      "SELECT 1 FROM pos_customers WHERE business_id=? AND id=?",
      businessId,
      customerId,
    ).first())
  )
    invalid("Choose a customer from this business");
  const template =
    input.receipt_template == null ? {} : object(input.receipt_template);
  const taxMode = choice(input.tax_mode ?? "disabled", "tax_mode", posTaxModes);
  const taxRate = integer(input.tax_rate_bps ?? 0, "tax_rate_bps", 0, 10_000);
  if (taxMode === "disabled" && taxRate)
    invalid("A disabled tax rule must have a zero rate");
  const taxRules = input.tax_rules === undefined ? (saved?.tax_rules ?? []) : readTaxRules(input.tax_rules);
  const defaultTaxRuleId = input.default_tax_rule_id === undefined
    ? saved?.default_tax_rule_id
    : input.default_tax_rule_id === null
      ? null
      : recordId(input.default_tax_rule_id, "default_tax_rule_id");
  const defaultTaxRule = taxRules.find(({ id }) => id === defaultTaxRuleId);
  if (input.default_tax_rule_id != null && !defaultTaxRule)
    invalid("Choose a default tax rule from this profile");

  const cashierShiftEnabled = boolean(input.cashier_shift_enabled ?? false, "cashier_shift_enabled");
  return {
    working_day_enabled: boolean(
      input.working_day_enabled ?? false,
      "working_day_enabled",
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
      show_tax: boolean(template.show_tax ?? true, "show_tax"),
    },
    print_copies: integer(input.print_copies ?? 1, "print_copies", 1, 10),
    ...readReceiptSettings(input, saved),
    tax_mode: taxMode,
    tax_rate_bps: taxRate,
    tax_rules: taxRules,
    default_tax_rule_id: defaultTaxRule?.id ?? null,
  };
}

function duplicateCashCurrencies(config: string, businessId: string, kind = "payment.kind") {
  return `SELECT 1 FROM json_each(${config},'$.payment_types') AS entry
    JOIN pos_payment_types AS payment ON payment.business_id=${businessId}
      AND payment.id=json_extract(entry.value,'$.id') AND (${kind})='cash'
    GROUP BY json_extract(entry.value,'$.currency') HAVING count(*)>1`;
}

function incompatiblePaymentConfig(config: string, businessId: string) {
  return `EXISTS (
    SELECT 1 FROM json_each(${config},'$.payment_types') AS entry
    JOIN pos_payment_types AS payment ON payment.business_id=${businessId}
      AND payment.id=json_extract(entry.value,'$.id')
    WHERE payment.currency IS NOT NULL AND json_extract(entry.value,'$.currency')<>payment.currency
  ) OR EXISTS (${duplicateCashCurrencies(config, businessId)})`;
}

async function updatePaymentType(
  db: D1Database,
  businessId: string,
  id: string,
  name: string,
  group: PaymentTypeGroup | null,
  kind: PaymentKind,
  currency: PosCurrency | null,
  previous: { kind: PaymentKind; currency: PosCurrency | null },
) {
  function withCurrency(column: "config_json" | "pending_config_json") {
    return `COALESCE((
      SELECT json_set(p.${column},'$.payment_types['||entry.key||'].currency',?1)
      FROM json_each(p.${column},'$.payment_types') AS entry
      WHERE json_extract(entry.value,'$.id')=?3 AND ?1 IS NOT NULL AND ?1 IS NOT ?6
        AND json_extract(entry.value,'$.currency')<>?1
    ), p.${column})`;
  }

  function kindChangedIn(config: string) {
    return `?4<>?5 AND EXISTS (
      SELECT 1 FROM json_each(${config},'$.payment_types') AS entry
      WHERE json_extract(entry.value,'$.id')=?3
    )`;
  }

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
        "revised.config", "?2", "CASE WHEN payment.id=?3 THEN ?4 ELSE payment.kind END",
      )})
    )
      THEN 'Remove the duplicate cash currency from the affected POS profiles first.'
  END AS reason`;

  // Check and update both records atomically. POS commands retry if they read an
  // earlier profile version, and saved transaction snapshots keep their kind.
  const bindings = [currency, businessId, id, kind, previous.kind, previous.currency];
  const [payment] = await db.batch([
    sql(db, `UPDATE pos_payment_types SET name=?7,currency=?1,kind=?4,
      payment_type_group=COALESCE(?8,payment_type_group)
      WHERE business_id=?2 AND id=?3 AND kind=?5 AND currency IS ?6
        AND (${settingsConflict}) IS NULL`, ...bindings, name, group),
    sql(db, `UPDATE pos_profiles AS p SET config_json=${current},pending_config_json=${pending},
      version=version+CASE WHEN (${currentChanged}) THEN 1 ELSE 0 END
      WHERE p.business_id=?2 AND changes()=1
        AND (${currentChanged} OR p.pending_config_json IS NOT ${pending})`, ...bindings),
  ]);
  if (!payment.meta.changes) {
    const reason = await sql(db, settingsConflict, ...bindings).first<string>("reason");
    conflict(reason ?? "The payment type changed. Refresh and retry.");
  }
}

function missingDefaultCustomer(config: string, businessId: string) {
  return `json_extract(${config},'$.default_customer_id') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pos_customers c WHERE c.business_id=${businessId}
      AND c.id=json_extract(${config},'$.default_customer_id')
  )`;
}

async function profileSetup(
  request: Request,
  url: URL,
  db: D1Database,
  businessId: string,
  id?: string,
) {
  if (request.method === "GET" && !id) {
    const page = await pageOf(
      db,
      url,
      "profiles",
      `SELECT ${profileColumns} FROM pos_profiles p
      JOIN branches b ON b.id=p.branch_id WHERE p.business_id=? ORDER BY p.id`,
      [businessId],
    );
    return respond({
      ...page,
      profiles: (page.profiles as PosProfile[]).map((profile) =>
        profileView(profile, true),
      ),
    });
  }
  const profile = id ? await findProfile(db, businessId, id) : null;
  if (id && !profile) missing("POS profile");
  if (profile && request.method === "GET")
    return respond(profileView(profile, true));
  if (
    (!id && request.method !== "POST") ||
    (id && request.method !== "PATCH")
  ) {
    return respond(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
    );
  }
  const body = await bodyOf(request);
  const name =
    body.name === undefined && profile
      ? profile.name
      : string(body.name, "name");
  const active =
    body.is_active === undefined
      ? (profile?.is_active ?? 1)
      : Number(boolean(body.is_active, "is_active"));
  const branchId = profile?.branch_id ?? recordId(body.branch_id, "branch_id");
  if (profile && body.branch_id !== undefined && body.branch_id !== branchId)
    invalid("A profile's branch is fixed");
  const business = await sql(
    db,
    `SELECT business.currency FROM branches b JOIN businesses business ON business.id=b.business_id
    WHERE b.business_id=? AND b.id=? AND (b.is_active=1 OR ?=0)`,
    businessId,
    branchId,
    active,
  ).first<{ currency: PosCurrency }>();
  if (!business) invalid("Choose an active branch from this business");
  const walkIn = "walkin_" + businessId;
  const saved = profile && profileView(profile, true);
  const config =
    body.config === undefined && profile
      ? null
      : JSON.stringify(
          await readConfig(
            db,
            businessId,
            branchId,
            business.currency,
            body.config,
            walkIn,
            saved?.pending_config ?? saved?.config,
          ),
        );
  const profileId = id ?? newId("posp");
  const ensureWalkIn = sql(
    db,
    `INSERT INTO pos_customers (id,business_id,name,is_walk_in)
    VALUES (?,?,'Walk-in',1) ON CONFLICT DO NOTHING`,
    walkIn,
    businessId,
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
        config,
      ),
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
        profileId,
      ),
    ]);
    if (!result.meta.changes) {
      if (config && await sql(db, `SELECT ${missingDefaultCustomer("?1", "?2")} AS missing`,
        config, businessId).first<number>("missing"))
        conflict("The default customer changed. Refresh and retry.");
      if (active) conflict("The payment type changed. Refresh and retry.");
      conflict("Resolve open POS activity before deactivating this profile");
    }
  }
  return respond(
    profileView((await findProfile(db, businessId, profileId))!, true),
    profile ? 200 : 201,
  );
}

async function grants(
  request: Request,
  db: D1Database,
  businessId: string,
  profileId: string,
) {
  if (!(await findProfile(db, businessId, profileId))) missing("POS profile");
  if (request.method === "PUT") {
    const body = await bodyOf(request);
    const userIds = list(body.user_ids, "user_ids", 100).map((id) =>
      recordId(id, "user ID"),
    );
    if (new Set(userIds).size !== userIds.length)
      invalid("Grant IDs must be distinct");
    const ids = JSON.stringify(userIds);
    const count = await sql(
      db,
      `SELECT count(*) AS count FROM memberships
      WHERE business_id=? AND user_id IN (SELECT value FROM json_each(?))`,
      businessId,
      ids,
    ).first<number>("count");
    if (count !== userIds.length) invalid("Choose staff from this business");
    await db.batch([
      sql(
        db,
        `DELETE FROM pos_profile_grants WHERE business_id=? AND profile_id=?
          AND user_id NOT IN (SELECT value FROM json_each(?))`,
        businessId,
        profileId,
        ids,
      ),
      sql(
        db,
        `INSERT INTO pos_profile_grants(business_id,profile_id,user_id)
        SELECT ?,?,value FROM json_each(?) WHERE 1
        ON CONFLICT (business_id,profile_id,user_id) DO NOTHING`,
        businessId,
        profileId,
        ids,
      ),
    ]);
  } else if (request.method !== "GET") {
    return respond(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
    );
  }
  const rows = await sql(
    db,
    `SELECT user_id FROM pos_profile_grants
    WHERE business_id=? AND profile_id=? ORDER BY user_id`,
    businessId,
    profileId,
  ).all<{ user_id: string }>();
  return respond({ user_ids: rows.results.map((row) => row.user_id) });
}

async function paymentDirectory(
  request: Request,
  url: URL,
  db: D1Database,
  businessId: string,
  id?: string,
) {
  const select = "SELECT id,name,kind,currency,payment_type_group FROM pos_payment_types WHERE business_id=?";
  if (request.method === "GET" && !id)
    return respond(await pageOf(db, url, "payment_types", select + " ORDER BY id", [businessId]));
  const existing = id
    ? await sql(db, select + " AND id=?", businessId, id).first<{ name: string; kind: PaymentKind; currency: PosCurrency | null }>()
    : null;
  if (id && !existing) missing("Payment type");
  if (request.method === "GET") return respond(existing);
  if (request.method !== (id ? "PATCH" : "POST"))
    return respond({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  const body = await bodyOf(request);
  const name = string(body.name ?? existing?.name, "name");
  const record = id ?? newId("pospmt");
  const group = body.payment_type_group === undefined
    ? null
    : choice(body.payment_type_group, "payment type group", paymentTypeGroups);
  const legacyKind = body.kind === undefined
    ? null
    : choice(body.kind, "kind", ["cash", "card", "qr", "other"] as const);
  if (group && legacyKind && paymentKindByGroup[group] !== legacyKind)
    invalid("The kind does not match the payment type group");
  if (existing && !group && legacyKind && legacyKind !== existing.kind)
    invalid("Use the payment type group to change the kind");

  const kind = group ? paymentKindByGroup[group] : existing?.kind ?? legacyKind;
  if (!kind) invalid("Choose a payment type group");
  const currency = body.currency === undefined ? existing?.currency ?? null : currencyOf(body.currency);
  if (id && existing) {
    if (currency !== existing.currency || kind !== existing.kind) {
      await updatePaymentType(db, businessId, id, name, group, kind, currency, existing);
    } else {
      const result = await sql(db,
        `UPDATE pos_payment_types SET name=?1,payment_type_group=COALESCE(?2,payment_type_group)
        WHERE business_id=?3 AND id=?4 AND (?2 IS NULL OR kind=?5)
          AND (?6=0 OR currency IS ?7)`,
        name, group, businessId, id, existing.kind, Number(body.currency !== undefined), existing.currency,
      ).run();
      if (!result.meta.changes) conflict("The payment type changed. Refresh and retry.");
    }
  } else {
    await sql(db,
      `INSERT INTO pos_payment_types(id,business_id,name,kind,currency,payment_type_group)
      VALUES (?,?,?,?,?,?)`,
      record, businessId, name, kind, currency, group ?? defaultPaymentGroup[kind],
    ).run();
  }
  return respond(
    await sql(db, select + " AND id=?", businessId, record).first(),
    id ? 200 : 201,
  );
}

async function profileOptions(db: D1Database, businessId: string) {
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
    sql(db, `SELECT id,name FROM pos_customers WHERE business_id=? AND is_walk_in=0 ORDER BY name,id`, businessId).all(),
  ]);
  return respond({
    branches: branches.results,
    table_groups: tableGroups.results,
    categories: categories.results,
    menus: menus.results,
    payment_types: payments.results,
    customers: customers.results,
  });
}

export async function handlePosSetup(
  request: Request,
  url: URL,
  db: D1Database,
  auth: { businessId: string; role: string; sessionType: string },
  path: string,
  businessDate: () => string,
) {
  try {
    requireManager(auth.role);
    if (auth.sessionType !== "customer") {
      return respond(
        { error: "Use a business staff session", code: "FORBIDDEN" },
        403,
      );
    }
    const enabled = await sql(db, `SELECT ${posPlanEnabled("?")} AS enabled`, auth.businessId)
      .first<number>("enabled");
    requirePosPlan(enabled ?? 0);
    if (request.method === "GET") {
      if (path === "/overview") return await readSellingOverview(db, auth.businessId, businessDate());
      if (path === "/sales") return await readBusinessSales(db, url, auth.businessId);
      if (path === "/shift-audit") return await readShiftAudit(db, url, auth.businessId);
      if (path === "/profile-options") return await profileOptions(db, auth.businessId);
      const photo = path.match(/^\/customers\/([a-zA-Z0-9_-]{1,80})\/photo$/);
      if (photo) return await readCustomerPhoto(db, auth.businessId, photo[1]);
    }
    const match = path.match(
      /^\/(profiles|payment-types|customers|customer-groups)(?:\/([a-zA-Z0-9_-]{1,80})(\/grants)?)?$/,
    );
    if (!match) missing("Endpoint");
    const [, resource, id, grantPath] = match;
    if (resource === "profiles") {
      return await (grantPath
        ? grants(request, db, auth.businessId, id)
        : profileSetup(request, url, db, auth.businessId, id));
    }
    if (grantPath) missing("Endpoint");
    if (resource === "customers" || resource === "customer-groups")
      return await manageCustomerDirectory(request, url, db, auth.businessId, resource, id);
    return await paymentDirectory(request, url, db, auth.businessId, id);
  } catch (error) {
    return errorResponse(error);
  }
}
