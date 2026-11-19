import {
  allowsCashFloat,
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
  pageOf,
  paymentTypes,
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
} from "./posApiCore";
import { daySummary, registerManager, shiftNameColumns, shiftSummary } from "./posApiShiftReports";

const dayColumns =
  "id branch_id business_date timezone opened_at opened_by closed_at closed_by base_currency";
const shiftColumns =
  "id branch_id profile_id working_day_id opened_at opened_by closed_at closed_by activity_revision base_currency exchange_rate";
const dayJson = jsonRow("d", dayColumns);
const shiftJson = jsonRow("s", shiftColumns);
type WorkingDay = {
  id: string;
  business_date: string;
  closed_at: string | null;
};
type CashierShift = {
  id: string;
  profile_id: string;
  working_day_id: string | null;
  closed_at: string | null;
  activity_revision: number;
  payment_types_json: string;
};

function selectDay(context: PosContext, id?: string) {
  return sql(
    context.db,
    `SELECT * FROM working_days WHERE business_id=? AND branch_id=?
    AND ${id ? "id=?" : "closed_at IS NULL"}`,
    context.identity.business_id,
    context.profile.branch_id,
    ...(id ? [id] : []),
  ).first<WorkingDay>();
}

function selectShift(context: PosContext, id?: string, branch = false) {
  return sql(
    context.db,
    `SELECT * FROM cashier_shifts WHERE business_id=? AND ${branch ? "branch_id" : "profile_id"}=?
    AND ${id ? "id=?" : "closed_at IS NULL"}`,
    context.identity.business_id,
    branch ? context.profile.branch_id : context.profile.id,
    ...(id ? [id] : []),
  ).first<CashierShift>();
}

export async function operatingContext(
  context: PosContext,
  requireShift = true,
) {
  const [day, shift] = await Promise.all([
    context.config.working_day_enabled ? selectDay(context) : null,
    context.config.cashier_shift_enabled && requireShift
      ? selectShift(context)
      : null,
  ]);
  if (context.config.working_day_enabled && !day)
    conflict("Open the working day first", "WORKING_DAY_REQUIRED");
  if (
    context.config.cashier_shift_enabled &&
    requireShift &&
    (!shift || shift.working_day_id !== (day?.id ?? null))
  ) {
    conflict("Open a cashier shift first", "CASHIER_SHIFT_REQUIRED");
  }
  return { day, shift, businessDate: day?.business_date ?? context.localDate };
}

export function openGuard(
  day: WorkingDay | null,
  shift: CashierShift | null,
): Guard {
  return {
    query: `(? IS NULL OR EXISTS (SELECT 1 FROM working_days WHERE id=? AND closed_at IS NULL))
      AND (? IS NULL OR EXISTS (SELECT 1 FROM cashier_shifts WHERE id=? AND closed_at IS NULL))`,
    params: [
      day?.id ?? null,
      day?.id ?? null,
      shift?.id ?? null,
      shift?.id ?? null,
    ],
  };
}

export function updateShiftActivity(
  context: PosContext,
  shift: { id: string } | null,
) {
  return shift
    ? [
        sql(
          context.db,
          "UPDATE cashier_shifts SET activity_revision=activity_revision+1 WHERE id=?",
          shift.id,
        ),
      ]
    : [];
}

const dayResult = (id: string) => ({
  query: `SELECT ${dayJson} FROM working_days d WHERE d.id=?`,
  params: [id],
});
const closingCounts = `SELECT payment_type_id,payment_type_name,currency,
  expected_minor,declared_minor,variance_minor FROM cashier_shift_closing_counts`;
