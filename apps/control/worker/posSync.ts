import type { Env } from "./index";
import { ownsPortionBranches } from "./catalogScope";

type Row = Record<string, unknown>;
export type SyncIdentity = {
  businessId: string;
  currency: string;
  timezone: string;
  catalogVersion: number;
  lastSourceUpdatedAt: string | null;
  lastMenuSnapshotAt: string | null;
  lastMenuWriteAt: string | null;
  subscriptionPlanCode: string | null;
  subscriptionPlanName: string | null;
  subscriptionSource: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEndAt: string | null;
};
type Subscription = { readOnly: boolean };
type Portion = {
  id: string;
  labelKm: string;
  labelEn: string;
  labelZh: string;
  priceCents: number;
  branchId?: string | null;
  priceRule: string;
  unit: string;
};
type Price = {
  priceListId: string;
  targetKey: string;
  priceCents: number | null;
};
type Product = Row & {
  id: string;
  category_id: string;
  portions: Portion[];
  mediaIds: string[];
  priceEntries: Price[];
};

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PRICE = 1e12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORD_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const has = (row: Row, key: string) =>
  Object.prototype.hasOwnProperty.call(row, key);
const response = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store", ...extra },
  });
export { response as posResponse };
class SyncError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_SYNC_DATA",
  ) {
    super(message);
  }
}
function invalid(field: string, message: string): never {
  throw new SyncError(
    `${snakeCase(field)}: ${message.replace(
      /\b(?:syncId|sourceUpdatedAt|nameKm|priceCents|priceEntries)\b/g,
      snakeCase,
    )}`,
  );
}
function object(value: unknown, field: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(field, "must be an object");
  return value as Row;
}
function knownFields(row: Row, fields: string[], field: string) {
  const unknown = Object.keys(row).find((key) => !fields.includes(key));
  if (unknown)
    throw new SyncError(
      `${field}.${unknown}: is not a supported writable field`,
    );
}

function snakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

// Copy only supported wire fields. POS records can include extra metadata.
function syncFields(
  row: Row,
  internalFields: string[],
  wireNames: Record<string, string> = {},
): Row {
  const fields: Row = {};
  for (const key of internalFields) {
    const wireName = wireNames[key] ?? snakeCase(key);
    if (has(row, wireName)) fields[key] = row[wireName];
  }
  return fields;
}
function text(
  value: unknown,
  field: string,
  max: number,
  nullable = false,
): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string") invalid(field, "must be a string");
  const result = value.trim();
  if (result.length > max) invalid(field, `must be at most ${max} characters`);
  return result;
}
function number(value: unknown, field: string, max = MAX_PRICE, min = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    invalid(field, `must be a number between ${min} and ${max}`);
  return value;
}
function integer(value: unknown, field: string, max = 999_999): number {
  const result = number(value, field, max);
  if (!Number.isInteger(result)) invalid(field, "must be a whole number");
  return result;
}
function sortOrder(value: unknown): number {
  if (typeof value !== "number") return 999_999;
  if (value < 0) return 0;
  return Number.isInteger(value) && value <= 999_999 ? value : 999_999;
}
function flag(value: unknown, field: string): number {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  return invalid(field, "must be true, false, 1 or 0");
}
function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value))
    invalid(field, "must be a hyphenated UUID");
  return value.toLowerCase();
}
function reference(value: unknown, field: string): string {
  if (typeof value !== "string" || !RECORD_ID.test(value))
    invalid(field, "must be a record ID");
  return UUID.test(value) ? value.toLowerCase() : value;
}
function timestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid(field, "must be an ISO 8601 timestamp with a timezone");
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth)
    invalid(field, "contains an invalid calendar date");
  return new Date(value).toISOString();
}
function imageUrl(value: unknown, field: string): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") invalid(field, "must be a string");
  const result = value.trim();
  return result.length > 2048 ? null : result || null;
}
function array(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    invalid(field, `must be an array with at most ${max} entries`);
  return value;
}
function unique(values: string[], field: string) {
  if (new Set(values).size !== values.length)
    invalid(field, "contains duplicate IDs");
}
async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function readBody(request: Request, limit = MAX_BYTES): Promise<string> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new SyncError(
      "Content-Type must be application/json",
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  if (Number(request.headers.get("content-length")) > limit)
    throw new SyncError("Sync request is too large", 413, "SYNC_TOO_LARGE");
  if (!request.body) invalid("body", "is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let size = 0;
  let result = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new SyncError("Sync request is too large", 413, "SYNC_TOO_LARGE");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError("Request body must contain valid UTF-8 JSON");
  } finally {
    reader.releaseLock();
  }
}
function parseJson(raw: string): Row {
  try {
    return object(JSON.parse(raw), "body");
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError("Request body must contain valid JSON");
  }
}
export async function readPosJson(
  request: Request,
  limit: number,
): Promise<Row> {
  return parseJson(await readBody(request, limit));
}
function handled(error: unknown): Response | null {
  return error instanceof SyncError
    ? response({ error: error.message, code: error.code }, error.status)
    : null;
}

export async function getPosIntegration(env: Env, businessId: string) {
  return env.DB.prepare(
    `SELECT name,key_prefix AS keyPrefix,last_synced_at AS lastSyncedAt,
     last_source_updated_at AS lastSourceUpdatedAt,created_at AS createdAt
     FROM pos_integrations WHERE business_id=?`,
  )
    .bind(businessId)
    .first();
}

