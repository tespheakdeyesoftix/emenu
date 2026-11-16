import type { TelegramSource } from "../../../shared/telegramNotifications";
import type { TemplateRecord, TemplateValue } from "./telegramTemplate";

const business = {
  id: "business_demo",
  name: "Sample Cafe",
  slug: "sample-cafe",
  currency: "USD",
  timezone: "Asia/Phnom_Penh",
};
const branch = {
  id: "branch_demo",
  name: "Main Branch",
  slug: "main",
  address: "1 Market Street",
  phone: "012 345 678",
};
const sampleCommon = {
  business_id: business.id,
  branch_id: branch.id,
  business,
  branch,
};
const sampleProduct = {
  id: "product_demo",
  code: "C01",
  name: "Coffee",
  name_km: "កាហ្វេ",
  name_en: "Coffee",
  name_zh: "咖啡",
  unit: "Cup",
  category: { id: "category_demo", name: "Drinks", slug: "drinks" },
};
const modifierFields = {
  id: "option_demo",
  groupId: "group_demo",
  labelKm: "",
  labelEn: "Oat milk",
  labelZh: "",
  prefix: "",
  priceCents: 0.5,
};

export const telegramExamples: Record<TelegramSource, TemplateRecord> = {
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
      group: { id: "tables_demo", name: "Main Area" },
    },
    menu_id: "menu_demo",
    menu: {
      id: "menu_demo",
      slug: "dinner",
      name_km: "",
      name_en: "Dinner",
      name_zh: "",
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
          priceCents: 3,
        },
        price_list_record: { id: "normal_demo", name: "Normal Rate" },
        product: sampleProduct,
        modifiers: [modifierFields],
      },
    ],
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
    updated_at: "2026-11-10 05:00:00",
  },
};

const businessJson = `json_object('id',b.id,'name',b.name,'slug',b.slug,'currency',b.currency,'timezone',b.timezone)`;
const branchJson = `CASE WHEN br.id IS NOT NULL THEN
  json_object('id',br.id,'name',br.name,'slug',br.slug,'address',br.address,'phone',br.phone) END`;

function parseFields(row: TemplateRecord, fields: string[]) {
  for (const name of fields) {
    const value = row[name];
    if (typeof value === "string")
      row[name] = JSON.parse(value) as TemplateValue;
  }
  return row;
}

async function orderContext(
  db: D1Database,
  businessId: string,
  sourceId: string,
) {
  const [orders, lines] = await db.batch<TemplateRecord>([
    db
      .prepare(
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
      WHERE o.business_id=? AND o.id=?`,
      )
      .bind(businessId, sourceId),
    db
      .prepare(
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
      WHERE o.business_id=? AND o.id=? ORDER BY line.line_number`,
      )
      .bind(businessId, sourceId),
  ]);
  const order = orders.results[0];
  if (!order) return null;
  order.products = lines.results.map((line) => {
    parseFields(line, ["product", "price_list_record", "portion", "modifiers"]);
    // Older line snapshots may omit optional modifier fields.
    if (Array.isArray(line.modifiers))
      line.modifiers = line.modifiers.map((modifier) => ({
        ...Object.fromEntries(
          Object.keys(modifierFields).map((key) => [key, null]),
        ),
        ...(modifier && typeof modifier === "object" && !Array.isArray(modifier)
          ? modifier
          : {}),
      }));
    return line;
  });
  return parseFields(order, ["business", "branch", "table", "menu"]);
}

export async function telegramSourceContext(
  db: D1Database,
  businessId: string,
  source: TelegramSource,
  sourceId: string,
) {
  if (source === "Order") return orderContext(db, businessId, sourceId);
  const booking = await db
    .prepare(
      `SELECT bk.id,bk.business_id,bk.branch_id,bk.arrival_date,bk.arrival_time,
    bk.arrival_at,bk.timezone,bk.pax,bk.guest_name,bk.guest_phone,bk.preference,bk.preference_text,bk.note,bk.status,
    bk.terms_language,bk.terms_version,bk.terms_text,bk.terms_accepted_at,bk.created_at,bk.updated_at,
    ${businessJson} AS business,${branchJson} AS branch
    FROM bookings bk JOIN businesses b ON b.id=bk.business_id
    JOIN branches br ON br.business_id=bk.business_id AND br.id=bk.branch_id
    WHERE bk.business_id=? AND bk.id=?`,
    )
    .bind(businessId, sourceId)
    .first<TemplateRecord>();
  return booking ? parseFields(booking, ["business", "branch"]) : null;
}
