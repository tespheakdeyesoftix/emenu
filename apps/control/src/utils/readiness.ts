type ReadinessCategory = {
  id: string;
  parentId?: string | null;
  isActive?: number | boolean;
};

type ReadinessProduct = {
  categoryId: string;
  isAvailable?: number | boolean;
  imageUrl?: string;
  primaryMediaId?: string;
  images?: unknown[];
};

const enabled = (value: number | boolean | undefined) =>
  value !== 0 && value !== false;

export function visibleCategoryIds(categories: ReadinessCategory[]) {
  const categoriesById = new Map(categories.map((item) => [item.id, item]));
  const visibility = new Map<string, boolean>();

  function isVisible(
    categoryId: string,
    visiting = new Set<string>(),
  ): boolean {
    const cached = visibility.get(categoryId);
    if (cached !== undefined) return cached;

    const category = categoriesById.get(categoryId);
    if (!category || !enabled(category.isActive) || visiting.has(categoryId)) {
      visibility.set(categoryId, false);
      return false;
    }
    if (!category.parentId) {
      visibility.set(categoryId, true);
      return true;
    }

    const nextVisiting = new Set(visiting).add(categoryId);
    const result = isVisible(category.parentId, nextVisiting);
    visibility.set(categoryId, result);
    return result;
  }

  for (const category of categories) isVisible(category.id);
  return new Set(
    [...visibility.entries()]
      .filter(([, isVisible]) => isVisible)
      .map(([categoryId]) => categoryId),
  );
}

export function isPublishedProduct(
  product: ReadinessProduct,
  categoryIds: Set<string>,
) {
  return enabled(product.isAvailable) && categoryIds.has(product.categoryId);
}

export function hasProductPhoto(product: ReadinessProduct) {
  return Boolean(
    product.primaryMediaId ||
    product.imageUrl?.trim() ||
    (product.images?.length ?? 0) > 0,
  );
}
