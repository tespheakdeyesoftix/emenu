import { defineStore } from "pinia";
import { distanceMeters } from "../../../../shared/distanceMeters";
import { i18n } from "../i18n";
import cambodiaFlag from "../assets/flags/cambodia.png";
import chinaFlag from "../assets/flags/china.png";
import unitedKingdomFlag from "../assets/flags/united-kingdom.png";
import { defaultMenuTheme, type MenuTheme } from "../theme";
import { descriptionText } from "../../../../shared/descriptionText";
import { randomUuid } from "../utils/randomUuid";
import type { SupportedCurrency } from "../utils/currency";
import { activeVisitOrders } from "../utils/visitSpend";
import {
  configureAnalytics,
  setAnalyticsLanguage,
  trackAnalytics,
} from "../analytics";

export type MenuLanguage = "km" | "en" | "zh";
export type ProductPortion = {
  id: string;
  labelKm: string;
  labelEn?: string | null;
  labelZh?: string | null;
  priceCents: number;
  branchId?: string | null;
  priceRule?: string;
  unit?: string;
};
export type ProductModifierOption = {
  id: string;
  labelKm: string;
  labelEn?: string | null;
  labelZh?: string | null;
  priceCents?: number | null;
  prefix?: string;
};
export type ProductModifierGroup = {
  id: string;
  labelKm: string;
  labelEn?: string | null;
  labelZh?: string | null;
  required: boolean;
  multiple: boolean;
  options: ProductModifierOption[];
};
export type MenuProduct = {
  id: string;
  code?: string | null;
  rating?: number | null;
  categoryId: string;
  menuIds?: string[];
  menuSortOrders?: Record<string, number>;
  name: string;
  nameKm?: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
  description: string;
  priceCents: number;
  maxPrice?: number;
  unit?: string | null;
  portions?: ProductPortion[];
  modifierGroups?: ProductModifierGroup[];
  imageUrl?: string | null;
  isFeatured?: number | boolean;
  prepMinutes?: number | null;
  calories?: number | null;
};
export function displaySectionIds(product: MenuProduct) {
  return product.menuIds ?? [product.categoryId];
}

export function orderMenuProducts(products: MenuProduct[], sectionIds: string[]) {
  return products
    .map((product) => {
      const section = sectionIds.findIndex((id) => product.menuSortOrders?.[id] !== undefined);
      return { product, section, order: product.menuSortOrders?.[sectionIds[section]] ?? 0 };
    })
    .sort((a, b) => a.section - b.section || a.order - b.order)
    .map(({ product }) => product);
}
export type MenuCategory = {
  id: string;
  parentId?: string | null;
  name: string;
  nameKm?: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
  imageUrl?: string | null;
};
export type MenuBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  detailText?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};
export type CartItem = {
  key: string;
  product: MenuProduct;
  portion?: ProductPortion;
  modifiers: ProductModifierOption[];
  unitPrice: number;
  qty: number;
  note?: string;
};
type CartDraft = { items: CartItem[]; note: string };
type SubmittedOrderStatus = "submitted" | "accepted" | "completed" | "cancelled";
type OrderHistoryItemStatus = "submitted" | "confirmed" | "rejected";
type OrderHistoryItem = {
  productId: string;
  quantity: number;
  name: string;
  nameEn?: string | null;
  nameZh?: string | null;
  portionName: string;
  modifiers?: ProductModifierOption[];
  status?: OrderHistoryItemStatus;
};
type SubmittedOrder = {
  orderId: string;
  orderNumber: string;
  deviceId?: string;
  tableId?: string;
  tableLabel: string;
  groupName: string;
  receiptKey: string;
  status: SubmittedOrderStatus;
  postingDate?: string;
  submittedAt?: string | null;
  totalAmount?: number;
  currency?: SupportedCurrency;
  note?: string;
  items?: OrderHistoryItem[];
};

function needsOrderDetails(order: SubmittedOrder) {
  return !order.postingDate || order.submittedAt === undefined || !order.items ||
    !order.tableId || order.totalAmount === undefined || !order.currency ||
    order.items.some((item) => !Array.isArray(item.modifiers) || !isOrderHistoryItemStatus(item.status));
}

function isOrderHistoryItemStatus(value: unknown): value is OrderHistoryItemStatus {
  return value === "submitted" || value === "confirmed" || value === "rejected";
}

function isSubmittedOrderStatus(value: unknown): value is SubmittedOrderStatus {
  return (
    value === "submitted" || value === "accepted" ||
    value === "completed" || value === "cancelled"
  );
}
type OrderError =
  | "failed"
  | "location_unavailable"
  | "menu_changed"
  | "cart_prices_updated"
  | "cart_items_unavailable"
  | "menu_unavailable"
  | "table_unavailable"
  | "ordering_disabled"
  | "ordering_settings_changed"
  | "order_limit_reached"
  | "device_order_limit_reached"
  | "invalid_order";
type OrderLocationStatus =
  | ""
  | "checking"
  | "inside"
  | "outside"
  | "blocked"
  | "unavailable";
type Coordinates = { latitude: number; longitude: number };

function getOrderLocation() {
  return new Promise<Coordinates | "blocked" | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => resolve({ latitude, longitude }),
      (error) =>
        resolve(error.code === error.PERMISSION_DENIED ? "blocked" : null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }).catch(() => null);
}
export type TableContext = { tableId?: string; code: string; label: string; groupName: string };
export type BusinessLocation = {
  label: string;
  address: string;
  mapUrl: string;
  showInMenu: boolean;
};

type LocalizedItem = {
  name: string;
  nameKm?: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
};
type LocalizedLabel = {
  labelKm: string;
  labelEn?: string | null;
  labelZh?: string | null;
};

function khmerDisplayText(text: string) {
  // Correct the legacy spelling that encodes the register shifter as a second vowel.
  return text?.replaceAll("ញុាំ", "ញ៉ាំ") ?? "";
}

