import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, createHmac, generateKeyPairSync, pbkdf2Sync, randomBytes, randomUUID, sign } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../apps/control/package.json", import.meta.url),
);
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const directory = resolve(root, ".wrangler/pos-api-tests");
process.env.WRANGLER_SEND_METRICS = "false";
process.env.WRANGLER_LOG_PATH = resolve(directory, "wrangler.log");
const { unstable_splitSqlQuery: splitSql } = require("wrangler");
const prefix = "/api/integrations/pos/v1";
const setup = "/api/admin/pos";
const pepper = "isolated-pos-api-pepper-long-enough";
const version = "client-pbkdf2-sha256-v1";
const exec = promisify(execFile);
let runtime;
let db;
let admin;
let discovery;
let cash;
let qr;
let main;

const prepare = (query, ...params) => db.prepare(query).bind(...params);
const proofFor = (email) =>
  pbkdf2Sync(
    "fixture-password",
    `angkor-emenu:${version}:${email}`,
    120_000,
    32,
    "sha256",
  ).toString("hex");
const emailFor = (user) => `${user}@example.test`;

async function account(user, business, role) {
  const email = emailFor(user);
  const salt = randomUUID().replaceAll("-", "");
  const hash = createHmac("sha256", pepper)
    .update(`${version}:${salt}:${proofFor(email)}`)
    .digest("hex");
  await db.batch([
    prepare(
      "INSERT INTO users (id,email,display_name,password_hash,password_salt) VALUES (?,?,?,?,?)",
      user,
      email,
      user,
      hash,
      `${version}$${salt}`,
    ),
    prepare(
      "INSERT INTO memberships (user_id,business_id,role) VALUES (?,?,?)",
      user,
      business,
      role,
    ),
  ]);
}

