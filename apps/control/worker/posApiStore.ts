import {
  activeDeviceSession,
  bodyOf,
  boolean,
  choice,
  Command,
  conflict,
  currencyOf,
  integer,
  invalid,
  list,
  newId,
  object,
  pageOf,
  PosError,
  recordId,
  requireManager,
  respond,
  sql,
  storeOperatorActive,
  storeOperatorRegistered,
  string,
  type PaymentType,
  type PosContext,
  type PosCurrency,
  type PosDependencies,
  type ProfileConfig,
} from "./posApiCore";
import { importStoreSale, saleAction } from "./posApiSales";
import { findProfile } from "./posApiSetup";
import { writeDay, writeShift } from "./posApiShifts";

type Authority = {
  device_id: string;
  public_key: string | null;
  epoch: string;
  last_sequence: number;
  timezone: string;
  enrolled_at: string;
};

export function storeAuthority(context: PosContext) {
  return sql(
    context.db,
    `SELECT device_id,public_key,epoch,last_sequence,timezone,enrolled_at FROM pos_store_authorities
      WHERE business_id=? AND branch_id=?`,
    context.identity.business_id,
    context.profile.branch_id,
  ).first<Authority>();
}

function currentDevice(context: PosContext) {
  return sql(
    context.db,
    `SELECT d.device_id,d.public_key FROM pos_sessions s
      JOIN pos_device_credentials d ON d.id=s.device_credential_id
      WHERE s.token_hash=? AND s.expires_at>unixepoch() AND ${activeDeviceSession}`,
    context.identity.token_hash,
  ).first<{ device_id: string; public_key: string }>();
}

function ownsAuthority(
  authority: Authority,
  device: Awaited<ReturnType<typeof currentDevice>>,
) {
  return (
    device !== null &&
    authority.device_id === device.device_id &&
    (authority.public_key === null ||
      authority.public_key === device.public_key)
  );
}

const branchIsIdle = `
  NOT EXISTS (SELECT 1 FROM working_days WHERE business_id=?1 AND branch_id=?2 AND closed_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM cashier_shifts WHERE business_id=?1 AND branch_id=?2 AND closed_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM sales WHERE business_id=?1 AND branch_id=?2 AND status IN ('open','submitted'))`;

const ownerSession = `EXISTS (
  SELECT 1 FROM pos_sessions s
  JOIN pos_device_credentials device ON device.id=s.device_credential_id AND device.device_id=?3 AND device.public_key=?5
  JOIN memberships m ON m.business_id=s.business_id AND m.user_id=s.user_id AND m.role='owner'
  JOIN users u ON u.id=m.user_id AND u.password_salt=s.credential_version
  JOIN pos_profiles p ON p.business_id=s.business_id AND p.id=s.profile_id AND p.is_active=1
  JOIN branches b ON b.business_id=p.business_id AND b.id=p.branch_id AND b.is_active=1
  JOIN businesses business ON business.id=p.business_id AND business.is_active=1
  WHERE s.token_hash=?4 AND s.business_id=?1 AND b.id=?2
    AND s.expires_at>unixepoch() AND ${activeDeviceSession}
)`;

export async function manageStoreAuthority(
  context: PosContext,
  request: Request,
) {
  const { db, identity, profile } = context;
  const existing = await storeAuthority(context);
  const device = await currentDevice(context);
  if (request.method === "GET") {
    const owned = existing !== null && ownsAuthority(existing, device);
    return respond({
      authority: existing && {
        epoch: owned ? existing.epoch : null,
        last_sequence: existing.last_sequence,
        timezone: existing.timezone,
        owned_by_device: owned,
      },
    });
  }
  if (identity.role !== "owner" || !device) {
    throw new PosError(
      403,
      "STORE_OWNER_REQUIRED",
      "Use an owner's enrolled POS device",
    );
  }
  const scope = [
    identity.business_id,
    profile.branch_id,
    device.device_id,
    identity.token_hash,
    device.public_key,
  ];
  if (request.method === "POST") {
    if (!existing) {
      await sql(
        db,
        `INSERT INTO pos_store_authorities
          (business_id,branch_id,device_id,public_key,epoch,timezone,enrolled_at,enrolled_by)
          SELECT ?1,?2,?3,?5,?6,?7,?8,?9 WHERE ${branchIsIdle} AND ${ownerSession}
          ON CONFLICT (business_id,branch_id) DO NOTHING`,
        ...scope,
        newId("posstore"),
        identity.timezone,
        context.now,
        identity.user_id,
      ).run();
    }
    const claimed = await storeAuthority(context);
    if (!claimed) {
      conflict(
        "Close existing days, shifts and bills before assigning the register",
        "STORE_BRANCH_BUSY",
      );
    }
    if (!ownsAuthority(claimed, device)) {
      conflict(
        "The branch is assigned to another store register",
        "STORE_REGISTER_REQUIRED",
      );
    }
    return respond(
      {
        epoch: claimed.epoch,
        last_sequence: claimed.last_sequence,
        timezone: claimed.timezone,
      },
      existing ? 200 : 201,
    );
  }
  const input = await bodyOf(request);
  const epoch = recordId(input.epoch, "epoch");
  const sequence = integer(input.last_sequence, "last_sequence", 0);
  if (!existing || existing.epoch !== epoch) return respond({ ok: true });
  if (!ownsAuthority(existing, device)) {
    conflict(
      "The branch is assigned to another store register",
      "STORE_REGISTER_REQUIRED",
    );
  }
  const released = await sql(
    db,
    `DELETE FROM pos_store_authorities WHERE business_id=?1 AND branch_id=?2 AND device_id=?3
      AND (public_key IS NULL OR public_key=?5) AND epoch=?6 AND last_sequence=?7 AND ${branchIsIdle} AND ${ownerSession}
      RETURNING epoch`,
    ...scope,
    epoch,
    sequence,
  ).first();
  if (!released && (await storeAuthority(context))?.epoch === epoch)
    conflict(
      "Close the branch and sync its queued operations before releasing it",
      "STORE_BRANCH_BUSY",
    );
  return respond({ ok: true });
}

