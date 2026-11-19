import { validBookingDate } from "../../../shared/booking";
import {
  bodyOf, boolean, choice, Command, conflict, invalid, jsonRow, missing, newId, object, optionalText, pageOf,
  PosError, recordId, respond, sql, string, type PosContext,
} from "./posApiCore";

const customerColumns = "id name external_reference is_walk_in phone_number address customer_group_id gender dob email photo customer_code is_membership allow_credit";
const customerFrom = `FROM pos_customers c LEFT JOIN pos_customer_groups g
    ON g.id=c.customer_group_id AND g.business_id=c.business_id
  WHERE c.business_id=?`;
const customerDetails = customerColumns.split(" ").map((key) => "c." + key).join(",") + ", g.name AS customer_group_name";
const hasCustomerPhoto = "EXISTS (SELECT 1 FROM pos_customer_photos p WHERE p.customer_id=c.id)";
const customerSelect = `SELECT ${customerDetails}, ${hasCustomerPhoto} AS has_uploaded_photo ${customerFrom}`;
const groupSelect = "SELECT id,name FROM pos_customer_groups WHERE business_id=?";
const customerOrder = "c.name COLLATE NOCASE,c.id";

const customerFields = {
  external_reference: 120,
  customer_code: 120,
  phone_number: 50,
  address: 1000,
  customer_group_id: 80,
  gender: 50,
  dob: 10,
  email: 254,
  photo: 2048,
} as const;

type CustomerFields = Record<string, string | number | null | undefined> & { customer_group_id?: string | null };

function parseCustomer(body: Record<string, unknown>, creating: boolean): CustomerFields {
  const fields: Record<string, string | null> = {};
  if (creating || body.name !== undefined) fields.name = string(body.name, "name");
  for (const [field, limit] of Object.entries(customerFields)) {
    if (body[field] !== undefined) fields[field] = optionalText(body[field], field, limit);
  }
  if (fields.customer_group_id) recordId(fields.customer_group_id, "customer_group_id");
  if (fields.dob && !validBookingDate(fields.dob)) invalid("Enter a valid date of birth (YYYY-MM-DD)");
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) invalid("Enter a valid email address");
  if (fields.photo) {
    const url = URL.parse(fields.photo);
    if (!url || !["https:", "http:"].includes(url.protocol) || url.username || url.password)
      invalid("Enter an HTTP or HTTPS photo URL");
  }
  const flags: Record<string, number> = {};
  for (const field of ["is_membership", "allow_credit"] as const) {
    if (body[field] !== undefined) flags[field] = Number(boolean(body[field], field));
  }
  return { ...fields, ...flags };
}

function customerWriteError(error: unknown): never {
  if (String(error).includes("pos_customer_membership_requires_code"))
    invalid("Customer code is required for membership");
  throw error;
}

function groupCondition(businessId: string, group?: string | null) {
  return group
    ? { query: "EXISTS (SELECT 1 FROM pos_customer_groups WHERE business_id=? AND id=?)", params: [businessId, group] }
    : { query: "1", params: [] };
}

function customerWrite(
  db: D1Database,
  businessId: string,
  record: string,
  creating: boolean,
  fields: CustomerFields,
) {
  const columns = Object.keys(fields);
  if (!columns.length) return null;
  const values = Object.values(fields);
  // Check the group and write the record in the same statement.
  const group = groupCondition(businessId, fields.customer_group_id);
  return creating
    ? sql(db, `INSERT INTO pos_customers (id,business_id,${columns.join(",")})
        SELECT ?,?,${columns.map(() => "?").join(",")} WHERE ${group.query}`,
        record, businessId, ...values, ...group.params)
    : sql(db, `UPDATE pos_customers SET ${columns.map((field) => field + "=?").join(",")}
        WHERE business_id=? AND id=? AND ${group.query}`,
        ...values, businessId, record, ...group.params);
}

const maxPhotoBytes = 256 * 1024;
const maxEncodedPhotoBytes = 4 * Math.ceil(maxPhotoBytes / 3);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
type PhotoUpload = { contentType: string; image: ArrayBuffer };