const shiftResult = (id: string) => ({
  query: `SELECT ${jsonRow("s", shiftColumns, {
    business_date: "coalesce(d.business_date,s.business_date,date(s.opened_at))",
    opened_by_name: "(SELECT display_name FROM users WHERE id=s.opened_by)",
    closed_by_name: "(SELECT display_name FROM users WHERE id=s.closed_by)",
    profile_name: "p.name",
    closing_counts: `json((SELECT json_group_array(json_object('payment_type_id',payment_type_id,
      'payment_type_name',payment_type_name,'currency',currency,'expected_minor',expected_minor,
      'declared_minor',declared_minor,'variance_minor',variance_minor) ORDER BY payment_type_id,currency)
      FROM cashier_shift_closing_counts WHERE shift_id=s.id))`,
  })} AS value FROM cashier_shifts s JOIN pos_profiles p ON p.id=s.profile_id
    LEFT JOIN working_days d ON d.id=s.working_day_id WHERE s.id=?`,
  params: [id],
});

export async function currentOperations(context: PosContext) {
  const { db, identity, profile, config } = context;
  const [day, shift] = await Promise.all([
    config.working_day_enabled
      ? sql(
          db,
          `SELECT d.*, ${shiftNameColumns("d")} FROM working_days d
      WHERE business_id=? AND branch_id=? AND closed_at IS NULL`,
          identity.business_id,
          profile.branch_id,
        ).first()
      : null,
    config.cashier_shift_enabled
      ? sql(
          db,
          `SELECT ${shiftColumns.replaceAll(" ", ",")}, ${shiftNameColumns("s")} FROM cashier_shifts s
      WHERE business_id=? AND profile_id=? AND closed_at IS NULL`,
          identity.business_id,
          profile.id,
        ).first()
      : null,
  ]);
  return { working_day: day, cashier_shift: shift };
}

const latestShift = `s.id=(SELECT newer.id FROM cashier_shifts newer
  WHERE newer.business_id=s.business_id AND newer.profile_id=s.profile_id
  ORDER BY newer.opening_sequence DESC,newer.opened_at DESC,newer.id DESC LIMIT 1)`;
const reopenEligible = `s.closed_at IS NOT NULL AND ${latestShift}
  AND NOT EXISTS(SELECT 1 FROM cashier_shifts active
    WHERE active.profile_id=s.profile_id AND active.closed_at IS NULL)
  AND (s.working_day_id IS NULL OR EXISTS(SELECT 1 FROM working_days d
    WHERE d.id=s.working_day_id AND d.closed_at IS NULL))`;