async function request(path, token, method = "GET", body, key, headers = {}) {
  return runtime.dispatchFetch("http://localhost" + path, {
    method,
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(key ? { "idempotency-key": key } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function status(response, expected) {
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}

async function login(user, slug = "cafe") {
  const email = emailFor(user);
  const result = await status(
    await request(prefix + "/auth/login", null, "POST", {
      business_slug: slug,
      email,
      password_proof: proofFor(email),
      auth_version: version,
    }),
    200,
  );
  return result.token;
}

const read = async (token, path, expected = 200) =>
  status(await request(prefix + path, token), expected);
const write = async (
  token,
  path,
  body,
  expected = 201,
  key = randomUUID(),
  method = "POST",
) => status(await request(prefix + path, token, method, body, key), expected);
const adminWrite = async (path, method, body, expected = 201, token = admin) =>
  status(await request(setup + path, token, method, body), expected);
const profileConfig = (overrides) => ({
  table_mode: "optional",
  payment_types: [
    { id: cash, currencies: ["USD", "KHR"] },
    { id: qr, currencies: ["USD"] },
  ],
  default_payment_type_id: cash,
  ...overrides,
});
async function newProfile(name, config, branch = main) {
  return adminWrite("/profiles", "POST", {
    name,
    branch_id: branch,
    config: profileConfig(config),
  });
}
const start = async (profile, token = discovery) =>
  (
    await status(
      await request(prefix + "/sessions", token, "POST", {
        profile_id: profile.id,
      }),
      201,
    )
  ).token;
const coffee = (quantity = 1, overrides = {}) => ({
  product_id: "coffee",
  quantity,
  ...overrides,
});
const cashPayment = (amount, currency = "USD", overrides = {}) => ({
  payment_type_id: cash,
  currency,
  amount_minor: amount,
  ...overrides,
});
const closeShift = (token, shift, preview, expected = 200) =>
  write(
    token,
    `/cashier-shifts/${shift.id}/close`,
    {
      activity_revision: preview.activity_revision,
      counts: preview.counts.map((row) => ({
        payment_type_id: row.payment_type_id,
        currency: row.currency,
        declared_minor: Math.max(0, row.expected_minor),
      })),
    },
    expected,
  );
const reconciliation = (token, shift) =>
  read(token, `/cashier-shifts/${shift.id}/reconciliation`);

before(async () => {
  await mkdir(directory, { recursive: true });
  const bundle = resolve(directory, "worker.mjs");
  await build({
    entryPoints: [resolve(root, "apps/control/worker/index.ts")],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
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
          d1Databases: { DB: "isolated-pos-api-tests" },
          kvNamespaces: ["CATALOG_CACHE"],
          bindings: {
            ALLOWED_ORIGINS: "https://admin.test",
            POS_ALLOWED_ORIGINS: "https://pos.test",
            AUTH_PEPPER: pepper,
          },
        },
      ],
    }),
  );
  db = await runtime.getD1Database("DB", "control");
  const migrations = resolve(root, "apps/control/migrations");
  let legacyToken;
  for (const name of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    if (name.startsWith("0063_")) {
      await db.batch([
        prepare(
          "INSERT INTO businesses(id,name,slug,timezone,currency,secondary_exchange_rate) VALUES ('cafe','Cafe','cafe','Asia/Phnom_Penh','USD',4000)",
        ),
        prepare(
          "INSERT INTO businesses(id,name,slug) VALUES ('other','Other','other')",
        ),
        prepare(
          "INSERT INTO branches(id,business_id,slug,name) VALUES ('other-branch','cafe','other-branch','Other branch')",
        ),
      ]);
    }
    if (name.startsWith("0064_")) {
      await account("owner", "cafe", "owner");
      legacyToken = "possession_" + randomBytes(32).toString("hex");
      await prepare(
        `INSERT INTO pos_sessions(token_hash,business_id,user_id,credential_version,expires_at)
          SELECT ?,'cafe',id,password_salt,unixepoch()+900 FROM users WHERE id='owner'`,
        createHash("sha256").update(legacyToken).digest("hex"),
      ).run();
    }
    if (name.startsWith("0066_")) await account("cashier", "cafe", "editor");
    const statements = splitSql(
      await readFile(resolve(migrations, name), "utf8"),
    );
    await db.batch(statements.map((query) => db.prepare(query)));
  }
  main = await prepare(
    "SELECT id FROM branches WHERE business_id='cafe' AND is_default=1",
  ).first("id");
  assert.ok(main, "an existing branch survives the additive POS migration");
  assert.ok(legacyToken, "the device migration fixture has a pre-existing session");
  assert.deepEqual((await read(legacyToken, "/profiles")).profiles, []);
  await account("username-manager", "cafe", "manager");
  await account("stranger", "other", "owner");
  await db.batch([
    prepare(
      "INSERT INTO table_groups(id,business_id,branch_id,name) VALUES ('patio','cafe',?,'Patio'),('other-patio','cafe','other-branch','Other patio')",
      main,
    ),
    prepare(
      `INSERT INTO restaurant_tables(id,business_id,branch_id,group_id,code,label,public_token)
      VALUES ('table-a','cafe',?,'patio','A','Table A','public-a'),
        ('table-b','cafe','other-branch','other-patio','B','Table B','public-b')`,
      main,
    ),
    prepare(`INSERT INTO categories(id,business_id,parent_id,name,slug) VALUES
      ('drinks','cafe',NULL,'Drinks','drinks'),('coffee-category','cafe','drinks','Coffee','coffee'),
      ('food','cafe',NULL,'Food','food'),('other-cat','other',NULL,'Other','other')`),
    prepare(
      `INSERT INTO products(id,business_id,category_id,name,slug,price_cents,modifier_groups_json)
      VALUES ('coffee','cafe','coffee-category','Coffee','coffee',2.51,?),
        ('food-product','cafe','food','Food','food',1,'[]'),
        ('other-product','other','other-cat','Other','other',1,'[]')`,
      JSON.stringify([
        {
          id: "discount",
          required: false,
          multiple: false,
          options: [{ id: "less", priceCents: -0.05 }],
        },
      ]),
    ),
    prepare(`INSERT INTO menus(id,business_id,parent_id,slug,name_en) VALUES
      ('main-menu','cafe',NULL,'main-menu','Menu'),('coffee-menu','cafe','main-menu','coffee-menu','Coffee'),
      ('food-menu','cafe',NULL,'food-menu','Food')`),
    prepare(`INSERT INTO menu_products (business_id,menu_id,product_id) VALUES
      ('cafe','coffee-menu','coffee'),('cafe','food-menu','food-product')`),
    prepare(
      `INSERT INTO products(id,business_id,category_id,name,slug,price_cents,portions_json)
      VALUES ('branch-only','cafe','coffee-category','Branch only','branch-only',3,?)`,
      JSON.stringify([
        {
          id: "branch-portion",
          label: "Single",
          priceCents: 3,
          branchId: "other-branch",
        },
      ]),
    ),
  ]);
  const email = emailFor("owner");
  admin = (
    await status(
      await request("/api/auth/login", null, "POST", {
        email,
        passwordProof: proofFor(email),
        authVersion: version,
      }),
      200,
    )
  ).token;
  discovery = await login("owner");
  cash = (
    await adminWrite("/payment-types", "POST", { name: "Cash", kind: "cash" })
  ).id;
  qr = (await adminWrite("/payment-types", "POST", { name: "QR", kind: "qr" }))
    .id;
});
after(async () => {
  if (runtime) await runtime.dispose();
});

test("POS subscription limits apply across branches and use the paid sale date", async () => {
  const standard = await prepare(
    "SELECT pos_enabled,max_pos_profiles,max_daily_pos_sales FROM subscription_plans WHERE id='plan_standard'",
  ).first();
  assert.deepEqual(standard, { pos_enabled: 1, max_pos_profiles: null, max_daily_pos_sales: null });
  await db.batch([
    prepare(`INSERT INTO subscription_plans(id,code,name,pos_enabled,max_pos_profiles,max_daily_pos_sales)
      VALUES ('pos-test','pos-test','POS test',1,1,1)`),
    prepare("INSERT INTO business_subscriptions(id,business_id,plan_id) VALUES ('pos-test','cafe','pos-test')"),
  ]);

  try {
    const profile = await newProfile("Plan test");
    const profileInput = {
      name: "Plan test on second branch",
      branch_id: "other-branch",
      config: profileConfig(),
    };
    const limited = await adminWrite("/profiles", "POST", profileInput, 409);
    assert.equal(limited.code, "PLAN_POS_PROFILE_LIMIT");
    const inactive = await adminWrite("/profiles", "POST", { ...profileInput, is_active: false });
    const activate = () => adminWrite(`/profiles/${inactive.id}`, "PATCH", { is_active: true }, 409);
    assert.equal((await activate()).code, "PLAN_POS_PROFILE_LIMIT");
    await assert.rejects(
      prepare("UPDATE subscription_plans SET max_pos_profiles=0 WHERE id='pos-test'").run(),
      /PLAN_POS_PROFILE_IN_USE/,
    );

    const token = await start(profile);
    const first = await write(token, "/sales", { lines: [coffee()] });
    const next = await write(token, "/sales", { lines: [coffee()] });
    const checkout = (sale, expected, key) => write(
      token, `/sales/${sale.id}/checkout`, {
        revision: sale.revision,
        expected_total_minor: sale.total_minor,
        payments: [cashPayment(sale.total_minor)],
      }, expected, key,
    );
    const checkoutKey = randomUUID();
    const paid = await checkout(first, 200, checkoutKey);
    assert.deepEqual(await checkout(first, 200, checkoutKey), paid);
    assert.deepEqual(
      (await status(await request("/api/admin/workspace-access", admin), 200)).accessibleControlPages,
      ["sellingOverview", "posProfiles", "posPaymentTypes", "salesList"],
    );
    const choices = await adminWrite("/profile-options", "GET", undefined, 200);
    assert.ok(choices.branches.some((branch) => branch.id === main));
    assert.ok(choices.table_groups.some((group) => group.id === "patio" && group.branch_id === main));
    assert.ok(choices.categories.some((category) => category.id === "coffee-category" && category.parent_id === "drinks"));
    assert.ok(choices.menus.some((menu) => menu.id === "coffee-menu" && menu.parent_id === "main-menu"));
    assert.ok(choices.payment_types.some((payment) => payment.id === cash));
    const overview = await adminWrite("/overview", "GET", undefined, 200);
    assert.equal(overview.business_date, paid.business_date);
    assert.deepEqual(overview.currencies, [{
      currency: "USD", completed_count: 1, open_count: 1, net_minor: paid.total_minor,
    }]);
    const sales = await adminWrite(`/sales?status=paid&business_date=${paid.business_date}`, "GET", undefined, 200);
    assert.deepEqual(sales.sales.map(({ id, profile_name }) => [id, profile_name]), [[paid.id, profile.name]]);
    await adminWrite("/sales?business_date=2026-02-30", "GET", undefined, 400);
    assert.equal((await checkout(next, 409)).code, "PLAN_DAILY_POS_SALE_LIMIT");
    assert.equal((await read(token, `/sales/${next.id}`)).status, "open");
    const reversed = await write(token, `/sales/${first.id}/reverse`, { reason: "Return" });
    assert.equal(reversed.reverses_sale_id, first.id);
    assert.equal((await adminWrite("/overview", "GET", undefined, 200)).currencies[0].net_minor, 0);
    assert.equal((await checkout(next, 409)).code, "PLAN_DAILY_POS_SALE_LIMIT");

    await prepare("UPDATE sales SET business_date=date(business_date,'-1 day') WHERE id=?", first.id).run();
    assert.equal((await checkout(next, 200)).business_date, paid.business_date);
    await adminWrite(`/profiles/${profile.id}`, "PATCH", { is_active: false }, 200);
    await adminWrite(`/profiles/${inactive.id}`, "PATCH", { is_active: true }, 200);
    const otherBranchToken = await start(inactive);
    assert.equal((await read(otherBranchToken, "/context")).profile.branch_id, "other-branch");

    await prepare("UPDATE subscription_plans SET pos_enabled=0 WHERE id='pos-test'").run();
    assert.equal((await read(otherBranchToken, "/context", 403)).code, "PLAN_POS_DISABLED");
    assert.equal((await adminWrite("/profiles", "GET", undefined, 403)).code, "PLAN_POS_DISABLED");
    assert.deepEqual((await status(await request("/api/admin/workspace-access", admin), 200)).accessibleControlPages, []);
    assert.equal((await adminWrite("/sales", "GET", undefined, 403)).code, "PLAN_POS_DISABLED");
    const loginResult = await status(await request(prefix + "/auth/login", null, "POST", {
      business_slug: "cafe", email: emailFor("owner"), password_proof: proofFor(emailFor("owner")),
      auth_version: version,
    }), 403);
    assert.equal(loginResult.code, "PLAN_POS_DISABLED");
    assert.ok(await login("stranger", "other"));
  } finally {
    await db.batch([
      prepare("DELETE FROM pos_profiles WHERE business_id='cafe'"),
      prepare("DELETE FROM business_subscriptions WHERE id='pos-test'"),
      prepare("DELETE FROM subscription_plans WHERE id='pos-test'"),
    ]);
  }
});

test("staff usernames use the existing password proof and respect business and profile access", async () => {
  await account("username-ungranted", "cafe", "editor");
  const profile = await newProfile("Staff usernames", {});
  const otherProfile = await newProfile("No cashier grant", {}, "other-branch");
  const owner = await start(profile);
  const other = await start(otherProfile);
  const manager = await start(profile, await login("username-manager"));
  const resolveUsername = (token, username) => request(prefix + "/auth/resolve-username", token, "POST", { username });
  const assign = (token, id, username, expected = 200, key = randomUUID()) =>
    write(token, `/staff/${id}/username`, { username }, expected, key, "PUT");
  const usernameLogin = (username, slug = "cafe", proof = proofFor(emailFor("cashier"))) =>
    request(prefix + "/auth/login", null, "POST", {
      business_slug: slug, email: emailFor("cashier"), username,
      password_proof: proof, auth_version: version,
    }, undefined, { "cf-connecting-ip": "198.51.100.10" });

  await status(await resolveUsername(null, "front.till"), 401);
  await status(await resolveUsername(discovery, "front.till"), 403);
  assert.equal((await read(owner, "/staff?page_size=1")).staff[0].user_id, "username-manager");
  await assign(owner, "cashier", "front.till", 404);
  await assign(owner, "stranger", "front.till", 404);
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);

  const command = randomUUID();
  assert.deepEqual(await assign(manager, "cashier", "Front.Till", 200, command), {
    user_id: "cashier", username: "front.till",
  });
  await assign(manager, "cashier", "Front.Till", 200, command);
  assert.equal((await assign(manager, "cashier", "changed", 409, command)).code, "IDEMPOTENCY_CONFLICT");
  assert.equal((await assign(owner, "username-manager", "front.till", 409)).code, "POS_USERNAME_TAKEN");
  await assign(owner, "username-manager", "@invalid", 400);
  const { staff } = await read(owner, "/staff?page_size=1");
  assert.deepEqual(staff, [{ user_id: "cashier", name: "cashier", role: "editor", username: "front.till" }]);
  assert.deepEqual((await read(owner, "/staff")).staff.map(row => row.user_id), ["cashier", "username-manager"]);

  const resolved = await resolveUsername(owner, " FRONT.TILL ");
  assert.equal(resolved.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await status(resolved, 200), { email: emailFor("cashier") });
  await status(await resolveUsername(other, "front.till"), 404);
  await status(await usernameLogin("front.till", "other"), 401);
  await status(await usernameLogin("front.till", "cafe", "0".repeat(64)), 401);
  const loginResult = await status(await usernameLogin("Front.Till"), 200);
  assert.equal(loginResult.user_id, "cashier");
  const cashier = await start(profile, loginResult.token);
  await status(await resolveUsername(cashier, "front.till"), 403);
  await read(cashier, "/staff", 403);
  await assign(cashier, "cashier", "self-set", 403);

  const competing = await Promise.all(["cashier", "username-manager"].map((id) =>
    request(prefix + `/staff/${id}/username`, owner, "PUT", { username: "same-till" }, randomUUID()),
  ));
  assert.deepEqual(competing.map((response) => response.status).sort(), [200, 409]);
  await status(competing.find((response) => response.status === 409), 409);
  await assign(owner, "cashier", null);
  await status(await resolveUsername(owner, "front.till"), 404);
  await status(await usernameLogin("front.till"), 401);
  assert.equal((await read(cashier, "/context")).operator.id, "cashier");
  await assign(owner, "cashier", "front.till");
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: [] }, 200);
  await status(await resolveUsername(owner, "front.till"), 404);
  await read(cashier, "/context", 403);
});

