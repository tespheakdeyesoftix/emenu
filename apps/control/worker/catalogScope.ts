export type Branch = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  orderRadiusMeters: number | null;
  enableSubmitOrder: number | null;
  isDefault: number;
  isActive: number;
};

export type MenuRoot = { id: string; slug: string; isActive: number };

export const branchOrderOverrides = {
  latitude: "CASE WHEN branch.has_order_location_override=1 THEN branch.latitude END",
  longitude: "CASE WHEN branch.has_order_location_override=1 THEN branch.longitude END",
  radius: "CASE WHEN branch.use_business_order_radius=0 THEN branch.order_radius_meters END",
};

export const branchOrderPolicy = {
  latitude: `COALESCE(${branchOrderOverrides.latitude}, business.latitude)`,
  longitude: `COALESCE(${branchOrderOverrides.longitude}, business.longitude)`,
  radius: `COALESCE(${branchOrderOverrides.radius}, business.order_radius_meters)`,
  enabled: "COALESCE(branch.enable_submit_order, business.enable_submit_order)",
};

export const branchOrderColumns = `
  ${branchOrderPolicy.latitude} AS latitude,
  ${branchOrderPolicy.longitude} AS longitude,
  ${branchOrderPolicy.radius} AS orderRadiusMeters,
  ${branchOrderPolicy.enabled} AS enableSubmitOrder`;

const branchSelect = `SELECT branch.id,branch.slug,branch.name,branch.is_default AS isDefault,branch.is_active AS isActive,
  CASE WHEN branch.is_default=1 THEN business.address ELSE branch.address END AS address,
  CASE WHEN branch.is_default=1 THEN business.phone ELSE branch.phone END AS phone,
  CASE WHEN branch.is_default=1 THEN business.map_url ELSE branch.map_url END AS mapUrl,
  ${branchOrderOverrides.latitude} AS latitude,${branchOrderOverrides.longitude} AS longitude,
  branch.enable_submit_order AS enableSubmitOrder,${branchOrderOverrides.radius} AS orderRadiusMeters
  FROM branches branch JOIN businesses business ON business.id=branch.business_id`;

export function listBranches(db: D1Database, businessId: string) {
  return db
    .prepare(
      `${branchSelect} WHERE branch.business_id=? ORDER BY branch.is_default DESC,branch.name,branch.id`,
    )
    .bind(businessId)
    .all<Branch>();
}

export async function ownsPortionBranches(
  db: D1Database,
  businessId: string,
  portions: Array<{ branchId?: string | null }>,
) {
  const ids = [...new Set(portions.map((portion) => portion.branchId).filter(Boolean))];
  if (!ids.length) return true;
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM branches
    WHERE business_id=? AND id IN (SELECT value FROM json_each(?))`)
    .bind(businessId, JSON.stringify(ids)).first<number>("count");
  return count === ids.length;
}

export function findBranch(
  db: D1Database,
  businessId: string,
  slug: string | null,
) {
  return db
    .prepare(
      `${branchSelect} WHERE branch.business_id=?
    AND ((? IS NULL AND branch.is_default=1) OR branch.slug=?)`,
    )
    .bind(businessId, slug, slug)
    .first<Branch>();
}

export function findMenuRoot(db: D1Database, businessId: string, slug: string) {
  return db
    .prepare(
      `WITH RECURSIVE target AS (
        SELECT id,slug,parent_id,is_active FROM menus
        WHERE business_id=?1 AND slug=?2 AND deleted_in_admin=0
          AND (parent_id IS NULL OR was_qr_root=1)
      ), menu_path(id,parent_id,is_active) AS (
        SELECT id,parent_id,is_active FROM target
        UNION
        SELECT parent.id,parent.parent_id,parent.is_active
        FROM menus parent JOIN menu_path child ON child.parent_id=parent.id
        WHERE parent.business_id=?1
      )
      SELECT id,slug,NOT EXISTS (SELECT 1 FROM menu_path WHERE is_active=0) AS isActive
      FROM target`,
    )
    .bind(businessId, slug)
    .first<MenuRoot>();
}

export function firstActiveMenuRoot(db: D1Database, businessId: string) {
  return db.prepare(
    `SELECT id,slug,is_active AS isActive FROM menus
     WHERE business_id=? AND parent_id IS NULL AND is_active=1 AND deleted_in_admin=0
     ORDER BY sort_order,COALESCE(NULLIF(name_km,''),NULLIF(name_en,''),name_zh),id
     LIMIT 1`,
  ).bind(businessId).first<MenuRoot>();
}

export const visibleMenuIds = `WITH RECURSIVE visible_menu_ids(id) AS (
  SELECT section.id FROM menus root
  JOIN menus section ON section.business_id=root.business_id
    AND (section.parent_id=root.id OR (root.parent_id IS NOT NULL AND section.id=root.id))
  WHERE root.business_id=? AND root.id=? AND (root.parent_id IS NULL OR root.was_qr_root=1)
    AND root.is_active=1 AND section.is_active=1
  UNION
  SELECT child.id FROM menus child JOIN visible_menu_ids parent ON child.parent_id=parent.id
  WHERE child.business_id=? AND child.is_active=1
)`;

export const visibleMenuAssignments = `FROM menu_products assignment
  JOIN visible_menu_ids visible ON visible.id=assignment.menu_id
  WHERE assignment.business_id=product.business_id AND assignment.product_id=product.id`;

export function orderMenuSections<T extends { id: string; parentId: string | null }>(rows: T[]) {
  const children = new Map<string | null, T[]>();
  for (const row of rows) {
    const siblings = children.get(row.parentId) ?? [];
    siblings.push(row);
    children.set(row.parentId, siblings);
  }
  const sorted: T[] = [];
  function append(parentId: string | null) {
    for (const row of children.get(parentId) ?? []) {
      sorted.push(row);
      append(row.id);
    }
  }
  append(null);
  return sorted;
}
