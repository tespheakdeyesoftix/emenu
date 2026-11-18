import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../apps/control/package.json", import.meta.url),
);
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");
const directory = resolve(root, ".wrangler/order-tests");
process.env.WRANGLER_LOG_PATH = resolve(directory, "wrangler.log");
process.env.WRANGLER_SEND_METRICS = "false";
const { unstable_splitSqlQuery: splitSql } = require("wrangler");
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let runtime;
let db;

test("visit estimate follows the device and table across midnight, then resets at the three-hour gap", async () => {
  const bundle = await build({
    entryPoints: [resolve(root, "apps/menu/src/utils/visitSpend.ts")],
    bundle: true,
    format: "esm",
    write: false,
  });
  const { activeVisitOrders, visitSpend } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
  const receipt = (submittedAt, status, totalAmount, overrides = {}) => ({
    submittedAt, status, totalAmount, deviceId: "device-a", tableId: "table-a",
    currency: "USD", ...overrides,
  });
  const orders = [
    receipt("2026-11-06T15:00:00Z", "completed", 10),
    receipt("2026-11-06T17:30:00Z", "accepted", 14),
    receipt("2026-11-06T18:00:00Z", "submitted", 8),
    receipt("2026-11-06T18:01:00Z", "cancelled", 7),
    receipt("2026-11-06T18:02:00Z", "accepted", 15_000, { currency: "KHR" }),
    receipt("2026-11-06T18:02:00Z", "submitted", 50, { tableId: "table-b" }),
    receipt("2026-11-06T18:02:00Z", "submitted", 60, { deviceId: "device-b" }),
    receipt("2026-11-06T12:00:00Z", "completed", 99),
    receipt(null, "completed", 100),
  ];
  const now = Date.parse("2026-11-06T18:30:00Z");
  const totals = visitSpend(activeVisitOrders(orders, "table-a", "device-a", now));
  assert.deepEqual(totals.get("USD"), { estimated: 32, awaiting: 8 });
  assert.deepEqual(totals.get("KHR"), { estimated: 15_000, awaiting: 0 });
  assert.deepEqual(visitSpend(activeVisitOrders(orders, "table-b", "device-a", now)).get("USD"), {
    estimated: 50, awaiting: 50,
  });
  assert.deepEqual(visitSpend(activeVisitOrders(orders, "table-a", "device-b", now)).get("USD"), {
    estimated: 60, awaiting: 60,
  });
  assert.deepEqual(activeVisitOrders(
    orders, "table-a", "device-a", Date.parse("2026-11-06T21:02:00Z"),
  ), []);
});

before(async () => {
  await mkdir(directory, { recursive: true });
  const bundle = resolve(directory, "worker.mjs");
  await build({
    entryPoints: [resolve(root, "apps/control/worker/index.ts")],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "neutral",
    external: ["cloudflare:workers"],
  });
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      workers: [
        {
          name: "control",
          modules: true,
          scriptPath: bundle,
          compatibilityDate: "2026-09-01",
          d1Databases: { DB: "isolated-order-tests" },
          kvNamespaces: ["CATALOG_CACHE"],
          bindings: { ALLOWED_ORIGINS: "http://localhost" },
        },
      ],
    }),
  );
  db = await runtime.getD1Database("DB", "control");
  const migrations = resolve(root, "apps/control/migrations");
  for (const name of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    if (name === "0039_branches_and_menus.sql") {
      await db.batch([
        db.prepare(`INSERT INTO businesses (id,name,slug,address) VALUES ('legacy','Legacy Restaurant','legacy','Old Street')`),
        db.prepare(`INSERT INTO table_groups (id,business_id,name) VALUES ('legacy_area','legacy','Main Area')`),
        db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
          VALUES ('legacy_table','legacy','legacy_area','A1','Table A1','scan_printed')`),
        db.prepare(`INSERT INTO orders (id,business_id,posting_date,table_id,total_quantity,total_amount,currency,submission_id,submission_hash,order_number)
          VALUES ('legacy_order','legacy','2026-11-01','legacy_table',1,5,'USD','legacy-submission','legacy-hash','261101-001')`),
        db.prepare(`INSERT INTO order_products
          (order_id,line_number,product_id,quantity,price,portion_name,price_list,modifiers,total_amount,note,portion_id,product_code,product_name)
          VALUES ('legacy_order',1,'legacy_product',1,5,'Large','legacy_prices','[{"id":"oat"}]',5,'Less ice','large','C01','Coffee')`),
        db.prepare(`INSERT INTO analytics_events (id,business_id,session_id,event_type,local_date,local_hour)
          VALUES ('legacy_event','legacy','legacy-session','menu_open','2026-11-01',8)`),
      ]);
    }
    if (name === "0072_order_product_accepted_status.sql") {
      await db.prepare("UPDATE order_products SET status='confirmed' WHERE order_id='legacy_order'").run();
    }
    const sql = await readFile(resolve(migrations, name), "utf8");
    await db.batch(splitSql(sql).map((statement) => db.prepare(statement)));
  }
  await db.batch([
    db.prepare(`INSERT INTO businesses (id,name,slug,currency,pricing_mode,default_price_list_id)
      VALUES ('biz','Test','test','USD','manual','special'),('other','Other','other','USD','manual',NULL)`),
    db.prepare(`UPDATE businesses SET latitude=0,longitude=0,enable_submit_order=1 WHERE id='biz'`),
    db.prepare(`UPDATE businesses SET latitude=1,longitude=2 WHERE id='other'`),
    db.prepare(`INSERT INTO table_groups (id,business_id,name)
      VALUES ('area','biz','Main'),('other_area','other','Other')`),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
      VALUES ('table','biz','area','T1','Table 1','scan_test'),
        ('foreign_table','other','other_area','T2','Table 2','scan_other')`),
    db.prepare(`INSERT INTO price_lists (id,business_id,name,is_normal)
      VALUES ('normal','biz','Normal Rate',1),('special','biz','Special',0)`),
    db.prepare(`INSERT INTO categories (id,business_id,name,slug,is_active)
      VALUES ('visible','biz','Visible','visible',1),('hidden','biz','Hidden','hidden',0),
        ('foreign_category','other','Other','other',1)`),
    db.prepare(`INSERT INTO categories (id,business_id,parent_id,name,slug)
      VALUES ('hidden_child','biz','hidden','Child','child')`),
    db.prepare(`INSERT INTO products (id,business_id,category_id,name,slug,price_cents)
      VALUES ('water','biz','visible','Water','water',1),
        ('hidden_product','biz','hidden_child','Hidden','hidden',1),
        ('foreign_product','other','foreign_category','Other','other',1)`),
    db
      .prepare(
        `INSERT INTO products
      (id,business_id,category_id,name,slug,price_cents,portions_json,modifier_groups_json)
      VALUES ('coffee','biz','visible','Coffee','coffee',2,?,?)`,
      )
      .bind(
        JSON.stringify([{ id: "large", labelKm: "Large", priceCents: 3 }]),
        JSON.stringify([
          {
            id: "milk",
            required: true,
            multiple: false,
            options: [
              { id: "oat", labelKm: "Oat milk", priceCents: 0.5 },
              { id: "regular", labelKm: "Milk", priceCents: null },
            ],
          },
        ]),
      ),
    db.prepare(`INSERT INTO product_prices (business_id,price_list_id,product_id,target_key,price_amount)
      VALUES ('biz','normal','coffee','large',4),('biz','special','water','base',1.5)`),
  ]);
});

