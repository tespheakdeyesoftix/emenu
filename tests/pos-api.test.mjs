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
let cashKHR;
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
    { id: cash, currency: "USD" },
    { id: cashKHR, currency: "KHR" },
    { id: qr, currency: "USD" },
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
const compoundTax = {
  id: "compound",
  tax_name: "Compound tax",
  tax_mode: "exclusive",
  tax_1_name: "Tax 1",
  tax_1_rate: 10,
  calculate_tax_1_after_discount: true,
  tax_2_name: "Tax 2",
  tax_2_rate: 5,
  calculate_tax_2_after_adding_tax_1: true,
  calculate_tax_2_after_discount: false,
  tax_3_name: "Tax 3",
  tax_3_rate: 2,
  calculate_tax_3_after_adding_tax_1: true,
  calculate_tax_3_after_adding_tax_2: true,
  calculate_tax_3_after_discount: true,
};
const discountedLine = {
  subtotal_minor: 1004, discount_minor: 104,
  tax_1_amount: 90, tax_2_amount: 55, tax_3_amount: 21,
  tax_minor: 166, total_tax_amount: 166, total_minor: 1066, total_amount: 1066,
};
const cashPayment = (amount, currency = "USD", overrides = {}) => ({
  payment_type_id: currency === "KHR" ? cashKHR : cash,
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
            PUBLIC_ASSET_BASE: "https://assets.test",
            PUBLIC_MEDIA_BASE: "https://media.test",
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
    if (name === "0073_pos_defaults_off.sql") {
      await prepare("UPDATE businesses SET disabled_control_pages_json=? WHERE id='cafe'",
        JSON.stringify(["catalog", "posProfiles"])).run();
    }
    if (name === "0076_pos_profile_payment_currency.sql") {
      const active = { payment_types: [{ id: "legacy-cash", currencies: ["KHR", "USD"], allow_cash_float: true }] };
      const pending = { payment_types: [{ id: "legacy-cash", currencies: ["KHR"] }] };
      await prepare(`INSERT INTO pos_profiles(id,business_id,branch_id,name,config_json,pending_config_json)
        SELECT 'payment-migration','cafe',id,'Legacy profile',?,? FROM branches WHERE business_id='cafe' AND is_default=1`,
        JSON.stringify(active), JSON.stringify(pending)).run();
    }
    if (name === "0080_pos_customers.sql") {
      await prepare("INSERT INTO pos_customers(id,business_id,name) VALUES ('legacy-customer','cafe','Legacy Customer')").run();
    }
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
  const migrated = await prepare("SELECT disabled_control_pages_json FROM businesses WHERE id='cafe'").first("disabled_control_pages_json");
  assert.deepEqual(JSON.parse(migrated), ["catalog", "posProfiles", "sellingOverview", "posPaymentTypes"]);
  // These fixtures explicitly enable the sidebar pages for the POS API tests.
  const paymentMigration = await prepare("SELECT config_json,pending_config_json FROM pos_profiles WHERE id='payment-migration'").first();
  assert.deepEqual(JSON.parse(paymentMigration.config_json).payment_types, [
    { id: "legacy-cash", currency: "USD", allow_cash_float: true },
  ]);
  assert.deepEqual(JSON.parse(paymentMigration.pending_config_json).payment_types, [
    { id: "legacy-cash", currency: "KHR" },
  ]);
  await prepare("DELETE FROM pos_profiles WHERE id='payment-migration'").run();
  await prepare("UPDATE businesses SET disabled_control_pages_json='[]' WHERE id IN ('cafe','other')").run();
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
  cashKHR = (await adminWrite("/payment-types", "POST", { name: "KHR drawer", kind: "cash", currency: "KHR" })).id;
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
  assert.deepEqual(standard, { pos_enabled: 0, max_pos_profiles: null, max_daily_pos_sales: null });
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
      ["sellingOverview", "posProfiles", "posPaymentTypes", "posCustomers", "salesList"],
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
    { [cash + "USD"]: 1250, [cashKHR + "KHR"]: 23080, [qr + "USD"]: 100 },
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
  const activeProfile = await adminWrite("/profiles/" + a.id, "GET", undefined, 200);
  assert.equal(activeProfile.config.print_copies, 2);
  await write(token, `/working-days/${day.id}/close`, {}, 200);
});

test("POS profile receipt templates round-trip with defaults for each type", async () => {
  const receipt = {
    id: "sale-en",
    name: "Receipt EN",
    type: "receipt",
    language: "en",
    paper_width_mm: 80,
    print_copies: 2,
    title: "Closing receipt",
    footer: "Thank you",
    text_size: "normal",
    heading_alignment: "center",
    fields: ["order_number", "unit_prices", "tax", "payments"],
  };
  const khmer = { ...receipt, id: "sale-km", name: "Receipt KH", language: "km" };
  const kitchen = {
    ...receipt, id: "kitchen", name: "Kitchen Order", type: "kitchen_receipt",
    fields: ["order_number", "station", "modifiers", "item_notes"],
  };
  const label = {
    ...receipt, id: "qr-label", name: "QR Sticker", type: "qr_label", paper_width_mm: 58,
    fields: ["table", "show_link"],
    qr: { label_height_mm: 50, size_mm: 28, target: "custom_url", custom_url: "https://example.test/menu", caption: "Open the menu" },
  };
  const templates = [receipt, khmer, kitchen, label];
  const defaults = { receipt: receipt.id, kitchen_receipt: kitchen.id, qr_label: label.id };
  const profile = await newProfile("Multiple print templates", {
    receipt_templates: templates,
    default_receipt_templates: defaults,
  });
  const token = await start(profile);
  const context = async () => (await read(token, "/context")).profile.config;
  assert.deepEqual((await context()).receipt_templates, templates);
  assert.deepEqual((await context()).default_receipt_templates, defaults);
  const discover = await read(discovery, "/profiles?page_size=100");
  const discoveredProfile = discover.profiles.find(({ id }) => id === profile.id);
  assert.ok(discoveredProfile);
  for (const config of [await context(), discoveredProfile.config]) {
    for (const field of ["print_copies", "tax_mode", "tax_rate_bps"]) {
      assert.ok(!Object.hasOwn(config, field), field);
    }
    assert.equal(config.receipt_templates[0].print_copies, 2);
  }
  assert.equal(profile.config.print_copies, 1);
  const path = "/profiles/" + profile.id;
  const patch = (settings, status = 200) => adminWrite(path, "PATCH", {
    config: profileConfig(settings),
  }, status);
  await patch({ default_receipt_templates: { kitchen_receipt: receipt.id } }, 400);
  await patch({ default_receipt_templates: { receipt: "another-profile-template" } }, 400);
  await patch({ receipt_templates: [receipt, { ...khmer, id: receipt.id }] }, 400);
  await patch({ receipt_templates: [{ ...kitchen, fields: ["payments"] }] }, 400);
  await patch({ receipt_templates: [{ ...label, qr: { ...label.qr, custom_url: "javascript:alert(1)" } }] }, 400);
  await patch({ receipt_templates: [{ ...label, qr: { ...label.qr, size_mm: 51 } }] }, 400);
  await patch({ print_copies: 3 });
  assert.deepEqual((await context()).receipt_templates, templates);
  assert.deepEqual((await context()).default_receipt_templates, defaults);

  const bill = await write(token, "/sales", { lines: [coffee()] });
  assert.equal(bill.receipt.copies, 3);
  const updatedDefaults = { ...defaults, receipt: khmer.id };
  const queued = await patch({ default_receipt_templates: { receipt: khmer.id } });
  assert.deepEqual(queued.pending_config.default_receipt_templates, updatedDefaults);
  assert.deepEqual((await context()).default_receipt_templates, defaults);
  await write(token, "/sales/" + bill.id + "/cancel", { revision: bill.revision, reason: "Test" }, 200);
  assert.deepEqual((await context()).default_receipt_templates, updatedDefaults);
  const removed = await patch({ receipt_templates: [receipt, kitchen, label] });
  assert.deepEqual(removed.config.default_receipt_templates, { ...defaults, receipt: null });

  await prepare(
    "UPDATE pos_profiles SET config_json=json_remove(config_json,'$.receipt_templates','$.default_receipt_templates') WHERE id=?",
    profile.id,
  ).run();
  assert.deepEqual((await context()).receipt_templates, []);
  assert.deepEqual((await context()).default_receipt_templates, { receipt: null, kitchen_receipt: null, qr_label: null });
});