test("profile selection, CORS, branch and tenant boundaries, and live access revocation", async () => {
  const profile = await newProfile("Patio", { selected_ids: ["drinks"] });
  const another = await newProfile("Other branch", {}, "other-branch");
  assert.equal(
    (await read(discovery, "/context", 403)).code,
    "PROFILE_REQUIRED",
  );
  await read(admin, "/profiles", 401);
  const token = await start(profile);
  await status(await request(setup + "/profiles", token), 401);
  assert.equal((await read(token, "/tables")).tables[0].id, "table-a");
  assert.deepEqual(
    (await read(token, "/catalog")).products.map((row) => row.id),
    ["coffee"],
  );
  await write(token, "/sales", { table_id: "table-b", lines: [coffee()] }, 404);
  await write(
    token,
    "/sales",
    { lines: [{ product_id: "other-product", quantity: 1 }] },
    409,
  );
  const otherBranch = await start(another);
  assert.deepEqual(
    (await read(otherBranch, "/tables")).tables.map((row) => row.id),
    ["table-b"],
  );
  assert.ok(
    (await read(otherBranch, "/catalog")).products.some(
      (row) => row.id === "branch-only",
    ),
  );
  await write(
    token,
    "/sales",
    {
      lines: [
        {
          product_id: "branch-only",
          quantity: 1,
          portion_id: "branch-portion",
        },
      ],
    },
    409,
  );

  const cashier = await login("cashier");
  assert.deepEqual((await read(cashier, "/profiles")).profiles, []);
  await status(
    await request(prefix + "/sessions", cashier, "POST", {
      profile_id: profile.id,
    }),
    404,
  );
  await adminWrite(
    `/profiles/${profile.id}/grants`,
    "PUT",
    { user_ids: ["stranger"] },
    400,
  );
  await adminWrite(
    `/profiles/${profile.id}/grants`,
    "PUT",
    { user_ids: ["cashier"] },
    200,
  );
  assert.deepEqual(
    (await read(cashier, "/profiles")).profiles.map((row) => row.id),
    [profile.id],
  );
  const cashierToken = await start(profile, cashier);
  await write(cashierToken, "/working-days", {}, 403);
  await adminWrite(
    `/profiles/${profile.id}/grants`,
    "PUT",
    { user_ids: [] },
    200,
  );
  assert.equal(
    (await read(cashierToken, "/context", 403)).code,
    "PROFILE_ACCESS_REVOKED",
  );
  const foreign = await login("stranger", "other");
  await status(
    await request(prefix + "/sessions", foreign, "POST", {
      profile_id: profile.id,
    }),
    404,
  );
  const preflight = await request(
    prefix + "/sales",
    null,
    "OPTIONS",
    undefined,
    undefined,
    { origin: "https://pos.test" },
  );
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://pos.test",
  );
  assert.match(
    preflight.headers.get("access-control-allow-headers"),
    /idempotency-key/,
  );
  const adminPreflight = await request(
    setup + "/profiles",
    null,
    "OPTIONS",
    undefined,
    undefined,
    { origin: "https://pos.test" },
  );
  assert.equal(adminPreflight.headers.get("access-control-allow-origin"), null);
  await status(
    await request(prefix + "/sessions/current", token, "DELETE"),
    200,
  );
  await read(token, "/context", 401);
});

