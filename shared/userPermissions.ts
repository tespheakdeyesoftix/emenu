export const userPermissionKeys = [
  "allow_start_working_day", "allow_close_working_day",
  "allow_start_cashier_shift", "allow_close_cashier_shift",
  "allow_change_product_price", "allow_free_item", "allow_discount_on_item",
  "allow_discount_on_bill", "allow_process_payment", "allow_cancel_print_bill",
] as const;
export type UserPermission = typeof userPermissionKeys[number];
export type UserPermissions = Record<UserPermission, boolean>;

export function userPermissions(value: unknown, role: string): UserPermissions {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  const settings = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : {};
  return Object.fromEntries(userPermissionKeys.map(key => [
    key, role === "owner" || (typeof settings[key] === "boolean" ? settings[key]
      : role === "manager" || !["allow_start_working_day", "allow_close_working_day"].includes(key)),
  ])) as UserPermissions;
}