after(async () => runtime?.dispose());

test("production migration assigns historical rows to one default branch and preserves the printed QR", async () => {
  const branch = await db.prepare("SELECT * FROM branches WHERE business_id='legacy'").first();
  assert.equal(branch.is_default,1);
  assert.equal(branch.name,"Legacy Restaurant");
  assert.equal(branch.address,"Old Street");
  for (const [table,id] of [["table_groups","legacy_area"],["restaurant_tables","legacy_table"],
    ["orders","legacy_order"],["analytics_events","legacy_event"]]) {
    assert.equal(await db.prepare(`SELECT branch_id FROM ${table} WHERE id=?`).bind(id).first("branch_id"),branch.id);
  }
  const printed = await runtime.dispatchFetch("http://localhost/api/public/businesses/legacy/table-context/scan_printed");
  assert.equal(printed.status,200);
  assert.equal((await printed.json()).tableId,"legacy_table");
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM branches WHERE business_id='legacy'").first("count"),1);
});

test("backfills a UUID and migrates the confirmed status of a saved line", async () => {
  const { id, ...line } = await db.prepare("SELECT * FROM order_products WHERE order_id='legacy_order'").first();
  assert.match(id, uuidV4);
  assert.deepEqual(line, {
    order_id: "legacy_order", line_number: 1, product_id: "legacy_product", quantity: 1, price: 5,
    portion_name: "Large", price_list: "legacy_prices", modifiers: '[{"id":"oat"}]', total_amount: 5,
    note: "Less ice", portion_id: "large", product_code: "C01", product_name: "Coffee", status: "accepted",
  });
});

test("category browsing stays enabled for businesses registered before the migration", async () => {
  const existing = await db.prepare("SELECT allow_category_browsing FROM businesses WHERE id='legacy'")
    .first("allow_category_browsing");
  assert.equal(existing, 1);
  const response = await runtime.dispatchFetch("http://localhost/api/public/businesses/legacy/menu");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).menu, null);
});

function order() {
  return {
    submissionId: randomUUID(),
    deviceId: randomUUID(),
    tableToken: "scan_test",
    tableId: "table",
    expectedCurrency: "USD",
    latitude: 0,
    longitude: 0,
    items: [
      {
        productId: "coffee",
        portionId: "large",
        modifierIds: ["oat"],
        quantity: 2,
        expectedPrice: 4.5,
        note: " Less ice ",
      },
      { productId: "water", quantity: 1, expectedPrice: 1.5 },
    ],
  };
}

function submit(body) {
  return runtime.dispatchFetch(
    "http://localhost/api/public/businesses/test/orders",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://menu.example",
      },
      body: JSON.stringify(body),
    },
  );
}

test("daily plan limit is shared across branches and honors retries at the last slot", async () => {
  await db.batch([
    db.prepare("INSERT INTO subscription_plans (id,code,name,max_daily_orders) VALUES ('daily','daily','Daily test',1)"),
    db.prepare(`INSERT INTO businesses (id,name,slug,currency,enable_submit_order,latitude,longitude)
      VALUES ('daily_biz','Daily test','daily-test','USD',1,0,0)`),
    db.prepare("INSERT INTO business_subscriptions (id,business_id,plan_id) VALUES ('daily_sub','daily_biz','daily')"),
    db.prepare("INSERT INTO branches (id,business_id,slug,name) VALUES ('second_branch','daily_biz','second','Second')"),
    db.prepare(`INSERT INTO table_groups (id,business_id,branch_id,name) VALUES
      ('daily_main','daily_biz',NULL,'Main'),('daily_second','daily_biz','second_branch','Second')`),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token) VALUES
      ('main_table','daily_biz','daily_main','A','Table A','daily_a'),
      ('second_table','daily_biz','daily_second','B','Table B','daily_b')`),
    db.prepare("INSERT INTO categories (id,business_id,name,slug) VALUES ('daily_cat','daily_biz','Drinks','drinks')"),
    db.prepare(`INSERT INTO products (id,business_id,category_id,name,slug,price_cents)
      VALUES ('daily_water','daily_biz','daily_cat','Water','water',1)`),
  ]);
  const checkout = (second = false) => ({
    ...order(), branch: second ? "second" : null,
    tableToken: second ? "daily_b" : "daily_a", tableId: second ? "second_table" : "main_table",
    items: [{ productId: "daily_water", quantity: 1, expectedPrice: 1 }],
  });
  const send = (body) => runtime.dispatchFetch("http://localhost/api/public/businesses/daily-test/orders", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const previous = await send(checkout());
  assert.equal(previous.status, 201);
  const { orderId } = await previous.json();
  await db.prepare("UPDATE orders SET posting_date='2000-01-01',order_number='000101-001' WHERE id=?").bind(orderId).run();
  const attempts = [checkout(), checkout(true)];
  const responses = await Promise.all(attempts.map(send));
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  const rejected = responses.find(response => response.status === 409);
  assert.equal((await rejected.json()).code, "order_limit_reached");
  const winner = attempts[responses.findIndex(response => response.status === 201)];
  assert.equal((await send(winner)).status, 200);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM orders WHERE business_id='daily_biz'").first("count"), 2);
});

test("public menu includes the configured location only when order submission is enabled", async () => {
  const getMenu = (slug) =>
    runtime.dispatchFetch(`http://localhost/api/public/businesses/${slug}/menu`);

  for (const cacheStatus of ["MISS", "HIT"]) {
    const response = await getMenu("test");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-catalog-cache"), cacheStatus);
    const { business } = await response.json();
    assert.equal(business.enableSubmitOrder, true);
    assert.equal(business.orderRadiusMeters, 100);
    assert.deepEqual(business.orderLocation, { latitude: 0, longitude: 0 });
  }

  const response = await getMenu("other");
  assert.equal(response.status, 200);
  const { business } = await response.json();
  assert.equal(business.enableSubmitOrder, false);
  assert.equal(business.orderLocation, null);
  assert.equal(business.latitude, undefined);
  assert.equal(business.longitude, undefined);
});

test("saves table, date, current prices, modifiers and notes and handles simultaneous retries", async () => {
  await db.prepare(
    `INSERT INTO orders
      (id,business_id,posting_date,table_id,total_quantity,total_amount,currency,submission_id,submission_hash,order_number)
     VALUES ('prior-day','biz','2025-01-01','table',1,1,'USD','prior-day','prior-day','250101-999')`,
  ).run();
  const body = { ...order(), note: "  Please serve the drinks first.  " };
  const responses = await Promise.all([submit(body), submit(body)]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 201],
  );
  assert.equal(responses[0].headers.get("access-control-allow-origin"), "*");
  const [receipt, replay] = await Promise.all(
    responses.map((response) => response.json()),
  );
  assert.deepEqual(replay, receipt);
  assert.equal(receipt.totalQuantity, 3);
  assert.equal(receipt.totalAmount, 10.5);
  assert.equal(receipt.currency, "USD");
  assert.equal(receipt.note, "Please serve the drinks first.");
  const conflict = await submit({ ...body, note: "Please serve the food first." });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, "submission_conflict");
  assert.match(receipt.postingDate, /^\d{4}-\d{2}-\d{2}$/);
  const prefix = receipt.postingDate.slice(2).replaceAll("-", "");
  assert.equal(receipt.orderNumber, `${prefix}-001`);
  const header = await db
    .prepare("SELECT business_id, table_id, note FROM orders WHERE id=?")
    .bind(receipt.orderId)
    .first();
  assert.deepEqual(header, { business_id: "biz", table_id: "table", note: receipt.note });
  const { results: lines } = await db
    .prepare(
      "SELECT * FROM order_products WHERE order_id=? ORDER BY line_number",
    )
    .bind(receipt.orderId)
    .all();
  assert.equal(lines.length, 2);
  assert.match(lines[0].id, uuidV4);
  assert.match(lines[1].id, uuidV4);
  assert.notEqual(lines[0].id, lines[1].id);
  assert.equal(lines[0].portion_name, "Large");
  assert.equal(lines[0].portion_id, "large");
  assert.equal(lines[0].price_list, "normal");
  assert.equal(lines[0].price, 4.5);
  assert.equal(lines[0].total_amount, 9);
  assert.equal(lines[0].note, "Less ice");
  assert.deepEqual(JSON.parse(lines[0].modifiers), [
    { id: "oat", labelKm: "Oat milk", priceCents: 0.5, groupId: "milk" },
  ]);
  assert.equal(lines[1].price_list, "special");
  assert.equal(lines[1].modifiers, "[]");
  body.items[0].note = "Changed note";
  assert.equal((await submit(body)).status, 409);
});