function validateCustomerPhoto(contentType: string, image: ArrayBuffer): PhotoUpload {
  if (!imageTypes.has(contentType) || image.byteLength === 0 || image.byteLength > maxPhotoBytes)
    invalid("Upload a JPG, PNG or WebP photo up to 256 KB");
  const start = String.fromCharCode(...new Uint8Array(image, 0, Math.min(12, image.byteLength)));
  const valid = contentType === "image/webp"
    ? start.startsWith("RIFF") && start.slice(8, 12) === "WEBP"
    : contentType === "image/png"
      ? start.startsWith("\x89PNG\r\n\x1a\n")
      : start.startsWith("\xff\xd8\xff");
  if (!valid) invalid("Upload a valid JPG, PNG or WebP photo");
  return { contentType, image };
}

function registerPhotoUpload(value: unknown): PhotoUpload | undefined {
  if (value === undefined) return;
  const upload = object(value);
  const contentType = string(upload.content_type, "photo content type");
  const encoded = string(upload.image, "photo", maxEncodedPhotoBytes);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    invalid("Invalid photo data");
  }
  return validateCustomerPhoto(contentType, Uint8Array.from(decoded, (byte) => byte.charCodeAt(0)).buffer);
}

async function customerUpload(request: Request) {
  const tooLarge = () => new PosError(413, "REQUEST_TOO_LARGE", "Customer photo upload is too large");
  const maxRequestBytes = maxPhotoBytes + 32 * 1024;
  if (Number(request.headers.get("content-length")) > maxRequestBytes) throw tooLarge();
  if (!request.body) invalid("Send customer data and a photo");
  let size = 0;
  const limited = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxRequestBytes) throw tooLarge();
      controller.enqueue(chunk);
    },
  }));
  const form = await new Response(limited, { headers: request.headers }).formData().catch((error: unknown) => {
    if (error instanceof PosError) throw error;
    invalid("Send customer data and a photo");
  });
  const data = form.get("customer");
  const file = form.get("photo");
  if (typeof data !== "string") invalid("Send customer data");
  if (!(file instanceof File) || file.size === 0 || file.size > maxPhotoBytes || !imageTypes.has(file.type))
    invalid("Upload a JPG, PNG or WebP photo up to 256 KB");
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    invalid("Malformed customer data");
  }
  return { body: object(body), upload: validateCustomerPhoto(file.type, await file.arrayBuffer()) };
}

async function customerPhoto(db: D1Database, businessId: string, id: string) {
  const photo = await sql(db, `SELECT p.content_type,p.image FROM pos_customer_photos p
    JOIN pos_customers c ON c.id=p.customer_id WHERE c.business_id=? AND c.id=?`, businessId, id)
    .first<{ content_type: string; image: number[] }>();
  if (!photo) missing("Customer photo");
  return { contentType: photo.content_type, bytes: new Uint8Array(photo.image) };
}

export async function readCustomerPhoto(db: D1Database, businessId: string, id: string) {
  const { contentType, bytes } = await customerPhoto(db, businessId, id);
  return new Response(bytes, { headers: { "content-type": contentType } });
}

export async function readRegisterCustomerPhoto(context: PosContext, id: string) {
  const { contentType, bytes } = await customerPhoto(context.db, context.identity.business_id, id);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return respond({ content_type: contentType, image: btoa(binary) });
}

async function saveCustomer(
  db: D1Database, businessId: string, body: Record<string, unknown>, record: string, creating: boolean,
  upload?: PhotoUpload,
) {
  const fields = parseCustomer(body, creating);
  if (upload) fields.photo = null;
  const statements = customerWrites(db, businessId, record, creating, fields, upload);
  if (!statements.length) return;
  const [result] = await db.batch(statements).catch(customerWriteError);
  if (result.meta.changes) return;
  const group = fields.customer_group_id;
  if (group && !await sql(db, "SELECT 1 FROM pos_customer_groups WHERE business_id=? AND id=?", businessId, group).first())
    invalid("Choose a customer group from this business");
  if (!creating) missing("Customer");
  conflict("The customer group changed. Refresh and retry.");
}