test("product POS options round-trip through the editor API and register catalog", async () => {
  const profile = await newProfile("Product POS options", { catalog_mode: "category", selected_ids: ["drinks"] });
  const token = await start(profile);
  const keys = ["allow_discount", "allow_change_price", "is_open_product", "allow_free"];
  const apiFlags = (row) => keys.map((key) => row[key]);
  const editorFlags = (row) => [row.allowDiscount, row.allowChangePrice, row.isOpenProduct, row.allowFree];
  const catalog = async (id) => (await read(token, "/catalog")).products.find((row) => row.id === id);
  assert.deepEqual(apiFlags(await catalog("coffee")), [true, true, false, true]);

  await prepare(`INSERT INTO price_lists(id,business_id,name,is_normal)
    SELECT 'product-pos-options-normal','cafe','Normal Rate',1
    WHERE NOT EXISTS (SELECT 1 FROM price_lists WHERE business_id='cafe' AND is_normal=1)`).run();
  const body = { nameKm: "Product POS options", categoryId: "coffee-category", priceCents: 3 };
  const created = await status(await request("/api/admin/products", admin, "POST", body), 201);
  const createdIds = [created.id];
  const path = `/api/admin/products/${created.id}`;
  const detail = async () => {
    const page = await status(await request(`/api/admin/catalog?productId=${created.id}`, admin), 200);
    return page.products[0];
  };
  try {
    assert.deepEqual(editorFlags(await detail()), [1, 1, 0, 1]);
    assert.deepEqual(apiFlags(await catalog(created.id)), [true, true, false, true]);
    const configured = await status(await request("/api/admin/products", admin, "POST", {
      ...body, nameKm: "Configured product", allowDiscount: false, allowChangePrice: false,
      isOpenProduct: true, allowFree: false,
    }), 201);
    createdIds.push(configured.id);
    assert.deepEqual(apiFlags(await catalog(configured.id)), [false, false, true, false]);
    await status(await request(path, admin, "PUT", {
      ...body, allowDiscount: false, allowChangePrice: false, isOpenProduct: true, allowFree: false,
    }), 200);
    assert.deepEqual(editorFlags(await detail()), [0, 0, 1, 0]);
    assert.deepEqual(apiFlags(await catalog(created.id)), [false, false, true, false]);

    // Older clients that omit POS options must preserve the saved values.
    await status(await request(path, admin, "PUT", { ...body, nameKm: "Renamed product" }), 200);
    assert.deepEqual(editorFlags(await detail()), [0, 0, 1, 0]);
    for (const field of ["allowDiscount", "allowChangePrice", "isOpenProduct", "allowFree"]) {
      await status(await request(path, admin, "PUT", { ...body, [field]: "false" }), 400);
    }
    await status(await request(path, admin, "PUT", { ...body, allowFree: null }), 400);
    assert.deepEqual(apiFlags(await catalog(created.id)), [false, false, true, false]);

    await status(await request(path, admin, "PUT", {
      ...body, allowDiscount: true, allowChangePrice: true, isOpenProduct: false, allowFree: true,
    }), 200);
    assert.deepEqual(apiFlags(await catalog(created.id)), [true, true, false, true]);
    const foreign = await status(await request("/api/auth/login", null, "POST", {
      email: emailFor("stranger"), passwordProof: proofFor(emailFor("stranger")), authVersion: version,
    }), 200);
    await status(await request(path, foreign.token, "PUT", body), 404);
  } finally {
    await prepare("DELETE FROM products WHERE business_id='cafe' AND id IN (SELECT value FROM json_each(?))", JSON.stringify(createdIds)).run();
    await prepare("DELETE FROM price_lists WHERE id='product-pos-options-normal'").run();
  }
});

test("POS catalog exposes uploaded and external menu/category photos", async () => {
  const menuProfile = await newProfile("Menu photos", {
    catalog_mode: "menu", selected_ids: ["main-menu", "food-menu"],
  });
  const categoryProfile = await newProfile("Category photos", {
    catalog_mode: "category", selected_ids: ["drinks"],
  });
  await db.batch([
    prepare("INSERT INTO media(id,business_id,object_key,filename,content_type,size_bytes) VALUES ('catalog-menu-photo','cafe','cafe/menu photos/coffee.webp','coffee.webp','image/webp',100)"),
    prepare("UPDATE menus SET image_url='https://external.test/main.jpg' WHERE id='main-menu'"),
    prepare("UPDATE menus SET image_media_id='catalog-menu-photo',image_url='https://old.test/coffee.jpg' WHERE id='coffee-menu'"),
    prepare("UPDATE categories SET image_media_id='catalog-menu-photo' WHERE id='drinks'"),
  ]);
  try {
    const menuToken = await start(menuProfile);
    const menus = (await read(menuToken, "/catalog")).nodes;
    assert.equal(menus.find(row => row.id === "main-menu").image_url, "https://external.test/main.jpg");
    assert.equal(menus.find(row => row.id === "coffee-menu").image_url, "https://media.test/cafe/menu%20photos/coffee.webp");
    assert.equal(menus.find(row => row.id === "food-menu").image_url, null);
    const scoped = await read(menuToken, "/catalog?menu_id=coffee-menu");
    assert.equal(scoped.nodes[0].image_url, "https://media.test/cafe/menu%20photos/coffee.webp");
    assert.equal("image_object_key" in scoped.nodes[0], false);
    const categories = (await read(await start(categoryProfile), "/catalog")).nodes;
    assert.equal(categories.find(row => row.id === "drinks").image_url, "https://media.test/cafe/menu%20photos/coffee.webp");
    assert.equal(categories.find(row => row.id === "coffee-category").image_url, null);
  } finally {
    await db.batch([
      prepare("UPDATE menus SET image_url=NULL,image_media_id=NULL WHERE id IN ('main-menu','coffee-menu')"),
      prepare("UPDATE categories SET image_url=NULL,image_media_id=NULL WHERE id='drinks'"),
      prepare("DELETE FROM media WHERE id='catalog-menu-photo'"),
    ]);
  }
});

test("POS catalog scopes products and nodes to a menu or submenu", async () => {
  const profile = await newProfile("Menu catalog filter", {
    catalog_mode: "menu", selected_ids: ["main-menu"],
  });
  const token = await start(profile);
  const catalog = (query = "", expected = 200) => read(token, "/catalog" + query, expected);
  await db.batch([
    prepare("INSERT INTO menus(id,business_id,parent_id,slug,name_en) VALUES ('nested-test','cafe','coffee-menu','nested-test','Nested'),('empty-test','cafe','main-menu','empty-test','Empty')"),
    prepare("INSERT INTO menu_products(business_id,menu_id,product_id) VALUES ('cafe','main-menu','coffee'),('cafe','nested-test','food-product')"),
  ]);
  try {
    const root = await catalog("?menu_id=main-menu");
    assert.deepEqual(root.products.map(row => row.id).sort(), ["coffee", "food-product"]);
    assert.deepEqual(root.products.find(row => row.id === "coffee").menu_ids.toSorted(), ["coffee-menu", "main-menu"]);
    assert.deepEqual(
      Object.fromEntries(root.nodes.map(row => [row.id, row.parent_id])),
      { "main-menu": null, "coffee-menu": "main-menu", "nested-test": "coffee-menu", "empty-test": "main-menu" },
    );
    const submenu = await catalog("?menu_id=coffee-menu");
    assert.deepEqual(
      Object.fromEntries(submenu.nodes.map(row => [row.id, row.parent_id])),
      { "coffee-menu": null, "nested-test": "coffee-menu" },
    );
    assert.deepEqual(
      Object.fromEntries(submenu.products.map(row => [row.id, row.menu_ids])),
      { coffee: ["coffee-menu"], "food-product": ["nested-test"] },
    );
    const first = await catalog("?menu_id=coffee-menu&page=1&page_size=1");
    const second = await catalog("?menu_id=coffee-menu&page=2&page_size=1");
    assert.equal(first.has_more, true);
    assert.equal(second.has_more, false);
    assert.deepEqual(first.nodes, second.nodes);
    assert.deepEqual([...first.products, ...second.products].map(row => row.id).sort(), ["coffee", "food-product"]);
    assert.deepEqual((await catalog("?menu_id=empty-test")).products, []);
    assert.deepEqual(await catalog(), root);
    await catalog("?menu_id=food-menu", 404);
    await catalog("?menu_id=missing-menu", 404);
    await catalog("?menu_id=", 400);
    const categoryProfile = await newProfile("Category without menu filter", { catalog_mode: "category" });
    await read(await start(categoryProfile), "/catalog?menu_id=main-menu", 400);
  } finally {
    await db.batch([
      prepare("DELETE FROM menu_products WHERE business_id='cafe' AND menu_id IN ('main-menu','nested-test') AND product_id IN ('coffee','food-product')"),
      prepare("DELETE FROM menus WHERE id IN ('nested-test','empty-test')"),
    ]);
  }
});

