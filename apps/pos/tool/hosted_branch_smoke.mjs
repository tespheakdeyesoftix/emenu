import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const folder = dirname(fileURLToPath(import.meta.url));
const testNative = process.env.POS_STAGING_NATIVE === "1";
const flutter = process.env.POS_FLUTTER_EXECUTABLE;
assert.ok(
  process.env.POS_STAGING_CONFIG,
  "Set POS_STAGING_CONFIG to the staging Wrangler JSON file",
);
assert.ok(
  process.env.POS_STAGING_ORIGIN,
  "Set POS_STAGING_ORIGIN to the staging Worker origin",
);
assert.ok(
  process.env.POS_STAGING_D1_ID,
  "Set POS_STAGING_D1_ID to the isolated D1 database ID",
);
const dart = process.env.POS_DART_EXECUTABLE;
if (testNative) {
  assert.equal(process.platform, "win32");
  assert.ok(flutter, "Set POS_FLUTTER_EXECUTABLE to flutter.bat");
} else {
  assert.ok(dart, "Set POS_DART_EXECUTABLE to the Dart SDK executable");
}
const configPath = resolve(process.env.POS_STAGING_CONFIG);
const config = JSON.parse(await readFile(configPath, "utf8"));
const stage = config.name;
assert.match(stage, /^[a-z0-9-]+-staging$/);
const origin = new URL(process.env.POS_STAGING_ORIGIN);
assert.match(
  origin.hostname,
  new RegExp(`^${stage}\\.[a-z0-9-]+\\.workers\\.dev$`),
);
assert.equal(origin.protocol, "https:");
assert.equal(origin.href, `${origin.origin}/`);
const base = origin.origin;
assert.deepEqual(
  config.d1_databases.map((entry) => entry.database_name),
  [stage],
);
assert.equal(config.d1_databases[0].database_id, process.env.POS_STAGING_D1_ID);
const require = createRequire(
  new URL("../../control/package.json", import.meta.url),
);
const wrangler = require.resolve("wrangler/package.json");
const cli = resolve(dirname(wrangler), require(wrangler).bin.wrangler);
const prefix = "/api/integrations/pos/v1";
const version = "client-pbkdf2-sha256-v1";
const run = randomBytes(8).toString("hex");
const slug = `pos-branch-${run}`;
const password = randomBytes(32).toString("hex");
const ownerEmail = `${slug}@example.test`;
const cashierEmail = `cashier-${slug}@example.test`;
const proof = (email) =>
  pbkdf2Sync(
    password,
    `angkor-emenu:${version}:${email}`,
    120_000,
    32,
    "sha256",
  ).toString("hex");