export async function recoverStoreOperation(
  context: PosContext,
  request: Request,
  deps: PosDependencies,
  readOnly: boolean,
) {
  if (context.identity.role !== "owner") {
    throw new PosError(
      403,
      "STORE_OWNER_REQUIRED",
      "An owner must approve the recovery on the store register",
    );
  }
  const input = await bodyOf(request, 1_008_000);
  const profileId = recordId(input.profile_id, "profile_id");
  const operator = recordId(input.operator_id, "operator_id");
  const reason = string(input.reason, "reason", 500);
  const operation = object(input.operation);
  const profile = await findProfile(
    context.db,
    context.identity.business_id,
    profileId,
  );
  if (!profile?.is_active || profile.branch_id !== context.profile.branch_id) {
    throw new PosError(
      403,
      "WRONG_REGISTER_SESSION",
      "Choose an active profile in this store register's branch",
    );
  }
  return importOperation(
    {
      ...context,
      profile,
      config: JSON.parse(profile.config_json) as ProfileConfig,
      identity: { ...context.identity, user_id: operator },
    },
    request,
    deps,
    readOnly,
    operation,
    {
      approvedBy: context.identity.user_id,
      approvedAt: context.now,
      reason,
    },
  );
}

export async function listStoreRecoveries(context: PosContext, url: URL) {
  requireManager(context.identity.role);
  return respond(
    await pageOf(
      context.db,
      url,
      "recoveries",
      `SELECT epoch,sequence,profile_id,command_id,operator_id,approved_by,reason,approved_at FROM pos_store_recoveries
    WHERE business_id=? AND branch_id=? ORDER BY approved_at DESC,epoch,sequence`,
      [context.identity.business_id, context.profile.branch_id],
    ),
  );
}

async function savedTenderTypes(
  context: PosContext,
  value: unknown,
): Promise<PaymentType[]> {
  const ids = new Set<string>();
  const types = list(value, "payment_types", 20).flatMap((raw) => {
    const row = object(raw);
    const id = recordId(row.id, "payment type ID");
    if (ids.has(id)) invalid("Use distinct payment types");
    ids.add(id);
    // Legacy offline operations may still have several currencies in their snapshot.
    const currencies = row.currency === undefined
      ? list(row.currencies, "currencies", 2).map(currencyOf)
      : [currencyOf(row.currency)];
    if (!currencies.length || new Set(currencies).size !== currencies.length) {
      invalid("Use distinct currencies for a payment type");
    }
    const type = {
      id,
      name: string(row.name, "payment type name", 120),
      kind: choice(row.kind, "payment kind", [
        "cash",
        "card",
        "qr",
        "other",
      ] as const),

      ...(row.allow_cash_float === undefined
        ? {}
        : { allow_cash_float: boolean(row.allow_cash_float, "allow_cash_float") }),
    };
    return currencies.map((currency) => ({ ...type, currency }));
  });
  const drawerCurrencies = types
    .filter((row) => row.kind === "cash")
    .map((row) => row.currency);
  if (
    !types.length ||

    new Set(drawerCurrencies).size !== drawerCurrencies.length
  ) {
    invalid("Use distinct payment types and one cash drawer per currency");
  }
  const invalidType = await sql(
    context.db,
    `SELECT t.business_id,t.currency
    FROM pos_payment_types t JOIN json_each(?) saved ON t.id=json_extract(saved.value,'$.id')
    WHERE t.business_id<>? OR (t.currency IS NOT NULL AND json_extract(saved.value,'$.currency')<>t.currency)`,
    JSON.stringify(types),
    context.identity.business_id,
  ).first<{ business_id: string; currency: PosCurrency | null }>();
  if (invalidType)
    invalid(invalidType.business_id === context.identity.business_id
      ? `This payment type accepts only ${invalidType.currency}`
      : "Use payment types from this business");
  return types;
}

export async function importStoreOperation(
  context: PosContext,
  request: Request,
  deps: PosDependencies,
  readOnly: boolean,
) {
  return importOperation(
    context,
    request,
    deps,
    readOnly,
    await bodyOf(request, 1_000_000),
  );
}