const localizedName = (item: LocalizedItem, language: MenuLanguage) => {
  if (language === "en" && item.nameEn?.trim()) return khmerDisplayText(item.nameEn);
  if (language === "zh" && item.nameZh?.trim()) return khmerDisplayText(item.nameZh);
  return khmerDisplayText(item.nameKm?.trim() || item.name);
};
const localizedLabel = (item: LocalizedLabel, language: MenuLanguage) => {
  if (language === "en" && item.labelEn?.trim()) return khmerDisplayText(item.labelEn);
  if (language === "zh" && item.labelZh?.trim()) return khmerDisplayText(item.labelZh);
  return khmerDisplayText(item.labelKm);
};
const readArray = <T>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const localDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const readDailyCart = (key: string): CartDraft => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (parsed && parsed.day === localDayKey() && Array.isArray(parsed.items)) {
      return {
        items: (parsed.items as CartItem[]).filter(
          (item) => item?.product?.id && item.qty > 0 && Array.isArray(item.modifiers),
        ),
        note: typeof parsed.note === "string" ? parsed.note.slice(0, 500) : "",
      };
    }
  } catch {
    // Invalid or legacy cart data is cleared below.
  }
  localStorage.removeItem(key);
  return { items: [], note: "" };
};

function readBusinessCart(key: string) {
  const draft = readDailyCart(key);
  const tablePrefix = `${key}:`;
  const legacyKeys = Object.keys(localStorage).filter(
    (entry) => entry.startsWith(tablePrefix) &&
      /^[a-zA-Z0-9_-]+$/.test(entry.slice(tablePrefix.length)) &&
      entry !== `${key}:submission`,
  );
  if (!legacyKeys.length) return draft;

  appendCartLines(draft.items, legacyKeys.flatMap((legacyKey) => readDailyCart(legacyKey).items));
  // Save the combined draft before removing the old table-specific copies.
  if (draft.items.length)
    localStorage.setItem(key, JSON.stringify({ day: localDayKey(), ...draft }));
  for (const legacyKey of legacyKeys) localStorage.removeItem(legacyKey);
  return draft;
}

function appendCartLines(cart: CartItem[], items: CartItem[]) {
  const keys = new Set(cart.map((item) => item.key));
  for (const item of items) {
    const key = keys.has(item.key) ? `${item.key}~${randomUuid()}` : item.key;
    keys.add(key);
    cart.push({ ...item, key });
  }
}

function removeBusinessCart(key: string) {
  localStorage.removeItem(key);
  for (const entry of Object.keys(localStorage)) {
    if (entry.startsWith(`${key}:`) && entry.endsWith(":submission"))
      localStorage.removeItem(entry);
  }
}

function orderItems(cart: CartItem[]) {
  return cart.map((item) => ({
    productId: item.product.id,
    portionId: item.portion?.id ?? null,
    modifierIds: item.modifiers.map((option) => option.id).sort(),
    quantity: item.qty,
    note: item.note?.trim() ?? "",
    expectedPrice: item.unitPrice,
  }));
}

function orderSelection(items: ReturnType<typeof orderItems>, note: string) {
  const lines = items.map(({ expectedPrice, ...item }) => item);
  return JSON.stringify(note ? { lines, note } : lines);
}

const CART_QUANTITY_TOAST_DELAY_MS = 1000;
let cartToastTimer = 0;
let menuLoadSequence = 0;
let orderLocationRequestSequence = 0;
let menuLoadController: AbortController | null = null;
const submittedOrdersKey = (slug: string) => `angkor_emenu_submitted_orders:${slug}`;

function moveSavedMenuState(previous: string, current: string) {
  const prefixes = ["favourites", "cart", "recent_views", "submitted_orders", "scoped_cart"];
  for (const key of Object.keys(localStorage)) {
    const prefix = prefixes.find((type) => {
      const base = `angkor_emenu_${type}:${previous}`;
      return key === base || key.startsWith(`${base}:`);
    });
    if (!prefix) continue;
    const base = `angkor_emenu_${prefix}:${previous}`;
    const target = `angkor_emenu_${prefix}:${current}${key.slice(base.length)}`;
    const value = localStorage.getItem(key);
    if (value === null || localStorage.getItem(target) !== null) continue;
    localStorage.setItem(target, value);
    localStorage.removeItem(key);
  }
}

function receiptDeviceId() {
  const key = "angkor_emenu_receipt_device";
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const id = randomUuid();
  localStorage.setItem(key, id);
  return id;
}

function readSubmittedOrders(key: string, deviceId: string) {
  return readArray<SubmittedOrder>(key)
    .filter((order) => !order.deviceId || order.deviceId === deviceId)
    .map((order) => ({ ...order, deviceId }));
}

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const MENU_LOAD_TIMEOUT_MS = 12_000;
const emptyCatalog = () => ({
  branch: null as { id: string; slug: string; name: string; isDefault: boolean } | null,
  menu: null as { id: string; slug: string } | null,
  business: {
    name: "",
    logoUrl: "",
    slug: "",
    tagline: "",
    description: "",
    phone: "",
    contactNumbers: [] as Array<{ label: string; number: string }>,
    businessHours: [] as Array<{
      day: number;
      enabled: boolean;
      open: string;
      close: string;
    }>,
    email: "",
    websiteUrl: "",
    socialLinks: [] as Array<{ platform: string; url: string }>,
    locations: [] as BusinessLocation[],
    mapUrl: "",
    mapLabel: "",
    wifiSsid: "",
    wifiPassword: "",
    wifiSecurity: "wpa" as "wpa" | "open",
    showHeaderLocation: true,
    showHeaderPhones: false,
    showHeaderWifi: false,
    showHeaderSocials: false,
    showHeaderTagline: true,
    showBusinessHours: true,
    address: "",
    currency: "KHR",
    secondaryCurrency: "USD",
    secondaryExchangeRate: 0.00025,
    showSecondaryCurrency: false,
    enableAddToOrder: true,
    enableSubmitOrder: false,
    orderLocation: null as Coordinates | null,
    orderRadiusMeters: 100,
    timezone: "Asia/Phnom_Penh",
    locale: "km",
    enableEn: false,
    enableZh: false,
    themeColor: "#e84231",
    menuTheme: defaultMenuTheme(),
  },
  categories: [] as MenuCategory[],
  products: [] as MenuProduct[],
  banners: [] as MenuBanner[],
});