async function request(
  path,
  { token, method = "GET", body, expected = 200, key } = {},
) {
  const response = await fetch(base + path, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(key && { "idempotency-key": `${run}_${key}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${data.code ?? data.error ?? "unexpected response"}`,
  );
  return data;
}

const register = (email, businessSlug, name) =>
  request("/api/auth/register", {
    method: "POST",
    expected: 201,
    body: {
      slug: businessSlug,
      email,
      passwordProof: proof(email),
      authVersion: version,
      businessName: name,
    },
  });
const owner = await register(ownerEmail, slug, "POS Staging Branch Fixture");
const cashier = await register(
  cashierEmail,
  `staff-${slug}`,
  "POS Staging Staff Fixture",
);
assert.match(owner.business.id, /^biz_[a-zA-Z0-9]+$/);
assert.match(cashier.user.id, /^usr_[a-zA-Z0-9]+$/);
await execute(
  process.execPath,
  [
    cli,
    "d1",
    "execute",
    stage,
    "--remote",
    "--config",
    configPath,
    "--command",
    `UPDATE businesses SET currency='USD', secondary_exchange_rate=4000, timezone='Asia/Phnom_Penh' WHERE id='${owner.business.id}' AND slug='${slug}';
    INSERT INTO memberships(user_id,business_id,role) VALUES ('${cashier.user.id}','${owner.business.id}','editor');`,
  ],
  { timeout: 40_000 },
);

const admin = (path, body, method = "POST", expected = 201) =>
  request("/api/admin" + path, {
    token: owner.token,
    ...(body === undefined ? {} : { method, body, expected }),
  });
const {
  branches: [branch],
} = await admin("/branches");
const {
  groups: [group],
} = await admin("/table-groups");
await admin("/tables", {
  groupId: group.id,
  code: "A1",
  label: "Staging Table A1",
});
const category = await admin("/categories", {
  nameKm: "ភេសជ្ជៈ",
  nameEn: "Drinks",
});
const product = await admin("/products", {
  categoryId: category.id,
  nameKm: "កាហ្វេ",
  nameEn: "Coffee",
  priceCents: 2.51,
});
const cash = await admin("/pos/payment-types", { name: "Cash", kind: "cash" });
const settings = {
  working_day_enabled: true,
  cashier_shift_enabled: true,
  catalog_mode: "category",
  selected_ids: [category.id],
  payment_types: [{ id: cash.id, currencies: ["USD", "KHR"] }],
  default_payment_type_id: cash.id,
  ...(testNative && {
    print_copies: 2,
    receipt_template: { title: "Native receipt", show_tax: true },
  }),
};
const dining = await admin("/pos/profiles", {
  name: "Dining",
  branch_id: branch.id,
  config: { ...settings, table_mode: "required" },
});
const retail = await admin("/pos/profiles", {
  name: "Retail",
  branch_id: branch.id,
  config: { ...settings, table_mode: "disabled" },
});
await admin(
  `/pos/profiles/${dining.id}/grants`,
  { user_ids: [cashier.user.id] },
  "PUT",
  200,
);
const discovery = await request(prefix + "/auth/login", {
  method: "POST",
  body: {
    business_slug: slug,
    email: ownerEmail,
    password_proof: proof(ownerEmail),
    auth_version: version,
  },
});
const start = async (profile) =>
  (
    await request(prefix + "/sessions", {
      token: discovery.token,
      method: "POST",
      expected: 201,
      body: { profile_id: profile.id },
    })
  ).token;
const [a, b] = await Promise.all([start(dining), start(retail)]);
const read = (token, path, expected = 200) =>
  request(prefix + path, { token, expected });
const capabilities = (await read(a, "/context")).capabilities;
const testRecovery = process.env.POS_STAGING_RECOVERY === "1";
assert.equal(capabilities.store_operations, true);
assert.equal(capabilities.staff_usernames, true);
if (testRecovery) assert.equal(capabilities.store_recovery, true);
await request(prefix + `/staff/${cashier.user.id}/username`, {
  token: a,
  method: "PUT",
  key: "cashier",
  body: { username: "counter-cashier" },
});

async function verifyBranch() {
  const { stdout } = await execute(
    dart,
    ["run", "tool/worker_sync_smoke.dart"],
    {
      cwd: resolve(folder, ".."),
      env: {
        ...process.env,
        POS_API_BASE: base,
        POS_BUSINESS_SLUG: slug,
        POS_EMAIL: ownerEmail,
        POS_PASSWORD: password,
        POS_CASHIER_USERNAME: "counter-cashier",
        POS_PROFILE_ID: dining.id,
        POS_SECOND_PROFILE_ID: retail.id,
        POS_PRODUCT_ID: product.id,
        POS_SMOKE_REVOKE_CASHIER_TOKEN: testRecovery ? owner.token : undefined,
      },
      timeout: 180_000,
    },
  );
  const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
  const [diningSale, retailSale, diningShift, retailShift, day, reversal] =
    await Promise.all([
      read(a, `/sales/${result.server_sale_id}`),
      read(b, `/sales/${result.side_sale_id}`),
      read(a, `/cashier-shifts/${result.last_shift_id}`),
      read(b, `/cashier-shifts/${result.side_shift_id}`),
      read(a, `/working-days/${result.day_id}`),
      read(a, `/sales/${result.reversal_id}`),
    ]);
  assert.equal(diningSale.settled_by, cashier.user.id);
  assert.equal(diningSale.working_day_id, day.id);
  assert.equal(retailSale.working_day_id, day.id);
  assert.equal(retailSale.table_id, null);
  assert.equal(diningSale.total_minor, 251);
  assert.equal(retailSale.total_minor, 251);
  assert.equal(diningSale.shift_id, diningShift.id);
  assert.equal(retailSale.shift_id, retailShift.id);
  assert.equal(reversal.reverses_sale_id, diningSale.id);
  assert.equal(
    diningShift.closing_counts.find((row) => row.currency === "USD")
      .expected_minor,
    300,
  );
  assert.equal(
    retailShift.closing_counts.find((row) => row.currency === "USD")
      .expected_minor,
    1151,
  );
  assert.ok(
    [...diningShift.closing_counts, ...retailShift.closing_counts].every(
      (row) => row.variance_minor === 0,
    ),
  );
  assert.ok(day.closed_at);
  assert.equal((await read(b, `/working-days/${day.id}`)).id, day.id);
  await read(a, `/sales/${retailSale.id}`, 404);
  await read(b, `/sales/${diningSale.id}`, 404);
  assert.equal((await read(a, "/store-authority")).authority, null);
  if (testRecovery) {
    const { recoveries } = await read(a, "/store-operations/recoveries");
    assert.ok(recoveries.length >= 3);
    assert.deepEqual(
      recoveries.map((entry) => entry.command_id).sort(),
      result.approved_commands.sort(),
    );
    assert.ok(
      recoveries.every(
        (entry) =>
          entry.operator_id === cashier.user.id &&
          entry.approved_by === owner.user.id,
      ),
    );
  }
  return {
    profiles: 2,
    tills: 3,
    business_date: day.business_date,
    drawer_variances: [0, 0],
    recovered_operations: result.approved_commands.length,
  };
}

async function verifyNative() {
  const tempRoot = resolve(tmpdir());
  const scratch = await mkdtemp(resolve(tempRoot, "emenu-native-"));
  assert.equal(dirname(resolve(scratch)), tempRoot);
  const project = process.env.POS_NATIVE_PROJECT || resolve(folder, "..");
  const shell = resolve(
    process.env.SystemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  try {
    for (const phase of ["activate", "resume"]) {
      const { stdout } = await execute(
        shell,
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "& $env:POS_FLUTTER_EXECUTABLE test -d windows --no-pub --reporter expanded integration_test/windows_register_test.dart; exit $LASTEXITCODE",
        ],
        {
          cwd: project,
          timeout: 420_000,
          env: {
            ...process.env,
            POS_NATIVE_PHASE: phase,
            POS_NATIVE_DIRECTORY: scratch,
            POS_NATIVE_ORIGIN: base,
            POS_NATIVE_SLUG: slug,
            POS_NATIVE_OWNER_ID: owner.user.id,
            POS_NATIVE_OWNER_EMAIL: ownerEmail,
            POS_NATIVE_PASSWORD: password,
            POS_NATIVE_CASHIER_ID: cashier.user.id,
            POS_NATIVE_PROFILE_ID: dining.id,
          },
        },
      );
      assert.match(stdout, /All tests passed/);
      console.log(`Windows ${phase} passed`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  const { working_day: day, cashier_shift: shift } = await read(a, "/context");
  const { sales } = await read(a, "/sales?status=paid");
  assert.equal(sales.length, 1);
  const sale = await read(a, `/sales/${sales[0].id}`);
  assert.equal(sale.settled_by, cashier.user.id);
  assert.equal(sale.working_day_id, day.id);
  assert.equal(sale.shift_id, shift.id);
  assert.equal(sale.total_minor, 251);
  assert.ok(sale.table_id);
  assert.deepEqual(
    sale.payments.map((payment) => [payment.currency, payment.amount_minor]),
    [
      ["USD", 125],
      ["KHR", 6000],
      ["KHR", -960],
    ],
  );
  const reconciliation = await read(
    a,
    `/cashier-shifts/${shift.id}/reconciliation`,
  );
  assert.deepEqual(
    Object.fromEntries(
      reconciliation.counts.map((row) => [row.currency, row.expected_minor]),
    ),
    { USD: 125, KHR: 5040 },
  );
  const closed = await request(`${prefix}/cashier-shifts/${shift.id}/close`, {
    token: a,
    method: "POST",
    key: "native_shift_close",
    body: {
      activity_revision: reconciliation.activity_revision,
      counts: reconciliation.counts.map((row) => ({
        payment_type_id: row.payment_type_id,
        currency: row.currency,
        declared_minor: row.expected_minor,
      })),
    },
  });
  await request(`${prefix}/working-days/${day.id}/close`, {
    token: a,
    method: "POST",
    key: "native_day_close",
    body: {},
  });
  assert.ok(closed.closing_counts.every((row) => row.variance_minor === 0));
  return {
    windows_native: true,
    restarted_offline: true,
    sale: sale.id,
    receipt_pages: 2,
    drawer_variances: [0, 0],
  };
}

const summary = await (testNative ? verifyNative() : verifyBranch());
await Promise.all(
  [a, b, discovery.token].map((token) =>
    request(prefix + "/sessions/current", { token, method: "DELETE" }),
  ),
);
await Promise.all(
  [owner.token, cashier.token].map((token) =>
    request("/api/auth/logout", { token, method: "POST" }),
  ),
);
console.log(
  JSON.stringify({
    status: "passed",
    target: base,
    fixture: slug,
    ...summary,
  }),
);