export async function readOperations(
  context: PosContext,
  url: URL,
  resource: string,
  id?: string,
  action?: string,
) {
  const { db, identity, profile } = context;
  const days = resource === "working-days";
  const manager = registerManager(identity.role);
  const branch = manager && url.searchParams.get("scope") === "branch";
  if (!id) {
    const table = days ? "working_days" : "cashier_shifts";
    const date = url.searchParams.get("business_date");
    const businessDate = "coalesce(d.business_date,s.business_date,(SELECT min(business_date) FROM sales WHERE shift_id=s.id),date(s.opened_at))";
    if (!days && (date || branch || url.searchParams.has("closed"))) {
      const filters = [`s.business_id=? AND s.${branch ? "branch_id" : "profile_id"}=?`];
      const params: unknown[] = [identity.business_id, branch ? profile.branch_id : profile.id];
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid("Choose a valid business date");
        filters.push(`${businessDate}=?`);
        params.push(date);
      }
      if (url.searchParams.has("closed")) filters.push("s.closed_at IS NOT NULL");
      for (const column of ["profile_id", "opened_by"] as const) {
        const filter = url.searchParams.get(column);
        if (branch && filter) {
          filters.push(`s.${column}=?`);
          params.push(recordId(filter, column));
        }
      }
      const data = await pageOf(db, url, table,
        `SELECT s.id,s.profile_id,s.working_day_id,s.opened_at,s.opened_by,s.closed_at,s.closed_by,
          ${businessDate} AS business_date,p.name AS profile_name,${shiftNameColumns("s")}
        FROM cashier_shifts s JOIN pos_profiles p ON s.profile_id=p.id
        LEFT JOIN working_days d ON s.working_day_id=d.id
        WHERE ${filters.join(" AND ")} ORDER BY s.opened_at DESC,s.id DESC`, params);
      if (!branch) return respond(data);
      const [registers, operators] = await db.batch([
        sql(db, "SELECT id,name FROM pos_profiles WHERE business_id=? AND branch_id=? ORDER BY name,id",
          identity.business_id, profile.branch_id),
        sql(db, `SELECT DISTINCT s.opened_by AS id,u.display_name AS name FROM cashier_shifts s
          LEFT JOIN users u ON u.id=s.opened_by WHERE s.business_id=? AND s.branch_id=? ORDER BY u.display_name,s.opened_by`,
          identity.business_id, profile.branch_id),
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
        [identity.business_id, days ? profile.branch_id : profile.id],
      ),
    );
  }
  if (days && action === "summary") {
    const day = await selectDay(context, id);
    if (!day) missing("Working day");
    return respond({ ...day, ...await daySummary(context, id) });
  }
  if (days && !action) {
    const row = await sql(
      db,
      `SELECT ${dayColumns.replaceAll(" ", ",")} FROM working_days
      WHERE business_id=? AND branch_id=? AND id=?`,
      identity.business_id,
      profile.branch_id,
      id,
    ).first();
    if (!row) missing("Working day");
    return respond(row);
  }
  if (days) missing("Endpoint");
  const shift = await selectShift(context, id, branch && action === "summary");
  if (!shift) missing("Cashier shift");
  if (action === "summary") {
    if (branch && !shift.closed_at && !(await selectShift(context, id))) missing("Cashier shift");
    const result = shiftResult(id);
    const [details, summary, eligible] = await Promise.all([
      sql(db, result.query, ...result.params).first<string>("value"),
      shiftSummary(context, id, manager && !shift.closed_at ? expectedCounts(db, id) : undefined),
      manager && context.config.cashier_shift_enabled && context.config.working_day_enabled === Boolean(shift.working_day_id)
        ? sql(db, `SELECT 1 FROM cashier_shifts s WHERE s.id=? AND s.profile_id=? AND ${reopenEligible}`,
          id, profile.id).first<number>() : null,
    ]);
    return respond({ ...JSON.parse(details!), ...summary, tenders: shiftTenders(shift), can_reopen: eligible !== null });
  }
  if (action === "cash-floats") {
    return respond(
      await pageOf(
        db,
        url,
        "cash_floats",
        `SELECT * FROM cash_floats
      WHERE shift_id=? ORDER BY created_at,id`,
        [id],
      ),
    );
  }
  if (action === "reconciliation") {
    if (shift.closed_at) {
      const { results } = await sql(
        db,
        `${closingCounts} WHERE shift_id=? ORDER BY payment_type_id,currency`,
        id,
      ).all();
      return respond({
        shift_id: id,
        activity_revision: shift.activity_revision,
        counts: results,
      });
    }
    const { revision, rows } = await reconciliationSnapshot(db, id);
    return respond({
      shift_id: id,
      activity_revision: revision.activity_revision,
      counts: manager ? rows : rows.map(({ expected_minor, ...row }) => row),
    });
  }
  if (action) missing("Endpoint");
  const result = shiftResult(id);
  const row = await sql(db, result.query, ...result.params).first<string>(
    "value",
  );
  return respond(JSON.parse(row!));
}