test("a POS default menu must be a selected top-level menu", async () => {
  const config = { catalog_mode: "menu", selected_ids: ["main-menu", "food-menu"] };
  const profile = await newProfile("Default menu", { ...config, default_menu_id: "main-menu" });
  const token = await start(profile);
  assert.equal(profile.config.default_menu_id, "main-menu");
  assert.equal((await read(token, "/context")).profile.config.default_menu_id, "main-menu");

  const patch = (overrides, expected) => adminWrite("/profiles/" + profile.id, "PATCH", {
    config: profileConfig({ ...config, ...overrides }),
  }, expected);
  await patch({ selected_ids: ["food-menu"], default_menu_id: "main-menu" }, 400);
  await patch({ selected_ids: ["coffee-menu"], default_menu_id: "coffee-menu" }, 400);
  await patch({ selected_ids: null, default_menu_id: "main-menu" }, 400);
  await patch({ catalog_mode: "category", selected_ids: null, default_menu_id: "main-menu" }, 400);

  const bill = await write(token, "/sales", { lines: [coffee()] });
  const pending = await patch({
    default_menu_id: "food-menu",
    receipt_template: { title: "Pending receipt", footer: "", show_tax: false },
  }, 200);
  assert.equal(pending.config.default_menu_id, "main-menu");
  assert.equal(pending.pending_config.default_menu_id, "food-menu");
  const current = (await read(token, "/context")).profile.config;
  assert.equal(current.default_menu_id, "food-menu");
  assert.notEqual(current.receipt_template.title, "Pending receipt");
  await write(token, "/sales/" + bill.id + "/cancel", { revision: bill.revision, reason: "Test" }, 200);
  assert.equal((await read(token, "/context")).profile.config.default_menu_id, "food-menu");

  await patch({ selected_ids: ["main-menu"], default_menu_id: null }, 200);
  const narrowBill = await write(token, "/sales", { lines: [coffee()] });
  await patch({ selected_ids: ["food-menu"], default_menu_id: "food-menu" }, 200);

  const menuConfig = (await read(token, "/context")).profile.config;
  assert.deepEqual(menuConfig.selected_ids, ["main-menu", "food-menu"]);
  assert.equal(menuConfig.default_menu_id, "food-menu");
  const food = await read(token, "/catalog?menu_id=food-menu");
  assert.deepEqual(food.products.map(({ id }) => id), ["food-product"]);
  const updated = await write(token, "/sales/" + narrowBill.id, {
    revision: narrowBill.revision,
    lines: [coffee(), { product_id: "food-product", quantity: 1 }],
  }, 200, randomUUID(), "PATCH");
  assert.deepEqual(updated.lines.map(({ product_id }) => product_id), ["coffee", "food-product"]);

  await write(token, "/sales/" + narrowBill.id + "/cancel", {
    revision: updated.revision, reason: "Test",
  }, 200);
  const promoted = (await read(token, "/context")).profile.config;
  assert.deepEqual(promoted.selected_ids, ["food-menu"]);
  assert.equal(promoted.default_menu_id, "food-menu");
  await read(token, "/catalog?menu_id=main-menu", 404);

  await prepare("UPDATE pos_profiles SET config_json=json_remove(config_json,'$.default_menu_id') WHERE id=?", profile.id).run();
  assert.equal((await read(token, "/context")).profile.config.default_menu_id, null);
});


test("POS sales store discounted tax levels, aggregate lines and reverse the saved amounts", async () => {
  const inclusive = { ...compoundTax, id: "inclusive", tax_mode: "inclusive" };
  const profile = await newProfile("Rule pricing", {
    working_day_enabled: false, cashier_shift_enabled: false,
    tax_rules: [compoundTax, inclusive], default_tax_rule_id: compoundTax.id,
  });
  const token = await start(profile);
  await write(token, "/sales", { lines: [coffee(1, { discount_minor: 252 })] }, 400);
  const draft = await write(token, "/sales", { lines: [coffee(4), coffee()] });
  const updated = await write(token, `/sales/${draft.id}`, {
    revision: draft.revision,
    lines: [coffee(4, { discount_minor: 104 }), coffee()],
  }, 200, randomUUID(), "PATCH");
  const amounts = (row) => Object.fromEntries(Object.keys(discountedLine).map(key => [key, row[key]]));
  assert.deepEqual(amounts(updated.lines[0]), discountedLine);
  assert.deepEqual(amounts(updated), {
    subtotal_minor: 1255, discount_minor: 104,
    tax_1_amount: 115, tax_2_amount: 69, tax_3_amount: 27,
    tax_minor: 211, total_tax_amount: 211, total_minor: 1362, total_amount: 1362,
  });
  const paid = await write(token, `/sales/${draft.id}/checkout`, {
    revision: updated.revision, expected_total_minor: 1362, payments: [cashPayment(1362)],
  }, 200);
  assert.deepEqual(amounts(paid), amounts(updated));
  assert.deepEqual(paid.tax_rule, compoundTax);
  const reversed = await write(token, `/sales/${draft.id}/reverse`, { reason: "Full refund" });
  assert.deepEqual(amounts(reversed), Object.fromEntries(Object.entries(amounts(paid)).map(([key, value]) => [key, -value])));
  assert.deepEqual(amounts(reversed.lines[0]), Object.fromEntries(Object.entries(discountedLine).map(([key, value]) => [key, -value])));
  assert.deepEqual(reversed.tax_rule, compoundTax);

  await adminWrite(`/profiles/${profile.id}`, "PATCH", {
    config: profileConfig({ default_tax_rule_id: inclusive.id }),
  }, 200);
  const inclusiveBill = await write(token, "/sales", { lines: [coffee(4)] });
  assert.deepEqual(amounts(inclusiveBill.lines[0]), {
    subtotal_minor: 852, discount_minor: 0,
    tax_1_amount: 85, tax_2_amount: 47, tax_3_amount: 20,
    tax_minor: 152, total_tax_amount: 152, total_minor: 1004, total_amount: 1004,
  });
  await write(token, `/sales/${inclusiveBill.id}/cancel`, {
    revision: inclusiveBill.revision, reason: "Test complete",
  }, 200);
});

test("line edits reprice the base with modifiers and settle complimentary items", async () => {
  const profile = await newProfile("Edited items", {
    working_day_enabled: false, cashier_shift_enabled: false,
  });
  const token = await start(profile);
  assert.equal((await read(token, "/context")).capabilities.cart_line_edits, true);
  const edited = coffee(2, {
    base_price_override_minor: 400, modifier_ids: ["less"],
    discount_minor: 20, note: "Patio order",
  });
  await write(token, "/sales", { lines: [{ ...edited, base_price_override_minor: -1 }] }, 400);
  await write(token, "/sales", { lines: [{ ...edited, is_free: true }] }, 400);
  const draft = await write(token, "/sales", { lines: [edited] });
  assert.equal(draft.lines[0].unit_price_minor, 395);
  assert.equal(draft.lines[0].base_price_override_minor, 400);
  assert.equal(draft.lines[0].note, "Patio order");
  assert.equal(draft.total_minor, 770);
  const free = await write(token, `/sales/${draft.id}`, {
    revision: draft.revision, lines: [{ ...edited, is_free: true, discount_minor: 0 }],
  }, 200, randomUUID(), "PATCH");
  assert.equal(free.lines[0].is_free, true);
  assert.equal(free.lines[0].modifiers.length, 1);
  assert.equal(free.total_minor, 0);
  const settled = await write(token, `/sales/${draft.id}/checkout`, {
    revision: free.revision, expected_total_minor: 0, payments: [],
  }, 200);
  assert.equal(settled.status, "paid");
  const reversed = await write(token, `/sales/${draft.id}/reverse`, { reason: "Test reversal" });
  assert.equal(reversed.lines[0].is_free, true);
  assert.equal(reversed.lines[0].base_price_override_minor, 400);
  assert.equal(reversed.lines[0].note, "Patio order");
});

