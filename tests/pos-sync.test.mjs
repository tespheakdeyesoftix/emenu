import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { before, after, beforeEach, test } from "node:test";
import { createHash, pbkdf2Sync, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

// Use the same local runtime and SQL parser shipped with the project's Wrangler.
const require = createRequire(
  new URL("../apps/control/package.json", import.meta.url),
);
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");
const WebSocketClient = require("ws");
const root = fileURLToPath(new URL("../", import.meta.url));
process.env.WRANGLER_LOG_PATH = resolve(
  root,
  ".wrangler/pos-sync-tests/wrangler.log",
);
process.env.WRANGLER_SEND_METRICS = "false";
const { unstable_splitSqlQuery: splitSql } = require("wrangler");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const CAT = "10000000-0000-4000-8000-000000000001";
const CHILD = "10000000-0000-4000-8000-000000000002";
const PRODUCT = "20000000-0000-4000-8000-000000000001";
const PRODUCT2 = "20000000-0000-4000-8000-000000000002";
const PORTION = "30000000-0000-4000-8000-000000000001";
const PORTION2 = "30000000-0000-4000-8000-000000000002";
const POS_MENU = "40000000-0000-4000-8000-000000000001";
const POS_SECTION = "40000000-0000-4000-8000-000000000002";
let mf;
let fixtureOptions;
let db;
let key;
const telegramRequests = [];
const webhookRequests = [];
const webhookResponses = new Map();
const testAuthPepper = "isolated-test-pepper-for-telegram-settings";
let encryptLegacyTelegramToken;
let telegramStatus = 200;
const telegramStatusByChat = new Map();

async function request(path, body, token = key, method = "POST", headers = {}) {
  return mf.dispatchFetch(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
function payload(overrides = {}) {
  return {
    sync_id: randomUUID(),
    source_updated_at: "2026-11-07T00:00:00Z",
    currency: "USD",
    categories: [{ id: CAT, name_km: "ភេសជ្ជៈ", name_en: "Drinks" }],
    products: [
      {
        id: PRODUCT,
        category_id: CAT,
        name_km: "កាហ្វេ",
        name_en: "Coffee",
        price: 2.5,
      },
    ],
    ...overrides,
  };
}
async function sync(body, token = key) {
  return request("/api/integrations/pos/sync", body, token);
}
async function syncProduct(body, token = key) {
  return request("/api/integrations/pos/sync/product", body, token);
}
async function syncTables(body, token = key) {
  return request("/api/integrations/pos/sync/tables", body, token);
}
async function expectStatus(response, status) {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
async function version() {
  return db
    .prepare(
      "SELECT menu_cache_version AS value FROM businesses WHERE id='biz_a'",
    )
    .first("value");
}

before(async () => {
  const telegramModule = await build({
    entryPoints: [resolve(root, "apps/control/worker/telegramOrders.ts")],
    bundle: true, write: false, format: "esm", platform: "neutral",
  });
  const { encryptTelegramToken } = await import(
    `data:text/javascript;base64,${Buffer.from(telegramModule.outputFiles[0].contents).toString("base64")}`
  );
  encryptLegacyTelegramToken = (token) => encryptTelegramToken({ AUTH_PEPPER: testAuthPepper }, "biz_a", token);
  const directory = resolve(root, ".wrangler/pos-sync-tests");
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
  const superBundle = resolve(directory, "super-worker.mjs");
  await build({
    stdin: {
      contents: `import handler from './apps/super-control/worker/index.ts';
        export default { fetch(request, env) {
          // Only this isolated test wrapper supplies a local Access identity.
          return handler.fetch(request, env, { access: {
            getIdentity: async () => ({ email: request.headers.get('x-test-identity') })
          }});
        }};`,
      resolveDir: root,
      sourcefile: "pos-super-test-wrapper.mjs",
    },
    outfile: superBundle,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    external: ["cloudflare:workers"],
  });
  fixtureOptions = convertV4MiniflareOptions({
      cf: false,
      unsafeTriggerHandlers: true,
      workers: [
        {
          name: "control",
          modules: true,
          scriptPath: bundle,
          compatibilityDate: "2026-09-01",
          compatibilityFlags: ["global_fetch_strictly_public"],
          d1Databases: { DB: "isolated-pos-sync-tests" },
          durableObjects: { ORDER_EVENTS: { className: "OrderEvents", useSQLite: true } },
          outboundService: async (request) => {
            const url = new URL(request.url);
            if (url.hostname === "cloudflare-dns.com" && url.pathname === "/dns-query") {
              const host = url.searchParams.get("name");
              const type = Number(url.searchParams.get("type"));
              const answer = host === "private.example.com"
                ? (type === 28 ? "fd00::1" : "8.8.8.8")
                : (type === 1 ? "8.8.8.8" : null);
              return Response.json({ Status: 0, Answer: answer ? [{ type, data: answer }] : [] });
            }
            if (["new-receiver.example.com", "private.example.com"].includes(url.hostname)) {
              webhookRequests.push({
                host: url.hostname, path: url.pathname + url.search, method: request.method,
                body: await request.text(), contentType: request.headers.get("content-type"),
                authorization: request.headers.get("authorization"), apiKey: request.headers.get("x_api_key"),
                accessId: request.headers.get("cf-access-client-id"),
                idempotencyKey: request.headers.get("idempotency-key"), deliveryId: request.headers.get("x-emenu-delivery-id"),
              });
              return new Response(null, { status: 204 });
            }
            if (["receiver.example.com", "second.example.com"].includes(url.hostname)) {
              webhookRequests.push({
                host: url.hostname, path: url.pathname, method: request.method, body: await request.json(),
                eventId: request.headers.get("x-emenu-event-id"), deliveryId: request.headers.get("idempotency-key"),
                authorization: request.headers.get("authorization"),
              });
              const status = webhookResponses.get(url.pathname) ?? 204;
              return new Response(null, { status, headers: status === 302 ? { location: "https://second.example.com/redirected" } : {} });
            }
            if (url.hostname !== "api.telegram.org" || !url.pathname.endsWith("/sendMessage"))
              return new Response(null, { status: 404 });
            const body = await request.json();
            const status = telegramStatusByChat.get(body.chat_id) ?? telegramStatus;
            telegramRequests.push({ path: url.pathname, body });
            return Response.json({ ok: status === 200 }, { status });
          },
          kvNamespaces: ["CATALOG_CACHE"],
          r2Buckets: ["MEDIA"],
          bindings: {
            ALLOWED_ORIGINS: "http://localhost",
            PUBLIC_ASSET_BASE: "http://localhost/media",
            PUBLIC_MEDIA_BASE: "",
            AUTH_PEPPER: testAuthPepper,
            ADMIN_APP_URL: "http://localhost",
          },
        },
        {
          name: "super",
          modules: true,
          scriptPath: superBundle,
          compatibilityDate: "2026-09-01",
          serviceBindings: {
            CONTROL_ADMIN: { name: "control", entrypoint: "SuperAdminService" },
          },
          bindings: {
            SUPER_ADMIN_EMAIL: "super@example.test",
            ACCESS_TEAM_DOMAIN: "access.example.test",
            ACCESS_AUD: "test-audience",
          },
        },
      ],
  });
  mf = new Miniflare(fixtureOptions);
  db = await mf.getD1Database("DB", "control");
  const migrations = resolve(root, "apps/control/migrations");
  for (const name of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const statements = splitSql(
      await readFile(resolve(migrations, name), "utf8"),
    );
    await db.batch(statements.map((sql) => db.prepare(sql)));
  }
});
after(async () => {
  if (mf) await mf.dispose();
});

beforeEach(async () => {
  telegramRequests.length = 0;
  webhookRequests.length = 0;
  webhookResponses.clear();
  telegramStatus = 200;
  telegramStatusByChat.clear();
  const cache = await mf.getKVNamespace("CATALOG_CACHE", "control");
  const cachedKeys = await cache.list();
  await Promise.all(cachedKeys.keys.map(({ name }) => cache.delete(name)));
  await db.batch([
    db.prepare("DROP TRIGGER IF EXISTS pos_test_fail_price"),
    db.prepare("DROP TRIGGER IF EXISTS pos_test_fail_audit"),
    db.prepare("DELETE FROM super_admin_audit_log"),
    db.prepare("DELETE FROM businesses"),
    db.prepare("DELETE FROM users"),
    db.prepare(
      "INSERT INTO businesses (id,name,slug,currency,timezone) VALUES ('biz_a','Test A','test-a','USD','Asia/Phnom_Penh'),('biz_b','Test B','test-b','USD','Asia/Phnom_Penh')",
    ),
    db.prepare(
      "INSERT INTO users (id,email,display_name,password_hash,password_salt) VALUES ('user_a','a@example.test','A','test','test'),('user_b','b@example.test','B','test','test'),('user_editor','editor@example.test','Editor','test','test')",
    ),
    db.prepare(
      "INSERT INTO memberships (user_id,business_id,role) VALUES ('user_a','biz_a','owner'),('user_b','biz_b','owner'),('user_editor','biz_a','editor')",
    ),
    ...[
      ["user_a", "owner-a"],
      ["user_b", "owner-b"],
      ["user_editor", "editor-a"],
    ].map(([id, token]) =>
      db
        .prepare(
          "INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+1 day'))",
        )
        .bind(`session-${id}`, id, sha(token)),
    ),
    db.prepare(
      "INSERT INTO business_subscriptions (id,business_id,plan_id,source,status) VALUES ('sub_a','biz_a','plan_standard','manual','active'),('sub_b','biz_b','plan_standard','manual','active')",
    ),
    db.prepare(
      "INSERT INTO price_lists (id,business_id,name,is_normal) VALUES ('normal_a','biz_a','Normal Rate',1),('normal_b','biz_b','Normal Rate',1),('special_a','biz_a','Special',0)",
    ),
    db.prepare(
      "UPDATE businesses SET default_price_list_id=CASE id WHEN 'biz_a' THEN 'normal_a' ELSE 'normal_b' END",
    ),
    db.prepare(
      "INSERT INTO media (id,business_id,object_key,filename,content_type,size_bytes) VALUES ('media_a','biz_a','businesses/biz_a/a.webp','a.webp','image/webp',10),('media_a2','biz_a','businesses/biz_a/b.webp','b.webp','image/webp',10),('media_b','biz_b','businesses/biz_b/b.webp','b.webp','image/webp',10)",
    ),
  ]);
  const credentials = await expectStatus(
    await request(
      "/api/admin/integrations/pos",
      { name: "Test POS" },
      "owner-a",
      "PUT",
    ),
    200,
  );
  key = credentials.apiKey;
});

async function superRequest(
  businessId,
  body,
  method = "GET",
  identity = "super@example.test",
  resource = "pos-integration",
) {
  const worker = await mf.getWorker("super");
  return worker.fetch(
    `http://localhost/api/super/businesses/${businessId}${resource ? `/${resource}` : ""}`,
    {
      method,
      headers: {
        "content-type": "application/json",
        ...(identity ? { "x-test-identity": identity } : {}),
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    },
  );
}

const bookingPublic = (query = "", body, slug = "test-a") =>
  request(`/api/public/businesses/${slug}/bookings${query ? `?${query}` : ""}`, body, null, body === undefined ? "GET" : "POST");
const bookingSuper = (resource, body, method = body === undefined ? "GET" : "PUT", business = "biz_a", actor = "super@example.test") =>
  superRequest(business, body, method, actor, `booking-${resource}`);
const bookingAdmin = (suffix = "", token = "owner-a", body) =>
  request(`/api/admin/bookings${suffix}`, body, token, body === undefined ? "GET" : "PATCH");
const bookingWorkspace = async (token) => (await expectStatus(
  await request("/api/admin/workspace-access", undefined, token, "GET"), 200,
)).accessibleControlPages;
const bookingDate = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function prepareBookings(t, overrides = {}, { includePlan = true, enableBusiness = true } = {}) {
  const worker = await mf.getWorker("super");
  const planResponse = await expectStatus(await worker.fetch("http://localhost/api/super/subscription-plans", {
    headers: { "x-test-identity": "super@example.test" },
  }), 200);
  const plan = planResponse.plans.find(({ id }) => id === "plan_standard");
  const updatePlan = (features) => worker.fetch("http://localhost/api/super/subscription-plans/plan_standard", {
    method: "PUT", headers: { "content-type": "application/json", "x-test-identity": "super@example.test" },
    body: JSON.stringify({
      name: plan.name, description: plan.description, features, limits: plan.limits,
      displayOrder: plan.displayOrder, isPublic: plan.isPublic, isActive: plan.isActive,
      amountMinor: plan.amountMinor, billingInterval: plan.billingInterval,
    }),
  });
  const setPlan = async (enabled) => expectStatus(await updatePlan(
    enabled ? [...new Set([...plan.features, "bookings"])] : plan.features.filter((feature) => feature !== "bookings"),
  ), 200);
  t.after(async () => { await expectStatus(await updatePlan(plan.features), 200); });
  if (includePlan) await setPlan(true);
  const main = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND slug='main'").first("id");
  await db.batch([
    db.prepare("INSERT INTO branches (id,business_id,slug,name) VALUES ('booking_east','biz_a','east','East Branch'),('booking_foreign','biz_b','foreign','Foreign Branch')"),
    db.prepare("UPDATE businesses SET business_hours_json=? WHERE id='biz_a'").bind(JSON.stringify(
      Array.from({ length: 7 }, (_, day) => ({ day, enabled: true, open: "09:00", close: "22:00" })),
    )),
  ]);
  const settings = {
    slotMinutes: 30, noticeMinutes: 120, advanceDays: 30, minPax: 1, maxPax: 20,
    termsKm: "លក្ខខណ្ឌសម្រាប់ការកក់តុ", termsEn: "Staff will call to confirm your table.",
    branches: [
      { id: main, enabled: true, blockedDates: [] },
      { id: "booking_east", enabled: true, blockedDates: [] },
    ],
    ...overrides,
  };
  const saved = await expectStatus(await bookingSuper("settings", settings), 200);
  if (enableBusiness) await expectStatus(await bookingSuper("feature", { enabled: true }), 200);
  return { settings, saved, main, setPlan };
}

async function seedLegacyOrderAlert(botToken, chatId) {
  await db.prepare(`INSERT INTO business_telegram_notifications (business_id,enabled,chat_id,encrypted_token)
    VALUES ('biz_a',1,?,?)`).bind(chatId, await encryptLegacyTelegramToken(botToken)).run();
}

async function seedLegacyBookingAlerts(botToken, main) {
  const encryptedToken = await encryptLegacyTelegramToken(botToken);
  await db.batch([
    db.prepare("UPDATE business_booking_settings SET telegram_enabled=1,encrypted_token=? WHERE business_id='biz_a'").bind(encryptedToken),
    db.prepare("UPDATE branch_booking_settings SET chat_id='-1001234567890' WHERE business_id='biz_a' AND branch_id=?").bind(main),
    db.prepare("UPDATE branch_booking_settings SET chat_id='-1001234567891' WHERE business_id='biz_a' AND branch_id='booking_east'"),
  ]);
  return encryptedToken;
}

function guestBooking(config, overrides = {}) {
  return {
    submissionId: randomUUID(), arrivalDate: bookingDate(config.today, 1), arrivalTime: "12:00",
    pax: 4, guestName: "Test Guest", guestPhone: "+855 12 345 678",
    preference: "outdoor", preferenceText: "Covered seating", note: "Birthday",
    termsAccepted: true, termsLanguage: "en", termsVersion: config.terms.version,
    ...overrides,
  };
}

test("booking settings enforce Super Control, plan, business, and branch eligibility", async (t) => {
  const { settings, main, setPlan } = await prepareBookings(t, {}, { includePlan: false, enableBusiness: false });
  await expectStatus(await bookingSuper("settings", undefined, "GET", "biz_a", ""), 401);
  await expectStatus(await bookingSuper("feature", { enabled: true }, "PUT", "biz_a", "wrong@example.test"), 401);
  assert.equal((await expectStatus(await bookingSuper("feature"), 200)).planIncluded, false);
  await expectStatus(await bookingPublic(), 404);
  assert.equal((await expectStatus(await bookingSuper("feature", { enabled: true }), 200)).effective, false);
  await expectStatus(await bookingPublic("branch=main"), 404);
  assert.deepEqual((await expectStatus(await bookingSuper("settings"), 200)).publication, {
    enabled: true, planIncluded: false, planName: "Standard", effective: false, termsPublished: true,
  });
  await setPlan(true);
  const publicPlan = (await expectStatus(await request("/api/public/subscription-plans", undefined, null, "GET"), 200))
    .plans.find(({ id }) => id === "plan_standard");
  assert.ok(publicPlan.features.includes("bookings"));
  assert.deepEqual((await expectStatus(await bookingSuper("settings"), 200)).publication, {
    enabled: true, planIncluded: true, planName: "Standard", effective: true, termsPublished: true,
  });
  assert.deepEqual((await expectStatus(await bookingPublic(), 200)).branches.map(({ slug }) => slug), ["main", "east"]);
  await expectStatus(await bookingPublic("branch=foreign"), 404);
  await expectStatus(await bookingPublic("branch=main&branch=east"), 404);
  await expectStatus(await bookingPublic("branch=main", undefined, "test-b"), 404);
  await expectStatus(await bookingSuper("settings", { ...settings, branches: [
    ...settings.branches, { id: "booking_foreign", enabled: true, chatId: "", blockedDates: [] },
  ] }), 400);
  await expectStatus(await bookingSuper("settings", { ...settings, branches: [{ ...settings.branches[0], enabled: false }] }), 200);
  assert.deepEqual((await expectStatus(await bookingPublic(), 200)).branches.map(({ slug }) => slug), ["east"]);
  await expectStatus(await bookingPublic("branch=main"), 404);
  await db.prepare("UPDATE businesses SET custom_menu_hostname='booking-a.example.test' WHERE id='biz_a'").run();
  const domain = await expectStatus(await request("/api/public/domains/booking-a.example.test", undefined, null, "GET"), 200);
  assert.equal(domain.slug, "test-a");
  await expectStatus(await superRequest("biz_a", { previousSlug: "test-a", slug: "booking-a" }, "PATCH", "super@example.test", "slug"), 200);
  assert.equal((await expectStatus(await bookingPublic("branch=east"), 200)).branch.id, "booking_east");
  assert.equal((await expectStatus(await bookingPublic("branch=east", undefined, "booking-a"), 200)).branch.id, "booking_east");
});

test("booking publication stays unavailable until both terms are saved", async (t) => {
  const { settings } = await prepareBookings(t, { termsKm: "", termsEn: "" });
  const saved = await expectStatus(await bookingSuper("settings"), 200);
  assert.equal(saved.publication.effective, true);
  assert.equal(saved.publication.termsPublished, false);
  assert.equal(saved.branches.find(({ slug }) => slug === "main").enabled, true);
  await expectStatus(await bookingPublic(), 404);
  await expectStatus(await bookingPublic("branch=main"), 404);

  const termsEn = "Staff will call to confirm your table.";
  const oneLanguage = await expectStatus(await bookingSuper("settings", { ...settings, termsEn }), 200);
  assert.equal(oneLanguage.publication.termsPublished, false);
  await expectStatus(await bookingPublic("branch=main"), 404);

  const termsKm = "លក្ខខណ្ឌសម្រាប់ការកក់តុ";
  const bothLanguages = await expectStatus(await bookingSuper("settings", { ...settings, termsKm, termsEn }), 200);
  assert.equal(bothLanguages.publication.termsPublished, true);
  await expectStatus(await bookingPublic("branch=main"), 200);
});

test("booking settings start at 1–20 guests and retain custom limits", async (t) => {
  const defaults = await expectStatus(await bookingSuper("settings"), 200);
  assert.deepEqual([defaults.minPax, defaults.maxPax], [1, 20]);
  await expectStatus(await bookingSuper("feature", { enabled: true }), 200);
  const enabled = await expectStatus(await bookingSuper("settings"), 200);
  assert.deepEqual([enabled.minPax, enabled.maxPax], [1, 20]);

  await prepareBookings(t, { minPax: 2, maxPax: 12 });
  const custom = await expectStatus(await bookingPublic("branch=main"), 200);
  assert.deepEqual([custom.minPax, custom.maxPax], [2, 12]);
});

test("booking requests validate hours, slots, party size and terms and save one receipt per submission", async (t) => {
  const { settings } = await prepareBookings(t);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  assert.equal(config.minPax, 1);
  assert.equal(config.maxPax, 20);
  assert.equal(config.terms.km, settings.termsKm);
  assert.equal(config.terms.en, settings.termsEn);
  const form = guestBooking(config, { pax: 20, termsLanguage: "km" });
  const slots = (await expectStatus(await bookingPublic(`branch=main&date=${form.arrivalDate}`), 200)).slots;
  assert.deepEqual(slots.slice(0, 2), ["09:00", "09:30"]);
  assert.equal(slots.at(-1), "21:30");
  assert.deepEqual((await expectStatus(await bookingPublic(`branch=main&date=${bookingDate(config.today, 31)}`), 200)).slots, []);
  await expectStatus(await bookingPublic("", form), 400);
  for (const invalid of [{ guestName: "" }, { guestPhone: "no phone" }, { termsAccepted: false }, { pax: 21 }])
    await expectStatus(await bookingPublic("branch=main", { ...form, ...invalid }), 400);
  for (const invalid of [{ arrivalTime: "08:30" }, { arrivalTime: "12:15" }, { arrivalDate: bookingDate(config.today, 31) }])
    await expectStatus(await bookingPublic("branch=main", { ...form, ...invalid }), 409);

  const blockedDate = bookingDate(config.today, 2);
  await expectStatus(await bookingSuper("settings", {
    ...settings, noticeMinutes: 0, slotMinutes: 15, termsEn: "Updated booking terms",
    branches: [{ ...settings.branches[0], blockedDates: [blockedDate] }],
  }), 200);
  assert.equal((await expectStatus(await bookingPublic("branch=main", form), 409)).code, "BOOKING_TERMS_CHANGED");
  const current = await expectStatus(await bookingPublic(`branch=main&date=${form.arrivalDate}`), 200);
  assert.ok(current.slots.includes("12:15"));
  const changed = { ...form, arrivalTime: "12:15", termsVersion: current.terms.version };
  await expectStatus(await bookingPublic("branch=main", { ...changed, arrivalDate: blockedDate }), 409);
  assert.deepEqual((await expectStatus(await bookingPublic(`branch=main&date=${blockedDate}`), 200)).slots, []);
  assert.equal(await db.prepare("SELECT count(*) AS n FROM bookings").first("n"), 0);
  const responses = await Promise.all([bookingPublic("branch=main", changed), bookingPublic("branch=main", changed)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  const receipts = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(receipts[0], receipts[1]);
  const receipt = receipts[0];
  assert.equal(receipt.pax, 20);
  assert.deepEqual(Object.keys(receipt).sort(), ["arrivalDate", "arrivalTime", "branchName", "pax", "reference"]);
  assert.equal((await expectStatus(await bookingPublic("branch=main", { ...changed, note: "changed" }), 409)).code, "BOOKING_REPLAY_CONFLICT");
  const record = await db.prepare("SELECT * FROM bookings WHERE id=?").bind(receipt.reference).first();
  assert.equal(record.status, "requested");
  assert.equal(record.terms_language, "km");
  assert.equal(record.terms_text, settings.termsKm);
  assert.equal(record.arrival_at, `${form.arrivalDate}T05:15:00.000Z`);
  const second = await expectStatus(await bookingPublic("branch=main", { ...changed, submissionId: randomUUID() }), 201);
  assert.notEqual(second.reference, receipt.reference);
  assert.equal(await db.prepare("SELECT count(*) AS n FROM bookings").first("n"), 2);
  await expectStatus(await bookingSuper("settings", { ...settings, noticeMinutes: 4320, slotMinutes: 15, termsEn: "Updated booking terms" }), 200);
  assert.equal((await expectStatus(await bookingPublic("branch=main", { ...changed, submissionId: randomUUID() }), 409)).code, "BOOKING_SLOT_UNAVAILABLE");
});

test("booking list, calendar, and details enforce membership, tenant isolation, and read-only disablement", async (t) => {
  const { setPlan, main } = await prepareBookings(t);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  const receipt = await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 201);
  assert.ok((await bookingWorkspace("owner-a")).includes("bookings"));
  assert.ok(!(await bookingWorkspace("editor-a")).includes("bookings"));
  await expectStatus(await bookingAdmin(`/${receipt.reference}`, "editor-a"), 403);
  await expectStatus(await bookingSuper("feature", { userId: "user_b", canView: true }), 404);
  await expectStatus(await bookingSuper("feature", { userId: "user_editor", canView: true }), 200);
  assert.ok((await bookingWorkspace("editor-a")).includes("bookings"));
  const query = `?from=${receipt.arrivalDate}&to=${receipt.arrivalDate}&branchId=${main}`;
  const listing = await expectStatus(await bookingAdmin(query, "editor-a"), 200);
  assert.equal(listing.canManage, false);
  assert.deepEqual(listing.bookings.map(({ reference }) => reference), [receipt.reference]);
  assert.deepEqual((await expectStatus(await bookingAdmin("?branchId=booking_east"), 200)).bookings, []);
  const detailPath = `/${receipt.reference}`;
  const details = await expectStatus(await bookingAdmin(detailPath, "editor-a"), 200);
  assert.equal(details.booking.guestPhone, "+855 12 345 678");
  assert.equal(details.booking.preferenceText, "Covered seating");
  assert.equal(details.booking.note, "Birthday");
  await expectStatus(await bookingSuper("feature", { enabled: true }, "PUT", "biz_b"), 200);
  assert.equal((await expectStatus(await bookingAdmin("", "owner-b"), 200)).bookings.length, 0);
  await expectStatus(await bookingAdmin(detailPath, "owner-b"), 404);
  const statusPath = `${detailPath}/status`;
  const confirm = { expectedStatus: "requested", status: "confirmed" };
  await expectStatus(await bookingAdmin(statusPath, "editor-a", confirm), 403);
  await expectStatus(await bookingAdmin(statusPath, "owner-b", confirm), 404);
  await db.prepare("UPDATE memberships SET role='manager' WHERE user_id='user_editor'").run();
  assert.deepEqual(await expectStatus(await bookingAdmin(statusPath, "editor-a", confirm), 200), { status: "confirmed" });
  await expectStatus(await bookingAdmin(statusPath, "owner-a", { ...confirm, status: "declined" }), 409);
  for (const disable of [
    () => bookingSuper("feature", { enabled: false }).then((response) => expectStatus(response, 200)),
    () => setPlan(false),
  ]) {
    await disable();
    await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 404);
    assert.ok((await bookingWorkspace("owner-a")).includes("bookings"));
    assert.equal((await expectStatus(await bookingAdmin(query), 200)).canManage, false);
    assert.equal((await expectStatus(await bookingAdmin(detailPath), 200)).booking.status, "confirmed");
    await expectStatus(await bookingAdmin(statusPath, "owner-a", { expectedStatus: "confirmed", status: "cancelled" }), 403);
    await expectStatus(await bookingSuper("feature", { enabled: true }), 200);
  }
  await setPlan(true);
  await expectStatus(await bookingAdmin(statusPath, "owner-a", { expectedStatus: "confirmed", status: "cancelled" }), 200);
  assert.equal((await expectStatus(await bookingAdmin(query), 200)).bookings[0].status, "cancelled");
  const other = await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 201);
  const declined = await expectStatus(await bookingAdmin(`/${other.reference}/status`, "owner-a", {
    expectedStatus: "requested", status: "declined",
  }), 200);
  assert.equal(declined.status, "declined");
});

test("legacy booking alerts still use the saved bot and branch chat after Super Control edits", async (t) => {
  const botToken = `123456:${"B".repeat(35)}`;
  const orderToken = `543210:${"A".repeat(35)}`;
  const { settings, main } = await prepareBookings(t);
  const ciphertext = await seedLegacyBookingAlerts(botToken, main);
  await seedLegacyOrderAlert(orderToken, "-1001234567899");
  await expectStatus(await bookingSuper("settings/telegram-test", { branchId: "booking_east" }, "POST"), 404);
  const updated = await expectStatus(await bookingSuper("settings", {
    ...settings, noticeMinutes: 30, telegramEnabled: false, botToken: orderToken,
    branches: settings.branches.map((branch) => ({ ...branch, chatId: "-1001234567899" })),
  }), 200);
  assert.equal(updated.noticeMinutes, 30);
  assert.ok(!("telegramEnabled" in updated) && !("hasToken" in updated));
  assert.ok(updated.branches.every((branch) => !("chatId" in branch) && !("deliveryStatus" in branch)));
  assert.deepEqual(await db.prepare("SELECT telegram_enabled,encrypted_token FROM business_booking_settings WHERE business_id='biz_a'").first(),
    { telegram_enabled: 1, encrypted_token: ciphertext });

  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  const form = guestBooking(config);
  const first = await expectStatus(await bookingPublic("branch=main", form), 201);
  await expectStatus(await bookingPublic("branch=main", form), 200);
  const state = (id) => db.prepare("SELECT status,attempts,error FROM telegram_booking_deliveries WHERE booking_id=?").bind(id).first();
  await waitForState(() => state(first.reference), (row) => row?.status === "sent");
  assert.equal(telegramRequests.length, 1);
  assert.equal(telegramRequests[0].body.chat_id, "-1001234567890");
  assert.equal(telegramRequests[0].path, `/bot${botToken}/sendMessage`);
  for (const field of [first.reference, "Test A", first.arrivalDate, "12:00", "Guests: 4", "Test Guest", "+855 12 345 678", "Outdoor", "Covered seating", "Birthday"])
    assert.ok(telegramRequests[0].body.text.includes(field), field);

  telegramStatus = 429;
  const east = await expectStatus(await bookingPublic("branch=east", { ...form, submissionId: randomUUID() }), 201);
  const queued = await waitForState(() => state(east.reference), (row) => row?.error?.includes("HTTP 429"));
  assert.equal(queued.status, "pending");
  assert.equal(telegramRequests.at(-1).body.chat_id, "-1001234567891");
  await db.prepare("UPDATE telegram_booking_deliveries SET next_attempt_at=unixepoch() WHERE booking_id=?").bind(east.reference).run();
  telegramStatus = 200;
  await expectStatus(await mf.dispatchFetch(`http://localhost/cdn-cgi/local/scheduled?format=json&cron=${encodeURIComponent("* * * * *")}`), 200);
  assert.deepEqual(await state(east.reference), { status: "sent", attempts: 2, error: null });

  telegramStatus = 400;
  const failed = await expectStatus(await bookingPublic("branch=main", { ...form, submissionId: randomUUID() }), 201);
  await waitForState(() => state(failed.reference), (row) => row?.status === "failed");
  assert.equal((await expectStatus(await bookingAdmin(`/${failed.reference}`), 200)).booking.status, "requested");
});

test("subscription plans publish current prices, provision selected access, and preserve existing subscriptions", async () => {
  const worker = await mf.getWorker("super");
  const plans = (method = "GET", path = "", body, identity = "super@example.test") =>
    worker.fetch(`http://localhost/api/super/subscription-plans${path}`, {
      method,
      headers: { "content-type": "application/json", "x-test-identity": identity },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const listPublic = async () => (await expectStatus(
    await request("/api/public/subscription-plans", undefined, null, "GET"), 200,
  )).plans;
  const register = (slug, offer) => request("/api/auth/register", {
    email: `${slug}@example.test`, passwordProof: "a".repeat(64),
    authVersion: "client-pbkdf2-sha256-v1", businessName: slug, slug,
    ...(offer ? { planId: offer.id, priceId: offer.priceId } : {}),
  }, null);
  const access = async token => (await expectStatus(
    await request("/api/admin/workspace-access", undefined, token, "GET"), 200,
  )).accessibleControlPages;
  const assignment = (businessId) => db.prepare(`SELECT s.plan_id,s.price_id,s.status,s.current_period_end_at,
    s.trial_ends_at,b.subscription_plan_id FROM business_subscriptions s JOIN businesses b ON b.id=s.business_id
    WHERE s.business_id=?`).bind(businessId).first();

  await expectStatus(await plans("GET", "", undefined, ""), 401);
  const [standard] = await listPublic();
  assert.equal(standard.amountMinor, 2499);
  assert.equal(standard.pos.enabled, false);
  assert.equal(standard.features.includes("orders"), true);
  assert.equal((await assignment("biz_a")).subscription_plan_id, standard.id);
  await expectStatus(await plans("DELETE", `/${standard.id}`), 400);
  const fields = {
    name: "Starter", description: "QR basics", features: ["overview", "qrDesigns"],
    displayOrder: 0, isPublic: false, isActive: true, amountMinor: 0, billingInterval: "month",
  };
  const limits = { branches: 1, menus: 2, products: 10, dailyOrders: 20 };
  await expectStatus(await plans("POST", "", { ...fields, limits: { ...limits, branches: 0 } }), 400);
  const { id } = await expectStatus(await plans("POST", "", fields), 201);
  const hidden = (await expectStatus(await plans(), 200)).plans.find(plan => plan.id === id);
  assert.equal(hidden.isPublic, false);
  assert.equal((await listPublic()).some(plan => plan.id === id), false);
  assert.equal((await expectStatus(await register("hidden-plan", hidden), 409)).code, "PLAN_UNAVAILABLE");
  const published = { ...fields, isPublic: true };
  await expectStatus(await plans("PUT", `/${id}`, { ...published, limits }), 200);
  const free = (await listPublic()).find(plan => plan.id === id);
  assert.equal(free.priceId, hidden.priceId);
  assert.equal(free.amountMinor, 0);
  assert.deepEqual(free.limits, limits);
  const registeredFree = await expectStatus(await register("free-plan", free), 201);
  const freeBefore = await assignment(registeredFree.business.id);
  assert.equal(freeBefore.plan_id, id);
  assert.equal(freeBefore.subscription_plan_id, id);
  assert.equal(freeBefore.status, "active");
  assert.equal(freeBefore.current_period_end_at, null);
  assert.deepEqual(await access(registeredFree.token), ["overview", "qrDesigns"]);
  await expectStatus(await request("/api/admin/tables", undefined, registeredFree.token, "GET"), 200);
  await expectStatus(await request("/api/admin/tables", {}, registeredFree.token), 403);
  await expectStatus(await request("/api/admin/orders", undefined, registeredFree.token, "GET"), 403);

  const paidFields = { ...published, features: ["overview", "orders"], amountMinor: 19900, billingInterval: "year" };
  await expectStatus(await plans("PUT", `/${id}`, paidFields), 200);
  const paid = (await listPublic()).find(plan => plan.id === id);
  assert.equal(paid.amountMinor, 19900);
  assert.equal(paid.billingInterval, "year");
  assert.notEqual(paid.priceId, free.priceId);
  assert.deepEqual(paid.limits, limits);
  assert.deepEqual(await assignment(registeredFree.business.id), freeBefore);
  assert.deepEqual(await access(registeredFree.token), ["overview", "orders"]);
  assert.equal((await expectStatus(await register("stale-plan", free), 409)).code, "PLAN_UNAVAILABLE");
  assert.equal(await db.prepare("SELECT id FROM businesses WHERE slug='stale-plan'").first(), null);

  const registeredPaid = await expectStatus(await register("paid-plan", paid), 201);
  const paidBefore = await assignment(registeredPaid.business.id);
  assert.equal(paidBefore.status, "trialing");
  assert.equal(paidBefore.trial_ends_at, paidBefore.current_period_end_at);
  assert.ok(Math.abs(Date.parse(paidBefore.trial_ends_at) - Date.now() - 30 * 864e5) < 60_000);
  const legacy = await expectStatus(await register("legacy-plan"), 201);
  assert.equal((await assignment(legacy.business.id)).plan_id, standard.id);
  const legacyDetail = await expectStatus(await superRequest(legacy.business.id, undefined, "GET", "super@example.test", ""), 200);
  assert.deepEqual(legacyDetail.business.disabledControlPages, ["sellingOverview", "posProfiles", "posPaymentTypes"]);
  for (const page of ["overview", "profiles", "payment-types"]) {
    const blocked = await expectStatus(await request("/api/admin/pos/" + page, undefined, legacy.token, "GET"), 403);
    assert.equal(blocked.code, "CONTROL_PAGE_DISABLED");
  }

  await expectStatus(await superRequest(registeredPaid.business.id, { disabledControlPages: ["orders"] },
    "PUT", "super@example.test", "control-pages"), 200);
  assert.deepEqual(await access(registeredPaid.token), ["overview"]);
  await expectStatus(await superRequest(registeredPaid.business.id, { planId: standard.id, priceId: standard.priceId },
    "PUT", "super@example.test", "subscription-plan"), 200);
  const paidAfter = await assignment(registeredPaid.business.id);
  assert.equal(paidAfter.plan_id, standard.id);
  assert.equal(paidAfter.subscription_plan_id, standard.id);
  assert.equal(paidAfter.price_id, standard.priceId);
  assert.equal(paidAfter.status, paidBefore.status);
  assert.equal(paidAfter.current_period_end_at, paidBefore.current_period_end_at);
  assert.equal((await access(registeredPaid.token)).includes("orders"), false);

  assert.deepEqual(await expectStatus(await plans("DELETE", `/${id}`), 200), { archived: true });
  assert.equal((await listPublic()).some(plan => plan.id === id), false);
  assert.deepEqual(await assignment(registeredFree.business.id), freeBefore);
  assert.deepEqual(await access(registeredFree.token), ["overview", "orders"]);
  const unused = await expectStatus(await plans("POST", "", { ...fields, name: "Unused" }), 201);
  assert.deepEqual(await expectStatus(await plans("DELETE", `/${unused.id}`), 200), { archived: false });
  assert.equal((await expectStatus(await plans(), 200)).plans.some(plan => plan.id === unused.id), false);
  const audit = await db.prepare("SELECT DISTINCT action FROM super_admin_audit_log WHERE action LIKE 'subscription.plan_%' ORDER BY action").all();
  assert.deepEqual(audit.results.map(row => row.action), [
    "subscription.plan_assigned", "subscription.plan_created", "subscription.plan_removed", "subscription.plan_updated",
  ]);
});

test("plan limits count saved branches, menus and products and allow POS updates at capacity", async () => {
  await db.batch([
    db.prepare(`INSERT INTO subscription_plans (id,code,name,features_json,max_branches,max_menus,max_products)
      SELECT 'plan_cap','cap','Cap test',features_json,1,2,1 FROM subscription_plans WHERE id='plan_standard'`),
    db.prepare("UPDATE business_subscriptions SET plan_id='plan_cap' WHERE business_id='biz_a'"),
  ]);
  const branch = await expectStatus(await superRequest("biz_a", { name: "New Branch", slug: "new-branch" },
    "POST", "super@example.test", "branches"), 409);
  assert.equal(branch.code, "PLAN_BRANCH_LIMIT");
  const createMenu = (nameEn, parentId = null) => request("/api/admin/menus", { nameEn, parentId }, "owner-a");
  const main = await expectStatus(await createMenu("Main"), 201);
  await expectStatus(await createMenu("Submenu", main.id), 201);
  assert.equal((await expectStatus(await createMenu("Over quota"), 409)).code, "PLAN_MENU_LIMIT");
  assert.equal((await expectStatus(await sync(payload({
    menus: [{ id: POS_MENU, name_en: "POS menu" }], menu_products: [],
  })), 409)).code, "PLAN_MENU_LIMIT");
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM products WHERE business_id='biz_a'").first("count"), 0);

  const catalog = payload();
  await expectStatus(await sync(catalog), 200);
  await expectStatus(await syncProduct({ product: { id: PRODUCT, name_en: "New name" } }), 200);
  const blocked = await expectStatus(await request("/api/admin/products",
    { nameKm: "Tea", categoryId: CAT, priceCents: 2 }, "owner-a"), 409);
  assert.equal(blocked.code, "PLAN_PRODUCT_LIMIT");
  const extra = { ...catalog.products[0], id: PRODUCT2, name_en: "Extra" };
  const nextCatalog = payload({ source_updated_at: "2026-11-07T00:01:00Z", products: [extra] });
  assert.equal((await expectStatus(await sync(nextCatalog), 409)).code, "PLAN_PRODUCT_LIMIT");
  assert.equal(await db.prepare("SELECT name_en FROM products WHERE id=?").bind(PRODUCT).first("name_en"), "New name");
  await expectStatus(await request(`/api/admin/products/${PRODUCT}`, undefined, "owner-a", "DELETE"), 200);
  await expectStatus(await sync(nextCatalog), 200);
});

test("Windows POS subscription quota is isolated by business ID", {
  skip: process.platform !== "win32" || !process.env.POS_FLUTTER_EXECUTABLE,
}, async () => {
  const superWorker = await mf.getWorker("super");
  const plans = (method, suffix = "", body) => superWorker.fetch(
    `http://localhost/api/super/subscription-plans${suffix}`, {
      method,
      headers: { "content-type": "application/json", "x-test-identity": "super@example.test" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const getPlans = async () => (await expectStatus(await plans("GET"), 200)).plans;
  const standard = (await getPlans()).find(plan => plan.id === "plan_standard");
  const selected = offer => ({ planId: offer.id, priceId: offer.priceId });
  const { id: planId } = await expectStatus(await plans("POST", "", {
    name: "Temporary Windows POS quota",
    description: "",
    features: standard.features,
    amountMinor: 0,
    billingInterval: "month",
    displayOrder: 0,
    isActive: true,
    isPublic: false,
    pos: { enabled: true, profiles: 1, dailySales: 1 },
  }), 201);
  const plan = (await getPlans()).find(offer => offer.id === planId);
  assert.deepEqual(plan.pos, { enabled: true, profiles: 1, dailySales: 1 });

  const password = randomUUID();
  const authVersion = "client-pbkdf2-sha256-v1";
  const fixtures = [];
  const pos = "/api/integrations/pos/v1";
  const posSetup = "/api/admin/pos";
  const setPlan = (business, offer) => superRequest(
    business.id, selected(offer), "PUT", "super@example.test", "subscription-plan",
  );
  const subscription = (id) => db.prepare(
    "SELECT plan_id,price_id,status,current_period_end_at FROM business_subscriptions WHERE business_id=?",
  ).bind(id).first();

  try {
    for (const tenant of ["a", "b"]) {
      const slug = `pos-quota-${tenant}-${randomUUID().slice(0, 8)}`;
      const email = `${slug}@example.test`;
      const passwordProof = pbkdf2Sync(
        password, `angkor-emenu:${authVersion}:${email}`, 120_000, 32, "sha256",
      ).toString("hex");
      const registered = await expectStatus(await request("/api/auth/register", {
        email, passwordProof, authVersion, businessName: slug, slug, ...selected(standard),
      }, null), 201);
      const { id } = registered.business;
      const adminToken = registered.token;
      const business = { id, slug, email, ownerId: registered.user.id, adminToken, original: await subscription(id) };
      fixtures.push(business);
      await expectStatus(await setPlan(business, plan), 200);
      assert.equal((await subscription(id)).plan_id, planId);
      const sidebar = (disabledControlPages) => superRequest(
        id, { disabledControlPages }, "PUT", "super@example.test", "control-pages",
      );
      business.restoreSidebar = () => sidebar(["sellingOverview", "posProfiles", "posPaymentTypes"]);
      await expectStatus(await sidebar([]), 200);

      const branch = await db.prepare("SELECT id FROM branches WHERE business_id=? AND is_default=1").bind(id).first("id");
      const { branches } = await expectStatus(await superRequest(
        id, { name: "Second branch", slug: "second-branch" }, "POST", "super@example.test", "branches",
      ), 200);
      const secondBranch = branches.find(row => row.slug === "second-branch").id;
      const category = randomUUID();
      await db.batch([
        db.prepare("UPDATE businesses SET currency='USD' WHERE id=?").bind(id),
        db.prepare("INSERT INTO categories(id,business_id,name,slug) VALUES (?,?,'Drinks','drinks')").bind(category, id),
        db.prepare(`INSERT INTO products(id,business_id,category_id,name,name_en,slug,price_cents)
          VALUES (?,?,?,'Quota coffee','Quota coffee','quota-coffee',2.5)`).bind(randomUUID(), id, category),
      ]);
      const cash = await expectStatus(await request(posSetup + "/payment-types", {
        name: "Cash", kind: "cash",
      }, adminToken), 201);
      const addProfile = (branchId) => request(posSetup + "/profiles", {
        name: "Quota till",
        branch_id: branchId,
        config: {
          table_mode: "disabled",
          payment_types: [{ id: cash.id, currencies: ["USD"] }],
          default_payment_type_id: cash.id,
        },
      }, adminToken);
      business.profileId = (await expectStatus(await addProfile(branch), 201)).id;
      assert.equal((await expectStatus(await addProfile(secondBranch), 409)).code, "PLAN_POS_PROFILE_LIMIT");

      const { token: discovery } = await expectStatus(await request(pos + "/auth/login", {
        business_slug: slug, email, password_proof: passwordProof, auth_version: authVersion,
      }, null), 200);
      business.discovery = discovery;
      const { token } = await expectStatus(await request(pos + "/sessions", { profile_id: business.profileId }, discovery), 201);
      business.posToken = token;
    }

    const origin = (await mf.ready).origin;
    assert.equal(new URL(origin).hostname, "127.0.0.1");
    const shell = resolve(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const { stdout } = await promisify(execFile)(shell, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
      "& $env:POS_FLUTTER_EXECUTABLE test -d windows --no-pub --reporter expanded integration_test/windows_register_test.dart; exit $LASTEXITCODE",
    ], {
      cwd: resolve(root, "apps/pos"),
      timeout: 420_000,
      env: {
        ...process.env,
        POS_NATIVE_QUOTA_FIXTURE: JSON.stringify({
          origin, password, businesses: fixtures.map(({ id, slug, email, ownerId, profileId }) => ({ id, slug, email, ownerId, profileId })),
        }),
      },
    });
    assert.match(stdout, /All tests passed/);
    console.log(stdout);

    for (const business of fixtures) {
      const foreign = fixtures.find(row => row.id !== business.id);
      const read = (path, token = business.posToken) => request(pos + path, undefined, token, "GET");
      const { profiles } = await expectStatus(await read("/profiles", business.discovery), 200);
      assert.deepEqual(profiles.map(profile => profile.id), [business.profileId]);
      await expectStatus(await request(pos + "/sessions", { profile_id: foreign.profileId }, business.discovery), 404);
      await expectStatus(await request(posSetup + `/profiles/${foreign.profileId}`, undefined, business.adminToken, "GET"), 404);
      const { sales } = await expectStatus(await read("/sales?status=paid"), 200);
      assert.equal(sales.length, 1);
      assert.equal(sales[0].profile_id, business.profileId);
      business.saleId = sales[0].id;
      const { results } = await db.prepare(`SELECT id,business_id,profile_id,status,business_date FROM sales
        WHERE business_id=? ORDER BY status`).bind(business.id).all();
      assert.deepEqual(results.map(row => [row.business_id, row.profile_id, row.status]), [
        [business.id, business.profileId, "open"], [business.id, business.profileId, "paid"],
      ]);
      assert.equal(results[0].business_date, results[1].business_date);
      assert.equal(await db.prepare("SELECT count(*) FROM sale_payments WHERE sale_id=?").bind(results[0].id).first("count(*)"), 0);
    }
    for (const business of fixtures) {
      const foreign = fixtures.find(row => row.id !== business.id);
      await expectStatus(await request(pos + `/sales/${foreign.saleId}`, undefined, business.posToken, "GET"), 404);
    }
  } finally {
    for (const business of fixtures) {
      await expectStatus(await setPlan(business, standard), 200);
      assert.deepEqual(await subscription(business.id), business.original);
      if (business.restoreSidebar) await expectStatus(await business.restoreSidebar(), 200);
    }
    assert.deepEqual(await expectStatus(await plans("DELETE", `/${planId}`), 200), { archived: false });
  }
});

async function prepareNotificationCheckout() {
  await expectStatus(await sync(payload()), 200);
  await db.batch([
    db.prepare("UPDATE businesses SET latitude=0,longitude=0,enable_submit_order=1 WHERE id='biz_a'"),
    db.prepare("INSERT INTO table_groups (id,business_id,name) VALUES ('notify_group','biz_a','Main')"),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
      VALUES ('notify_table','biz_a','notify_group','T01','Table 1','notify_scan')`),
  ]);
  return {
    submissionId: randomUUID(), deviceId: randomUUID(), tableToken: "notify_scan", tableId: "notify_table",
    latitude: 0, longitude: 0, expectedCurrency: "USD",
    items: [{ productId: PRODUCT, expectedPrice: 2.5, quantity: 2, note: "Less ice" }],
  };
}

const webhookApi = (branchId, suffix = "", body, method = "GET", business = "biz_a", actor = "super@example.test") =>
  superRequest(business, body, method, actor, `branches/${branchId}/webhooks${suffix}`);
const webhookConfig = (overrides = {}) => ({
  name: "Order webhook", table: "orders", event: "inserted", url: "https://receiver.example.com/orders",
  method: "POST", filter: [], body: { id: "{{record.id}}", status: "{{record.status}}" }, ...overrides,
});
const webhookList = async (branchId) => (await expectStatus(await webhookApi(branchId), 200)).rules;
const webhookHistory = async (branchId) => (await expectStatus(await webhookApi(branchId, "/deliveries"), 200)).deliveries;
async function addWebhook(branchId, overrides = {}, enabled = true) {
  const { id } = await expectStatus(await webhookApi(branchId, "", webhookConfig(overrides), "POST"), 201);
  if (enabled) await expectStatus(await webhookApi(branchId, `/${id}`, { revision: 1, enabled: true }, "PATCH"), 200);
  return id;
}
async function untilWebhook(check) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await check();
    if (result) return result;
    await delay(50);
  }
  assert.fail("Webhook work did not reach the expected state");
}
async function runWebhookCron() {
  const cron = encodeURIComponent("* * * * *");
  const response = await mf.dispatchFetch(`http://localhost/cdn-cgi/local/scheduled?cron=${cron}`);
  assert.equal(response.status, 200, await response.text());
}

test("branch webhook rules validate payloads, hide headers, and deliver committed order and booking events", async (t) => {
  const { main } = await prepareBookings(t);
  const checkout = await prepareNotificationCheckout();
  await expectStatus(await webhookApi(main, "", undefined, "GET", "biz_a", ""), 401);
  await expectStatus(await webhookApi(main, "", undefined, "GET", "biz_b"), 404);
  const foreign = await expectStatus(await webhookApi("booking_foreign", "", webhookConfig({
    name: "Another business", url: "https://second.example.com/foreign",
  }), "POST", "biz_b"), 201);
  await expectStatus(await webhookApi("booking_foreign", `/${foreign.id}`, { revision: 1, enabled: true }, "PATCH", "biz_b"), 200);
  for (const url of [
    "http://receiver.example.com/orders", "https://receiver.example.internal/orders",
    "https://127.0.0.1/orders", "https://receiver.example.com:8443/orders",
    "https://secret@receiver.example.com/orders",
  ]) await expectStatus(await webhookApi(main, "", webhookConfig({ url }), "POST"), 400);
  for (const overrides of [
    { headers: { "X-EMenu-Delivery-Id": "wrong" } },
    { filter: [{ field: "submission_hash", op: "eq", value: "private" }] },
    { filter: [{ field: "status", op: "changed" }] },
    { body: { old: "{{previous.status}}" } },
    { table: "bookings", body: { phone: "{{record.guestPhone}}" } },
  ]) await expectStatus(await webhookApi(main, "", webhookConfig(overrides), "POST"), 400);

  const created = await addWebhook(main, {
    name: "Order create", enabled: true, headers: { Authorization: "Bearer isolated-test-secret" },
    filter: [{ field: "status", op: "eq", value: "submitted" }, { field: "totalQuantity", op: "in", value: [2] }],
    body: { id: "{{record.id}}", branch: "{{branchId}}", quantity: "{{record.totalQuantity}}", items: "{{record.items}}" },
  }, false);
  const [savedRule] = await webhookList(main);
  assert.equal(savedRule.enabled, false);
  assert.deepEqual(savedRule.headerNames, ["authorization"]);
  assert.doesNotMatch(JSON.stringify(savedRule), /isolated-test-secret|ciphertext/i);
  assert.doesNotMatch(await db.prepare("SELECT headers_ciphertext FROM branch_webhook_revisions WHERE webhook_id=?")
    .bind(created).first("headers_ciphertext"), /isolated-test-secret/);
  await expectStatus(await webhookApi("booking_east", `/${created}`, { revision: 1, enabled: true }, "PATCH"), 404);
  await expectStatus(await webhookApi(main, `/${created}`, { revision: 1, enabled: true }, "PATCH"), 200);
  await addWebhook(main, {
    name: "Status change", event: "updated", url: "https://receiver.example.com/status", method: "PATCH",
    filter: [{ field: "status", op: "changed" }, { field: "status", op: "neq", value: "cancelled" }],
    body: { previous: "{{previous.status}}", status: "{{record.status}}" },
  });
  await addWebhook(main, {
    name: "Guest booking", table: "bookings", url: "https://second.example.com/booking", includeBookingContact: true,
    body: { id: "{{record.id}}", pax: "{{record.pax}}", phone: "{{record.guestPhone}}" },
  });
  await addWebhook(main, {
    name: "Booking state", table: "bookings", event: "updated", url: "https://second.example.com/booking-status",
    filter: [{ field: "status", op: "changed" }], body: { previous: "{{previous.status}}", status: "{{record.status}}" },
  });
  const submit = (body) => request("/api/public/businesses/test-a/orders", body, null);
  const order = await expectStatus(await submit(checkout), 201);
  await expectStatus(await submit(checkout), 200);
  await expectStatus(await request(`/api/admin/orders/${order.orderId}`, { status: "accepted" }, "owner-a", "PATCH"), 200);
  await expectStatus(await request(`/api/admin/orders/${order.orderId}`, { status: "accepted" }, "owner-a", "PATCH"), 200);
  await expectStatus(await request(`/api/integrations/pos/orders/${order.orderId}`, { status: "completed" }, key, "PATCH"), 200);
  await expectStatus(await request(`/api/integrations/pos/orders/${order.orderId}`, { status: "cancelled" }, key, "PATCH"), 409);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  const form = guestBooking(config);
  const booking = await expectStatus(await bookingPublic("branch=main", form), 201);
  await expectStatus(await bookingPublic("branch=main", form), 200);
  await expectStatus(await bookingAdmin(`/${booking.reference}/status`, "owner-a",
    { expectedStatus: "requested", status: "confirmed" }), 200);
  await expectStatus(await bookingAdmin(`/${booking.reference}/status`, "owner-a",
    { expectedStatus: "requested", status: "declined" }), 409);
  const eastConfig = await expectStatus(await bookingPublic("branch=east"), 200);
  await expectStatus(await bookingPublic("branch=east", guestBooking(eastConfig)), 201);
  for (let turn = 0; turn < 4; turn++) await runWebhookCron();
  const history = await untilWebhook(async () => {
    const rows = await webhookHistory(main);
    return rows.length === 5 && rows.every(row => row.status === "succeeded") && rows;
  });
  assert.equal(webhookRequests.length, 5);
  assert.equal(history.length, 5);
  assert.deepEqual(await webhookHistory("booking_east"), []);
  assert.deepEqual((await expectStatus(await webhookApi("booking_foreign", "/deliveries", undefined, "GET", "biz_b"), 200)).deliveries, []);
  const submitted = webhookRequests.find(row => row.path === "/orders");
  assert.equal(submitted.authorization, "Bearer isolated-test-secret");
  assert.equal(submitted.body.id, order.orderId);
  assert.equal(submitted.body.branch, main);
  assert.equal(submitted.body.quantity, 2);
  assert.equal(submitted.body.items[0].productId, PRODUCT);
  assert.equal(submitted.body.items[0].note, "Less ice");
  assert.deepEqual(webhookRequests.filter(row => row.path === "/status").map(row => [row.method, row.body]), [
    ["PATCH", { previous: "submitted", status: "accepted" }], ["PATCH", { previous: "accepted", status: "completed" }],
  ]);
  assert.deepEqual(webhookRequests.find(row => row.path === "/booking").body,
    { id: booking.reference, pax: 4, phone: form.guestPhone });
  assert.deepEqual(webhookRequests.find(row => row.path === "/booking-status").body,
    { previous: "requested", status: "confirmed" });
  assert.equal(new Set(webhookRequests.map(row => row.eventId)).size, 5);
  assert.equal(new Set(webhookRequests.map(row => row.deliveryId)).size, 5);
  assert.equal(await db.prepare("SELECT count(*) AS n FROM super_admin_audit_log WHERE action LIKE 'branch.webhook.%' AND business_id='biz_a'").first("n"), 8);
});

test("branch webhooks accept new public hosts, custom headers, and different body formats", async () => {
  const checkout = await prepareNotificationCheckout();
  const main = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND slug='main'").first("id");
  await addWebhook(main, {
    name: "Form body", url: "https://new-receiver.example.com/form?source=menu",
    headers: { Authorization: "Bearer fixture", "Content-Type": "application/x-www-form-urlencoded",
      X_API_KEY: "custom-key", "CF-Access-Client-Id": "fixture-access", "Idempotency-Key": "receiver-key" },
    bodyFormat: "text", body: "id={{record.id}}&status={{record.status}}&label=A%20B",
  });
  await addWebhook(main, {
    name: "JSON scalar", url: "https://new-receiver.example.com/scalar", body: 42,
    headers: { "Content-Type": "application/vnd.fixture+json" },
  });
  await addWebhook(main, {
    name: "Query only", url: "https://new-receiver.example.com/ping?source=menu",
    method: "GET", bodyFormat: "none", body: null,
  });
  await addWebhook(main, {
    name: "Private DNS", url: "https://private.example.com/blocked",
    headers: { Authorization: "Bearer do-not-send" },
  });
  const order = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
  const history = await untilWebhook(async () => {
    const rows = await webhookHistory(main);
    return rows.filter(row => row.status === "succeeded").length === 3 &&
      rows.some(row => row.status === "failed") && rows;
  });
  assert.equal(history.find(row => row.ruleName === "Private DNS").error, "The destination resolves to a non-public address.");
  assert.equal(webhookRequests.length, 3);
  const form = webhookRequests.find(row => row.path === "/form?source=menu");
  assert.deepEqual(form, {
    host: "new-receiver.example.com", path: "/form?source=menu", method: "POST",
    body: `id=${order.orderId}&status=submitted&label=A%20B`, contentType: "application/x-www-form-urlencoded",
    authorization: "Bearer fixture", apiKey: "custom-key", accessId: "fixture-access",
    idempotencyKey: "receiver-key", deliveryId: history.find(row => row.ruleName === "Form body").id,
  });
  const scalar = webhookRequests.find(row => row.path === "/scalar");
  assert.equal(scalar.body, "42");
  assert.equal(scalar.contentType, "application/vnd.fixture+json");
  const get = webhookRequests.find(row => row.path === "/ping?source=menu");
  assert.equal(get.method, "GET");
  assert.equal(get.body, "");
  assert.equal(get.contentType, null);
});

test("branch webhooks deliver over HTTP only to local addresses in development", async () => {
  const checkout = await prepareNotificationCheckout();
  const branch = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND slug='main'").first("id");
  const received = [];
  const receiver = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({ path: request.url, body: Buffer.concat(chunks).toString(), authorization: request.headers.authorization });
    if (request.url === "/redirect") response.writeHead(302, { location: "/followed" });
    else response.writeHead(204);
    response.end();
  });
  await new Promise((resolve, reject) => receiver.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = receiver.address().port;
  const local = `http://127.0.0.1:${port}/orders?source=menu`;
  const lan = "http://192.168.10.19:1216/receive";
  const save = (url) => webhookApi(branch, "", webhookConfig({ url }), "POST");
  const [control, ...workers] = fixtureOptions.workers;
  try {
    await expectStatus(await save(local), 400);
    await expectStatus(await save(lan), 400);
    await mf.setOptions({
      ...fixtureOptions,
      workers: [{
        config: {
          ...control.config,
          env: { ...control.config.env, WEBHOOK_ALLOW_LOCAL_HTTP: { type: "text", value: "true" } },
        },
        dev: { ...control.dev, outboundService: undefined },
      }, ...workers],
    });
    db = await mf.getD1Database("DB", "control");
    for (const url of [lan, "http://localhost:1216/receive", "http://[::1]:1216/receive"]) {
      await expectStatus(await save(url), 201);
    }
    for (const url of ["http://example.com:1216/hook", "http://169.254.169.254/hook",
      "http://user:pass@127.0.0.1/hook", "http://localhost/hook#fragment"]) {
      await expectStatus(await save(url), 400);
    }
    const rule = await addWebhook(branch, { url: local, headers: { Authorization: "Bearer local-fixture" } });
    await expectStatus(await webhookApi(branch, `/${rule}`, {
      ...webhookConfig({ url: `http://127.0.0.1:${port === 65535 ? port - 1 : port + 1}/orders` }), revision: 1,
    }, "PUT"), 400);
    await addWebhook(branch, { name: "Redirect", url: `http://localhost:${port}/redirect` });
    const order = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
    const history = await untilWebhook(async () => {
      const rows = await webhookHistory(branch);
      return rows.some(row => row.httpStatus === 204) && rows.some(row => row.httpStatus === 302) && rows;
    });
    assert.equal(history.find(row => row.ruleName === "Redirect").status, "failed");
    assert.deepEqual(received.map(row => row.path).sort(), ["/orders?source=menu", "/redirect"]);
    const delivery = received.find(row => row.path === "/orders?source=menu");
    assert.equal(delivery.authorization, "Bearer local-fixture");
    assert.deepEqual(JSON.parse(delivery.body), { id: order.orderId, status: "submitted" });
  } finally {
    receiver.close();
    await mf.setOptions(fixtureOptions);
    db = await mf.getD1Database("DB", "control");
  }
});

test("branch webhook history shows five entries, clears by scope, and expires after one day", async (t) => {
  const { main } = await prepareBookings(t);
  const rule = await addWebhook(main, { name: "Primary" });
  const sibling = await addWebhook(main, { name: "Sibling" });
  await addWebhook("booking_east");
  const { id: foreignRule } = await expectStatus(await webhookApi("booking_foreign", "", webhookConfig(), "POST", "biz_b"), 201);
  await expectStatus(await webhookApi("booking_foreign", `/${foreignRule}`, { revision: 1, enabled: true }, "PATCH", "biz_b"), 200);

  const seedDelivery = (eventId, businessId, branchId, ageSeconds = 0) => db.batch([
    db.prepare(`INSERT INTO branch_webhook_events (id,business_id,branch_id,table_key,record_id,event,record_json,created_at)
      VALUES (?,?,?,'orders',?,'inserted',?,unixepoch()-?)`)
      .bind(eventId, businessId, branchId, eventId, JSON.stringify({ id: eventId, status: "submitted" }), ageSeconds),
    db.prepare(`UPDATE branch_webhook_deliveries SET status='succeeded',attempts=1,http_status=204
      WHERE event_sequence=(SELECT sequence FROM branch_webhook_events WHERE id=?)`).bind(eventId),
  ]);
  for (let index = 1; index <= 6; index++) {
    await seedDelivery(`main-${index}`, "biz_a", main);
  }
  await seedDelivery("east", "biz_a", "booking_east");
  await seedDelivery("foreign", "biz_b", "booking_foreign");
  await seedDelivery("expired", "biz_a", "booking_east", 86401);

  const recent = await webhookHistory(main);
  assert.equal(recent.length, 5);
  assert.deepEqual(recent.map(row => row.eventId), ["main-6", "main-6", "main-5", "main-5", "main-4"]);
  assert.deepEqual((await webhookHistory("booking_east")).map(row => row.eventId), ["east"]);

  const branchClear = (branch = main, hookId = null, business = "biz_a", actor = "super@example.test") =>
    webhookApi(branch, hookId === null ? "/deliveries" : `/deliveries?webhookId=${hookId}`, undefined, "DELETE", business, actor);
  await expectStatus(await branchClear(main, foreignRule), 404);
  await expectStatus(await branchClear(main, rule, "biz_b"), 404);
  await expectStatus(await branchClear(main, rule, "biz_a", ""), 401);

  const queued = recent.find(row => row.ruleName === "Primary" && row.eventId === "main-6");
  await db.prepare("UPDATE branch_webhook_deliveries SET status='pending',attempts=0,http_status=NULL WHERE id=?").bind(queued.id).run();
  assert.deepEqual(await expectStatus(await branchClear(main, rule), 200), { cleared: 6 });
  assert.equal((await webhookHistory(main)).length, 5);
  assert.ok((await webhookHistory(main)).every(row => row.ruleName === "Sibling"));
  assert.equal(await db.prepare("SELECT count(*) AS n FROM branch_webhook_deliveries WHERE webhook_id=?").bind(sibling).first("n"), 6);
  assert.equal(await db.prepare("SELECT status FROM branch_webhook_deliveries WHERE id=?").bind(queued.id).first("status"), "pending");
  await runWebhookCron();
  assert.equal((await webhookHistory(main)).find(row => row.id === queued.id).status, "succeeded");
  assert.deepEqual(webhookRequests.map(row => row.body.id), ["main-6"]);
  assert.equal(await db.prepare("SELECT 1 FROM branch_webhook_events WHERE id='expired'").first(), null);
  assert.deepEqual((await webhookHistory("booking_east")).map(row => row.eventId), ["east"]);

  assert.deepEqual(await expectStatus(await branchClear(), 200), { cleared: 7 });
  assert.deepEqual(await webhookHistory(main), []);
  assert.equal(await db.prepare("SELECT count(*) AS n FROM branch_webhook_events WHERE branch_id=?").bind(main).first("n"), 0);
  assert.equal((await webhookHistory("booking_east")).length, 1);
  await seedDelivery("new-main", "biz_a", main);
  assert.deepEqual(await expectStatus(
    await superRequest("biz_a", undefined, "DELETE", "super@example.test", "webhook-deliveries"), 200,
  ), { cleared: 3 });
  assert.deepEqual(await webhookHistory(main), []);
  assert.deepEqual(await webhookHistory("booking_east"), []);
  const otherBusiness = await expectStatus(await webhookApi("booking_foreign", "/deliveries", undefined, "GET", "biz_b"), 200);
  assert.deepEqual(otherBusiness.deliveries.map(row => row.eventId), ["foreign"]);
  assert.equal((await webhookList(main)).length, 2);
  assert.equal(await db.prepare(`SELECT count(*) AS n FROM super_admin_audit_log
    WHERE action='branch.webhook.clear_history' AND business_id='biz_a'`).first("n"), 3);
});

test("branch webhook scheduler recovers an expired in-flight lease after a Worker reload", async () => {
  const checkout = await prepareNotificationCheckout();
  const main = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND slug='main'").first("id");
  await addWebhook(main);
  await addWebhook(main, { event: "updated", url: "https://receiver.example.com/status" });
  webhookResponses.set("/orders", 429);
  const order = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
  const original = await untilWebhook(async () => (await webhookHistory(main)).find(row => row.httpStatus === 429));
  await expectStatus(await request(`/api/admin/orders/${order.orderId}`, { status: "accepted" }, "owner-a", "PATCH"), 200);
  await db.prepare("UPDATE branch_webhook_deliveries SET status='sending',due_at=0,lease_token='interrupted' WHERE id=?")
    .bind(original.id).run();
  await mf.setOptions(fixtureOptions);
  db = await mf.getD1Database("DB", "control");
  webhookResponses.set("/orders", 204);
  await runWebhookCron();
  await runWebhookCron();
  const history = await webhookHistory(main);
  assert.equal(history.find(row => row.id === original.id).status, "succeeded");
  assert.equal(history.find(row => row.id === original.id).attempts, 2);
  assert.equal(history.find(row => row.event === "updated").status, "succeeded");
  assert.deepEqual(webhookRequests.map(row => row.path), ["/orders", "/orders", "/status"]);
  assert.equal(webhookRequests[1].deliveryId, original.id);
});

test("an oversized branch webhook payload fails delivery without rolling back the order change", async () => {
  const checkout = await prepareNotificationCheckout();
  const main = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND slug='main'").first("id");
  await addWebhook(main, { event: "updated", name: "With items",
    body: { items: "{{record.items}}" } });
  await addWebhook(main, { event: "updated", name: "Status only",
    url: "https://receiver.example.com/status" });
  const order = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
  await db.prepare("UPDATE order_products SET modifiers=json_array(hex(zeroblob(135000))) WHERE order_id=?")
    .bind(order.orderId).run();
  assert.ok(await db.prepare("SELECT length(modifiers) AS bytes FROM order_products WHERE order_id=?")
    .bind(order.orderId).first("bytes") > 256 * 1024);
  await expectStatus(await request(`/api/admin/orders/${order.orderId}`, { status: "accepted" }, "owner-a", "PATCH"), 200);
  const history = await untilWebhook(async () => {
    const rows = await webhookHistory(main);
    return rows.some(row => row.status === "failed") && rows.some(row => row.status === "succeeded") && rows;
  });
  assert.match(history.find(row => row.ruleName === "With items").error, /line items exceed/);
  assert.equal(await db.prepare("SELECT status FROM orders WHERE id=?").bind(order.orderId).first("status"), "accepted");
  assert.deepEqual(webhookRequests.map(row => [row.path, row.body.status]), [["/status", "accepted"]]);
});

test("branch webhook retries retain the delivery ID, enforce per-host order, and refuse redirects", async () => {
  const checkout = await prepareNotificationCheckout();
  const main = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND slug='main'").first("id");
  const createId = await addWebhook(main, { name: "Order creation" });
  await addWebhook(main, { name: "Ordered updates", event: "updated", url: "https://receiver.example.com/status" });
  const redirectRule = await addWebhook(main, { name: "Other host", event: "updated", url: "https://second.example.com/redirect" });
  webhookResponses.set("/orders", 500);
  webhookResponses.set("/redirect", 302);
  const order = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
  await untilWebhook(async () => (await webhookHistory(main)).find(row => row.ruleName === "Order creation" && row.httpStatus === 500));
  await expectStatus(await request(`/api/admin/orders/${order.orderId}`, { status: "accepted" }, "owner-a", "PATCH"), 200);
  const blocked = await untilWebhook(async () => {
    const rows = await webhookHistory(main);
    return rows.find(row => row.ruleName === "Other host" && row.status === "failed") && rows;
  });
  assert.equal(blocked.find(row => row.ruleName === "Ordered updates").status, "blocked");
  assert.equal(blocked.find(row => row.ruleName === "Other host").httpStatus, 302);
  assert.equal(webhookRequests.some(row => row.path === "/redirected" || row.path === "/status"), false);
  const creation = blocked.find(row => row.ruleName === "Order creation");
  assert.equal(creation.nextAttemptAt - creation.attemptedAt, 60);
  for (const retryDelay of [300, 1800, null]) {
    await db.prepare("UPDATE branch_webhook_deliveries SET due_at=0 WHERE id=?").bind(creation.id).run();
    await runWebhookCron();
    const row = (await webhookHistory(main)).find(item => item.id === creation.id);
    if (retryDelay) assert.equal(row.nextAttemptAt - row.attemptedAt, retryDelay);
    else assert.equal(row.status, "failed");
  }
  await expectStatus(await webhookApi(main, `/${createId}`, webhookConfig({
    name: "Future creations", revision: 1, url: "https://receiver.example.com/other",
  }), "PUT"), 200);
  await expectStatus(await webhookApi(main, `/${createId}`, webhookConfig({ revision: 1 }), "PUT"), 409);
  webhookResponses.set("/orders", 204);
  await expectStatus(await webhookApi(main, `/deliveries/${creation.id}/retry`, {}, "POST"), 200);
  await untilWebhook(async () => (await webhookHistory(main)).find(row => row.id === creation.id && row.status === "succeeded"));
  await runWebhookCron();
  const finished = await webhookHistory(main);
  assert.equal(finished.find(row => row.ruleName === "Ordered updates").status, "succeeded");
  assert.equal(finished.find(row => row.id === creation.id).attempts, 5);
  assert.equal(webhookRequests.filter(row => row.path === "/orders").length, 5);
  assert.ok(webhookRequests.filter(row => row.path === "/orders").every(row => row.deliveryId === creation.id && row.eventId === creation.eventId));
  assert.equal(webhookRequests.some(row => row.path === "/other"), false);
  assert.equal(webhookRequests.at(-1).path, "/status");
  await expectStatus(await webhookApi(main, `/${redirectRule}`, undefined, "DELETE"), 200);
  assert.equal((await webhookList(main)).find(rule => rule.id === redirectRule).archived, true);
  assert.equal((await webhookHistory(main)).find(row => row.ruleName === "Other host").status, "stopped");

  webhookResponses.set("/other", 500);
  const laterOrder = await expectStatus(await request("/api/public/businesses/test-a/orders",
    { ...checkout, submissionId: randomUUID() }, null), 201);
  const laterCreation = await untilWebhook(async () => (await webhookHistory(main)).find(
    row => row.recordId === laterOrder.orderId && row.event === "inserted" && row.httpStatus === 500));
  await expectStatus(await webhookApi(main, `/${createId}`, { revision: 2, enabled: false }, "PATCH"), 200);
  await expectStatus(await webhookApi(main, `/deliveries/${laterCreation.id}/retry`, {}, "POST"), 409);
  await expectStatus(await request(`/api/admin/orders/${laterOrder.orderId}`, { status: "accepted" }, "owner-a", "PATCH"), 200);
  const stopped = (await webhookHistory(main)).filter(row => row.recordId === laterOrder.orderId);
  assert.equal(stopped.find(row => row.event === "inserted").status, "stopped");
  assert.equal(stopped.find(row => row.event === "updated").status, "blocked");
  await db.prepare("UPDATE branch_webhook_events SET created_at=unixepoch()-86401 WHERE id=?")
    .bind(laterCreation.eventId).run();
  await runWebhookCron();
  const expired = (await webhookHistory(main)).filter(row => row.recordId === laterOrder.orderId);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].status, "expired");
  assert.equal(webhookRequests.filter(row => row.path === "/status").length, 1);
});

test("Deleted webhook snapshots honor reset consent and share its transaction", async (t) => {
  const { main } = await prepareBookings(t);
  const checkout = await prepareNotificationCheckout();
  await addWebhook(main, { event: "deleted", url: "https://receiver.example.com/delete-order",
    body: { id: "{{record.id}}", items: "{{record.items}}" } });
  await addWebhook(main, { table: "bookings", event: "deleted", url: "https://receiver.example.com/delete-booking" });
  const reset = (action, body) => superRequest("biz_a", body, "POST", "super@example.test", `reset-data/${action}`);
  const submit = () => request("/api/public/businesses/test-a/orders", checkout, null);
  const order = await expectStatus(await submit(), 201);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 201);
  const silent = { branchId: main, scope: "branch", selection: ["bookings"] };
  const backup = await expectStatus(await reset("backup", silent), 200);
  const confirmed = { token: backup.token, confirmation: backup.branch.name, backupSaved: true };
  await expectStatus(await reset("delete", { ...silent, ...confirmed, sendDeletedWebhooks: true }), 409);
  await expectStatus(await reset("delete", { ...silent, ...confirmed }), 200);
  assert.deepEqual(await webhookHistory(main), []);

  const booking = await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 201);
  const notifying = { ...silent, selection: ["tableGroups", "bookings"], sendDeletedWebhooks: true };
  await db.prepare(`
    WITH RECURSIVE copies(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM copies WHERE n<99)
    INSERT INTO bookings (id,business_id,branch_id,submission_id,request_hash,arrival_date,arrival_time,arrival_at,
      timezone,pax,guest_name,guest_phone,preference,preference_text,note,terms_language,terms_version,terms_text)
    SELECT 'cap-'||n,business_id,branch_id,'cap-'||n,request_hash,arrival_date,arrival_time,arrival_at,
      timezone,pax,guest_name,guest_phone,preference,preference_text,note,terms_language,terms_version,terms_text
    FROM bookings, copies WHERE id=?
  `).bind(booking.reference).run();
  const overLimit = await expectStatus(await reset("backup", notifying), 200);
  assert.equal(overLimit.token, null);
  assert.match(overLimit.blockers[0], /limited to 100/);
  const backupWithoutEvents = await expectStatus(await reset("backup", { ...notifying, sendDeletedWebhooks: false }), 200);
  assert.ok(backupWithoutEvents.token);
  await db.prepare("DELETE FROM bookings WHERE business_id='biz_a' AND id LIKE 'cap-%'").run();
  const prepare = async () => {
    const snapshot = await expectStatus(await reset("backup", notifying), 200);
    return { ...notifying, ...confirmed, token: snapshot.token };
  };
  const stale = await prepare();
  await db.prepare("UPDATE order_products SET note='changed after backup' WHERE order_id=?").bind(order.orderId).run();
  await expectStatus(await reset("delete", stale), 409);
  const fresh = await prepare();
  await db.prepare(`CREATE TRIGGER webhook_test_fail_table BEFORE DELETE ON restaurant_tables
    WHEN OLD.id='notify_table' BEGIN SELECT RAISE(ABORT,'webhook-test-delete-failure'); END`).run();
  try {
    await expectStatus(await reset("delete", fresh), 500);
    assert.deepEqual(await webhookHistory(main), []);
    assert.ok(await db.prepare("SELECT 1 FROM orders WHERE id=?").bind(order.orderId).first());
  } finally {
    await db.prepare("DROP TRIGGER webhook_test_fail_table").run();
  }
  await expectStatus(await reset("delete", fresh), 200);
  await untilWebhook(async () => {
    const rows = await webhookHistory(main);
    return rows.length === 2 && rows.every(row => row.status === "succeeded");
  });
  assert.equal(webhookRequests.find(row => row.path === "/delete-booking").body.id, booking.reference);
  const deleted = webhookRequests.find(row => row.path === "/delete-order").body;
  assert.equal(deleted.id, order.orderId);
  assert.equal(deleted.items[0].note, "changed after backup");
  assert.equal(await db.prepare("SELECT 1 FROM orders WHERE id=?").bind(order.orderId).first(), null);
  assert.equal(await db.prepare("SELECT 1 FROM bookings WHERE id=?").bind(booking.reference).first(), null);
});

test("a branch reset backs up dependent rows and rejects missing, stale, or cross-branch confirmations", async (t) => {
  const { main } = await prepareBookings(t);
  const checkout = await prepareNotificationCheckout();
  const reset = (action, body, actor = "super@example.test") =>
    superRequest("biz_a", body, "POST", actor, `reset-data/${action}`);
  await db.batch([
    db.prepare("INSERT INTO table_groups (id,business_id,branch_id,name) VALUES ('reset_east_group','biz_a','booking_east','East'),('reset_foreign_group','biz_b','booking_foreign','Foreign')"),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token) VALUES
      ('reset_east_table','biz_a','reset_east_group','E1','East 1','reset_east_scan'),
      ('reset_foreign_table','biz_b','reset_foreign_group','F1','Foreign 1','reset_foreign_scan')`),
  ]);
  const submit = (body) => request("/api/public/businesses/test-a/orders", body, null);
  const mainOrder = await expectStatus(await submit(checkout), 201);
  const eastOrder = await expectStatus(await submit({ ...checkout, branch: "east", tableId: "reset_east_table",
    tableToken: "reset_east_scan", submissionId: randomUUID() }), 201);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  const booking = await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 201);
  await db.batch([
    db.prepare("INSERT INTO telegram_order_deliveries (order_id,business_id,status) VALUES (?,'biz_a','sent')").bind(mainOrder.orderId),
    db.prepare("INSERT INTO telegram_booking_deliveries (booking_id,chat_id,status) VALUES (?,'-1001234567841','sent')").bind(booking.reference),
    ...[mainOrder, eastOrder].map((order) => db.prepare(`INSERT INTO telegram_notification_deliveries
      (notification_id,business_id,source,source_id,source_reference,chat_id,status)
      VALUES ('past_rule','biz_a','Order',?,?,'-1001234567841','sent')`).bind(order.orderId, order.orderNumber)),
  ]);

  const input = { branchId: main, scope: "branch", selection: ["tableGroups", "bookings"] };
  await expectStatus(await reset("backup", input, ""), 401);
  await expectStatus(await reset("backup", { ...input, branchId: "booking_foreign" }), 404);
  await expectStatus(await reset("backup", { ...input, selection: ["products"] }), 400);
  const backup = await expectStatus(await reset("backup", input), 200);
  const ids = (name, column = "id") => {
    const file = backup.tables.find((table) => table.name === name);
    return file.rows.map((row) => row[file.columns.indexOf(column)]);
  };
  assert.deepEqual(ids("orders"), [mainOrder.orderId]);
  assert.deepEqual(ids("order_products", "order_id"), [mainOrder.orderId]);
  assert.deepEqual(ids("bookings"), [booking.reference]);
  assert.deepEqual(ids("telegram_notification_deliveries", "source_id"), [mainOrder.orderId]);
  assert.deepEqual(ids("telegram_order_deliveries", "order_id"), [mainOrder.orderId]);
  assert.deepEqual(ids("telegram_booking_deliveries", "booking_id"), [booking.reference]);
  assert.deepEqual(ids("restaurant_tables"), ["notify_table"]);
  assert.deepEqual(ids("table_groups"), ["notify_group"]);
  const confirm = { ...input, confirmation: backup.branch.name, backupSaved: true };
  await expectStatus(await reset("delete", confirm), 409);
  await expectStatus(await reset("delete", { ...confirm, token: backup.token, backupSaved: false }), 400);
  await expectStatus(await reset("delete", { ...confirm, token: backup.token, confirmation: backup.branch.name.toLowerCase() }), 400);
  await expectStatus(await reset("delete", { ...confirm, token: backup.token, branchId: "booking_east", confirmation: "East Branch" }), 409);
  await db.prepare("UPDATE order_products SET note='changed after backup' WHERE order_id=?").bind(mainOrder.orderId).run();
  await expectStatus(await reset("delete", { ...confirm, token: backup.token }), 409);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM orders").first("n"), 2);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM super_admin_audit_log WHERE action='business.data_reset'").first("n"), 0);

  const fresh = await expectStatus(await reset("backup", input), 200);
  await db.prepare(`CREATE TRIGGER reset_test_fail_table BEFORE DELETE ON restaurant_tables
    WHEN OLD.id='notify_table' BEGIN SELECT RAISE(ABORT,'reset-test-delete-failure'); END`).run();
  try {
    await expectStatus(await reset("delete", { ...confirm, token: fresh.token }), 500);
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM orders").first("n"), 2);
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM telegram_notification_deliveries").first("n"), 2);
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM super_admin_audit_log WHERE action='business.data_reset'").first("n"), 0);
  } finally {
    await db.prepare("DROP TRIGGER reset_test_fail_table").run();
  }
  await expectStatus(await reset("delete", { ...confirm, token: fresh.token }), 200);
  assert.deepEqual((await db.prepare("SELECT id FROM orders").all()).results, [{ id: eastOrder.orderId }]);
  assert.deepEqual((await db.prepare("SELECT order_id FROM order_products").all()).results, [{ order_id: eastOrder.orderId }]);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM bookings").first("n"), 0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM telegram_order_deliveries").first("n"), 0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM telegram_booking_deliveries").first("n"), 0);
  assert.deepEqual((await db.prepare("SELECT source_id FROM telegram_notification_deliveries").all()).results, [{ source_id: eastOrder.orderId }]);
  assert.deepEqual((await db.prepare("SELECT id FROM restaurant_tables ORDER BY id").all()).results, [
    { id: "reset_east_table" }, { id: "reset_foreign_table" },
  ]);
  assert.equal(await db.prepare("SELECT json_extract(details_json,'$.branchId') AS branch FROM super_admin_audit_log WHERE action='business.data_reset'").first("branch"), main);
  await expectStatus(await reset("delete", { ...confirm, token: fresh.token }), 409);
});

test("a whole-business reset keeps the other catalog and protects menus linked to saved orders", async () => {
  const checkout = await prepareNotificationCheckout();
  const main = await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND is_default=1").first("id");
  const order = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
  await db.batch([
    db.prepare(`INSERT INTO menus (id,business_id,parent_id,slug,name_km) VALUES
      ('reset_menu','biz_a',NULL,'root','Root'),('reset_submenu','biz_a','reset_menu','child','Child'),
      ('foreign_menu','biz_b',NULL,'foreign','Foreign')`),
    db.prepare("INSERT INTO product_images (business_id,product_id,media_id) VALUES ('biz_a',?,'media_a')").bind(PRODUCT),
    db.prepare("INSERT INTO menu_products (business_id,menu_id,product_id) VALUES ('biz_a','reset_submenu',?)").bind(PRODUCT),
    db.prepare("UPDATE orders SET menu_id='reset_menu' WHERE id=?").bind(order.orderId),
    db.prepare("INSERT INTO categories (id,business_id,name,slug) VALUES ('foreign_cat','biz_b','Foreign','foreign')"),
    db.prepare("INSERT INTO products (id,business_id,category_id,name,slug,price_cents) VALUES ('foreign_product','biz_b','foreign_cat','Foreign','foreign',1)"),
  ]);
  const input = { branchId: main, scope: "business", selection: ["categories"] };
  const reset = (action, body) =>
    superRequest("biz_a", body, "POST", "super@example.test", `reset-data/${action}`);
  const blocked = await expectStatus(await reset("backup", { ...input, selection: ["menus"] }), 200);
  assert.equal(blocked.token, null);
  assert.match(blocked.blockers[0], /Saved orders/);

  const backup = await expectStatus(await reset("backup", input), 200);
  assert.deepEqual(backup.tables.map(({ name }) => name), [
    "menu_products", "menu_product_exclusions", "product_images", "product_prices", "products", "categories",
  ]);
  assert.equal(backup.tables.find(({ name }) => name === "product_images").rows.length, 1);
  const deletion = { ...input, token: backup.token, confirmation: backup.branch.name, backupSaved: true };
  await expectStatus(await reset("delete", deletion), 400);
  await expectStatus(await reset("delete", { ...deletion, confirmBusinessWide: true }), 200);
  assert.deepEqual((await db.prepare("SELECT id FROM products").all()).results, [{ id: "foreign_product" }]);
  assert.deepEqual((await db.prepare("SELECT id FROM categories").all()).results, [{ id: "foreign_cat" }]);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM product_images").first("n"), 0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM product_prices WHERE business_id='biz_a'").first("n"), 0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM menu_products").first("n"), 0);
  assert.equal(await db.prepare("SELECT product_id FROM order_products WHERE order_id=?").bind(order.orderId).first("product_id"), PRODUCT);
  const clear = async (input) => {
    const backup = await expectStatus(await reset("backup", input), 200);
    await expectStatus(await reset("delete", {
      ...input, token: backup.token, confirmation: backup.branch.name,
      backupSaved: true, confirmBusinessWide: input.scope === "business",
    }), 200);
  };
  await clear({ branchId: main, scope: "branch", selection: ["orders"] });
  await clear({ ...input, selection: ["menus"] });
  assert.deepEqual((await db.prepare("SELECT id FROM menus").all()).results, [{ id: "foreign_menu" }]);
});

test("a modifier discount from a product webhook reduces the checkout total", async () => {
  const checkout = await prepareNotificationCheckout();
  await expectStatus(
    await syncProduct({
      product: {
        id: PRODUCT,
        modifier_groups: [{
          label_km: "Milk",
          options: [{ id: "no-milk", label_km: "No milk", price: -0.5 }],
        }],
      },
    }),
    200,
  );
  Object.assign(checkout.items[0], {
    modifierIds: ["no-milk"],
    expectedPrice: 2,
  });
  const receipt = await expectStatus(
    await request("/api/public/businesses/test-a/orders", checkout, null),
    201,
  );
  assert.equal(receipt.totalAmount, 4);
});

test("legacy order alerts still deliver and retry with the Super Control endpoints removed", async () => {
  const botToken = `123456:${"A".repeat(35)}`;
  const settings = { botToken, chatId: "-1001234567890", enabled: true };
  const telegram = (method, body, identity = "super@example.test") =>
    superRequest("biz_a", body, method, identity, "telegram-orders");
  await seedLegacyOrderAlert(botToken, settings.chatId);
  for (const method of ["GET", "PUT", "POST", "DELETE"]) {
    await expectStatus(await telegram(method, method === "PUT" ? settings : undefined), 404);
  }

  const checkout = { ...(await prepareNotificationCheckout()), note: "Please serve the drinks first." };
  const submit = (body) => request("/api/public/businesses/test-a/orders", body, null);
  const receipt = await expectStatus(await submit(checkout), 201);
  await expectStatus(await submit(checkout), 200);
  const delivery = () => db.prepare("SELECT status FROM telegram_order_deliveries WHERE order_id=?").bind(receipt.orderId).first("status");
  await waitForState(delivery, "sent");
  assert.equal(telegramRequests.length, 1);
  assert.equal(telegramRequests[0].path, `/bot${botToken}/sendMessage`);
  assert.equal(telegramRequests[0].body.chat_id, settings.chatId);
  assert.match(telegramRequests[0].body.text, /Table: Main · Table 1/);
  assert.match(telegramRequests[0].body.text, /Total: 5\.00 USD/);
  assert.match(telegramRequests[0].body.text, /Order note: Please serve the drinks first\./);
  assert.match(telegramRequests[0].body.text, /Note: Less ice/);

  telegramStatus = 429;
  const next = await expectStatus(await submit({ ...checkout, submissionId: randomUUID() }), 201);
  const retry = () => db.prepare("SELECT status, error, attempts, next_attempt_at FROM telegram_order_deliveries WHERE order_id=?").bind(next.orderId).first();
  const queued = await waitForState(retry, (row) => row?.error?.includes("HTTP 429"));
  assert.equal(queued.status, "pending");
  assert.equal(queued.attempts, 1);
  assert.ok(queued.next_attempt_at > Date.now() / 1000);
  await db.prepare("UPDATE telegram_order_deliveries SET next_attempt_at=unixepoch() WHERE order_id=?").bind(next.orderId).run();
  telegramStatus = 200;
  const cron = encodeURIComponent("* * * * *");
  await expectStatus(await mf.dispatchFetch(`http://localhost/cdn-cgi/local/scheduled?format=json&cron=${cron}`), 200);
  assert.equal((await retry()).status, "sent");
  assert.equal((await retry()).attempts, 2);

  await db.prepare("UPDATE business_telegram_notifications SET enabled=0 WHERE business_id='biz_a'").run();
  const disabled = await expectStatus(await submit({ ...checkout, submissionId: randomUUID() }), 201);
  assert.equal(await db.prepare("SELECT status FROM telegram_order_deliveries WHERE order_id=?").bind(disabled.orderId).first(), null);
});

test("custom Telegram notifications route orders by branch and retry each chat in a booking rule independently", async (t) => {
  const endpoint = "/api/admin/telegram-notifications";
  const admin = (suffix = "", body, method = "GET", owner = "owner-a") => request(endpoint + suffix, body, owner, method);
  const botToken = `123456:${"C".repeat(35)}`;
  const { main } = await prepareBookings(t);
  await seedLegacyBookingAlerts(botToken, main);
  await expectStatus(await admin(), 403);
  assert.ok(!(await bookingWorkspace("owner-a")).includes("telegramNotifications"));
  await db.prepare(`UPDATE subscription_plans SET features_json=json_insert(features_json,'$[#]','telegramNotifications')
    WHERE id='plan_standard'`).run();
  assert.ok((await bookingWorkspace("owner-a")).includes("telegramNotifications"));
  assert.ok(!(await bookingWorkspace("editor-a")).includes("telegramNotifications"));
  await expectStatus(await admin("", undefined, "GET", "editor-a"), 403);

  const order = {
    source: "Order", branchId: main, chatId: "-1001234567811", botToken, enabled: true,
    title: "Order {{doc.order_number}}",
    message: "{{doc.branch.name}} | {{doc.table.group.name}} | {{format_date(doc.posting_date)}}\n" +
      "{% for op in doc.products %}{{op.product_name}} | {{op.product.category.name}} | {{op.price_list_record.name}} | {{format_currency(op.total_amount, doc.currency)}} | {{op.note}}{% endfor %}\n{{doc.note}}",
  };
  const preview = (value) => admin("/preview", value, "POST");
  const sample = await expectStatus(await preview(order), 200);
  assert.match(sample.text, /Order 261110-001[\s\S]+Main Branch \| Main Area \| 10 Nov 2026/);
  assert.match(sample.text, /Coffee \| Drinks \| Normal Rate \| USD\s+7\.00 \| Less ice/);
  await expectStatus(await preview({ ...order, message: "{{doc.constructor.name}}" }), 400);
  await expectStatus(await preview({ ...order, message: "{% for item in doc.products %}{{item.product_name}}" }), 400);
  await expectStatus(await admin("", { ...order, branchId: "booking_foreign" }, "POST"), 400);
  const create = async (rule) => (await expectStatus(await admin("", rule, "POST"), 201)).id;
  const mainOrder = await create({
    ...order,
    showAcceptButton: true,
    acceptUrl: "http://localhost/orders?telegramAction=accept&telegramOrder={{doc.id}}",
    showCancelButton: true,
    cancelUrl: "http://localhost/orders?telegramAction=cancel&telegramOrder={{doc.id}}",
  });
  await expectStatus(await admin("", order, "POST"), 409);
  const eastChat = "-1001234567812";
  const eastRule = { ...order, branchId: "booking_east", chatId: eastChat };
  const eastRuleId = await create(eastRule);
  const cancelUrl = "https://orders.example.test/cancel/{{doc.id}}?ref={{doc.order_number}}";
  await expectStatus(await admin(`/${eastRuleId}`, {
    ...eastRule, botToken: "", showAcceptButton: false, showCancelButton: true, cancelUrl,
  }, "PUT"), 200);
  await expectStatus(await admin(`/${eastRuleId}`, { ...eastRule, botToken: "", cancelUrl: "" }, "PUT"), 400);
  await expectStatus(await admin(`/${eastRuleId}`, { ...eastRule, botToken: "" }, "PUT"), 200);
  const booking = {
    ...order, source: "Booking", title: "Booking {{doc.id}}", chatId: "-1001234567821",
    message: "{{doc.business.name}} | {{doc.branch.name}} | {{format_datetime(doc.arrival_at)}} | {{doc.guest_name}} | {{doc.pax}}",
  };
  const retryChat = "-1001234567822";
  await expectStatus(await admin("", { ...booking, chatId: `${booking.chatId}, invalid` }, "POST"), 400);
  const bookingRule = await create({ ...booking, chatId: `${booking.chatId}, ${retryChat}, ${booking.chatId}` });
  await expectStatus(await admin("", { ...booking, chatId: `${retryChat}, -1001234567823` }, "POST"), 409);
  await expectStatus(await admin(`/${bookingRule}`, { ...booking, chatId: `${booking.chatId}, ${retryChat}`, botToken: "" }, "PUT"), 200);
  const listing = await expectStatus(await admin(), 200);
  assert.equal(listing.rules.length, 3);
  assert.equal(listing.rules.find(({ id }) => id === bookingRule).chatId, `${booking.chatId}, ${retryChat}`);
  const savedEastRule = listing.rules.find(({ id }) => id === eastRuleId);
  assert.equal(savedEastRule.showAcceptButton, 0);
  assert.equal(savedEastRule.showCancelButton, 1);
  assert.equal(savedEastRule.cancelUrl, cancelUrl);
  assert.ok(!JSON.stringify(listing).includes(botToken));
  assert.ok(!JSON.stringify(listing).includes("telegram_token"));
  const ciphertext = await db.prepare("SELECT telegram_token FROM telegram_notifications WHERE id=?").bind(mainOrder).first("telegram_token");
  assert.ok(ciphertext && ciphertext !== botToken);
  assert.deepEqual((await expectStatus(await admin("", undefined, "GET", "owner-b"), 200)).rules, []);
  await expectStatus(await admin(`/${mainOrder}`, undefined, "DELETE", "owner-b"), 404);
  const extraOrderChat = "-1001234567813";
  await expectStatus(await admin(`/${mainOrder}`, { ...order, chatId: `${order.chatId}, ${extraOrderChat}`, botToken: "" }, "PUT"), 200);
  assert.equal(await db.prepare("SELECT telegram_token FROM telegram_notifications WHERE id=?").bind(mainOrder).first("telegram_token"), ciphertext);

  await seedLegacyOrderAlert(botToken, "-1001234567899");
  const checkout = { ...(await prepareNotificationCheckout()), note: "Please bring extra napkins." };
  await db.batch([
    db.prepare("INSERT INTO table_groups (id,business_id,branch_id,name) VALUES ('east_alert_group','biz_a','booking_east','East Tables')"),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,branch_id,group_id,code,label,public_token)
      VALUES ('east_alert_table','biz_a','booking_east','east_alert_group','E1','East Table','east_alert_scan')`),
  ]);
  const submit = (body) => request("/api/public/businesses/test-a/orders", body, null);
  const first = await expectStatus(await submit(checkout), 201);
  await expectStatus(await submit(checkout), 200);
  const east = await expectStatus(await submit({ ...checkout, submissionId: randomUUID(), branch: "east", tableId: "east_alert_table", tableToken: "east_alert_scan" }), 201);
  const deliveries = async (id) => (await db.prepare(`SELECT notification_id AS notificationId,chat_id AS chatId,status,attempts,error
    FROM telegram_notification_deliveries WHERE source_id=? ORDER BY notification_id,chat_id`).bind(id).all()).results;
  await waitForState(() => deliveries(first.orderId), (rows) => rows.length === 2 && rows.every(({ status }) => status === "sent"));
  await waitForState(() => deliveries(east.orderId), (rows) => rows.length === 1 && rows[0].status === "sent");
  assert.deepEqual(new Set(telegramRequests.map(({ body }) => body.chat_id)), new Set([order.chatId, extraOrderChat, eastChat]));
  assert.equal(telegramRequests.length, 3);
  const eastAlert = telegramRequests.find(({ body }) => body.chat_id === eastChat).body;
  assert.match(eastAlert.text, /East Branch \| East Tables/);
  const eastOrderNumber = await db.prepare("SELECT order_number FROM orders WHERE id=?").bind(east.orderId).first("order_number");
  assert.deepEqual(eastAlert.reply_markup, { inline_keyboard: [[{
    text: "Cancel order", url: `https://orders.example.test/cancel/${east.orderId}?ref=${eastOrderNumber}`,
  }]] });
  assert.match(telegramRequests.find(({ body }) => body.chat_id === order.chatId).body.text, /Normal Rate \| USD\s+5\.00 \| Less ice/);
  assert.match(telegramRequests.find(({ body }) => body.chat_id === order.chatId).body.text, /Please bring extra napkins\./);
  assert.deepEqual(telegramRequests.find(({ body }) => body.chat_id === order.chatId).body.reply_markup, {
    inline_keyboard: [[
      { text: "Accept order", url: `http://localhost/orders?telegramAction=accept&telegramOrder=${first.orderId}` },
      { text: "Cancel order", url: `http://localhost/orders?telegramAction=cancel&telegramOrder=${first.orderId}` },
    ]],
  });

  telegramStatusByChat.set(retryChat, 429);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  const form = guestBooking(config);
  const booked = await expectStatus(await bookingPublic("branch=main", form), 201);
  await expectStatus(await bookingPublic("branch=main", form), 200);
  const queued = await waitForState(() => deliveries(booked.reference), (rows) =>
    rows.some((row) => row.chatId === booking.chatId && row.status === "sent") &&
    rows.some((row) => row.chatId === retryChat && row.error?.includes("429")));
  assert.equal(queued.length, 2);
  assert.ok(queued.every((row) => row.notificationId === bookingRule));
  assert.equal(queued.find((row) => row.chatId === retryChat).status, "pending");
  assert.equal(telegramRequests.length, 5);
  assert.match(telegramRequests.find(({ body }) => body.chat_id === booking.chatId).body.text, /Test A \| Test A \| .+12:00.* \| Test Guest \| 4/);
  assert.equal(telegramRequests.find(({ body }) => body.chat_id === booking.chatId).body.reply_markup, undefined);
  telegramStatusByChat.delete(retryChat);
  await db.prepare("UPDATE telegram_notification_deliveries SET next_attempt_at=unixepoch() WHERE source_id=? AND status='pending'").bind(booked.reference).run();
  const cron = encodeURIComponent("* * * * *");
  await expectStatus(await mf.dispatchFetch(`http://localhost/cdn-cgi/local/scheduled?format=json&cron=${cron}`), 200);
  const retried = await deliveries(booked.reference);
  assert.ok(retried.every(({ status }) => status === "sent"));
  assert.equal(retried.find((row) => row.chatId === booking.chatId).attempts, 1);
  assert.equal(retried.find((row) => row.chatId === retryChat).attempts, 2);
  assert.equal(telegramRequests.filter(({ body }) => body.chat_id === booking.chatId).length, 1);
  assert.equal(telegramRequests.filter(({ body }) => body.chat_id === retryChat).length, 2);

  await db.prepare("UPDATE businesses SET disabled_control_pages_json='[\"telegramNotifications\"]' WHERE id='biz_a'").run();
  await expectStatus(await admin(), 403);
  assert.ok(!(await bookingWorkspace("owner-a")).includes("telegramNotifications"));
  const legacy = await expectStatus(await submit({ ...checkout, submissionId: randomUUID() }), 201);
  assert.deepEqual(await deliveries(legacy.orderId), []);
  await waitForState(() => db.prepare("SELECT status FROM telegram_order_deliveries WHERE order_id=?").bind(legacy.orderId).first("status"), "sent");
});

test("Telegram test sends render the draft and report each chat without changing notification settings", async (t) => {
  const endpoint = "/api/admin/telegram-notifications";
  const sendTest = (body, token = "owner-a") => request(`${endpoint}/test`, body, token);
  const botToken = `123456:${"T".repeat(35)}`;
  const savedChat = "-1001234567831";
  const extraChat = "-1001234567832";
  const settings = {
    source: "Order", branchId: null, enabled: false, chatId: savedChat, botToken,
    title: "Saved order template", message: "Saved message",
  };
  await expectStatus(await sendTest(settings), 403);
  const plan = db.prepare("UPDATE subscription_plans SET features_json=? WHERE id='plan_standard'");
  const original = await db.prepare("SELECT features_json FROM subscription_plans WHERE id='plan_standard'").first("features_json");
  t.after(() => plan.bind(original).run());
  await plan.bind(JSON.stringify([...JSON.parse(original), "telegramNotifications"])).run();

  await expectStatus(await request(endpoint, { ...settings, showAcceptButton: true }, "owner-a"), 400);
  const { id } = await expectStatus(await request(endpoint, settings, "owner-a"), 201);
  await expectStatus(await request(`${endpoint}/${id}`, {
    ...settings, botToken: "", showCancelButton: true, cancelUrl: "   ",
  }, "owner-a", "PUT"), 400);
  const draft = {
    notificationId: id, source: "Order", chatId: `${savedChat}, ${extraChat}, ${savedChat}`,
    title: "Draft order {{doc.order_number}}",
    message: "{% for op in doc.products %}{{op.product_name}} {{format_currency(op.total_amount)}}{% endfor %}",
    showAcceptButton: true, acceptUrl: "http://localhost/orders?telegramAction=accept",
    showCancelButton: true, cancelUrl: "http://localhost/orders?telegramAction=cancel",
  };
  await expectStatus(await sendTest(draft, "editor-a"), 403);
  await expectStatus(await sendTest(draft, "owner-b"), 404);
  await expectStatus(await sendTest({ ...draft, message: "{{doc.unknown_field}}" }), 400);
  await expectStatus(await sendTest({ ...draft, acceptUrl: " " }), 400);
  await expectStatus(await sendTest({ ...draft, cancelUrl: undefined }), 400);
  await expectStatus(await sendTest({ ...draft, acceptUrl: "javascript:alert(1)" }), 400);
  await expectStatus(await sendTest({ ...draft, cancelUrl: "https://orders.example.test/{{doc.typo}}" }), 400);
  assert.equal(telegramRequests.length, 0);
  telegramStatusByChat.set(extraChat, 403);
  const response = await expectStatus(await sendTest(draft), 200);
  assert.deepEqual(response.results[0], { chatId: savedChat, ok: true });
  assert.equal(response.results[1].chatId, extraChat);
  assert.equal(response.results[1].ok, false);
  assert.match(response.results[1].error, /HTTP 403/);
  assert.equal(response.results.length, 2);
  assert.equal(telegramRequests.length, 2);
  for (const sent of telegramRequests) {
    assert.equal(sent.path, `/bot${botToken}/sendMessage`);
    assert.match(sent.body.text, /^eMenu test message\n\nDraft order 261110-001\n\nCoffee USD\s+7\.00$/);
    assert.deepEqual(sent.body.reply_markup, { inline_keyboard: [[
      { text: "Accept order", url: "http://localhost/orders?telegramAction=accept" },
      { text: "Cancel order", url: "http://localhost/orders?telegramAction=cancel" },
    ]] });
  }
  assert.ok(!JSON.stringify(response).includes(botToken));

  const customDraft = { ...draft, chatId: savedChat, showCancelButton: false, cancelUrl: "",
    acceptUrl: "https://orders.example.test/accept/{{doc.id}}?ref={{doc.order_number}}" };
  await expectStatus(await sendTest(customDraft), 200);
  assert.deepEqual(telegramRequests.at(-1).body.reply_markup, { inline_keyboard: [[{
    text: "Accept order", url: "https://orders.example.test/accept/order_demo?ref=261110-001",
  }]] });
  await expectStatus(await sendTest({ ...customDraft, showAcceptButton: false, acceptUrl: "" }), 200);
  assert.equal(telegramRequests.at(-1).body.reply_markup, undefined);

  const newDraft = { notificationId: null, source: "Booking", chatId: savedChat,
    title: "Booking test", message: "{{doc.guest_name}}" };
  await expectStatus(await sendTest(newDraft), 400);
  assert.deepEqual((await expectStatus(await sendTest({ ...newDraft, botToken }), 200)).results, [{ chatId: savedChat, ok: true }]);
  assert.match(telegramRequests.at(-1).body.text, /Sample Guest/);
  assert.equal(telegramRequests.at(-1).body.reply_markup, undefined);
  const { rules } = await expectStatus(await request(endpoint, undefined, "owner-a", "GET"), 200);
  assert.equal(rules[0].showAcceptButton, 0);
  assert.equal(rules[0].showCancelButton, 0);
  assert.deepEqual(rules.map(({ chatId, title, enabled, lastStatus }) => ({ chatId, title, enabled, lastStatus })), [
    { chatId: savedChat, title: settings.title, enabled: 0, lastStatus: null },
  ]);
});

test("Telegram delivery history retries one failed chat and expires entries according to each rule", async (t) => {
  const endpoint = "/api/admin/telegram-notifications";
  const admin = (suffix = "", body, method = "GET", owner = "owner-a") => request(endpoint + suffix, body, owner, method);
  const history = async (query = "") => (await expectStatus(await admin(`/history${query}`), 200)).deliveries;
  const retry = (delivery, owner = "owner-a") => {
    const { notificationId, sourceId, chatId } = delivery;
    return admin("/history/retry", { notificationId, sourceId, chatId }, "POST", owner);
  };
  const { main } = await prepareBookings(t);
  await db.prepare(`UPDATE subscription_plans SET features_json=json_insert(features_json,'$[#]','telegramNotifications')
    WHERE id='plan_standard'`).run();
  const sentChat = "-1001234567841";
  const failedChat = "-1001234567842";
  const settings = { source: "Order", branchId: main, enabled: true,
    botToken: `123456:${"H".repeat(35)}`, chatId: `${sentChat},${failedChat}`,
    title: "Order {{doc.order_number}}", message: "{{doc.branch.name}}" };
  await expectStatus(await admin("", { ...settings, historyDays: 0 }, "POST"), 400);
  await expectStatus(await admin("", { ...settings, historyDays: 91 }, "POST"), 400);
  const { id } = await expectStatus(await admin("", settings, "POST"), 201);
  const rules = async () => (await expectStatus(await admin(), 200)).rules;
  assert.equal((await rules()).find((rule) => rule.id === id).historyDays, 7);
  const checkout = await prepareNotificationCheckout();
  telegramStatusByChat.set(failedChat, 403);
  const submit = (body) => request("/api/public/businesses/test-a/orders", body, null);
  const order = await expectStatus(await submit(checkout), 201);
  const orderRows = await waitForState(history, (rows) => rows.length === 2 && rows.every(({ status }) => status !== "pending"));
  const failed = orderRows.find(({ chatId }) => chatId === failedChat);
  const sent = orderRows.find(({ chatId }) => chatId === sentChat);
  assert.equal(failed.reference, order.orderNumber);
  assert.equal(failed.source, "Order");
  assert.equal(failed.canRetry, 1);
  assert.match(failed.error, /HTTP 403/);
  assert.equal(sent.canRetry, 0);
  assert.equal(sent.status, "sent");
  assert.deepEqual((await history("?status=failed")).map(({ chatId }) => chatId), [failedChat]);
  assert.deepEqual((await expectStatus(await admin("/history", undefined, "GET", "owner-b"), 200)).deliveries, []);
  await expectStatus(await retry(failed, "owner-b"), 409);
  await expectStatus(await retry(sent), 409);
  assert.equal(telegramRequests.length, 2);
  await db.prepare("UPDATE telegram_notification_deliveries SET attempts=3 WHERE source_id=? AND chat_id=?")
    .bind(order.orderId, failedChat).run();
  telegramStatusByChat.delete(failedChat);
  await expectStatus(await retry(failed), 200);
  const repaired = (await history()).find(({ chatId }) => chatId === failedChat);
  assert.equal(repaired.status, "sent");
  assert.equal(repaired.attempts, 4);
  assert.equal(repaired.error, null);
  assert.equal(telegramRequests.at(-1).body.chat_id, failedChat);
  await expectStatus(await retry(failed), 409);
  assert.equal(telegramRequests.length, 3);

  telegramStatusByChat.set(failedChat, 429);
  const second = await expectStatus(await submit({ ...checkout, submissionId: randomUUID() }), 201);
  await waitForState(history, (rows) => rows.some(({ sourceId, chatId, error }) =>
    sourceId === second.orderId && chatId === failedChat && error?.includes("429")));
  const changeHistoryDays = (historyDays) => admin(`/${id}`, { ...settings, botToken: "", historyDays }, "PUT");
  await expectStatus(await changeHistoryDays(3.5), 400);
  await expectStatus(await changeHistoryDays(3), 200);
  await expectStatus(await changeHistoryDays(undefined), 200);
  assert.equal((await rules()).find((rule) => rule.id === id).historyDays, 3);
  assert.equal((await history()).find(({ sourceId, chatId }) => sourceId === second.orderId && chatId === failedChat).status, "pending");
  await expectStatus(await admin(`/${id}`, undefined, "DELETE"), 200);
  const cancelled = (await history()).find(({ sourceId, chatId }) => sourceId === second.orderId && chatId === failedChat);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.canRetry, 0);
  assert.match(cancelled.error, /deleted/);
  assert.equal((await history()).filter(({ sourceId }) => sourceId === order.orderId).length, 2);

  await expectStatus(await admin("", { ...settings, source: "Booking", title: "Booking {{doc.id}}", chatId: sentChat, historyDays: 14 }, "POST"), 201);
  const config = await expectStatus(await bookingPublic("branch=main"), 200);
  const booking = await expectStatus(await bookingPublic("branch=main", guestBooking(config)), 201);
  await waitForState(history, (rows) => rows.some(({ reference, source, status }) => reference === booking.reference && source === "Booking" && status === "sent"));

  await db.prepare(`UPDATE telegram_notification_deliveries
    SET created_at=unixepoch()-(CASE WHEN source_id=? THEN 4 ELSE 8 END)*86400 WHERE source_id IN (?,?)`)
    .bind(order.orderId, order.orderId, booking.reference).run();
  assert.ok(!(await history()).some(({ sourceId }) => sourceId === order.orderId));
  const cron = encodeURIComponent("17 0 * * *");
  await expectStatus(await mf.dispatchFetch(`http://localhost/cdn-cgi/local/scheduled?format=json&cron=${cron}`), 200);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM telegram_notification_deliveries WHERE source_id=?").bind(order.orderId).first("n"), 0);
  assert.ok((await history()).some(({ reference }) => reference === booking.reference));
});

test("order WebSocket broadcasts saved orders once to authenticated listeners for their business", async () => {
  const checkout = await prepareNotificationCheckout();
  const path = "/api/integrations/pos/orders/ws";
  const upgrade = (token) => request(path, undefined, token, "GET", { upgrade: "websocket" });
  const submit = (body) => request("/api/public/businesses/test-a/orders", body, null);
  await expectStatus(await request(path, undefined, key, "GET"), 426);
  await expectStatus(await upgrade(null), 401);
  await expectStatus(await upgrade(`pos_${"0".repeat(64)}`), 401);

  const other = await expectStatus(await superRequest("biz_b", { name: "Other POS" }, "PUT"), 200);
  const socketUrl = new URL(path, await mf.ready);
  socketUrl.protocol = "ws:";
  const sockets = [];
  async function connect(token) {
    const socket = new WebSocketClient(socketUrl, { headers: { authorization: `Bearer ${token}` } });
    sockets.push(socket);
    await eventOnce(socket, "open");
    return socket;
  }
  const eventOnce = (socket, type) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Expected WebSocket ${type}, state ${socket.readyState}`)), 3000);
    socket.addEventListener(type, (event) => {
      clearTimeout(timeout);
      resolve(event);
    }, { once: true });
  });

  try {
    const socket = await connect(key);
    const otherSocket = await connect(other.apiKey);
    const messages = [];
    const foreignMessages = [];
    socket.addEventListener("message", (event) => messages.push(event.data));
    otherSocket.addEventListener("message", (event) => foreignMessages.push(event.data));
    const firstEvent = eventOnce(socket, "message");
    const receipt = await expectStatus(await submit(checkout), 201);
    assert.deepEqual(JSON.parse((await firstEvent).data), {
      type: "order.submitted",
      order: {
        id: receipt.orderId, order_number: receipt.orderNumber, table_id: receipt.tableId,
        branch_id: await db.prepare("SELECT id FROM branches WHERE business_id='biz_a' AND is_default=1").first("id"),
        posting_date: receipt.postingDate, submitted_at: receipt.submittedAt,
        total_quantity: 2, total_amount: 5, currency: "USD",
      },
    });
    await expectStatus(await submit(checkout), 200);

    const rotated = await expectStatus(await superRequest("biz_a", { name: "Rotated POS" }, "PUT"), 200);
    await expectStatus(await upgrade(key), 401);
    const replacement = await connect(rotated.apiKey);
    const replacementEvent = eventOnce(replacement, "message");
    const next = await expectStatus(await submit({ ...checkout, submissionId: randomUUID() }), 201);
    assert.equal(JSON.parse((await replacementEvent).data).order.id, next.orderId);
    await waitForState(() => socket.readyState, (state) => state >= WebSocketClient.CLOSING);
    assert.equal(messages.length, 1);
    assert.deepEqual(foreignMessages, []);
  } finally {
    for (const socket of sockets) {
      socket.on("error", () => {});
      socket.terminate();
    }
  }
});

async function waitForState(read, expected) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const value = await read();
    if (typeof expected === "function" ? expected(value) : value === expected) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("Timed out waiting for the expected state");
}

test("Super Control can correct a business slug and keep old public QR links reserved", async () => {
  const rename = (id, previousSlug, slug, identity = "super@example.test") =>
    superRequest(id, { previousSlug, slug }, "PATCH", identity, "slug");
  const publicPath = (slug, resource) => `/api/public/businesses/${slug}/${resource}`;
  const checkout = await prepareNotificationCheckout();
  await db.batch([
    db.prepare(`INSERT INTO menus (id,business_id,parent_id,slug,name_en) VALUES
      ('slug_root','biz_a',NULL,'qr-menu','QR menu'),('slug_section','biz_a','slug_root','section','Section')`),
    db.prepare("INSERT INTO menu_products (business_id,menu_id,product_id) VALUES ('biz_a','slug_section',?)").bind(PRODUCT),
  ]);
  await expectStatus(await rename("biz_a", "test-a", "renamed-a", null), 401);
  await expectStatus(await rename("biz_a", "test-a", "a--b"), 400);
  assert.equal((await expectStatus(await rename("biz_a", "test-a", "test-b"), 409)).code, "SLUG_IN_USE");
  assert.deepEqual(await expectStatus(await rename("biz_a", "test-a", "renamed-a"), 200), { slug: "renamed-a" });
  assert.equal((await expectStatus(await rename("biz_a", "test-a", "stale-edit"), 409)).code, "SLUG_CHANGED");

  for (const slug of ["test-a", "renamed-a"]) {
    const menu = await expectStatus(await request(publicPath(slug, "menu?branch=main&menu=qr-menu"), undefined, null, "GET"), 200);
    assert.equal(menu.business.id, "biz_a");
    assert.equal(menu.business.slug, "renamed-a");
    assert.equal(menu.menu.slug, "qr-menu");
    assert.deepEqual(menu.products.map(({ id }) => id), [PRODUCT]);
    const table = await expectStatus(await request(publicPath(slug, "table-context/notify_scan?branch=main&table_id=notify_table"), undefined, null, "GET"), 200);
    assert.equal(table.tableId, "notify_table");
  }
  const order = { ...checkout, branch: "main", menu: "qr-menu" };
  const receipt = await expectStatus(await request(publicPath("test-a", "orders"), order, null), 201);
  assert.equal((await expectStatus(await request(publicPath("renamed-a", "orders"), order, null), 200)).orderId, receipt.orderId);
  assert.equal((await expectStatus(await rename("biz_b", "test-b", "test-a"), 409)).code, "SLUG_IN_USE");
  const signup = await expectStatus(await request("/api/auth/register", {
    email: "slug-conflict@example.test", businessName: "Conflict", slug: "test-a",
    authVersion: "client-pbkdf2-sha256-v1", passwordProof: "a".repeat(64),
  }, null), 409);
  assert.equal(signup.code, "MENU_SLUG_IN_USE");

  await expectStatus(await rename("biz_a", "renamed-a", "test-a"), 200);
  const restored = await expectStatus(await request(publicPath("renamed-a", "menu?menu=qr-menu"), undefined, null, "GET"), 200);
  assert.equal(restored.business.slug, "test-a");
  const { results: audit } = await db.prepare(`SELECT details_json AS details FROM super_admin_audit_log
    WHERE business_id='biz_a' AND action='business.slug_updated'`).all();
  assert.deepEqual(audit.map(({ details }) => JSON.parse(details)).sort((a,b) => a.slug.localeCompare(b.slug)), [
    { previousSlug: "test-a", slug: "renamed-a" }, { previousSlug: "renamed-a", slug: "test-a" },
  ]);
});

test("menu themes publish only the business's uploaded product placeholder", async () => {
  const menu = async () => (
    await expectStatus(await request("/api/public/businesses/test-a/menu", undefined, null, "GET"), 200)
  ).business.menuTheme;
  const publish = (menuTheme) => request("/api/admin/menu-theme", { menuTheme }, "owner-a", "PUT");
  const original = await menu();
  assert.equal(original.productPlaceholderUrl, "");
  await expectStatus(await publish({ ...original, productPlaceholderMediaId: "media_b" }), 404);

  await expectStatus(await publish({
    ...original,
    backgroundImageMediaId: "media_a2",
    productPlaceholderMediaId: "media_a",
    productPlaceholderUrl: "https://example.test/untrusted.webp",
  }), 200);
  const published = await menu();
  assert.equal(published.productPlaceholderUrl, "http://localhost/media/media_a");
  assert.equal(published.backgroundImageUrl, "http://localhost/media/media_a2");

  await db.prepare(`UPDATE businesses
    SET menu_theme_json=json_set(menu_theme_json,'$.productPlaceholderUrl','https://old-media.example.test/a.webp'),
        menu_cache_version=menu_cache_version+1
    WHERE id='biz_a'`).run();
  assert.equal((await menu()).productPlaceholderUrl, "http://localhost/media/media_a");

  await expectStatus(await publish({ ...published, productPlaceholderMediaId: "" }), 200);
  assert.equal((await menu()).productPlaceholderUrl, "");
});

test("menu themes publish the Khmer font separately from the heading and body fonts", async () => {
  const menu = async () => (
    await expectStatus(await request("/api/public/businesses/test-a/menu", undefined, null, "GET"), 200)
  ).business.menuTheme;
  const original = await menu();
  assert.equal(original.khmerFont, "Noto Sans Khmer");

  const publish = (khmerFont) => request("/api/admin/menu-theme", {
    menuTheme: { ...original, khmerFont, headingFont: "Manrope", bodyFont: "DM Sans" },
  }, "owner-a", "PUT");
  const saved = await expectStatus(await publish("Battambang"), 200);
  assert.equal(saved.menuTheme.khmerFont, "Battambang");
  const published = await menu();
  assert.equal(published.khmerFont, "Battambang");
  assert.equal(published.headingFont, "Manrope");
  assert.equal(published.bodyFont, "DM Sans");

  await expectStatus(await publish("unknown font"), 200);
  assert.equal((await menu()).khmerFont, "Noto Sans Khmer");
});

test("Super Control can default public links to the first active main menu", async () => {
  const detail = () => superRequest("biz_a", undefined, "GET", "super@example.test", "");
  const save = (allowCategoryBrowsing, identity = "super@example.test") =>
    superRequest("biz_a", { allowCategoryBrowsing }, "PUT", identity, "menu-browsing");
  const menu = (query = "", slug = "test-a") =>
    request(`/api/public/businesses/${slug}/menu${query}`, undefined, null, "GET");
  const qrDesigns = "/api/admin/qr-designs";
  const qrDesign = { name: "Menu QR", targetType: "menu" };
  const qrSettings = (token = "owner-a") => request(`${qrDesigns}?settings=1`, undefined, token, "GET");
  await db.batch([
    db.prepare(`INSERT INTO menus (id,business_id,parent_id,slug,name_en,is_active,sort_order) VALUES
      ('later','biz_a',NULL,'later','Another Menu',1,20),
      ('specific','biz_a',NULL,'specific','Specific',1,10),
      ('inactive','biz_a',NULL,'inactive','Inactive',0,0),
      ('nested','biz_a','specific','nested','Nested',1,0),
      ('foreign_root','biz_b',NULL,'foreign','Foreign',1,0)`),
    db.prepare("INSERT INTO table_groups (id,business_id,name) VALUES ('menu_browsing_group','biz_a','Main')"),
    db.prepare(`INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token)
      VALUES ('menu_browsing_table','biz_a','menu_browsing_group','T01','Table 1','menu_browsing_scan')`),
  ]);
  assert.equal((await expectStatus(await detail(), 200)).business.allowCategoryBrowsing, true);
  const genericQr = await expectStatus(await request(qrDesigns, qrDesign, "owner-a"), 201);
  await expectStatus(await menu(), 200);
  assert.equal((await menu()).headers.get("x-catalog-cache"), "HIT");
  await expectStatus(await save(false, null), 401);
  await expectStatus(await save("false"), 400);

  assert.deepEqual(await expectStatus(await save(false), 200), { allowCategoryBrowsing: false });
  assert.equal((await expectStatus(await detail(), 200)).business.allowCategoryBrowsing, false);
  const qrList = await expectStatus(await request(qrDesigns, undefined, "owner-a", "GET"), 200);
  assert.equal(qrList.allowCategoryBrowsing, false);
  assert.ok(qrList.designs.some(({ id }) => id === genericQr.id));
  assert.deepEqual(await expectStatus(await qrSettings(), 200), { allowCategoryBrowsing: false });
  assert.deepEqual(await expectStatus(await qrSettings("owner-b"), 200), { allowCategoryBrowsing: true });
  await expectStatus(await request(qrDesigns, qrDesign, "owner-a"), 400);
  await expectStatus(await request(qrDesigns, { ...qrDesign, targetType: "table" }, "owner-a"), 400);
  await expectStatus(await request(`${qrDesigns}/${genericQr.id}`, qrDesign, "owner-a", "PUT"), 400);
  await expectStatus(await request(`${qrDesigns}/${genericQr.id}`, {
    ...qrDesign, config: { menuSlug: "specific" },
  }, "owner-a", "PUT"), 200);
  for (const query of ["", "?branch=main"]) {
    const fallback = await expectStatus(await menu(query), 200);
    assert.equal(fallback.menu.slug, "specific");
    assert.equal(fallback.branch.slug, "main");
  }
  for (const query of ["?branch=missing", "?menu=", "?menu=missing", "?menu=inactive", "?menu=nested", "?menu=foreign"]) {
    const response = await menu(query);
    await expectStatus(response, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await expectStatus(await menu("?menu=specific"), 200)).menu.slug, "specific");
  assert.equal((await expectStatus(await menu("?menu=later"), 200)).menu.slug, "later");
  await expectStatus(await menu("", "test-b"), 200);
  const checkout = await expectStatus(await request("/api/public/businesses/test-a/orders", {
    submissionId: randomUUID(), deviceId: randomUUID(), tableToken: "menu_browsing_scan",
    expectedCurrency: "USD", items: [{ productId: PRODUCT, quantity: 1, expectedPrice: 1 }],
  }, null), 404);
  assert.equal(checkout.code, "menu_unavailable");

  await db.prepare("UPDATE menus SET is_active=0 WHERE business_id='biz_a' AND parent_id IS NULL").run();
  await expectStatus(await menu(), 404);
  await expectStatus(await save(true), 200);
  assert.equal((await expectStatus(await menu(), 200)).menu, null);
  assert.deepEqual(await expectStatus(await qrSettings(), 200), { allowCategoryBrowsing: true });
  await expectStatus(await request(qrDesigns, qrDesign, "owner-a"), 201);
});

test("super-admin can configure a business's hourly QR order limit", async () => {
  const detail = (businessId) =>
    superRequest(businessId, undefined, "GET", "super@example.test", "");
  const settings = {
    latitude: null,
    longitude: null,
    enableSubmitOrder: false,
    orderRadiusMeters: 100,
  };
  const save = (body) =>
    superRequest("biz_a", body, "PUT", "super@example.test", "ordering-settings");

  const before = await expectStatus(await detail("biz_a"), 200);
  assert.equal(before.business.hourlyDeviceOrderLimit, 10);
  for (const hourlyDeviceOrderLimit of [-1, 1.5, 1000, "7", null]) {
    await expectStatus(await save({ ...settings, hourlyDeviceOrderLimit }), 400);
  }
  const saved = await expectStatus(
    await save({ ...settings, hourlyDeviceOrderLimit: 7 }),
    200,
  );
  assert.deepEqual(saved, { ...settings, hourlyDeviceOrderLimit: 7 });
  const disabled = await expectStatus(
    await save({ ...settings, hourlyDeviceOrderLimit: 0 }),
    200,
  );
  assert.deepEqual(disabled, { ...settings, hourlyDeviceOrderLimit: 0 });
  const legacy = await expectStatus(await save(settings), 200);
  assert.equal(legacy.hourlyDeviceOrderLimit, 0);
  const updated = await expectStatus(await detail("biz_a"), 200);
  assert.equal(updated.business.hourlyDeviceOrderLimit, 0);
  const other = await expectStatus(await detail("biz_b"), 200);
  assert.equal(other.business.hourlyDeviceOrderLimit, 10);
});

test("Control sidebar settings restrict pages and actions per business", async (t) => {
  const setPlanPos = (enabled) => db.prepare("UPDATE subscription_plans SET pos_enabled=? WHERE id='plan_standard'").bind(enabled).run();
  await setPlanPos(1);
  t.after(() => setPlanPos(0));
  const admin = (path, token = "owner-a", method = "GET", body) =>
    request(`/api/admin/${path}`, body, token, method);
  const setPages = (disabledControlPages, identity = "super@example.test") =>
    superRequest(
      "biz_a",
      { disabledControlPages },
      "PUT",
      identity,
      "control-pages",
    );
  const allPages = [
    "overview",
    "business",
    "appearance",
    "catalog",
    "menus",
    "priceLists",
    "managePrices",
    "sellingOverview",
    "posProfiles",
    "posPaymentTypes",
    "salesList",
    "orders",
    "reports",
    "tables",
    "banners",
    "qrDesigns",
  ];
  assert.deepEqual(
    (await expectStatus(await admin("workspace-access"), 200))
      .accessibleControlPages,
    allPages,
  );
  await expectStatus(await setPages(["reports"], null), 401);
  await expectStatus(await setPages(["unknown"]), 400);
  await expectStatus(await setPages(["reports", "reports"]), 400);
  const disabled = ["overview", "catalog", "posPaymentTypes", "salesList", "orders", "reports", "tables"];
  assert.deepEqual(await expectStatus(await setPages(disabled), 200), {
    disabledControlPages: disabled,
  });
  const detail = await expectStatus(
    await superRequest("biz_a", undefined, "GET", "super@example.test", ""),
    200,
  );
  assert.deepEqual(detail.business.disabledControlPages, disabled);
  const access = await expectStatus(await admin("workspace-access"), 200);
  assert.deepEqual(
    access.accessibleControlPages,
    allPages.filter((page) => !disabled.includes(page)),
  );
  const workspace = await expectStatus(await admin("workspace"), 200);
  assert.equal(workspace.business.id, "biz_a");
  assert.equal(workspace.counts, null);

  for (const [path, method] of [
    ["overview", "GET"],
    ["orders", "GET"],
    ["pos/sales", "GET"],
    ["pos/payment-types", "GET"],
    ["reports/menu-analytics", "GET"],
    ["reports/menu-analytics.csv", "GET"],
    ["products", "POST"],
    ["tables", "POST"],
    ["table-groups", "POST"],
  ]) {
    const result = await expectStatus(
      await admin(path, "owner-a", method),
      403,
    );
    assert.equal(result.code, "CONTROL_PAGE_DISABLED");
  }
  await expectStatus(await admin("tables"), 200); // QR Designs uses this read.
  await expectStatus(await admin("catalog"), 200); // Manage Prices and Appearance use this read.
  assert.deepEqual(
    (await expectStatus(await admin("workspace-access", "owner-b"), 200))
      .accessibleControlPages,
    allPages,
  );

  await expectStatus(await setPages(allPages), 200);
  assert.deepEqual(
    (await expectStatus(await admin("workspace-access"), 200))
      .accessibleControlPages,
    [],
  );
  await expectStatus(await admin("workspace"), 200);
  for (const path of ["catalog", "price-lists", "tables", "qr-designs"]) {
    await expectStatus(await admin(path), 403);
  }
  await expectStatus(
    await request("/api/public/businesses/test-a/menu", undefined, null, "GET"),
    200,
  );
  await expectStatus(await setPages([]), 200);
  await expectStatus(await admin("overview"), 200);
  const editorPages = (await expectStatus(await admin("workspace-access", "editor-a"), 200)).accessibleControlPages;
  assert.equal(editorPages.some((page) => ["reports", "sellingOverview", "posProfiles", "posPaymentTypes", "salesList"].includes(page)), false);
  await expectStatus(await admin("pos/sales", "editor-a"), 403);
});

test("Super Control manages branches and POS tables inherit their chosen branch", async () => {
  const defaultBranch = (await expectStatus(await superRequest("biz_a",undefined,"GET","super@example.test","branches"),200)).branches[0];
  assert.equal(defaultBranch.slug,"main");
  assert.equal(defaultBranch.isDefault,1);
  await expectStatus(await superRequest("biz_a",undefined,"GET",null,"branches"),401);
  await expectStatus(await superRequest("biz_a",{ name: "Main",isActive: false },"PUT","super@example.test",`branches/${defaultBranch.id}`),400);
  const defaultPath = `branches/${defaultBranch.id}`;
  const setDefaultOrderPolicy = (body) => superRequest("biz_a",body,"PUT","super@example.test",defaultPath);
  await expectStatus(await setDefaultOrderPolicy({ latitude: 11 }),400);
  await expectStatus(await setDefaultOrderPolicy({ enableSubmitOrder: true }),400);
  const configured = (await expectStatus(await setDefaultOrderPolicy({
    latitude: 11, longitude: 104, enableSubmitOrder: true, orderRadiusMeters: 80,
  }),200)).branches[0];
  assert.deepEqual(
    [configured.latitude, configured.longitude, configured.enableSubmitOrder, configured.orderRadiusMeters],
    [11, 104, 1, 80],
  );
  const inherited = (await expectStatus(await setDefaultOrderPolicy({
    latitude: null, longitude: null, enableSubmitOrder: null, orderRadiusMeters: null,
  }),200)).branches[0];
  assert.deepEqual(
    [inherited.latitude, inherited.longitude, inherited.enableSubmitOrder, inherited.orderRadiusMeters],
    [null, null, null, null],
  );
  const { branches } = await expectStatus(await superRequest("biz_a",{
    name: "Riverside",slug: "riverside",latitude: 11,longitude: 104,orderRadiusMeters: 150,
  },"POST","super@example.test","branches"),200);
  const branch = branches.find(({ slug }) => slug === "riverside");
  assert.equal(branch.orderRadiusMeters,150);
  const [groupA,groupB,tableA,tableB] = Array.from({ length: 4 }, () => randomUUID());
  await expectStatus(await syncTables({
    table_groups: [{ id: groupA,name: "Terrace" },{ id: groupB,name: "Terrace",branch_id: branch.id }],
    tables: [{ id: tableA,group_id: groupA,code: "T1" },{ id: tableB,group_id: groupB,code: "T1" }],
  }),200);
  const getTable = (id) => db.prepare("SELECT branch_id,public_token FROM restaurant_tables WHERE id=?").bind(id).first();
  assert.equal((await getTable(tableA)).branch_id,defaultBranch.id);
  const stored = await getTable(tableB);
  assert.equal(stored.branch_id,branch.id);
  await expectStatus(await syncTables({ table_groups: [{ id: groupB,name: "Outside" }],tables: [] }),200);
  assert.deepEqual(await getTable(tableB),stored);
  await expectStatus(await syncTables({ table_groups: [],tables: [{ id: tableB,group_id: groupA }] }),400);
  const publicTable = `/api/public/businesses/test-a/table-context/${stored.public_token}`;
  await expectStatus(await request(publicTable,undefined,null,"GET"),404);
  await expectStatus(await request(`${publicTable}?branch=riverside`,undefined,null,"GET"),200);
  await expectStatus(await superRequest("biz_a",{ name: "Riverside",isActive: false },"PUT","super@example.test",`branches/${branch.id}`),200);
  await expectStatus(await request(`${publicTable}?branch=riverside`,undefined,null,"GET"),404);
});

test("portion branch scopes work through catalog sync, product sync, and dashboard edits", async () => {
  await db.prepare(`INSERT INTO branches (id,business_id,slug,name) VALUES
    ('br_river','biz_a','riverside','Riverside'),('br_foreign','biz_b','foreign','Foreign')`).run();
  const portions = [
    { id: PORTION, label_km: "Shared", price: 4, branch_id: null },
    { id: PORTION2, label_km: "Riverside", price: 2, branch_id: "br_river" },
    { id: "legacy", label_km: "Legacy", price: 5 },
  ];
  await expectStatus(await sync(payload({
    products: [{ id: PRODUCT, category_id: CAT, name_en: "Coffee", portions }],
  })), 200);
  const menu = async (branch = "") => (await expectStatus(await request(
    `/api/public/businesses/test-a/menu${branch}`, undefined, null, "GET",
  ), 200)).products;
  const check = async (branch, ids, min, max) => {
    const product = (await menu(branch)).find(({ id }) => id === PRODUCT);
    assert.deepEqual(product.portions.map(({ id }) => id), ids);
    assert.equal(product.priceCents, min);
    assert.equal(product.maxPrice, max);
  };
  await check("", [PORTION, "legacy"], 4, 5);
  await check("?branch=riverside", [PORTION, PORTION2, "legacy"], 2, 5);

  const invalid = await expectStatus(await syncProduct({
    product: { id: PRODUCT, portions: [{ ...portions[1], branch_id: "br_foreign" }] },
  }), 400);
  assert.match(invalid.error, /branch_id/);
  await check("?branch=riverside", [PORTION, PORTION2, "legacy"], 2, 5);

  await expectStatus(await syncProduct({ product: { id: PRODUCT, portions: [portions[1]] } }), 200);
  assert.equal((await menu()).some(({ id }) => id === PRODUCT), false);
  await check("?branch=riverside", [PORTION2], 2, 2);
  await expectStatus(await syncProduct({ product: { id: PRODUCT, name_en: "Renamed coffee" } }), 200);
  await check("?branch=riverside", [PORTION2], 2, 2);

  const adminProduct = {
    nameKm: "Tea", categoryId: CAT,
    portions: [{ id: "admin-portion", labelKm: "Cup", priceCents: 3, branchId: "br_river" }],
  };
  const created = await expectStatus(await request("/api/admin/products", adminProduct, "owner-a"), 201);
  assert.equal((await menu()).some(({ id }) => id === created.id), false);
  await expectStatus(await request(`/api/admin/products/${created.id}`, {
    ...adminProduct, portions: [{ ...adminProduct.portions[0], branchId: null }],
  }, "owner-a", "PUT"), 200);
  assert.equal((await menu()).find(({ id }) => id === created.id).portions[0].branchId, null);
});

test("QR designs retain the menu and branch selected for table exports", async () => {
  const path = "/api/admin/qr-designs";
  const design = {
    name: "Table QR",
    targetType: "table",
    config: { branchSlug: "main-branch", menuSlug: "main-menu" },
  };
  const created = await expectStatus(await request(path, design, "owner-a"), 201);
  const load = async () => {
    const { designs } = await expectStatus(await request(path, undefined, "owner-a", "GET"), 200);
    return designs.find(({ id }) => id === created.id);
  };
  const saved = await load();
  assert.equal(saved.config.menuSlug, "main-menu");
  assert.equal(saved.config.branchSlug, "main-branch");
  assert.equal(saved.config.showTableGroup, true);
  assert.equal(saved.config.tablePrefix, "");

  await expectStatus(await request(`${path}/${created.id}`, {
    ...saved,
    config: {
      ...saved.config,
      menuSlug: "takeout",
      showTableGroup: false,
      tablePrefix: " Table ",
    },
  }, "owner-a", "PUT"), 200);
  const updated = await load();
  assert.equal(updated.config.menuSlug, "takeout");
  assert.equal(updated.config.branchSlug, "main-branch");
  assert.equal(updated.config.showTableGroup, false);
  assert.equal(updated.config.tablePrefix, "Table");
});

test("POS menu snapshots and product patches preserve local menus and reject stale or invalid trees", async () => {
  const admin = (path,body,method = "POST") => request(`/api/admin/${path}`,body,"owner-a",method);
  const publicMenu = (query = "") => request(`/api/public/businesses/test-a/menu${query}`,undefined,null,"GET");
  const local = await expectStatus(await admin("menus",{ nameEn: "Local menu",slug: "local" }),201);
  const localSection = await expectStatus(await admin("menus",{ nameKm: "ក្នុងហាង",parentId: local.id,sortOrder: 3 }),201);
  await expectStatus(await admin(`menus/${localSection.id}`,{ nameKm: "ក្នុងហាង",parentId: localSection.id },"PUT"),409);
  const snapshot = payload({
    menus: [
      { id: POS_SECTION,parent_id: POS_MENU,name_zh: "饮品",sort_order: 2 },
      { id: POS_MENU,slug: "pos-cafe",name_en: "Cafe",image_media_id: "media_a" },
    ],
    menu_products: [{ menu_id: POS_SECTION,product_id: PRODUCT }],
  });
  await expectStatus(await sync({
    ...snapshot,
    sync_id: randomUUID(),
    menu_products: [{ menu_id: POS_MENU, product_id: PRODUCT }],
  }),400);
  await expectStatus(await sync(snapshot),200);
  await expectStatus(await sync(snapshot),200);
  await expectStatus(await admin(`products/${PRODUCT}`,{
    nameKm: "កាហ្វេ",categoryId: CAT,priceCents: 2.5,menuIds: [localSection.id,localSection.id],
  },"PUT"),200);
  const rootAssignment = {
    nameKm: "កាហ្វេ", categoryId: CAT, priceCents: 2.5, menuIds: [local.id, localSection.id],
  };
  await expectStatus(await admin("products", rootAssignment),400);
  await expectStatus(await admin(`products/${PRODUCT}`, rootAssignment, "PUT"),400);
  await expectStatus(await syncProduct({
    source_updated_at: "2026-11-07T02:00:00Z",
    product: { id: PRODUCT, menu_ids: [POS_MENU, POS_SECTION] },
  }),400);
  const pos = await expectStatus(await publicMenu("?menu=pos-cafe"),200);
  assert.deepEqual(pos.menu, { id: POS_MENU, slug: "pos-cafe" });
  assert.deepEqual(pos.categories.map(({ id, parentId }) => [id, parentId]), [[POS_SECTION, null]]);
  assert.equal(pos.categories.find(({ id }) => id === POS_SECTION).nameZh,"饮品");
  assert.deepEqual(pos.products[0].menuIds,[POS_SECTION]);
  const localData = await expectStatus(await publicMenu("?menu=local"),200);
  assert.deepEqual(localData.products[0].menuIds,[localSection.id]);
  await expectStatus(await sync(payload({ source_updated_at: "2026-11-07T01:00:00Z" })),200);
  assert.equal((await expectStatus(await publicMenu("?menu=pos-cafe"),200)).products.length,1);
  await expectStatus(await syncProduct({ source_updated_at: "2026-11-07T03:00:00Z",
    product: { id: PRODUCT,menu_ids: [] } }),200);
  assert.equal((await expectStatus(await publicMenu("?menu=pos-cafe"),200)).products.length,0);
  await expectStatus(await sync({ ...snapshot,sync_id: randomUUID(),source_updated_at: "2026-11-07T02:00:00Z" }),409);
  const unrelated = randomUUID();
  const bad = { source_updated_at: "2026-11-07T04:00:00Z",categories: [],products: [],menu_products: [],
    menus: [{ id: unrelated,parent_id: unrelated,name_en: "Cycle" }] };
  await expectStatus(await sync(bad),400);
  await expectStatus(await sync({ ...bad,menus: [],menu_products: [{ menu_id: POS_MENU,product_id: PRODUCT }] }),400);
  await expectStatus(await sync({ ...bad,menus: [] }),200);
  await expectStatus(await publicMenu("?menu=pos-cafe"),404);
  assert.equal((await expectStatus(await publicMenu("?menu=local"),200)).products.length,1);
  assert.equal((await expectStatus(await publicMenu(),200)).products[0].categoryId,CAT);
});

test("eMenu edits, submenus and product assignments under POS menus survive sync", async () => {
  const admin = (path, body, method = "GET", token = "owner-a") =>
    request(`/api/admin/${path}`, body, token, method);
  const snapshot = payload({
    products: [
      { id: PRODUCT, category_id: CAT, name: "Coffee", price: 3 },
      { id: PRODUCT2, category_id: CAT, name: "Tea", price: 2 },
    ],
    menus: [
      { id: POS_MENU, slug: "pos-cafe", name_en: "Cafe", image_url: "https://example.com/cafe.png" },
      { id: POS_SECTION, parent_id: POS_MENU, name_en: "Drinks" },
    ],
    menu_products: [{ menu_id: POS_SECTION, product_id: PRODUCT2 }],
  });
  await expectStatus(await sync(snapshot), 200);
  const edit = { nameEn: "eMenu Cafe", sortOrder: 7, imageMediaId: "", isActive: true };
  await expectStatus(await admin(`menus/${POS_MENU}`, edit, "PUT", "owner-b"), 404);
  await expectStatus(await admin(`menus/${POS_MENU}`, edit, "PUT"), 200);
  const local = await expectStatus(await admin("menus", { nameEn: "Specials", parentId: POS_MENU }, "POST"), 201);
  const productIds = { productIds: [PRODUCT] };
  const posProducts = `menus/${POS_SECTION}/products`;
  await expectStatus(await admin(`menus/${POS_MENU}/products`, productIds, "POST"), 400);
  await expectStatus(await admin(posProducts, productIds, "POST"), 200);
  await expectStatus(await admin(`menus/${local.id}/products`, productIds, "POST"), 200);

  await expectStatus(await sync({
    ...snapshot, sync_id: randomUUID(), source_updated_at: "2026-11-07T01:00:00Z",
    menus: [{ ...snapshot.menus[0], name_en: "Renamed in POS", is_active: 0 }, snapshot.menus[1]],
  }), 200);
  await expectStatus(await syncProduct({
    source_updated_at: "2026-11-07T02:00:00Z",
    product: { id: PRODUCT, menu_ids: [] },
  }), 200);
  const { menus } = await expectStatus(await admin("menus"), 200);
  const { nameEn, sortOrder, isActive, imageUrl } = menus.find(({ id }) => id === POS_MENU);
  assert.deepEqual({ nameEn, sortOrder, isActive, imageUrl }, {
    nameEn: "eMenu Cafe", sortOrder: 7, isActive: 1, imageUrl: "https://example.com/cafe.png",
  });
  assert.equal(menus.find(({ id }) => id === local.id).parentId, POS_MENU);
  const publicMenu = await expectStatus(await request(
    "/api/public/businesses/test-a/menu?menu=pos-cafe", undefined, null, "GET",
  ), 200);
  assert.deepEqual(new Set(publicMenu.products.find(({ id }) => id === PRODUCT).menuIds), new Set([POS_SECTION, local.id]));
  const { products } = await expectStatus(await admin(posProducts), 200);
  assert.equal(products.find(({ id }) => id === PRODUCT).assignedInAdmin, 1);
  await expectStatus(await admin(posProducts, productIds, "DELETE"), 200);
  assert.deepEqual((await expectStatus(await admin(posProducts), 200)).products.map(({ id }) => id), [PRODUCT2]);
  await expectStatus(await admin(posProducts, productIds, "POST"), 200);
  const selection = await expectStatus(await admin(`${posProducts}?ids=1`), 200);
  assert.deepEqual(new Set(selection.productIds), new Set([PRODUCT, PRODUCT2]));
  await expectStatus(await admin(posProducts, selection, "DELETE", "owner-b"), 404);
  await expectStatus(await admin(posProducts, selection, "DELETE"), 200);
  await expectStatus(await admin(posProducts, selection, "DELETE"), 200);
  assert.deepEqual((await expectStatus(await admin(posProducts), 200)).products, []);

  await expectStatus(await sync({
    ...snapshot, sync_id: randomUUID(), source_updated_at: "2026-11-07T03:00:00Z",
  }), 200);
  assert.deepEqual((await expectStatus(await admin(posProducts), 200)).products, []);
  await expectStatus(await syncProduct({
    source_updated_at: "2026-11-07T04:00:00Z",
    product: { id: PRODUCT2, menu_ids: [POS_SECTION] },
  }), 200);
  assert.deepEqual((await expectStatus(await admin(posProducts), 200)).products, []);
  const afterUnassign = await expectStatus(await request(
    "/api/public/businesses/test-a/menu?menu=pos-cafe", undefined, null, "GET",
  ), 200);
  assert.deepEqual(afterUnassign.products.map(({ id, menuIds }) => ({ id, menuIds })), [
    { id: PRODUCT, menuIds: [local.id] },
  ]);

  await expectStatus(await admin(posProducts, { productIds: [PRODUCT2] }, "POST"), 200);
  assert.deepEqual((await expectStatus(await admin(posProducts), 200)).products.map(({ id }) => id), [PRODUCT2]);
  const { deletedIds } = await expectStatus(await admin(`menus/${POS_MENU}?includeSubmenus=1`, undefined, "DELETE"), 200);
  assert.deepEqual(new Set(deletedIds), new Set([POS_MENU, POS_SECTION, local.id]));
  assert.deepEqual((await expectStatus(await admin("menus"), 200)).menus, []);
});

test("POS menu snapshots can restore the hierarchy without breaking an earlier root QR link", async () => {
  const baseMenu = randomUUID();
  const otherRoot = randomUUID();
  const publicMenu = (slug) =>
    request(`/api/public/businesses/test-a/menu?menu=${slug}`, undefined, null, "GET");
  await expectStatus(await sync(payload({
    menus: [
      { id: POS_MENU, slug: "previous-root", name_en: "Coffee" },
      { id: POS_SECTION, parent_id: POS_MENU, slug: "coffee-section", name_en: "Drinks" },
    ],
    menu_products: [{ menu_id: POS_SECTION, product_id: PRODUCT }],
  })), 200);
  assert.equal((await expectStatus(await publicMenu("previous-root"), 200)).products[0].id, PRODUCT);

  const moved = {
    source_updated_at: "2026-11-07T01:00:00Z",
    categories: [],
    products: [],
    menus: [
      { id: baseMenu, slug: "root-menu", name_en: "Root Menu" },
      { id: otherRoot, slug: "other-menu", name_en: "Other Menu" },
      { id: POS_MENU, parent_id: baseMenu, name_en: "Coffee" },
      { id: POS_SECTION, name_en: "Drinks" },
    ],
    menu_products: [{ menu_id: POS_MENU, product_id: PRODUCT }],
  };
  await expectStatus(await sync(moved), 200);
  const base = await expectStatus(await publicMenu("root-menu"), 200);
  assert.deepEqual(base.products[0].menuIds, [POS_MENU]);
  assert.equal(base.categories.find(({ id }) => id === POS_MENU).parentId, null);
  assert.equal(
    await db.prepare("SELECT parent_id FROM menus WHERE id=?").bind(POS_SECTION).first("parent_id"),
    POS_MENU,
  );
  const old = await expectStatus(await publicMenu("previous-root"), 200);
  assert.equal(old.menu.id, POS_MENU);
  assert.equal(old.products[0].id, PRODUCT);
  assert.equal(old.categories.find(({ id }) => id === POS_MENU).parentId, null);
  assert.equal((await expectStatus(await publicMenu("other-menu"), 200)).products.length, 0);
  await expectStatus(await publicMenu("coffee-section"), 404);

  await expectStatus(await sync({
    ...moved,
    source_updated_at: "2026-11-07T02:00:00Z",
    menus: [{ ...moved.menus[0], is_active: false }, ...moved.menus.slice(1)],
  }), 200);
  await expectStatus(await publicMenu("previous-root"), 404);
});

test("admin deletion removes POS menu rows and links while keeping orders", async () => {
  const checkout = await prepareNotificationCheckout();
  const keptRoot = randomUUID();
  const keptSection = randomUUID();
  const legacySection = randomUUID();
  const snapshot = payload({
    source_updated_at: "2026-11-07T01:00:00Z",
    menus: [
      { id: POS_MENU, name_en: "Main menu", slug: "pos-main" },
      { id: POS_SECTION, parent_id: POS_MENU, name_en: "Coffee" },
      { id: legacySection, parent_id: POS_SECTION, name_en: "Archived drinks" },
      { id: keptRoot, name_en: "Takeout" },
      { id: keptSection, parent_id: keptRoot, name_en: "Takeout drinks" },
    ],
    menu_products: [
      { menu_id: POS_SECTION, product_id: PRODUCT },
      { menu_id: keptSection, product_id: PRODUCT },
    ],
  });
  await expectStatus(await sync(snapshot), 200);
  const receipt = await expectStatus(await request("/api/public/businesses/test-a/orders", {
    ...checkout, menu: "pos-main",
  }, null), 201);
  await db.prepare("UPDATE menus SET is_active=0, deleted_in_admin=1 WHERE id=?")
    .bind(legacySection).run();

  const path = `/api/admin/menus/${POS_MENU}`;
  await expectStatus(await request(path, undefined, "owner-a", "DELETE"), 409);
  await expectStatus(await request(`${path}?includeSubmenus=1`, undefined, "owner-b", "DELETE"), 404);
  const { deletedIds } = await expectStatus(
    await request(`${path}?includeSubmenus=1`, undefined, "owner-a", "DELETE"), 200,
  );
  assert.deepEqual(new Set(deletedIds), new Set([POS_MENU, POS_SECTION, legacySection]));
  const savedMenus = await db.prepare("SELECT id FROM menus WHERE business_id='biz_a'").all();
  assert.deepEqual(new Set(savedMenus.results.map(({ id }) => id)), new Set([keptRoot, keptSection]));
  const assignments = await db.prepare("SELECT menu_id, product_id FROM menu_products").all();
  assert.deepEqual(assignments.results, [{ menu_id: keptSection, product_id: PRODUCT }]);
  await expectStatus(await request("/api/public/businesses/test-a/menu?menu=pos-main", undefined, null, "GET"), 404);
  await expectStatus(await request(`/api/admin/menus/${POS_SECTION}/products`, undefined, "owner-a", "GET"), 404);
  assert.deepEqual(
    await db.prepare("SELECT menu_id FROM orders WHERE id=?").bind(receipt.orderId).first(),
    { menu_id: null },
  );

  await expectStatus(await sync({
    ...snapshot,
    sync_id: randomUUID(),
    source_updated_at: "2026-11-07T02:00:00Z",
    menus: snapshot.menus.filter(({ id }) => id !== legacySection),
  }), 200);
  const restored = await expectStatus(await request(
    "/api/public/businesses/test-a/menu?menu=pos-main", undefined, null, "GET",
  ), 200);
  assert.deepEqual(restored.products.find(({ id }) => id === PRODUCT).menuIds, [POS_SECTION]);
});

test("admin menu reorder persists sibling order and rejects changes to other menus", async () => {
  const admin = (path, body, method = "GET") =>
    request(`/api/admin/${path}`, body, "owner-a", method);
  const create = (nameEn, parentId = null) =>
    admin("menus", { nameEn, parentId }, "POST").then((response) => expectStatus(response, 201));
  const reorder = (parentId, menuIds, move) =>
    admin("menus/reorder", { parentId, menuIds, move }, "PUT");
  const root = await create("Main menu");
  const otherRoot = await create("Takeout");
  const first = await create("Coffee", root.id);
  const second = await create("Tea", root.id);
  const otherChild = await create("Desserts", otherRoot.id);
  await expectStatus(await sync(payload({
    menus: [{ id: POS_MENU, slug: "pos-cafe", name_en: "POS menu", sort_order: 7 }],
    menu_products: [],
  })), 200);

  await expectStatus(await reorder(root.id, [second.id, otherChild.id]), 409);
  await expectStatus(await reorder(null, [otherRoot.id, POS_MENU]), 409);
  await expectStatus(await reorder(root.id, [second.id, second.id]), 400);
  const before = await expectStatus(await admin("menus"), 200);
  assert.ok(before.menus.filter(({ source }) => source === "local").every(({ sortOrder }) => sortOrder === 0));

  await expectStatus(await reorder(null, [otherRoot.id, root.id]), 200);
  await expectStatus(await reorder(root.id, [second.id, first.id]), 200);
  const { menus } = await expectStatus(await admin("menus"), 200);
  assert.deepEqual(menus.filter(({ parentId }) => !parentId).map(({ id }) => id),
    [otherRoot.id, root.id, POS_MENU]);
  assert.deepEqual(menus.filter(({ parentId }) => parentId === root.id).map(({ id }) => id),
    [second.id, first.id]);
  assert.equal(menus.find(({ id }) => id === POS_MENU).sortOrder, 7);
  assert.equal(menus.find(({ id }) => id === otherChild.id).parentId, otherRoot.id);

  for (const section of [first, second]) {
    await expectStatus(await admin(`menus/${section.id}/products`, { productIds: [PRODUCT] }, "POST"), 200);
  }
  const slug = menus.find(({ id }) => id === root.id).slug;
  const publicMenu = await expectStatus(await request(
    `/api/public/businesses/test-a/menu?menu=${slug}`, undefined, null, "GET",
  ), 200);
  assert.deepEqual(publicMenu.categories.map(({ id }) => id), [second.id, first.id]);

  const nested = await create("Iced tea", second.id);
  const move = { id: second.id, fromParentId: root.id };
  await expectStatus(await reorder(nested.id, [second.id], move), 409);
  await expectStatus(await reorder(POS_MENU, [second.id], move), 409);
  await expectStatus(await reorder(null, [second.id], move), 400);
  await expectStatus(await reorder(otherRoot.id, [second.id], move), 409);
  const unchanged = await expectStatus(await admin("menus"), 200);
  assert.deepEqual(unchanged.menus.filter(({ parentId }) => parentId === root.id).map(({ id }) => id),
    [second.id, first.id]);

  await expectStatus(await reorder(otherRoot.id, [second.id, otherChild.id], move), 200);
  const moved = await expectStatus(await admin("menus"), 200);
  assert.deepEqual(moved.menus.filter(({ parentId }) => parentId === otherRoot.id).map(({ id }) => id),
    [second.id, otherChild.id]);
  assert.equal(moved.menus.find(({ id }) => id === nested.id).parentId, second.id);
  const otherSlug = moved.menus.find(({ id }) => id === otherRoot.id).slug;
  const newPublicMenu = await expectStatus(await request(
    `/api/public/businesses/test-a/menu?menu=${otherSlug}`, undefined, null, "GET",
  ), 200);
  assert.deepEqual(newPublicMenu.products.find(({ id }) => id === PRODUCT).menuIds, [second.id]);

  await expectStatus(await reorder(otherChild.id, [first.id], { id: first.id, fromParentId: root.id }), 200);
  const emptyDestination = await expectStatus(await admin("menus"), 200);
  const movedToEmpty = emptyDestination.menus.find(({ id }) => id === first.id);
  assert.equal(movedToEmpty.parentId, otherChild.id);
  assert.equal(movedToEmpty.sortOrder, 0);
});

test("admin menu sorting includes POS menus and preserves their order after sync", async () => {
  const admin = (path, body, method = "GET") => request(`/api/admin/${path}`, body, "owner-a", method);
  const create = (nameEn, parentId = null) =>
    admin("menus", { nameEn, parentId }, "POST").then((response) => expectStatus(response, 201));
  const sort = (parentId, menuIds) => admin("menus/reorder", { parentId, menuIds, includePos: true }, "PUT");
  const snapshot = payload({
    menus: [
      { id: POS_MENU, slug: "pos-cafe", name_en: "Cafe", sort_order: 7 },
      { id: POS_SECTION, parent_id: POS_MENU, name_en: "Drinks", sort_order: 7 },
    ],
    menu_products: [{ menu_id: POS_SECTION, product_id: PRODUCT }],
  });
  await expectStatus(await sync(snapshot), 200);
  const localRoot = await create("Takeout");
  const localChild = await create("Specials", POS_MENU);
  await expectStatus(await admin(`menus/${localChild.id}/products`, { productIds: [PRODUCT] }, "POST"), 200);

  const before = await version();
  await expectStatus(await sort(null, [POS_MENU, localChild.id]), 409);
  assert.equal(await version(), before);
  await expectStatus(await sort(null, [POS_MENU, localRoot.id]), 200);
  await expectStatus(await sort(POS_MENU, [POS_SECTION, localChild.id]), 200);

  await expectStatus(await sync({
    ...snapshot, sync_id: randomUUID(), source_updated_at: "2026-11-07T01:00:00Z",
    menus: snapshot.menus.map((menu) => ({ ...menu, name_en: "Renamed in POS", sort_order: 20 })),
  }), 200);
  const { menus } = await expectStatus(await admin("menus"), 200);
  assert.deepEqual(menus.filter(({ parentId }) => parentId === null).map(({ id }) => id), [POS_MENU, localRoot.id]);
  assert.deepEqual(menus.filter(({ parentId }) => parentId === POS_MENU).map(({ id }) => id), [POS_SECTION, localChild.id]);
  assert.equal(menus.find(({ id }) => id === POS_SECTION).nameEn, "Renamed in POS");
  const publicMenu = await expectStatus(await request(
    "/api/public/businesses/test-a/menu?menu=pos-cafe", undefined, null, "GET",
  ), 200);
  assert.deepEqual(publicMenu.categories.map(({ id }) => id), [POS_SECTION, localChild.id]);
});

test("admin tree ordering moves a POS submenu with its descendants and preserves the move through sync", async () => {
  const admin = (path, body, method = "GET") => request(`/api/admin/${path}`, body, "owner-a", method);
  const create = (nameEn, parentId = null) =>
    admin("menus", { nameEn, parentId }, "POST").then((response) => expectStatus(response, 201));
  const snapshot = payload({
    menus: [
      { id: POS_MENU, slug: "pos-cafe", name_en: "Cafe", sort_order: 0 },
      { id: POS_SECTION, parent_id: POS_MENU, name_en: "Drinks", sort_order: 0 },
    ],
    menu_products: [{ menu_id: POS_SECTION, product_id: PRODUCT }],
  });
  await expectStatus(await sync(snapshot), 200);
  const localRoot = await create("Takeout");
  const localLeaf = await create("Specials", POS_SECTION);
  const list = () => admin("menus").then((response) => expectStatus(response, 200));
  const { menus } = await list();
  const before = menus.map(({ id, parentId, sortOrder }) => ({ id, parentId, sortOrder }));
  const save = (updates) => admin("menus/tree-order", { before, updates }, "PUT");
  const versionBefore = await version();
  await expectStatus(await save([{ id: POS_SECTION, parentId: localLeaf.id, sortOrder: 0 }]), 400);
  await expectStatus(await save([{ id: POS_MENU, parentId: localRoot.id, sortOrder: 0 }]), 400);
  assert.equal(await version(), versionBefore);

  const updates = [
    { id: localRoot.id, parentId: null, sortOrder: 0 },
    { id: POS_MENU, parentId: null, sortOrder: 1 },
    { id: POS_SECTION, parentId: localRoot.id, sortOrder: 0 },
  ];
  await expectStatus(await save(updates), 200);
  await expectStatus(await save(updates), 409);
  assert.equal(await version(), versionBefore + 1);
  const nextSnapshot = {
    ...snapshot,
    sync_id: randomUUID(),
    source_updated_at: "2026-11-07T01:00:00Z",
    menus: [snapshot.menus[0], { id: POS_SECTION, name_en: "Renamed drinks", sort_order: 20 }],
  };
  await expectStatus(await sync(nextSnapshot), 200);
  const { menus: updated } = await list();
  assert.deepEqual(updated.filter(({ parentId }) => parentId === null).map(({ id }) => id), [localRoot.id, POS_MENU]);
  const section = updated.find(({ id }) => id === POS_SECTION);
  assert.equal(section.parentId, localRoot.id);
  assert.equal(section.sortOrder, 0);
  assert.equal(section.nameEn, "Renamed drinks");
  assert.equal(updated.find(({ id }) => id === localLeaf.id).parentId, POS_SECTION);
  const rootSlug = updated.find(({ id }) => id === localRoot.id).slug;
  const publicMenu = await expectStatus(await request(
    `/api/public/businesses/test-a/menu?menu=${rootSlug}`, undefined, null, "GET",
  ), 200);
  assert.deepEqual(publicMenu.products[0].menuIds, [POS_SECTION]);
});

test("admin menu deletion confirms submenus and removes only assignments in the deleted branch", async () => {
  const checkout = await prepareNotificationCheckout();
  const admin = (path, body, method = "GET", token = "owner-a") =>
    request(`/api/admin/${path}`, body, token, method);
  const create = (nameEn, parentId = null, slug) =>
    admin("menus", { nameEn, parentId, slug }, "POST").then((response) => expectStatus(response, 201));
  const root = await create("Main menu", null, "main");
  const section = await create("Drinks", root.id);
  const nested = await create("Coffee", section.id);
  const otherRoot = await create("Takeout");
  const otherSection = await create("Takeout drinks", otherRoot.id);
  for (const { id } of [section, nested, otherSection]) {
    await expectStatus(await admin(`menus/${id}/products`, { productIds: [PRODUCT] }, "POST"), 200);
  }
  const receipt = await expectStatus(await request("/api/public/businesses/test-a/orders", {
    ...checkout, menu: "main",
  }, null), 201);
  const readOrder = () => db.prepare("SELECT id, menu_id, total_amount FROM orders WHERE id=?")
    .bind(receipt.orderId).first();
  const beforeOrder = await readOrder();
  assert.equal(beforeOrder.menu_id, root.id);
  const loadPublic = () => request("/api/public/businesses/test-a/menu?menu=main", undefined, null, "GET");
  await expectStatus(await loadPublic(), 200);

  const remove = (id, includeSubmenus = false, token = "owner-a") =>
    admin(`menus/${id}${includeSubmenus ? "?includeSubmenus=1" : ""}`, undefined, "DELETE", token);
  const before = await version();
  await expectStatus(await remove(root.id), 409);
  await expectStatus(await remove(root.id, true, "owner-b"), 404);
  assert.equal(await version(), before);
  assert.deepEqual(await readOrder(), beforeOrder);

  const { deletedIds } = await expectStatus(await remove(root.id, true), 200);
  assert.deepEqual(new Set(deletedIds), new Set([root.id, section.id, nested.id]));
  assert.equal(await version(), before + 1);
  await expectStatus(await loadPublic(), 404);
  assert.deepEqual(await readOrder(), { ...beforeOrder, menu_id: null });
  const assignments = await db.prepare("SELECT menu_id, product_id FROM menu_products").all();
  assert.deepEqual(assignments.results, [{ menu_id: otherSection.id, product_id: PRODUCT }]);
  assert.deepEqual(await expectStatus(await remove(otherSection.id), 200), { deletedIds: [otherSection.id] });
  const { products } = await expectStatus(await admin(`catalog?productId=${PRODUCT}`), 200);
  assert.deepEqual(products.map(({ id }) => id), [PRODUCT]);
  const { menus } = await expectStatus(await admin("menus"), 200);
  assert.deepEqual(menus.map(({ id }) => id), [otherRoot.id]);
});

test("bulk product deletion keeps ordered products and removes deleted menu assignments", async () => {
  const checkout = await prepareNotificationCheckout();
  const receipt = await expectStatus(await request("/api/public/businesses/test-a/orders", checkout, null), 201);
  await db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(receipt.orderId).run();

  const createMenu = (body) =>
    request("/api/admin/menus", body, "owner-a").then((response) => expectStatus(response, 201));
  const root = await createMenu({ nameEn: "Main menu", slug: "main" });
  const first = await createMenu({ nameEn: "First", parentId: root.id });
  const second = await createMenu({ nameEn: "Second", parentId: root.id });
  const menuIds = [first.id, second.id];
  const unused = await expectStatus(await request("/api/admin/products", {
    nameKm: "Tea", categoryId: CAT, priceCents: 2, menuIds,
  }, "owner-a"), 201);
  for (const menuId of menuIds) {
    await expectStatus(await request(`/api/admin/menus/${menuId}/products`, {
      productIds: [PRODUCT],
    }, "owner-a"), 200);
  }
  const loadMenu = () => request("/api/public/businesses/test-a/menu?menu=main", undefined, null, "GET")
    .then((response) => expectStatus(response, 200));
  assert.ok((await loadMenu()).products.some(({ id }) => id === unused.id));

  const productIds = [PRODUCT, unused.id];
  const remove = (token = "owner-a") => request("/api/admin/products/bulk-delete", { productIds }, token)
    .then((response) => expectStatus(response, 200));
  assert.deepEqual(await remove("owner-b"), { deletedIds: [], protectedIds: [] });
  const before = await version();
  assert.deepEqual(await remove(), { deletedIds: [unused.id], protectedIds: [PRODUCT] });
  assert.equal(await version(), before + 1);
  assert.deepEqual((await loadMenu()).products.map(({ id }) => id), [PRODUCT]);
  const assignments = await db.prepare("SELECT menu_id, product_id FROM menu_products WHERE business_id='biz_a'").all();
  assert.deepEqual(new Set(assignments.results.map(({ menu_id }) => menu_id)), new Set(menuIds));
  assert.ok(assignments.results.every(({ product_id }) => product_id === PRODUCT));
  assert.equal(await db.prepare("SELECT product_id FROM order_products WHERE order_id=?")
    .bind(receipt.orderId).first("product_id"), PRODUCT);

  await expectStatus(await request(`/api/admin/products/${PRODUCT}`, undefined, "owner-a", "DELETE"), 409);
  assert.deepEqual(await remove(), { deletedIds: [], protectedIds: [PRODUCT] });
  assert.equal(await version(), before + 1);
});

test("admin product order for a POS submenu survives catalog sync", async () => {
  const snapshot = payload({
    products: [
      { id: PRODUCT, category_id: CAT, name: "Coffee", price: 3, sort_order: 1 },
      { id: PRODUCT2, category_id: CAT, name: "Tea", price: 2, sort_order: 2 },
    ],
    menus: [
      { id: POS_MENU, slug: "pos-cafe", name_en: "Cafe" },
      { id: POS_SECTION, parent_id: POS_MENU, name_en: "Drinks" },
    ],
    menu_products: [PRODUCT, PRODUCT2].map((product_id) => ({ menu_id: POS_SECTION, product_id })),
  });
  await expectStatus(await sync(snapshot), 200);
  const orderPath = (id) => `/api/admin/menus/${id}/products/order`;
  const desired = [PRODUCT2, PRODUCT];
  await expectStatus(await request(orderPath(POS_MENU), { productIds: desired }, "owner-a", "PUT"), 400);
  await expectStatus(await request(orderPath(POS_SECTION), { productIds: desired }, "owner-a", "PUT"), 200);
  await expectStatus(await sync({
    ...snapshot, sync_id: randomUUID(), source_updated_at: "2026-11-07T01:00:00Z",
  }), 200);
  const { products } = await expectStatus(await request(orderPath(POS_SECTION), undefined, "owner-a", "GET"), 200);
  assert.deepEqual(products.map(({ id }) => id), desired);
  const publicMenu = await expectStatus(await request(
    "/api/public/businesses/test-a/menu?menu=pos-cafe", undefined, null, "GET",
  ), 200);
  assert.deepEqual(desired.map((id) => publicMenu.products.find((product) => product.id === id).menuSortOrders[POS_SECTION]), [0, 1]);
});

test("admin menu products support bulk assignment, scoped ordering and unassignment", async () => {
  const admin = (path, body, method = "GET", token = "owner-a") =>
    request(`/api/admin/${path}`, body, token, method);
  const createMenu = (body) => admin("menus", body, "POST").then((response) => expectStatus(response, 201));
  const root = await createMenu({ nameEn: "Patio", slug: "patio" });
  const first = await createMenu({ nameEn: "Drinks", parentId: root.id });
  const second = await createMenu({ nameEn: "Specials", parentId: root.id });
  const path = (menuId) => `menus/${menuId}/products`;
  const ids = (data) => data.products.map(({ id }) => id);
  const list = (menuId, suffix = "") => admin(path(menuId) + suffix).then((response) => expectStatus(response, 200));
  const publicMenu = () => request("/api/public/businesses/test-a/menu?menu=patio", undefined, null, "GET")
    .then((response) => expectStatus(response, 200));
  const teaCategory = randomUUID();
  await expectStatus(await sync(payload({
    categories: [
      { id: CAT, name: "Drinks" },
      { id: CHILD, parent_id: CAT, name: "Coffee" },
      { id: teaCategory, name: "Tea" },
    ],
    products: [
      { id: PRODUCT, category_id: CHILD, name: "Coffee", price: 3, sort_order: 9 },
      { id: PRODUCT2, category_id: teaCategory, name: "Tea", price: 2, sort_order: 2 },
    ],
  })), 200);

  assert.deepEqual(ids(await list(first.id, "?unassigned=1&query=coffee")), [PRODUCT]);
  assert.deepEqual(ids(await list(first.id, `?unassigned=1&categoryId=${CAT}`)), [PRODUCT]);
  assert.deepEqual(
    (await list(first.id, `?unassigned=1&categoryId=${CAT}&ids=1&page=999`)).productIds,
    [PRODUCT],
  );
  assert.deepEqual(
    (await list(first.id, `?unassigned=1&categoryId=${CAT}&ids=1&query=tea`)).productIds,
    [],
  );
  const menuWithCategories = await expectStatus(await admin("menus?includeCategories=1"), 200);
  assert.equal(menuWithCategories.categories.find(({ id }) => id === CHILD).parentId, CAT);
  await expectStatus(await admin(path(first.id), undefined, "GET", "owner-b"), 404);
  const both = { productIds: [PRODUCT, PRODUCT2] };
  const assignProduct = (productId, menuIds, token = "owner-a") =>
    admin("menus/assign-product", { productId, menuIds }, "POST", token);
  await expectStatus(await admin(path(root.id), both, "POST"), 400);
  await expectStatus(await admin(path(first.id), { productIds: [PRODUCT, randomUUID()] }, "POST"), 400);
  await expectStatus(await assignProduct(PRODUCT, [first.id, root.id]), 400);
  await expectStatus(await assignProduct(PRODUCT, [first.id, second.id], "owner-b"), 400);
  assert.deepEqual(ids(await list(first.id)), []);
  const catalogBeforeAssignment = await list(root.id, "?catalog=1&filter=unassigned-menu&includeCounts=1");
  assert.deepEqual(ids(catalogBeforeAssignment), [PRODUCT2, PRODUCT]);
  assert.ok(catalogBeforeAssignment.products.every(({ isAssigned }) => isAssigned === 0));
  assert.deepEqual(catalogBeforeAssignment.counts, {
    all: 2, published: 2, unpublished: 0, featured: 0, missingPhotos: 2, unassignedMenu: 2,
  });
  assert.deepEqual(
    ids(await list(root.id, `?catalog=1&filter=unassigned-menu&categoryId=${CAT}`)),
    [PRODUCT],
  );
  assert.deepEqual(
    ids(await list(first.id, `?catalog=1&filter=published&categoryId=${CAT}`)),
    [PRODUCT],
  );
  const catalogIds = await expectStatus(
    await admin("catalog?ids=matches&filter=published&pageSize=1&page=999"), 200,
  );
  assert.deepEqual(new Set(catalogIds.productIds), new Set(both.productIds));
  const filteredCatalogIds = await expectStatus(
    await admin(`catalog?ids=matches&categoryId=${CAT}&query=coffee&filter=published`), 200,
  );
  assert.deepEqual(filteredCatalogIds.productIds, [PRODUCT]);
  const filteredMenuIds = await list(root.id,
    `?catalog=1&ids=matches&filter=unassigned-menu&categoryId=${CAT}&query=coffee&page=999`,
  );
  assert.deepEqual(filteredMenuIds.productIds, [PRODUCT]);

  await expectStatus(await assignProduct(PRODUCT, [first.id, second.id]), 200);
  await expectStatus(await assignProduct(PRODUCT, [first.id]), 200);
  assert.deepEqual(ids(await list(first.id)), [PRODUCT]);
  assert.deepEqual(ids(await list(second.id)), [PRODUCT]);
  for (const menu of [first, second]) {
    await expectStatus(await admin(path(menu.id), both, "POST"), 200);
  }
  assert.deepEqual(ids(await list(first.id)), [PRODUCT2, PRODUCT]);
  assert.deepEqual(ids(await list(root.id)), [PRODUCT2, PRODUCT]);
  assert.deepEqual((await list(root.id, "?includeCounts=1")).counts, {
    all: 2, published: 2, unpublished: 0, featured: 0, missingPhotos: 2, unassignedMenu: 0,
  });
  assert.deepEqual(ids(await list(root.id, `?categoryId=${CAT}`)), [PRODUCT]);
  assert.deepEqual(
    (await list(first.id, `?categoryId=${CAT}&ids=1&page=999`)).productIds,
    [PRODUCT],
  );
  assert.deepEqual((await list(first.id, "?unassigned=1&ids=1")).productIds, []);
  assert.deepEqual(ids(await list(first.id, "?unassigned=1")), []);
  assert.deepEqual((await publicMenu()).products.find(({ id }) => id === PRODUCT).menuSortOrders,
    { [first.id]: 9, [second.id]: 9 });

  await expectStatus(await admin(path(first.id) + "/order", both, "PUT"), 200);
  assert.deepEqual(ids(await list(first.id, "/order")), [PRODUCT, PRODUCT2]);
  assert.deepEqual(ids(await list(first.id, `/order?categoryId=${CAT}`)), [PRODUCT, PRODUCT2]);
  assert.deepEqual(ids(await list(second.id)), [PRODUCT2, PRODUCT]);
  assert.deepEqual((await publicMenu()).products.find(({ id }) => id === PRODUCT).menuSortOrders,
    { [first.id]: 0, [second.id]: 9 });
  await expectStatus(await admin(path(first.id), both, "POST"), 200);
  await expectStatus(await admin(`products/${PRODUCT}`, {
    nameKm: "Coffee", categoryId: CHILD, priceCents: 3, sortOrder: 12, menuIds: [first.id, second.id],
  }, "PUT"), 200);
  assert.deepEqual((await publicMenu()).products.find(({ id }) => id === PRODUCT).menuSortOrders,
    { [first.id]: 0, [second.id]: 12 });

  await expectStatus(await admin(path(first.id), { productIds: [PRODUCT2] }, "DELETE"), 200);
  await expectStatus(await admin(path(first.id) + "/order", both, "PUT"), 409);
  assert.deepEqual(ids(await list(first.id)), [PRODUCT]);
  assert.deepEqual(ids(await list(second.id)), [PRODUCT2, PRODUCT]);
  const firstCatalog = await list(first.id, "?catalog=1");
  assert.equal(firstCatalog.products.find(({ id }) => id === PRODUCT).isAssigned, 1);
  assert.equal(firstCatalog.products.find(({ id }) => id === PRODUCT2).isAssigned, 0);
  assert.deepEqual(ids(await list(first.id, "?catalog=1&filter=unassigned-menu")), []);
  assert.equal(
    (await list(root.id, "?catalog=1")).products.find(({ id }) => id === PRODUCT2).isAssigned,
    1,
  );
  assert.deepEqual((await list(first.id, "?catalog=1&ids=1")).productIds, [PRODUCT]);
  assert.deepEqual((await list(first.id, "?ids=matches&page=999")).productIds, [PRODUCT]);
  assert.deepEqual(new Set((await list(first.id, "?catalog=1&ids=matches")).productIds), new Set(both.productIds));
  assert.deepEqual(ids(await list(first.id, "/order?catalog=1")), [PRODUCT]);
  assert.deepEqual((await publicMenu()).products.find(({ id }) => id === PRODUCT2).menuIds, [second.id]);

  const selected = await list(second.id, "?ids=1");
  assert.deepEqual(new Set(selected.productIds), new Set([PRODUCT, PRODUCT2]));
  await expectStatus(await admin(path(second.id), selected, "DELETE"), 200);
  assert.deepEqual(ids(await list(second.id)), []);
  assert.deepEqual(ids(await list(first.id)), [PRODUCT]);
  assert.deepEqual((await list(second.id, "?unassigned=1&query=tea")).products.map(({ id }) => id), [PRODUCT2]);
  assert.deepEqual(ids(await list(root.id, "?catalog=1&filter=unassigned-menu")), [PRODUCT2]);

  const created = await expectStatus(await admin("products", {
    nameKm: "Espresso", categoryId: CHILD, priceCents: 3, isFeatured: true, menuIds: [first.id],
  }, "POST"), 201);
  assert.ok(ids(await list(first.id)).includes(created.id));
  const unpublished = await expectStatus(await admin("products", {
    nameKm: "Decaf", categoryId: CHILD, priceCents: 3, isAvailable: false, menuIds: [second.id],
  }, "POST"), 201);
  const featured = await list(root.id, `?includeCounts=1&filter=featured&categoryId=${CAT}&query=espresso`);
  assert.deepEqual(ids(featured), [created.id]);
  assert.equal(featured.pagination.total, 1);
  assert.deepEqual(featured.counts, {
    all: 4, published: 3, unpublished: 1, featured: 1, missingPhotos: 3, unassignedMenu: 1,
  });
  assert.deepEqual(ids(await list(root.id, "?filter=unpublished")), [unpublished.id]);
  assert.deepEqual(ids(await list(second.id, "?filter=published")), []);
  assert.deepEqual(
    new Set(ids(await list(root.id, `?filter=missing-photos&categoryId=${CAT}`))),
    new Set([PRODUCT, created.id]),
  );
  assert.deepEqual((await list(first.id, "?filter=featured&ids=1")).productIds, [created.id]);
  const editorCatalog = await expectStatus(await admin(`catalog?productId=${created.id}`), 200);
  assert.deepEqual(ids(editorCatalog), [created.id]);
  assert.deepEqual(editorCatalog.products[0].menuIds, [first.id]);

  const child = await createMenu({ nameEn: "Hot drinks", parentId: first.id });
  const grandchild = await createMenu({ nameEn: "Hot tea", parentId: child.id });
  await expectStatus(await assignProduct(PRODUCT, [child.id]), 200);
  await expectStatus(await assignProduct(PRODUCT2, [grandchild.id]), 200);
  const branchQuery = "?includeDescendants=1";
  const branch = await list(first.id, branchQuery);
  assert.deepEqual(new Set(ids(branch)), new Set([PRODUCT, PRODUCT2, created.id]));
  assert.equal(branch.pagination.total, 3);
  assert.equal(branch.products.find(({ id }) => id === PRODUCT).isAssigned, 1);
  assert.equal(branch.products.find(({ id }) => id === PRODUCT2).isAssigned, 0);
  assert.deepEqual(ids(await list(first.id, `${branchQuery}&categoryId=${teaCategory}`)), [PRODUCT2]);
  assert.deepEqual(new Set((await list(first.id, `${branchQuery}&ids=matches`)).productIds), new Set(ids(branch)));
  const directlyAssigned = new Set([PRODUCT, created.id]);
  assert.deepEqual(new Set((await list(first.id, `${branchQuery}&ids=1`)).productIds), directlyAssigned);
  assert.deepEqual(new Set(ids(await list(first.id, `/order${branchQuery}`))), directlyAssigned);
});

test("super-admin page API manages the selected business's key without exposing stored secrets", async () => {
  const metadata = await expectStatus(await superRequest("biz_a"), 200);
  assert.equal(metadata.integration.name, "Test POS");
  assert.equal(metadata.syncUrl, "http://localhost/api/integrations/pos/sync");
  assert.ok(!JSON.stringify(metadata).includes(key));
  assert.ok(!JSON.stringify(metadata).includes("token_hash"));
  const created = await expectStatus(
    await superRequest("biz_b", { name: "Second POS" }, "PUT"),
    200,
  );
  assert.match(created.apiKey, /^pos_[0-9a-f]{64}$/);
  assert.equal(created.integration.name, "Second POS");
  await expectStatus(await sync(payload(), created.apiKey), 200);
  assert.equal(
    await db
      .prepare("SELECT business_id FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("business_id"),
    "biz_b",
  );
  const rotated = await expectStatus(
    await superRequest("biz_b", { name: "Second POS" }, "PUT"),
    200,
  );
  assert.notEqual(created.apiKey, rotated.apiKey);
  await expectStatus(await sync(payload(), created.apiKey), 401);
  const fetched = await expectStatus(await superRequest("biz_b"), 200);
  assert.ok(!JSON.stringify(fetched).includes(rotated.apiKey));
  const revoked = await expectStatus(
    await superRequest("biz_b", undefined, "DELETE"),
    200,
  );
  assert.equal(revoked.integration, null);
  await expectStatus(await sync(payload(), rotated.apiKey), 401);
  assert.equal(
    await db
      .prepare(
        "SELECT token_hash FROM pos_integrations WHERE business_id='biz_a'",
      )
      .first("token_hash"),
    sha(key),
  );
  const audit = await db
    .prepare(
      "SELECT action,details_json FROM super_admin_audit_log WHERE business_id='biz_b'",
    )
    .all();
  assert.equal(audit.results.length, 3);
  assert.ok(!JSON.stringify(audit.results).includes(created.apiKey));
  assert.ok(!JSON.stringify(audit.results).includes(rotated.apiKey));
});

test("super-admin key API requires Access, validates input and rejects missing businesses", async () => {
  await expectStatus(await superRequest("biz_a", undefined, "GET", ""), 401);
  await expectStatus(
    await superRequest("biz_a", undefined, "GET", "other@example.test"),
    401,
  );
  await expectStatus(await superRequest("biz_missing"), 404);
  await expectStatus(await superRequest("biz_a", { name: "" }, "PUT"), 400);
  await expectStatus(
    await superRequest("biz_a", { name: "POS", businessId: "biz_b" }, "PUT"),
    400,
  );
  await expectStatus(await superRequest("biz_a", [], "PUT"), 400);
  await expectStatus(await superRequest("biz_a", "{broken", "PUT"), 400);
  await expectStatus(await superRequest("biz_a", {}, "PATCH"), 405);
});

test("super-admin key changes and their audit records commit atomically", async () => {
  await db
    .prepare(
      "CREATE TRIGGER pos_test_fail_audit BEFORE INSERT ON super_admin_audit_log BEGIN SELECT RAISE(ABORT,'intentional-audit-test-failure'); END",
    )
    .run();
  await expectStatus(
    await superRequest("biz_a", { name: "Replacement" }, "PUT"),
    500,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT token_hash FROM pos_integrations WHERE business_id='biz_a'",
      )
      .first("token_hash"),
    sha(key),
  );
  await expectStatus(await sync(payload()), 200);
});

test("imports 300 products with all catalog fields, parent ordering, prices and a small success response", async () => {
  const body = payload({
    categories: [
      {
        id: CHILD,
        parent_id: CAT,
        name: "Coffee",
        name_km: "កាហ្វេ",
        name_en: "Coffee",
        name_zh: "咖啡",
        slug: "coffee",
        image_url: "https://pos.example/coffee.webp",
        sort_order: 2,
        is_active: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: CAT,
        parent_id: null,
        name: "Drinks",
        name_km: "ភេសជ្ជៈ",
        name_en: "Drinks",
        name_zh: "饮料",
        slug: "drinks",
        image_media_id: "media_a",
        sort_order: 1,
        is_active: true,
      },
    ],
    products: Array.from({ length: 300 }, (_, index) => ({
      id: index === 0 ? PRODUCT : randomUUID(),
      category_id: CHILD,
      code: `SKU-${index}`,
      name: `Coffee ${index}`,
      name_km: `កាហ្វេ ${index}`,
      name_en: `Coffee ${index}`,
      name_zh: `咖啡 ${index}`,
      slug: `coffee-${index}`,
      description: "Roasted coffee",
      price: 2.5,
      max_price: 4,
      unit: "cup",
      portions: [
        {
          id: PORTION,
          label_km: "តូច",
          label_en: "Small",
          label_zh: "小",
          price: 2.5,
        },
        { id: PORTION2, label_km: "ធំ", label_en: "Large", price: 4 },
      ],
      modifier_groups: [
        {
          id: "milk",
          label_km: "ទឹកដោះគោ",
          label_en: "Milk",
          required: true,
          multiple: false,
          options: [
            { id: "oat", label_km: "Oat", label_en: "Oat", price: 0.5 },
            { id: "none", label_km: "None", price: null },
          ],
        },
      ],
      primary_media_id: "media_a",
      media_ids: ["media_a", "media_a2"],
      calories: 120,
      prep_minutes: 5,
      rating: 4.7,
      is_featured: true,
      is_available: 1,
      sort_order: index,
      created_at: "2026-02-01T00:00:00Z",
      price_entries: [
        { price_list_id: "special_a", target_key: PORTION, price_cents: 2 },
      ],
    })),
  });
  const before = await version();
  const result = await expectStatus(await sync(body), 200);
  assert.deepEqual(result, { message: "POS catalog synced successfully." });
  assert.equal(
    await db
      .prepare("SELECT count(*) AS n FROM products WHERE business_id='biz_a'")
      .first("n"),
    300,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT count(*) AS n FROM product_images WHERE business_id='biz_a'",
      )
      .first("n"),
    600,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT count(*) AS n FROM product_prices WHERE business_id='biz_a'",
      )
      .first("n"),
    900,
  );
  const product = await db
    .prepare("SELECT * FROM products WHERE id=?")
    .bind(PRODUCT)
    .first();
  assert.equal(product.id, PRODUCT);
  assert.equal(product.business_id, "biz_a");
  assert.equal(product.price_cents, 2.5);
  assert.equal(product.max_price, 4);
  assert.equal(product.code, "SKU-0");
  assert.equal(product.calories, 120);
  assert.equal(product.prep_minutes, 5);
  assert.equal(product.rating, 4.7);
  assert.equal(product.created_at, "2026-02-01T00:00:00.000Z");
  assert.equal(product.image_url, "http://localhost/media/media_a");
  assert.equal(
    JSON.parse(product.modifier_groups_json)[0].options[0].priceCents,
    0.5,
  );
  assert.equal(await version(), before + 1);
  const publicMenu = await expectStatus(
    await request(
      "/api/public/businesses/test-a/menu",
      undefined,
      undefined,
      "GET",
    ),
    200,
  );
  assert.equal(publicMenu.products.length, 300);
  assert.equal(
    publicMenu.products.find((row) => row.id === PRODUCT).maxPrice,
    4,
  );
  // The second full import exercises updates at the same size as the initial import.
  body.sync_id = randomUUID();
  body.source_updated_at = "2026-11-07T01:00:00Z";
  for (const row of body.products) row.description = "Updated from POS";
  await expectStatus(await sync(body), 200);
  assert.equal(
    await db
      .prepare(
        "SELECT count(*) AS n FROM products WHERE description='Updated from POS'",
      )
      .first("n"),
    300,
  );
  const storedOptions = await db
    .prepare(
      "SELECT portions_json,modifier_groups_json FROM products WHERE id=?",
    )
    .bind(PRODUCT)
    .first();
  await expectStatus(
    await sync(
      payload({
        source_updated_at: "2026-11-07T02:00:00Z",
        categories: [],
        products: [
          { id: PRODUCT, description: "Partial update preserves menu options" },
        ],
      }),
    ),
    200,
  );
  assert.deepEqual(
    await db
      .prepare(
        "SELECT portions_json,modifier_groups_json FROM products WHERE id=?",
      )
      .bind(PRODUCT)
      .first(),
    storedOptions,
  );
  const updatedMenu = await expectStatus(
    await request(
      "/api/public/businesses/test-a/menu",
      undefined,
      undefined,
      "GET",
    ),
    200,
  );
  const updatedProduct = updatedMenu.products.find((row) => row.id === PRODUCT);
  assert.equal(updatedProduct.portions[0].labelKm, "តូច");
  assert.equal(updatedProduct.portions[0].priceCents, 2.5);
  assert.equal(updatedProduct.modifierGroups[0].options[0].priceCents, 0.5);
});

test("accepts only categories/products and uses the API key business's currency", async () => {
  await db
    .prepare("UPDATE businesses SET currency='KHR' WHERE id='biz_a'")
    .run();
  const { categories, products } = payload();
  products[0].price = 10000;
  const result = await expectStatus(await sync({ categories, products }), 200);
  assert.deepEqual(result, { message: "POS catalog synced successfully." });
  const logged = await db
    .prepare(
      "SELECT sync_id,source_updated_at FROM pos_sync_requests WHERE business_id='biz_a'",
    )
    .first();
  assert.match(logged.sync_id, /^[0-9a-f-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(logged.source_updated_at)));
  assert.equal(
    await db
      .prepare("SELECT price_cents FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("price_cents"),
    10000,
  );
  const menu = await expectStatus(
    await request(
      "/api/public/businesses/test-a/menu",
      undefined,
      undefined,
      "GET",
    ),
    200,
  );
  assert.equal(menu.business.currency, "KHR");
  assert.equal(menu.products[0].priceCents, 10000);
});

test("single-product webhook inserts, patches and refreshes the public menu", async () => {
  const {
    categories,
    products: [product],
  } = payload();
  const other = { ...product, id: PRODUCT2, name_km: "Tea", price: 1 };
  await expectStatus(await sync({ categories, products: [other] }), 200);
  const menu = () =>
    request("/api/public/businesses/test-a/menu", undefined, null, "GET");
  const before = await expectStatus(await menu(), 200);
  assert.deepEqual(
    before.products.map((row) => row.id),
    [PRODUCT2],
  );

  const insert = { sync_id: randomUUID(), product };
  const message = { message: "POS product synced successfully." };
  assert.deepEqual(await expectStatus(await syncProduct(insert), 200), message);
  assert.deepEqual(
    await expectStatus(
      await syncProduct({ product: { id: PRODUCT, price: 4.5 } }),
      200,
    ),
    message,
  );
  const after = await expectStatus(await menu(), 200);
  const updated = after.products.find((row) => row.id === PRODUCT);
  assert.equal(updated.priceCents, 4.5);
  assert.equal(updated.nameEn, product.name_en);
  assert.equal(after.products.find((row) => row.id === PRODUCT2).priceCents, 1);
  assert.deepEqual(after.categories, before.categories);

  const versionBeforeRetry = await version();
  assert.deepEqual(await expectStatus(await syncProduct(insert), 200), message);
  assert.equal(await version(), versionBeforeRetry);
  const reused = await expectStatus(
    await syncProduct({
      ...insert,
      product: { ...product, price: 9 },
    }),
    409,
  );
  assert.equal(reused.code, "SYNC_ID_REUSED");
  assert.equal(
    await db
      .prepare("SELECT price_cents FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("price_cents"),
    4.5,
  );
});

test("single-product webhook creates a product with its new category and parents", async () => {
  const root = randomUUID();
  const leaf = { id: CHILD, parent_id: CAT, name: "Coffee" };
  const parent = { id: CAT, parent_id: root, name: "Drinks" };
  const product = {
    id: PRODUCT,
    category_id: CHILD,
    name: "Iced coffee",
    price: 2.75,
  };
  const incomplete = await expectStatus(
    await syncProduct({ categories: [leaf, parent], product }),
    400,
  );
  assert.match(incomplete.error, /categories\.parent_id/);
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM categories").first("n"),
    0,
  );

  const created = await expectStatus(
    await syncProduct({
      categories: [leaf, parent, { id: root, name: "Menu", parent_id: null }],
      product,
    }),
    200,
  );
  assert.deepEqual(created, { message: "POS product synced successfully." });
  const { results } = await db
    .prepare("SELECT id, parent_id FROM categories WHERE business_id='biz_a'")
    .all();
  assert.deepEqual(
    Object.fromEntries(results.map((row) => [row.id, row.parent_id])),
    {
      [root]: null,
      [CAT]: root,
      [CHILD]: CAT,
    },
  );
  const saved = await db
    .prepare(
      "SELECT category_id, price_cents FROM products WHERE id=? AND business_id='biz_a'",
    )
    .bind(PRODUCT)
    .first();
  assert.deepEqual(saved, { category_id: CHILD, price_cents: 2.75 });
});

test("single-product webhook requires a POS key, one object and an owned category", async () => {
  const {
    products: [product],
  } = payload();
  await expectStatus(await syncProduct({ product }, null), 401);
  await expectStatus(await syncProduct({ products: [product] }), 400);
  await expectStatus(await syncProduct({ product: [product] }), 400);
  await expectStatus(await syncProduct({ categories: null, product }), 400);
  const missing = await expectStatus(await syncProduct({ product }), 400);
  assert.match(missing.error, /category_id/);
  await db
    .prepare(
      "INSERT INTO categories (id,business_id,name,slug) VALUES (?,'biz_b','Foreign','foreign')",
    )
    .bind(CAT)
    .run();
  const foreign = await expectStatus(await syncProduct({ product }), 400);
  assert.match(foreign.error, /category_id/);
  const foreignUpsert = await expectStatus(
    await syncProduct({ categories: [{ id: CAT, name: "Other" }], product }),
    409,
  );
  assert.equal(foreignUpsert.code, "CATALOG_ID_CONFLICT");
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM products").first("n"),
    0,
  );
});

test("webhook source timestamps order each product across webhook and bulk writes", async () => {
  const initial = payload();
  initial.products.push({
    ...initial.products[0],
    id: PRODUCT2,
    name_en: "Tea",
  });
  await expectStatus(await sync(initial), 200);
  const update = (id, time, price) =>
    syncProduct({
      source_updated_at: `2026-11-07T00:00:0${time}Z`,
      product: { id, price },
    });
  await expectStatus(await update(PRODUCT, 3, 5), 200);
  await expectStatus(await update(PRODUCT2, 2, 4), 200);
  assert.equal(
    (await expectStatus(await update(PRODUCT, 1, 3), 409)).code,
    "STALE_SYNC",
  );

  const bulk = (time) =>
    sync(
      payload({
        source_updated_at: `2026-11-07T00:00:0${time}Z`,
        categories: [],
        products: [{ id: PRODUCT, price: 6 }],
      }),
    );
  assert.equal((await expectStatus(await bulk(2), 409)).code, "STALE_SYNC");
  await expectStatus(await bulk(4), 200);
  assert.equal(
    (await expectStatus(await update(PRODUCT, 3, 3), 409)).code,
    "STALE_SYNC",
  );
  const { results } = await db
    .prepare("SELECT price_cents FROM products ORDER BY id")
    .all();
  assert.deepEqual(
    results.map((row) => row.price_cents),
    [6, 4],
  );
});

test("bulk table deletion removes unused tables and empty groups without deleting orders", async () => {
  const checkout = await prepareNotificationCheckout();
  const receipt = await expectStatus(
    await request("/api/public/businesses/test-a/orders", checkout, null), 201,
  );
  await db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(receipt.orderId).run();

  const create = (path, body) => request(path, body, "owner-a").then((response) => expectStatus(response, 201));
  const removable = await create("/api/admin/table-groups", { name: "Remove group" });
  const occupied = await create("/api/admin/table-groups", { name: "Keep group" });
  const empty = await create("/api/admin/table-groups", { name: "Empty group" });
  const first = await create("/api/admin/tables", { groupId: removable.id, code: "D01" });
  const second = await create("/api/admin/tables", { groupId: removable.id, code: "D02" });
  const unselected = await create("/api/admin/tables", { groupId: occupied.id, code: "D03" });
  await expectStatus(await request(`/api/admin/tables/${second.id}`, undefined, "owner-a", "DELETE"), 200);

  const qr = () => request(`/api/public/businesses/test-a/table-context/${first.publicToken}`, undefined, null, "GET");
  await expectStatus(await qr(), 200);
  const selection = {
    tableIds: [first.id, second.id, checkout.tableId],
    groupIds: [removable.id, occupied.id, empty.id, "notify_group"],
  };
  const remove = (token) => request("/api/admin/tables/bulk-delete", selection, token)
    .then((response) => expectStatus(response, 200));
  assert.deepEqual(await remove("owner-b"), {
    deletedTableIds: [], deletedGroupIds: [], keptTableCount: 0, keptGroupCount: 0,
  });
  const result = await remove("owner-a");
  assert.deepEqual(new Set(result.deletedTableIds), new Set([first.id, second.id]));
  assert.deepEqual(new Set(result.deletedGroupIds), new Set([removable.id, empty.id]));
  assert.equal(result.keptTableCount, 1);
  assert.equal(result.keptGroupCount, 2);
  await expectStatus(await qr(), 404);
  assert.equal(await db.prepare("SELECT table_id FROM orders WHERE id=?").bind(receipt.orderId).first("table_id"), checkout.tableId);
  const { tables } = await expectStatus(await request("/api/admin/tables", undefined, "owner-a", "GET"), 200);
  assert.deepEqual(new Set(tables.map(({ id }) => id)), new Set([checkout.tableId, unselected.id]));
  assert.deepEqual(await remove("owner-a"), {
    deletedTableIds: [], deletedGroupIds: [], keptTableCount: 1, keptGroupCount: 2,
  });

  const unusedSibling = await create("/api/admin/tables", { groupId: "notify_group", code: "D04" });
  const archived = await create("/api/admin/tables", { groupId: occupied.id, code: "D05" });
  await expectStatus(await request(`/api/admin/tables/${archived.id}`, undefined, "owner-a", "DELETE"), 200);
  const separateGroup = await create("/api/admin/table-groups", { name: "Keep separate group" });
  const standalone = await create("/api/admin/tables", { groupId: separateGroup.id, code: "D06" });
  const withGroupTables = {
    tableIds: [unusedSibling.id, standalone.id],
    groupIds: [occupied.id, "notify_group"],
    includeGroupTables: true,
  };
  const cascade = (token) => request("/api/admin/tables/bulk-delete", withGroupTables, token)
    .then((response) => expectStatus(response, 200));
  assert.deepEqual(await cascade("owner-b"), {
    deletedTableIds: [], deletedGroupIds: [], keptTableCount: 0, keptGroupCount: 0,
  });
  const cascadeResult = await cascade("owner-a");
  assert.deepEqual(new Set(cascadeResult.deletedTableIds), new Set([unselected.id, archived.id, standalone.id]));
  assert.deepEqual(cascadeResult.deletedGroupIds, [occupied.id]);
  assert.equal(cascadeResult.keptTableCount, 1);
  assert.equal(cascadeResult.keptGroupCount, 1);
  const remaining = await expectStatus(await request("/api/admin/tables", undefined, "owner-a", "GET"), 200);
  assert.deepEqual(new Set(remaining.tables.map(({ id }) => id)), new Set([checkout.tableId, unusedSibling.id]));
  assert.equal(await db.prepare("SELECT table_id FROM orders WHERE id=?").bind(receipt.orderId).first("table_id"), checkout.tableId);
});

test("POS table sync creates groups and tables and keeps existing QR tokens on update", async () => {
  const groupId = randomUUID();
  const tableId = randomUUID();
  const original = {
    sync_id: randomUUID(),
    source: "POS",
    table_groups: [{ id: groupId, name: "Patio", sort_order: 2, pos_group_code: "PATIO" }],
    tables: [{ id: tableId, group_id: groupId, code: "001", public_token: "pos-token" }],
  };
  const success = { message: "POS tables synced successfully." };
  assert.deepEqual(
    await expectStatus(await syncTables(original), 200),
    success,
  );
  const readTable = () =>
    db
      .prepare("SELECT * FROM restaurant_tables WHERE id=?")
      .bind(tableId)
      .first();
  const before = await readTable();
  assert.equal(before.business_id, "biz_a");
  assert.equal(before.group_id, groupId);
  assert.equal(before.label, "001");
  assert.match(before.public_token, /^scan_[0-9a-f]{32}$/);

  assert.deepEqual(
    await expectStatus(
      await syncTables({
        table_groups: [{ id: groupId, name: "Terrace" }],
        tables: [{ id: tableId, code: "002", label: "Table 002" }],
      }),
      200,
    ),
    success,
  );
  assert.deepEqual(
    await expectStatus(await syncTables(original), 200),
    success,
  );
  const after = await readTable();
  assert.equal(after.public_token, before.public_token);
  assert.equal(after.code, "002");
  const context = await expectStatus(
    await request(
      `/api/public/businesses/test-a/table-context/${before.public_token}`,
      undefined,
      null,
      "GET",
    ),
    200,
  );
  assert.equal(context.tableId, tableId);
  assert.equal(context.label, "Table 002");
  assert.equal(context.groupName, "Terrace");
  assert.equal(
    (await expectStatus(await syncTables({ ...original, tables: [] }), 409))
      .code,
    "SYNC_ID_REUSED",
  );
});

test("POS table sync rejects foreign records and reports skipped duplicate table codes", async () => {
  const groupId = randomUUID();
  const tableId = randomUUID();
  const foreignGroupId = randomUUID();
  await db
    .prepare(
      "INSERT INTO table_groups (id,business_id,name) VALUES (?,'biz_b','Foreign')",
    )
    .bind(foreignGroupId)
    .run();
  const body = {
    table_groups: [{ id: groupId, name: "Patio" }],
    tables: [{ id: tableId, group_id: foreignGroupId, code: "T01" }],
  };
  await expectStatus(await syncTables(body, null), 401);
  await expectStatus(await syncTables(body), 400);
  assert.equal(
    (
      await expectStatus(
        await syncTables({
          table_groups: [{ id: foreignGroupId, name: "Different" }],
          tables: [],
        }),
        409,
      )
    ).code,
    "TABLE_ID_CONFLICT",
  );
  const duplicateId = randomUUID();
  const otherId = randomUUID();
  const batch = {
    sync_id: randomUUID(),
    table_groups: body.table_groups,
    tables: [
      { ...body.tables[0], group_id: groupId },
      { id: duplicateId, group_id: groupId, code: "t01" },
      { id: otherId, group_id: groupId, code: "T02" },
    ],
  };
  const result = await expectStatus(await syncTables(batch), 200);
  assert.deepEqual(result, {
    message: "POS tables synced successfully.",
    warnings: [
      {
        code: "DUPLICATE_TABLE_CODE",
        table_id: duplicateId,
        table_code: "t01",
        message:
          "Table number t01 is already used in this branch and could not be synced.",
      },
    ],
  });
  assert.deepEqual(await expectStatus(await syncTables(batch), 200), result);
  const saved = () =>
    db
      .prepare(
        "SELECT id, code FROM restaurant_tables WHERE business_id='biz_a' ORDER BY code",
      )
      .all()
      .then(({ results }) => results);
  assert.deepEqual(await saved(), [
    { id: tableId, code: "T01" },
    { id: otherId, code: "T02" },
  ]);

  const occupied = await expectStatus(
    await syncTables({
      table_groups: [],
      tables: [
        { id: duplicateId, group_id: groupId, code: "T01" },
        { id: tableId, code: "T01" },
      ],
    }),
    200,
  );
  assert.equal(occupied.warnings[0].table_id, duplicateId);
  const chained = await expectStatus(
    await syncTables({
      table_groups: [],
      tables: [
        { id: duplicateId, group_id: groupId, code: "T01" },
        { id: tableId, code: "T02" },
      ],
    }),
    200,
  );
  assert.deepEqual(
    chained.warnings.map((warning) => warning.table_id),
    [duplicateId, tableId],
  );
  assert.deepEqual(await saved(), [
    { id: tableId, code: "T01" },
    { id: otherId, code: "T02" },
  ]);

  const swapped = await expectStatus(
    await syncTables({
      table_groups: [],
      tables: [
        { id: tableId, code: "T02" },
        { id: otherId, code: "T01" },
      ],
    }),
    200,
  );
  assert.equal(swapped.warnings, undefined);
  assert.deepEqual(await saved(), [
    { id: otherId, code: "T01" },
    { id: tableId, code: "T02" },
  ]);
});

test("POS table sync can archive an existing group with its tables together", async () => {
  await db.batch([
    db.prepare(
      "INSERT INTO table_groups (id,business_id,name) VALUES ('grp_legacy','biz_a','Main Area')",
    ),
    db.prepare(
      "INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token) VALUES ('tbl_legacy','biz_a','grp_legacy','T01','Table 1','scan_legacy')",
    ),
  ]);
  const archived = {
    table_groups: [{ id: "grp_legacy", is_active: false }],
    tables: [],
  };
  assert.equal(
    (await expectStatus(await syncTables(archived), 409)).code,
    "TABLE_GROUP_IN_USE",
  );
  archived.tables.push({ id: "tbl_legacy", is_active: false });
  await expectStatus(await syncTables(archived), 200);
  assert.equal(
    await db
      .prepare("SELECT is_active FROM table_groups WHERE id='grp_legacy'")
      .first("is_active"),
    0,
  );
  const table = await db
    .prepare(
      "SELECT is_active, public_token FROM restaurant_tables WHERE id='tbl_legacy'",
    )
    .first();
  assert.deepEqual(table, { is_active: 0, public_token: "scan_legacy" });
});

test("POS delete sync archives existing tables and groups without removing their QR tokens", async () => {
  const groupId = randomUUID();
  const firstId = randomUUID();
  const secondId = randomUUID();
  await expectStatus(
    await syncTables({
      table_groups: [{ id: groupId, name: "Patio" }],
      tables: [
        { id: firstId, group_id: groupId, code: "T01" },
        { id: secondId, group_id: groupId, code: "T02" },
      ],
    }),
    200,
  );
  const read = (id) =>
    db
      .prepare(
        "SELECT id,is_active,public_token FROM restaurant_tables WHERE id=?",
      )
      .bind(id)
      .first();
  const first = await read(firstId);
  const second = await read(secondId);
  await expectStatus(await syncTables({ archive: { table_id: firstId } }), 200);
  assert.deepEqual(await read(firstId), { ...first, is_active: 0 });
  assert.deepEqual(await read(secondId), second);
  const archiveGroup = {
    sync_id: randomUUID(),
    archive: { table_group_id: groupId, reason: "Removed in POS" },
  };
  assert.deepEqual(await expectStatus(await syncTables(archiveGroup), 200), {
    message: "POS tables synced successfully.",
  });
  assert.equal(
    await db
      .prepare("SELECT is_active FROM table_groups WHERE id=?")
      .bind(groupId)
      .first("is_active"),
    0,
  );
  assert.deepEqual(await read(secondId), { ...second, is_active: 0 });
  await expectStatus(
    await request(
      `/api/public/businesses/test-a/table-context/${second.public_token}`,
      undefined,
      null,
      "GET",
    ),
    404,
  );

  await expectStatus(
    await syncTables({
      table_groups: [{ id: groupId, is_active: true }],
      tables: [{ id: secondId, is_active: true }],
    }),
    200,
  );
  await expectStatus(await syncTables(archiveGroup), 200);
  assert.deepEqual(await read(secondId), second);
});

test("POS delete sync leaves missing and foreign IDs alone", async () => {
  const foreignGroupId = randomUUID();
  const foreignTableId = randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO table_groups (id,business_id,name) VALUES (?,'biz_b','Foreign')",
      )
      .bind(foreignGroupId),
    db
      .prepare(
        "INSERT INTO restaurant_tables (id,business_id,group_id,code,label,public_token) VALUES (?,'biz_b',?,'1','1','scan_foreign')",
      )
      .bind(foreignTableId, foreignGroupId),
  ]);
  await expectStatus(
    await syncTables({ archive: { table_id: foreignTableId } }, null),
    401,
  );
  await expectStatus(
    await syncTables({
      archive: { table_id: foreignTableId, table_group_id: foreignGroupId },
    }),
    400,
  );
  await expectStatus(
    await syncTables({ archive: { table_id: foreignTableId }, tables: [] }),
    400,
  );
  await expectStatus(
    await syncTables({ archive: { table_id: foreignTableId } }),
    200,
  );
  await expectStatus(
    await syncTables({ archive: { table_group_id: foreignGroupId } }),
    200,
  );
  await expectStatus(
    await syncTables({ archive: { table_id: randomUUID() } }),
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT is_active FROM table_groups WHERE id=?")
      .bind(foreignGroupId)
      .first("is_active"),
    1,
  );
  assert.equal(
    await db
      .prepare("SELECT is_active FROM restaurant_tables WHERE id=?")
      .bind(foreignTableId)
      .first("is_active"),
    1,
  );
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM restaurant_tables").first("n"),
    1,
  );
});

test("admin category deletion keeps categories with products or subcategories", async () => {
  await expectStatus(await sync(payload()), 200);
  const addCategory = (nameKm, parentId) =>
    request("/api/admin/categories", { nameKm, parentId }, "owner-a")
      .then((response) => expectStatus(response, 201));
  const child = await addCategory("Coffee", CAT);
  const grandchild = await addCategory("Espresso", child.id);
  const remove = (id) => request(`/api/admin/categories/${id}`, undefined, "owner-a", "DELETE");

  const beforeDelete = await version();
  const protectedParent = await expectStatus(await remove(child.id), 409);
  assert.equal(protectedParent.childCount, 1);
  const protectedProducts = await expectStatus(await remove(CAT), 409);
  assert.equal(protectedProducts.productCount, 1);
  assert.equal(await version(), beforeDelete);
  await expectStatus(await remove(grandchild.id), 200);
  await expectStatus(await remove(child.id), 200);
  assert.equal(await version(), beforeDelete + 2);
  await expectStatus(await remove(child.id), 404);
});

test("admin catalog category filters include products in all descendant categories", async () => {
  const grandchild = randomUUID();
  const otherCategory = randomUUID();
  const grandchildProduct = randomUUID();
  await expectStatus(
    await sync(
      payload({
        categories: [
          { id: CAT, name: "Drinks" },
          { id: CHILD, parent_id: CAT, name: "Tea and coffee" },
          { id: grandchild, parent_id: CHILD, name: "Coffee", is_active: false },
          { id: otherCategory, name: "Desserts" },
        ],
        products: [
          { id: PRODUCT, category_id: CAT, name: "House tea", price: 2 },
          { id: PRODUCT2, category_id: CHILD, name: "Milk tea", price: 3 },
          {
            id: grandchildProduct,
            category_id: grandchild,
            name: "Iced coffee",
            price: 4,
          },
          {
            id: randomUUID(),
            category_id: otherCategory,
            name: "Tea cake",
            price: 4,
          },
        ],
      }),
    ),
    200,
  );

  const catalog = async (categoryId, options = {}) => {
    const params = new URLSearchParams({ categoryId, ...options });
    return expectStatus(
      await request(`/api/admin/catalog?${params}`, undefined, "owner-a", "GET"),
      200,
    );
  };
  const parent = await catalog(CAT);
  assert.equal(parent.pagination.total, 3);
  assert.deepEqual(
    new Set(parent.products.map(({ id }) => id)),
    new Set([PRODUCT, PRODUCT2, grandchildProduct]),
  );
  assert.equal(parent.counts.byCategory[CAT], 1);
  const child = await catalog(CHILD);
  assert.deepEqual(
    new Set(child.products.map(({ id }) => id)),
    new Set([PRODUCT2, grandchildProduct]),
  );
  const leaf = await catalog(grandchild);
  assert.deepEqual(leaf.products.map(({ id }) => id), [grandchildProduct]);

  const secondPage = await catalog(CAT, {
    query: "tea",
    page: "2",
    pageSize: "1",
    sortBy: "name-en",
  });
  assert.equal(secondPage.pagination.total, 2);
  assert.deepEqual(secondPage.products.map(({ id }) => id), [PRODUCT2]);
});

test("public menu only lists categories with available products in their branch", async () => {
  const emptyRoot = randomUUID();
  const emptyChild = randomUUID();
  const grandchild = randomUUID();
  await expectStatus(
    await sync(
      payload({
        categories: [
          { id: CAT, name: "Food", sort_order: 0 },
          { id: CHILD, parent_id: CAT, name: "Desserts", sort_order: 1 },
          { id: grandchild, parent_id: CHILD, name: "Cakes", sort_order: 2 },
          { id: emptyChild, parent_id: CAT, name: "Salads", sort_order: 3 },
          { id: emptyRoot, name: "Drinks", sort_order: 4 },
        ],
        products: [
          { id: PRODUCT, category_id: grandchild, name: "Cake", price: 3 },
          {
            id: PRODUCT2,
            category_id: emptyRoot,
            name: "Coffee",
            price: 2,
            is_available: false,
          },
        ],
      }),
    ),
    200,
  );

  const getMenu = () =>
    request("/api/public/businesses/test-a/menu", undefined, undefined, "GET");
  for (const cacheStatus of ["MISS", "HIT"]) {
    const response = await getMenu();
    assert.equal(response.headers.get("x-catalog-cache"), cacheStatus);
    const menu = await expectStatus(response, 200);
    assert.deepEqual(
      menu.categories.map(({ id }) => id),
      [CAT, CHILD, grandchild],
    );
    assert.deepEqual(
      menu.products.map(({ id }) => id),
      [PRODUCT],
    );
  }

  await expectStatus(
    await sync(
      payload({
        source_updated_at: "2026-11-07T01:00:00Z",
        categories: [],
        products: [{ id: PRODUCT, is_available: false }],
      }),
    ),
    200,
  );
  const menu = await expectStatus(await getMenu(), 200);
  assert.deepEqual(menu.categories, []);
  assert.deepEqual(menu.products, []);
});

test("sync_id works without a source timestamp and retains exact retry protection", async () => {
  const { sync_id, categories, products } = payload();
  const body = JSON.stringify({ sync_id, categories, products });
  await expectStatus(await sync(body), 200);
  const before = await version();
  const first = await db
    .prepare("SELECT source_updated_at FROM pos_sync_requests WHERE sync_id=?")
    .bind(sync_id)
    .first();
  await expectStatus(await sync(body), 200);
  assert.equal(await version(), before);
  assert.deepEqual(
    await db
      .prepare(
        "SELECT source_updated_at FROM pos_sync_requests WHERE sync_id=?",
      )
      .bind(sync_id)
      .first(),
    first,
  );
});

test("source timestamps work without a sync ID and generated timestamps never block later minimal syncs", async () => {
  const { categories, products } = payload();
  await expectStatus(
    await sync({
      source_updated_at: "2100-01-01T00:00:00Z",
      categories,
      products,
    }),
    200,
  );
  products[0].price = 4;
  await expectStatus(await sync({ categories: [], products }), 200);
  await expectStatus(await sync({ categories: [], products }), 200);
  const logs = await db
    .prepare(
      "SELECT sync_id,source_updated_at FROM pos_sync_requests ORDER BY source_updated_at",
    )
    .all();
  assert.equal(logs.results.length, 3);
  assert.equal(new Set(logs.results.map((row) => row.sync_id)).size, 3);
  assert.ok(
    logs.results[0].source_updated_at < logs.results[1].source_updated_at,
  );
  assert.ok(
    logs.results[1].source_updated_at < logs.results[2].source_updated_at,
  );
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM products").first("n"),
    1,
  );
  assert.equal(
    await db
      .prepare("SELECT price_cents FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("price_cents"),
    4,
  );
});

test("optional sync metadata is still validated when supplied", async () => {
  const { categories, products } = payload();
  for (const metadata of [
    { sync_id: null },
    { sync_id: "invalid" },
    { source_updated_at: null },
    { source_updated_at: "invalid" },
  ])
    await expectStatus(await sync({ categories, products, ...metadata }), 400);
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM products").first("n"),
    0,
  );
});

test("maps POS price and new option text metadata without changing D1 price columns", async () => {
  const body = payload();
  Object.assign(body.products[0], {
    price: 2.5,
    portions: [
      {
        id: PORTION,
        label_km: "Small",
        price: 2.5,
        price_rule: "fixed",
        unit: "cup",
      },
    ],
    modifier_groups: [
      {
        id: "milk",
        label_km: "Milk",
        options: [
          { id: "oat", label_km: "Oat", price: 0.5, prefix: "+" },
          { id: "no-milk", label_km: "No milk", price: -0.5 },
        ],
      },
    ],
  });
  await expectStatus(await sync(body), 200);
  const stored = await db
    .prepare(
      "SELECT price_cents,portions_json,modifier_groups_json FROM products WHERE id=?",
    )
    .bind(PRODUCT)
    .first();
  assert.equal(stored.price_cents, 2.5);
  const portions = JSON.parse(stored.portions_json);
  const groups = JSON.parse(stored.modifier_groups_json);
  assert.equal(portions[0].priceCents, 2.5);
  assert.equal(portions[0].priceRule, "fixed");
  assert.equal(portions[0].unit, "cup");
  assert.equal(groups[0].options[0].priceCents, 0.5);
  assert.equal(groups[0].options[0].prefix, "+");
  const columns = await db.prepare("PRAGMA table_info(products)").all();
  assert.ok(columns.results.some((column) => column.name === "price_cents"));
  assert.ok(!columns.results.some((column) => column.name === "price"));
  // An ordinary dashboard product save must not strip POS option metadata.
  await expectStatus(
    await request(
      `/api/admin/products/${PRODUCT}`,
      {
        categoryId: CAT,
        nameKm: "Updated coffee",
        priceCents: 2.5,
        portions,
        modifierGroups: groups,
      },
      "owner-a",
      "PUT",
    ),
    200,
  );
  const edited = await db
    .prepare(
      "SELECT portions_json,modifier_groups_json FROM products WHERE id=?",
    )
    .bind(PRODUCT)
    .first();
  assert.equal(JSON.parse(edited.portions_json)[0].priceRule, "fixed");
  assert.equal(JSON.parse(edited.portions_json)[0].unit, "cup");
  assert.equal(
    JSON.parse(edited.modifier_groups_json)[0].options[0].prefix,
    "+",
  );
  const menu = await expectStatus(
    await request(
      "/api/public/businesses/test-a/menu",
      undefined,
      undefined,
      "GET",
    ),
    200,
  );
  const product = menu.products.find((row) => row.id === PRODUCT);
  assert.equal(product.portions[0].priceRule, "fixed");
  assert.equal(product.portions[0].unit, "cup");
  assert.equal(product.modifierGroups[0].options[0].prefix, "+");
  assert.equal(product.modifierGroups[0].options[1].priceCents, -0.5);
});

test("generates option IDs and replaces supplied collections on sync", async () => {
  const example = JSON.parse(
    await readFile(
      new URL("../docs/examples/pos-sync-full.json", import.meta.url),
      "utf8",
    ),
  );
  const product = example.products[0];
  const initial = { ...example, sync_id: randomUUID() };
  const savedOptions = async () => {
    const row = await db
      .prepare(
        "SELECT portions_json, modifier_groups_json FROM products WHERE id=?",
      )
      .bind(product.id)
      .first();
    return {
      portions: JSON.parse(row.portions_json),
      groups: JSON.parse(row.modifier_groups_json),
    };
  };
  const ids = ({ portions, groups }) => [
    ...portions.map((portion) => portion.id),
    ...groups.flatMap((group) => [
      group.id,
      ...group.options.map((option) => option.id),
    ]),
  ];

  await expectStatus(await sync(initial), 200);
  const before = await savedOptions();
  for (const id of ids(before)) assert.match(id, /^[0-9a-f-]{36}$/);
  await expectStatus(await sync(initial), 200);
  assert.deepEqual(await savedOptions(), before);

  await expectStatus(
    await syncProduct({
      product: {
        id: product.id,
        price_entries: [
          {
            price_list_id: "special_a",
            target_key: before.portions[0].id,
            price_cents: 2,
          },
        ],
      },
    }),
    200,
  );
  assert.deepEqual(await savedOptions(), before);

  const portion = { ...product.portions[0], price: 3 };
  const group = {
    ...product.modifier_groups[0],
    options: [product.modifier_groups[0].options[1]],
  };
  await expectStatus(
    await syncProduct({
      product: {
        id: product.id,
        portions: [portion],
        modifier_groups: [group],
      },
    }),
    200,
  );
  const after = await savedOptions();
  assert.equal(after.portions.length, 1);
  assert.equal(after.groups.length, 1);
  assert.equal(after.groups[0].options.length, 1);
  assert.equal(after.groups[0].options[0].priceCents, 0.5);
  for (const id of ids(after)) {
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.ok(!ids(before).includes(id));
  }
  const prices = await db
    .prepare(
      "SELECT price_list_id, target_key, price_amount FROM product_prices WHERE product_id=?",
    )
    .bind(product.id)
    .all();
  assert.deepEqual(prices.results, [
    {
      price_list_id: "normal_a",
      target_key: after.portions[0].id,
      price_amount: 3,
    },
  ]);

  await expectStatus(
    await syncProduct({
      product: {
        id: product.id,
        price: 2.5,
        portions: [],
        modifier_groups: [],
      },
    }),
    200,
  );
  assert.deepEqual(await savedOptions(), { portions: [], groups: [] });
});

test("requires supported product and portion prices and validates option metadata", async () => {
  for (const oldKey of ["price_cents", "price_cent"]) {
    const body = payload();
    const product = body.products[0];
    product[oldKey] = product.price;
    delete product.price;
    const missingProductPrice = await expectStatus(await sync(body), 400);
    assert.match(missingProductPrice.error, /products\[0\]\.price:/);
    product.portions = [{ id: PORTION, label_km: "Small", [oldKey]: 2.5 }];
    const missingPortionPrice = await expectStatus(await sync(body), 400);
    assert.match(missingPortionPrice.error, /portions\[0\]\.price:/);
  }
  for (const [key, value] of [
    ["price_rule", 7],
    ["unit", []],
    ["price_rule", "x".repeat(121)],
    ["unit", "x".repeat(41)],
  ]) {
    const body = payload();
    body.products[0].portions = [
      { id: PORTION, label_km: "Small", price: 2.5, [key]: value },
    ];
    const error = await expectStatus(await sync(body), 400);
    assert.ok(error.error.includes(`.${key}:`));
  }
  for (const prefix of [false, "x".repeat(41)]) {
    const body = payload();
    body.products[0].modifier_groups = [
      {
        id: "milk",
        label_km: "Milk",
        options: [{ id: "oat", label_km: "Oat", price: 0.5, prefix }],
      },
    ];
    const error = await expectStatus(await sync(body), 400);
    assert.ok(error.error.includes(".prefix:"));
  }
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM products").first("n"),
    0,
  );
});

test("ignores extra POS fields while applying supported snake_case fields", async () => {
  const body = payload({
    business_id: "biz_b",
    syncId: "unused-alias",
    menus: [
      { id: POS_MENU, name_en: "Drinks", nameEn: "Ignored", pos_display: "front" },
      { id: POS_SECTION, parent_id: POS_MENU, name_en: "Coffee" },
    ],
    menu_products: [{ menu_id: POS_SECTION, product_id: PRODUCT, pos_row: 1 }],
  });
  Object.assign(body.categories[0], { nameEn: "Ignored", pos_department: "Beverages" });
  Object.assign(body.products[0], {
    business_id: "biz_b",
    priceCents: 500,
    portions: [{ id: PORTION, label_km: "Small", price: 2.5, product_code: "COFFEE" }],
    modifier_groups: [{
      id: "milk", label_km: "Milk", pos_group_code: "MILK",
      options: [{ id: "oat", label_km: "Oat", price_cents: 500, pos_option_code: "OAT" }],
    }],
    price_entries: [{ price_list_id: "special_a", target_key: PORTION, price_cents: 2, pos_row: 1 }],
  });
  await expectStatus(await sync(body), 200);
  const product = await db.prepare("SELECT * FROM products WHERE id=?").bind(PRODUCT).first();
  assert.equal(product.business_id, "biz_a");
  assert.equal(product.price_cents, 2.5);
  assert.deepEqual(JSON.parse(product.portions_json), [{
    id: PORTION, labelKm: "Small", labelEn: "", labelZh: "", priceCents: 2.5, priceRule: "", unit: "",
  }]);
  const [group] = JSON.parse(product.modifier_groups_json);
  assert.equal(Object.hasOwn(group, "pos_group_code"), false);
  assert.deepEqual(group.options, [{
    id: "oat", labelKm: "Oat", labelEn: "", labelZh: "", priceCents: null, prefix: "",
  }]);
  assert.equal(await db.prepare("SELECT name_en FROM categories WHERE id=?").bind(CAT).first("name_en"), "Drinks");
  assert.equal(await db.prepare("SELECT name_en FROM menus WHERE id=?").bind(POS_MENU).first("name_en"), "Drinks");
  assert.equal(await db.prepare("SELECT price_amount FROM product_prices WHERE product_id=? AND price_list_id='special_a'")
    .bind(PRODUCT).first("price_amount"), 2);
  await expectStatus(await syncProduct({
    source: "POS",
    product: { id: PRODUCT, unit: "cup", pos_department: "Beverages" },
  }), 200);
  assert.equal(await db.prepare("SELECT unit FROM products WHERE id=?").bind(PRODUCT).first("unit"), "cup");
});

test("accepts relative POS image paths without absolute URL validation", async () => {
  const { categories, products } = payload();
  for (const [categoryImage, productImage] of [
    ["/files/drinks.webp", "/files/iced-coffee.webp"],
    ["files/drinks.webp", "iced-coffee.webp"],
    ["https://pos.example/drinks.webp", "https://pos.example/iced-coffee.webp"],
    ["c".repeat(2048), "p".repeat(2048)],
    ["", ""],
    [null, null],
  ]) {
    categories[0].image_url = categoryImage;
    products[0].image_url = productImage;
    await expectStatus(await sync({ categories, products }), 200);
    assert.equal(
      await db
        .prepare("SELECT image_url FROM categories WHERE id=?")
        .bind(CAT)
        .first("image_url"),
      categoryImage || null,
    );
    assert.equal(
      await db
        .prepare("SELECT image_url FROM products WHERE id=?")
        .bind(PRODUCT)
        .first("image_url"),
      productImage || null,
    );
  }
  for (const invalidImage of [123, {}]) {
    products[0].image_url = invalidImage;
    const error = await expectStatus(await sync({ categories, products }), 400);
    assert.match(error.error, /^products\[0\]\.image_url:/);
  }
});

test("sets oversized image URLs to null and still syncs the rest of the catalog", async () => {
  const { categories, products } = payload();
  categories[0].image_url = "c".repeat(2049);
  products[0].image_url = "p".repeat(2049);
  products[0].price = 4.25;
  products.push({
    id: PRODUCT2,
    category_id: CAT,
    name: "Tea",
    price: 1.5,
    image_url: "/files/tea.webp",
  });
  const result = await expectStatus(await sync({ categories, products }), 200);
  assert.deepEqual(result, { message: "POS catalog synced successfully." });
  assert.equal(
    await db
      .prepare("SELECT image_url FROM categories WHERE id=?")
      .bind(CAT)
      .first("image_url"),
    null,
  );
  assert.equal(
    await db
      .prepare("SELECT image_url FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("image_url"),
    null,
  );
  assert.equal(
    await db
      .prepare("SELECT price_cents FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("price_cents"),
    4.25,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT price_amount FROM product_prices WHERE product_id=? AND price_list_id='normal_a'",
      )
      .bind(PRODUCT)
      .first("price_amount"),
    4.25,
  );
  assert.equal(
    await db
      .prepare("SELECT image_url FROM products WHERE id=?")
      .bind(PRODUCT2)
      .first("image_url"),
    "/files/tea.webp",
  );
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM products").first("n"),
    2,
  );
  products[1].image_url = "x".repeat(2049);
  products[1].price = 2;
  await expectStatus(
    await sync({ categories: [], products: [products[1]] }),
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT image_url FROM products WHERE id=?")
      .bind(PRODUCT2)
      .first("image_url"),
    null,
  );
  assert.equal(
    await db
      .prepare("SELECT price_cents FROM products WHERE id=?")
      .bind(PRODUCT2)
      .first("price_cents"),
    2,
  );
});

test("normalizes invalid sort orders and preserves valid ordering", async () => {
  const values = [
    0,
    42,
    999999,
    1000000,
    Number.MAX_SAFE_INTEGER,
    -1,
    -0.5,
    2.5,
    "bad",
    null,
  ];
  const expected = [
    0, 42, 999999, 999999, 999999, 0, 0, 999999, 999999, 999999,
  ];
  const categories = values.map((sort_order, index) => ({
    id: randomUUID(),
    name: `Category ${index}`,
    sort_order,
  }));
  const products = values.map((sort_order, index) => ({
    id: randomUUID(),
    category_id: categories[index].id,
    name: `Product ${index}`,
    price: 2.5,
    sort_order,
  }));
  const result = await expectStatus(await sync({ categories, products }), 200);
  assert.deepEqual(result, { message: "POS catalog synced successfully." });
  for (const [table, rows] of [
    ["categories", categories],
    ["products", products],
  ]) {
    for (const [index, row] of rows.entries()) {
      assert.equal(
        await db
          .prepare(`SELECT sort_order FROM ${table} WHERE id=?`)
          .bind(row.id)
          .first("sort_order"),
        expected[index],
      );
    }
  }
  await expectStatus(
    await sync({
      categories: [{ id: categories[0].id, sort_order: 1000000 }],
      products: [
        { id: products[0].id, sort_order: 1000000 },
        { id: products[1].id, price: 3 },
      ],
    }),
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT sort_order FROM categories WHERE id=?")
      .bind(categories[0].id)
      .first("sort_order"),
    999999,
  );
  assert.equal(
    await db
      .prepare("SELECT sort_order FROM products WHERE id=?")
      .bind(products[0].id)
      .first("sort_order"),
    999999,
  );
  assert.equal(
    await db
      .prepare("SELECT sort_order FROM products WHERE id=?")
      .bind(products[1].id)
      .first("sort_order"),
    42,
  );
  assert.equal(
    await db
      .prepare("SELECT price_cents FROM products WHERE id=?")
      .bind(products[1].id)
      .first("price_cents"),
    3,
  );
});

test("preserves omitted fields, supports explicit clearing, and updates Normal Rate", async () => {
  const first = payload();
  Object.assign(first.products[0], {
    image_url: "https://pos.example/coffee.webp",
    description: "Keep me",
    name_zh: "咖啡",
    is_featured: true,
    rating: 4.5,
  });
  await expectStatus(await sync(first), 200);
  const second = payload({
    categories: [],
    source_updated_at: "2026-11-07T01:00:00Z",
    products: [{ id: PRODUCT, price: 3.75, rating: null }],
  });
  await expectStatus(await sync(second), 200);
  const row = await db
    .prepare("SELECT * FROM products WHERE id=?")
    .bind(PRODUCT)
    .first();
  assert.equal(row.name_zh, "咖啡");
  assert.equal(row.description, "Keep me");
  assert.equal(row.image_url, "https://pos.example/coffee.webp");
  assert.equal(row.is_featured, 1);
  assert.equal(row.rating, null);
  assert.equal(
    await db
      .prepare(
        "SELECT price_amount FROM product_prices WHERE product_id=? AND price_list_id='normal_a' AND target_key='base'",
      )
      .bind(PRODUCT)
      .first("price_amount"),
    3.75,
  );
  const third = payload({
    categories: [],
    source_updated_at: "2026-11-07T02:00:00Z",
    products: [{ id: PRODUCT, image_url: null, is_available: false }],
  });
  await expectStatus(await sync(third), 200);
  assert.equal(
    await db
      .prepare("SELECT image_url FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("image_url"),
    null,
  );
  const publicMenu = await expectStatus(
    await request(
      "/api/public/businesses/test-a/menu",
      undefined,
      undefined,
      "GET",
    ),
    200,
  );
  assert.equal(publicMenu.products.length, 0);
});

test("retries are idempotent, conflicting sync IDs and older snapshots are rejected", async () => {
  const body = JSON.stringify(payload());
  await expectStatus(await sync(body), 200);
  const before = await version();
  await expectStatus(await sync(body), 200);
  assert.equal(await version(), before);
  const changed = JSON.parse(body);
  changed.products[0].price = 9;
  assert.equal(
    (await expectStatus(await sync(changed), 409)).code,
    "SYNC_ID_REUSED",
  );
  assert.equal(
    (
      await expectStatus(
        await sync(payload({ source_updated_at: "2026-11-06T23:00:00Z" })),
        409,
      )
    ).code,
    "STALE_SYNC",
  );
  assert.equal(
    (await expectStatus(await sync(payload()), 409)).code,
    "STALE_SYNC",
  );
  assert.equal(await version(), before);
});

test("concurrent retries commit only once", async () => {
  const body = JSON.stringify(payload());
  const responses = await Promise.all([sync(body), sync(body)]);
  for (const response of responses) await expectStatus(response, 200);
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM pos_sync_requests").first("n"),
    1,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT catalog_version FROM pos_integrations WHERE business_id='biz_a'",
      )
      .first("catalog_version"),
    1,
  );
});

test("validates tenant ownership of UUIDs, references, media and price lists", async () => {
  await db.batch([
    db
      .prepare(
        "INSERT INTO categories (id,business_id,name,slug) VALUES (?,'biz_b','Foreign','foreign')",
      )
      .bind(CHILD),
    db
      .prepare(
        "INSERT INTO products (id,business_id,category_id,name,slug,price_cents) VALUES (?,'biz_b',?,'Foreign','foreign',1)",
      )
      .bind(PRODUCT2, CHILD),
  ]);
  await expectStatus(
    await sync(
      payload({ categories: [{ id: CHILD, name: "Takeover" }], products: [] }),
    ),
    409,
  );
  await expectStatus(
    await sync(
      payload({
        products: [
          { id: PRODUCT2, category_id: CAT, name: "Takeover", price: 1 },
        ],
      }),
    ),
    409,
  );
  const badParent = payload();
  badParent.categories[0].parent_id = CHILD;
  await expectStatus(await sync(badParent), 400);
  const badCategory = payload();
  badCategory.products[0].category_id = CHILD;
  const badCategoryError = await expectStatus(await sync(badCategory), 400);
  assert.match(badCategoryError.error, /category_id/);
  const badMedia = payload();
  badMedia.products[0].primary_media_id = "media_b";
  await expectStatus(await sync(badMedia), 400);
  const badPrice = payload();
  badPrice.products[0].price_entries = [
    { price_list_id: "normal_b", target_key: "base", price_cents: 1 },
  ];
  await expectStatus(await sync(badPrice), 400);
  assert.equal(
    await db
      .prepare("SELECT count(*) AS n FROM categories WHERE business_id='biz_a'")
      .first("n"),
    0,
  );
});

test("rejects malformed data, missing required fields, duplicate IDs and category cycles before writing", async () => {
  await expectStatus(await sync("{broken"), 400);
  const duplicates = payload();
  duplicates.products.push({ ...duplicates.products[0] });
  await expectStatus(await sync(duplicates), 400);
  const cycle = payload({
    categories: [
      { id: CAT, name: "A", parent_id: CHILD },
      { id: CHILD, name: "B", parent_id: CAT },
    ],
  });
  await expectStatus(await sync(cycle), 400);
  const negative = payload();
  negative.products[0].price = -1;
  const priceError = await expectStatus(await sync(negative), 400);
  assert.match(priceError.error, /^products\[0\]\.price:/);
  const invalidPhoto = payload();
  invalidPhoto.products[0].image_url = "https://pos.example/coffee.webp";
  invalidPhoto.products[0].primary_media_id = "media_a";
  const photoError = await expectStatus(await sync(invalidPhoto), 400);
  assert.match(photoError.error, /send image_url or primary_media_id/);
  const legacyCategoryField = payload();
  legacyCategoryField.products[0].categoryId = CAT;
  delete legacyCategoryField.products[0].category_id;
  const legacyError = await expectStatus(await sync(legacyCategoryField), 400);
  assert.match(legacyError.error, /^products\[0\]\.category_id:/);
  await expectStatus(await sync(payload({ currency: "KHR" })), 400);
  await expectStatus(
    await sync(payload({ categories: [], products: [] })),
    400,
  );
  await expectStatus(
    await sync(payload({ source_updated_at: "2026-02-30T00:00:00Z" })),
    400,
  );
  const tooMany = payload({
    products: Array.from({ length: 1001 }, () => ({ id: randomUUID() })),
  });
  await expectStatus(await sync(tooMany), 400);
  const wrongType = await request(
    "/api/integrations/pos/sync",
    JSON.stringify(payload()),
    key,
    "POST",
    { "content-type": "text/plain" },
  );
  await expectStatus(wrongType, 415);
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM products").first("n"),
    0,
  );
});

test("accepts .NET ISO timestamps and canonicalizes uppercase POS UUIDs", async () => {
  const category = randomUUID();
  const product = randomUUID();
  const body = payload({
    source_updated_at: "2026-11-07T00:00:00.1234567Z",
    categories: [{ id: category.toUpperCase(), name: "Drinks" }],
    products: [
      {
        id: product.toUpperCase(),
        category_id: category.toUpperCase(),
        name: "Coffee",
        price: 1,
      },
    ],
  });
  await expectStatus(await sync(body), 200);
  assert.equal(
    await db
      .prepare("SELECT id FROM products WHERE id=?")
      .bind(product)
      .first("id"),
    product,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT last_source_updated_at FROM pos_integrations WHERE business_id='biz_a'",
      )
      .first("last_source_updated_at"),
    "2026-11-07T00:00:00.123Z",
  );
});

test("rolls back all categories, products, prices, cache version and retry marker on database failure", async () => {
  await db
    .prepare(
      "CREATE TRIGGER pos_test_fail_price BEFORE INSERT ON product_prices BEGIN SELECT RAISE(ABORT,'intentional-pos-test-failure'); END",
    )
    .run();
  const before = await version();
  const body = payload();
  await expectStatus(await sync(body), 500);
  for (const table of [
    "categories",
    "products",
    "product_prices",
    "pos_sync_requests",
  ])
    assert.equal(
      await db
        .prepare(`SELECT count(*) AS n FROM ${table} WHERE business_id='biz_a'`)
        .first("n"),
      0,
    );
  assert.equal(await version(), before);
  await db.prepare("DROP TRIGGER pos_test_fail_price").run();
  await expectStatus(await sync(body), 200);
});

test("generates unique slugs for omitted, null and blank values and preserves existing slugs", async () => {
  const blanks = [undefined, null, "", "   "];
  const categories = blanks.map((slug) => ({
    id: randomUUID(),
    name_en: "Drinks",
    ...(slug === undefined ? {} : { slug }),
  }));
  const products = blanks.map((slug, index) => ({
    id: randomUUID(),
    category_id: categories[index].id,
    name_en: "Iced coffee",
    price: 2.5,
    ...(slug === undefined ? {} : { slug }),
  }));
  await expectStatus(await sync({ categories, products }), 200);
  for (const row of categories) {
    assert.equal(
      await db
        .prepare("SELECT slug FROM categories WHERE id=?")
        .bind(row.id)
        .first("slug"),
      `drinks-${row.id}`,
    );
  }
  for (const row of products) {
    assert.equal(
      await db
        .prepare("SELECT slug FROM products WHERE id=?")
        .bind(row.id)
        .first("slug"),
      `iced-coffee-${row.id}`,
    );
  }
  await expectStatus(
    await sync({
      categories: categories.map((row) => ({
        ...row,
        name_en: "Renamed drinks",
      })),
      products: products.map((row) => ({ ...row, name_en: "Renamed coffee" })),
    }),
    200,
  );
  for (const row of products)
    assert.equal(
      await db
        .prepare("SELECT slug FROM products WHERE id=?")
        .bind(row.id)
        .first("slug"),
      `iced-coffee-${row.id}`,
    );
  await expectStatus(
    await sync({
      categories: [{ id: categories[0].id, slug: "custom-drinks" }],
      products: [{ id: products[0].id, slug: "custom-coffee" }],
    }),
    200,
  );
  await expectStatus(
    await sync({
      categories: [{ id: categories[0].id, slug: null }],
      products: [{ id: products[0].id, slug: "" }],
    }),
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT slug FROM categories WHERE id=?")
      .bind(categories[0].id)
      .first("slug"),
    "custom-drinks",
  );
  assert.equal(
    await db
      .prepare("SELECT slug FROM products WHERE id=?")
      .bind(products[0].id)
      .first("slug"),
    "custom-coffee",
  );
  await expectStatus(
    await sync({
      categories: [],
      products: [{ id: products[0].id, slug: 123 }],
    }),
    400,
  );
  await expectStatus(
    await sync({
      categories: [],
      products: [{ id: products[0].id, slug: "Bad Slug!" }],
    }),
    400,
  );
});

test("allows swapping product codes and slugs without unique-index failures", async () => {
  const first = payload({
    products: [
      {
        id: PRODUCT,
        category_id: CAT,
        name: "A",
        slug: "a",
        code: "A",
        price: 1,
      },
      {
        id: PRODUCT2,
        category_id: CAT,
        name: "B",
        slug: "b",
        code: "B",
        price: 2,
      },
    ],
  });
  await expectStatus(await sync(first), 200);
  await expectStatus(
    await sync(
      payload({
        categories: [],
        source_updated_at: "2026-11-07T01:00:00Z",
        products: [
          { id: PRODUCT, code: "B", slug: "b" },
          { id: PRODUCT2, code: "A", slug: "a" },
        ],
      }),
    ),
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT code FROM products WHERE id=?")
      .bind(PRODUCT)
      .first("code"),
    "B",
  );
  assert.equal(
    await db
      .prepare("SELECT slug FROM products WHERE id=?")
      .bind(PRODUCT2)
      .first("slug"),
    "a",
  );
});

test("UUID records remain editable, sortable, priceable and deletable through existing admin APIs", async () => {
  await expectStatus(await sync(payload()), 200);
  await expectStatus(
    await request(
      `/api/admin/products/${PRODUCT}`,
      { categoryId: CAT, nameKm: "Updated", priceCents: 4 },
      "owner-a",
      "PUT",
    ),
    200,
  );
  await expectStatus(
    await request(
      `/api/admin/categories/${CAT}`,
      { nameKm: "Updated category" },
      "owner-a",
      "PUT",
    ),
    200,
  );
  await expectStatus(
    await request(
      "/api/admin/categories/reorder",
      { items: [{ id: CAT, sortOrder: 3 }] },
      "owner-a",
      "PUT",
    ),
    200,
  );
  await expectStatus(
    await request(
      "/api/admin/products/reorder",
      { categoryId: CAT, items: [{ id: PRODUCT, sortOrder: 2 }] },
      "owner-a",
      "PUT",
    ),
    200,
  );
  await expectStatus(
    await request(
      `/api/admin/products/${PRODUCT}`,
      undefined,
      "owner-a",
      "DELETE",
    ),
    200,
  );
  await expectStatus(
    await request(
      `/api/admin/categories/${CAT}`,
      undefined,
      "owner-a",
      "DELETE",
    ),
    200,
  );
});

test("removes obsolete portion prices and supports clearing a promotional override", async () => {
  const first = payload();
  Object.assign(first.products[0], {
    portions: [{ id: PORTION, label_km: "Small", price: 2 }],
    price_entries: [
      { price_list_id: "special_a", target_key: PORTION, price_cents: 1 },
    ],
  });
  await expectStatus(await sync(first), 200);
  await expectStatus(
    await sync(
      payload({
        categories: [],
        source_updated_at: "2026-11-07T01:00:00Z",
        products: [
          {
            id: PRODUCT,
            portions: [],
            price: 3,
            price_entries: [
              {
                price_list_id: "special_a",
                target_key: "base",
                price_cents: 2,
              },
            ],
          },
        ],
      }),
    ),
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) AS n FROM product_prices WHERE target_key=?")
      .bind(PORTION)
      .first("n"),
    0,
  );
  await expectStatus(
    await sync(
      payload({
        categories: [],
        source_updated_at: "2026-11-07T02:00:00Z",
        products: [
          {
            id: PRODUCT,
            price_entries: [
              {
                price_list_id: "special_a",
                target_key: "base",
                price_cents: null,
              },
            ],
          },
        ],
      }),
    ),
    200,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT count(*) AS n FROM product_prices WHERE price_list_id='special_a'",
      )
      .first("n"),
    0,
  );
});

test("keys are owner-managed, stored hashed, rotated and revoked; disabled/expired businesses cannot sync", async () => {
  await expectStatus(
    await request("/api/admin/integrations/pos", {}, "editor-a", "PUT"),
    403,
  );
  await expectStatus(await sync(payload(), "bad-key"), 401);
  await expectStatus(await sync(payload(), "owner-a"), 401);
  const settings = await expectStatus(
    await request("/api/admin/integrations/pos", undefined, "owner-a", "GET"),
    200,
  );
  assert.equal(settings.integration.keyPrefix, key.slice(0, 12));
  assert.ok(!JSON.stringify(settings).includes(key));
  assert.equal(
    await db
      .prepare(
        "SELECT token_hash FROM pos_integrations WHERE business_id='biz_a'",
      )
      .first("token_hash"),
    sha(key),
  );
  const replacement = await expectStatus(
    await request("/api/admin/integrations/pos", {}, "owner-a", "PUT"),
    200,
  );
  await expectStatus(await sync(payload(), key), 401);
  key = replacement.apiKey;
  await db
    .prepare(
      "UPDATE business_subscriptions SET current_period_end_at='2000-01-01T00:00:00Z' WHERE business_id='biz_a'",
    )
    .run();
  await expectStatus(await sync(payload()), 402);
  await db
    .prepare(
      "UPDATE business_subscriptions SET current_period_end_at=NULL WHERE business_id='biz_a'",
    )
    .run();
  await db.prepare("UPDATE businesses SET is_active=0 WHERE id='biz_a'").run();
  await expectStatus(await sync(payload()), 401);
  await db.prepare("UPDATE businesses SET is_active=1 WHERE id='biz_a'").run();
  await expectStatus(
    await request(
      "/api/admin/integrations/pos",
      undefined,
      "owner-a",
      "DELETE",
    ),
    200,
  );
  await expectStatus(await sync(payload()), 401);
});