export async function issuePosApiKey(
  env: Env,
  businessId: string,
  name: string,
  audit?: D1PreparedStatement,
) {
  const apiKey = `pos_${[...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
  const write = env.DB.prepare(
    `INSERT INTO pos_integrations (business_id,name,token_hash,key_prefix)
     VALUES (?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET
     name=excluded.name,token_hash=excluded.token_hash,key_prefix=excluded.key_prefix,
     catalog_version=pos_integrations.catalog_version+1,updated_at=CURRENT_TIMESTAMP`,
  ).bind(businessId, name, await hash(apiKey), apiKey.slice(0, 12));
  await env.DB.batch(audit ? [write, audit] : [write]);
  return {
    message: "POS API key created. Store it securely; it is shown only once.",
    apiKey,
  };
}

export async function revokePosIntegration(
  env: Env,
  businessId: string,
  audit?: D1PreparedStatement,
) {
  const write = env.DB.prepare(
    "DELETE FROM pos_integrations WHERE business_id=?",
  ).bind(businessId);
  await env.DB.batch(audit ? [write, audit] : [write]);
  return { message: "POS integration disconnected." };
}

export async function handlePosIntegration(
  request: Request,
  env: Env,
  auth: { businessId: string; role: string },
): Promise<Response> {
  try {
    if (auth.role !== "owner")
      return response({ error: "Owner access is required" }, 403);
    if (request.method === "GET") {
      const integration = await getPosIntegration(env, auth.businessId);
      return response({ integration });
    }
    if (request.method === "PUT") {
      const body = parseJson(await readBody(request, 4096));
      knownFields(body, ["name"], "body");
      const name = has(body, "name") ? text(body.name, "name", 120)! : "POS";
      if (!name) invalid("name", "cannot be empty");
      return response(await issuePosApiKey(env, auth.businessId, name));
    }
    if (request.method === "DELETE") {
      return response(await revokePosIntegration(env, auth.businessId));
    }
    return response({ error: "Method not allowed" }, 405, {
      allow: "GET, PUT, DELETE",
    });
  } catch (error) {
    const result = handled(error);
    if (result) return result;
    throw error;
  }
}

function localized(row: Row, existing: Row, field: string): Row {
  const result: Row = {};
  for (const [api, column] of [
    ["name", "name"],
    ["nameKm", "name_km"],
    ["nameEn", "name_en"],
    ["nameZh", "name_zh"],
  ]) {
    result[column] = has(row, api)
      ? text(row[api], `${field}.${api}`, 300, api !== "name")
      : (existing[column] ?? null);
  }
  if (!result.name)
    result.name = result.name_km || result.name_en || result.name_zh;
  if (!result.name)
    invalid(
      field,
      "a new record needs name or nameKm (or another translated name)",
    );
  // The public menu and management UI use Khmer as their primary label.
  if (!result.name_km) result.name_km = result.name;
  return result;
}
function slug(
  row: Row,
  existing: Row,
  names: Row,
  id: string,
  field: string,
): string {
  if (has(row, "slug")) {
    const value = text(row.slug, `${field}.slug`, 200, true);
    if (value) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
        invalid(
          `${field}.slug`,
          "must contain lowercase letters, digits and single hyphens",
        );
      return value;
    }
  }
  if (existing.slug) return String(existing.slug);
  const prefix = String(names.name_en || names.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return `${prefix || "pos"}-${id}`;
}
function nullableNumber(
  row: Row,
  existing: Row,
  api: string,
  column: string,
  field: string,
  max: number,
  whole = false,
) {
  if (!has(row, api)) return existing[column] ?? null;
  return row[api] === null
    ? null
    : whole
      ? integer(row[api], `${field}.${api}`, max)
      : number(row[api], `${field}.${api}`, max);
}
function label(row: Row, field: string): Row {
  const result = {
    labelKm: text(row.labelKm, `${field}.labelKm`, 120),
    labelEn: has(row, "labelEn")
      ? text(row.labelEn, `${field}.labelEn`, 120)
      : "",
    labelZh: has(row, "labelZh")
      ? text(row.labelZh, `${field}.labelZh`, 120)
      : "",
  };
  if (!result.labelKm) invalid(`${field}.labelKm`, "is required");
  return result;
}
function optionId(row: Row, field: string): string {
  if (!has(row, "id")) return crypto.randomUUID();
  const value = reference(row.id, `${field}.id`);
  if (value === "base")
    invalid(`${field}.id`, "base is reserved for the base price");
  return value;
}
function portions(value: unknown, field: string): Portion[] {
  const result = array(value, field, 20).map((entry, index) => {
    const path = `${field}[${index}]`;
    const row = syncFields(
      object(entry, path),
      [
        "id",
        "labelKm",
        "labelEn",
        "labelZh",
        "priceCents",
        "branchId",
        "priceRule",
        "unit",
      ],
      { priceCents: "price" },
    );
    return {
      id: optionId(row, path),
      ...label(row, path),
      priceCents: number(row.priceCents, `${path}.price`),
      ...(has(row, "branchId") && {
        branchId: row.branchId === null ? null : reference(row.branchId, `${path}.branchId`),
      }),
      priceRule: has(row, "priceRule")
        ? text(row.priceRule, `${path}.price_rule`, 120)
        : "",
      unit: has(row, "unit") ? text(row.unit, `${path}.unit`, 40) : "",
    } as Portion;
  });
  unique(
    result.map((row) => row.id),
    field,
  );
  return result;
}
function modifiers(value: unknown, field: string): Row[] {
  const result = array(value, field, 12).map((entry, index) => {
    const path = `${field}[${index}]`;
    const row = syncFields(
      object(entry, path),
      [
        "id",
        "labelKm",
        "labelEn",
        "labelZh",
        "required",
        "multiple",
        "options",
      ],
    );
    const options = array(row.options, `${path}.options`, 30).map(
      (entry, index) => {
        const optionPath = `${path}.options[${index}]`;
        const option = syncFields(
          object(entry, optionPath),
          ["id", "labelKm", "labelEn", "labelZh", "priceCents", "prefix"],
          { priceCents: "price" },
        );
        return {
          id: optionId(option, optionPath),
          ...label(option, optionPath),
          priceCents:
            option.priceCents == null
              ? null
              : number(
                  option.priceCents,
                  `${optionPath}.price`,
                  MAX_PRICE,
                  -MAX_PRICE,
                ),
          prefix: has(option, "prefix")
            ? text(option.prefix, `${optionPath}.prefix`, 40)
            : "",
        };
      },
    );
    if (!options.length)
      invalid(`${path}.options`, "must contain at least one option");
    unique(
      options.map((option) => option.id),
      `${path}.options`,
    );
    return {
      id: optionId(row, path),
      ...label(row, path),
      required: has(row, "required")
        ? Boolean(flag(row.required, `${path}.required`))
        : false,
      multiple: has(row, "multiple")
        ? Boolean(flag(row.multiple, `${path}.multiple`))
        : false,
      options,
    };
  });
  unique(
    result.map((row) => String(row.id)),
    field,
  );
  return result;
}

function photo(
  row: Row,
  existing: Row,
  api: string,
  column: string,
  field: string,
  media: Map<string, Row>,
  env: Env,
): { image_url: string | null; mediaId: string | null } {
  if (has(row, api) && row[api] !== null && row[api] !== "") {
    const mediaId = reference(row[api], `${field}.${api}`);
    const owned = media.get(mediaId);
    if (!owned)
      invalid(`${field}.${api}`, "must reference media owned by this business");
    const base = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "");
    return {
      mediaId,
      image_url: base
        ? `${base}/${String(owned.object_key).split("/").map(encodeURIComponent).join("/")}`
        : `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`,
    };
  }
  if (has(row, "imageUrl"))
    return {
      image_url: imageUrl(row.imageUrl, `${field}.imageUrl`),
      mediaId: null,
    };
  if (has(row, api)) return { image_url: null, mediaId: null };
  return {
    image_url: existing.image_url == null ? null : String(existing.image_url),
    mediaId: existing[column] == null ? null : String(existing[column]),
  };
}

const CATEGORY_FIELDS = [
  "id",
  "parentId",
  "name",
  "nameKm",
  "nameEn",
  "nameZh",
  "slug",
  "imageUrl",
  "imageMediaId",
  "sortOrder",
  "isActive",
  "createdAt",
];
const PRODUCT_FIELDS = [
  "id",
  "category_id",
  "code",
  "name",
  "nameKm",
  "nameEn",
  "nameZh",
  "slug",
  "description",
  "priceCents",
  "maxPrice",
  "unit",
  "portions",
  "modifierGroups",
  "imageUrl",
  "primaryMediaId",
  "mediaIds",
  "calories",
  "prepMinutes",
  "rating",
  "isFeatured",
  "isAvailable",
  "sortOrder",
  "createdAt",
  "priceEntries",
];

function categoriesForSync(
  input: Row[],
  existing: Map<string, Row>,
  media: Map<string, Row>,
  env: Env,
): Row[] {
  return input.map((inputRow, index) => {
    const field = `categories[${index}]`;
    const row = syncFields(inputRow, CATEGORY_FIELDS);
    const id = uuid(row.id, `${field}.id`);
    const old = existing.get(id) || {};
    const names = localized(row, old, field);
    if (has(row, "imageUrl") && row.imageMediaId)
      invalid(field, "send image_url or image_media_id, not both");
    const image = photo(
      row,
      old,
      "imageMediaId",
      "image_media_id",
      field,
      media,
      env,
    );
    return {
      id,
      ...names,
      slug: slug(row, old, names, id, field),
      parent_id: has(row, "parentId")
        ? row.parentId === null
          ? null
          : reference(row.parentId, `${field}.parentId`)
        : (old.parent_id ?? null),
      image_url: image.image_url,
      image_media_id: image.mediaId,
      sort_order: has(row, "sortOrder")
        ? sortOrder(row.sortOrder)
        : (old.sort_order ?? 0),
      is_active: has(row, "isActive")
        ? flag(row.isActive, `${field}.isActive`)
        : (old.is_active ?? 1),
      created_at: has(row, "createdAt")
        ? timestamp(row.createdAt, `${field}.createdAt`)
        : (old.created_at ?? null),
    };
  });
}

function productsForSync(
  input: Row[],
  existing: Map<string, Row>,
  gallery: Map<string, string[]>,
  media: Map<string, Row>,
  priceLists: Set<string>,
  normalId: string,
  env: Env,
  sourceTimestamp: string | null,
): Product[] {
  return input.map((inputRow, index) => {
    const field = `products[${index}]`;
    const row = syncFields(inputRow, PRODUCT_FIELDS, {
      priceCents: "price",
    });
    const id = uuid(row.id, `${field}.id`);
    const old = existing.get(id) || {};
    const names = localized(row, old, field);
    const productPortions = has(row, "portions")
      ? portions(row.portions, `${field}.portions`)
      : (JSON.parse(String(old.portions_json || "[]")) as Portion[]);
    const productModifiers = has(row, "modifierGroups")
      ? modifiers(row.modifierGroups, `${field}.modifierGroups`)
      : JSON.parse(String(old.modifier_groups_json || "[]"));
    const portionsJson = JSON.stringify(productPortions);
    const modifiersJson = JSON.stringify(productModifiers);
    if (portionsJson.length + modifiersJson.length > 64_000)
      invalid(field, "product options exceed 64,000 characters");
    if (
      !productPortions.length &&
      !has(row, "priceCents") &&
      !has(old, "price_cents")
    )
      invalid(
        `${field}.price`,
        "is required for a new product without portions",
      );
    const base = has(row, "priceCents")
      ? number(row.priceCents, `${field}.price`)
      : Number(old.price_cents || 0);
    const minPrice = productPortions.length
      ? Math.min(...productPortions.map((portion) => portion.priceCents))
      : base;
    const maxPrice = productPortions.length
      ? Math.max(...productPortions.map((portion) => portion.priceCents))
      : base;
    if (
      has(row, "maxPrice") &&
      number(row.maxPrice, `${field}.maxPrice`) !== maxPrice
    )
      invalid(
        `${field}.maxPrice`,
        "must match the maximum portion price, or price when there are no portions",
      );
    const validTargets = new Set(
      productPortions.length
        ? productPortions.map((portion) => portion.id)
        : ["base"],
    );
    const entries = has(row, "priceEntries")
      ? array(row.priceEntries, `${field}.priceEntries`, 200).map(
          (entry, index) => {
            const path = `${field}.priceEntries[${index}]`;
            const price = syncFields(
              object(entry, path),
              ["priceListId", "targetKey", "priceCents"],
            );
            const priceListId = reference(
              price.priceListId,
              `${path}.priceListId`,
            );
            const targetKey = reference(price.targetKey, `${path}.targetKey`);
            if (!priceLists.has(priceListId))
              invalid(
                `${path}.priceListId`,
                "price list is not owned by this business or is archived",
              );
            if (!validTargets.has(targetKey))
              invalid(
                `${path}.targetKey`,
                "must be base or an existing portion ID",
              );
            if (priceListId === normalId)
              invalid(
                `${path}.priceListId`,
                "Normal Rate is set through price or portions, not priceEntries",
              );
            return {
              priceListId,
              targetKey,
              priceCents:
                price.priceCents === null
                  ? null
                  : number(price.priceCents, `${path}.priceCents`),
            };
          },
        )
      : [];
    unique(
      entries.map((entry) => `${entry.priceListId}:${entry.targetKey}`),
      `${field}.priceEntries`,
    );
    let mediaIds = has(row, "mediaIds")
      ? array(row.mediaIds, `${field}.mediaIds`, 5).map((value) =>
          reference(value, `${field}.mediaIds`),
        )
      : [...(gallery.get(id) || [])];
    unique(mediaIds, `${field}.mediaIds`);
    let imageRow = row;
    if (
      has(row, "mediaIds") &&
      !has(row, "primaryMediaId") &&
      !has(row, "imageUrl")
    ) {
      imageRow = {
        ...row,
        primaryMediaId: mediaIds.includes(String(old.primary_media_id))
          ? old.primary_media_id
          : mediaIds[0] || null,
      };
    }
    const image = photo(
      imageRow,
      old,
      "primaryMediaId",
      "primary_media_id",
      field,
      media,
      env,
    );
    if (image.mediaId && !mediaIds.includes(image.mediaId))
      mediaIds.unshift(image.mediaId);
    if (has(row, "imageUrl") && !image.mediaId && !has(row, "mediaIds"))
      mediaIds = [];
    if (mediaIds.length > 5 || mediaIds.some((mediaId) => !media.has(mediaId)))
      invalid(
        `${field}.mediaIds`,
        "must contain at most 5 media IDs owned by this business",
      );
    if (has(row, "imageUrl") && image.mediaId)
      invalid(field, "send image_url or primary_media_id, not both");
    const code = has(row, "code")
      ? text(row.code, `${field}.code`, 64, true) || null
      : (old.code ?? null);
    return {
      id,
      ...names,
      category_id: has(row, "category_id")
        ? reference(row.category_id, `${field}.category_id`)
        : reference(old.category_id, `${field}.category_id`),
      code,
      slug: slug(row, old, names, id, field),
      description: has(row, "description")
        ? text(row.description, `${field}.description`, 20_000)
        : (old.description ?? ""),
      price_cents: minPrice,
      max_price: maxPrice,
      unit: has(row, "unit")
        ? text(row.unit, `${field}.unit`, 40)
        : (old.unit ?? ""),
      portions_json: portionsJson,
      modifier_groups_json: modifiersJson,
      image_url: image.image_url,
      primary_media_id: image.mediaId,
      calories: nullableNumber(
        row,
        old,
        "calories",
        "calories",
        field,
        1_000_000,
        true,
      ),
      prep_minutes: nullableNumber(
        row,
        old,
        "prepMinutes",
        "prep_minutes",
        field,
        999_999,
        true,
      ),
      rating: nullableNumber(row, old, "rating", "rating", field, 5),
      is_featured: has(row, "isFeatured")
        ? flag(row.isFeatured, `${field}.isFeatured`)
        : (old.is_featured ?? 0),
      is_available: has(row, "isAvailable")
        ? flag(row.isAvailable, `${field}.isAvailable`)
        : (old.is_available ?? 1),
      sort_order: has(row, "sortOrder")
        ? sortOrder(row.sortOrder)
        : (old.sort_order ?? 0),
      created_at: has(row, "createdAt")
        ? timestamp(row.createdAt, `${field}.createdAt`)
        : (old.created_at ?? null),
      pos_source_updated_at:
        sourceTimestamp ?? old.pos_source_updated_at ?? null,
      portions: productPortions,
      mediaIds,
      priceEntries: entries,
    };
  });
}

function validateGraph(
  categories: Row[],
  existing: Row[],
  products: Product[],
  kind = "category",
): Row[] {
  const parentField = kind === "menu" ? "menus.parentId" : "categories.parentId";
  const parents = new Map(
    existing.map((row) => [
      String(row.id),
      row.parent_id ? String(row.parent_id) : null,
    ]),
  );
  for (const row of categories)
    parents.set(String(row.id), row.parent_id ? String(row.parent_id) : null);
  const depths = new Map<string, number>();
  for (const category of categories) {
    const path = new Set<string>();
    let current: string | null = String(category.id);
    while (current) {
      if (!parents.has(current))
        invalid(
          parentField,
          `parent ${kind} is not owned by this business or included in this sync`,
        );
      if (path.has(current))
        invalid(parentField, `${kind} hierarchy contains a cycle`);
      path.add(current);
      if (path.size > 32)
        invalid(parentField, `${kind} hierarchy exceeds 32 levels`);
      current = parents.get(current) ?? null;
    }
    depths.set(String(category.id), path.size);
  }
  for (const product of products)
    if (!parents.has(product.category_id))
      invalid(
        `products.${product.id}.category_id`,
        "category is not owned by this business or included in this sync",
      );
  return [...categories].sort(
    (a, b) => depths.get(String(a.id))! - depths.get(String(b.id))!,
  );
}
function validateUnique(
  rows: Row[],
  existing: Row[],
  column: string,
  caseInsensitive = false,
) {
  const incoming = new Set(rows.map((row) => String(row.id)));
  const values = new Map<string, string>();
  for (const row of [
    ...existing.filter((row) => !incoming.has(String(row.id))),
    ...rows,
  ]) {
    if (row[column] == null || row[column] === "") continue;
    const value = caseInsensitive
      ? String(row[column]).toLowerCase()
      : String(row[column]);
    if (values.has(value))
      throw new SyncError(
        `Duplicate ${column} in this business: ${value}`,
        409,
        "CATALOG_VALUE_CONFLICT",
      );
    values.set(value, String(row.id));
  }
}
function rowChunks(rows: Row[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let bytes = 2;
  const encoder = new TextEncoder();
  for (const row of rows) {
    const json = JSON.stringify(row);
    const length = encoder.encode(json).byteLength + 1;
    if (
      current.length &&
      (current.length === 50 || bytes + length > 128 * 1024)
    ) {
      chunks.push(`[${current.join(",")}]`);
      current = [];
      bytes = 2;
    }
    current.push(json);
    bytes += length;
  }
  if (current.length) chunks.push(`[${current.join(",")}]`);
  return chunks;
}
function upsertRows(
  env: Env,
  table: string,
  rows: Row[],
  businessId: string,
  columns: string[],
) {
  const storedRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column]])),
  );
  return rowChunks(storedRows).map((chunk) =>
    env.DB.prepare(
      `INSERT INTO ${table} (business_id,${columns.join(",")})
     SELECT ?,${columns
       .map((column) =>
         column === "created_at"
           ? "COALESCE(json_extract(value,'$.created_at'),CURRENT_TIMESTAMP)"
           : `json_extract(value,'$.${column}')`,
       )
       .join(",")}
     FROM json_each(?) WHERE 1
     ON CONFLICT(id) DO UPDATE SET business_id=excluded.business_id,
     ${columns
       .filter(
         (column) => !["id", "created_at", "public_token"].includes(column),
       )
       .map((column) => `${column}=excluded.${column}`)
       .join(",")}
     ${table === "categories" || table === "menus" ? "" : ",updated_at=CURRENT_TIMESTAMP"}`,
    ).bind(businessId, chunk),
  );
}

async function syncReceipt(
  env: Env,
  businessId: string,
  syncId: string,
): Promise<{ payload_hash: string; skipped_tables_json: string | null } | null> {
  return env.DB.prepare(
    "SELECT payload_hash, skipped_tables_json FROM pos_sync_requests WHERE business_id=? AND sync_id=?",
  )
    .bind(businessId, syncId)
    .first<{ payload_hash: string; skipped_tables_json: string | null }>();
}

function checkReceipt(
  previous: string | undefined,
  payloadHash: string,
): boolean {
  if (previous === undefined) return false;
  if (previous !== payloadHash)
    throw new SyncError(
      "sync_id was already used for a different request body",
      409,
      "SYNC_ID_REUSED",
    );
  return true;
}

type SkippedTable = { id: string; code: string };

function readSkippedTables(value: string | null): SkippedTable[] {
  return value === null ? [] : JSON.parse(value);
}

function tableSyncSuccess(skipped: SkippedTable[]) {
  return response({
    message: "POS tables synced successfully.",
    ...(skipped.length > 0 && {
      warnings: skipped.map(({ id, code }) => ({
        code: "DUPLICATE_TABLE_CODE",
        table_id: id,
        table_code: code,
        message: `Table number ${code} is already used in this branch and could not be synced.`,
      })),
    }),
  });
}

async function commitTableSync(
  env: Env,
  identity: SyncIdentity,
  syncId: string,
  payloadHash: string,
  changes: D1PreparedStatement[],
  skipped: SkippedTable[] = [],
): Promise<SkippedTable[]> {
  const { businessId } = identity;
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO pos_sync_requests (business_id,sync_id,payload_hash,source_updated_at,base_version,is_table_sync,skipped_tables_json) VALUES (?,?,?,?,?,1,?)",
      ).bind(
        businessId,
        syncId,
        payloadHash,
        new Date().toISOString(),
        identity.catalogVersion,
        skipped.length ? JSON.stringify(skipped) : null,
      ),
      ...changes,
      env.DB.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1,last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE business_id=?",
      ).bind(businessId),
    ]);
  } catch (error) {
    const receipt = await syncReceipt(env, businessId, syncId);
    if (receipt && checkReceipt(receipt.payload_hash, payloadHash))
      return readSkippedTables(receipt.skipped_tables_json);
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed: restaurant_tables\.business_id/.test(message))
      throw new SyncError(
        "Table codes changed during sync. Retry with the latest data.",
        409,
        "SYNC_CONFLICT",
      );
    if (/UNIQUE constraint/.test(message))
      throw new SyncError(
        "A table group name or table code already exists in this business",
        409,
        "TABLE_VALUE_CONFLICT",
      );
    if (
      /POS_SYNC_CONFLICT|CATALOG_TENANT_CONFLICT|FOREIGN KEY constraint/.test(
        message,
      )
    )
      throw new SyncError(
        "The tables or POS connection changed during sync. Retry with the latest data.",
        409,
        "SYNC_CONFLICT",
      );
    throw error;
  }
  return skipped;
}

function tableArchiveWrites(env: Env, businessId: string, input: unknown) {
  const archive = syncFields(
    object(input, "archive"),
    ["tableId", "tableGroupId"],
  );
  const group = has(archive, "tableGroupId");
  if (group === has(archive, "tableId"))
    invalid("archive", "include exactly one table_id or table_group_id");
  if (!group) {
    const id = reference(archive.tableId, "archive.table_id");
    return [
      env.DB.prepare(
        "UPDATE restaurant_tables SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE business_id=? AND id=? AND is_active=1",
      ).bind(businessId, id),
    ];
  }
  const id = reference(archive.tableGroupId, "archive.table_group_id");
  return [
    env.DB.prepare(
      `UPDATE restaurant_tables SET is_active=0,updated_at=CURRENT_TIMESTAMP
       WHERE business_id=? AND is_active=1
       AND group_id=(SELECT id FROM table_groups WHERE id=? AND business_id=?)`,
    ).bind(businessId, id, businessId),
    env.DB.prepare(
      "UPDATE table_groups SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE business_id=? AND id=? AND is_active=1",
    ).bind(businessId, id),
  ];
}

function duplicateTableIds(
  requested: (Row & { id: string })[],
  existing: Map<string, Row>,
): Set<string> {
  // Match the branch-scoped SQLite NOCASE index, which folds ASCII letters.
  const codeKey = (table: Row) =>
    JSON.stringify([
      table.branch_id,
      String(table.code).replace(/[A-Z]/g, (letter) => letter.toLowerCase()),
    ]);
  const owners = new Map(
    [...existing].map(([id, table]) => [codeKey(table), id]),
  );
  const claimed = new Map<string, string>();
  const skipped = new Set<string>();
  for (const table of requested) {
    const key = codeKey(table);
    const first = claimed.get(key);
    if (first && owners.get(key) !== table.id) {
      skipped.add(table.id);
    } else {
      if (first) skipped.add(first);
      claimed.set(key, table.id);
    }
  }

  const selected = new Set(claimed.values());
  const retained = [...existing].filter(([id]) => !selected.has(id));
  // A skipped update keeps its old code, which can block another requested move.
  for (let i = 0; i < retained.length; i++) {
    const [ownerId, table] = retained[i];
    const claimant = claimed.get(codeKey(table));
    if (!claimant || claimant === ownerId || skipped.has(claimant)) continue;
    skipped.add(claimant);
    const old = existing.get(claimant);
    if (old) retained.push([claimant, old]);
  }
  return skipped;
}

async function syncTables(
  env: Env,
  identity: SyncIdentity,
  raw: string,
): Promise<Response> {
  const { businessId } = identity;
  const body = syncFields(
    parseJson(raw),
    ["syncId", "tableGroups", "tables", "archive"],
  );
  const syncId = has(body, "syncId")
    ? uuid(body.syncId, "sync_id")
    : crypto.randomUUID();
  const payloadHash = await hash(raw);
  const receipt = await syncReceipt(env, businessId, syncId);
  if (receipt && checkReceipt(receipt.payload_hash, payloadHash))
    return tableSyncSuccess(readSkippedTables(receipt.skipped_tables_json));

  if (has(body, "archive")) {
    if (has(body, "tableGroups") || has(body, "tables"))
      invalid(
        "body",
        "send archive in a separate request from table_groups and tables",
      );
    const skipped = await commitTableSync(
      env,
      identity,
      syncId,
      payloadHash,
      tableArchiveWrites(env, businessId, body.archive),
    );
    return tableSyncSuccess(skipped);
  }
  const groupRows = array(body.tableGroups, "table_groups", 500).map(
    (entry, i) =>
      syncFields(
        object(entry, `table_groups[${i}]`),
        ["id", "name", "sortOrder", "isActive", "branchId"],
      ),
  );
  const tableRows = array(body.tables, "tables", 1000).map((entry, i) =>
    syncFields(
      object(entry, `tables[${i}]`),
      ["id", "groupId", "code", "label", "sortOrder", "isActive"],
    ),
  );
  if (!groupRows.length && !tableRows.length)
    invalid("body", "include at least one table group or table");
  const groupIds = groupRows.map((row, i) =>
    reference(row.id, `table_groups[${i}].id`),
  );
  const tableIds = tableRows.map((row, i) =>
    reference(row.id, `tables[${i}].id`),
  );
  unique(groupIds, "table_groups");
  unique(tableIds, "tables");
  const [groupsResult, tablesResult, branchesResult] = await env.DB.batch<Row>([
    env.DB.prepare(
      "SELECT * FROM table_groups WHERE business_id=? OR id IN (SELECT value FROM json_each(?))",
    ).bind(businessId, JSON.stringify(groupIds)),
    env.DB.prepare(
      "SELECT * FROM restaurant_tables WHERE business_id=? OR id IN (SELECT value FROM json_each(?))",
    ).bind(businessId, JSON.stringify(tableIds)),
    env.DB.prepare("SELECT id,is_default,is_active FROM branches WHERE business_id=?").bind(businessId),
  ]);
  const existingGroups = groupsResult.results;
  const existingTables = tablesResult.results;
  if (
    [...existingGroups, ...existingTables].some(
      (row) => row.business_id !== businessId,
    )
  )
    throw new SyncError(
      "A supplied ID already belongs to another business",
      409,
      "TABLE_ID_CONFLICT",
    );

  const groupsById = new Map(
    existingGroups.map((row) => [String(row.id), row]),
  );
  const tablesById = new Map(
    existingTables.map((row) => [String(row.id), row]),
  );
  const defaultBranchId = branchesResult.results.find((row) => row.is_default === 1)?.id;
  const groups = groupRows.map((row, i) => {
    const field = `table_groups[${i}]`;
    const id = groupIds[i];
    const old = groupsById.get(id);
    if (!old) uuid(id, `${field}.id`);
    const name = has(row, "name")
      ? text(row.name, `${field}.name`, 80)
      : old?.name;
    if (!name) invalid(`${field}.name`, "is required");
    const branchId = has(row,"branchId") ? reference(row.branchId,`${field}.branchId`) : old?.branch_id ?? defaultBranchId;
    if (old ? branchId !== old.branch_id : !branchesResult.results.some((branch) => branch.id === branchId && branch.is_active === 1))
      invalid(`${field}.branchId`, "must use the existing group's branch or an active branch of this business");
    const group = {
      id,
      name,
      branch_id: branchId,
      sort_order: has(row, "sortOrder")
        ? sortOrder(row.sortOrder)
        : (old?.sort_order ?? 0),
      is_active: has(row, "isActive")
        ? flag(row.isActive, `${field}.isActive`)
        : (old?.is_active ?? 1),
    };
    groupsById.set(id, group);
    return group;
  });
  const requestedTables = tableRows.map((row, i) => {
    const field = `tables[${i}]`;
    const id = tableIds[i];
    const old = tablesById.get(id);
    if (!old) uuid(id, `${field}.id`);
    const groupId = has(row, "groupId")
      ? reference(row.groupId, `${field}.groupId`)
      : old?.group_id;
    if (typeof groupId !== "string" || !groupsById.has(groupId))
      invalid(
        `${field}.groupId`,
        "must reference a table group owned by this business or included in this sync",
      );
    const code = has(row, "code")
      ? text(row.code, `${field}.code`, 30)
      : old?.code;
    if (!code) invalid(`${field}.code`, "is required");
    const label = has(row, "label")
      ? text(row.label, `${field}.label`, 80)
      : (old?.label ?? code);
    if (!label) invalid(`${field}.label`, "must not be empty");
    const isActive = has(row, "isActive")
      ? flag(row.isActive, `${field}.isActive`)
      : (old?.is_active ?? 1);
    if (isActive === 1 && groupsById.get(groupId)?.is_active !== 1)
      invalid(`${field}.groupId`, "an active table requires an active group");
    const branchId = groupsById.get(groupId)?.branch_id;
    if (old && old.branch_id !== branchId)
      invalid(`${field}.groupId`, "must be in the table's branch");
    const table = {
      id,
      group_id: groupId,
      branch_id: branchId,
      code,
      label,
      public_token:
        old?.public_token ?? `scan_${crypto.randomUUID().replaceAll("-", "")}`,
      sort_order: has(row, "sortOrder")
        ? sortOrder(row.sortOrder)
        : (old?.sort_order ?? 0),
      is_active: isActive,
    };
    return table;
  });
  const duplicateIds = duplicateTableIds(requestedTables, tablesById);
  const skipped: SkippedTable[] = [];
  const tables = requestedTables.filter((table) => {
    if (duplicateIds.has(table.id)) {
      skipped.push({ id: table.id, code: String(table.code) });
      return false;
    }
    tablesById.set(table.id, table);
    return true;
  });
  const activeGroups = new Set(
    [...tablesById.values()]
      .filter((row) => row.is_active === 1)
      .map((row) => row.group_id),
  );
  if (
    groups.some((group) => group.is_active === 0 && activeGroups.has(group.id))
  )
    throw new SyncError(
      "Move or archive active tables before archiving their group",
      409,
      "TABLE_GROUP_IN_USE",
    );

  const placeholder = `pos-${crypto.randomUUID()}-`;
  const savedSkipped = await commitTableSync(env, identity, syncId, payloadHash, [
    // Allow a batch to swap two names or codes without a temporary unique conflict.
    env.DB.prepare(
      "UPDATE table_groups SET name=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))",
    ).bind(placeholder, businessId, JSON.stringify(groupIds)),
    env.DB.prepare(
      "UPDATE restaurant_tables SET code=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))",
    ).bind(placeholder, businessId, JSON.stringify(tables.map((table) => table.id))),
    ...upsertRows(env, "table_groups", groups, businessId, [
      "id",
      "branch_id",
      "name",
      "sort_order",
      "is_active",
    ]),
    ...upsertRows(env, "restaurant_tables", tables, businessId, [
      "id",
      "branch_id",
      "group_id",
      "code",
      "label",
      "public_token",
      "sort_order",
      "is_active",
    ]),
  ], skipped);
  return tableSyncSuccess(savedSkipped);
}

export async function withPosIdentity(
  request: Request,
  env: Env,
  run: (identity: SyncIdentity, tokenHash: string) => Promise<Response>,
): Promise<Response> {
  try {
    const apiKey = request.headers
      .get("authorization")
      ?.match(/^Bearer (pos_[0-9a-f]{64})$/)?.[1];
    if (!apiKey)
      return response(
        { error: "A POS API key is required", code: "INVALID_POS_KEY" },
        401,
      );
    const tokenHash = await hash(apiKey);
    const identity = await env.DB.prepare(
      `SELECT i.business_id AS businessId,i.catalog_version AS catalogVersion,
       i.last_source_updated_at AS lastSourceUpdatedAt,i.last_menu_snapshot_at AS lastMenuSnapshotAt,
       i.last_menu_write_at AS lastMenuWriteAt,b.currency,b.timezone,
       sp.code AS subscriptionPlanCode,sp.name AS subscriptionPlanName,
       bs.source AS subscriptionSource,bs.status AS subscriptionStatus,
       bs.trial_ends_at AS trialEndsAt,bs.current_period_end_at AS currentPeriodEndAt
       FROM pos_integrations i JOIN businesses b ON b.id=i.business_id
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
       LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
       WHERE i.token_hash=? AND b.is_active=1`,
    )
      .bind(tokenHash)
      .first<SyncIdentity>();
    if (!identity)
      return response(
        {
          error: "POS API key is invalid or disconnected",
          code: "INVALID_POS_KEY",
        },
        401,
      );
    return await run(identity, tokenHash);
  } catch (error) {
    const result = handled(error);
    if (result) return result;
    throw error;
  }
}

async function menuSnapshotWrites(env: Env, businessId: string, menuInput: unknown, linkInput: unknown,
  productIds: string[], media: Map<string,Row>) {
  const rows = array(menuInput,"menus",1000).map((entry,index) => {
    const field = `menus[${index}]`;
    return syncFields(object(entry,field), CATEGORY_FIELDS.filter((key) => key !== "createdAt"));
  });
  const menuIds = rows.map((row,index) => uuid(row.id,`menus[${index}].id`));
  unique(menuIds,"menus");
  const links = array(linkInput,"menu_products",10000).map((entry,index) => {
    const field = `menu_products[${index}]`;
    const row = syncFields(object(entry,field),["menuId","productId"]);
    return { menu_id: uuid(row.menuId,`${field}.menuId`), product_id: uuid(row.productId,`${field}.productId`) };
  });
  unique(links.map((link) => `${link.menu_id}:${link.product_id}`),"menu_products");
  const referencedProducts = [...new Set(links.map((link) => link.product_id))];
  const [existingMenus, existingProducts] = await env.DB.batch<Row>([
    env.DB.prepare("SELECT * FROM menus WHERE business_id=? OR id IN (SELECT value FROM json_each(?))")
      .bind(businessId,JSON.stringify(menuIds)),
    env.DB.prepare("SELECT id FROM products WHERE business_id=? AND id IN (SELECT value FROM json_each(?))")
      .bind(businessId,JSON.stringify(referencedProducts)),
  ]);
  const menusById = new Map(existingMenus.results.map((row) => [row.id,row]));
  const incomingProducts = new Set([...productIds,...existingProducts.results.map((row) => row.id)]);
  const normalized = rows.map((row,index) => {
    const field = `menus[${index}]`;
    const id = menuIds[index];
    const existing = menusById.get(id);
    if (existing && (existing.business_id !== businessId || existing.source !== "pos"))
      throw new SyncError("A menu ID already belongs to another business or a local menu",409,"CATALOG_ID_CONFLICT");
    const old = existing ?? {};
    const names = localized(row,old,field);
    const previousPosParent = old.admin_reparented === 1 ? old.pos_parent_id : old.parent_id;
    const parent = has(row, "parentId") ? row.parentId : previousPosParent;
    const parentId = parent == null ? null : uuid(parent,`${field}.parentId`);
    const menuSlug = slug(row,old,names,id,field);
    if (existing && menuSlug !== old.slug)
      invalid(field,"an existing menu must keep its slug");
    const image = photo(row,old,"imageMediaId","image_media_id",field,media,env);
    const sort = has(row,"sortOrder") ? sortOrder(row.sortOrder) : old.sort_order ?? 0;
    const active = has(row,"isActive") ? flag(row.isActive,`${field}.isActive`) : 1;
    const edited = old.admin_active != null;
    return { id,parent_id: parentId,pos_parent_id: parentId,slug: menuSlug,
      name_km: edited ? old.name_km : names.name_km,
      name_en: edited ? old.name_en : names.name_en ?? "",
      name_zh: edited ? old.name_zh : names.name_zh ?? "",
      image_media_id: edited ? old.image_media_id : image.mediaId,
      image_url: edited ? old.image_url : image.image_url,
      sort_order: edited || old.admin_sorted === 1 ? old.sort_order : sort,
      is_active: old.admin_active ?? active,
      source: "pos",
      was_qr_root: Number(old.was_qr_root === 1 || (old.parent_id === null && parentId !== null)),
    };
  });
  const incomingSections = new Set(
    normalized.filter((menu) => menu.parent_id !== null).map((menu) => menu.id),
  );
  for (const link of links) {
    if (!incomingSections.has(link.menu_id)) invalid("menu_products.menuId","must reference a submenu in this snapshot");
    if (!incomingProducts.has(link.product_id)) invalid("menu_products.productId","must reference a product owned by this business or included in this sync");
  }
  validateGraph(normalized,[],[],"menu");
  const effectiveMenus = normalized.map((menu) => {
    const existing = menusById.get(menu.id);
    return existing?.admin_reparented === 1 ? { ...menu, parent_id: existing.parent_id } : menu;
  });
  const ownedMenus = existingMenus.results.filter((row) => row.business_id === businessId);
  const sorted = validateGraph(effectiveMenus,ownedMenus,[],"menu");
  validateUnique(sorted,ownedMenus,"slug");
  const deletedMenuIds = new Set(existingMenus.results
    .filter((row) => row.business_id === businessId && row.deleted_in_admin === 1)
    .map(({ id }) => String(id)));
  const storedMenus = sorted.map((menu) => {
    const id = String(menu.id);
    const deleted = deletedMenuIds.has(id) || deletedMenuIds.has(String(menu.parent_id ?? ""));
    if (deleted) deletedMenuIds.add(id);
    return { ...menu, deleted_in_admin: Number(deleted), is_active: deleted ? 0 : menu.is_active };
  });
  const storedLinks = links.filter(({ menu_id }) => !deletedMenuIds.has(menu_id));
  return [
    ...upsertRows(env,"menus",storedMenus,businessId,["id","parent_id","pos_parent_id","slug","name_km","name_en","name_zh",
      "image_media_id","image_url","sort_order","is_active","source","deleted_in_admin","was_qr_root"]),
    // A branch moved under a deleted menu may still have older descendants absent from this snapshot.
    env.DB.prepare(`WITH RECURSIVE deleted_branch(id) AS (
        SELECT id FROM menus WHERE business_id=?1 AND deleted_in_admin=1
        UNION
        SELECT child.id FROM menus child JOIN deleted_branch ON child.parent_id=deleted_branch.id
        WHERE child.business_id=?1 AND child.source='pos'
      )
      UPDATE menus SET is_active=0,
        deleted_in_admin=CASE WHEN id IN (SELECT id FROM deleted_branch) THEN 1 ELSE deleted_in_admin END
      WHERE business_id=?1 AND source='pos' AND id NOT IN (SELECT value FROM json_each(?2))`)
      .bind(businessId,JSON.stringify(menuIds)),
    env.DB.prepare(`DELETE FROM menu_products WHERE business_id=?1
      AND menu_id IN (SELECT id FROM menus WHERE business_id=?1 AND source='pos')
      AND (
        menu_id IN (SELECT id FROM menus WHERE business_id=?1 AND (parent_id IS NULL OR deleted_in_admin=1))
        OR (assigned_in_admin=0 AND (menu_id,product_id) NOT IN (
          SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?2)
        ))
      )`).bind(businessId,JSON.stringify(storedLinks.map(({ menu_id, product_id }) => [menu_id, product_id]))),
    ...rowChunks(storedLinks).map((chunk) => env.DB.prepare(`WITH requested(menu_id,product_id) AS (
        SELECT json_extract(value,'$.menu_id'),json_extract(value,'$.product_id') FROM json_each(?2)
      )
      INSERT INTO menu_products (business_id,menu_id,product_id)
      SELECT ?1,link.menu_id,link.product_id FROM requested link
      WHERE NOT EXISTS (SELECT 1 FROM menu_product_exclusions exclusion
        WHERE exclusion.business_id=?1 AND exclusion.menu_id=link.menu_id AND exclusion.product_id=link.product_id)
      ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId,chunk)),
  ];
}