test("POS profiles save multiple three-level tax rules and reject rates outside 0 to 100", async () => {
  const cambodia = {
    id: "cambodia-tax",
    tax_name: "Cambodia Tax",
    tax_mode: "exclusive",
    tax_1_name: "Special Tax",
    tax_1_rate: 7,
    calculate_tax_1_after_discount: true,
    tax_2_name: "Service Charge",
    tax_2_rate: 5,
    calculate_tax_2_after_adding_tax_1: true,
    calculate_tax_2_after_discount: true,
    tax_3_name: "VAT",
    tax_3_rate: 10,
    calculate_tax_3_after_adding_tax_1: true,
    calculate_tax_3_after_adding_tax_2: true,
    calculate_tax_3_after_discount: true,
  };
  const vatOnly = {
    ...cambodia,
    id: "vat-only",
    tax_name: "VAT Only",
    tax_mode: "inclusive",
    tax_1_name: "",
    tax_1_rate: 0,
    tax_2_name: "0",
    tax_2_rate: 0,
    calculate_tax_3_after_discount: false,
  };
  const noTax = { ...vatOnly, id: "no-tax", tax_name: "No Tax", tax_mode: "disabled", tax_3_rate: 0 };
  const rules = [cambodia, vatOnly, noTax];
  const profile = await newProfile("Three-level tax rules", {
    tax_rules: rules, default_tax_rule_id: vatOnly.id,
  });
  const token = await start(profile);
  const profilePath = "/profiles/" + profile.id;
  const context = async () => (await read(token, "/context")).profile.config;
  assert.deepEqual(profile.config.tax_rules, rules);
  assert.equal(profile.config.default_tax_rule_id, vatOnly.id);
  assert.deepEqual(profile.config.default_tax_rule, vatOnly);
  assert.deepEqual((await context()).default_tax_rule, vatOnly);
  assert.ok(!Object.hasOwn(await context(), "tax_mode"));
  assert.equal((await context()).default_tax_rule.tax_mode, "inclusive");
  assert.equal(profile.config.tax_mode, "disabled");
  assert.deepEqual((await context()).tax_rules, rules);

  const patch = (fields, expected = 200) => adminWrite(profilePath, "PATCH", {
    config: profileConfig(fields),
  }, expected);
  for (const rate of ["tax_1_rate", "tax_2_rate", "tax_3_rate"]) {
    const denied = await patch({ tax_rules: [{ ...cambodia, [rate]: 100.01 }] }, 400);
    assert.match(denied.error, /must be between 0 and 100/);
  }
  await patch({ tax_rules: [{ ...cambodia, tax_1_rate: -1 }] }, 400);
  await patch({ tax_rules: [{ ...cambodia, tax_2_rate: "5" }] }, 400);
  await patch({ tax_rules: [{ ...cambodia, calculate_tax_2_after_discount: "true" }] }, 400);
  assert.deepEqual((await context()).tax_rules, rules);
  await patch({ default_tax_rule_id: "another-profile-rule" }, 400);
  await patch({ tax_rules: [{ ...cambodia, tax_mode: "invalid" }] }, 400);
  await patch({ tax_rules: [cambodia, { ...vatOnly, id: cambodia.id }] }, 400);
  await patch({ print_copies: 2 });
  assert.deepEqual((await context()).tax_rules, rules);
  assert.deepEqual((await context()).default_tax_rule, vatOnly);

  const bill = await write(token, "/sales", { lines: [coffee()] });
  const changedRule = { ...cambodia, tax_name: "Cambodia updated", tax_1_rate: 7.25, tax_3_rate: 100 };
  const updatedRules = [changedRule, vatOnly];
  const updated = await patch({ tax_rules: updatedRules, default_tax_rule_id: cambodia.id });
  assert.deepEqual(updated.pending_config.tax_rules, updatedRules);
  assert.deepEqual(updated.pending_config.default_tax_rule, changedRule);
  assert.deepEqual((await context()).tax_rules, updatedRules);
  assert.deepEqual((await context()).default_tax_rule, changedRule);
  await patch({ print_copies: 2 });
  await write(token, "/sales/" + bill.id + "/cancel", { revision: bill.revision, reason: "Test" }, 200);
  assert.deepEqual((await context()).tax_rules, updatedRules);
  assert.deepEqual((await context()).default_tax_rule, changedRule);
  const renamed = { ...changedRule, tax_name: "Cambodia final", tax_mode: "inclusive" };
  await patch({ tax_rules: [renamed, vatOnly] });
  assert.deepEqual((await context()).default_tax_rule, renamed);
  await patch({ tax_rules: [vatOnly] });
  assert.equal((await context()).default_tax_rule_id, null);
  assert.equal((await context()).default_tax_rule, null);
  await patch({ default_tax_rule_id: vatOnly.id });
  await patch({ default_tax_rule_id: null });
  assert.deepEqual((await context()).tax_rules, [vatOnly]);
  assert.equal((await context()).default_tax_rule, null);
  const { id, tax_mode, ...legacy } = noTax;
  const acceptedLegacy = await patch({ tax_rules: [legacy] });
  assert.match(acceptedLegacy.config.tax_rules[0].id, /^tax_/);
  assert.equal(acceptedLegacy.config.tax_rules[0].tax_mode, "disabled");
  await prepare("UPDATE pos_profiles SET config_json=json_set(config_json,'$.tax_rules',json(?)) WHERE id=?", JSON.stringify([legacy]), profile.id).run();
  const legacyRule = (await context()).tax_rules[0];
  assert.equal(legacyRule.tax_mode, "disabled");
  assert.equal((await context()).tax_rules[0].id, legacyRule.id);
  await patch({ default_tax_rule_id: legacyRule.id });
  assert.deepEqual((await context()).default_tax_rule, legacyRule);
  await patch({ tax_rules: [] });
  assert.deepEqual((await context()).tax_rules, []);

  await prepare("UPDATE pos_profiles SET config_json=json_remove(config_json,'$.tax_rules') WHERE id=?", profile.id).run();
  assert.deepEqual((await context()).tax_rules, []);
});

test("submitted orders persist on both tables and settle or cancel in place", async () => {
  const profile = await newProfile("Submitted orders", {
    working_day_enabled: false, cashier_shift_enabled: false, table_mode: "disabled",
  });
  const token = await start(profile);
  assert.equal((await read(token, "/context")).capabilities.submit_orders, true);
  const id = randomUUID();
  const path = `/sales/${id}`;
  const command = randomUUID();
  const input = { lines: [coffee(2)] };
  const submitted = await write(token, path + "/submit", input, 201, command);
  assert.equal(submitted.id, id);
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.lines[0].status, "submitted");
  assert.equal(submitted.lines[0].quantity, 2);
  assert.deepEqual(submitted.payments, []);
  assert.deepEqual(await write(token, path + "/submit", input, 201, command), submitted);
  assert.equal(await prepare("SELECT status FROM sales WHERE id=?", id).first("status"), "submitted");
  assert.equal(await prepare("SELECT status FROM sale_products WHERE sale_id=?", id).first("status"), "submitted");
  assert.equal((await read(token, "/sales?status=submitted")).sales[0].id, id);
  assert.equal((await read(token, "/sales?history=active")).sales[0].status, "submitted");

  const secondOrder = coffee(3, { line_key: "second-coffee", order_session: "second-order" });
  const expanded = await write(token, path + "/submit", { lines: [coffee(2), secondOrder] }, 200);
  assert.equal(expanded.lines[0].id, submitted.lines[0].id);
  assert.equal(expanded.lines[0].ordered_at, submitted.lines[0].ordered_at);
  assert.notEqual(expanded.lines[0].order_session, expanded.lines[1].order_session);
  const edited = await write(token, path + "/submit", { lines: [secondOrder] }, 200);
  assert.equal(edited.voided_lines[0].id, submitted.lines[0].id);
  assert.equal(edited.voided_lines[0].status, "void");
  assert.equal(edited.lines[0].id, expanded.lines[1].id);
  assert.equal(edited.lines[0].quantity, 3);
  assert.equal(edited.lines[0].status, "submitted");
  const paid = await write(token, path + "/checkout", {
    revision: edited.revision,
    expected_total_minor: edited.total_minor,
    payments: [cashPayment(edited.total_minor)],
  }, 200);
  assert.equal(paid.id, id);
  assert.equal(paid.status, "paid");
  assert.equal(paid.lines[0].status, "paid");
  assert.equal(paid.voided_lines[0].status, "void");

  const discardedPath = `/sales/${randomUUID()}`;
  const discarded = await write(token, discardedPath + "/submit", {
    ...input,
    expected_context: { business_date: "2026-01-14", working_day_id: null, shift_id: null },
  });
  assert.equal(discarded.business_date, "2026-01-14");
  const cancelled = await write(token, discardedPath + "/cancel", {
    revision: discarded.revision, reason: "Customer cancelled",
  }, 200);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.lines[0].status, "cancelled");
});

