import type { CatalogFilter } from "../stores/admin";

export type MenuProductFilter = CatalogFilter | "unassigned-menu";

export type BranchOption = {
  id: string;
  slug: string;
  name: string;
  isDefault: number;
  isActive: number;
};

export type MenuNode = {
  id: string;
  parentId: string | null;
  slug: string;
  nameKm: string;
  nameEn: string;
  nameZh: string;
  imageUrl: string;
  imageMediaId: string | null;
  sortOrder: number;
  isActive: number;
  source: "local" | "pos";
};

export type MenuTreeMove = {
  id: string;
  fromParentId: string;
};

export type MenuPlacement = Pick<MenuNode, "id" | "parentId" | "sortOrder">;

export type MenuProduct = {
  id: string;
  code: string | null;
  name: string;
  nameKm: string | null;
  nameEn: string | null;
  nameZh: string | null;
  categoryName: string;
  imageUrl: string;
  priceCents: number;
  unit: string | null;
  isAvailable: number;
  isAssigned: number;
  assignedInAdmin: number;
  sortOrder: number;
};

export type MenuProductPage = {
  products: MenuProduct[];
  pagination: { page: number; pageSize: number; total: number };
  counts?: MenuProductCounts;
};

export type MenuProductCounts = {
  all: number;
  published: number;
  unpublished: number;
  featured: number;
  missingPhotos: number;
  unassignedMenu: number;
};

export function menuName(menu: MenuNode, language: string) {
  return (
    (language === "en"
      ? menu.nameEn
      : language === "zh"
        ? menu.nameZh
        : menu.nameKm) ||
    menu.nameKm ||
    menu.nameEn ||
    menu.nameZh
  );
}

export function menuChildren(menus: MenuNode[]) {
  const children = new Map<string | null, MenuNode[]>();
  for (const menu of menus) {
    const siblings = children.get(menu.parentId) ?? [];
    siblings.push(menu);
    children.set(menu.parentId, siblings);
  }
  return children;
}

export function menuTree(menus: MenuNode[]) {
  const children = menuChildren(menus);
  const rows: Array<{ menu: MenuNode; depth: number; active: boolean }> = [];
  function visit(
    parentId: string | null,
    depth: number,
    parentActive: boolean,
  ) {
    for (const menu of children.get(parentId) ?? []) {
      const active = parentActive && Boolean(menu.isActive);
      rows.push({ menu, depth, active });
      visit(menu.id, depth + 1, active);
    }
  }
  visit(null, 0, true);
  return rows;
}

export function menuLink(base: string, branchSlug = "", menuSlug = "") {
  const url = new URL(base);
  if (branchSlug) url.searchParams.set("branch", branchSlug);
  if (menuSlug) url.searchParams.set("menu", menuSlug);
  return url;
}

export function expandedMenuRows(
  rows: ReturnType<typeof menuTree>,
  collapsedIds: ReadonlySet<string>,
) {
  const expanded = new Set<string>();
  return rows.filter(({ menu }) => {
    if (menu.parentId && !expanded.has(menu.parentId)) return false;
    if (!collapsedIds.has(menu.id)) expanded.add(menu.id);
    return true;
  });
}
