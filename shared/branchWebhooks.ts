export const webhookEvents = {
  inserted: "Inserted",
  updated: "Updated (status change)",
  deleted: "Deleted",
} as const;
export type WebhookEvent = keyof typeof webhookEvents;

type Field = "text" | "number" | "items";
type TableDefinition = {
  label: string;
  events: readonly WebhookEvent[];
  fields: Readonly<Record<string, Field>>;
  defaultBodyFields: readonly string[];
  contactFields?: readonly string[];
  sample: Record<string, unknown>;
  previousStatus: string;
};

export const webhookTables = {
  orders: {
    label: "Orders",
    events: ["inserted", "updated", "deleted"],
    defaultBodyFields: ["id", "status", "items"],
    fields: {
      id: "text", orderNumber: "text", status: "text", postingDate: "text",
      submittedAt: "text", tableId: "text", menuId: "text", totalQuantity: "number",
      totalAmount: "number", currency: "text", note: "text", items: "items",
    },
    sample: {
      id: "example-order", orderNumber: "261110-001", status: "accepted",
      postingDate: "2026-11-10", submittedAt: "2026-11-10T03:00:00Z",
      tableId: "example-table", menuId: null, totalQuantity: 2, totalAmount: 5,
      currency: "USD", note: "",
      items: [{ id: "example-line", lineNumber: 1, productId: "example-product",
        productCode: "COFFEE", productName: "Coffee", quantity: 2, price: 2.5,
        totalAmount: 5, portionId: null, portionName: "", modifiers: [], note: "" }],
    },
    previousStatus: "submitted",
  },
  bookings: {
    label: "Bookings",
    events: ["inserted", "updated", "deleted"],
    defaultBodyFields: ["id", "status", "pax"],
    fields: {
      id: "text", status: "text", arrivalDate: "text", arrivalTime: "text",
      arrivalAt: "text", timezone: "text", pax: "number", preference: "text",
      createdAt: "text", updatedAt: "text", guestName: "text", guestPhone: "text",
      preferenceText: "text", note: "text",
    },
    contactFields: ["guestName", "guestPhone", "preferenceText", "note"],
    sample: {
      id: "BK-EXAMPLE", status: "confirmed", arrivalDate: "2026-11-10",
      arrivalTime: "12:00", arrivalAt: "2026-11-10T05:00:00Z",
      timezone: "Asia/Phnom_Penh", pax: 4, preference: "indoor",
      createdAt: "2026-11-10 03:00:00", updatedAt: "2026-11-10 04:00:00",
      guestName: "Example Guest", guestPhone: "+855 00 000 000", preferenceText: "", note: "",
    },
    previousStatus: "requested",
  },
} as const satisfies Record<string, TableDefinition>;

export type WebhookTable = keyof typeof webhookTables;
export const webhookMethods = ["POST", "PUT", "PATCH", "DELETE", "GET", "HEAD", "OPTIONS"] as const;
export type WebhookMethod = (typeof webhookMethods)[number];
export type WebhookBodyFormat = "json" | "text" | "none";
export type WebhookCondition = {
  field: string;
  op: "eq" | "neq" | "in" | "changed";
  value?: unknown;
};
export type WebhookRule = {
  id: string;
  revision: number;
  name: string;
  enabled: boolean;
  archived: boolean;
  table: WebhookTable;
  event: WebhookEvent;
  url: string;
  method: WebhookMethod;
  filter: WebhookCondition[];
  body: unknown;
  bodyFormat: WebhookBodyFormat;
  includeBookingContact: boolean;
  headerNames: string[];
};
export type WebhookDelivery = {
  id: string;
  eventId: string;
  ruleName: string;
  table: WebhookTable;
  event: WebhookEvent;
  recordId: string;
  status: "pending" | "sending" | "succeeded" | "failed" | "stopped" | "blocked" | "expired";
  attempts: number;
  createdAt: number;
  attemptedAt: number | null;
  nextAttemptAt: number | null;
  httpStatus: number | null;
  error: string | null;
};

export function webhookDefinition(table: WebhookTable): TableDefinition {
  return webhookTables[table];
}

