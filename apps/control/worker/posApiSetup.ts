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
  type PosCurrency,
  type PosProfile,
  type ProfileConfig,
} from "./posApiCore";
import { posPlanEnabled } from "./subscriptionPlans";
import { activeCatalogNodes } from "./posApiCatalog";
import { readBusinessSales, readSellingOverview } from "./posApiSales";

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
): Promise<ProfileConfig> {
  const input = object(value);
  const tableMode = choice(input.table_mode ?? "disabled", "table_mode", [
    "disabled",
    "optional",
    "required",
  ] as const);
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

  const types = list(input.payment_types, "payment_types", 20).map((value) => {
    const type = object(value);
    const currencies = list(type.currencies, "currencies", 2).map(currencyOf);
    if (!currencies.length || new Set(currencies).size !== currencies.length)
      invalid("Each payment type needs distinct currencies");
    return {
      id: recordId(type.id, "payment type ID"),
      currencies,
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
  if (!types.some((type) => type.currencies.includes(currency))) {
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
    if (stored.currency && type.currencies.some((value) => value !== stored.currency))
      invalid(`This payment type accepts only ${stored.currency}`);
    return stored.kind === "cash" ? type.currencies : [];
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
  const taxMode = choice(input.tax_mode ?? "disabled", "tax_mode", [
    "disabled",
    "inclusive",
    "exclusive",
  ] as const);
  const taxRate = integer(input.tax_rate_bps ?? 0, "tax_rate_bps", 0, 10_000);
  if (taxMode === "disabled" && taxRate)
    invalid("A disabled tax rule must have a zero rate");
  const cashierShiftEnabled = boolean(input.cashier_shift_enabled ?? false, "cashier_shift_enabled");
  return {
    working_day_enabled: boolean(
      input.working_day_enabled ?? false,
      "working_day_enabled",
    ),
    cashier_shift_enabled: cashierShiftEnabled || types.some((type) => type.allow_cash_float === true),
    table_mode: tableMode,
    table_group_ids: tableGroups,
    catalog_mode: catalogMode,
    selected_ids: selected,
    payment_types: types,
    default_payment_type_id: defaultType,
    default_customer_id: customerId,
    receipt_template: {
      title: optionalText(template.title, "receipt title", 120) ?? "",
      footer: optionalText(template.footer, "receipt footer", 500) ?? "",
      show_tax: boolean(template.show_tax ?? true, "show_tax"),
    },
    print_copies: integer(input.print_copies ?? 1, "print_copies", 1, 10),
    tax_mode: taxMode,
    tax_rate_bps: taxRate,
  };
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
    await db.batch([
      ensureWalkIn,
      sql(
        db,
        `INSERT INTO pos_profiles
      (id,business_id,branch_id,name,is_active,config_json) VALUES (?,?,?,?,?,?)`,
        profileId,
        businessId,
        branchId,
        name,
        active,
        config,
      ),
    ]);
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
      WHERE business_id=?4 AND id=?5 AND (?2=1 OR (${canDeactivate}))`,
        name,
        active,
        config,
        businessId,
        profileId,
      ),
    ]);
    if (!result.meta.changes)
      conflict("Resolve open POS activity before deactivating this profile");
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

async function directory(
  request: Request,
  url: URL,
  db: D1Database,
  businessId: string,
  resource: string,
  id?: string,
) {
  const customers = resource === "customers";
  const table = customers ? "pos_customers" : "pos_payment_types";
  const columns = customers
    ? "id,name,external_reference,is_walk_in"
    : "id,name,kind,currency";
  const select = `SELECT ${columns} FROM ${table} WHERE business_id=?`;
  if (request.method === "GET" && !id) {
    return respond(
      await pageOf(
        db,
        url,
        resource.replace("-", "_"),
        select + " ORDER BY id",
        [businessId],
      ),
    );
  }
  const existing = id
    ? await sql(db, select + " AND id=?", businessId, id).first()
    : null;
  if (id && !existing) missing(customers ? "Customer" : "Payment type");
  if (request.method === "GET") return respond(existing);
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
  const name = string(body.name ?? existing?.name, "name");
  const record = id ?? newId(customers ? "posc" : "pospmt");
  if (customers) {
    const reference =
      body.external_reference === undefined
        ? (existing?.external_reference ?? null)
        : optionalText(body.external_reference, "external_reference", 120);
    if (id)
      await sql(
        db,
        `UPDATE pos_customers SET name=?,external_reference=? WHERE business_id=? AND id=?`,
        name,
        reference,
        businessId,
        id,
      ).run();
    else
      await sql(
        db,
        "INSERT INTO pos_customers(id,business_id,name,external_reference) VALUES (?,?,?,?)",
        record,
        businessId,
        name,
        reference,
      ).run();
  } else {
    if (existing && body.kind !== undefined && body.kind !== existing.kind)
      invalid("A payment type's kind is fixed");
    if (existing && body.currency !== undefined && body.currency !== existing.currency)
      invalid("A payment type's currency is fixed");
    if (id)
      await sql(
        db,
        "UPDATE pos_payment_types SET name=? WHERE business_id=? AND id=?",
        name,
        businessId,
        id,
      ).run();
    else
      await sql(
        db,
        "INSERT INTO pos_payment_types(id,business_id,name,kind,currency) VALUES (?,?,?,?,?)",
        record,
        businessId,
        name,
        choice(body.kind, "kind", ["cash", "card", "qr", "other"] as const),
        body.currency === undefined ? null : currencyOf(body.currency),
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
    sql(db, `SELECT id,name,kind,currency FROM pos_payment_types WHERE business_id=? ORDER BY name,id`, businessId).all(),
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
      if (path === "/profile-options") return await profileOptions(db, auth.businessId);
    }
    const match = path.match(
      /^\/(profiles|payment-types|customers)(?:\/([a-zA-Z0-9_-]{1,80})(\/grants)?)?$/,
    );
    if (!match) missing("Endpoint");
    const [, resource, id, grantPath] = match;
    if (resource === "profiles") {
      return await (grantPath
        ? grants(request, db, auth.businessId, id)
        : profileSetup(request, url, db, auth.businessId, id));
    }
    if (grantPath) missing("Endpoint");
    return await directory(request, url, db, auth.businessId, resource, id);
  } catch (error) {
    return errorResponse(error);
  }
}