export async function writeDay(
  context: PosContext,
  command: Command,
  id?: string,
) {
  const { db, identity, profile, now } = context;
  const { business_id: businessId, user_id: actor } = identity;
  requireManager(identity.role);
  if (!id) {
    if (!context.config.working_day_enabled)
      conflict("Working days are disabled on this profile", "FEATURE_DISABLED");
    if (await selectDay(context))
      conflict(
        "A working day is already open for this branch",
        "WORKING_DAY_OPEN",
      );
    const day = context.storeImport?.resourceId ?? newId("posd");
    return command.commit(
      201,
      { query: "1", params: [], manager: true },
      [
        sql(
          db,
          `INSERT INTO working_days(id,business_id,branch_id,business_date,timezone,opened_at,opened_by,base_currency)
        VALUES (?,?,?,?,?,?,?,?)`,
          day,
          businessId,
          profile.branch_id,
          context.localDate,
          identity.timezone,
          now,
          actor,
          context.storeImport?.baseCurrency ?? identity.currency,
        ),
      ],
      dayResult(day),
    );
  }
  const day = await selectDay(context, id);
  if (!day) missing("Working day");
  if (day.closed_at) conflict("This working day is already closed");
  const canClose = `NOT EXISTS (SELECT 1 FROM cashier_shifts WHERE working_day_id=? AND closed_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM sales WHERE working_day_id=? AND status IN ('open','submitted'))`;
  const allowed = await sql(
    db,
    "SELECT " + canClose + " AS allowed",
    id,
    id,
  ).first<number>("allowed");
  if (!allowed)
    conflict(
      "Close the working day's shifts and settle or cancel its open bills",
      "WORKING_DAY_HAS_ACTIVITY",
    );
  return command.commit(
    200,
    {
      query: `EXISTS (SELECT 1 FROM working_days WHERE id=? AND closed_at IS NULL) AND ${canClose}`,
      params: [id, id, id],
      manager: true,
      allowReadOnly: true,
    },
    [
      sql(
        db,
        "UPDATE working_days SET closed_at=?,closed_by=? WHERE id=?",
        now,
        actor,
        id,
      ),
    ],
    dayResult(id),
  );
}

type Count = {
  payment_type_id: string;
  payment_type_name: string;
  currency: string;
  payment_kind: string;
  expected_minor: number;
};
const countKey = (row: { payment_type_id: string; currency: string }) =>
  `${row.payment_type_id}:${row.currency}`;
function expectedCounts(db: D1Database, shiftId: string) {
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
    shiftId,
  );
}

async function reconciliationSnapshot(db: D1Database, id: string) {
  const [revision, totals] = await db.batch([
    sql(db, "SELECT activity_revision,closed_at FROM cashier_shifts WHERE id=?", id),
    expectedCounts(db, id),
  ]);
  return {
    revision: revision.results[0] as { activity_revision: number; closed_at: string | null },
    rows: totals.results as Count[],
  };
}

function declaredCounts(body: Record<string, unknown>, rows: Count[]) {
  const input = list(body.counts, "counts", 1_000).map((raw) => {
    const count = object(raw);
    return {
      payment_type_id: recordId(count.payment_type_id, "payment_type_id"),
      currency: currencyOf(count.currency),
      declared_minor: integer(count.declared_minor, "declared_minor", -MAX_AMOUNT),
      expected_minor: count.expected_minor,
    };
  });
  const declared = new Map(input.map((entry) => [countKey(entry), entry]));
  if (input.length !== rows.length || declared.size !== input.length ||
      rows.some((row) => !declared.has(countKey(row))))
    invalid("Send one declared amount for every payment type and currency in the reconciliation");
  if (rows.some((row) => row.payment_kind === "cash" && declared.get(countKey(row))!.declared_minor < 0))
    invalid("Declared cash amounts must be zero or positive");
  return declared;
}

export async function reviewShift(context: PosContext, id: string, body: Record<string, unknown>) {
  if (!(await selectShift(context, id))) missing("Cashier shift");
  const { revision, rows } = await reconciliationSnapshot(context.db, id);
  if (revision.closed_at) conflict("This cashier shift is closed", "CASHIER_SHIFT_CLOSED");
  if (integer(body.activity_revision, "activity_revision", 1) !== revision.activity_revision)
    conflict("Refresh the shift reconciliation", "RECONCILIATION_CHANGED");
  const declared = declaredCounts(body, rows);
  return respond({
    shift_id: id,
    activity_revision: revision.activity_revision,
    counts: rows.map(({ expected_minor, ...row }) => {
      const amount = declared.get(countKey(row))!.declared_minor;
      return { ...row, declared_minor: amount, variance_minor: amount - expected_minor };
    }),
  });
}

