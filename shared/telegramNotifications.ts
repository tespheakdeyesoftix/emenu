export const telegramSources = ["Order", "Booking"] as const;
export type TelegramSource = (typeof telegramSources)[number];
export const maxTelegramChatsPerRule = 20;
export const maxTelegramChatListLength = maxTelegramChatsPerRule * 35;
export const maxTelegramOrderActionUrlLength = 2048;
export const telegramDeliveryRetentionDays = 7;
export const minTelegramDeliveryRetentionDays = 1;
export const maxTelegramDeliveryRetentionDays = 90;
export type TelegramDeliveryStatus =
  "pending" | "sent" | "failed" | "cancelled";
export type TelegramDeliveryHistoryItem = {
  notificationId: string;
  source: TelegramSource;
  sourceId: string;
  reference: string;
  chatId: string;
  status: TelegramDeliveryStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  error: string | null;
  canRetry: number;
};
export type TelegramTestResult = { chatId: string } & (
  { ok: true } | { ok: false; error: string }
);

export const telegramTemplates = {
  Order: {
    title: "New order {{doc.order_number}}",
    message: `{{doc.business.name}} · {{doc.branch.name}}
Table: {{doc.table.label}}
Date: {{format_date(doc.posting_date)}}
Total: {{format_currency(doc.total_amount)}}
{% for op in doc.products %}
{{op.quantity}} × {{op.product_name}} · {{format_currency(op.total_amount)}}
{% endfor %}`,
  },
  Booking: {
    title: "New booking {{doc.id}}",
    message: `{{doc.business.name}} · {{doc.branch.name}}
Arrival: {{format_date(doc.arrival_date)}} at {{doc.arrival_time}}
Guests: {{doc.pax}}
Name: {{doc.guest_name}}
Phone: {{doc.guest_phone}}
Note: {{doc.note}}`,
  },
} satisfies Record<TelegramSource, { title: string; message: string }>;