export function webhookFields(table: WebhookTable, includeBookingContact: boolean) {
  const definition = webhookDefinition(table);
  return Object.fromEntries(Object.entries(definition.fields).filter(([field]) =>
    includeBookingContact || !definition.contactFields?.includes(field)));
}

const contextFields = ["event", "eventId", "deliveryId", "businessId", "branchId", "occurredAt"];
const placeholder = /^\{\{(record\.[a-zA-Z]+|previous\.[a-zA-Z]+|[a-zA-Z]+)\}\}$/;
const textPlaceholder = /\{\{(record\.[a-zA-Z]+|previous\.[a-zA-Z]+|eventId|deliveryId|businessId|branchId|occurredAt|event)\}\}/g;

export function validateWebhookTemplate(
  body: unknown, table: WebhookTable, event: WebhookEvent, includeBookingContact: boolean,
  format: WebhookBodyFormat = "json",
): void {
  if (format === "none") return;
  if (body === undefined || (format === "text" && typeof body !== "string"))
    throw new Error(format === "text" ? "Enter a text body." : "Enter a valid JSON value.");
  if (new TextEncoder().encode(JSON.stringify(body)).length > 64 * 1024)
    throw new Error("The body template must be at most 64 KB.");
  const fields = webhookFields(table, includeBookingContact);
  function validateToken(token: string) {
    const [source, field] = token.split(".");
    if (field ? !Object.hasOwn(fields, field) || (source === "previous" && event !== "updated")
      : !contextFields.includes(source)) throw new Error("Unsupported body placeholder: " + token);
  }
  if (format === "text") {
    for (const [, token] of (body as string).matchAll(textPlaceholder)) validateToken(token);
    return;
  }
  function validate(value: unknown, depth: number): void {
    if (depth > 40) throw new Error("The body template is nested too deeply.");
    if (typeof value === "string") {
      const token = placeholder.exec(value)?.[1];
      if (token) validateToken(token);
    }
    if (value && typeof value === "object")
      for (const child of Object.values(value)) validate(child, depth + 1);
  }
  validate(body, 0);
}

type TemplateValues = Record<string, unknown> & {
  record: Record<string, unknown>;
  previous: Record<string, unknown> | null;
};

export function renderWebhookTemplate(body: unknown, values: TemplateValues): unknown {
  if (typeof body === "string") {
    const token = placeholder.exec(body)?.[1];
    if (!token) return body;
    const [source, field] = token.split(".");
    if (!field) return Object.hasOwn(values, source) ? values[source] : null;
    const record = source === "previous" ? values.previous : values.record;
    return record && Object.hasOwn(record, field) ? record[field] : null;
  }
  if (Array.isArray(body)) return body.map(value => renderWebhookTemplate(value, values));
  if (body && typeof body === "object")
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, renderWebhookTemplate(value, values)]));
  return body;
}

export function renderWebhookBody(body: unknown, values: TemplateValues, format: WebhookBodyFormat) {
  if (format === "none") return undefined;
  if (format === "json") return JSON.stringify(renderWebhookTemplate(body, values));
  return (body as string).replace(textPlaceholder, match => {
    const value = renderWebhookTemplate(match, values);
    return value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  });
}

export function previewWebhookBody(body: unknown, table: WebhookTable, event: WebhookEvent, contact: boolean,
  format: WebhookBodyFormat = "json",
) {
  validateWebhookTemplate(body, table, event, contact, format);
  const { sample, previousStatus } = webhookDefinition(table);
  const record = Object.fromEntries(Object.keys(webhookFields(table, contact)).map(field => [field, sample[field]]));
  if (event === "inserted") record.status = previousStatus;
  const values = {
    record, previous: event === "updated" ? { ...record, status: previousStatus } : null,
    event, eventId: "example-event", deliveryId: "example-delivery", businessId: "example-business",
    branchId: "example-branch", occurredAt: "2026-11-10T04:00:00.000Z",
  };
  return format === "json" ? renderWebhookTemplate(body, values) : renderWebhookBody(body, values, format);
}