test("two profiles share an overnight day, carry bills between shifts and reconcile split tenders and reversals", async () => {
  const config = {
    working_day_enabled: true,
    cashier_shift_enabled: true,
    tax_mode: "exclusive",
    tax_rate_bps: 1000,
  };
  const a = await newProfile("Register A", config);
  const b = await newProfile("Register B", config);
  const token = await start(a);
  const second = await start(b);
  const customer = await adminWrite("/customers", "POST", {
    name: "Customer A",
    external_reference: "crm-001",
  });
  assert.ok(
    (await read(token, "/customers")).customers.some(
      (row) => row.id === customer.id,
    ),
  );
  const day = await write(token, "/working-days", {});
  assert.equal(day.business_date, (await read(token, "/context")).local_date);
  assert.equal((await read(second, "/context")).working_day.id, day.id);
  await write(second, "/working-days", {}, 409);
  // Make the open day span midnight without changing the runtime clock or token expiry.
  const prior = new Date(
    Date.parse(day.business_date + "T00:00:00Z") - 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  await prepare(
    "UPDATE working_days SET business_date=?,opened_at=? WHERE id=?",
    prior,
    prior + "T16:59:00.000Z",
    day.id,
  ).run();

  const initial = await write(token, "/cashier-shifts", {});
  const otherShift = await write(second, "/cashier-shifts", {});
  const sale = await write(token, "/sales", {
    table_id: "table-a",
    customer_id: customer.id,
    lines: [coffee(2)],
  });
  const parallelBill = await write(second, "/sales", {
    table_id: "table-a",
    lines: [coffee()],
  });
  assert.equal(sale.total_minor, 552);
  assert.equal(sale.tax_minor, 50);
  assert.equal(sale.receipt.copies, 1);
  assert.equal(sale.lines[0].product_id, "coffee");
  assert.equal(sale.business_date, prior);
  assert.equal(sale.customer_name, "Customer A");
  await read(second, `/sales/${sale.id}`, 404);
  assert.equal((await read(token, "/tables")).tables[0].open_sale_id, sale.id);
  assert.equal(
    (
      await write(
        token,
        "/sales",
        { table_id: "table-a", lines: [coffee()] },
        409,
      )
    ).code,
    "TABLE_OCCUPIED",
  );

  const queued = await adminWrite(
    `/profiles/${a.id}`,
    "PATCH",
    { config: profileConfig({ ...config, print_copies: 2 }) },
    200,
  );
  assert.equal(queued.config.print_copies, 1);
  assert.equal(queued.pending_config.print_copies, 2);
  await closeShift(token, initial, await reconciliation(token, initial));
  await write(
    token,
    `/sales/${sale.id}/checkout`,
    { revision: 1, expected_total_minor: 552, payments: [] },
    409,
  );
  await write(
    second,
    `/sales/${parallelBill.id}/cancel`,
    { revision: 1, reason: "Guest cancelled" },
    200,
  );
  await closeShift(
    second,
    otherShift,
    await reconciliation(second, otherShift),
  );
  assert.equal(
    (await write(token, `/working-days/${day.id}/close`, {}, 409)).code,
    "WORKING_DAY_HAS_ACTIVITY",
  );

  const shift = await write(token, "/cashier-shifts", {
    opening_cash: [cashPayment(1000), cashPayment(10_000, "KHR")],
  });
  const stale = await reconciliation(token, shift);
  await write(token, `/cashier-shifts/${shift.id}/cash-floats`, {
    ...cashPayment(250),
    kind: "cash_in",
    reason: "Drawer top-up",
  });
  await write(token, `/cashier-shifts/${shift.id}/cash-floats`, {
    ...cashPayment(125),
    kind: "cash_out",
    reason: "Safe drop",
  });
  assert.equal(
    (await closeShift(token, shift, stale, 409)).code,
    "RECONCILIATION_CHANGED",
  );
  const tender = [
    cashPayment(200),
    cashPayment(75, "USD", { entry_type: "change" }),
    {
      payment_type_id: qr,
      currency: "USD",
      amount_minor: 100,
      reference: "QR-REFERENCE",
    },
    cashPayment(13_080, "KHR"),
  ];
  const checkout = { revision: 1, expected_total_minor: 552, payments: tender };
  await write(
    token,
    `/sales/${sale.id}/checkout`,
    {
      ...checkout,
      payments: [
        cashPayment(552),
        cashPayment(1, "KHR", { entry_type: "change" }),
      ],
    },
    400,
  );
  const key = randomUUID();
  const paid = await write(
    token,
    `/sales/${sale.id}/checkout`,
    checkout,
    200,
    key,
  );
  assert.equal(paid.business_date, prior);
  assert.equal(paid.shift_id, shift.id);
  assert.equal(paid.payments[1].amount_minor, -75);
  assert.deepEqual(
    await write(token, `/sales/${sale.id}/checkout`, checkout, 200, key),
    paid,
  );
  assert.equal(
    (
      await write(
        token,
        `/sales/${sale.id}/checkout`,
        { ...checkout, expected_total_minor: 551 },
        409,
        key,
      )
    ).code,
    "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(
    (await read(token, "/sales?business_date=" + prior)).sales[0].id,
    sale.id,
  );
  assert.equal(
    (await read(token, `/cashier-shifts/${shift.id}/cash-floats`)).cash_floats
      .length,
    4,
  );
  const preview = await reconciliation(token, shift);
  assert.deepEqual(
    Object.fromEntries(
      preview.counts.map((row) => [
        row.payment_type_id + row.currency,
        row.expected_minor,
      ]),
    ),
    { [cash + "USD"]: 1250, [cash + "KHR"]: 23080, [qr + "USD"]: 100 },
  );

  const reversal = await write(token, `/sales/${sale.id}/reverse`, {
    reason: "Full refund processed at register",
  });
  assert.equal(reversal.reverses_sale_id, sale.id);
  assert.equal(reversal.total_minor, -552);
  assert.deepEqual(
    reversal.payments.map((entry) => entry.amount_minor),
    [-200, 75, -100, -13080],
  );
  await write(token, `/sales/${sale.id}/reverse`, { reason: "Duplicate" }, 409);
  assert.equal(
    (await read(token, `/sales/${sale.id}`)).reversed_by_sale_id,
    reversal.id,
  );
  assert.equal((await read(token, `/sales/${sale.id}`)).payments.length, 4);
  const closed = await closeShift(
    token,
    shift,
    await reconciliation(token, shift),
  );
  assert.ok(closed.closing_counts.every((row) => row.variance_minor === 0));
  assert.deepEqual(await read(token, `/cashier-shifts/${shift.id}`), closed);
  assert.equal((await read(token, "/context")).profile.config.print_copies, 2);
  await write(token, `/working-days/${day.id}/close`, {}, 200);
});

test("shift-only, day-only and independent profiles, menu descendants and inclusive rounding", async () => {
  for (const [dayEnabled, shiftEnabled] of [
    [false, false],
    [false, true],
    [true, false],
  ]) {
    const profile = await newProfile(`Flags ${dayEnabled} ${shiftEnabled}`, {
      working_day_enabled: dayEnabled,
      cashier_shift_enabled: shiftEnabled,
      table_mode: "disabled",
      catalog_mode: "menu",
      selected_ids: ["main-menu"],
      tax_mode: "inclusive",
      tax_rate_bps: 1000,
    });
    const token = await start(profile);
    assert.deepEqual(
      (await read(token, "/catalog")).products.map((row) => row.id),
      ["coffee"],
    );
    assert.deepEqual((await read(token, "/tables")).tables, []);
    const day = dayEnabled ? await write(token, "/working-days", {}) : null;
    if (!dayEnabled) await write(token, "/working-days", {}, 409);
    const shift = shiftEnabled
      ? await write(token, "/cashier-shifts", {})
      : null;
    if (!shiftEnabled) await write(token, "/cashier-shifts", {}, 409);
    await write(
      token,
      "/sales",
      { table_id: "table-a", lines: [coffee()] },
      400,
    );
    const sale = await write(token, "/sales", {
      lines: [coffee(1, { modifier_ids: ["less"] })],
    });
    assert.equal(sale.total_minor, 246);
    assert.equal(sale.tax_minor, 22);
    const updated = await write(
      token,
      `/sales/${sale.id}`,
      { revision: 1, note: "Counter order" },
      200,
      randomUUID(),
      "PATCH",
    );
    assert.equal(updated.revision, 2);
    await write(
      token,
      `/sales/${sale.id}`,
      { revision: 1, note: "Stale edit" },
      409,
      randomUUID(),
      "PATCH",
    );
    const paid = await write(
      token,
      `/sales/${sale.id}/checkout`,
      {
        revision: 2,
        expected_total_minor: 246,
        payments: [cashPayment(9820, "KHR")],
      },
      200,
    );
    assert.equal(paid.shift_id, shift?.id ?? null);
    assert.equal(paid.working_day_id, day?.id ?? null);
    if (shift)
      await closeShift(token, shift, await reconciliation(token, shift));
    if (day) await write(token, `/working-days/${day.id}/close`, {}, 200);
  }
});

test("settlement rollback, concurrent idempotent retry, and close versus checkout", async () => {
  const profile = await newProfile("Concurrency", {
    cashier_shift_enabled: true,
  });
  const token = await start(profile);
  const shift = await write(token, "/cashier-shifts", {});
  const sale = await write(token, "/sales", { lines: [coffee()] });
  const body = {
    revision: 1,
    expected_total_minor: 251,
    payments: [cashPayment(251)],
  };
  await db
    .prepare(
      `CREATE TRIGGER fail_fixture_payment BEFORE INSERT ON sale_payments
    WHEN NEW.sale_id='${sale.id}' BEGIN SELECT RAISE(ABORT,'simulated_payment_failure'); END;`,
    )
    .run();
  const key = randomUUID();
  await write(token, `/sales/${sale.id}/checkout`, body, 500, key);
  assert.equal((await read(token, `/sales/${sale.id}`)).status, "open");
  assert.equal(
    await prepare(
      "SELECT count(*) AS n FROM sale_payments WHERE sale_id=?",
      sale.id,
    ).first("n"),
    0,
  );
  assert.equal(
    await prepare(
      "SELECT count(*) AS n FROM pos_commands WHERE idempotency_key=?",
      key,
    ).first("n"),
    0,
  );
  await db.prepare("DROP TRIGGER fail_fixture_payment").run();
  const identical = await Promise.all(
    Array.from({ length: 3 }, () =>
      write(token, `/sales/${sale.id}/checkout`, body, 200, key),
    ),
  );
  assert.deepEqual(identical[0], identical[2]);
  assert.equal(
    await prepare(
      "SELECT count(*) AS n FROM sale_payments WHERE sale_id=?",
      sale.id,
    ).first("n"),
    1,
  );

  const next = await write(token, "/sales", { lines: [coffee()] });
  const preview = await reconciliation(token, shift);
  const countInput = {
    activity_revision: preview.activity_revision,
    counts: preview.counts.map((row) => ({
      payment_type_id: row.payment_type_id,
      currency: row.currency,
      declared_minor: row.expected_minor,
    })),
  };
  const outcomes = await Promise.all([
    request(
      prefix + `/sales/${next.id}/checkout`,
      token,
      "POST",
      body,
      randomUUID(),
    ),
    request(
      prefix + `/cashier-shifts/${shift.id}/close`,
      token,
      "POST",
      countInput,
      randomUUID(),
    ),
  ]);
  assert.deepEqual(outcomes.map((result) => result.status).sort(), [200, 409]);
  if (outcomes[0].status === 200)
    await closeShift(token, shift, await reconciliation(token, shift));
  else
    await write(
      token,
      `/sales/${next.id}/cancel`,
      { revision: 1, reason: "Test close" },
      200,
    );
});

test("queued checkout keeps its original shift and replays after the shift closes", async () => {
  const profile = await newProfile("Guarded checkout", {
    cashier_shift_enabled: true,
  });
  const token = await start(profile);
  const initial = await write(token, "/cashier-shifts", {});
  const context = await read(token, "/context");
  assert.equal(context.capabilities.sale_context_guard, true);
  const expected = {
    business_date: context.local_date,
    working_day_id: null,
    shift_id: initial.id,
  };
  const draft = await write(token, "/sales", {
    lines: [{ product_id: "coffee", quantity: 1 }],
    expected_context: expected,
  });
  const body = {
    revision: draft.revision,
    expected_total_minor: draft.total_minor,
    expected_context: expected,
    payments: [
      {
        payment_type_id: cash,
        currency: "USD",
        amount_minor: draft.total_minor,
      },
    ],
  };
  const key = randomUUID();
  const first = await write(
    token,
    `/sales/${draft.id}/checkout`,
    body,
    200,
    key,
  );
  await closeShift(token, initial, await reconciliation(token, initial));
  const next = await write(token, "/cashier-shifts", {});
  const replay = await write(
    token,
    `/sales/${draft.id}/checkout`,
    body,
    200,
    key,
  );
  assert.equal(replay.id, first.id);
  assert.equal(replay.shift_id, initial.id);
  const stale = await write(
    token,
    "/sales",
    {
      lines: [{ product_id: "coffee", quantity: 1 }],
      expected_context: expected,
    },
    409,
  );
  assert.equal(stale.code, "SALE_CONTEXT_CHANGED");
  const second = await write(token, "/sales", {
    lines: [{ product_id: "coffee", quantity: 1 }],
  });
  const mismatch = await write(
    token,
    `/sales/${second.id}/checkout`,
    {
      ...body,
      revision: second.revision,
    },
    409,
  );
  assert.equal(mismatch.code, "SALE_CONTEXT_CHANGED");
  assert.equal((await read(token, `/sales/${second.id}`)).status, "open");
  await closeShift(token, next, await reconciliation(token, next));
});

test("device sessions renew after password-token expiry and respect live access", async () => {
  const profile = await newProfile("Device sessions");
  const different = await newProfile("Separate device sessions");
  const ownerToken = await start(profile);
  const otherProfileToken = await start(different);
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);
  const cashier = await start(profile, await login("cashier"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const descriptor = {
    device_id: randomUUID(),
    device_name: "Counter",
    public_key: Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("hex"),
  };
  const enrolled = await write(cashier, "/devices", descriptor);
  const second = await write(cashier, "/devices", descriptor);
  assert.equal(second.id, enrolled.id);
  await write(cashier, "/devices", { ...descriptor, public_key: "00".repeat(32) }, 409);
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);
  assert.equal((await read(ownerToken, "/devices")).devices[0].revoked_at, null);
  assert.equal((await read(otherProfileToken, "/devices")).devices.length, 0);
  await write(otherProfileToken, `/devices/${enrolled.id}`, undefined, 404, randomUUID(), "DELETE");

  await prepare("UPDATE pos_sessions SET expires_at=0 WHERE user_id='cashier' AND profile_id=?", profile.id).run();
  await read(cashier, "/context", 401);
  const proof = (issuedAt = Math.floor(Date.now() / 1000)) => {
    const nonce = randomBytes(32).toString("hex");
    const message = `emenu.pos.device-session.v1\n${enrolled.id}\n${issuedAt}\n${nonce}`;
    return {
      credential_id: enrolled.id, issued_at: issuedAt, nonce,
      signature: sign(null, Buffer.from(message), privateKey).toString("hex"),
    };
  };
  const renew = (body) => request(prefix + "/auth/device-session", null, "POST", body);
  const expired = await renew(proof(1));
  assert.equal(expired.status, 409);
  const forged = await renew({ ...proof(), signature: "00".repeat(64) });
  assert.equal(forged.status, 401);
  const input = proof();
  const competing = await Promise.all([renew(input), renew(input)]);
  assert.deepEqual(competing.map((response) => response.status).sort(), [201, 401]);
  const { token } = await competing.find((response) => response.status === 201).json();
  const view = await read(token, "/context");
  assert.equal(view.operator.id, "cashier");
  assert.equal(view.profile.id, profile.id);
  assert.equal(view.capabilities.device_sessions, true);
  assert.equal((await write(token, "/devices", descriptor, 403)).code, "PASSWORD_SESSION_REQUIRED");
  const sale = await write(token, "/sales", { lines: [coffee()] });
  assert.equal(sale.status, "open");

  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: [] }, 200);
  assert.equal((await renew(proof())).status, 401);
  await read(token, "/context", 401);
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);
  assert.equal((await renew(proof())).status, 401);
  const reauthenticated = await start(profile, await login("cashier"));
  assert.equal((await write(reauthenticated, "/devices", descriptor)).id, enrolled.id);
  await read(token, "/context", 401);
  assert.equal((await renew(proof())).status, 201);
  await write(ownerToken, `/devices/${enrolled.id}`, undefined, 200, randomUUID(), "DELETE");
  assert.equal((await renew(proof())).status, 401);
  await read(reauthenticated, "/context", 401);
});