async function importOperation(
  context: PosContext,
  request: Request,
  deps: PosDependencies,
  readOnly: boolean,
  raw: Record<string, unknown>,
  recovery?: NonNullable<PosContext["storeImport"]>["recovery"],
) {
  if (
    raw.profile_id !== undefined &&
    recordId(raw.profile_id, "profile_id") !== context.profile.id
  ) {
    throw new PosError(
      403,
      "WRONG_REGISTER_SESSION",
      "Use the profile that recorded this operation",
    );
  }
  const kind = choice(raw.kind, "kind", [
    "open_day",
    "close_day",
    "open_shift",
    "close_shift",
    "reopen_shift",
    "cash_movement",
    "checkout",
    "submit_sale",
    "cancel_sale",
    "reversal",
  ] as const);
  const epoch = recordId(raw.epoch, "epoch");
  const sequence = integer(raw.sequence, "sequence", 1);
  const resourceId = recordId(raw.resource_id, "resource_id");
  const timestamp = string(raw.occurred_at, "occurred_at", 32);
  const occurredAt = new Date(timestamp);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?Z$/.test(timestamp) ||
    !Number.isFinite(occurredAt.valueOf()) ||
    occurredAt.valueOf() > Date.now() + 300_000
  ) {
    invalid("Use an occurred_at timestamp from the register clock");
  }
  const body = object(raw.payload);
  const settings = object(raw.settings);
  const exchangeRate = body.exchange_rate == null ? undefined : string(body.exchange_rate, "exchange_rate", 80);
  if (exchangeRate != null && (!Number.isFinite(Number(exchangeRate)) || Number(exchangeRate) <= 0))
    invalid("The stored exchange rate must be positive");
  const authority = await storeAuthority(context);
  if (
    !authority ||
    authority.epoch !== epoch ||
    !ownsAuthority(authority, await currentDevice(context))
  ) {
    conflict(
      "Use the designated store register for this branch",
      "STORE_REGISTER_REQUIRED",
    );
  }
  const imported: PosContext = {
    ...context,
    identity: { ...context.identity, timezone: authority.timezone },
    config: {
      ...context.config,
      working_day_enabled: boolean(
        settings.working_day_enabled,
        "working_day_enabled",
      ),
      cashier_shift_enabled: boolean(
        settings.cashier_shift_enabled,
        "cashier_shift_enabled",
      ),
    },
    now: occurredAt.toISOString(),
    localDate: deps.localDate(occurredAt, authority.timezone),
    storeImport: {
      epoch, sequence, resourceId, recovery,
      baseCurrency: body.base_currency == null ? undefined : currencyOf(body.base_currency),
      exchangeRate,
    },
  };
  const command = await Command.read(request, imported, {
    envelope: raw,
    body,
  });
  if (command instanceof Response) return command;
  if (sequence !== authority.last_sequence + 1) {
    conflict(
      "Upload the preceding store operation first",
      "STORE_SEQUENCE_CHANGED",
    );
  }
  if (recovery) {
    const actor = context.identity.user_id;
    const status = await sql(
      context.db,
      `SELECT ${storeOperatorRegistered} AS registered, ${storeOperatorActive} AS active
      FROM pos_store_authorities authority WHERE authority.epoch=?`,
      context.profile.id,
      actor,
      context.profile.id,
      actor,
      epoch,
    ).first<{ registered: number; active: number }>();
    if (!status?.registered) {
      conflict(
        "The register has no enrollment record for this operator and profile",
        "STORE_OPERATOR_UNKNOWN",
      );
    }
    if (status.active) {
      conflict(
        "The original operator can still synchronize this entry",
        "STORE_OPERATOR_ACTIVE",
      );
    }
  }
  if (readOnly && kind !== "close_day" && kind !== "close_shift" && kind !== "cancel_sale") {
    throw new PosError(
      402,
      "SUBSCRIPTION_EXPIRED",
      "The subscription allows reads and closing existing activity",
    );
  }
  try {
    switch (kind) {
      case "open_day":
        return await writeDay(imported, command);
      case "close_day":
        return await writeDay(imported, command, resourceId);
      case "open_shift":
        imported.storeImport!.shiftPaymentTypes = await savedTenderTypes(
          imported,
          body.payment_types,
        );
        return await writeShift(imported, command);
      case "close_shift":
        return await writeShift(imported, command, resourceId, "close");
      case "reopen_shift":
        return await writeShift(imported, command, resourceId, "reopen");
      case "cash_movement":
        return await writeShift(
          imported,
          command,
          recordId(body.shift_id, "shift_id"),
          "cash-floats",
        );
      case "checkout":
        return await importStoreSale(
          imported,
          command,
          await savedTenderTypes(imported, body.payment_types),
        );
      case "submit_sale":
        return await importStoreSale(imported, command, [], "submitted");
      case "cancel_sale":
        return await saleAction(imported, command, resourceId, "cancel");
      case "reversal":
        return await saleAction(
          imported,
          command,
          recordId(body.original_sale_id, "original_sale_id"),
          "reverse",
        );
    }
  } catch (error) {
    const replay = await command.replay();
    if (replay) return replay;
    throw error;
  }
}