test("simultaneous new orders get consecutive numbers for the same business day", async () => {
  const withoutNote = order();
  const responses = await Promise.all([submit(withoutNote), submit(order())]);
  assert.deepEqual(responses.map((response) => response.status), [201, 201]);
  const receipts = await Promise.all(responses.map((response) => response.json()));
  assert.equal(receipts[0].note, "");
  assert.equal((await submit({ ...withoutNote, note: " " })).status, 200);
  const prefix = receipts[0].postingDate.slice(2).replaceAll("-", "");
  assert.deepEqual(receipts.map((receipt) => receipt.orderNumber).sort(), [
    `${prefix}-002`, `${prefix}-003`,
  ]);
});

test("accepts older QR links and checks the table ID on new links", async () => {
  const contextUrl = "http://localhost/api/public/businesses/test/table-context/scan_test";
  for (const query of ["", "?table_id=table"]) {
    const response = await runtime.dispatchFetch(contextUrl + query);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).tableId, "table");
  }
  const response = await runtime.dispatchFetch(contextUrl + "?table_id=foreign_table");
  assert.equal(response.status, 404);
  const { tableId, ...legacyOrder } = order();
  assert.equal((await submit(legacyOrder)).status, 201);
});

test("rejects invalid table, selections and stale prices without writing orders", async () => {
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM orders")
    .first("count");
  const cases = [
    [{ ...order(), tableToken: "" }, 400, "invalid_order"],
    [{ ...order(), note: 42 }, 400, "invalid_order"],
    [{ ...order(), note: "x".repeat(501) }, 400, "invalid_order"],
    [{ ...order(), tableToken: "scan_other" }, 404, "table_unavailable"],
    [{ ...order(), tableId: "foreign_table" }, 404, "table_unavailable"],
    [{ ...order(), expectedCurrency: "KHR" }, 409, "price_changed"],
    [
      {
        ...order(),
        items: [
          { productId: "foreign_product", quantity: 1, expectedPrice: 1 },
        ],
      },
      409,
      "selection_changed",
    ],
    [
      {
        ...order(),
        items: [{ productId: "hidden_product", quantity: 1, expectedPrice: 1 }],
      },
      409,
      "selection_changed",
    ],
  ];
  for (const [change, code] of [
    [{ quantity: 0 }, "invalid_order"],
    [{ portionId: null }, "selection_changed"],
    [{ modifierIds: [] }, "selection_changed"],
    [{ modifierIds: ["oat", "regular"] }, "selection_changed"],
    [{ modifierIds: ["oat", "unknown"] }, "selection_changed"],
    [{ expectedPrice: 1 }, "price_changed"],
  ]) {
    const body = order();
    Object.assign(body.items[0], change);
    cases.push([body, code === "invalid_order" ? 400 : 409, code]);
  }
  for (const [body, status, code] of cases) {
    const response = await submit(body);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
  await db
    .prepare("UPDATE businesses SET enable_add_to_order=0 WHERE id='biz'")
    .run();
  try {
    assert.equal((await submit(order())).status, 403);
  } finally {
    await db
      .prepare("UPDATE businesses SET enable_add_to_order=1 WHERE id='biz'")
      .run();
  }
  await db.prepare("UPDATE table_groups SET is_active=0 WHERE id='area'").run();
  try {
    assert.equal((await submit(order())).status, 404);
  } finally {
    await db
      .prepare("UPDATE table_groups SET is_active=1 WHERE id='area'")
      .run();
  }
  assert.equal(
    await db.prepare("SELECT COUNT(*) AS count FROM orders").first("count"),
    count,
  );
});

test("requires customer location within the configured radius for new submissions", async () => {
  const defaults = await db
    .prepare("SELECT enable_submit_order,order_radius_meters FROM businesses WHERE id='other'")
    .first();
  assert.deepEqual(defaults, { enable_submit_order: 0, order_radius_meters: 100 });

  const countOrders = () => db.prepare("SELECT COUNT(*) AS count FROM orders").first("count");
  const count = await countOrders();
  for (const [body, status, code] of [
    [{ ...order(), latitude: undefined }, 400, "location_required"],
    [{ ...order(), longitude: "0" }, 400, "location_required"],
    [{ ...order(), latitude: 91 }, 400, "location_required"],
    [{ ...order(), latitude: 0.00091 }, 403, "outside_order_radius"],
  ]) {
    const response = await submit(body);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
  assert.equal(await countOrders(), count);

  const nearby = { ...order(), latitude: 0.00089 };
  assert.equal((await submit(nearby)).status, 201);
  await db.prepare("UPDATE businesses SET order_radius_meters=125 WHERE id='biz'").run();
  try {
    assert.equal((await submit({ ...order(), latitude: 0.001 })).status, 201);
    await db.prepare("UPDATE businesses SET enable_submit_order=0 WHERE id='biz'").run();
    const blocked = await submit(order());
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, "ordering_disabled");
    assert.equal((await submit({ ...nearby, latitude: undefined })).status, 200);
    assert.equal(await countOrders(), count + 2);
  } finally {
    await db.prepare("UPDATE businesses SET enable_submit_order=1,order_radius_meters=100 WHERE id='biz'").run();
  }
});

test("rolls back the header and all lines when a line insert fails", async () => {
  const body = order();
  await db
    .prepare(
      `CREATE TRIGGER reject_test_line BEFORE INSERT ON order_products
    WHEN NEW.line_number=2 BEGIN SELECT RAISE(ABORT, 'test order failure'); END`,
    )
    .run();
  try {
    assert.equal((await submit(body)).status, 500);
    assert.equal(
      await db
        .prepare("SELECT id FROM orders WHERE submission_id=?")
        .bind(body.submissionId)
        .first(),
      null,
    );
  } finally {
    await db.prepare("DROP TRIGGER reject_test_line").run();
  }
  assert.equal((await submit(body)).status, 201);
});

test("admin orders honor tenant, staff and sidebar access", async (t) => {
  for (const [user, business, role] of [
    ["manager", "biz", "manager"],
    ["editor", "biz", "editor"],
    ["other-owner", "other", "owner"],
  ]) {
    const hash = createHash("sha256").update(user).digest("hex");
    await db.batch([
      db.prepare("INSERT INTO users (id,email,display_name,password_hash,password_salt) VALUES (?,?,?,'','')")
        .bind(user, `${user}@example.test`, user),
      db.prepare("INSERT INTO memberships (user_id,business_id,role) VALUES (?,?,?)")
        .bind(user, business, role),
      db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+1 day'))")
        .bind(user, user, hash),
    ]);
  }
  const get = (suffix = "", token = "manager") =>
    runtime.dispatchFetch(`http://localhost/api/admin/orders${suffix}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const patch = (id, status, token = "manager") =>
    runtime.dispatchFetch(`http://localhost/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  const checkout = { ...order(), note: "Whole order request" };
  const submitted = await submit(checkout);
  assert.equal(submitted.status, 201);
  const { orderId, orderNumber, postingDate, submittedAt, status: initialStatus, tableId } =
    await submitted.json();
  assert.equal(initialStatus, "submitted");
  assert.equal(tableId, "table");
  assert.equal(new Date(submittedAt).toISOString(), submittedAt);
  const track = (key = checkout.submissionId, slug = "test", details = "") =>
    runtime.dispatchFetch(`http://localhost/api/public/businesses/${slug}/orders/${orderId}${details}`, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
    });
  const tracked = await track();
  assert.equal(tracked.status, 200);
  assert.equal(tracked.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await tracked.json(), { status: "submitted" });
  const trackedDetails = await track(checkout.submissionId, "test", "?details=1");
  assert.equal(trackedDetails.status, 200);
  const history = await trackedDetails.json();
  assert.equal(history.postingDate, postingDate);
  assert.equal(history.submittedAt, submittedAt);
  assert.equal(history.tableId, tableId);
  assert.equal(history.totalAmount, 10.5);
  assert.equal(history.currency, "USD");
  assert.equal(history.note, checkout.note);
  assert.deepEqual(history.items.map(({ status }) => status), ["submitted", "submitted"]);
  assert.deepEqual(
    history.items.map(({ name, quantity, portionName }) => ({ name, quantity, portionName })),
    [
      { name: "Coffee", quantity: 2, portionName: "Large" },
      { name: "Water", quantity: 1, portionName: "" },
    ],
  );
  assert.deepEqual(history.items.map(({ modifiers }) => modifiers), [
    [{ id: "oat", labelKm: "Oat milk", priceCents: 0.5, groupId: "milk" }],
    [],
  ]);
  assert.equal((await track("")).status, 404);
  assert.equal((await track(randomUUID())).status, 404);
  assert.equal((await track(checkout.submissionId, "other")).status, 404);
  assert.equal((await track(randomUUID(), "test", "?details=1")).status, 404);

  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { orders } = await response.json();
  assert.deepEqual(orders[0], {
    id: orderId, orderNumber, status: "submitted", postingDate,
    totalQuantity: 3, totalAmount: 10.5, currency: "USD",
    tableCode: "T1", tableLabel: "Table 1", groupName: "Main",
    branchId: await db.prepare("SELECT id FROM branches WHERE business_id='biz' AND is_default=1").first("id"),
    branchName: "Test", menuId: null,
  });
  const detail = await get(`/${orderId}`);
  assert.equal(detail.status, 200);
  const { order: orderDetails, products } = await detail.json();
  assert.equal(orderDetails.note, checkout.note);
  assert.equal(products.length, 2);
  assert.deepEqual(products.map(({ status }) => status), ["submitted", "submitted"]);
  assert.equal(products[0].name, "Coffee");
  assert.equal(products[0].portionName, "Large");
  assert.equal(products[0].priceListName, "Normal Rate");
  assert.equal(products[0].modifiers[0].labelKm, "Oat milk");
  assert.equal(products[0].note, "Less ice");
  assert.equal((await get("", "")).status, 401);
  assert.equal((await get("", "editor")).status, 403);
  assert.equal((await get(`/${orderId}`, "editor")).status, 403);
  assert.equal((await get(`/${orderId}`, "other-owner")).status, 404);
  assert.deepEqual((await (await get("", "other-owner")).json()).orders, []);
  assert.equal((await patch(orderId, "accepted", "editor")).status, 403);
  assert.equal((await patch(orderId, "accepted", "other-owner")).status, 404);
  assert.equal((await patch(orderId, "completed")).status, 409);
  assert.equal((await patch(orderId, "accepted")).status, 200);
  assert.equal((await patch(orderId, "accepted")).status, 200);
  assert.deepEqual(await (await track()).json(), { status: "accepted" });
  await db.prepare(`UPDATE order_products SET status=CASE line_number
    WHEN 1 THEN 'accepted' ELSE 'rejected' END WHERE order_id=?`).bind(orderId).run();
  const reviewed = await (await get(`/${orderId}`)).json();
  assert.deepEqual(reviewed.products.map(({ status }) => status), ["accepted", "rejected"]);
  const terminal = await Promise.all([
    patch(orderId, "completed"),
    patch(orderId, "cancelled"),
  ]);
  assert.deepEqual(terminal.map((result) => result.status).sort(), [200, 409]);
  const { status } = await terminal.find((result) => result.ok).json();
  assert.equal((await (await get(`/${orderId}`)).json()).order.status, status);
  assert.deepEqual(await (await track()).json(), { status });
  assert.equal((await patch(orderId, "accepted")).status, 409);

  const setDisabledPages = (pages) =>
    db.prepare("UPDATE businesses SET disabled_control_pages_json=? WHERE id='biz'")
      .bind(JSON.stringify(pages))
      .run();
  await setDisabledPages(["orders"]);
  try {
    for (const suffix of ["", `/${orderId}`]) {
      const blocked = await get(suffix);
      assert.equal(blocked.status, 403);
      assert.equal((await blocked.json()).code, "CONTROL_PAGE_DISABLED");
    }
    assert.equal((await patch(orderId, "cancelled")).status, 403);
    assert.equal((await submit(order())).status, 201);
  } finally {
    await setDisabledPages([]);
  }
  assert.equal((await get()).status, 200);
  assert.equal((await get(`/${orderId}`)).status, 200);

  await t.test("combines order status, table, branch, and posting date and lists inactive tables for historical orders", async () => {
    await db.batch([
      db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token,is_active)
        VALUES ('order_filter_table','biz','area','T99','Archived table','orders_filter_test',0)`),
      db.prepare(`INSERT INTO orders
        (id,business_id,posting_date,table_id,total_quantity,total_amount,currency,submission_id,submission_hash,order_number,status)
        VALUES ('filter-accepted','biz','1999-11-04','order_filter_table',1,1,'USD','filter-accepted','status-table-filter','991104-001','accepted'),
          ('filter-submitted','biz','1999-11-04','order_filter_table',1,1,'USD','filter-submitted','status-table-filter','991104-002','submitted'),
          ('filter-other-table','biz','1999-11-04','table',1,1,'USD','filter-other-table','status-table-filter','991104-003','accepted')`),
    ]);
    await setDisabledPages(["tables", "qrDesigns"]);

    try {
      const optionsResponse = await get("/filters/options");
      assert.equal(optionsResponse.status, 200);
      const options = await optionsResponse.json();
      assert.deepEqual(options.tables.find(({ id }) => id === "order_filter_table"), {
        id: "order_filter_table", branchId: orders[0].branchId, code: "T99", label: "Archived table", groupName: "Main",
      });
      assert.ok(options.branches.some(({ id }) => id === orders[0].branchId));
      assert.ok(options.tables.every(({ id }) => id !== "foreign_table"));
      assert.equal((await get("/filters/options", "editor")).status, 403);

      const date = "?from=1999-11-04&to=1999-11-04";
      const branch = "&branchId=" + orders[0].branchId;
      const result = await get(date + branch + "&status=accepted&tableId=order_filter_table");
      assert.equal(result.status, 200);
      const filtered = await result.json();
      assert.deepEqual(filtered.orders.map(({ id }) => id), ["filter-accepted"]);
      assert.equal(filtered.hasMore, false);
      const statusOnly = await (await get(date + "&status=accepted")).json();
      assert.deepEqual(statusOnly.orders.map(({ id }) => id), ["filter-other-table", "filter-accepted"]);
      const tableOnly = await (await get(date + "&tableId=order_filter_table")).json();
      assert.deepEqual(tableOnly.orders.map(({ id }) => id), ["filter-submitted", "filter-accepted"]);
      assert.equal((await get("?status=rejected")).status, 400);
    } finally {
      await setDisabledPages([]);
      await db.batch([
        db.prepare("DELETE FROM orders WHERE submission_hash='status-table-filter' AND business_id='biz'"),
        db.prepare("DELETE FROM restaurant_tables WHERE id='order_filter_table' AND business_id='biz'"),
      ]);
    }
  });

  await t.test("filters posting dates before pagination and combines with the branch filter", async () => {
    await db.prepare(`WITH RECURSIVE days(day) AS (
      VALUES (1) UNION ALL SELECT day + 1 FROM days WHERE day < 29
    )
    INSERT INTO orders (id,business_id,posting_date,table_id,total_quantity,total_amount,currency,submission_id,submission_hash,order_number)
      SELECT 'date-filter-' || day,'biz',printf('2000-11-%02d',day),'table',1,1,'USD',
        'date-filter-' || day,'date-filter',printf('0011%02d-001',day)
      FROM days`).run();

    try {
      const range = "?from=2000-11-02&to=2000-11-28";
      const first = await get(range + "&branchId=" + orders[0].branchId);
      assert.equal(first.status, 200);
      const firstPage = await first.json();
      assert.equal(firstPage.orders.length, 25);
      assert.equal(firstPage.orders[0].postingDate, "2000-11-28");
      assert.equal(firstPage.orders.at(-1).postingDate, "2000-11-04");
      assert.equal(firstPage.hasMore, true);

      const secondPage = await (await get(range + "&page=2")).json();
      assert.deepEqual(secondPage.orders.map(({ postingDate }) => postingDate), ["2000-11-03", "2000-11-02"]);
      assert.equal(secondPage.hasMore, false);

      const wrongBranch = await (await get(range + "&branchId=unknown-branch")).json();
      assert.deepEqual(wrongBranch.orders, []);
      const earlier = await (await get("?to=2000-11-02")).json();
      assert.deepEqual(earlier.orders.map(({ postingDate }) => postingDate), ["2000-11-02", "2000-11-01"]);
      const newer = await (await get("?from=2000-11-29")).json();
      assert.ok(newer.orders.every(({ postingDate }) => postingDate >= "2000-11-29"));
      assert.equal((await get("?from=2000-11-29&to=2000-11-02")).status, 400);
      assert.equal((await get("?to=2000-02-30")).status, 400);
    } finally {
      await db.prepare("DELETE FROM orders WHERE submission_hash='date-filter' AND business_id='biz'").run();
    }
  });
});

test("POS orders list, detail and status changes use the existing business key", async () => {
  const key = `pos_${"a".repeat(64)}`;
  const otherKey = `pos_${"b".repeat(64)}`;
  await db.batch([
    ...[
      ["biz", key],
      ["other", otherKey],
    ].map(([business, token]) =>
      db
        .prepare(
          "INSERT INTO pos_integrations (business_id,token_hash,key_prefix) VALUES (?,?,?)",
        )
        .bind(
          business,
          createHash("sha256").update(token).digest("hex"),
          token.slice(0, 12),
        ),
    ),
    db.prepare("UPDATE products SET code='COF-001' WHERE id='coffee'"),
    db.prepare("INSERT INTO branches (id,business_id,slug,name) VALUES ('pos_second','biz','pos-second','Second branch')"),
    db.prepare("INSERT INTO table_groups (id,business_id,branch_id,name) VALUES ('pos_second_group','biz','pos_second','Main')"),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
      VALUES ('pos_second_table','biz','pos_second_group','P1','Table P1','scan_pos_second')`),
    db.prepare(`INSERT INTO orders
      (id,business_id,posting_date,table_id,total_quantity,total_amount,currency,submission_id,submission_hash,order_number,status)
      VALUES
        ('foreign-order','other','2001-11-07','foreign_table',1,1,'USD','foreign-order','foreign-order','011107-001','submitted'),
        ('pos-earlier','biz','2001-11-07','table',1,1,'USD','pos-earlier','pos-earlier','011107-001','submitted'),
        ('pos-later','biz','2001-11-07','table',1,1,'USD','pos-later','pos-later','011107-002','submitted'),
        ('pos-accepted','biz','2001-11-07','table',1,1,'USD','pos-accepted','pos-accepted','011107-003','accepted'),
        ('pos-other-branch','biz','2001-11-07','pos_second_table',1,1,'USD','pos-other-branch','pos-other-branch','011107-004','submitted'),
        ('pos-other-day','biz','2001-11-08','table',1,1,'USD','pos-other-day','pos-other-day','011108-001','submitted')`),
  ]);
  const checkout = { ...order(), note: "Bring extra napkins" };
  const submitted = await submit(checkout);
  assert.equal(submitted.status, 201);
  const { orderId, orderNumber, submittedAt } = await submitted.json();
  const api = (suffix = "", token = key, body) =>
    runtime.dispatchFetch(
      `http://localhost/api/integrations/pos/orders${suffix}`,
      {
        method: body === undefined ? "GET" : "PATCH",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
  assert.equal((await api("", null)).status, 401);
  assert.equal((await api("", "manager")).status, 401);
  assert.equal((await api("?status=pending")).status, 400);
  assert.equal((await api("?page_size=101")).status, 400);
  assert.equal((await api("?posting_date=2001-02-29")).status, 400);
  const firstPageResponse = await api("?status=submitted&page_size=1");
  assert.equal(firstPageResponse.status, 200);
  assert.equal(
    firstPageResponse.headers.get("cache-control"),
    "private, no-store",
  );
  const firstPage = await firstPageResponse.json();
  assert.equal(firstPage.page, 1);
  assert.equal(firstPage.page_size, 1);
  assert.equal(firstPage.has_more, true);
  assert.deepEqual(
    firstPage.orders.map((row) => row.id),
    [orderId],
  );
  assert.notEqual(
    (await (await api("?status=submitted&page_size=1&page=2")).json()).orders[0]
      .id,
    orderId,
  );
  assert.deepEqual(
    (await (await api("?status=submitted", otherKey)).json()).orders.map(
      (row) => row.id,
    ),
    ["foreign-order"],
  );
  const byDate = await (await api("?posting_date=2001-11-07")).json();
  assert.equal(byDate.total_record, 4);
  assert.deepEqual(byDate.orders.map(({ id }) => id), [
    "pos-other-branch", "pos-accepted", "pos-later", "pos-earlier",
  ]);
  const filtered = `?posting_date=2001-11-07&status=submitted&branch_id=${firstPage.orders[0].branch_id}&page_size=1`;
  for (const [page, ids, hasMore] of [
    [1, ["pos-later"], true],
    [2, ["pos-earlier"], false],
    [3, [], false],
  ]) {
    const response = await api(`${filtered}&page=${page}`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.total_record, 2);
    assert.equal(result.has_more, hasMore);
    assert.deepEqual(result.orders.map(({ id }) => id), ids);
  }
  assert.equal((await api(`/${orderId}`, otherKey)).status, 404);
  assert.equal(
    (await api(`/${orderId}`, otherKey, { status: "accepted" })).status,
    404,
  );
  assert.equal(
    (await api("/foreign-order", key, { status: "accepted" })).status,
    404,
  );

  await db
    .prepare(
      "UPDATE products SET code='CHANGED',name='Renamed' WHERE id='coffee'",
    )
    .run();
  const detail = await api(`/${orderId}`);
  assert.equal(detail.status, 200);
  const { order: header, products } = await detail.json();
  assert.equal(header.order_number, orderNumber);
  assert.equal(header.submitted_at, submittedAt);
  assert.equal(header.table_id, "table");
  assert.equal(header.table_group_id, "area");
  assert.equal(header.total_amount, 10.5);
  assert.equal(header.note, checkout.note);
  assert.equal(products.length, 2);
  const { results: storedLines } = await db
    .prepare("SELECT id FROM order_products WHERE order_id=? ORDER BY line_number")
    .bind(orderId)
    .all();
  assert.deepEqual(products.map(({ id }) => id), storedLines.map(({ id }) => id));
  assert.equal(products[0].product_id, "coffee");
  assert.equal(products[0].product_code, "COF-001");
  assert.equal(products[0].name, "Coffee");
  assert.equal(products[0].portion_id, "large");
  assert.equal(products[0].note, "Less ice");
  assert.equal(products[0].price, 4.5);
  assert.deepEqual(products[0].modifiers[0], {
    id: "oat",
    group_id: "milk",
    label_km: "Oat milk",
    label_en: "",
    label_zh: "",
    prefix: "",
    price: 0.5,
  });

  assert.equal(
    (await api(`/${orderId}`, key, { status: "submitted" })).status,
    400,
  );
  const invalidTransition = await api(`/${orderId}`, key, {
    status: "completed",
  });
  assert.equal(invalidTransition.status, 409);
  assert.equal((await invalidTransition.json()).status, "submitted");
  for (let attempt = 0; attempt < 2; attempt++) {
    const accepted = await api(`/${orderId}`, key, { status: "accepted" });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), {
      id: orderId,
      status: "accepted",
    });
  }
  assert.ok(
    (await (await api("?status=accepted")).json()).orders.some(
      (row) => row.id === orderId,
    ),
  );
  assert.ok(
    !(await (await api("?status=submitted")).json()).orders.some(
      (row) => row.id === orderId,
    ),
  );
  const updates = await Promise.all([
    api(`/${orderId}`, key, { status: "completed" }),
    api(`/${orderId}`, key, { status: "cancelled" }),
  ]);
  assert.deepEqual(updates.map((res) => res.status).sort(), [200, 409]);
  const terminal = (await updates.find((res) => res.ok).json()).status;
  const tracking = await runtime.dispatchFetch(
    `http://localhost/api/public/businesses/test/orders/${orderId}`,
    {
      headers: { authorization: `Bearer ${checkout.submissionId}` },
    },
  );
  assert.deepEqual(await tracking.json(), { status: terminal });

  // Two lines for the same product can receive different decisions.
  const review = order();
  review.items = [review.items[0], { ...review.items[0], note: "Extra ice" }];
  const reviewReceipt = await submit(review);
  assert.equal(reviewReceipt.status, 201);
  const reviewPath = `/${(await reviewReceipt.json()).orderId}`;
  const { products: reviewLines } = await (await api(reviewPath)).json();
  assert.deepEqual(reviewLines.map(({ status }) => status), ["submitted", "submitted"]);
  const decisions = reviewLines.map(({ id }, i) => ({
    id,
    status: i === 0 ? "accepted" : "rejected",
  }));
  const accept = (products, token = key) =>
    api(reviewPath, token, { status: "accepted", products });
  for (const invalid of [
    decisions.slice(0, 1),
    [decisions[0], decisions[0]],
    [decisions[0], { id: randomUUID(), status: "rejected" }],
    [decisions[0], { ...decisions[1], status: "confirmed" }],
    decisions.map((line) => ({ ...line, status: "rejected" })),
  ]) {
    assert.equal((await accept(invalid)).status, 400);
  }
  assert.equal((await accept(decisions, otherKey)).status, 404);
  const untouched = await (await api(reviewPath)).json();
  assert.equal(untouched.order.status, "submitted");
  assert.deepEqual(untouched.products.map(({ status }) => status), ["submitted", "submitted"]);

  const opposite = [
    { ...decisions[0], status: "rejected" },
    { ...decisions[1], status: "accepted" },
  ];
  const reviews = await Promise.all([accept(decisions), accept(opposite)]);
  assert.deepEqual(reviews.map(({ status }) => status).sort(), [200, 409]);
  const savedDecisions = reviews[0].ok ? decisions : opposite;
  const accepted = await reviews.find(({ ok }) => ok).json();
  assert.equal(accepted.status, "accepted");
  assert.deepEqual(accepted.products, savedDecisions);
  const retry = await accept([...savedDecisions].reverse());
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), accepted);
  const { products: savedLines } = await (await api(reviewPath)).json();
  assert.deepEqual(savedLines.map(({ id, status }) => ({ id, status })), savedDecisions);

  const reviewedReceipt = await runtime.dispatchFetch(
    `http://localhost/api/public/businesses/test/orders${reviewPath}?details=1`,
    { headers: { authorization: `Bearer ${review.submissionId}` } },
  );
  assert.equal(reviewedReceipt.status, 200);
  const reviewedHistory = await reviewedReceipt.json();
  assert.equal(reviewedHistory.status, "accepted");
  assert.deepEqual(
    reviewedHistory.items.map(({ productId, status }) => ({ productId, status })),
    savedDecisions.map(({ status }) => ({ productId: "coffee", status })),
  );
});

