import { pageOf, requireManager, respond, sql, type PosContext } from "./posApiCore";

export const registerManager = (role: string) => role === "manager" || role === "owner";

export function shiftNameColumns(alias: string) {
  return `(SELECT display_name FROM users WHERE id=${alias}.opened_by) AS opened_by_name,
    (SELECT display_name FROM users WHERE id=${alias}.closed_by) AS closed_by_name`;
}

function saleTotals(context: PosContext, column: "shift_id" | "working_day_id", id: string) {
  return sql(context.db,
    `SELECT currency,secondary_exchange_rate AS exchange_rate,sum(total_minor) AS amount_minor,
      sum(CASE WHEN reverses_sale_id IS NULL THEN 1 ELSE 0 END) AS paid_bills
    FROM sales WHERE ${column}=? AND status='paid' GROUP BY currency,secondary_exchange_rate`, id);
}

export function shiftPayments(context: PosContext, id: string) {
  return sql(context.db,
    `SELECT p.payment_type_id,max(p.payment_type_name) AS payment_type_name,p.payment_kind,p.currency,
      sum(p.amount_minor) AS amount_minor,
      sum(CASE WHEN s.reverses_sale_id IS NULL THEN p.amount_minor ELSE 0 END) AS payments_minor,
      sum(CASE WHEN s.reverses_sale_id IS NOT NULL THEN p.amount_minor ELSE 0 END) AS reversals_minor
    FROM sales s JOIN sale_payments p ON p.sale_id=s.id
    WHERE s.shift_id=? AND s.status='paid'
    GROUP BY p.payment_type_id,p.payment_kind,p.currency ORDER BY p.payment_type_id,p.currency`, id);
}

export async function shiftSummary(context: PosContext, id: string, drawerCounts?: D1PreparedStatement) {
  const [sales, payments, cash, activity, drawer] = await context.db.batch<Record<string, unknown>>([
    saleTotals(context, "shift_id", id),
    shiftPayments(context, id),
    sql(context.db,
      `SELECT currency,kind,sum(amount_minor) AS amount_minor FROM cash_floats
      WHERE shift_id=? GROUP BY currency,kind`, id),
    sql(context.db,
      `SELECT f.*,u.display_name AS created_by_name FROM cash_floats f
      LEFT JOIN users u ON u.id=f.created_by WHERE f.shift_id=? AND f.kind<>'opening'
      ORDER BY f.created_at DESC,f.id DESC LIMIT 10`, id),
    ...(drawerCounts == null ? [] : [drawerCounts]),
  ]);
  return {
    sales: sales.results,
    payments: payments.results,
    cash: cash.results.filter((row) => row.kind !== "opening" || registerManager(context.identity.role)),
    movements: activity.results,
    drawer_counts: drawer?.results ?? [],
  };
}

export async function daySummary(context: PosContext, id: string) {
  requireManager(context.identity.role);
  const db = context.db;
  const [sales, shifts, bills, discrepancies, registers] = await db.batch<Record<string, unknown>>([
    saleTotals(context, "working_day_id", id),
    sql(db,
      `SELECT s.id,s.profile_id,p.name AS profile_name,s.opened_at,s.closed_at,
        ${shiftNameColumns("s")}
      FROM cashier_shifts s JOIN pos_profiles p ON p.id=s.profile_id
      WHERE s.working_day_id=? ORDER BY s.opened_at,s.id`, id),
    sql(db,
      `SELECT s.id,s.profile_id,p.name AS profile_name,s.table_code FROM sales s
      JOIN pos_profiles p ON p.id=s.profile_id WHERE s.working_day_id=? AND s.status='open'
      ORDER BY p.name,s.id`, id),
    sql(db,
      `SELECT c.shift_id,c.payment_type_name,c.currency,c.variance_minor FROM cashier_shift_closing_counts c
      JOIN cashier_shifts s ON s.id=c.shift_id WHERE s.working_day_id=? AND c.variance_minor<>0
      ORDER BY s.opened_at,s.id,c.payment_type_id,c.currency`, id),
    sql(db, `SELECT profile_id FROM sales WHERE working_day_id=? AND status='paid' GROUP BY profile_id`, id),
  ]);
  return {
    sales: sales.results,
    shifts: shifts.results,
    open_bills: bills.results,
    register_count: new Set([...shifts.results, ...bills.results, ...registers.results].map((row) => row.profile_id)).size,
    discrepancies: discrepancies.results,
  };
}

export async function readShiftAudit(db: D1Database, url: URL, businessId: string) {
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
