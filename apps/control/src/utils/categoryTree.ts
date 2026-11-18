import type { TreeNode } from "frappe-ui";
import type { Category } from "../stores/admin";

export type CategoryTreeNode = TreeNode & {
  key: string;
  label: string;
  category: Category;
  children: CategoryTreeNode[];
};

export function categoryTree(
  categories: readonly Category[],
): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const category of categories) {
    nodes.set(category.id, {
      key: category.id,
      label: category.nameKm || category.name,
      category,
      children: [],
    });
  }
  const roots: CategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.category.parentId;
    if (parentId) nodes.get(parentId)?.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function categoryFromNode(node: TreeNode) {
  return (node as CategoryTreeNode).category;
}