function validateFloatTender(
  entry: Record<string, unknown>,
  types: PaymentType[],
) {
  const currency = currencyOf(entry.currency);
  const id = recordId(entry.payment_type_id, "payment_type_id");
  const type = types.find(
    (type) => type.id === id && type.currency === currency,
  );
  if (!type || !allowsCashFloat(type))
    invalid("Choose a payment type and currency that allow cash floats");
  return { currency, payment_type_id: id };
}

function shiftTenders(shift: CashierShift) {
  const types = JSON.parse(shift.payment_types_json) as (Omit<PaymentType, "currency"> &
    { currency?: PaymentType["currency"]; currencies?: PaymentType["currency"][] })[];
  return types.flatMap((type) => (type.currency ? [type.currency] : type.currencies ?? [])
    .map((currency) => ({ payment_type_id: type.id, payment_type_name: type.name, currency })));
}

export async function writeShift(
  context: PosContext,
  command: Command,
  id?: string,
  action?: string,
) {
  const { db, identity, profile, config, now } = context;
  const actor = identity.user_id;
  if (!id) {
    if (!config.cashier_shift_enabled)
      conflict(
        "Cashier shifts are disabled on this profile",
        "FEATURE_DISABLED",
      );
    if (await selectShift(context))
      conflict(
        "A cashier shift is already open on this profile",
        "CASHIER_SHIFT_OPEN",
      );
    const [{ day }, types] = await Promise.all([
      operatingContext(context, false),
      context.storeImport?.shiftPaymentTypes ?? paymentTypes(context),
    ]);
    const opening = list(
      command.body.opening_cash ?? [],
      "opening_cash",
      40,
    ).map((raw) => {
      const entry = object(raw);
      return {
        ...validateFloatTender(entry, types),
        amount_minor: integer(entry.amount_minor, "amount_minor", 0),
      };
    });
    const keys = new Set(opening.map(countKey));
    if (keys.size !== opening.length)
      invalid("Provide one opening balance per payment type and currency");
    const shift = context.storeImport?.resourceId ?? newId("poss");
    const writes = [
      sql(
        db,
        `INSERT INTO cashier_shifts
      (id,business_id,branch_id,profile_id,working_day_id,opened_at,opened_by,payment_types_json,base_currency,exchange_rate,business_date,opening_sequence)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,(
        SELECT coalesce(max(opening_sequence),0)+1 FROM cashier_shifts WHERE business_id=? AND profile_id=?
      ))`,
        shift,
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
        identity.business_id,
        profile.id,
      ),
    ];
    for (const type of types.filter(allowsCashFloat)) {
      const amount =
        opening.find(
          (entry) =>
            entry.payment_type_id === type.id && entry.currency === type.currency,
        )?.amount_minor ?? 0;
      writes.push(
        sql(
          db,
          `INSERT INTO cash_floats(id,shift_id,payment_type_id,currency,kind,amount_minor,created_at,created_by)
          VALUES (?,?,?,?,'opening',?,?,?)`,
          newId("posf"),
          shift,
          type.id,
          type.currency,
          amount,
          now,
          actor,
        ),
      );
    }
    return command.commit(
      201,
      openGuard(day, null),
      writes,
      shiftResult(shift),
    );
  }
  const shift = await selectShift(context, id);
  if (!shift) missing("Cashier shift");
  if (action === "reopen") {
    requireManager(identity.role);
    const reason = string(command.body.reason, "reason", 500);
    const guard = `EXISTS(SELECT 1 FROM cashier_shifts s WHERE s.id=? AND ${reopenEligible})`;
    if (!config.cashier_shift_enabled || config.working_day_enabled !== Boolean(shift.working_day_id) ||
        !(await sql(db, `SELECT ${guard} AS allowed`, id).first<number>("allowed")))
      conflict("Only the latest eligible shift can be reopened", "SHIFT_REOPEN_UNAVAILABLE");
    return command.commit(200, { query: guard, params: [id], manager: true }, [
      sql(db, `INSERT INTO cashier_shift_reopens
        (id,shift_id,reopened_at,reopened_by,reason,previous_closed_at,previous_closed_by,previous_counts_json)
        SELECT ?,s.id,?,?,?,s.closed_at,s.closed_by,
          (SELECT json_group_array(json_object('payment_type_id',payment_type_id,'payment_type_name',payment_type_name,
            'currency',currency,'expected_minor',expected_minor,'declared_minor',declared_minor,'variance_minor',variance_minor))
            FROM cashier_shift_closing_counts WHERE shift_id=s.id)
        FROM cashier_shifts s WHERE s.id=?`, newId("posr"), now, actor, reason, id),
      sql(db, "DELETE FROM cashier_shift_closing_counts WHERE shift_id=?", id),
      sql(db, "UPDATE cashier_shifts SET closed_at=NULL,closed_by=NULL,activity_revision=activity_revision+1 WHERE id=?", id),
    ], shiftResult(id));
  }
  if (shift.closed_at)
    conflict("This cashier shift is closed", "CASHIER_SHIFT_CLOSED");
  if (action === "cash-floats") {
    const snapshot = JSON.parse(shift.payment_types_json) as Array<
      Omit<PaymentType, "currency"> & { currency?: PaymentType["currency"]; currencies?: PaymentType["currency"][] }
    >;
    const { currency, payment_type_id } = validateFloatTender(
      command.body,
      snapshot.flatMap(({ currency, currencies, ...type }) =>
        (currency ? [currency] : currencies ?? []).map((currency) => ({ ...type, currency })),
      ),
    );
    const kind = choice(command.body.kind, "kind", [
      "cash_in",
      "cash_out",
    ] as const);
    const amount = integer(command.body.amount_minor, "amount_minor", 1);
    const reason = string(command.body.reason, "reason", 500);
    const reasonCode = command.body.reason_code == null ? null :
      choice(command.body.reason_code, "reason_code", ["add_change", "safe_drop", "petty_cash", "correction", "other"] as const);
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
          id,
          payment_type_id,
          currency,
          kind,
          amount,
          reason,
          now,
          actor,
          reasonCode,
        ),
        ...updateShiftActivity(context, shift),
      ],
      {
        query: `SELECT ${jsonRow("f", "id shift_id payment_type_id currency kind amount_minor reason created_at created_by")}
      FROM cash_floats f WHERE id=?`,
        params: [float],
      },
    );
  }
  const revision = integer(
    command.body.activity_revision,
    "activity_revision",
    1,
  );
  if (revision !== shift.activity_revision)
    conflict("Refresh the shift reconciliation", "RECONCILIATION_CHANGED");
  const { results } = await expectedCounts(db, id).all<Count>();
  const declared = declaredCounts(command.body, results);
  if (context.storeImport) {
    if (results.some((row) => declared.get(countKey(row))!.expected_minor !== row.expected_minor)) {
      conflict(
        "The saved drawer amounts differ from the server ledger",
        "RECONCILIATION_CHANGED",
      );
    }
  }
  return command.commit(
    200,
    {
      query:
        "EXISTS (SELECT 1 FROM cashier_shifts WHERE id=? AND closed_at IS NULL AND activity_revision=?)",
      params: [id, revision],
      allowReadOnly: true,
    },
    [
      sql(
        db,
        "UPDATE cashier_shifts SET closed_at=?,closed_by=? WHERE id=?",
        now,
        actor,
        id,
      ),
      sql(
        db,
        `INSERT INTO cashier_shift_closing_counts
      (shift_id,payment_type_id,payment_type_name,currency,expected_minor,declared_minor)
      SELECT ?,json_extract(value,'$.payment_type_id'),json_extract(value,'$.payment_type_name'),json_extract(value,'$.currency'),
        json_extract(value,'$.expected_minor'),json_extract(value,'$.declared_minor') FROM json_each(?)`,
        id,
        JSON.stringify(
          results.map((row) => ({
            ...row,
            declared_minor: declared.get(countKey(row))!.declared_minor,
          })),
        ),
      ),
      promoteProfile(context),
    ],
    shiftResult(id),
  );
}