test("active sales history pages current shift activity and carries open bills forward", async () => {
  const profile = await newProfile("Sales history", {
    working_day_enabled: false,
    cashier_shift_enabled: true,
    table_mode: "disabled",
  });
  const token = await start(profile);
  const history = (query = "") => read(token, "/sales?history=active" + query);
  assert.equal((await history()).history_scope, null);
  await read(token, "/sales?history=active&status=open", 400);

  const first = await write(token, "/cashier-shifts", {});
  const paidDraft = await write(token, "/sales", { lines: [coffee(2)] });
  await write(token, `/sales/${paidDraft.id}/checkout`, {
    revision: paidDraft.revision,
    expected_total_minor: paidDraft.total_minor,
    payments: [cashPayment(paidDraft.total_minor)],
  }, 200);
  const carryover = await write(token, "/sales", { lines: [coffee(3)] });
  const previousVoid = await write(token, "/sales", { lines: [coffee()] });
  await write(token, `/sales/${previousVoid.id}/cancel`,
    { revision: previousVoid.revision, reason: "First shift" }, 200);
  assert.equal((await history()).sales.length, 3);
  await closeShift(token, first, await reconciliation(token, first));
  assert.deepEqual((await history()).sales, []);

  const second = await write(token, "/cashier-shifts", {});
  const discarded = await write(token, "/sales", { lines: [coffee()] });
  await write(token, `/sales/${discarded.id}/cancel`,
    { revision: discarded.revision, reason: "Second shift" }, 200);
  const firstPage = await history("&page_size=1");
  const lastPage = await history("&page_size=1&page=2");
  assert.equal(firstPage.history_scope.id, second.id);
  assert.equal(firstPage.history_scope.profile_id, profile.id);
  assert.equal(firstPage.has_more, true);
  assert.equal(lastPage.has_more, false);
  const rows = [...firstPage.sales, ...lastPage.sales];
  assert.deepEqual(
    rows.map(({ id, status, item_quantity }) => [id, status, item_quantity]),
    [[discarded.id, "cancelled", 1], [carryover.id, "open", 3]],
  );
  assert.equal((await read(token, `/sales?shift_id=${first.id}`)).sales[0].id, paidDraft.id);
  await closeShift(token, second, await reconciliation(token, second));
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
    assert.deepEqual((await read(token, "/context")).profile.config.legacy_tax, {
      tax_mode: "inclusive", tax_rate_bps: 1000,
    });
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
    const history = await read(token, "/sales?history=active");
    assert.equal(history.history_scope.kind, shift ? "shift" : day ? "working_day" : "business_date");
    assert.equal(history.sales[0].id, paid.id);
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
      currency: "USD", exchange_rate: "4000", tax_mode: "exclusive", tax_rate_bps: 0,
      tax_rule: compoundTax,
      table_mode: "optional", customer_id: "walkin_cafe", customer_name: "Walk-in",
      expected_context: { business_date: opened.business_date, working_day_id: opened.id, shift_id: null },
      lines: [{
        product_id: "coffee", product_name: "Coffee", price_list_id: "",
        quantity: 4, unit_price_minor: 251, base_price_override_minor: 251,
        note: "Offline line note", ...discountedLine,
      }],
      total_minor: discountedLine.total_minor,
      payment_types: (await read(host, "/context")).payment_types,
      payments: [cashPayment(discountedLine.total_minor)],
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
  assert.equal(saved[0].lines[0].base_price_override_minor, 251);
  assert.equal(saved[0].lines[0].note, "Offline line note");
  assert.deepEqual(saved[0].tax_rule, compoundTax);
  for (const [field, amount] of Object.entries(discountedLine)) {
    assert.equal(saved[0][field], amount);
    assert.equal(saved[0].lines[0][field], amount);
  }
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
    assert.equal(receipt.guest_cover, 4);
    assert.equal(receipt.business_date, result.business_date);
    assert.equal(receipt.settled_at, result.checkout_at);
    assert.equal(receipt.shift_id, result.last_shift_id);
    assert.equal(receipt.settled_by, "cashier");
    assert.equal(receipt.lines[0].unit_price_minor, 251);
    assert.equal(receipt.lines[0].base_price_override_minor, 251);
    assert.equal(receipt.lines[0].note, "Offline table order");
    assert.deepEqual(receipt.payments.map((entry) => entry.currency), ["USD", "KHR", "KHR"]);
    assert.equal(receipt.reversed_by_sale_id, result.reversal_id);
    const reversal = await read(token, `/sales/${result.reversal_id}`);
    assert.equal(reversal.reverses_sale_id, result.server_sale_id);
    assert.equal(reversal.guest_cover, 4);
    assert.equal(reversal.working_day_id, result.reversal_day_id);
    assert.equal(reversal.shift_id, result.reversal_shift_id);
    assert.equal(reversal.settled_by, "owner");
    assert.equal(reversal.total_minor, -251);
    assert.deepEqual(reversal.payments.map(row => row.amount_minor), [-125, -6000, 960]);
    assert.deepEqual(reversal.payments.map(row => row.reverses_payment_id), receipt.payments.map(row => row.id));
    const refund = await read(token, `/cashier-shifts/${result.reversal_shift_id}`);
    assert.equal(refund.closing_counts.find(row => row.payment_type_id === cash && row.currency === "USD").expected_minor, 375);
    assert.equal(refund.closing_counts.find(row => row.payment_type_id === cashKHR && row.currency === "KHR").expected_minor, 4960);
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
  const usdCash = (await adminWrite("/payment-types", "POST", {
    name: "USD drawer", kind: "cash", currency: "USD",
  }, 201, otherAdmin)).id;
  const config = (id) => ({
    cashier_shift_enabled: true,
    table_mode: "required",
    default_payment_type_id: id,
    payment_types: [{ id, currency: "KHR" }, { id: usdCash, currency: "USD" }],
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
        { payment_type_id: usdCash, currency: "USD", amount_minor: 25 },
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
      { payment_type_id: usdCash, currency: "USD", amount_minor: 100 },
      { payment_type_id: newCash, currency: "KHR", amount_minor: 1000 },
    ],
  });
  await write(token, `/sales/${sale.id}/reverse`, {
    reason: "Refund approved",
  });
  const counts = await reconciliation(token, next);
  assert.deepEqual(
    [...counts.counts].sort((a, b) => a.currency.localeCompare(b.currency)).map((row) => [
      row.payment_type_id,
      row.currency,
      row.expected_minor,
    ]),
    [
      [newCash, "KHR", 999],
      [usdCash, "USD", 75],
    ],
  );
  await closeShift(token, next, counts);
});

