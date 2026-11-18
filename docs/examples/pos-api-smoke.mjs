import { pbkdf2Sync } from "node:crypto";

const authVersion = "client-pbkdf2-sha256-v1";
const base = (process.env.POS_API_BASE ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);
const pos = "/api/integrations/pos/v1";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

async function request(path, { method = "GET", token, body, key } = {}) {
  const response = await fetch(base + pos + path, {
    method,
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const reference = data.request_id ? ` (${data.request_id})` : "";
    throw new Error(
      `${method} ${path} returned ${response.status} ${data.code}: ${data.error}${reference}`,
    );
  }
  return data;
}

async function connect() {
  const email = required("POS_EMAIL").trim().toLowerCase();
  const proof = pbkdf2Sync(
    required("POS_PASSWORD"),
    `angkor-emenu:${authVersion}:${email}`,
    120_000,
    32,
    "sha256",
  ).toString("hex");
  const { token } = await request("/auth/login", {
    method: "POST",
    body: {
      business_slug: required("POS_BUSINESS_SLUG"),
      email,
      auth_version: authVersion,
      password_proof: proof,
    },
  });
  const profileId = required("POS_PROFILE_ID");
  let selected;
  for (let page = 1; !selected; page++) {
    const { profiles, has_more } = await request(`/profiles?page=${page}`, {
      token,
    });
    selected = profiles.find((profile) => profile.id === profileId);
    if (!has_more) break;
  }
  if (!selected)
    throw new Error("The selected profile is unavailable to this operator");
  const session = await request("/sessions", {
    method: "POST",
    token,
    body: { profile_id: profileId },
  });
  await request("/sessions/current", { method: "DELETE", token });
  return session.token;
}

function printReceipt(sale) {
  const receipt = sale.receipt;
  const lines = [
    receipt.template.title || receipt.business_name,
    `${receipt.branch_name} / ${receipt.profile_name}`,
    `${sale.id} | ${sale.business_date}`,
    ...sale.lines.map(
      (line) => `${line.quantity} × ${line.product_name}  ${line.total_minor}`,
    ),
    ...(receipt.template.show_tax ? [`Tax ${sale.tax_minor}`] : []),
    `Total ${sale.total_minor} ${sale.currency} minor units`,
    receipt.template.footer,
  ];
  for (let copy = 0; copy < receipt.copies; copy++)
    console.log(lines.join("\n") + "\n");
}

async function run() {
  const phase = process.argv[2];
  if (phase !== "open" && phase !== "settle")
    throw new Error("Use the open or settle command");
  const runId = required("POS_RUN_ID");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(runId))
    throw new Error(
      "Use 8–64 letters, digits, underscores, or hyphens for POS_RUN_ID",
    );
  const token = await connect();
  const read = (path) => request(path, { token });
  const write = (path, step, body = {}) =>
    request(path, { token, method: "POST", body, key: runId + "_" + step });
  try {
    const context = await read("/context");
    const config = context.profile.config;
    if (!config.working_day_enabled || !config.cashier_shift_enabled) {
      throw new Error(
        "Use a smoke-test profile with both working days and cashier shifts enabled",
      );
    }
    if (phase === "open") {
      const productId = required("POS_PRODUCT_ID");
      const day = await write("/working-days", "day_open");
      const shift = await write("/cashier-shifts", "shift_open");
      const sale = await write("/sales", "bill_open", {
        table_id: process.env.POS_TABLE_ID || null,
        lines: [
          {
            product_id: productId,
            portion_id: process.env.POS_PORTION_ID || null,
            quantity: 1,
          },
        ],
      });
      console.log(
        JSON.stringify(
          {
            POS_WORKING_DAY_ID: day.id,
            POS_SHIFT_ID: shift.id,
            POS_SALE_ID: sale.id,
            business_date: day.business_date,
            quote_minor: sale.total_minor,
            currency: sale.currency,
          },
          null,
          2,
        ),
      );
      return;
    }

    const dayId = required("POS_WORKING_DAY_ID");
    const shiftId = required("POS_SHIFT_ID");
    const saleId = required("POS_SALE_ID");
    const [day, shift, sale] = await Promise.all([
      read(`/working-days/${dayId}`),
      read(`/cashier-shifts/${shiftId}`),
      read(`/sales/${saleId}`),
    ]);
    if (shift.working_day_id !== dayId || sale.working_day_id !== dayId)
      throw new Error("The IDs must be from the same demo working day");
    if (
      process.env.POS_DEMO_SAME_DAY !== "1" &&
      context.local_date <= day.business_date
    ) {
      throw new Error(
        "Run settle after local midnight, or set POS_DEMO_SAME_DAY=1 for a same-day smoke test",
      );
    }
    if (sale.status === "open" && context.cashier_shift?.id !== shiftId) {
      throw new Error(
        "The original demo shift must be open to settle this bill",
      );
    }
    const accepted = context.payment_types.filter((type) =>
      type.currency === sale.currency,
    );
    const cash = accepted.find((type) => type.kind === "cash");
    const qr = accepted.find((type) => type.kind === "qr");
    if (!cash || !qr || sale.total_minor < 2)
      throw new Error(
        "Use a bill of at least two minor units and enable cash and QR in its currency",
      );
    const qrAmount = Math.floor(sale.total_minor / 2);
    const paid = await write(`/sales/${saleId}/checkout`, "checkout", {
      revision: sale.status === "paid" ? sale.revision - 1 : sale.revision,
      expected_total_minor: sale.total_minor,
      payments: [
        {
          payment_type_id: cash.id,
          currency: sale.currency,
          amount_minor: sale.total_minor - qrAmount,
        },
        {
          payment_type_id: qr.id,
          currency: sale.currency,
          amount_minor: qrAmount,
          reference: required("POS_DEMO_QR_REFERENCE"),
        },
      ],
    });
    printReceipt(paid);
    const preview = await read(`/cashier-shifts/${shiftId}/reconciliation`);
    const closed = await write(
      `/cashier-shifts/${shiftId}/close`,
      "shift_close",
      {
        activity_revision: preview.activity_revision,
        counts: preview.counts.map((row) => ({
          payment_type_id: row.payment_type_id,
          currency: row.currency,
          // This smoke test uses simulated counts. A real register sends the counted values.
          declared_minor:
            row.declared_minor ??
            (row.payment_kind === "cash"
              ? Math.max(0, row.expected_minor)
              : row.expected_minor),
        })),
      },
    );
    await write(`/working-days/${dayId}/close`, "day_close");
    console.log(
      JSON.stringify(
        {
          sale_id: paid.id,
          business_date: paid.business_date,
          counts: closed.closing_counts,
        },
        null,
        2,
      ),
    );
  } finally {
    await request("/sessions/current", { method: "DELETE", token });
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