test("limits new orders per device across tables and lets the same submission retry", async () => {
  await db.prepare(
    `INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
     VALUES ('rate_table','biz','area','RATE','Rate table','scan_rate')`,
  ).run();
  const original = order();
  const first = await submit(original);
  assert.equal(first.status, 201);
  const receipt = await first.json();
  const deviceId = original.deviceId;
  for (let i = 0; i < 8; i++) {
    const response = await submit({ ...order(), deviceId });
    assert.equal(response.status, 201);
    await response.json();
  }

  const otherTable = { tableId: "rate_table", tableToken: "scan_rate" };
  const boundary = await Promise.all([
    submit({ ...order(), deviceId }),
    submit({ ...order(), ...otherTable, deviceId: deviceId.toUpperCase() }),
  ]);
  assert.deepEqual(boundary.map((response) => response.status).sort(), [201, 429]);
  for (const response of boundary) {
    const result = await response.json();
    if (response.status === 429) {
      assert.equal(result.code, "device_order_limit_reached");
      assert.equal(response.headers.get("retry-after"), String(result.retryAfterSeconds));
      assert.ok(result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 3600);
    }
  }

  const retry = await submit({ ...original, deviceId: undefined });
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), receipt);
  const changed = order();
  changed.items[0].note = "No ice";
  const conflict = await submit({ ...changed, submissionId: original.submissionId, deviceId });
  assert.equal(conflict.status, 409);
  await conflict.json();

  const blocked = await submit({ ...order(), ...otherTable, deviceId });
  assert.equal(blocked.status, 429);
  await blocked.json();
  const otherDevice = await submit({ ...order(), ...otherTable });
  assert.equal(otherDevice.status, 201);
  await otherDevice.json();
  const missingDevice = await submit({ ...order(), deviceId: undefined });
  assert.equal(missingDevice.status, 400);
  assert.equal((await missingDevice.json()).code, "invalid_device");

  await db.prepare("UPDATE orders SET submitted_at=? WHERE id=?")
    .bind(new Date(Date.now() - 3_601_000).toISOString(), receipt.orderId)
    .run();
  const afterExpiry = await submit({ ...order(), deviceId });
  assert.equal(afterExpiry.status, 201);
  await afterExpiry.json();
});