test("a designated device owns a branch and advances its operating journal exactly once", async () => {
  const branch = "store-authority-branch";
  await prepare("INSERT INTO branches(id,business_id,slug,name) VALUES (?,'cafe',?,'Authority branch')", branch, branch).run();
  const profile = await newProfile("Store authority", { working_day_enabled: true }, branch);
  const peerProfile = await newProfile("Store authority peer", {}, branch);
  const other = await newProfile("Store authority other branch");
  async function device(selected) {
    const token = await start(selected);
    const key = generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x;
    await write(token, "/devices", {
      device_id: randomUUID(),
      device_name: "Designated register",
      public_key: Buffer.from(key, "base64url").toString("hex"),
    });
    return token;
  }
  const host = await device(profile);
  const peer = await device(peerProfile);
  const unrelated = await start(other);
  const oldDay = await write(host, "/working-days", {});
  assert.equal((await write(host, "/store-authority", {}, 409)).code, "STORE_BRANCH_BUSY");
  await write(host, `/working-days/${oldDay.id}/close`, {}, 200);

  const { epoch } = await write(host, "/store-authority", {});
  await write(host, "/staff/username-manager/username", { username: "store-manager" }, 200, randomUUID(), "PUT");
  assert.equal((await write(host, "/store-authority", {}, 200)).epoch, epoch);
  assert.equal((await read(peer, "/store-authority")).authority.owned_by_device, false);
  assert.equal((await read(unrelated, "/store-authority")).authority, null);
  assert.equal((await write(peer, "/store-authority", {}, 409)).code, "STORE_REGISTER_REQUIRED");
  assert.equal((await write(peer, "/sales", { lines: [coffee()] }, 409)).code, "STORE_REGISTER_REQUIRED");
  const openedAt = "2026-01-14T16:52:00.000Z";
  const event = {
    epoch, sequence: 1, kind: "open_day", resource_id: randomUUID(),
    occurred_at: openedAt,
    settings: { working_day_enabled: true, cashier_shift_enabled: false },
    payload: {},
  };
  const command = randomUUID();
  assert.equal((await write(host, "/store-operations", { ...event, profile_id: peerProfile.id }, 403)).code, "WRONG_REGISTER_SESSION");
  assert.equal((await write(host, "/store-operations", { ...event, sequence: 2 }, 409)).code, "STORE_SEQUENCE_CHANGED");
  assert.equal((await write(peer, "/store-operations", event, 409)).code, "STORE_REGISTER_REQUIRED");
  const opened = await write(host, "/store-operations", event, 201, command);
  assert.equal(opened.id, event.resource_id);
  assert.equal(opened.opened_at, openedAt);
  assert.equal(opened.business_date, "2026-01-14");
  assert.deepEqual(await write(host, "/store-operations", event, 201, command), opened);
  assert.equal((await write(host, "/store-operations", { ...event, occurred_at: "2026-01-14T16:50:00.000Z" }, 409, command)).code, "IDEMPOTENCY_CONFLICT");
  assert.equal((await read(host, "/store-authority")).authority.last_sequence, 1);
  await write(host, "/store-authority", { epoch, last_sequence: 1 }, 409, randomUUID(), "DELETE");
  const saleId = randomUUID();
  const checkout = {
    ...event, sequence: 2, kind: "checkout", resource_id: saleId,
    occurred_at: "2026-01-14T17:20:00.000Z",
    payload: {
      currency: "USD", exchange_rate: "4000", tax_mode: "disabled", tax_rate_bps: 0,
      table_mode: "optional", customer_id: "walkin_cafe", customer_name: "Walk-in",
      expected_context: { business_date: opened.business_date, working_day_id: opened.id, shift_id: null },
      lines: [{
        product_id: "coffee", product_name: "Coffee", price_list_id: "",
        quantity: 1, unit_price_minor: 251, subtotal_minor: 251, tax_minor: 0, total_minor: 251,
      }],
      total_minor: 251,
      payment_types: (await read(host, "/context")).payment_types,
      payments: [cashPayment(251)],
      receipt: { business_name: "Cafe", template: { show_tax: false }, copies: 1 },
    },
  };
  const saleKey = randomUUID();
  await db.batch([
    prepare(`INSERT INTO subscription_plans(id,code,name,pos_enabled,max_daily_pos_sales)
      VALUES ('pos-store-test','pos-store-test','POS store test',1,0)`),
    prepare("INSERT INTO business_subscriptions(id,business_id,plan_id) VALUES ('pos-store-test','cafe','pos-store-test')"),
  ]);
  try {
    assert.equal(
      (await write(host, "/store-operations", checkout, 409, saleKey)).code,
      "PLAN_DAILY_POS_SALE_LIMIT",
    );
    await read(host, `/sales/${saleId}`, 404);
    assert.equal((await read(host, "/store-authority")).authority.last_sequence, 1);
  } finally {
    await db.batch([
      prepare("DELETE FROM business_subscriptions WHERE id='pos-store-test'"),
      prepare("DELETE FROM subscription_plans WHERE id='pos-store-test'"),
    ]);
  }
  await prepare(`CREATE TRIGGER store_import_fails BEFORE INSERT ON sale_payments
    WHEN NEW.sale_id='${saleId}' BEGIN SELECT RAISE(ABORT,'simulated_store_payment_failure'); END`).run();
  try {
    await write(host, "/store-operations", checkout, 500, saleKey);
    await read(host, `/sales/${saleId}`, 404);
    assert.equal((await read(host, "/store-authority")).authority.last_sequence, 1);
  } finally {
    await prepare("DROP TRIGGER store_import_fails").run();
  }
  const saved = await Promise.all([
    write(host, "/store-operations", checkout, 201, saleKey),
    write(host, "/store-operations", checkout, 201, saleKey),
  ]);
  assert.deepEqual(saved[0], saved[1]);
  assert.equal(saved[0].payments.length, 1);
  assert.equal((await read(host, "/store-authority")).authority.last_sequence, 2);
  const refund = {
    ...event,
    sequence: 3,
    kind: "reversal",
    resource_id: randomUUID(),
    occurred_at: "2026-01-14T17:22:00.000Z",
    payload: {
      original_sale_id: saleId,
      reason: "Returned",
      expected_context: checkout.payload.expected_context,
    },
  };
  await write(host, "/store-operations", refund, 400);
  assert.equal((await write(host, "/store-operations", {
    ...refund,
    payload: { ...refund.payload, expected_total_minor: 250 },
  }, 409)).code, "BILL_CHANGED");
  assert.equal((await read(host, "/store-authority")).authority.last_sequence, 2);
  await read(host, `/sales/${refund.resource_id}`, 404);
  await write(host, "/store-operations", {
    ...event, sequence: 3, kind: "close_day", occurred_at: "2026-01-14T17:25:00.000Z",
  }, 200);
  await write(host, "/store-authority", { epoch, last_sequence: 3 }, 200, randomUUID(), "DELETE");
  assert.equal((await read(peer, "/store-authority")).authority, null);
  const replacement = await write(peer, "/store-authority", {});
  await write(host, "/store-authority", { epoch, last_sequence: 3 }, 200, randomUUID(), "DELETE");
  assert.equal((await read(peer, "/store-authority")).authority.epoch, replacement.epoch);
  await write(peer, "/store-authority", { epoch: replacement.epoch, last_sequence: 0 }, 200, randomUUID(), "DELETE");
  const afterHandoff = await write(host, "/working-days", {});
  await write(host, `/working-days/${afterHandoff.id}/close`, {}, 200);
});