function customerWrites(
  db: D1Database, businessId: string, record: string, creating: boolean, fields: CustomerFields,
  upload?: PhotoUpload,
) {
  const write = customerWrite(db, businessId, record, creating, fields);
  if (!write) return [];
  const statements = [write];
  if (upload) {
    statements.push(sql(db, `INSERT INTO pos_customer_photos (customer_id,content_type,image)
      SELECT ?,?,? WHERE changes()=1
      ON CONFLICT(customer_id) DO UPDATE SET content_type=excluded.content_type,image=excluded.image`,
      record, upload.contentType, upload.image));
  } else if (fields.photo !== undefined) {
    statements.push(sql(db, "DELETE FROM pos_customer_photos WHERE customer_id=? AND changes()=1", record));
  }
  return statements;
}

const deletableCustomer = `FROM pos_customers AS customer
  WHERE business_id=? AND id=? AND is_walk_in=0 AND NOT EXISTS (
    SELECT 1 FROM pos_profiles WHERE business_id=customer.business_id AND (
      json_extract(config_json,'$.default_customer_id')=customer.id OR
      json_extract(pending_config_json,'$.default_customer_id')=customer.id
    )
  )`;

async function customerDeleteError(db: D1Database, businessId: string, id: string): Promise<never> {
  const walkIn = await sql(db, "SELECT is_walk_in FROM pos_customers WHERE business_id=? AND id=?", businessId, id)
    .first<number>("is_walk_in");
  if (walkIn === null) missing("Customer");
  if (walkIn) conflict("The walk-in customer cannot be deleted");
  conflict("Change the default customer in all POS profiles that use this customer before deleting");
}

