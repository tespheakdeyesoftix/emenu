import type { PosTaxRule } from "../../../shared/posProfile";
import type { Env } from "./index";
import { saleLineEdits, saleLines, saleLineTotals, secondaryToPrimary } from "./posApiCatalog";
import { readTaxRules } from "./posApiTaxRules";
import {
  boolean,
  choice,
  conflict,
  currencyOf,
  integer,
  invalid,
  jsonRow,
  list,
  MAX_AMOUNT,
  missing,
  newId,
  object,
  optionalText,
  pageOf,
  paymentTypes,
  profileView,
  promoteProfile,
  recordId,
  requireManager,
  respond,
  sql,
  string,
  type Command,
  type Guard,
  type PaymentType,
  type PosContext,
  type PosCurrency,
  type PosDependencies,
} from "./posApiCore";
import {
  currentOperations,
  openGuard,
  operatingContext,
  updateShiftActivity,
} from "./posApiShifts";

const amountColumns = [
  "subtotal_minor", "discount_minor", "tax_1_amount", "tax_2_amount",
  "tax_3_amount", "tax_minor", "total_minor",
] as const;
const amountFields = amountColumns.join(" ");
const amountInserts = amountColumns.map(() => "?").join(",");
const amountReversal = amountColumns.map((column) => "-" + column).join(",");
const calculatedAmounts = "total_tax_amount total_amount";
const salesColumns = `id branch_id profile_id working_day_id shift_id reverses_sale_id status revision business_date
  currency secondary_exchange_rate tax_mode tax_rate_bps ${amountFields} ${calculatedAmounts} table_id table_code
  table_label guest_cover customer_id customer_name note reason created_at created_by updated_at updated_by settled_at settled_by`;
const lineColumns = `id line_number product_id product_code product_name portion_id portion_name
  price_list_id quantity unit_price_minor ${amountFields} note`;
const savedLineColumns = `${lineColumns} base_price_override_minor is_free`;
const paymentColumns = `id line_number payment_type_id payment_type_name payment_kind currency
  entry_type amount_minor reference reverses_payment_id`;
const reversalId = "(SELECT r.id FROM sales r WHERE r.reverses_sale_id=s.id)";
const lineJson = jsonRow("l", `${lineColumns} ${calculatedAmounts}`, {
  modifiers: "json(l.modifiers_json)",
  base_price_override_minor: "l.base_price_override_minor",
  is_free: "json(CASE WHEN l.is_free=1 THEN 'true' ELSE 'false' END)",
});
const paymentJson = jsonRow("p", paymentColumns);
const saleJson = jsonRow("s", salesColumns, {
  tax_rule: "json(s.tax_rule_json)",
  reversed_by_sale_id: reversalId,
  receipt: "json(s.receipt_json)",
  lines: `json((SELECT json_group_array(${lineJson} ORDER BY l.line_number) FROM sale_products l WHERE l.sale_id=s.id))`,
  payments: `json((SELECT json_group_array(${paymentJson} ORDER BY p.line_number) FROM sale_payments p WHERE p.sale_id=s.id))`,
});
const resultOf = (id: string) => ({
  query: `SELECT ${saleJson} AS value FROM sales s WHERE s.id=?`,
  params: [id],
});

type Sale = {
  id: string;
  status: "open" | "paid" | "cancelled";
  revision: number;
  working_day_id: string | null;
  reverses_sale_id: string | null;
  currency: PosCurrency;
  secondary_exchange_rate: string;
  tax_mode: string;
  tax_rate_bps: number;
  tax_rule_json: string | null;
  total_minor: number;
  table_id: string | null;
  table_code: string | null;
  table_label: string | null;
  guest_cover: number | null;
  customer_id: string;
  customer_name: string;
  note: string | null;
  business_date: string;
  receipt_json: string;
};

function sumAmounts(lines: ReturnType<typeof saleLineTotals>[]) {
  return Object.fromEntries(
    amountColumns.map((column) => [column, lines.reduce((sum, line) => sum + line[column], 0)]),
  ) as ReturnType<typeof saleLineTotals>;
}