test("the saved business limit applies to new submissions immediately", async () => {
  const changeLimit = (limit) =>
    db.prepare("UPDATE businesses SET hourly_device_order_limit=? WHERE id='biz'")
      .bind(limit)
      .run();
  const original = order();
  const submitNew = () => submit({ ...order(), deviceId: original.deviceId });
  const first = await submit(original);
  assert.equal(first.status, 201);
  const receipt = await first.json();

  await changeLimit(1);
  const blocked = await submitNew();
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, "device_order_limit_reached");
  const retry = await submit(original);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), receipt);

  await changeLimit(2);
  const allowed = await submitNew();
  assert.equal(allowed.status, 201);
  await allowed.json();

  await changeLimit(0);
  for (let i = 0; i < 8; i++) {
    const response = await submitNew();
    assert.equal(response.status, 201);
    await response.json();
  }
  const unlimited = { ...order(), deviceId: original.deviceId };
  const accepted = await submit(unlimited);
  assert.equal(accepted.status, 201);
  const unlimitedReceipt = await accepted.json();
  const unlimitedRetry = await submit(unlimited);
  assert.equal(unlimitedRetry.status, 200);
  assert.deepEqual(await unlimitedRetry.json(), unlimitedReceipt);

  await changeLimit(10);
  const limitedAgain = await submitNew();
  assert.equal(limitedAgain.status, 429);
  assert.equal((await limitedAgain.json()).code, "device_order_limit_reached");
});