async function productMenuWrites(env: Env, businessId: string, productId: string, value: unknown, revision: string) {
  const ids = array(value,"product.menu_ids",1000).map((entry,index) => uuid(entry,`product.menu_ids[${index}]`));
  unique(ids,"product.menu_ids");
  const encoded = JSON.stringify(ids);
  const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM menus WHERE business_id=? AND source='pos' AND parent_id IS NOT NULL
    AND id IN (SELECT value FROM json_each(?))`).bind(businessId,encoded).first<number>("count");
  if (count !== ids.length) invalid("product.menu_ids","must reference POS submenus owned by this business");
  return [
    env.DB.prepare(`DELETE FROM menu_products WHERE business_id=? AND product_id=? AND assigned_in_admin=0
      AND menu_id IN (SELECT id FROM menus WHERE business_id=? AND source='pos')
      AND menu_id NOT IN (SELECT value FROM json_each(?))`).bind(businessId,productId,businessId,encoded),
    env.DB.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id)
      SELECT ?1,id,?2 FROM menus WHERE business_id=?1 AND source='pos'
        AND parent_id IS NOT NULL AND deleted_in_admin=0 AND id IN (SELECT value FROM json_each(?3))
        AND NOT EXISTS (SELECT 1 FROM menu_product_exclusions exclusion
          WHERE exclusion.business_id=?1 AND exclusion.menu_id=menus.id AND exclusion.product_id=?2)
      ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`)
      .bind(businessId,productId,encoded),
    env.DB.prepare("UPDATE products SET pos_menu_updated_at=? WHERE business_id=? AND id=?").bind(revision,businessId,productId),
  ];
}