function menuUrl(slug: string, branch: string | null, menu: string | null) {
  const query = new URLSearchParams();
  if (branch !== null) query.set("branch", branch);
  if (menu !== null) query.set("menu", menu);
  return `${API}/api/public/businesses/${encodeURIComponent(slug)}/menu${query.size ? `?${query}` : ""}`;
}

function tableContextUrl(slug: string, token: string, tableId: string, branch: string | null) {
  const query = new URLSearchParams();
  if (tableId) query.set("table_id", tableId);
  if (branch !== null) query.set("branch", branch);
  return `${API}/api/public/businesses/${encodeURIComponent(slug)}/table-context/${encodeURIComponent(token)}${query.size ? `?${query}` : ""}`;
}

function normalizeCatalog(data: ReturnType<typeof emptyCatalog>) {
  const business = { ...emptyCatalog().business, ...data.business };
  if (!Array.isArray(data.business?.locations)) {
    const mapUrl = business.mapUrl?.trim() || "";
    const address = business.address?.trim() || "";
    if (mapUrl || address) {
      business.locations = [
        { label: business.mapLabel?.trim() || "Main branch", address, mapUrl, showInMenu: true },
      ];
    }
  }
  business.showHeaderLocation = Boolean(data.business?.showHeaderLocation ?? true);
  business.showHeaderPhones = Boolean(data.business?.showHeaderPhones);
  business.showHeaderWifi = Boolean(data.business?.showHeaderWifi);
  business.showHeaderSocials = Boolean(data.business?.showHeaderSocials);
  business.showHeaderTagline = Boolean(data.business?.showHeaderTagline ?? true);
  business.showBusinessHours = Boolean(data.business?.showBusinessHours ?? true);
  business.enableAddToOrder = Boolean(data.business?.enableAddToOrder ?? true);
  business.enableSubmitOrder = data.business?.enableSubmitOrder === true;
  business.orderRadiusMeters = data.business?.orderRadiusMeters ?? 100;
  business.menuTheme = {
    ...defaultMenuTheme(business.themeColor),
    ...data.business?.menuTheme,
  };
  return {
    ...data,
    business,
    products: data.products.map((product) => ({
      ...product,
      description: khmerDisplayText(descriptionText(product.description)),
    })),
  };
}

function repriceCart(
  cart: CartItem[],
  products: Map<string, MenuProduct>,
  validateSelections = false,
) {
  return cart.flatMap((item) => {
    const product = products.get(item.product.id);
    if (!product) return [];
    const portion = product.portions?.find((entry) => entry.id === item.portion?.id);
    if (!portion && (item.portion || (validateSelections && product.portions?.length)))
      return [];

    const groups = product.modifierGroups || [];
    const options = groups.flatMap((group) => group.options);
    if (validateSelections) {
      const selected = new Set(item.modifiers.map((option) => option.id));
      const groupCounts = groups.map((group) =>
        group.options.filter((option) => selected.has(option.id)).length,
      );
      if (
        groupCounts.reduce((total, count) => total + count, 0) !== item.modifiers.length ||
        groups.some((group, index) =>
          (group.required && groupCounts[index] === 0) ||
          (!group.multiple && groupCounts[index] > 1),
        )
      ) return [];
    }
    const modifiers = item.modifiers.map(
      (modifier) => options.find((option) => option.id === modifier.id) || modifier,
    );
    return [{
      ...item,
      product,
      portion,
      modifiers,
      unitPrice: (portion?.priceCents ?? product.priceCents) +
        modifiers.reduce((total, modifier) => total + Number(modifier.priceCents || 0), 0),
    }];
  });
}

