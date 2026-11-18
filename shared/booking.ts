export const bookingDefaults = {
  slotMinutes: 30,
  noticeMinutes: 120,
  advanceDays: 30,
  minPax: 1,
  maxPax: 20,
};

export const bookingPreferences = [
  "indoor",
  "outdoor",
  "private-room",
] as const;
export const bookingStatuses = [
  "requested",
  "confirmed",
  "declined",
  "cancelled",
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export type BookingLanguage = "km" | "en";

export type BookingBranch = { id: string; slug: string; name: string };
export type BookingReceipt = {
  reference: string;
  branchName: string;
  arrivalDate: string;
  arrivalTime: string;
  pax: number;
};
export type BookingSummary = BookingReceipt & {
  id: string;
  branchId: string;
  guestName: string;
  status: BookingStatus;
};
export type BookingDetail = BookingSummary & {
  tableId: string | null;
  tableLabel: string | null;
  guestPhone: string;
  preference: string;
  preferenceText: string;
  note: string;
  timezone: string;
  termsLanguage: BookingLanguage;
  termsVersion: string;
  termsText: string;
  termsAcceptedAt: string;
  createdAt: string;
};

export function validBookingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function bookingDateAt(time: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(time);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addBookingDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function bookingStatusActions(status: BookingStatus): BookingStatus[] {
  if (status === "requested") return ["confirmed", "declined", "cancelled"];
  if (status === "confirmed") return ["cancelled"];
  return [];
}