test("QR scope selects a shared menu and enforces table branch, product visibility and branch location", async () => {
  const token = "branch-reporter";
  await db.batch([
    db.prepare("INSERT INTO users (id,email,display_name,password_hash,password_salt) VALUES ('branch-reporter','branch@example.test','Branch','','')"),
    db.prepare("INSERT INTO memberships (user_id,business_id,role) VALUES ('branch-reporter','biz','manager')"),
    db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES ('branch-reporter','branch-reporter',?,datetime('now','+1 day'))")
      .bind(createHash("sha256").update(token).digest("hex")),
    db.prepare(`INSERT INTO branches (id,business_id,slug,name,latitude,longitude,order_radius_meters,use_business_order_radius,has_order_location_override)
      VALUES ('river','biz','riverside','Riverside',5,6,50,0,1)`),
    db.prepare(`INSERT INTO table_groups (id,business_id,branch_id,name) VALUES ('river_area','biz','river','Main')`),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
      VALUES ('river_table','biz','river_area','T1','River Table','scan_river')`),
    db.prepare(`INSERT INTO menus (id,business_id,parent_id,slug,name_km,name_en,name_zh)
      VALUES ('terrace','biz',NULL,'terrace','រានហាល','Terrace','露台'),
        ('dinner','biz','terrace','dinner','អាហារពេលល្ងាច','Dinner','晚餐'),
        ('specials','biz','dinner','specials','ពិសេស','Specials','特餐'),
        ('indoors','biz',NULL,'indoors','ខាងក្នុង','Indoors','室内'),
        ('drinks','biz','indoors','drinks','ភេសជ្ជៈ','Drinks','饮品')`),
    db.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id) VALUES
      ('biz','specials','hidden_product'),('biz','dinner','hidden_product'),('biz','drinks','water'),
      ('biz','terrace','water'),('biz','terrace','hidden_product')`),
  ]);
  const url = "http://localhost/api/public/businesses/test/menu";
  const legacy = await (await runtime.dispatchFetch(url)).json();
  assert.deepEqual(legacy.products.map(({ id }) => id).sort(),["coffee","water"]);
  assert.equal(legacy.menu,null);
  const terrace = await (await runtime.dispatchFetch(`${url}?branch=riverside&menu=terrace`)).json();
  assert.equal(terrace.branch.slug,"riverside");
  assert.deepEqual(terrace.business.orderLocation,{ latitude: 5,longitude: 6 });
  assert.equal(terrace.business.orderRadiusMeters, 50);
  assert.deepEqual(terrace.products.map(({ id }) => id),["hidden_product"]);
  assert.equal(terrace.products[0].categoryId,"hidden_child");
  assert.deepEqual(terrace.products[0].menuIds.sort(),["dinner","specials"]);
  assert.deepEqual(terrace.menu,{ id: "terrace",slug: "terrace" });
  assert.deepEqual(
    terrace.categories.map(({ id, parentId }) => [id, parentId]),
    [["dinner",null],["specials","dinner"]],
  );
  assert.equal(terrace.categories.find(({ id }) => id === "specials").nameZh,"特餐");
  const indoors = await (await runtime.dispatchFetch(`${url}?branch=riverside&menu=indoors`)).json();
  assert.deepEqual(indoors.products.map(({ id }) => id),["water"]);
  assert.equal((await (await runtime.dispatchFetch(`${url}?menu=terrace`)).json()).branch.slug,"main");
  assert.equal((await runtime.dispatchFetch(`${url}?menu=missing`)).status,404);

  const checkout = { ...order(),branch: "riverside",menu: "terrace",tableToken: "scan_river",
    tableId: "river_table",latitude: 5,longitude: 6,
    items: [{ productId: "hidden_product",quantity: 1,expectedPrice: 1 }] };
  assert.equal((await submit({ ...checkout,branch: "main" })).status,404);
  assert.equal((await submit({ ...checkout,latitude: 0,longitude: 0 })).status,403);
  assert.equal((await submit({ ...checkout,menu: "indoors" })).status,409);
  const rootOnly = await submit({
    ...checkout,
    items: [{ productId: "water",quantity: 1,expectedPrice: 1.5 }],
  });
  assert.equal(rootOnly.status,409);
  const created = await submit(checkout);
  assert.equal(created.status,201);
  const { orderId } = await created.json();
  const saved = await db.prepare("SELECT branch_id,menu_id FROM orders WHERE id=?").bind(orderId).first();
  assert.deepEqual(saved,{ branch_id: "river",menu_id: "terrace" });
  assert.equal((await submit(checkout)).status,200);
  const requestAdmin = (path) => runtime.dispatchFetch(`http://localhost/api/admin/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const orderList = await requestAdmin("orders?branchId=river");
  assert.equal(orderList.status,200);
  assert.deepEqual((await orderList.json()).orders.map(({ id, branchName }) => [id,branchName]),[[orderId,"Riverside"]]);
  const eventId = randomUUID();
  const event = await runtime.dispatchFetch("http://localhost/api/public/businesses/test/analytics/events",{
    method: "POST",headers: { "content-type": "application/json" },body: JSON.stringify({
      branch: "riverside",tableToken: "scan_river",sessionId: randomUUID(),events: [{ id: eventId,type: "menu_open",language: "km" }],
    }),
  });
  assert.equal(event.status,202);
  assert.equal(await db.prepare("SELECT branch_id FROM analytics_events WHERE id=?").bind(eventId).first("branch_id"),"river");
  const report = await requestAdmin("reports/menu-analytics?branchId=river");
  assert.equal(report.status,200);
  assert.equal((await report.json()).summary.menuOpens,1);

  await db.batch([
    db.prepare("UPDATE products SET portions_json=?,price_cents=2 WHERE id='water'")
      .bind(JSON.stringify([{ id: "river-glass", labelKm: "Glass", priceCents: 2, branchId: "river" }])),
    db.prepare("UPDATE businesses SET menu_cache_version=menu_cache_version+1 WHERE id='biz'"),
  ]);
  const riverLine = { productId: "water", portionId: "river-glass", quantity: 1, expectedPrice: 2 };
  for (const line of [riverLine, { ...riverLine, portionId: null }]) {
    const wrongBranch = await submit({ ...order(), items: [line] });
    assert.equal(wrongBranch.status, 409);
    assert.equal((await wrongBranch.json()).code, "selection_changed");
  }
  const riverOrder = await submit({ ...checkout, submissionId: randomUUID(), menu: "indoors", items: [riverLine] });
  assert.equal(riverOrder.status, 201);
  assert.equal((await riverOrder.json()).totalAmount, 2);

  const branchMenu = async (query = "?branch=riverside&menu=terrace") =>
    (await (await runtime.dispatchFetch(url + query)).json()).business;
  const changePolicy = (statement) => db.batch([
    db.prepare(statement),
    db.prepare("UPDATE businesses SET menu_cache_version=menu_cache_version+1 WHERE id='biz'"),
  ]);
  const submitAt = (changes) => submit({ ...checkout, submissionId: randomUUID(), ...changes });
  const outsideBranchRadius = await submitAt({ latitude: 5.00055 });
  assert.equal(outsideBranchRadius.status, 403);
  assert.equal((await outsideBranchRadius.json()).orderRadiusMeters, 50);

  await changePolicy("UPDATE branches SET enable_submit_order=0 WHERE id='river'");
  assert.equal((await branchMenu()).enableSubmitOrder, false);
  assert.equal((await branchMenu()).orderLocation, null);
  assert.equal((await (await submitAt({})).json()).code, "ordering_disabled");

  await changePolicy("UPDATE branches SET enable_submit_order=1,use_business_order_radius=1 WHERE id='river'");
  await changePolicy("UPDATE businesses SET enable_submit_order=0 WHERE id='biz'");
  assert.equal((await branchMenu("")).enableSubmitOrder, false);
  assert.equal((await branchMenu()).enableSubmitOrder, true);
  assert.equal((await branchMenu()).orderRadiusMeters, 100);
  assert.equal((await submitAt({ latitude: 5.00055 })).status, 201);

  await changePolicy("UPDATE branches SET enable_submit_order=NULL,has_order_location_override=0 WHERE id='river'");
  await changePolicy("UPDATE businesses SET enable_submit_order=1 WHERE id='biz'");
  assert.deepEqual((await branchMenu()).orderLocation, { latitude: 0, longitude: 0 });
  assert.equal((await submitAt({ latitude: 0, longitude: 0 })).status, 201);

  await changePolicy("UPDATE branches SET enable_submit_order=0 WHERE business_id='biz' AND is_default=1");
  assert.equal((await branchMenu("")).enableSubmitOrder, false);
  assert.equal((await branchMenu("?branch=main")).enableSubmitOrder, false);
  for (const branch of [undefined, "main"]) {
    assert.equal((await (await submit({ ...order(), branch })).json()).code, "ordering_disabled");
  }
  await changePolicy("UPDATE branches SET enable_submit_order=NULL WHERE business_id='biz' AND is_default=1");

  await db.prepare("UPDATE branches SET is_active=0 WHERE id='river'").run();
  assert.equal((await runtime.dispatchFetch(`${url}?branch=riverside&menu=terrace`)).status,404);
  assert.equal((await submit(checkout)).status,200);
});