export const useMenuStore = defineStore("menu", {
  state: () => ({
    data: emptyCatalog(),
    loading: true,
    connected: false,
    loadedContextKey: "",
    menuUnavailable: false,
    loadError: false,
    currentSlug: "",
    currentTableToken: "",
    currentBranchSlug: null as string | null,
    currentMenuSlug: null as string | null,
    tableContext: null as TableContext | null,
    tableContextUnavailable: false,
    selectedLanguage: "km" as MenuLanguage,
    languagePreferenceRequired: false,
    activeCategory: "",
    search: "",
    selected: null as MenuProduct | null,
    editingCartKey: "",
    favouriteIds: [] as string[],
    recentProductIds: [] as string[],
    cart: [] as CartItem[],
    orderNote: "",
    cartDay: localDayKey(),
    cartToast: "",
    cartToastId: 0,
    submittingOrder: false,
    submittedOrders: [] as SubmittedOrder[],
    receiptDeviceId: "",
    orderError: "" as OrderError | "",
    orderLocationStatus: "" as OrderLocationStatus,
    orderLocationPrompt: "" as "" | "request" | "settings",
  }),
  getters: {
    availableLanguages: (state) => [
      { code: "km" as MenuLanguage, label: "ខ្មែរ", flag: cambodiaFlag },
      ...(state.data.business.enableEn
        ? [
            {
              code: "en" as MenuLanguage,
              label: "English",
              flag: unitedKingdomFlag,
            },
          ]
        : []),
      ...(state.data.business.enableZh
        ? [{ code: "zh" as MenuLanguage, label: "中文", flag: chinaFlag }]
        : []),
    ],
    featured: (state) => state.data.products.filter((item) => item.isFeatured),
    filtered: (state) => {
      const visibleCategoryIds = new Set<string>();
      if (state.activeCategory) {
        visibleCategoryIds.add(state.activeCategory);
        let foundChild = true;
        while (foundChild) {
          foundChild = false;
          for (const category of state.data.categories) {
            const parentId = (category as MenuCategory).parentId;
            if (
              parentId &&
              visibleCategoryIds.has(parentId) &&
              !visibleCategoryIds.has(category.id)
            ) {
              visibleCategoryIds.add(category.id);
              foundChild = true;
            }
          }
        }
      }
      const query = khmerDisplayText(state.search).toLowerCase();
      return state.data.products.filter(
        (product) =>
          (!state.activeCategory ||
            displaySectionIds(product).some((id) => visibleCategoryIds.has(id))) &&
          `${localizedName(product, state.selectedLanguage)} ${product.description}`
            .toLowerCase()
            .includes(query),
      );
    },
    favouriteProducts: (state) =>
      state.data.products.filter((product) =>
        state.favouriteIds.includes(product.id),
      ),
    recentProducts: (state) => {
      const productsById = new Map(
        state.data.products.map((product) => [product.id, product]),
      );
      return state.recentProductIds.flatMap((id) => {
        const product = productsById.get(id);
        return product ? [product] : [];
      });
    },
    cartCount: (state) =>
      state.cart.reduce((count, item) => count + item.qty, 0),
    cartQuantityByProduct: (state) => {
      const quantities = new Map<string, number>();
      for (const { product, qty } of state.cart) {
        quantities.set(product.id, (quantities.get(product.id) ?? 0) + qty);
      }
      return quantities;
    },
    cartTotal: (state) =>
      state.cart.reduce((total, item) => total + item.unitPrice * item.qty, 0),
    editingItem: (state) =>
      state.cart.find((item) => item.key === state.editingCartKey) || null,
    orderingEnabled: (state) => state.data.business.enableAddToOrder !== false,
    orderSubmissionEnabled: (state) =>
      state.data.business.enableAddToOrder &&
      state.data.business.enableSubmitOrder &&
      Boolean(state.data.business.orderLocation),
  },
  actions: {
    nameFor(item: LocalizedItem) {
      return localizedName(item, this.selectedLanguage);
    },
    labelFor(item: LocalizedLabel) {
      return localizedLabel(item, this.selectedLanguage);
    },
    storageKey(type: "favourites" | "cart" | "recent_views", tableToken?: string) {
      if (type === "cart" && (this.currentBranchSlug !== null || this.currentMenuSlug !== null))
        return `angkor_emenu_scoped_cart:${this.currentSlug}:${this.data.branch?.id ?? ""}:${this.data.menu?.id ?? ""}:${tableToken ?? this.currentTableToken}`;
      return `angkor_emenu_${type}:${this.currentSlug}`;
    },
    async validateTableScan(value: string, signal: AbortSignal) {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return null;
      }
      const token = url.searchParams.get("table");
      const tableId = url.searchParams.get("table_id") ?? "";
      const branch = url.searchParams.get("branch");
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !token || !/^[a-zA-Z0-9_-]{1,128}$/.test(token) ||
        (branch !== null && branch !== this.data.branch?.slug)
      ) return null;

      const response = await fetch(
        tableContextUrl(this.currentSlug, token, tableId, this.currentBranchSlug),
        { signal: AbortSignal.any([signal, AbortSignal.timeout(MENU_LOAD_TIMEOUT_MS)]) },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Table validation failed");
      const context = await response.json() as TableContext;
      return context.tableId ? { token, tableId: context.tableId } : null;
    },
    moveDraftToTable(token: string) {
      const fromKey = this.storageKey("cart");
      const toKey = this.storageKey("cart", token);
      if (fromKey === toKey) return;
      const draft = readDailyCart(fromKey);
      if (!draft.items.length) return;
      const target = readDailyCart(toKey);
      appendCartLines(target.items, draft.items);
      const note = [...new Set([draft.note.trim(), target.note.trim()].filter(Boolean))]
        .join("\n")
        .slice(0, 500);
      localStorage.setItem(toKey, JSON.stringify({ day: localDayKey(), items: target.items, note }));
      localStorage.removeItem(fromKey);
    },
    loadLocalState() {
      this.favouriteIds = readArray<string>(this.storageKey("favourites"));
      this.recentProductIds = Array.from(
        new Set(
          readArray<unknown>(this.storageKey("recent_views")).filter(
            (id): id is string => typeof id === "string" && Boolean(id),
          ),
        ),
      ).slice(0, 8);
      this.cartDay = localDayKey();
      const draft = readBusinessCart(this.storageKey("cart"));
      this.cart = draft.items;
      this.orderNote = draft.note;
      this.receiptDeviceId = receiptDeviceId();
      this.submittedOrders = readSubmittedOrders(
        submittedOrdersKey(this.currentSlug),
        this.receiptDeviceId,
      );
    },
    persistCart() {
      this.cartDay = localDayKey();
      if (!this.cart.length) {
        this.orderNote = "";
        removeBusinessCart(this.storageKey("cart"));
        return;
      }
      localStorage.setItem(
        this.storageKey("cart"),
        JSON.stringify({ day: this.cartDay, items: this.cart, note: this.orderNote }),
      );
    },
    persistRecentViews() {
      localStorage.setItem(
        this.storageKey("recent_views"),
        JSON.stringify(this.recentProductIds),
      );
    },
    recordProductView(productId: string) {
      if (!productId) return;
      this.recentProductIds = [
        productId,
        ...this.recentProductIds.filter((id) => id !== productId),
      ].slice(0, 8);
      this.persistRecentViews();
      trackAnalytics("product_view", { productId });
    },
    openProduct(product: MenuProduct) {
      this.editingCartKey = "";
      this.selected = product;
      this.recordProductView(product.id);
    },
    dismissCartToast() {
      window.clearTimeout(cartToastTimer);
      this.cartToast = "";
    },
    showCartToast(message: string) {
      this.dismissCartToast();
      this.cartToast = message;
      this.cartToastId += 1;
      cartToastTimer = window.setTimeout(() => {
        this.cartToast = "";
      }, 2600);
    },
    showCartQuantityToast(product: MenuProduct) {
      const count = this.cartQuantityByProduct.get(product.id) ?? 0;
      const quantity = i18n.global.t("order.quantity", { count });
      this.showCartToast(`${this.nameFor(product)} · ${quantity}`);
    },
    queueCartQuantityToast(product: MenuProduct) {
      this.dismissCartToast();
      cartToastTimer = window.setTimeout(() => {
        this.showCartQuantityToast(product);
      }, CART_QUANTITY_TOAST_DELAY_MS);
    },
    expireCartIfNeeded() {
      if (!this.connected || this.submittingOrder || this.cartDay === localDayKey()) return;
      this.clearCart(false);
    },
    setLanguage(language: MenuLanguage, persistPreference = true) {
      if (!this.availableLanguages.some((item) => item.code === language))
        return;
      const changed = this.selectedLanguage !== language;
      this.selectedLanguage = language;
      setAnalyticsLanguage(language);
      i18n.global.locale.value = language;
      document.documentElement.lang = language;
      if (persistPreference) {
        localStorage.setItem("angkor_emenu_language", language);
        this.languagePreferenceRequired = false;
      }
      if (persistPreference && changed && this.connected)
        trackAnalytics("language_change");
    },
    async load(
      slug: string,
      tableToken = "",
      options: { force?: boolean; hostname?: string; tableId?: string; branch?: string | null; menu?: string | null } = {},
    ) {
      const requestedSlug = slug.trim();
      let normalizedSlug = requestedSlug;
      const hostname = String(options.hostname || "")
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");
      const tableId = options.tableId || "";
      const branch = options.branch ?? null;
      const menu = options.menu ?? null;
      const contextKey = JSON.stringify([requestedSlug || `@${hostname}`, tableToken, tableId, branch, menu]);
      if (
        !options.force &&
        this.connected &&
        this.loadedContextKey === contextKey
      )
        return;
      const loadSequence = ++menuLoadSequence;
      menuLoadController?.abort();
      const controller = new AbortController();
      menuLoadController = controller;
      const loadTimeout = window.setTimeout(
        () => controller.abort(),
        MENU_LOAD_TIMEOUT_MS,
      );
      this.dismissCartToast();
      this.loading = true;
      this.connected = false;
      this.loadedContextKey = "";
      this.menuUnavailable = false;
      this.loadError = false;
      this.data = emptyCatalog();
      this.currentSlug = normalizedSlug;
      this.currentTableToken = tableToken;
      this.currentBranchSlug = branch;
      this.currentMenuSlug = menu;
      this.submittedOrders = [];
      this.orderError = "";
      this.orderLocationStatus = "";
      this.orderLocationPrompt = "";
      this.tableContext = null;
      this.tableContextUnavailable = false;
      this.languagePreferenceRequired = false;
      this.activeCategory = "";
      this.selected = null;
      this.editingCartKey = "";
      this.recentProductIds = [];
      try {
        if (!normalizedSlug) {
          if (!hostname) {
            this.menuUnavailable = true;
            return;
          }
          const domainResponse = await fetch(
            `${API}/api/public/domains/${encodeURIComponent(hostname)}`,
            { signal: controller.signal },
          );
          if (loadSequence !== menuLoadSequence) return;
          if (!domainResponse.ok) {
            this.menuUnavailable = [404, 410].includes(domainResponse.status);
            this.loadError = !this.menuUnavailable;
            return;
          }
          const domain = (await domainResponse.json()) as { slug?: string };
          if (loadSequence !== menuLoadSequence) return;
          normalizedSlug = String(domain.slug || "").trim();
          if (!normalizedSlug) {
            this.menuUnavailable = true;
            return;
          }
          this.currentSlug = normalizedSlug;
        }
        const response = await fetch(menuUrl(normalizedSlug, branch, menu), {
          signal: controller.signal,
        });
        if (loadSequence !== menuLoadSequence) return;
        if (!response.ok) {
          this.menuUnavailable = [404, 410].includes(response.status);
          this.loadError = !this.menuUnavailable;
          return;
        }
        const data = await response.json();
        if (loadSequence !== menuLoadSequence) return;
        this.data = normalizeCatalog(data);
        const canonicalSlug = this.data.business.slug;
        if (canonicalSlug && canonicalSlug !== normalizedSlug) {
          moveSavedMenuState(normalizedSlug, canonicalSlug);
          this.currentSlug = normalizedSlug = canonicalSlug;
        }
        const resolvedMenu = menu ?? this.data.menu?.slug ?? null;
        this.currentMenuSlug = resolvedMenu;
        if (tableToken) {
          const contextResponse = await fetch(
            tableContextUrl(normalizedSlug, tableToken, tableId, branch),
            { signal: controller.signal },
          );
          const context = contextResponse.ok ? await contextResponse.json() : null;
          if (loadSequence !== menuLoadSequence) return;
          this.tableContext = context;
          this.tableContextUnavailable = !context;
        }
        this.loadLocalState();
        const productById = new Map(
          this.data.products.map((product) => [product.id, product]),
        );
        this.recentProductIds = this.recentProductIds
          .filter((id) => productById.has(id))
          .slice(0, 8);
        this.persistRecentViews();
        this.cart = repriceCart(this.cart, productById);
        if (!this.orderingEnabled) this.clearCart(false);
        this.persistCart();
        const saved = localStorage.getItem(
          "angkor_emenu_language",
        ) as MenuLanguage | null;
        const validSavedLanguage =
          saved && this.availableLanguages.some((item) => item.code === saved)
            ? saved
            : null;
        this.setLanguage(validSavedLanguage || "km", false);
        this.languagePreferenceRequired =
          !validSavedLanguage && this.availableLanguages.length > 1;
        this.connected = true;
        this.loadedContextKey = JSON.stringify([
          requestedSlug ? normalizedSlug : `@${hostname}`, tableToken, tableId, branch, resolvedMenu,
        ]);
        configureAnalytics(normalizedSlug, this.tableContext ? tableToken : "", this.selectedLanguage, branch, resolvedMenu);
        trackAnalytics("menu_open");
        void this.requestOrderLocation();
      } catch {
        if (loadSequence !== menuLoadSequence) return;
        this.connected = false;
        this.menuUnavailable = false;
        this.loadError = true;
      } finally {
        window.clearTimeout(loadTimeout);
        if (loadSequence === menuLoadSequence) {
          this.loading = false;
          if (menuLoadController === controller) menuLoadController = null;
        }
      }
    },
    isFavourite(productId: string) {
      return this.favouriteIds.includes(productId);
    },
    toggleFavourite(productId: string) {
      const removing = this.isFavourite(productId);
      this.favouriteIds = removing
        ? this.favouriteIds.filter((id) => id !== productId)
        : [...this.favouriteIds, productId];
      localStorage.setItem(
        this.storageKey("favourites"),
        JSON.stringify(this.favouriteIds),
      );
      trackAnalytics(removing ? "favourite_remove" : "favourite_add", {
        productId,
      });
    },
    selectCategory(categoryId: string) {
      this.activeCategory =
        this.activeCategory === categoryId ? "" : categoryId;
      if (this.activeCategory && !this.data.menu)
        trackAnalytics("category_select", { categoryId: this.activeCategory });
    },
    selectOrAdd(product: MenuProduct) {
      if (!this.orderingEnabled) return;
      this.editingCartKey = "";
      if (product.portions?.length || product.modifierGroups?.length) {
        this.openProduct(product);
        return;
      }
      this.add(product, { debounceToast: true });
    },
    editCartItem(key: string) {
      if (!this.orderingEnabled || this.submittingOrder) return;
      const item = this.cart.find((entry) => entry.key === key);
      if (!item) return;
      this.editingCartKey = key;
      this.selected = item.product;
      this.recordProductView(item.product.id);
    },
    closeProductSelection() {
      this.selected = null;
      this.editingCartKey = "";
    },
    add(
      product: MenuProduct,
      selection: {
        portion?: ProductPortion;
        modifiers?: ProductModifierOption[];
        quantity?: number;
        debounceToast?: boolean;
      } = {},
    ) {
      if (!this.orderingEnabled || this.submittingOrder) return;
      this.expireCartIfNeeded();
      const modifiers = selection.modifiers || [];
      const key = [
        product.id,
        selection.portion?.id || "",
        ...modifiers.map((item) => item.id).sort(),
      ].join(":");
      const unitPrice =
        (selection.portion?.priceCents ?? product.priceCents) +
        modifiers.reduce(
          (total, item) => total + Number(item.priceCents || 0),
          0,
        );
      const editing = this.editingItem;
      const quantity = Math.max(1, Math.floor(selection.quantity ?? editing?.qty ?? 1));
      if (editing)
        this.cart = this.cart.filter(
          (item) => item.key !== this.editingCartKey,
        );
      const note = editing?.note || "";
      const item = this.cart.find(
        (entry) =>
          (entry.key === key || entry.key.startsWith(`${key}~`)) &&
          (entry.note || "") === note,
      );
      if (item) item.qty += quantity;
      else
        this.cart.push({
          key: this.cart.some((entry) => entry.key === key)
            ? `${key}~${randomUuid()}`
            : key,
          product,
          portion: selection.portion,
          modifiers,
          unitPrice,
          qty: quantity,
          note,
        });
      this.persistCart();
      if (selection.debounceToast) this.queueCartQuantityToast(product);
      else this.showCartQuantityToast(product);
      this.closeProductSelection();
    },
    setCartQuantity(key: string, quantity: number, notify = false) {
      if (this.submittingOrder) return false;
      this.expireCartIfNeeded();
      const item = this.cart.find((entry) => entry.key === key);
      if (!item) return false;
      const nextQuantity = Math.max(1, Math.floor(quantity));
      if (nextQuantity === item.qty) return true;
      item.qty = nextQuantity;
      this.persistCart();
      if (notify) this.queueCartQuantityToast(item.product);
      return true;
    },
    decreaseCartItemQuantity(key: string) {
      if (!this.orderingEnabled || this.submittingOrder) return;
      const item = this.cart.find((entry) => entry.key === key);
      if (!item) return;
      if (item.qty > 1) this.setCartQuantity(key, item.qty - 1, true);
      else this.removeCartItem(key, true);
    },
    removeCartItem(key: string, notify = false) {
      if (this.submittingOrder) return;
      this.expireCartIfNeeded();
      const item = this.cart.find((entry) => entry.key === key);
      if (!item) return;
      this.cart = this.cart.filter((item) => item.key !== key);
      this.persistCart();
      if (notify) this.queueCartQuantityToast(item.product);
      else this.dismissCartToast();
    },
    clearCart(notify = true) {
      if (notify && this.submittingOrder) return;
      this.cart = [];
      this.cartDay = localDayKey();
      this.editingCartKey = "";
      this.selected = null;
      this.persistCart();
      if (notify) this.showCartToast(String(i18n.global.t("order.cleared")));
      else this.dismissCartToast();
    },
    setCartNote(key: string, note: string) {
      if (this.submittingOrder) return;
      this.expireCartIfNeeded();
      const item = this.cart.find((entry) => entry.key === key);
      if (!item) return;
      item.note = note.slice(0, 500);
      this.persistCart();
    },
    setOrderNote(note: string) {
      if (this.submittingOrder) return;
      this.expireCartIfNeeded();
      if (!this.cart.length) return;
      this.orderNote = note.slice(0, 500);
      this.persistCart();
    },
    async requestOrderLocation(fromSubmit = false) {
      if (
        !this.connected ||
        !this.orderSubmissionEnabled ||
        this.submittingOrder ||
        this.orderLocationPrompt ||
        this.orderLocationStatus === "checking"
      )
        return;

      const loadSequence = menuLoadSequence;
      const requestSequence = ++orderLocationRequestSequence;
      if (this.orderError === "location_unavailable") this.orderError = "";
      let permission: PermissionStatus | undefined;
      try {
        permission = await navigator.permissions?.query({ name: "geolocation" });
      } catch {
        // Some browsers do not expose geolocation permission through this API.
      }
      if (
        loadSequence !== menuLoadSequence ||
        requestSequence !== orderLocationRequestSequence ||
        this.submittingOrder
      )
        return;

      if (permission?.state === "denied") {
        this.orderLocationStatus = "blocked";
      } else if (permission?.state === "granted") {
        await this.checkOrderLocation();
      } else {
        this.orderLocationPrompt = "request";
        return;
      }
      if (fromSubmit && loadSequence === menuLoadSequence)
        this.showOrderLocationFailure();
    },
    allowOrderLocation() {
      if (this.orderLocationPrompt !== "request") return;
      this.orderLocationPrompt = "";
      void this.checkOrderLocation();
    },
    showOrderLocationFailure() {
      if (this.orderLocationStatus === "blocked")
        this.orderLocationPrompt = "settings";
      else if (this.orderLocationStatus === "unavailable")
        this.orderError = "location_unavailable";
    },
    async checkOrderLocation() {
      const { orderLocation, orderRadiusMeters } = this.data.business;
      if (
        !this.connected ||
        !this.orderSubmissionEnabled ||
        !orderLocation ||
        this.orderLocationStatus === "checking"
      )
        return null;

      const loadSequence = menuLoadSequence;
      this.orderLocationStatus = "checking";
      const location = await getOrderLocation();
      if (loadSequence !== menuLoadSequence) return null;
      if (!location || location === "blocked") {
        this.orderLocationStatus = location ?? "unavailable";
        return null;
      }

      const distance = distanceMeters(
        orderLocation.latitude,
        orderLocation.longitude,
        location.latitude,
        location.longitude,
      );
      this.orderLocationStatus = distance > orderRadiusMeters ? "outside" : "inside";
      return this.orderLocationStatus === "inside" ? location : null;
    },
    async refreshSubmittedOrders(signal: AbortSignal, dates: string[]) {
      const slug = this.currentSlug;
      const key = submittedOrdersKey(slug);
      const deviceId = this.receiptDeviceId;
      const orders = readSubmittedOrders(key, deviceId);
      const visit = new Set(activeVisitOrders(orders, this.tableContext?.tableId, deviceId, Date.now()));
      this.submittedOrders = orders;
      const checks = await Promise.allSettled(
        orders
          .filter((order) =>
            (!order.postingDate || dates.includes(order.postingDate) || visit.has(order)) &&
            (needsOrderDetails(order) || order.status === "submitted" || order.status === "accepted"),
          )
          .map(async (order) => {
            // Review decisions are made while the order is submitted.
            const details = needsOrderDetails(order) || order.status === "submitted";
            const response = await fetch(
              `${API}/api/public/businesses/${encodeURIComponent(slug)}/orders/${encodeURIComponent(order.orderId)}${details ? "?details=1" : ""}`,
              {
                headers: { authorization: `Bearer ${order.receiptKey}` },
                signal,
              },
            );
            if (!response.ok) throw new Error("Order status request failed");
            const { status, postingDate, submittedAt, items, tableId, totalAmount, currency, note } =
              await response.json();
            if (!isSubmittedOrderStatus(status)) throw new Error("Invalid order status");
            if (details && (typeof postingDate !== "string" || !Array.isArray(items)))
              throw new Error("Order details are missing");
            return { order, status, details, postingDate, submittedAt, items, tableId, totalAmount, currency, note };
          }),
      );
      if (signal.aborted || this.currentSlug !== slug) return true;
      const latest = readSubmittedOrders(key, deviceId);
      let changed = false;
      for (const check of checks) {
        if (check.status !== "fulfilled") continue;
        const { order, status, details, postingDate, submittedAt, items, tableId, totalAmount, currency, note } =
          check.value;
        const saved = latest.find((entry) => entry.orderId === order.orderId);
        if (!saved) continue;
        if (saved.status === order.status && order.status !== status) {
          saved.status = status;
          changed = true;
        }
        if (!details) continue;
        if (needsOrderDetails(saved)) {
          saved.postingDate = postingDate;
          saved.submittedAt = submittedAt ?? null;
          saved.items ??= items;
          saved.tableId ??= tableId;
          saved.totalAmount ??= totalAmount;
          saved.currency ??= currency;
          saved.note ??= note;
          changed = true;
        }
        // Both lists follow the submitted line order, including repeated products.
        saved.items?.forEach((item, index) => {
          const receiptItem = items[index];
          if (receiptItem?.productId !== item.productId) return;
          if (!Array.isArray(item.modifiers) && Array.isArray(receiptItem.modifiers)) {
            item.modifiers = receiptItem.modifiers;
            changed = true;
          }
          if (
            isOrderHistoryItemStatus(receiptItem.status) &&
            receiptItem.status !== item.status &&
            item.status !== "confirmed" && item.status !== "rejected"
          ) {
            item.status = receiptItem.status;
            changed = true;
          }
        });
      }
      if (changed) localStorage.setItem(key, JSON.stringify(latest));
      this.submittedOrders = latest;
      return checks.every((check) => check.status === "fulfilled");
    },
    async refreshOrderMenu(cartKey: string): Promise<OrderError | undefined> {
      const loadSequence = menuLoadSequence;
      const response = await fetch(
        menuUrl(this.currentSlug, this.currentBranchSlug, this.currentMenuSlug),
        { cache: "no-store", signal: AbortSignal.timeout(MENU_LOAD_TIMEOUT_MS) },
      );
      if (loadSequence !== menuLoadSequence) return;
      if (response.status === 404 || response.status === 410) return "menu_unavailable";
      if (!response.ok) return "menu_changed";
      const data = normalizeCatalog(await response.json());
      if (loadSequence !== menuLoadSequence) return;
      if (data.branch?.id !== this.data.branch?.id || data.menu?.id !== this.data.menu?.id)
        return "menu_unavailable";

      const draft = readDailyCart(cartKey);
      const products = new Map(data.products.map((product) => [product.id, product]));
      const cart = repriceCart(draft.items, products, true);
      const oldPrices = new Map(this.cart.map((item) => [item.key, item.unitPrice]));
      const pricesChanged =
        data.business.currency !== this.data.business.currency ||
        cart.some((item) => oldPrices.has(item.key) && oldPrices.get(item.key) !== item.unitPrice);
      const previousBusiness = this.data.business;
      const { orderLocation, orderRadiusMeters } = data.business;
      if (
        orderLocation?.latitude !== previousBusiness.orderLocation?.latitude ||
        orderLocation?.longitude !== previousBusiness.orderLocation?.longitude ||
        orderRadiusMeters !== previousBusiness.orderRadiusMeters
      ) this.orderLocationStatus = "";
      this.data = data;
      this.cart = cart;
      this.orderNote = draft.note;
      this.persistCart();

      if (cart.length !== draft.items.length) return "cart_items_unavailable";
      if (pricesChanged) return "cart_prices_updated";
    },
    async submitOrder() {
      if (
        this.submittingOrder ||
        !this.connected ||
        !this.orderSubmissionEnabled ||
        this.orderLocationStatus !== "inside" ||
        !this.tableContext
      )
        return;
      this.expireCartIfNeeded();
      if (!this.cart.length) return false;
      const slug = this.currentSlug;
      const deviceId = this.receiptDeviceId;
      const cartKey = this.storageKey("cart");
      const tableToken = this.currentTableToken;
      const { tableId, label: tableLabel, groupName } = this.tableContext;
      const cartDay = this.cartDay;
      const submissionKey = `${cartKey}:${tableToken}:submission`;
      const items = orderItems(this.cart);
      const note = this.orderNote.trim();
      const historyItems: OrderHistoryItem[] = this.cart.map(({ product, qty, portion, modifiers }) => ({
        productId: product.id,
        quantity: qty,
        name: product.nameKm || product.name,
        nameEn: product.nameEn,
        nameZh: product.nameZh,
        portionName: portion?.labelKm ?? "",
        modifiers,
      }));
      const selection = orderSelection(items, note);
      const matchesSubmission = (draft: CartDraft) =>
        localDayKey() === cartDay &&
        orderSelection(orderItems(draft.items), draft.note.trim()) === selection;
      const loadSequence = menuLoadSequence;
      const isCurrentContext = () => menuLoadSequence === loadSequence;
      this.submittingOrder = true;
      this.dismissCartToast();
      this.orderError = "";
      try {
        const location = await this.checkOrderLocation();
        if (!isCurrentContext()) return;
        if (!location) {
          this.showOrderLocationFailure();
          return false;
        }
        const currentDraft = readDailyCart(cartKey);
        if (!matchesSubmission(currentDraft)) {
          this.cart = currentDraft.items;
          this.orderNote = currentDraft.note;
          this.cartDay = localDayKey();
          return false;
        }
        let pending = JSON.parse(localStorage.getItem(submissionKey) || "null");
        if (pending?.day !== cartDay || pending.selection !== selection) {
          pending = {
            day: cartDay,
            selection,
            body: JSON.stringify({
              submissionId: randomUuid(),
              tableToken,
              tableId,
              branch: this.currentBranchSlug,
              menu: this.currentMenuSlug,
              expectedCurrency: this.data.business.currency,
              ...(note ? { note } : {}),
              items,
            }),
          };
          localStorage.setItem(submissionKey, JSON.stringify(pending));
        }
        const payload = JSON.parse(pending.body);
        const response = await fetch(
          `${API}/api/public/businesses/${encodeURIComponent(slug)}/orders`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...payload, ...location, deviceId }),
            signal: AbortSignal.timeout(15_000),
          },
        );
        const result = await response.json();
        if (!response.ok) {
          if (response.status >= 500) throw new Error("Order request failed");
          if (result.code !== "device_order_limit_reached")
            localStorage.removeItem(submissionKey);
          if (isCurrentContext()) {
            switch (result.code) {
              case "price_changed":
              case "selection_changed":
              case "menu_unavailable":
              case "ordering_settings_changed": {
                const update = await this.refreshOrderMenu(cartKey);
                if (!isCurrentContext()) return;
                this.orderError = update ?? (result.code === "ordering_settings_changed"
                  ? "ordering_settings_changed"
                  : "menu_changed");
                break;
              }
              case "table_unavailable":
              case "ordering_disabled":
              case "order_limit_reached":
              case "device_order_limit_reached":
              case "invalid_order":
                this.orderError = result.code;
                break;
              case "location_required":
                this.orderLocationStatus = "unavailable";
                this.showOrderLocationFailure();
                break;
              case "outside_order_radius":
                this.orderLocationStatus = "outside";
                break;
              default:
                this.orderError = "failed";
            }
          }
          return isCurrentContext() ? false : undefined;
        }
        if (typeof result.orderId !== "string" || !result.orderId)
          throw new Error("Order receipt is missing");
        const historyKey = submittedOrdersKey(slug);
        const history = readSubmittedOrders(historyKey, deviceId);
        const submittedOrder: SubmittedOrder = {
          orderId: result.orderId,
          deviceId,
          tableId: result.tableId ?? tableId,
          orderNumber: typeof result.orderNumber === "string" && result.orderNumber
            ? result.orderNumber
            : result.orderId,
          tableLabel,
          groupName,
          receiptKey: payload.submissionId,
          status: isSubmittedOrderStatus(result.status) ? result.status : "submitted",
          postingDate: result.postingDate,
          submittedAt: result.submittedAt,
          totalAmount: result.totalAmount,
          currency: result.currency,
          note: result.note,
          items: historyItems,
        };
        const updatedHistory = [
          submittedOrder,
          ...history.filter((order) => order.orderId !== submittedOrder.orderId),
        ];
        localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
        if (this.currentSlug === slug) this.submittedOrders = updatedHistory;
        localStorage.removeItem(submissionKey);
        // A scan or another tab may have changed the draft while the order was sending.
        const savedCart = readDailyCart(cartKey);
        const savedCartMatches = matchesSubmission(savedCart);
        if (savedCartMatches) removeBusinessCart(cartKey);
        if (
          this.storageKey("cart") === cartKey && this.cartDay === cartDay &&
          matchesSubmission({ items: this.cart, note: this.orderNote })
        ) {
          this.cart = savedCartMatches ? [] : savedCart.items;
          this.orderNote = savedCartMatches ? "" : savedCart.note;
          this.editingCartKey = "";
          this.selected = null;
        }
        return isCurrentContext() ? true : undefined;
      } catch {
        if (!isCurrentContext()) return;
        this.orderError = "failed";
        return false;
      } finally {
        this.submittingOrder = false;
      }
    },
  },
});