test("the designated owner recovers a removed operator's queued entries without changing attribution", async () => {
  const branch = "recovery-branch";
  await prepare("INSERT INTO branches(id,business_id,slug,name) VALUES (?,'cafe',?,'Recovery branch')", branch, branch).run();
  await account("recovery-cashier", "cafe", "editor");
  const primary = await newProfile("Recovery primary", {}, branch);
  const target = await newProfile("Recovery secondary", {}, branch);
  const foreign = await newProfile("Recovery other branch");
  await adminWrite(`/profiles/${target.id}/grants`, "PUT", { user_ids: ["recovery-cashier"] }, 200);
  const owner = await start(primary);
  const cashier = await start(target, await login("recovery-cashier"));
  const manager = await start(target, await login("username-manager"));
  const other = await start(foreign);
  const sameIdWrongKey = await start(target);
  const descriptor = {
    device_id: randomUUID(), device_name: "Recovery register",
    public_key: randomBytes(32).toString("hex"),
  };
  for (const token of [owner, cashier, manager, other]) await write(token, "/devices", descriptor);
  await write(sameIdWrongKey, "/devices", { ...descriptor, public_key: randomBytes(32).toString("hex") });
  const { epoch } = await write(owner, "/store-authority", {});
  assert.equal((await read(sameIdWrongKey, "/store-authority")).authority.owned_by_device, false);

  const operation = (sequence, profile = target) => ({
    epoch, sequence, profile_id: profile.id, kind: "checkout", resource_id: randomUUID(),
    occurred_at: "2026-01-14T16:30:00.000Z",
    settings: { working_day_enabled: false, cashier_shift_enabled: false },
    payload: {
      currency: "USD", exchange_rate: "4000", tax_mode: "disabled", tax_rate_bps: 0,
      table_mode: "optional", customer_id: "walkin_cafe", customer_name: "Walk-in",
      expected_context: { business_date: "2026-01-14", working_day_id: null, shift_id: null },
      lines: [{ product_id: "coffee", product_name: "Coffee", price_list_id: "", quantity: 1,
        unit_price_minor: 251, subtotal_minor: 251, tax_minor: 0, total_minor: 251 }],
      total_minor: 251, payments: [cashPayment(251)],
      receipt: { business_name: "Cafe", template: { show_tax: false }, copies: 1, operator_name: "Original cashier" },
    },
  });
  const paymentTypes = (await read(cashier, "/context")).payment_types;
  const first = operation(1);
  first.payload.payment_types = paymentTypes;
  const second = operation(2);
  second.payload.payment_types = paymentTypes;
  const third = operation(3, primary);
  third.payload.payment_types = paymentTypes;
  const firstKey = randomUUID();
  const secondKey = randomUUID();
  const recover = (token, event, key, expected = 201, overrides = {}) => write(token, "/store-operations/recover", {
    profile_id: target.id, operator_id: "recovery-cashier", operation: event,
    reason: "Cashier left after the sale", ...overrides,
  }, expected, key);

  const committed = await write(cashier, "/store-operations", first, 201, firstKey);
  assert.deepEqual(await recover(owner, first, firstKey), committed);
  assert.deepEqual((await read(owner, "/store-operations/recoveries")).recoveries, []);
  assert.equal((await recover(owner, second, secondKey, 409)).code, "STORE_OPERATOR_ACTIVE");
  assert.equal((await recover(manager, second, secondKey, 403)).code, "STORE_OWNER_REQUIRED");
  assert.equal((await recover(sameIdWrongKey, second, secondKey, 409)).code, "STORE_REGISTER_REQUIRED");
  assert.equal((await recover(other, second, secondKey, 403)).code, "WRONG_REGISTER_SESSION");
  await read(cashier, "/store-operations/recoveries", 403);
  assert.equal((await recover(owner, second, secondKey, 409, { operator_id: "username-ungranted" })).code, "STORE_OPERATOR_UNKNOWN");

  await prepare("DELETE FROM memberships WHERE user_id='recovery-cashier' AND business_id='cafe'").run();
  await write(cashier, "/store-operations", second, 401, secondKey);
  await prepare(`CREATE TRIGGER recovery_import_fails BEFORE INSERT ON sale_payments
    WHEN NEW.sale_id='${second.resource_id}' BEGIN SELECT RAISE(ABORT,'simulated_recovery_failure'); END`).run();
  try {
    await recover(owner, second, secondKey, 500);
    assert.equal((await read(owner, "/store-authority")).authority.last_sequence, 1);
    assert.deepEqual((await read(owner, "/store-operations/recoveries")).recoveries, []);
  } finally {
    await prepare("DROP TRIGGER recovery_import_fails").run();
  }
  const copies = await Promise.all([recover(owner, second, secondKey), recover(owner, second, secondKey)]);
  assert.deepEqual(copies[0], copies[1]);
  assert.equal(copies[0].settled_by, "recovery-cashier");
  assert.equal(copies[0].profile_id, target.id);
  assert.equal(copies[0].payments.length, 1);
  const changed = { ...second, occurred_at: "2026-01-14T16:35:00.000Z" };
  assert.equal((await recover(owner, changed, secondKey, 409)).code, "IDEMPOTENCY_CONFLICT");
  const { recoveries: [audit] } = await read(manager, "/store-operations/recoveries");
  assert.deepEqual({ ...audit, approved_at: undefined }, {
    epoch, sequence: 2, profile_id: target.id, command_id: secondKey, operator_id: "recovery-cashier",
    approved_by: "owner", reason: "Cashier left after the sale", approved_at: undefined,
  });
  assert.ok(Date.parse(audit.approved_at) > Date.parse(second.occurred_at));
  assert.equal((await read(owner, "/store-operations/recoveries")).recoveries.length, 1);
  assert.deepEqual((await read(other, "/store-operations/recoveries")).recoveries, []);
  await write(owner, "/store-operations", third);
  await write(owner, "/store-authority", { epoch, last_sequence: 3 }, 200, randomUUID(), "DELETE");
  assert.equal((await read(owner, "/store-operations/recoveries")).recoveries.length, 1);
});