export async function registerCustomerDirectory(
  request: Request, url: URL, context: PosContext,
  resource: "customers" | "customer-groups", id: string | undefined, readOnly: boolean,
) {
  const { db, identity: { business_id: businessId } } = context;
  if (request.method === "GET") {
    if (resource === "customer-groups")
      return respond(await pageOf(db, url, "customer_groups", `${groupSelect} ORDER BY name,id`, [businessId]));
    if (!id)
      return respond(await pageOf(db, url, "customers", `${customerSelect} ORDER BY c.is_walk_in DESC,${customerOrder}`, [businessId]));
    const row = await sql(db, `${customerSelect} AND c.id=?`, businessId, id).first();
    if (!row) missing("Customer");
    return respond(row);
  }
  if (resource !== "customers" || !(id ? ["PATCH", "DELETE"] : ["POST"]).includes(request.method))
    return respond({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  const body = request.method === "DELETE" ? undefined : await bodyOf(request, maxEncodedPhotoBytes + 32_000);
  const command = await Command.read(request, context, body && { body, envelope: body });
  if (command instanceof Response) return command;
  if (readOnly)
    throw new PosError(402, "SUBSCRIPTION_EXPIRED", "Customer changes require an active subscription");

  try {
    if (id && request.method === "DELETE") {
      const params = [businessId, id];
      const eligible = `SELECT 1 ${deletableCustomer}`;
      if (!await sql(db, eligible, ...params).first())
        return await customerDeleteError(db, businessId, id);
      return await command.commit(200, {
        query: `EXISTS (${eligible})`, params, allowStoreAuthority: true,
      }, [sql(db, `DELETE ${deletableCustomer}`, ...params)], {
        query: `SELECT json_object('success',json('true'))`, params: [],
      });
    }

    const creating = !id;
    const record = id ?? newId("posc");
    const fields = parseCustomer(command.body, creating);
    const upload = registerPhotoUpload(command.body.photo_upload);
    if (upload) fields.photo = null;
    const group = groupCondition(businessId, fields.customer_group_id);
    if (!await sql(db, `SELECT 1 WHERE ${group.query}`, ...group.params).first())
      invalid("Choose a customer group from this business");
    const matching = `${customerFrom} AND c.id=?`;
    const params = [businessId, record];
    if (!creating && !await sql(db, `SELECT 1 ${matching}`, ...params).first()) missing("Customer");
    return await command.commit(creating ? 201 : 200, {
      query: creating ? group.query : `${group.query} AND EXISTS (SELECT 1 ${matching})`,
      params: creating ? group.params : [...group.params, ...params],
      allowStoreAuthority: true,
    }, customerWrites(db, businessId, record, creating, fields, upload), {
      query: `SELECT ${jsonRow("c", customerColumns, { customer_group_name: "g.name", has_uploaded_photo: hasCustomerPhoto })} ${matching}`,
      params,
    });
  } catch (error) {
    const replay = await command.replay();
    if (replay) return replay;
    customerWriteError(error);
  }
}

// Accept phone searches regardless of the common separators used to display the number.
const customerPhoneDigits = ["' '", "'+'", "'-'", "'('", "')'", "'.'", "char(160)"]
  .reduce((value, separator) => `replace(${value},${separator},'')`, "c.phone_number");

async function adminCustomerPage(db: D1Database, url: URL, businessId: string) {
  const sortBy = choice(url.searchParams.get("sort_by") ?? "name", "sort_by",
    ["name", "phone_number", "customer_code"] as const);
  const direction = choice(url.searchParams.get("sort_direction") ?? "asc", "sort_direction",
    ["asc", "desc"] as const);
  const search = (url.searchParams.get("search") ?? "").trim();
  if (search.length > 120) invalid("Customer search must be at most 120 characters");

  const params = [businessId];
  let filter = "";
  if (search) {
    const matches = [
      "instr(lower(c.name),lower(?))>0",
      "instr(lower(c.customer_code),lower(?))>0",
      "instr(c.phone_number,?)>0",
    ];
    params.push(search, search, search);
    const digits = /^[+\d\s().-]+$/.test(search) ? search.replace(/\D/g, "") : "";
    if (digits) {
      matches.push(`instr(${customerPhoneDigits},?)>0`);
      params.push(digits);
    }
    filter = ` AND (${matches.join(" OR ")})`;
  }
  const order = sortBy === "name"
    ? `c.name COLLATE NOCASE ${direction},c.id`
    : `nullif(c.${sortBy},'') COLLATE NOCASE ${direction} NULLS LAST,${customerOrder}`;
  return pageOf(db, url, "customers", `${customerSelect}${filter} ORDER BY ${order}`, params);
}

export async function manageCustomerDirectory(
  request: Request,
  url: URL,
  db: D1Database,
  businessId: string,
  resource: "customers" | "customer-groups",
  id?: string,
) {
  const groups = resource === "customer-groups";
  const entity = groups ? "Customer group" : "Customer";
  const select = groups ? groupSelect : customerSelect;
  const read = (record: string) =>
    sql(db, select + (groups ? " AND id=?" : " AND c.id=?"), businessId, record).first();

  if (request.method === "GET") {
    if (!id) {
      return respond(groups
        ? await pageOf(db, url, "customer_groups", `${groupSelect} ORDER BY name,id`, [businessId])
        : await adminCustomerPage(db, url, businessId));
    }
    const existing = await read(id);
    if (!existing) missing(entity);
    return respond(existing);
  }
  if (request.method === "DELETE" && id) {
    if (groups) {
      const result = await sql(db, "DELETE FROM pos_customer_groups WHERE business_id=? AND id=?", businessId, id).run();
      if (!result.meta.changes) missing(entity);
    } else {
      const result = await sql(db, `DELETE ${deletableCustomer}`, businessId, id).run();
      if (!result.meta.changes) await customerDeleteError(db, businessId, id);
    }
    return respond({ success: true });
  }
  if (request.method !== (id ? "PATCH" : "POST"))
    return respond({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  const record = id ?? newId(groups ? "poscg" : "posc");
  if (groups) {
    const body = await bodyOf(request);
    if (body.name !== undefined || !id) {
      const name = string(body.name, "name");
      const result = id
        ? await sql(db, "UPDATE pos_customer_groups SET name=? WHERE business_id=? AND id=?", name, businessId, id).run()
        : await sql(db, "INSERT INTO pos_customer_groups (id,business_id,name) VALUES (?,?,?)", record, businessId, name).run();
      if (id && !result.meta.changes) missing(entity);
    }
  } else {
    const data = request.headers.get("content-type")?.startsWith("multipart/form-data")
      ? await customerUpload(request)
      : { body: await bodyOf(request), upload: undefined };
    await saveCustomer(db, businessId, data.body, record, !id, data.upload);
  }
  const saved = await read(record);
  if (!saved) missing(entity);
  return respond(saved, id ? 200 : 201);
}