test("a required table setting becomes active when the cashier closes the shift", async () => {
  const settings = { table_mode: "optional", cashier_shift_enabled: true };
  const profile = await newProfile("Table mode after shift", settings);
  const token = await start(profile);
  const shift = await write(token, "/cashier-shifts", {});
  const queued = await adminWrite(`/profiles/${profile.id}`, "PATCH", {
    config: profileConfig({ ...settings, table_mode: "required" }),
  }, 200);

  assert.equal(queued.config.table_mode, "optional");
  assert.equal(queued.pending_config.table_mode, "required");
  assert.equal((await read(token, "/context")).profile.config.table_mode, "optional");

  await closeShift(token, shift, await reconciliation(token, shift));
  const afterSignIn = await read(await start(profile), "/context");
  assert.equal(afterSignIn.profile.config.table_mode, "required");
  assert.ok(afterSignIn.profile.version > queued.version);
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
  await adminWrite(`/payment-types/${cashUsd.id}`, "PATCH", { currency: "EUR" }, 400);
  assert.equal((await adminWrite(`/payment-types/${cashUsd.id}`, "PATCH", { currency: "KHR" }, 200)).currency, "KHR");
  assert.equal((await adminWrite(`/payment-types/${cashUsd.id}`, "PATCH", { currency: "USD" }, 200)).currency, "USD");
  assert.equal((await adminWrite(`/payment-types/${cashUsd.id}`, "PATCH", { name: "USD cash" }, 200)).currency, "USD");

  const legacy = await adminWrite("/payment-types", "POST", { name: "Legacy cash", kind: "cash" });
  const legacyProfile = await newProfile("Legacy cash currency", {
    payment_types: [{ id: legacy.id, currency: "USD", allow_cash_float: true }],
    default_payment_type_id: legacy.id,
  });
  const path = "/payment-types/" + legacy.id;
  const selectRiel = await adminWrite(path, "PATCH", { currency: "KHR" }, 409);
  assert.match(selectRiel.error, /business currency/);
  assert.equal((await adminWrite(path, "GET", undefined, 200)).currency, null);

  const legacyToken = await start(legacyProfile);
  const openShift = await write(legacyToken, "/cashier-shifts", {});
  const busy = await adminWrite(path, "PATCH", { currency: "KHR" }, 409);
  assert.match(busy.error, /affected POS shifts and bills/);
  await closeShift(legacyToken, openShift, await reconciliation(legacyToken, openShift));

  assert.equal((await adminWrite(path, "PATCH", { currency: "USD" }, 200)).currency, "USD");
  const updated = await adminWrite("/profiles/" + legacyProfile.id, "GET", undefined, 200);
  assert.equal(updated.version, legacyProfile.version);
  assert.deepEqual(updated.config.payment_types, [
    { id: legacy.id, currency: "USD", allow_cash_float: true },
  ]);
  const refreshed = await read(legacyToken, "/context");
  assert.deepEqual(refreshed.payment_types.map(({ id, currency }) => ({ id, currency })), [
    { id: legacy.id, currency: "USD" },
  ]);

  const paymentTypes = [
    { id: cashUsd.id, currency: "USD" },
    { id: cashRiel.id, currency: "KHR" },
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
  assert.deepEqual(context.payment_types.map(({ id, currency }) => ({ id, currency })), paymentTypes);
  assert.ok(context.payment_types.every(type => !Object.hasOwn(type, "currencies")));
  const reorderedTypes = [...paymentTypes].reverse();
  const reordered = await adminWrite("/profiles/" + profile.id, "PATCH", {
    config: profileConfig({ payment_types: reorderedTypes, default_payment_type_id: cashUsd.id }),
  }, 200);
  assert.deepEqual(reordered.config.payment_types, reorderedTypes);
  const refreshedContext = await read(token, "/context");
  assert.deepEqual(refreshedContext.profile.config.payment_types.map(({ id }) => id), [cashRiel.id, cashUsd.id]);
  assert.deepEqual(refreshedContext.payment_types.map(({ id }) => id), [cashRiel.id, cashUsd.id]);
  assert.equal(refreshedContext.profile.config.default_payment_type_id, cashUsd.id);
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

test("payment type groups round-trip without changing historical tender kinds", async () => {
  const paymentGroups = [
    ["Cash", "cash"],
    ["Credit Card", "card"],
    ["Bank", "other"],
    ["QR Payment", "qr"],
    ["Other", "other"],
  ];
  const types = [];
  for (const [group, kind] of paymentGroups) {
    const result = await adminWrite("/payment-types", "POST", {
      name: "Group test " + group,
      payment_type_group: group,
      currency: "USD",
    });
    assert.equal(result.payment_type_group, group);
    assert.equal(result.kind, kind);
    types.push(result);
  }
  const [drawer, , bank] = types;
  const existing = await adminWrite("/payment-types/" + cash, "GET", undefined, 200);
  assert.equal(existing.payment_type_group, "Cash");
  await adminWrite("/payment-types/" + bank.id, "PATCH", { payment_type_group: "Check" }, 400);

  const profile = await newProfile("Editable payment groups", {
    cashier_shift_enabled: true,
    payment_types: [{ id: drawer.id, currency: "USD" }, { id: bank.id, currency: "USD" }],
    default_payment_type_id: drawer.id,
  });
  const token = await start(profile);
  const path = "/payment-types/" + bank.id;
  assert.equal((await read(token, "/context")).payment_types.find(({ id }) => id === bank.id).payment_type_group, "Bank");
  const duplicateCash = await adminWrite(path, "PATCH", { payment_type_group: "Cash" }, 409);
  assert.match(duplicateCash.error, /duplicate cash currency/);

  const shift = await write(token, "/cashier-shifts", {});
  const reclassified = await adminWrite(path, "PATCH", { payment_type_group: "Other" }, 200);
  assert.equal(reclassified.payment_type_group, "Other");
  assert.equal(reclassified.kind, "other");
  const busy = await adminWrite(path, "PATCH", { payment_type_group: "QR Payment" }, 409);
  assert.match(busy.error, /affected POS shifts and bills/);
  await closeShift(token, shift, await reconciliation(token, shift));

  const edited = await adminWrite(path, "PATCH", { payment_type_group: "QR Payment" }, 200);
  assert.equal(edited.kind, "qr");
  assert.equal(edited.payment_type_group, "QR Payment");
  const reloaded = await adminWrite("/profiles/" + profile.id, "GET", undefined, 200);
  assert.equal(reloaded.version, profile.version + 1);
  const historical = await prepare("SELECT payment_types_json FROM cashier_shifts WHERE id=?", shift.id)
    .first("payment_types_json");
  const savedBank = JSON.parse(historical).find((entry) => entry.id === bank.id);
  assert.equal(savedBank.kind, "other");
  assert.equal(savedBank.payment_type_group, "Bank");
});

test("cash float permissions apply per payment type for the lifetime of a shift", async () => {
  const paymentTypes = [
    { id: cash, currency: "USD", allow_cash_float: false },
    { id: cashKHR, currency: "KHR", allow_cash_float: false },
    { id: qr, currency: "USD", allow_cash_float: true },
  ];
  const profile = await newProfile("Payment type cash floats", { payment_types: paymentTypes });
  assert.equal(profile.config.cashier_shift_enabled, true);
  assert.deepEqual(profile.config.payment_types, paymentTypes);
  const token = await start(profile);
  const startup = await read(token, "/context");
  assert.deepEqual(startup.profile.config.payment_types, [
    { id: cash, payment_type: "Cash", currency: "USD", allow_cash_float: false },
    { id: cashKHR, payment_type: "KHR drawer", currency: "KHR", allow_cash_float: false },
    { id: qr, payment_type: "QR", currency: "USD", allow_cash_float: true },
  ]);
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

test("shift management keeps the count blind and preserves the previous close after reopening", async () => {
  const config = { working_day_enabled: true, cashier_shift_enabled: true };
  const profile = await newProfile("Shift review front till", config);
  const another = await newProfile("Shift review patio", config);
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);
  const manager = await start(profile);
  const cashier = await start(profile, await login("cashier"));
  const patio = await start(another);
  const day = await write(manager, "/working-days", {});
  const shift = await write(cashier, "/cashier-shifts", {
    opening_cash: [{ payment_type_id: cash, currency: "USD", amount_minor: 1000 }],
  });
  const patioShift = await write(patio, "/cashier-shifts", {});
  const shiftPath = `/cashier-shifts/${shift.id}`;
  const dayPath = `/working-days/${day.id}`;
  const readiness = await read(manager, dayPath + "/summary");
  assert.equal(readiness.register_count, 2);
  assert.ok(readiness.shifts.some((row) => row.id === patioShift.id && row.profile_name === "Shift review patio"));
  await read(cashier, dayPath + "/summary", 403);
  await read(cashier, `/cashier-shifts/${patioShift.id}/summary?scope=branch`, 404);
  const blind = await reconciliation(cashier, shift);
  assert.ok(blind.counts.length > 0);
  assert.ok(blind.counts.every((row) => !("expected_minor" in row)));
  const counts = blind.counts.map(({ payment_type_id, currency }) => ({
    payment_type_id, currency, declared_minor: payment_type_id === cash ? 700 : 0,
  }));
  const input = { activity_revision: blind.activity_revision, counts };
  const review = await write(cashier, shiftPath + "/reconciliation", input, 200);
  assert.equal(review.counts.find((row) => row.payment_type_id === cash).variance_minor, -300);
  assert.equal((await read(cashier, shiftPath + "/summary")).drawer_counts.length, 0);
  assert.equal((await read(manager, shiftPath + "/summary")).drawer_counts
    .find((row) => row.payment_type_id === cash).expected_minor, 1000);
  const key = randomUUID();
  const movement = { ...cashPayment(100), kind: "cash_in", reason: "add_change", reason_code: "add_change" };
  const saved = await write(cashier, shiftPath + "/cash-floats", movement, 201, key);
  assert.equal((await read(cashier, "/commands/" + key)).result.id, saved.id);
  assert.equal((await write(cashier, shiftPath + "/cash-floats", movement, 201, key)).id, saved.id);
  assert.equal((await write(cashier, shiftPath + "/reconciliation", input, 409)).code, "RECONCILIATION_CHANGED");
  const preview = await reconciliation(cashier, shift);
  const updated = { ...input, activity_revision: preview.activity_revision };
  const closed = await write(cashier, shiftPath + "/close", updated, 200);
  assert.equal(closed.closing_counts.find((row) => row.payment_type_id === cash).variance_minor, -400);
  assert.equal((await read(cashier, shiftPath + "/summary")).closing_counts.length, counts.length);
  await write(cashier, shiftPath + "/reopen", { reason: "Count again" }, 403);
  const reopened = await write(manager, shiftPath + "/reopen", { reason: "Count again" }, 200);
  assert.equal(reopened.closed_at, null);
  assert.equal(reopened.closing_counts.length, 0);
  assert.equal(reopened.activity_revision, updated.activity_revision + 1);
  const audit = await adminWrite("/shift-audit", "GET", undefined, 200);
  const audited = audit.events.find((row) => row.action === "close_shift" && row.reference === shift.id);
  assert.equal(JSON.parse(audited.counts_json).find((row) => row.payment_type_id === cash).variance_minor, -400);
  await closeShift(manager, shift, await reconciliation(manager, shift));
  await closeShift(patio, patioShift, await reconciliation(patio, patioShift));
  const history = await read(patio, `/cashier-shifts?closed=true&scope=branch&profile_id=${profile.id}&business_date=${day.business_date}`);
  assert.deepEqual(history.cashier_shifts.map((row) => row.id), [shift.id]);
  await write(manager, dayPath + "/close", {}, 200);
  await write(manager, shiftPath + "/reopen", { reason: "Day already closed" }, 409);
});

test("bill posting dates and counter cover follow profile settings", async () => {
  for (const workingDay of [false, true]) {
    const profile = await newProfile("Bill date " + workingDay, {
      table_mode: "disabled", working_day_enabled: workingDay,
      cashier_shift_enabled: false, prompt_guest_cover: true,
    });
    const token = await start(profile);
    const day = workingDay ? await write(token, "/working-days", {}) : null;
    const context = await read(token, "/context");
    assert.equal(context.capabilities.bill_information, true);
    const posting = "2026-01-15";
    const expected = { business_date: day?.business_date ?? context.local_date,
      working_day_id: day?.id ?? null, shift_id: null };
    await write(token, "/sales", { lines: [coffee()], posting_date: "2026-02-30", expected_context: expected }, 400);
    const bill = await write(token, "/sales", { lines: [coffee()], guest_cover: 3,
      posting_date: posting, expected_context: expected });
    assert.equal(bill.business_date, posting);
    assert.equal(bill.guest_cover, 3);
    const updated = await write(token, `/sales/${bill.id}`, { revision: bill.revision,
      note: "Keep bill information", expected_context: expected }, 200, randomUUID(), "PATCH");
    assert.equal(updated.business_date, posting);
    assert.equal(updated.guest_cover, 3);
    const paid = await write(token, `/sales/${bill.id}/checkout`, { revision: updated.revision,
      expected_total_minor: updated.total_minor, expected_context: expected,
      payments: [cashPayment(updated.total_minor)] }, 200);
    assert.equal(paid.business_date, posting);
    assert.equal(paid.guest_cover, 3);
    if (day) await write(token, `/working-days/${day.id}/close`, {}, 200);
  }
  const locked = await newProfile("Shift locks posting date", {
    table_mode: "disabled", working_day_enabled: false, cashier_shift_enabled: true,
  });
  const token = await start(locked);
  const shift = await write(token, "/cashier-shifts", { opening_cash: [cashPayment(0), cashPayment(0, "KHR")] });
  const context = await read(token, "/context");
  const rejected = await write(token, "/sales", { lines: [coffee()], posting_date: "2026-01-15",
    expected_context: { business_date: context.local_date, working_day_id: null, shift_id: shift.id } }, 409);
  assert.equal(rejected.code, "POSTING_DATE_LOCKED");
  await closeShift(token, shift, await reconciliation(token, shift));
});

test("table plan settings, real booking assignments, and guest snapshots reach the POS API", async () => {
  const name = "Table service";
  const config = {
    table_mode: "optional",
    table_group_ids: ["patio"],
    prompt_guest_cover: true,
    table_status_colors: { occupied: "#366f8c", bill_requested: "#a04614" },
  };
  await adminWrite("/profiles", "POST", {
    name,
    branch_id: main,
    config: profileConfig({ ...config, table_status_colors: { hold: "blue" } }),
  }, 400);
  const profile = await newProfile(name, config);
  const token = await start(profile);
  const context = await read(token, "/context");
  assert.equal(context.profile.config.prompt_guest_cover, true);
  assert.equal(context.profile.config.table_status_colors.occupied, "#366F8C");
  assert.equal(context.profile.config.table_status_colors.bill_requested, "#A04614");
  assert.equal(Object.keys(context.profile.config.table_status_colors).length, 5);

  const booking = "BK-1234567890ABCDEF";
  const overlapping = "BK-1234567890ABCDE0";
  const arrival = new Date(Date.now() + 10 * 60_000).toISOString();
  await db.batch([
    prepare("INSERT INTO business_booking_settings(business_id,enabled) VALUES ('cafe',1)"),
    prepare("INSERT INTO subscription_plans(id,code,name,pos_enabled,features_json) VALUES ('pos-reservations','pos-reservations','POS and bookings',1,?)", JSON.stringify(["bookings"])),
    prepare("INSERT INTO business_subscriptions(id,business_id,plan_id,status) VALUES ('pos-reservations','cafe','pos-reservations','active')"),
    ...[booking, overlapping].map((id) =>
      prepare(`INSERT INTO bookings(id,business_id,branch_id,submission_id,request_hash,arrival_date,arrival_time,arrival_at,
        timezone,pax,guest_name,guest_phone,preference,preference_text,note,status,terms_language,terms_version,terms_text)
        VALUES (?,'cafe',?,?,'test',?,?,?,'Asia/Phnom_Penh',4,'Guest','012345678','indoor','','','confirmed','en','1','Terms')`,
        id, main, id, arrival.slice(0, 10), arrival.slice(11, 16), arrival)),
  ]);
  const path = (id) => "/api/admin/bookings/" + id;
  const assignment = (id, tableId, expectedTableId = null) =>
    request(path(id) + "/table", admin, "PATCH", { tableId, expectedTableId });
  const detail = await status(await request(path(booking), admin), 200);
  assert.ok(detail.tableOptions.some(({ id }) => id === "table-a"));
  assert.ok(!detail.tableOptions.some(({ id }) => id === "table-b"));
  await status(await assignment(booking, "table-b"), 409);
  await status(await assignment(booking, "table-a"), 200);
  await status(await assignment(overlapping, "table-a"), 409);
  const table = async () => (await read(token, "/tables")).tables.find(({ id }) => id === "table-a");
  assert.equal((await table()).status, "booked");
  assert.equal((await table()).booking_pax, 4);

  const counter = await write(token, "/sales", { lines: [coffee()], guest_cover: 4 });
  assert.equal(counter.guest_cover, 4);
  await write(token, `/sales/${counter.id}/cancel`, { revision: counter.revision, reason: "Counter cover check" }, 200);
  await write(token, "/sales", { lines: [coffee()], table_id: "table-a", guest_cover: 0 }, 400);
  const bill = await write(token, "/sales", { lines: [coffee()], table_id: "table-a", guest_cover: 4 });
  assert.equal(bill.guest_cover, 4);
  assert.equal((await table()).status, "occupied");
  assert.equal((await table()).guest_cover, 4);
  const moved = await status(await request(prefix + "/sales/" + bill.id, token, "PATCH",
    { revision: bill.revision, table_id: null }, randomUUID()), 200);
  assert.equal(moved.guest_cover, null);
  assert.equal((await table()).status, "booked");
  await write(token, `/sales/${bill.id}/cancel`, { revision: moved.revision, reason: "Test" }, 200);
  await status(await assignment(booking, null, "table-a"), 200);
  assert.equal((await table()).status, "available");
});

test("Selling customer and group CRUD preserve legacy customers and enforce tenant and profile boundaries", async () => {
  const get = (path, expected = 200) => adminWrite(path, "GET", undefined, expected);
  const remove = (path, expected = 200) => adminWrite(path, "DELETE", undefined, expected);
  const legacy = await get("/customers/legacy-customer");
  assert.equal(legacy.name, "Legacy Customer");
  assert.equal(legacy.phone_number, null);
  assert.equal(legacy.customer_group_id, null);
  assert.equal(legacy.customer_code, null);
  assert.equal(legacy.is_membership, 0);
  assert.equal(legacy.allow_credit, 0);
  assert.ok((await get("/customers")).customers.some((row) => row.id === legacy.id));

  const { id: groupId } = await adminWrite("/customer-groups", "POST", { name: "Regulars" });
  const groupPath = "/customer-groups/" + groupId;
  await adminWrite("/customer-groups", "POST", { name: "regulars" }, 409);
  await prepare("INSERT INTO pos_customer_groups(id,business_id,name) VALUES ('foreign-group','other','Regulars')").run();
  await get("/customer-groups/foreign-group", 404);
  await remove("/customer-groups/foreign-group", 404);
  assert.deepEqual((await get("/customer-groups")).customer_groups, [{ id: groupId, name: "Regulars" }]);
  await adminWrite("/customers", "POST", { name: "Wrong group", customer_group_id: "foreign-group" }, 400);
  await adminWrite("/customers", "POST", { name: "Invalid date", dob: "2026-02-30" }, 400);
  const missingCode = await adminWrite("/customers", "POST", { name: "Missing code", is_membership: true }, 400);
  assert.equal(missingCode.error, "Customer code is required for membership");

  const fields = {
    name: "Customer with contact details",
    customer_code: "M-001",
    is_membership: true,
    external_reference: "reference-01",
    phone_number: "+855 012 345 678",
    address: "Phnom Penh",
    customer_group_id: groupId,
    gender: "Female",
    dob: "1996-02-29",
    email: "customer@example.test",
    photo: "https://example.test/customer.jpg",
  };
  const customer = await adminWrite("/customers", "POST", fields);
  const customerPath = "/customers/" + customer.id;
  assert.deepEqual(await get(customerPath), {
    ...fields, id: customer.id, is_walk_in: 0, is_membership: 1,
    customer_group_name: "Regulars", has_uploaded_photo: 0, allow_credit: 0,
  });
  const listCustomers = (query) => get("/customers?" + new URLSearchParams(query));
  for (const term of ["CONTACT DETAILS", "m-001", "012345678", "+855 (012) 345-678"]) {
    assert.deepEqual((await listCustomers({ search: term })).customers.map(({ id }) => id), [customer.id]);
  }
  assert.deepEqual((await listCustomers({ search: "%" })).customers, []);
  await get("/customers?sort_by=unsupported", 400);
  await get("/customers?sort_direction=unsupported", 400);

  await prepare(`INSERT INTO pos_customers(id,business_id,name,customer_code,phone_number) VALUES
      ('lookup-a','cafe','Lookup Alpha','Z-02','012 123 456'),
      ('lookup-b','cafe','Lookup Beta','A-01','098 123 456'),
      ('lookup-c','cafe','Lookup Gamma',NULL,NULL),
      ('lookup-other','other','Lookup Hidden','Z-99','012 123 456')`).run();
  try {
    const order = (query) => listCustomers({ search: "lookup", ...query });
    assert.deepEqual((await order({ sort_direction: "desc" })).customers.map(({ id }) => id),
      ["lookup-c", "lookup-b", "lookup-a"]);
    assert.deepEqual((await order({ sort_by: "phone_number", sort_direction: "asc" })).customers.map(({ id }) => id),
      ["lookup-a", "lookup-b", "lookup-c"]);
    const first = await order({ sort_by: "customer_code", sort_direction: "desc", page_size: 1, page: 1 });
    const second = await order({ sort_by: "customer_code", sort_direction: "desc", page_size: 1, page: 2 });
    const last = await order({ sort_by: "customer_code", sort_direction: "desc", page_size: 1, page: 3 });
    assert.deepEqual([first.customers[0].id, second.customers[0].id, last.customers[0].id],
      ["lookup-a", "lookup-b", "lookup-c"]);
    assert.deepEqual([first.has_more, second.has_more, last.has_more], [true, true, false]);
  } finally {
    await prepare("DELETE FROM pos_customers WHERE id IN ('lookup-a','lookup-b','lookup-c','lookup-other')").run();
  }
  const edited = await adminWrite(customerPath, "PATCH", { email: null }, 200);
  assert.equal(edited.email, null);
  assert.equal(edited.phone_number, fields.phone_number);
  assert.equal((await adminWrite(customerPath, "PATCH", { allow_credit: true }, 200)).allow_credit, 1);
  await adminWrite(customerPath, "PATCH", { allow_credit: "true" }, 400);
  assert.equal((await get(customerPath)).allow_credit, 1);
  assert.equal((await adminWrite(customerPath, "PATCH", { allow_credit: false }, 200)).allow_credit, 0);
  await adminWrite(customerPath, "PATCH", { customer_code: null }, 400);
  assert.equal((await get(customerPath)).customer_code, fields.customer_code);
  await adminWrite(customerPath, "PATCH", { customer_group_id: "foreign-group" }, 400);
  await adminWrite(groupPath, "PATCH", { name: "Returning customers" }, 200);
  assert.equal((await get(customerPath)).customer_group_name, "Returning customers");
  assert.deepEqual(await remove(groupPath), { success: true });
  await get(groupPath, 404);
  assert.equal((await get(customerPath)).customer_group_id, null);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQS0AAAAASUVORK5CYII=", "base64");
  const upload = (path, method, customerFields, bytes = png) => {
    const form = new FormData();
    form.set("customer", JSON.stringify(customerFields));
    form.set("photo", new Blob([bytes], { type: "image/png" }), "customer.png");
    const encoded = new Request("http://localhost" + setup + path, { method, body: form });
    const headers = { authorization: "Bearer " + admin, "content-type": encoded.headers.get("content-type") };
    return encoded.arrayBuffer().then((body) => runtime.dispatchFetch(encoded.url, { method, headers, body }));
  };
  const created = await status(await upload("/customers", "POST", { name: "Photo customer" }), 201);
  assert.equal(created.has_uploaded_photo, 1);
  const createdPhoto = await request(setup + "/customers/" + created.id + "/photo", admin);
  assert.equal(createdPhoto.status, 200);
  assert.deepEqual(Buffer.from(await createdPhoto.arrayBuffer()), png);
  await remove("/customers/" + created.id);
  assert.equal(await prepare("SELECT count(*) AS count FROM pos_customer_photos WHERE customer_id=?", created.id).first("count"), 0);
  await status(await upload(customerPath, "PATCH", {}, Buffer.from("not an image")), 400);
  await status(await upload(customerPath, "PATCH", { customer_code: null }), 400);
  assert.equal((await get(customerPath)).has_uploaded_photo, 0);
  const uploaded = await status(await upload(customerPath, "PATCH", {}), 200);
  assert.equal(uploaded.has_uploaded_photo, 1);
  assert.equal(uploaded.photo, null);
  const photoPath = setup + customerPath + "/photo";
  assert.equal((await request(photoPath, null)).status, 401);
  const image = await request(photoPath, admin);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  await adminWrite(customerPath, "PATCH", { is_membership: false, customer_code: null }, 200);
  assert.equal((await get(customerPath)).has_uploaded_photo, 1);
  await adminWrite(customerPath, "PATCH", { photo: null }, 200);
  assert.equal((await get(customerPath)).has_uploaded_photo, 0);
  assert.equal((await request(photoPath, admin)).status, 404);

  const profile = await newProfile("Customer defaults", { default_customer_id: customer.id });
  const token = await start(profile);
  await remove("/customers/walkin_cafe", 409);
  await remove(customerPath, 409);
  const sale = await write(token, "/sales", { customer_id: customer.id, lines: [coffee()] });
  await adminWrite("/profiles/" + profile.id, "PATCH", { config: profileConfig({ default_customer_id: null }) }, 200);
  // With an open bill, the new profile configuration is pending.
  await remove(customerPath, 409);
  await write(token, "/sales/" + sale.id + "/cancel", { revision: sale.revision, reason: "Directory test" }, 200);
  assert.deepEqual(await remove(customerPath), { success: true });
  await get(customerPath, 404);
  const savedSale = await read(token, "/sales/" + sale.id);
  assert.equal(savedSale.customer_name, fields.name);
  assert.equal(savedSale.customer_id, customer.id);
});

test("POS profile staff can manage customers and safely retry directory writes", async () => {
  const profile = await newProfile("Register customer directory");
  await adminWrite(`/profiles/${profile.id}/grants`, "PUT", { user_ids: ["cashier"] }, 200);
  const token = await start(profile, await login("cashier"));
  const group = await adminWrite("/customer-groups", "POST", { name: "Register members" });
  assert.equal((await read(token, "/context")).capabilities.customer_directory, true);
  assert.equal((await read(token, "/context")).capabilities.customer_photo_upload, true);
  assert.equal((await read(token, "/context")).capabilities.customer_credit, true);
  assert.ok((await read(token, "/customer-groups")).customer_groups.some((row) => row.id === group.id));
  await read(discovery, "/customers", 403);
  await write(token, "/customers", { name: "Missing code", is_membership: true }, 400);

  const key = randomUUID();
  const photo = {
    content_type: "image/png",
    image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQS0AAAAASUVORK5CYII=",
  };
  const fields = {
    name: "New register customer", phone_number: "012345678", customer_code: "REGISTER-123",
    is_membership: true, customer_group_id: group.id, email: "member@example.test",
    gender: "Female", dob: "1996-02-29", photo_upload: photo, allow_credit: true,
  };
  const created = await write(token, "/customers", fields, 201, key);
  const path = `/customers/${created.id}`;
  assert.deepEqual(await write(token, "/customers", fields, 201, key), created);
  assert.equal((await write(token, "/customers", { ...fields, name: "Different" }, 409, key)).code, "IDEMPOTENCY_CONFLICT");
  assert.equal((await read(token, path)).customer_group_name, group.name);
  assert.equal(created.has_uploaded_photo, 1);
  assert.equal(created.allow_credit, 1);
  assert.equal(created.photo, null);
  assert.deepEqual(await read(token, path + "/photo"), photo);
  await read(discovery, path + "/photo", 403);
  await write(token, path, { photo_upload: { ...photo, image: "invalid" } }, 400, randomUUID(), "PATCH");
  const updated = await write(token, path, { email: null }, 200, randomUUID(), "PATCH");
  assert.equal(updated.email, null);
  assert.equal(updated.customer_code, fields.customer_code);
  assert.equal(updated.is_membership, 1);
  assert.equal(updated.allow_credit, 1);
  const creditKey = randomUUID();
  const creditDisabled = await write(token, path, { allow_credit: false }, 200, creditKey, "PATCH");
  assert.equal(creditDisabled.allow_credit, 0);
  assert.deepEqual(await write(token, path, { allow_credit: false }, 200, creditKey, "PATCH"), creditDisabled);
  await write(token, path, { allow_credit: 1 }, 400, randomUUID(), "PATCH");
  assert.equal((await read(token, path)).allow_credit, 0);
  assert.equal(updated.has_uploaded_photo, 1);
  assert.equal(updated.dob, fields.dob);
  assert.equal(updated.gender, fields.gender);
  assert.equal((await write(token, path, { photo: null }, 200, randomUUID(), "PATCH")).has_uploaded_photo, 0);
  await read(token, path + "/photo", 404);
  assert.ok((await read(token, "/customers?page_size=100")).customers.some((row) => row.id === created.id));
  await write(token, "/customers/walkin_cafe", {}, 409, randomUUID(), "DELETE");

  await adminWrite(`/profiles/${profile.id}`, "PATCH", { config: profileConfig({ default_customer_id: created.id }) }, 200);
  await write(token, path, {}, 409, randomUUID(), "DELETE");
  const sale = await write(token, "/sales", { customer_id: created.id, lines: [coffee()] });
  await write(token, `/sales/${sale.id}/cancel`, { revision: sale.revision, reason: "Directory test" }, 200);
  await adminWrite(`/profiles/${profile.id}`, "PATCH", { config: profileConfig({ default_customer_id: null }) }, 200);
  const deleteKey = randomUUID();
  assert.deepEqual(await write(token, path, {}, 200, deleteKey, "DELETE"), { success: true });
  assert.deepEqual(await write(token, path, {}, 200, deleteKey, "DELETE"), { success: true });
  await read(token, path, 404);
  assert.equal((await read(token, `/sales/${sale.id}`)).customer_name, fields.name);
});
