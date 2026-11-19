import { userPermissions, type UserPermission } from "../../../shared/userPermissions";
import { PosError, type PosContext } from "./posApiCore";

export function permissionSql(key: UserPermission, user = "u", role = "m.role") {
  const fallback = ["allow_start_working_day","allow_close_working_day"].includes(key)
    ? `CASE WHEN ${role}='manager' THEN 1 ELSE 0 END` : "1";
  return `(${role}='owner' OR COALESCE(json_extract(${user}.permissions,'$.${key}'),${fallback})=1)`;
}
export function requirePosPermission(context: PosContext, key: UserPermission) {
  if (!userPermissions(context.identity.permissions, context.identity.role)[key])
    throw new PosError(403, "PERMISSION_DENIED", "You do not have permission for this action.");
  (context.requiredPermissions ??= new Set()).add(key);
}

// An operator may settle an unchanged line edited by an authorized colleague.
export function requireLinePermissions(context: PosContext, line: Record<string, unknown>, saved?: Record<string, unknown>) {
  const ids = (value: unknown) => JSON.stringify(Array.isArray(value)
    ? value.map(v => typeof v === "object" && v ? (v as Record<string, unknown>).id : v).sort() : []);
  const same = saved != null && line.product_id === saved.product_id &&
    (line.portion_id ?? null) === (saved.portion_id ?? null) &&
    Number(line.quantity) === Number(saved.quantity) &&
    ids(line.modifier_ids ?? line.modifiers) === ids(saved.modifiers);
  const changed = (fields: string[]) => !same || fields.some(key => {
    const a = line[key] ?? (key.startsWith("discount_") && key !== "discount_note" ? 0 : null);
    const b = saved?.[key] ?? (key.startsWith("discount_") && key !== "discount_note" ? 0 : null);
    return key === "is_free" ? Boolean(a) !== Boolean(b) : a !== b;
  });
  if (changed(["base_price_override_minor","price_change_reason"]) &&
      (line.base_price_override_minor != null || saved?.base_price_override_minor != null))
    requirePosPermission(context,"allow_change_product_price");
  if (changed(["is_free","free_reason"]) && (line.is_free || saved?.is_free))
    requirePosPermission(context,"allow_free_item");
  if (changed(["discount_minor","discount_bps","discount_note"]) &&
      [line.discount_minor,line.discount_bps,saved?.discount_minor,saved?.discount_bps].some(value => Number(value ?? 0) > 0))
    requirePosPermission(context,"allow_discount_on_item");
}