test(
  "paired Dart tills share a branch day, settle independently by profile, and replay offline operations",
  {
    skip: !process.env.POS_DART_EXECUTABLE,
  },
  async () => {
    const branch = "offline-smoke-branch";
    await db.batch([
      prepare("INSERT INTO branches(id,business_id,slug,name) VALUES (?,'cafe',?,'Offline store')", branch, branch),
      prepare("INSERT INTO table_groups(id,business_id,branch_id,name) VALUES ('offline-floor','cafe',?,'Floor')", branch),
      prepare(`INSERT INTO restaurant_tables(id,business_id,branch_id,group_id,code,label,public_token)
        VALUES ('offline-table','cafe',?,'offline-floor','1','Table 1','offline-table-token')`, branch),
    ]);
    const profile = await newProfile("Dart register", {
      table_mode: "required",
      working_day_enabled: true,
      cashier_shift_enabled: true,
    }, branch);
    const second = await newProfile("Dart retail", {
      table_mode: "disabled", working_day_enabled: true, cashier_shift_enabled: true,
    }, branch);
    const token = await start(profile);
    const secondToken = await start(second);
    const address = await runtime.ready;
    // Change the catalog after the tills have captured the receipt offline.
    await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);
    await write(token, "/staff/cashier/username", { username: "counter-cashier" }, 200, randomUUID(), "PUT");
    await prepare(`CREATE TRIGGER store_smoke_reprice AFTER INSERT ON cashier_shifts
      WHEN NEW.profile_id='${profile.id}'
      BEGIN UPDATE products SET price_cents=9.99 WHERE id='coffee'; END`).run();
    let result;
    try {
      const { stdout } = await exec(
        process.env.POS_DART_EXECUTABLE,
        ["run", "tool/worker_sync_smoke.dart"],
        {
          cwd: resolve(root, "apps/pos"),
          env: {
            ...process.env,
            POS_API_BASE: address.href,
            POS_BUSINESS_SLUG: "cafe",
            POS_EMAIL: emailFor("owner"),
            POS_CASHIER_USERNAME: "counter-cashier",
            POS_PASSWORD: "fixture-password",
            POS_PROFILE_ID: profile.id,
            POS_SECOND_PROFILE_ID: second.id,
            POS_SMOKE_REVOKE_CASHIER_TOKEN: admin,
            POS_PRODUCT_ID: "coffee",
          },
          timeout: 90_000,
        },
      );
      result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
      assert.equal(await prepare("SELECT price_cents FROM products WHERE id='coffee'").first("price_cents"), 9.99);
    } finally {
      await db.batch([
        prepare("DROP TRIGGER store_smoke_reprice"),
        prepare("UPDATE products SET price_cents=2.51 WHERE id='coffee'"),
      ]);
    }
    const sales = await read(token, "/sales?status=paid");
    assert.equal(sales.sales.length, 2);
    assert.equal(sales.sales.find(row => row.id === result.server_sale_id).total_minor, result.amount_minor);
    const receipt = await read(token, `/sales/${result.server_sale_id}`);
    assert.equal(receipt.business_date, result.business_date);
    assert.equal(receipt.settled_at, result.checkout_at);
    assert.equal(receipt.shift_id, result.last_shift_id);
    assert.equal(receipt.settled_by, "cashier");
    assert.equal(receipt.lines[0].unit_price_minor, 251);
    assert.deepEqual(receipt.payments.map((entry) => entry.currency), ["USD", "KHR", "KHR"]);
    assert.equal(receipt.reversed_by_sale_id, result.reversal_id);
    const reversal = await read(token, `/sales/${result.reversal_id}`);
    assert.equal(reversal.reverses_sale_id, result.server_sale_id);
    assert.equal(reversal.working_day_id, result.reversal_day_id);
    assert.equal(reversal.shift_id, result.reversal_shift_id);
    assert.equal(reversal.settled_by, "owner");
    assert.equal(reversal.total_minor, -251);
    assert.deepEqual(reversal.payments.map(row => row.amount_minor), [-125, -6000, 960]);
    assert.deepEqual(reversal.payments.map(row => row.reverses_payment_id), receipt.payments.map(row => row.id));
    const refund = await read(token, `/cashier-shifts/${result.reversal_shift_id}`);
    assert.equal(refund.closing_counts.find(row => row.payment_type_id === cash && row.currency === "USD").expected_minor, 375);
    assert.equal(refund.closing_counts.find(row => row.payment_type_id === cash && row.currency === "KHR").expected_minor, 4960);
    assert.ok(refund.closing_counts.every(row => row.variance_minor === 0));
    const first = await read(token, `/cashier-shifts/${result.first_shift_id}`);
    assert.equal(first.closing_counts.find(row => row.currency === "KHR").expected_minor, 4000);
    const last = await read(token, `/cashier-shifts/${result.last_shift_id}`);
    assert.equal(last.closing_counts.find(row => row.payment_type_id === cash && row.currency === "USD").expected_minor, 300);
    assert.ok(last.closing_counts.every(row => row.variance_minor === 0));
    const day = await read(token, `/working-days/${result.day_id}`);
    assert.equal(day.opened_at, result.opened_at);
    assert.ok(day.closed_at);
    assert.equal((await read(secondToken, `/working-days/${day.id}`)).id, day.id);
    const retailSales = (await read(secondToken, "/sales?status=paid")).sales;
    assert.equal(retailSales.length, 1);
    assert.equal(retailSales[0].id, result.side_sale_id);
    const retail = await read(secondToken, `/sales/${result.side_sale_id}`);
    assert.equal(retail.working_day_id, day.id);
    assert.equal(retail.shift_id, result.side_shift_id);
    assert.equal(retail.total_minor, 251);
    assert.equal(retail.table_id, null);
    const retailShift = await read(secondToken, `/cashier-shifts/${result.side_shift_id}`);
    assert.equal(retailShift.closing_counts.find(row => row.payment_type_id === cash && row.currency === "USD").expected_minor, 1151);
    assert.ok(retailShift.closing_counts.every(row => row.variance_minor === 0));
    await read(token, `/sales/${result.side_sale_id}`, 404);
    await read(secondToken, `/sales/${result.server_sale_id}`, 404);
    const audit = (await read(token, "/store-operations/recoveries")).recoveries;
    assert.ok(audit.length >= 3);
    assert.deepEqual(audit.map(row => row.command_id).sort(), result.approved_commands.sort());
    assert.ok(audit.every(row => row.operator_id === "cashier" && row.approved_by === "owner"));
    assert.equal((await read(token, "/store-authority")).authority, null);
  },
);

test("the documented smoke script opens, settles, renders a receipt, and closes", async () => {
  const profile = await newProfile("Smoke script", {
    working_day_enabled: true,
    cashier_shift_enabled: true,
  });
  const address = await runtime.ready;
  const env = {
    ...process.env,
    POS_API_BASE: address.href,
    POS_BUSINESS_SLUG: "cafe",
    POS_EMAIL: emailFor("owner"),
    POS_PASSWORD: "fixture-password",
    POS_PROFILE_ID: profile.id,
    POS_PRODUCT_ID: "coffee",
    POS_RUN_ID: randomUUID(),
    POS_DEMO_QR_REFERENCE: "isolated-demo-qr",
    POS_DEMO_SAME_DAY: "1",
  };
  const script = resolve(root, "docs/examples/pos-api-smoke.mjs");
  const opened = await exec(process.execPath, [script, "open"], { env });
  const { POS_WORKING_DAY_ID, POS_SHIFT_ID, POS_SALE_ID } = JSON.parse(
    opened.stdout,
  );
  const settled = await exec(process.execPath, [script, "settle"], {
    env: { ...env, POS_WORKING_DAY_ID, POS_SHIFT_ID, POS_SALE_ID },
  });
  assert.match(settled.stdout, /Total 251 USD minor units/);
  assert.match(settled.stdout, /"variance_minor": 0/);
  const token = await start(profile);
  const sale = await read(token, `/sales/${POS_SALE_ID}`);
  assert.equal(sale.status, "paid");
  assert.deepEqual(
    sale.payments.map((entry) => entry.amount_minor),
    [126, 125],
  );
  assert.ok(
    (await read(token, `/working-days/${POS_WORKING_DAY_ID}`)).closed_at,
  );
});

test("KHR sales keep table and product snapshots and reconcile a reversal under a renamed drawer configuration", async () => {
  const otherMain = await prepare(
    "SELECT id FROM branches WHERE business_id='other' AND is_default=1",
  ).first("id");
  await db.batch([
    prepare(
      "UPDATE businesses SET currency='KHR',secondary_exchange_rate=0.00025 WHERE id='other'",
    ),
    prepare("UPDATE products SET price_cents=1000.5 WHERE id='other-product'"),
    prepare(
      "INSERT INTO table_groups(id,business_id,branch_id,name) VALUES ('test-group','other',?,'Main')",
      otherMain,
    ),
    prepare(
      `INSERT INTO restaurant_tables(id,business_id,branch_id,group_id,code,label,public_token)
      VALUES ('test-table','other',?,'test-group','K','Table K','other-token')`,
      otherMain,
    ),
  ]);
  const email = emailFor("stranger");
  const otherAdmin = (
    await status(
      await request("/api/auth/login", null, "POST", {
        email,
        passwordProof: proofFor(email),
        authVersion: version,
      }),
      200,
    )
  ).token;
  const oldCash = (
    await adminWrite(
      "/payment-types",
      "POST",
      { name: "Original cash", kind: "cash" },
      201,
      otherAdmin,
    )
  ).id;
  const newCash = (
    await adminWrite(
      "/payment-types",
      "POST",
      { name: "Replacement cash", kind: "cash" },
      201,
      otherAdmin,
    )
  ).id;
  const config = (id) => ({
    cashier_shift_enabled: true,
    table_mode: "required",
    default_payment_type_id: id,
    payment_types: [{ id, currencies: ["USD", "KHR"] }],
  });
  const profile = await adminWrite(
    "/profiles",
    "POST",
    {
      name: "KHR register",
      branch_id: otherMain,
      config: config(oldCash),
    },
    201,
    otherAdmin,
  );
  const token = await start(profile, await login("stranger", "other"));
  const shift = await write(token, "/cashier-shifts", {});
  const lines = [{ product_id: "other-product", quantity: 1 }];
  await write(token, "/sales", { lines }, 400);
  const sale = await write(token, "/sales", { table_id: "test-table", lines });
  assert.equal(sale.total_minor, 1001);
  await write(
    token,
    `/sales/${sale.id}/checkout`,
    {
      revision: 1,
      expected_total_minor: 1001,
      payments: [
        { payment_type_id: oldCash, currency: "USD", amount_minor: 25 },
        { payment_type_id: oldCash, currency: "KHR", amount_minor: 1 },
      ],
    },
    200,
  );
  await closeShift(token, shift, await reconciliation(token, shift));
  await adminWrite(
    `/profiles/${profile.id}`,
    "PATCH",
    { config: config(newCash) },
    200,
    otherAdmin,
  );
  await db.batch([
    prepare("DELETE FROM products WHERE id='other-product'"),
    prepare("DELETE FROM restaurant_tables WHERE id='test-table'"),
  ]);
  const stored = await read(token, `/sales/${sale.id}`);
  assert.equal(stored.table_label, "Table K");
  assert.equal(stored.lines[0].product_name, "Other");
  const next = await write(token, "/cashier-shifts", {
    opening_cash: [
      { payment_type_id: newCash, currency: "USD", amount_minor: 100 },
      { payment_type_id: newCash, currency: "KHR", amount_minor: 1000 },
    ],
  });
  await write(token, `/sales/${sale.id}/reverse`, {
    reason: "Refund approved",
  });
  const counts = await reconciliation(token, next);
  assert.deepEqual(
    counts.counts.map((row) => [
      row.payment_type_id,
      row.currency,
      row.expected_minor,
    ]),
    [
      [newCash, "KHR", 999],
      [newCash, "USD", 75],
    ],
  );
  await closeShift(token, next, counts);
});