export async function handlePosSync(
  request: Request,
  env: Env,
  subscriptionFor: (row: SyncIdentity) => Subscription,
  scope: "catalog" | "product" | "tables",
): Promise<Response> {
  if (request.method !== "POST")
    return response({ error: "Method not allowed" }, 405, { allow: "POST" });
  const singleProduct = scope === "product";
  const success = () =>
    response({ message: `POS ${scope} synced successfully.` });
  return withPosIdentity(request, env, async (identity) => {
    if (subscriptionFor(identity).readOnly)
      return response(
        {
          error: "Subscription has expired; POS sync is read-only",
          code: "SUBSCRIPTION_EXPIRED",
        },
        402,
      );
    const raw = await readBody(request);
    if (scope === "tables")
      return await syncTables(env, identity, raw);
    const body = syncFields(
      parseJson(raw),
      [
        "syncId",
        "sourceUpdatedAt",
        "currency",
        "categories",
        singleProduct ? "product" : "products",
        ...(singleProduct ? [] : ["menus","menuProducts"]),
      ],
    );
    const syncId = has(body, "syncId")
      ? uuid(body.syncId, "syncId")
      : crypto.randomUUID();
    // Keep the server-generated ordering token monotonic even when two syncs
    // arrive in the same millisecond or an earlier client timestamp was ahead.
    const previousSourceTime = singleProduct
      ? NaN
      : Date.parse(identity.lastSourceUpdatedAt || "");
    const sourceTimestamp = has(body, "sourceUpdatedAt")
      ? timestamp(body.sourceUpdatedAt, "sourceUpdatedAt")
      : null;
    const sourceUpdatedAt =
      sourceTimestamp ??
      new Date(
        Math.max(
          Date.now(),
          Number.isFinite(previousSourceTime) ? previousSourceTime + 1 : 0,
        ),
      ).toISOString();
    // Currency is always owned by the business resolved from the API key.
    // An optional legacy hint can assert a match, but never overrides it.
    if (has(body, "currency") && body.currency !== identity.currency)
      invalid(
        "currency",
        `must match the business currency (${identity.currency})`,
      );
    const categories =
      singleProduct && !has(body, "categories")
        ? []
        : array(body.categories, "categories", 500).map((row, index) =>
            object(row, `categories[${index}]`),
          );
    const products = singleProduct
      ? [object(body.product, "product")]
      : array(body.products, "products", 1000).map((row, index) =>
          object(row, `products[${index}]`),
        );
    const menuSnapshot = has(body,"menus");
    if (menuSnapshot !== has(body,"menuProducts")) invalid("body","send menus and menu_products together");
    const productMenus = singleProduct && has(products[0],"menu_ids");
    const menuIds = productMenus ? products[0].menu_ids : undefined;
    if (productMenus) delete products[0].menu_ids;
    if ((menuSnapshot || productMenus) && !sourceTimestamp)
      invalid("sourceUpdatedAt","is required for menu updates");
    if (!categories.length && !products.length && !menuSnapshot)
      invalid("body", "include at least one category or product");
    const categoryIds = categories.map((row, index) =>
      uuid(row.id, `categories[${index}].id`),
    );
    const productIds = products.map((row, index) =>
      uuid(row.id, singleProduct ? "product.id" : `products[${index}].id`),
    );
    unique(categoryIds, "categories");
    unique(productIds, "products");
    const payloadHash = await hash(raw);
    if (
      checkReceipt(
        (await syncReceipt(env, identity.businessId, syncId))?.payload_hash,
        payloadHash,
      )
    )
      return success();
    const lastMenuRevision = menuSnapshot ? identity.lastMenuWriteAt : productMenus ? identity.lastMenuSnapshotAt : null;
    if (lastMenuRevision && sourceUpdatedAt <= lastMenuRevision)
      throw new SyncError("A newer menu update has already synced",409,"STALE_SYNC");
    if (
      !singleProduct &&
      identity.lastSourceUpdatedAt &&
      sourceUpdatedAt <= identity.lastSourceUpdatedAt
    )
      throw new SyncError(
        "source_updated_at must be newer than the last successful sync (use the original sync_id and body for retries)",
        409,
        "STALE_SYNC",
      );
    const results = await env.DB.batch([
      env.DB.prepare(
        "SELECT * FROM categories WHERE id IN (SELECT value FROM json_each(?))",
      ).bind(JSON.stringify(categoryIds)),
      env.DB.prepare(
        "SELECT * FROM products WHERE id IN (SELECT value FROM json_each(?))",
      ).bind(JSON.stringify(productIds)),
      env.DB.prepare(
        "SELECT id,parent_id,slug FROM categories WHERE business_id=?",
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT id,code,slug FROM products WHERE business_id=?",
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT id,object_key FROM media WHERE business_id=?",
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT id,is_normal FROM price_lists WHERE business_id=? AND is_archived=0",
      ).bind(identity.businessId),
      env.DB.prepare(
        "SELECT product_id,media_id FROM product_images WHERE business_id=? AND product_id IN (SELECT value FROM json_each(?)) ORDER BY sort_order",
      ).bind(identity.businessId, JSON.stringify(productIds)),
    ]);
    const existingCategories = results[0].results as Row[];
    const existingProducts = results[1].results as Row[];
    if (productMenus && typeof existingProducts[0]?.pos_menu_updated_at === "string" &&
      sourceUpdatedAt <= existingProducts[0].pos_menu_updated_at)
      throw new SyncError("A newer product menu update has already synced",409,"STALE_SYNC");
    if (
      [...existingCategories, ...existingProducts].some(
        (row) => row.business_id !== identity.businessId,
      )
    )
      throw new SyncError(
        "A supplied UUID already belongs to another business",
        409,
        "CATALOG_ID_CONFLICT",
      );
    if (sourceTimestamp) {
      const staleProduct = existingProducts.find(
        (row) =>
          typeof row.pos_source_updated_at === "string" &&
          sourceTimestamp <= row.pos_source_updated_at,
      );
      if (staleProduct)
        throw new SyncError(
          `source_updated_at must be newer than the last source timestamp for product ${staleProduct.id}`,
          409,
          "STALE_SYNC",
        );
    }
    const media = new Map(
      (results[4].results as Row[]).map((row) => [String(row.id), row]),
    );
    const lists = results[5].results as Row[];
    const normalId = String(lists.find((row) => row.is_normal === 1)?.id || "");
    if (!normalId)
      throw new SyncError(
        "The business needs a Normal Rate price list before syncing",
        409,
        "NORMAL_PRICE_LIST_MISSING",
      );
    const gallery = new Map<string, string[]>();
    for (const row of results[6].results as Row[]) {
      const id = String(row.product_id);
      gallery.set(id, [...(gallery.get(id) || []), String(row.media_id)]);
    }
    const normalizedCategories = categoriesForSync(
      categories,
      new Map(existingCategories.map((row) => [String(row.id), row])),
      media,
      env,
    );
    const normalizedProducts = productsForSync(
      products,
      new Map(existingProducts.map((row) => [String(row.id), row])),
      gallery,
      media,
      new Set(lists.map((row) => String(row.id))),
      normalId,
      env,
      sourceTimestamp,
    );
    if (!await ownsPortionBranches(env.DB, identity.businessId, normalizedProducts.flatMap((product) => product.portions)))
      invalid("products.portions.branchId", "must reference a branch of this business");
    const orderedCategories = validateGraph(
      normalizedCategories,
      results[2].results as Row[],
      normalizedProducts,
    );
    validateUnique(normalizedCategories, results[2].results as Row[], "slug");
    validateUnique(normalizedProducts, results[3].results as Row[], "slug");
    validateUnique(
      normalizedProducts,
      results[3].results as Row[],
      "code",
      true,
    );
    const businessId = identity.businessId;
    const placeholders = crypto.randomUUID();
    const writes = [
      env.DB.prepare(
        "INSERT INTO pos_sync_requests (business_id,sync_id,payload_hash,source_updated_at,base_version,product_id) VALUES (?,?,?,?,?,?)",
      ).bind(
        businessId,
        syncId,
        payloadHash,
        sourceUpdatedAt,
        identity.catalogVersion,
        singleProduct ? productIds[0] : null,
      ),
      // Release unique slugs/codes inside the transaction to allow legitimate swaps.
      env.DB.prepare(
        "UPDATE categories SET slug=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))",
      ).bind(`pos-${placeholders}-`, businessId, JSON.stringify(categoryIds)),
      env.DB.prepare(
        "UPDATE products SET code=NULL,slug=? || id WHERE business_id=? AND id IN (SELECT value FROM json_each(?))",
      ).bind(`pos-${placeholders}-`, businessId, JSON.stringify(productIds)),
      ...upsertRows(env, "categories", orderedCategories, businessId, [
        "id",
        "parent_id",
        "name",
        "name_km",
        "name_en",
        "name_zh",
        "slug",
        "image_url",
        "image_media_id",
        "sort_order",
        "is_active",
        "created_at",
      ]),
      ...upsertRows(env, "products", normalizedProducts, businessId, [
        "id",
        "category_id",
        "code",
        "name",
        "name_km",
        "name_en",
        "name_zh",
        "slug",
        "description",
        "price_cents",
        "max_price",
        "unit",
        "portions_json",
        "modifier_groups_json",
        "image_url",
        "primary_media_id",
        "calories",
        "prep_minutes",
        "rating",
        "is_featured",
        "is_available",
        "sort_order",
        "created_at",
        "pos_source_updated_at",
      ]),
      env.DB.prepare(
        "DELETE FROM product_images WHERE business_id=? AND product_id IN (SELECT value FROM json_each(?))",
      ).bind(businessId, JSON.stringify(productIds)),
    ];
    if (menuSnapshot) writes.push(...await menuSnapshotWrites(env,businessId,body.menus,body.menuProducts,productIds,media));
    if (productMenus) writes.push(...await productMenuWrites(env,businessId,productIds[0],menuIds,sourceUpdatedAt));
    if (menuSnapshot || productMenus) writes.push(env.DB.prepare(`UPDATE pos_integrations
      SET last_menu_snapshot_at=COALESCE(?,last_menu_snapshot_at),
        last_menu_write_at=MAX(COALESCE(last_menu_write_at,''),?) WHERE business_id=?`)
      .bind(menuSnapshot ? sourceUpdatedAt : null,sourceUpdatedAt,businessId));
    const images: Row[] = [];
    const prices: Row[] = [];
    const targets: Row[] = [];
    const removedPrices: Row[] = [];
    for (const product of normalizedProducts) {
      product.mediaIds.forEach((mediaId, index) =>
        images.push({
          productId: product.id,
          mediaId,
          sortOrder: index,
          isPrimary: mediaId === product.primary_media_id ? 1 : 0,
        }),
      );
      const normal = product.portions.length
        ? product.portions.map((portion) => ({
            targetKey: portion.id,
            priceCents: portion.priceCents,
          }))
        : [{ targetKey: "base", priceCents: product.price_cents }];
      targets.push({
        productId: product.id,
        keys: normal.map((entry) => entry.targetKey),
      });
      for (const entry of normal) {
        prices.push({ productId: product.id, priceListId: normalId, ...entry });
      }
      for (const entry of product.priceEntries)
        (entry.priceCents === null ? removedPrices : prices).push({
          productId: product.id,
          ...entry,
        });
    }
    for (const chunk of rowChunks(images))
      writes.push(
        env.DB.prepare(
          `INSERT INTO product_images (business_id,product_id,media_id,sort_order,is_primary)
       SELECT ?,json_extract(value,'$.productId'),json_extract(value,'$.mediaId'),json_extract(value,'$.sortOrder'),json_extract(value,'$.isPrimary') FROM json_each(?)`,
        ).bind(businessId, chunk),
      );
    // A single JSON parameter avoids SQLite's 100-bound-parameter limit.
    writes.push(
      env.DB.prepare(
        `DELETE FROM product_prices WHERE business_id=? AND product_id IN (SELECT value FROM json_each(?))
       AND NOT EXISTS (SELECT 1 FROM json_each(?) target, json_each(target.value,'$.keys') target_key
         WHERE json_extract(target.value,'$.productId')=product_prices.product_id
         AND target_key.value=product_prices.target_key)`,
      ).bind(businessId, JSON.stringify(productIds), JSON.stringify(targets)),
    );
    for (const chunk of rowChunks(removedPrices))
      writes.push(
        env.DB.prepare(
          `DELETE FROM product_prices WHERE business_id=? AND EXISTS (SELECT 1 FROM json_each(?) entry
       WHERE json_extract(entry.value,'$.productId')=product_prices.product_id
       AND json_extract(entry.value,'$.priceListId')=product_prices.price_list_id
       AND json_extract(entry.value,'$.targetKey')=product_prices.target_key)`,
        ).bind(businessId, chunk),
      );
    for (const chunk of rowChunks(prices))
      writes.push(
        env.DB.prepare(
          `INSERT INTO product_prices (business_id,product_id,price_list_id,target_key,price_amount)
       SELECT ?,json_extract(value,'$.productId'),json_extract(value,'$.priceListId'),json_extract(value,'$.targetKey'),json_extract(value,'$.priceCents') FROM json_each(?) WHERE 1
       ON CONFLICT(price_list_id,product_id,target_key) DO UPDATE SET price_amount=excluded.price_amount,updated_at=CURRENT_TIMESTAMP`,
        ).bind(businessId, chunk),
      );
    writes.push(
      env.DB.prepare(
        "UPDATE businesses SET menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).bind(businessId),
      env.DB.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1,last_source_updated_at=COALESCE(?,last_source_updated_at),last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE business_id=?",
      ).bind(singleProduct ? null : sourceUpdatedAt, businessId),
    );
    try {
      await env.DB.batch(writes);
    } catch (error) {
      // A concurrent retry may have committed while this request was validating.
      if ((await syncReceipt(env, businessId, syncId))?.payload_hash === payloadHash)
        return success();
      const message = error instanceof Error ? error.message : String(error);
      if (/POS_SYNC_STALE/.test(message))
        throw new SyncError(
          "A newer catalog snapshot has already synced",
          409,
          "STALE_SYNC",
        );
      if (
        /POS_SYNC_CONFLICT|UNIQUE constraint|CATALOG_TENANT_CONFLICT|FOREIGN KEY constraint/.test(
          message,
        )
      )
        throw new SyncError(
          "The catalog changed during sync or an ID, code, slug or reference conflicts. Retry using the latest catalog.",
          409,
          "SYNC_CONFLICT",
        );
      throw error;
    }
    return success();
  });
}
