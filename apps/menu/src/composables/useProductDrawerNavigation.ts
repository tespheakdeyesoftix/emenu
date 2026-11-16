import { useRoute, useRouter } from "vue-router";
import { useMenuStore, type MenuProduct } from "../stores/menu";

export const PRODUCT_DRAWER_HISTORY_STATE = "angkorProductDrawer";

export function productIdFromHash(hash: string) {
  if (!hash.startsWith("#") || hash.length < 2) return "";
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return "";
  }
}

export function useProductDrawerNavigation() {
  const router = useRouter();
  const route = useRoute();
  const store = useMenuStore();

  function productLocation(productId: string, appCreated: boolean) {
    return {
      path: route.path,
      query: route.query,
      hash: productId ? `#${encodeURIComponent(productId)}` : "",
      state: { [PRODUCT_DRAWER_HISTORY_STATE]: appCreated },
    };
  }

  async function pushProductHash(productId: string) {
    if (productIdFromHash(route.hash) === productId) return;
    await router.push(productLocation(productId, true));
  }

  async function openProduct(product: MenuProduct) {
    store.openProduct(product);
    await pushProductHash(product.id);
  }

  async function editCartItem(key: string) {
    store.editCartItem(key);
    if (store.selected) await pushProductHash(store.selected.id);
  }

  function closeProduct() {
    const hasProductHash = Boolean(productIdFromHash(route.hash));
    store.closeProductSelection();
    if (!hasProductHash) return;

    if (window.history.state?.[PRODUCT_DRAWER_HISTORY_STATE] === true) {
      router.back();
      return;
    }

    void router.replace(productLocation("", false));
  }

  return { openProduct, editCartItem, closeProduct };
}