test("POS profiles restrict table groups to their branch and apply the saved group order", async () => {
  await db.batch([
    prepare(`INSERT INTO table_groups(id,business_id,branch_id,name,sort_order)
      VALUES ('group-room','cafe',?,'Dining room',1),('group-bar','cafe',?,'Bar',2)`, main, main),
    prepare(`INSERT INTO restaurant_tables(id,business_id,branch_id,group_id,code,label,public_token)
      VALUES ('table-room','cafe',?,'group-room','Room','Room table','public-room'),
        ('table-bar','cafe',?,'group-bar','Bar','Bar table','public-bar')`, main, main),
  ]);
  const groups = ["group-bar", "group-room"];
  const config = { table_mode: "required", table_group_ids: groups };
  for (const invalidGroups of [[], ["group-bar", "group-bar"], ["other-patio"]]) {
    await adminWrite("/profiles", "POST", {
      name: "Invalid groups",
      branch_id: main,
      config: profileConfig({ ...config, table_group_ids: invalidGroups }),
    }, 400);
  }

  const profile = await newProfile("Ordered table groups", config);
  assert.deepEqual(profile.config.table_group_ids, groups);
  const token = await start(profile);
  const tableIds = async (query = "") => (await read(token, "/tables" + query)).tables.map(({ id }) => id);
  assert.deepEqual(await tableIds(), ["table-bar", "table-room"]);
  assert.deepEqual(await tableIds("?page_size=1&page=2"), ["table-room"]);
  await write(token, "/sales", { lines: [coffee()], table_id: "table-a" }, 404);
  const bill = await write(token, "/sales", { lines: [coffee()], table_id: "table-bar" });
  const nextGroups = ["group-room", "group-bar"];
  const pending = await adminWrite(`/profiles/${profile.id}`, "PATCH", {
    config: profileConfig({ ...config, table_group_ids: nextGroups }),
  }, 200);
  assert.deepEqual(pending.pending_config.table_group_ids, nextGroups);
  assert.deepEqual(await tableIds(), ["table-bar", "table-room"]);
  await write(token, `/sales/${bill.id}/cancel`, { revision: bill.revision, reason: "Test" }, 200);
  assert.deepEqual(await tableIds(), ["table-room", "table-bar"]);

  const legacy = await newProfile("Legacy table groups");
  await prepare("UPDATE pos_profiles SET config_json=json_remove(config_json,'$.table_group_ids') WHERE id=?", legacy.id).run();
  const legacyTables = (await read(await start(legacy), "/tables")).tables.map(({ id }) => id);
  assert.ok(legacyTables.includes("table-a"));
  assert.deepEqual(legacyTables.filter((id) => ["table-room", "table-bar"].includes(id)), ["table-room", "table-bar"]);
});

test("payment types keep their selected currency in profiles and at checkout", async () => {
  const cashUsd = await adminWrite("/payment-types", "POST", {
    name: "Cash USD", kind: "cash", currency: "USD",
  });
  const cashRiel = await adminWrite("/payment-types", "POST", {
    name: "Cash Riel", kind: "cash", currency: "KHR",
  });
  assert.equal(cashUsd.currency, "USD");
  assert.equal(cashRiel.currency, "KHR");
  assert.equal((await adminWrite(`/payment-types/${cash}`, "GET", undefined, 200)).currency, null);
  await adminWrite("/payment-types", "POST", { name: "Cash EUR", kind: "cash", currency: "EUR" }, 400);
  await adminWrite(`/payment-types/${cashUsd.id}`, "PATCH", { currency: "KHR" }, 400);
  assert.equal((await adminWrite(`/payment-types/${cashUsd.id}`, "PATCH", { name: "USD cash" }, 200)).currency, "USD");

  const paymentTypes = [
    { id: cashUsd.id, currencies: ["USD"] },
    { id: cashRiel.id, currencies: ["KHR"] },
  ];
  await adminWrite("/profiles", "POST", {
    name: "Invalid payment currency",
    branch_id: main,
    config: profileConfig({
      default_payment_type_id: cashUsd.id,
      payment_types: [{ id: cashUsd.id, currencies: ["USD", "KHR"] }],
    }),
  }, 400);
  const profile = await newProfile("Fixed payment currencies", {
    default_payment_type_id: cashUsd.id,
    payment_types: paymentTypes,
  });
  const choices = await adminWrite("/profile-options", "GET", undefined, 200);
  assert.ok(choices.payment_types.some(({ id, currency }) => id === cashRiel.id && currency === "KHR"));
  const token = await start(profile);
  const context = await read(token, "/context");
  assert.deepEqual(context.payment_types.map(({ id, currencies }) => ({ id, currencies })), paymentTypes);
  const bill = await write(token, "/sales", { lines: [coffee()] });
  const checkout = (payment, expected) => write(token, `/sales/${bill.id}/checkout`, {
    revision: bill.revision,
    expected_total_minor: bill.total_minor,
    payments: [payment],
  }, expected);
  await checkout(cashPayment(bill.total_minor, "USD", { payment_type_id: cashRiel.id }), 400);
  const paid = await checkout(cashPayment(bill.total_minor, "USD", { payment_type_id: cashUsd.id }), 200);
  assert.equal(paid.payments[0].currency, "USD");
});

test("cash float permissions apply per payment type for the lifetime of a shift", async () => {
  const paymentTypes = [
    { id: cash, currencies: ["USD", "KHR"], allow_cash_float: false },
    { id: qr, currencies: ["USD"], allow_cash_float: true },
  ];
  const profile = await newProfile("Payment type cash floats", { payment_types: paymentTypes });
  assert.equal(profile.config.cashier_shift_enabled, true);
  assert.deepEqual(profile.config.payment_types, paymentTypes);
  const token = await start(profile);
  const tender = (amount, id = qr) => cashPayment(amount, "USD", { payment_type_id: id });
  await write(token, "/cashier-shifts", { opening_cash: [tender(100, cash)] }, 400);
  const shift = await write(token, "/cashier-shifts", { opening_cash: [tender(100)] });
  const movement = (id, expected) => write(token, `/cashier-shifts/${shift.id}/cash-floats`, {
    ...tender(25, id), kind: "cash_in", reason: "Opening adjustment",
  }, expected);
  await movement(cash, 400);
  const changed = paymentTypes.map((type) => ({ ...type, allow_cash_float: type.id === cash }));
  const pending = await adminWrite(`/profiles/${profile.id}`, "PATCH", {
    config: profileConfig({ payment_types: changed }),
  }, 200);
  assert.deepEqual(pending.pending_config.payment_types, changed);
  await movement(qr, 201);
  const floats = await read(token, `/cashier-shifts/${shift.id}/cash-floats`);
  assert.equal(floats.cash_floats.length, 2);
  assert.ok(floats.cash_floats.every((float) => float.payment_type_id === qr));
  const counts = await reconciliation(token, shift);
  const qrCount = counts.counts.find((row) => row.payment_type_id === qr);
  assert.equal(qrCount.payment_kind, "qr");
  assert.equal(qrCount.expected_minor, 125);
  const bill = await write(token, "/sales", { lines: [coffee()] });
  await write(token, `/sales/${bill.id}/checkout`, {
    revision: bill.revision, expected_total_minor: bill.total_minor,
    payments: [tender(bill.total_minor, cash)],
  }, 200);
  await closeShift(token, shift, await reconciliation(token, shift));
  await write(token, "/cashier-shifts", { opening_cash: [tender(100)] }, 400);
  await write(token, "/cashier-shifts", { opening_cash: [tender(100, cash)] });
});