function findSale(context: PosContext, id: string) {
  return sql(
    context.db,
    "SELECT * FROM sales WHERE id=? AND business_id=? AND profile_id=?",
    id,
    context.identity.business_id,
    context.profile.id,
  ).first<Sale>();
}

function validateBusinessDate(value: string) {
  const parsed = new Date(value + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    invalid("Invalid business_date");
}

function billPostingDate(context: PosContext, input: unknown, operatingDate: string) {
  if (input == null) return operatingDate;
  const value = string(input, "posting_date", 10);
  validateBusinessDate(value);
  if (value.startsWith("0000-")) invalid("Invalid posting_date");
  if (context.config.cashier_shift_enabled && value !== operatingDate)
    conflict("Posting date follows the required cashier shift", "POSTING_DATE_LOCKED");
  return value;
}

export async function readBusinessSales(db: D1Database, url: URL, businessId: string) {
  const filters = ["s.business_id=?"];
  const values = [businessId];
  const status = url.searchParams.get("status");
  const date = url.searchParams.get("business_date");
  if (status !== null) {
    choice(status, "status", ["open", "paid", "cancelled"] as const);
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

export async function readSellingOverview(db: D1Database, businessId: string, date: string) {
  const { results } = await sql(db, `
    SELECT currency,
      COUNT(CASE WHEN status='paid' AND reverses_sale_id IS NULL THEN 1 END) AS completed_count,
      COUNT(CASE WHEN status='open' THEN 1 END) AS open_count,
      SUM(CASE WHEN status='paid' THEN total_minor ELSE 0 END) AS net_minor
    FROM sales WHERE business_id=? AND (status='open' OR (status='paid' AND business_date=?))
    GROUP BY currency ORDER BY currency
  `, businessId, date).all();
  return respond({ business_date: date, currencies: results });
}

export async function readSales(context: PosContext, url: URL, id?: string) {
  const { db, identity, profile } = context;
  if (id) {
    const result = resultOf(id);
    const row = await sql(
      db,
      result.query + " AND s.business_id=? AND s.profile_id=?",
      id,
      identity.business_id,
      profile.id,
    ).first<string>("value");
    if (!row) missing("Sale");
    return respond(JSON.parse(row));
  }
  if (url.searchParams.has("history")) {
    if (url.searchParams.get("history") !== "active" ||
        ["status", "business_date", "table_id", "shift_id", "working_day_id"]
          .some((field) => url.searchParams.has(field))) {
      invalid("Use history=active without other sales filters");
    }
    return readActiveSales(context, url);
  }
  const filters = ["s.business_id=?", "s.profile_id=?"];
  const values: unknown[] = [identity.business_id, profile.id];
  for (const field of [
    "status",
    "business_date",
    "table_id",
    "shift_id",
    "working_day_id",
  ]) {
    const value = url.searchParams.get(field);
    if (value === null) continue;
    if (field === "status")
      choice(value, "status", ["open", "paid", "cancelled"] as const);
    else if (field === "business_date") validateBusinessDate(value);
    else recordId(value, field);
    filters.push(`s.${field}=?`);
    values.push(value);
  }
  const columns = salesColumns
    .split(/\s+/)
    .map((column) => "s." + column)
    .join(",");
  return respond(
    await pageOf(
      db,
      url,
      "sales",
      `SELECT ${columns},${reversalId} AS reversed_by_sale_id
    FROM sales s WHERE ${filters.join(" AND ")} ORDER BY s.created_at DESC,s.id DESC`,
      values,
    ),
  );
}

async function readActiveSales(context: PosContext, url: URL) {
  const { db, profile, identity, config } = context;
  const { working_day: day, cashier_shift: shift } = await currentOperations(context);
  const kind = config.cashier_shift_enabled ? "shift"
    : config.working_day_enabled ? "working_day" : "business_date";
  const period = kind === "shift" ? shift
    : kind === "working_day" ? day : null;
  const scopeId = kind === "business_date" ? context.localDate : period?.id;
  const start = kind === "business_date" ? context.localDateStart : period?.opened_at;
  const scope = typeof scopeId === "string" && typeof start === "string" &&
    (kind !== "shift" || (shift?.working_day_id ?? null) === (day?.id ?? null)) &&
    (!config.working_day_enabled || day)
    ? { profile_id: profile.id, kind, id: scopeId, opened_at: start }
    : null;
  const paidScope = kind === "shift" ? "s.shift_id"
    : kind === "working_day" ? "s.working_day_id" : "s.business_date";
  const columns = salesColumns.split(/\s+/).map((column) => "s." + column).join(",");
  const page = await pageOf(db, url, "sales", `
    SELECT ${columns},${reversalId} AS reversed_by_sale_id,
      (SELECT COALESCE(SUM(l.quantity),0) FROM sale_products l WHERE l.sale_id=s.id) AS item_quantity
    FROM sales s WHERE s.business_id=? AND s.profile_id=? AND ? IS NOT NULL
      AND (s.status='open' OR (s.status='paid' AND ${paidScope}=?)
        OR (s.status='cancelled' AND julianday(s.updated_at)>=julianday(?)
            AND julianday(s.updated_at)<=julianday(?)))
    ORDER BY CASE s.status WHEN 'paid' THEN COALESCE(s.settled_at,s.created_at)
      ELSE s.updated_at END DESC,s.id DESC
  `, [identity.business_id, profile.id, scope?.id ?? null, scope?.id ?? null, scope?.opened_at ?? null, context.now]);
  return respond({ ...page, history_scope: scope });
}

async function chooseTable(
  context: PosContext,
  input: unknown,
  previous: Sale | null,
) {
  const tableId =
    input === undefined
      ? (previous?.table_id ?? null)
      : input === null
        ? null
        : recordId(input, "table_id");
  if (!tableId) {
    if (context.config.table_mode === "required")
      invalid("This profile requires a table");
    return { id: null, code: null, label: null, check: false as const };
  }
  if (context.config.table_mode === "disabled")
    invalid("Tables are disabled on this profile");
  if (tableId === previous?.table_id)
    return {
      id: tableId,
      code: previous.table_code,
      label: previous.table_label,
      check: false as const,
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
    context.config.table_group_ids ? JSON.stringify(context.config.table_group_ids) : null,
  ).first<{ id: string; code: string; label: string; group_id: string }>();
  if (!row) missing("Table");
  return { ...row, check: true as const };
}

async function chooseCustomer(
  context: PosContext,
  input: unknown,
  previous: Sale | null,
) {
  if (input === undefined && previous)
    return { id: previous.customer_id, name: previous.customer_name };
  const id =
    input == null
      ? context.config.default_customer_id
      : recordId(input, "customer_id");
  const customer = await sql(
    context.db,
    "SELECT id,name FROM pos_customers WHERE business_id=? AND id=?",
    context.identity.business_id,
    id,
  ).first<{ id: string; name: string }>();
  if (!customer) missing("Customer");
  return customer;
}

function openSaleGuard(guard: Guard, sale: Sale, revision: number): Guard {
  return {
    ...guard,
    query: `${guard.query} AND EXISTS (SELECT 1 FROM sales WHERE id=? AND status='open' AND revision=?)`,
    params: [...guard.params, sale.id, revision],
  };
}

function assertRevision(sale: Sale, body: Record<string, unknown>) {
  const revision = integer(body.revision, "revision", 1);
  if (sale.status !== "open")
    conflict("This bill is no longer open", "BILL_CLOSED");
  if (revision !== sale.revision)
    conflict("Refresh the bill and use its current revision", "BILL_CHANGED");
  return revision;
}

function assertExpectedContext(
  body: Record<string, unknown>,
  operating: Awaited<ReturnType<typeof operatingContext>>,
) {
  if (body.expected_context === undefined) return;
  const expected = object(body.expected_context);
  const date = string(expected.business_date, "business_date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid("Invalid business date");
  const day =
    expected.working_day_id === null
      ? null
      : recordId(expected.working_day_id, "working_day_id");
  const shift =
    expected.shift_id === null ? null : recordId(expected.shift_id, "shift_id");
  if (
    date !== operating.businessDate ||
    day !== (operating.day?.id ?? null) ||
    shift !== (operating.shift?.id ?? null)
  ) {
    conflict(
      "The expected working day or cashier shift has changed",
      "SALE_CONTEXT_CHANGED",
    );
  }
}

export async function saveSale(
  env: Env,
  deps: PosDependencies,
  context: PosContext,
  command: Command,
  id?: string,
) {
  const { db, identity, profile, config, now } = context;
  const actor = identity.user_id;
  const body = command.body;
  const existing = id ? await findSale(context, id) : null;
  if (id && !existing) missing("Sale");
  const revision = existing ? assertRevision(existing, body) : 1;
  const operating = await operatingContext(context);
  assertExpectedContext(body, operating);
  const { day, shift, businessDate } = operating;
  const receiptData = existing ? object(JSON.parse(existing.receipt_json)) : {};
  const requestedPostingDate = body.posting_date === undefined
    ? (config.cashier_shift_enabled ? null : receiptData.posting_date)
    : body.posting_date;
  const postingDate = billPostingDate(context, requestedPostingDate, businessDate);
  if (existing && (day?.id ?? null) !== existing.working_day_id)
    conflict("The bill belongs to a different working day");
  const currency = existing?.currency ?? identity.currency;
  const taxRule: PosTaxRule | null = existing
    ? JSON.parse(existing.tax_rule_json ?? "null")
    : profileView(profile).config.default_tax_rule;
  const taxMode = existing?.tax_mode ?? taxRule?.tax_mode ?? config.tax_mode;
  const taxRate = existing?.tax_rate_bps ?? config.tax_rate_bps;
  const note =
    body.note === undefined
      ? (existing?.note ?? null)
      : optionalText(body.note, "note");
  if (body.lines !== undefined && currency !== identity.currency) {
    conflict(
      "The business currency changed. Settle the existing quote or cancel the bill before starting another.",
      "CURRENCY_CHANGED",
    );
  }
  const [table, customer, lines] = await Promise.all([
    chooseTable(context, body.table_id, existing),
    chooseCustomer(context, body.customer_id, existing),
    !existing || body.lines !== undefined
      ? saleLines(env, deps, context, body.lines, currency, taxMode, taxRate, taxRule)
      : null,
  ]);
  const cover = table.id == null
    ? inputGuestCover(body.guest_cover === undefined && existing?.table_id == null
        ? existing?.guest_cover : body.guest_cover, null, config.prompt_guest_cover === true)
    : body.guest_cover === undefined
      ? (existing?.table_id === table.id ? existing.guest_cover : null)
      : inputGuestCover(body.guest_cover, table.id);
  const amounts = lines ? sumAmounts(lines) : null;
  if (amounts && amounts.total_minor > MAX_AMOUNT)
    conflict("The bill exceeds the POS amount limit", "AMOUNT_LIMIT");
  const sale = id ?? newId("possale");
  const guard = existing
    ? openSaleGuard(openGuard(day, shift), existing, revision)
    : openGuard(day, shift);
  if (lines) {
    guard.query += " AND EXISTS (SELECT 1 FROM businesses WHERE id=? AND menu_cache_version=?)";
    guard.params.push(identity.business_id, identity.catalog_version);
    if (config.catalog_mode === "menu") {
      guard.query += " AND EXISTS (SELECT 1 FROM pos_profiles WHERE id=? AND pending_config_json IS ?)";
      guard.params.push(profile.id, profile.pending_config_json);
    }
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
      table.group_id,
    );
  }
  const writes: D1PreparedStatement[] = [];
  if (existing) {
    writes.push(
      sql(
        db,
        `UPDATE sales SET table_id=?,table_code=?,table_label=?,guest_cover=?,customer_id=?,customer_name=?,note=?,business_date=?,receipt_json=?,
      ${amountColumns.map((column) => `${column}=COALESCE(?,${column})`).join(",")},
      revision=revision+1,updated_at=?,updated_by=? WHERE id=?`,
        table.id,
        table.code,
        table.label,
        cover,
        customer.id,
        customer.name,
        note,
        requestedPostingDate == null && body.posting_date === undefined ? existing.business_date : postingDate,
        JSON.stringify({ ...receiptData, posting_date: requestedPostingDate == null ? null : postingDate }),
        ...amountColumns.map((column) => amounts?.[column] ?? null),
        now,
        actor,
        sale,
      ),
    );
  } else {
    const receipt = JSON.stringify({
      ...(requestedPostingDate == null ? {} : { posting_date: postingDate }),
      business_name: identity.business_name,
      profile_name: profile.name,
      branch_name: profile.branch_name,
      template: config.receipt_template,
      copies: config.print_copies,
    });
    writes.push(
      sql(
        db,
        `INSERT INTO sales (id,business_id,branch_id,profile_id,working_day_id,status,business_date,
      currency,secondary_exchange_rate,tax_mode,tax_rate_bps,tax_rule_json,${amountColumns.join(",")},table_id,table_code,
      table_label,guest_cover,customer_id,customer_name,receipt_json,note,created_at,created_by,updated_at,updated_by)
      VALUES (?,?,?,?,?,'open',?,?,?,?,?,?,${amountInserts},?,?,?,?,?,?,?,?,?,?,?,?)`,
        sale,
        identity.business_id,
        profile.branch_id,
        profile.id,
        day?.id ?? null,
        postingDate,
        currency,
        String(identity.secondary_exchange_rate),
        taxMode,
        taxRate,
        taxRule ? JSON.stringify(taxRule) : null,
        ...amountColumns.map((column) => amounts![column]),
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
        actor,
      ),
    );
  }
  if (lines) {
    const serialized = JSON.stringify(lines);
    if (new TextEncoder().encode(serialized).length > 384_000)
      invalid("The bill contains too much product and modifier data");
    if (existing)
      writes.push(sql(db, "DELETE FROM sale_products WHERE sale_id=?", sale));
    writes.push(
      sql(
        db,
        `INSERT INTO sale_products (sale_id,${savedLineColumns.replaceAll(/\s+/g, ",")},modifiers_json)
      SELECT ?,${savedLineColumns
        .split(/\s+/)
        .map((column) => `json_extract(value,'$.${column}')`)
        .join(",")},
        json_extract(value,'$.modifiers') FROM json_each(?)`,
        sale,
        serialized,
      ),
    );
  }
  return command.commit(existing ? 200 : 201, guard, writes, resultOf(sale));
}

function salePayments(
  input: unknown,
  types: PaymentType[],
  sale: Pick<Sale, "currency" | "secondary_exchange_rate" | "total_minor">,
) {
  const entries = list(input, "payments", 60).map((raw, index) => {
    const entry = object(raw);
    const id = recordId(entry.payment_type_id, "payment_type_id");
    const currency = currencyOf(entry.currency);
    const type = types.find(
      (type) => type.id === id && type.currency === currency,
    );
    if (!type)
      invalid("Use a payment type and currency accepted by this profile");
    const entryType = choice(entry.entry_type ?? "tender", "entry_type", [
      "tender",
      "change",
    ] as const);
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
      reverses_payment_id: null,
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
  const paid =
    net[sale.currency] +
    secondaryToPrimary(
      net[secondary],
      sale.currency,
      sale.secondary_exchange_rate,
    );
  if (paid !== sale.total_minor)
    conflict(
      "Net payments must match the bill total",
      "PAYMENT_TOTAL_MISMATCH",
    );
  return entries;
}

function insertSalePayments(
  db: D1Database,
  id: string,
  entries: ReturnType<typeof salePayments>,
) {
  return sql(
    db,
    `INSERT INTO sale_payments(sale_id,${paymentColumns.replaceAll(/\s+/g, ",")})
    SELECT ?,${paymentColumns
      .split(/\s+/)
      .map((column) => `json_extract(value,'$.${column}')`)
      .join(",")}
    FROM json_each(?)`,
    id,
    JSON.stringify(entries),
  );
}

async function checkout(
  context: PosContext,
  command: Command,
  sale: Sale,
  revision: number,
) {
  const { db, identity, now } = context;
  const expected = integer(
    command.body.expected_total_minor,
    "expected_total_minor",
    0,
  );
  if (expected !== sale.total_minor)
    conflict("Refresh the bill and confirm its saved total", "BILL_CHANGED");
  const operating = await operatingContext(context);
  assertExpectedContext(command.body, operating);
  const { day, shift, businessDate } = operating;
  const savedPostingDate = object(JSON.parse(sale.receipt_json)).posting_date;
  const postingDate = billPostingDate(context, command.body.posting_date === undefined
    ? (context.config.cashier_shift_enabled ? null : savedPostingDate)
    : command.body.posting_date, businessDate);
  if ((day?.id ?? null) !== sale.working_day_id)
    conflict("The bill belongs to a different working day");
  const entries = salePayments(
    command.body.payments,
    await paymentTypes(context),
    sale,
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
        sale.id,
      ),
      insertSalePayments(db, sale.id, entries),
      ...updateShiftActivity(context, shift),
      promoteProfile(context),
    ],
    resultOf(sale.id),
  );
}

export async function importStoreSale(
  context: PosContext,
  command: Command,
  types: PaymentType[],
) {
  const { db, identity, profile, now } = context;
  const body = command.body;
  const id = context.storeImport!.resourceId;
  const currency = currencyOf(body.currency);
  const rate = string(body.exchange_rate, "exchange_rate", 80);
  const taxMode = choice(body.tax_mode, "tax_mode", [
    "disabled",
    "inclusive",
    "exclusive",
  ] as const);
  const taxRate = integer(body.tax_rate_bps, "tax_rate_bps", 0, 10_000);
  const taxRule = body.tax_rule == null ? null : readTaxRules([body.tax_rule])[0];
  if (taxRule && taxMode !== taxRule.tax_mode)
    invalid("The saved tax rule must match tax_mode");
  const operating = await operatingContext(context);
  if (body.expected_context === undefined)
    invalid("The saved sale needs its operating context");
  assertExpectedContext(body, operating);
  const { day, shift, businessDate } = operating;
  const postingDate = billPostingDate(context, body.posting_date, businessDate);
  const lines = list(body.lines, "lines", 60).map((raw, index) => {
    const line = object(raw);
    const quantity = integer(line.quantity, "quantity", 1, 999);
    const unit = integer(line.unit_price_minor, "unit_price_minor", 0);
    if (unit * quantity > MAX_AMOUNT) invalid("The line exceeds the POS limit");
    const edits = saleLineEdits(line);
    const amounts = saleLineTotals(unit * quantity, taxMode, taxRate, taxRule, edits.discount_minor);
    if (
      amounts.subtotal_minor !== line.subtotal_minor ||
      amounts.tax_minor !== line.tax_minor ||
      amounts.total_minor !== line.total_minor ||
      (["tax_1_amount", "tax_2_amount", "tax_3_amount"] as const).some(
        (column) => line[column] !== undefined && amounts[column] !== line[column],
      ) ||
      (line.total_tax_amount !== undefined && amounts.tax_minor !== line.total_tax_amount) ||
      (line.total_amount !== undefined && amounts.total_minor !== line.total_amount)
    ) {
      invalid("The saved line amounts do not match the saved price and tax");
    }
    const modifiers = list(line.modifiers ?? [], "modifiers", 120).map(
      (rawModifier) => {
        const modifier = object(rawModifier);
        return {
          id: recordId(modifier.id, "modifier_id"),
          group_id: recordId(modifier.group_id, "group_id"),
          label_km:
            optionalText(modifier.label_km, "modifier label", 250) ?? "",
          label_en:
            optionalText(modifier.label_en, "modifier label", 250) ?? "",
          label_zh:
            optionalText(modifier.label_zh, "modifier label", 250) ?? "",
          price_minor: integer(
            modifier.price_minor,
            "modifier price",
            -MAX_AMOUNT,
          ),
        };
      },
    );
    if (
      new Set(modifiers.map((modifier) => modifier.id)).size !==
      modifiers.length
    ) {
      invalid("Use distinct modifiers for each line");
    }
    const editedUnit = edits.is_free
      ? 0
      : edits.base_price_override_minor == null
        ? unit
        : edits.base_price_override_minor + modifiers.reduce((sum, option) => sum + option.price_minor, 0);
    if (editedUnit !== unit) invalid("The saved unit price does not match the line edits");
    return {
      id: newId("posl"),
      line_number: index + 1,
      product_id: recordId(line.product_id, "product_id"),
      product_code: optionalText(line.product_code, "product code", 250),
      product_name: string(line.product_name, "product name", 250),
      portion_id:
        line.portion_id == null
          ? null
          : recordId(line.portion_id, "portion_id"),
      portion_name: optionalText(line.portion_name, "portion name", 250),
      price_list_id:
        line.price_list_id === ""
          ? ""
          : recordId(line.price_list_id, "price_list_id"),
      quantity,
      unit_price_minor: unit,
      ...edits,
      ...amounts,
      modifiers,
    };
  });
  if (!lines.length) invalid("A bill needs at least one line");
  const amounts = sumAmounts(lines);
  if (amounts.total_minor > MAX_AMOUNT || amounts.total_minor !== body.total_minor) {
    invalid("The saved total must match the lines");
  }
  const entries = salePayments(body.payments, types, {
    currency,
    secondary_exchange_rate: rate,
    total_minor: amounts.total_minor,
  });
  const tableMode = choice(body.table_mode, "table_mode", [
    "disabled",
    "optional",
    "required",
  ] as const);
  const table =
    body.table_id == null ? null : recordId(body.table_id, "table_id");
  if (
    (tableMode === "required" && !table) ||
    (tableMode === "disabled" && table)
  ) {
    invalid("The table does not match the saved profile mode");
  }
  const cover = inputGuestCover(body.guest_cover, table, context.config.prompt_guest_cover === true);
  const customer = recordId(body.customer_id, "customer_id");
  const receipt = object(body.receipt);
  const template = object(receipt.template);
  const savedReceipt = {
    business_name: string(receipt.business_name, "business name", 250),
    profile_name:
      optionalText(receipt.profile_name, "profile name", 250) ?? profile.name,
    branch_name:
      optionalText(receipt.branch_name, "branch name", 250) ??
      profile.branch_name,
    template: {
      title: optionalText(template.title, "receipt title", 500) ?? "",
      footer: optionalText(template.footer, "receipt footer", 500) ?? "",
      show_tax: boolean(template.show_tax, "show_tax"),
    },
    copies: integer(receipt.copies, "copies", 1, 10),
  };
  const guard = openGuard(day, shift);
  guard.query += ` AND NOT EXISTS (
    SELECT 1 FROM restaurant_tables WHERE id=? AND (business_id<>? OR branch_id<>?)
  ) AND NOT EXISTS (
    SELECT 1 FROM pos_customers WHERE id=? AND business_id<>?
  ) AND NOT EXISTS (
    SELECT 1 FROM products WHERE id IN (SELECT value FROM json_each(?)) AND business_id<>?
  )`;
  guard.params.push(
    table,
    identity.business_id,
    profile.branch_id,
    customer,
    identity.business_id,
    JSON.stringify(lines.map((line) => line.product_id)),
    identity.business_id,
  );
  return command.commit(
    201,
    guard,
    [
      sql(
        db,
        `INSERT INTO sales (id,business_id,branch_id,profile_id,working_day_id,shift_id,status,business_date,
        currency,secondary_exchange_rate,tax_mode,tax_rate_bps,tax_rule_json,${amountColumns.join(",")},
        table_id,table_code,table_label,guest_cover,customer_id,customer_name,receipt_json,
        created_at,created_by,updated_at,updated_by,settled_at,settled_by)
        VALUES (?,?,?,?,?,?,'paid',?,?,?,?,?,?,${amountInserts},?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id,
        identity.business_id,
        profile.branch_id,
        profile.id,
        day?.id ?? null,
        shift?.id ?? null,
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
        now,
        identity.user_id,
        now,
        identity.user_id,
        now,
        identity.user_id,
      ),
      sql(
        db,
        `INSERT INTO sale_products (sale_id,${savedLineColumns.replaceAll(/\s+/g, ",")},modifiers_json)
      SELECT ?,${savedLineColumns
        .split(/\s+/)
        .map((column) => `json_extract(value,'$.${column}')`)
        .join(",")},
        json_extract(value,'$.modifiers') FROM json_each(?)`,
        id,
        JSON.stringify(lines),
      ),
      insertSalePayments(db, id, entries),
      ...updateShiftActivity(context, shift),
    ],
    resultOf(id),
  );
}

function inputGuestCover(value: unknown, tableId: string | null, acceptsCounter = false) {
  if (value == null) return null;
  if (tableId == null && !acceptsCounter) invalid("A guest count requires a table or guest-cover profile");
  return integer(value, "guest_cover", 1, 1000);
}

async function reverse(context: PosContext, command: Command, original: Sale) {
  const { db, identity, now } = context;
  requireManager(identity.role);
  const reason = string(command.body.reason, "reason", 500);
  if (original.status !== "paid" || original.reverses_sale_id)
    conflict("Only an original paid sale can be reversed");
  const operating = await operatingContext(context);
  if (
    context.storeImport &&
    (command.body.expected_context === undefined ||
      command.body.expected_total_minor === undefined)
  ) {
    invalid("The reversal needs its operating context and original total");
  }
  assertExpectedContext(command.body, operating);
  if (
    command.body.expected_total_minor !== undefined &&
    integer(command.body.expected_total_minor, "expected_total_minor", 0) !==
      original.total_minor
  ) {
    conflict("The original paid total does not match", "BILL_CHANGED");
  }
  if (
    await sql(
      db,
      "SELECT 1 FROM sales WHERE reverses_sale_id=?",
      original.id,
    ).first()
  ) {
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
      manager: true,
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
        original.id,
      ),
      sql(
        db,
        `INSERT INTO sale_products(id,sale_id,line_number,product_id,product_code,product_name,portion_id,portion_name,
      price_list_id,modifiers_json,quantity,unit_price_minor,${amountColumns.join(",")},note,base_price_override_minor,is_free)
      SELECT 'posl_'||lower(hex(randomblob(16))),?,line_number,product_id,product_code,product_name,portion_id,portion_name,
        price_list_id,modifiers_json,-quantity,unit_price_minor,${amountReversal},note,base_price_override_minor,is_free
      FROM sale_products WHERE sale_id=?`,
        sale,
        original.id,
      ),
      sql(
        db,
        `INSERT INTO sale_payments(id,sale_id,line_number,payment_type_id,payment_type_name,payment_kind,currency,
      entry_type,amount_minor,reference,reverses_payment_id)
      SELECT 'pospay_'||lower(hex(randomblob(16))),?,line_number,payment_type_id,payment_type_name,payment_kind,currency,
        'reversal',-amount_minor,reference,id FROM sale_payments WHERE sale_id=?`,
        sale,
        original.id,
      ),
      ...updateShiftActivity(context, shift),
    ],
    resultOf(sale),
  );
}

export async function saleAction(
  context: PosContext,
  command: Command,
  id: string,
  action: string,
) {
  const sale = await findSale(context, id);
  if (!sale) missing("Sale");
  if (action === "reverse") return reverse(context, command, sale);
  const revision = assertRevision(sale, command.body);
  if (action === "checkout") return checkout(context, command, sale, revision);
  const reason = string(command.body.reason, "reason", 500);
  const guard = openSaleGuard(
    { query: "1", params: [], allowReadOnly: true },
    sale,
    revision,
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
        id,
      ),
      promoteProfile(context),
    ],
    resultOf(id),
  );
}
