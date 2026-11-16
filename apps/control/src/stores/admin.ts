import { defineStore } from "pinia";
import { AUTH_VERSION, createPasswordProof } from "../utils/passwordProof";
import { compressImageForUpload } from "../utils/imageCompression";
import { khmerError } from "../utils/khmer";
import { defaultMenuTheme, type MenuTheme } from "../types/menuTheme";
import { catalogReaderPages, controlPageIds, priceListReaderPages, sellingControlPages, type ControlPage } from "../../../../shared/controlPages";
import { telegramOrderQuery } from "../utils/telegramOrderLink";

export class ControlRequestError extends Error {
  constructor(message: string, readonly status: number, readonly serverMessage?: string) {
    super(message);
  }
}

function workspacePages(workspace: { accessibleControlPages?: ControlPage[]; role?: string }) {
  if (Array.isArray(workspace.accessibleControlPages)) return workspace.accessibleControlPages;

  // The previous production API returned the role from /overview.
  const { role } = workspace;
  if (role !== "owner" && role !== "manager" && role !== "editor") return [];
  return controlPageIds.filter((page) => !sellingControlPages.includes(page) && page !== "orders" && page !== "reports" && page !== "bookings" && page !== "telegramNotifications");
}

export type Business = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logoUrl: string;
  logoMediaId: string;
  phone: string;
  contactNumbers: { label: string; number: string }[];
  businessHours: {
    day: number;
    enabled: boolean;
    open: string;
    close: string;
  }[];
  email: string;
  websiteUrl: string;
  customMenuUrl: string;
  socialLinks: { platform: string; url: string }[];
  locations: BusinessLocation[];
  mapUrl: string;
  mapLabel: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: "wpa" | "open";
  showHeaderLocation: boolean;
  showHeaderPhones: boolean;
  showHeaderWifi: boolean;
  showHeaderSocials: boolean;
  showHeaderTagline: boolean;
  showBusinessHours: boolean;
  address: string;
  currency: "USD" | "KHR";
  secondaryCurrency: "USD" | "KHR";
  secondaryExchangeRate: number;
  showSecondaryCurrency: boolean;
  enableAddToOrder: boolean;
  locale: string;
  enableEn: boolean;
  enableZh: boolean;
  themeColor: string;
  menuTheme: MenuTheme;
  timezone: string;
  pricingMode: "automatic" | "manual";
  defaultPriceListId: string;
  activePriceListId: string;
};

export type BusinessLocation = {
  label: string;
  address: string;
  mapUrl: string;
  showInMenu: boolean;
};

export type PriceList = {
  id: string;
  name: string;
  isNormal: number | boolean;
  scheduleEnabled: number | boolean;
  scheduleStartLocal?: string | null;
  scheduleEndLocal?: string | null;
  isArchived: number | boolean;
  overrideCount?: number;
};

export type ProductPriceEntry = {
  productId: string;
  priceListId: string;
  portionId: string | null;
  priceCents: number;
};

export type ProductPriceDraft = {
  priceListId: string;
  portionId: string | null;
  priceCents: number | null;
};

export type AdminUser = {
  id: string;
  displayName: string;
  email: string;
};

export type SupportSession = {
  active: boolean;
  actorEmail: string;
  expiresAt: string;
};

export type SubscriptionSummary = {
  planCode: string;
  planName: string;
  source: "manual" | "provider";
  status: "trialing" | "active" | "expired" | "unlimited";
  expiresAt: string | null;
  expiresOn: string | null;
  daysRemaining: number | null;
  readOnly: boolean;
};

export type ReadinessState = {
  firstQrDownloadedAt: string | null;
  publishedProducts: number;
  missingPhotoProducts: number;
};

export type CatalogFilter =
  "all" | "published" | "unpublished" | "featured" | "missing-photos";
export type CatalogSort =
  | "sort-order"
  | "name-km"
  | "name-en"
  | "name-zh"
  | "created-at"
  | "updated-at";
export type CatalogSortDirection = "asc" | "desc";
export type CatalogQuery = {
  page?: number;
  pageSize?: number;
  query?: string;
  categoryId?: string;
  filter?: CatalogFilter;
  sortBy?: CatalogSort;
  sortDirection?: CatalogSortDirection;
};

function catalogFilterParams(options: CatalogQuery) {
  const params = new URLSearchParams();
  if (options.query?.trim()) params.set("query", options.query.trim());
  if (options.categoryId) params.set("categoryId", options.categoryId);
  if (options.filter && options.filter !== "all") params.set("filter", options.filter);
  return params;
}

const emptyCatalogCounts = () => ({
  all: 0,
  published: 0,
  unpublished: 0,
  featured: 0,
  missingPhotos: 0,
  byCategory: {} as Record<string, number>,
});

const emptySubscription = (): SubscriptionSummary => ({
  planCode: "standard",
  planName: "Standard",
  source: "manual",
  status: "unlimited",
  expiresAt: null,
  expiresOn: null,
  daysRemaining: null,
  readOnly: false,
});

export type Category = {
  id: string;
  name: string;
  nameKm?: string;
  nameEn?: string;
  nameZh?: string;
  parentId?: string | null;
  imageUrl?: string;
  imageMediaId?: string;
  sortOrder?: number;
  isActive?: number | boolean;
};
export type MediaImage = {
  id: string;
  url: string;
  filename?: string;
  isPrimary?: number | boolean;
};
export type ProductPortion = {
  id: string;
  labelKm: string;
  labelEn?: string;
  labelZh?: string;
  priceCents: number;
  branchId?: string | null;
  priceRule?: string;
  unit?: string;
};
export type ProductModifierOption = {
  id: string;
  labelKm: string;
  labelEn?: string;
  labelZh?: string;
  priceCents?: number | null;
  prefix?: string;
};
export type ProductModifierGroup = {
  id: string;
  labelKm: string;
  labelEn?: string;
  labelZh?: string;
  required: boolean;
  multiple: boolean;
  options: ProductModifierOption[];
};
export type Product = {
  menuIds?: string[];
  id: string;
  code?: string;
  rating?: number | null;
  categoryId: string;
  name: string;
  nameKm?: string;
  nameEn?: string;
  nameZh?: string;
  description: string;
  priceCents: number;
  maxPrice?: number;
  unit?: string;
  portions?: ProductPortion[];
  modifierGroups?: ProductModifierGroup[];
  imageUrl?: string;
  primaryMediaId?: string;
  images?: MediaImage[];
  mediaIds?: string[];
  sortOrder?: number;
  isFeatured?: number | boolean;
  isAvailable?: number | boolean;
  createdAt?: string;
  updatedAt?: string;
  priceEntries?: ProductPriceDraft[];
};
export type BulkProductInfoUpdate = {
  id: string;
  code: string;
  nameKm: string;
  nameEn: string;
  nameZh: string;
  unit: string;
};
export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  detailText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
  isActive?: number | boolean;
};
export type SortOrderItem = { id: string; sortOrder: number };

const bySortOrder = (
  left: { sortOrder?: number; name?: string },
  right: { sortOrder?: number; name?: string },
) =>
  Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
  String(left.name ?? "").localeCompare(String(right.name ?? ""));

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const MENU = import.meta.env.VITE_MENU_URL || "http://localhost:5174";

const emptyBusiness = (): Business => ({
  id: "",
  name: "",
  slug: "",
  tagline: "",
  description: "",
  logoUrl: "",
  logoMediaId: "",
  phone: "",
  contactNumbers: [],
  businessHours: Array.from({ length: 7 }, (_, day) => ({
    day,
    enabled: day !== 0,
    open: "08:00",
    close: "22:00",
  })),
  email: "",
  websiteUrl: "",
  customMenuUrl: "",
  socialLinks: [],
  locations: [],
  mapUrl: "",
  mapLabel: "",
  wifiSsid: "",
  wifiPassword: "",
  wifiSecurity: "wpa",
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
  locale: "km",
  enableEn: false,
  enableZh: false,
  themeColor: "#de3c2f",
  menuTheme: defaultMenuTheme("#de3c2f"),
  timezone: "Asia/Phnom_Penh",
  pricingMode: "automatic",
  defaultPriceListId: "",
  activePriceListId: "",
});

export const useAdminStore = defineStore("admin", {
  state: () => ({
    business: emptyBusiness(),
    categories: [] as Category[],
    products: [] as Product[],
    recentProducts: [] as Product[],
    banners: [] as Banner[],
    priceLists: [] as PriceList[],
    priceEntries: [] as ProductPriceEntry[],
    activePriceListId: "",
    user: { id: "", displayName: "", email: "" } as AdminUser,
    supportSession: null as SupportSession | null,
    subscription: emptySubscription(),
    readiness: {
      firstQrDownloadedAt: null,
      publishedProducts: 0,
      missingPhotoProducts: 0,
    } as ReadinessState,
    dashboardCounts: { products: 0, categories: 0, banners: 0 },
    catalogCounts: emptyCatalogCounts(),
    catalogPagination: { page: 1, pageSize: 50, total: 0 },
    catalogLoading: false,
    catalogRequestId: 0,
    role: "owner",
    accessibleControlPages: [] as ControlPage[],
    loading: true,
    loaded: false,
    loadError: "",
    connected: false,
    toast: "",
  }),
  getters: {
    canAccessPage: (state) => (page: ControlPage) => state.accessibleControlPages.includes(page),
    isReadOnly: (state) =>
      state.subscription.readOnly && !Boolean(state.supportSession),
    platformMenuUrl: (state) =>
      state.business.slug
        ? `${MENU.replace(/\/$/, "")}/${encodeURIComponent(state.business.slug)}`
        : "",
    publicMenuUrl(): string {
      return this.business.customMenuUrl?.trim() || this.platformMenuUrl;
    },
    topCategories: (state) =>
      state.categories.filter((item) => !item.parentId).sort(bySortOrder),
    stats: (state) => state.dashboardCounts,
  },
  actions: {
    notify(message: string) {
      this.toast = message;
      window.setTimeout(() => {
        this.toast = "";
      }, 2400);
    },
    async copyMenuUrl(url: string) {
      try {
        await navigator.clipboard.writeText(url);
        this.notify("បានចម្លងតំណម៉ឺនុយ។");
      } catch {
        this.notify("មិនអាចចម្លងតំណម៉ឺនុយបានទេ។");
      }
    },
    async signOut() {
      const wasSupportSession = Boolean(this.supportSession);
      try {
        await this.request("/api/auth/logout", { method: "POST" });
      } finally {
        localStorage.removeItem("mf_token");
        if (wasSupportSession) window.close();
        location.assign("/login");
      }
    },
    async changePassword(currentPassword: string, newPassword: string) {
      if (!this.user.email) throw new Error("មិនមានអ៊ីមែលគណនីទេ។");
      if (newPassword.length < 8)
        throw new Error("ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច 8 តួអក្សរ។");
      if (currentPassword === newPassword)
        throw new Error(
          "សូមជ្រើសពាក្យសម្ងាត់ថ្មីដែលខុសពីពាក្យសម្ងាត់បច្ចុប្បន្ន។",
        );
      const [currentPasswordProof, newPasswordProof] = await Promise.all([
        createPasswordProof(this.user.email, currentPassword),
        createPasswordProof(this.user.email, newPassword),
      ]);
      const result = await this.request("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPasswordProof,
          newPasswordProof,
          authVersion: AUTH_VERSION,
        }),
      });
      localStorage.setItem("mf_token", result.token);
      this.notify("បានប្តូរពាក្យសម្ងាត់ដោយជោគជ័យ។");
    },
    async request(path: string, init?: RequestInit) {
      const token = localStorage.getItem("mf_token");
      const response = await fetch(`${API}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          ...(init?.body instanceof FormData
            ? {}
            : { "content-type": "application/json" }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
      if (response.status === 401) {
        localStorage.removeItem("mf_token");
        if (location.pathname !== "/login") {
          const orderAlert = location.pathname === "/orders"
            ? telegramOrderQuery(Object.fromEntries(new URLSearchParams(location.search)))
            : undefined;
          location.assign(orderAlert ? `/login?${new URLSearchParams(Object.entries(orderAlert))}` : "/login");
        }
        throw new Error(
          "សម័យប្រើប្រាស់របស់អ្នកបានផុតកំណត់។ សូមចូលគណនីម្តងទៀត។",
        );
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (
          response.status === 402 &&
          payload.code === "SUBSCRIPTION_EXPIRED" &&
          payload.subscription
        ) {
          this.subscription = payload.subscription as SubscriptionSummary;
        }
        throw new ControlRequestError(
          khmerError(payload.error), response.status, typeof payload.error === "string" ? payload.error : undefined,
        );
      }
      return payload;
    },
    async requestWorkspace(path: "workspace" | "workspace-access") {
      try {
        return await this.request(`/api/admin/${path}`);
      } catch (error) {
        if (!(error instanceof ControlRequestError) || error.status !== 404) throw error;
        return this.request("/api/admin/overview");
      }
    },
    async refreshWorkspaceAccess() {
      const accessibleControlPages = workspacePages(await this.requestWorkspace("workspace-access"));
      const changed = this.accessibleControlPages.join() !== accessibleControlPages.join();
      this.accessibleControlPages = accessibleControlPages;
      if (this.loaded && changed) await this.load();
      return this.accessibleControlPages;
    },
    async load() {
      this.loading = true;
      this.loaded = false;
      this.loadError = "";
      this.connected = false;
      this.business = emptyBusiness();
      this.user = { id: "", displayName: "", email: "" };
      this.supportSession = null;
      this.subscription = emptySubscription();
      this.readiness = {
        firstQrDownloadedAt: null,
        publishedProducts: 0,
        missingPhotoProducts: 0,
      };
      this.dashboardCounts = { products: 0, categories: 0, banners: 0 };
      this.catalogCounts = emptyCatalogCounts();
      this.catalogPagination = { page: 1, pageSize: 50, total: 0 };
      this.categories = [];
      this.products = [];
      this.recentProducts = [];
      this.banners = [];
      this.priceLists = [];
      this.priceEntries = [];
      this.activePriceListId = "";
      try {
        const overview = await this.requestWorkspace("workspace");
        this.accessibleControlPages = workspacePages(overview);
        const [catalog, pricing] = await Promise.all([
          catalogReaderPages.some((page) => this.canAccessPage(page))
            ? this.request("/api/admin/catalog?page=1&pageSize=4&sortBy=created-at&sortDirection=desc")
            : null,
          priceListReaderPages.some((page) => this.canAccessPage(page))
            ? this.request("/api/admin/price-lists")
            : null,
        ]);
        this.business = {
          ...emptyBusiness(),
          ...overview.business,
          contactNumbers:
            overview.business.contactNumbers?.length > 0
              ? overview.business.contactNumbers
              : overview.business.phone
                ? [{ label: "ចម្បង", number: overview.business.phone }]
                : [],
          businessHours:
            overview.business.businessHours?.length > 0
              ? overview.business.businessHours
              : emptyBusiness().businessHours,
          socialLinks: overview.business.socialLinks || [],
          locations: Array.isArray(overview.business.locations)
            ? overview.business.locations.map(
                (location: Partial<BusinessLocation>) => ({
                  label: String(location.label || ""),
                  address: String(location.address || ""),
                  mapUrl: String(location.mapUrl || ""),
                  showInMenu:
                    location.showInMenu == null
                      ? true
                      : Boolean(location.showInMenu),
                }),
              )
            : overview.business.mapUrl || overview.business.address
              ? [
                  {
                    label: overview.business.mapLabel || "Main branch",
                    address: overview.business.address || "",
                    mapUrl: overview.business.mapUrl || "",
                    showInMenu: true,
                  },
                ]
              : [],
        };
        this.user = overview.user;
        this.supportSession = overview.supportSession || null;
        this.subscription = overview.subscription || emptySubscription();
        this.readiness = {
          firstQrDownloadedAt: overview.readiness?.firstQrDownloadedAt || null,
          publishedProducts: Number(overview.readiness?.publishedProducts || 0),
          missingPhotoProducts: Number(
            overview.readiness?.missingPhotoProducts || 0,
          ),
        };
        this.dashboardCounts = {
          products: Number(overview.counts?.products || 0),
          categories: Number(overview.counts?.categories || 0),
          banners: Number(overview.counts?.banners || 0),
        };
        this.role = overview.role;
        this.categories = catalog?.categories || [];
        this.products = catalog?.products || [];
        this.recentProducts = this.products;
        this.banners = catalog?.banners || [];
        this.priceEntries = catalog?.priceEntries || [];
        this.catalogPagination = catalog?.pagination || {
          page: 1,
          pageSize: 4,
          total: this.products.length,
        };
        this.catalogCounts = catalog?.counts || emptyCatalogCounts();
        this.priceLists = pricing?.priceLists || [];
        this.activePriceListId = pricing?.activePriceListId || this.business.activePriceListId;
        this.business.activePriceListId = this.activePriceListId;
        this.connected = true;
        this.loaded = true;
      } catch (error) {
        this.loadError =
          error instanceof Error
            ? khmerError(error.message, "មិនអាចផ្ទុកកន្លែងគ្រប់គ្រងបានទេ។")
            : "មិនអាចផ្ទុកកន្លែងគ្រប់គ្រងបានទេ។";
      } finally {
        this.loading = false;
      }
    },
    async saveBusiness() {
      this.business.phone = this.business.contactNumbers[0]?.number || "";
      await this.request("/api/admin/business", {
        method: "PUT",
        body: JSON.stringify(this.business),
      });
      this.connected = true;
      await this.loadPriceLists();
      this.notify("បានរក្សាទុកព័ត៌មានអាជីវកម្ម។");
    },
    async saveMenuTheme(menuTheme: MenuTheme) {
      const result = await this.request("/api/admin/menu-theme", {
        method: "PUT",
        body: JSON.stringify({ menuTheme }),
      });
      this.business.menuTheme = result.menuTheme as MenuTheme;
      this.business.themeColor = this.business.menuTheme.primaryColor;
      this.connected = true;
      this.notify("Menu appearance published.");
    },
    async markQrDownloaded() {
      const result = await this.request("/api/admin/readiness/qr-download", {
        method: "POST",
      });
      this.readiness.firstQrDownloadedAt = result.firstQrDownloadedAt || null;
      return this.readiness.firstQrDownloadedAt;
    },
    async loadCatalogProducts(options: CatalogQuery = {}) {
      const requestId = ++this.catalogRequestId;
      const params = catalogFilterParams(options);
      params.set("page", String(options.page || 1));
      params.set("pageSize", String(options.pageSize || 50));
      if (options.sortBy) params.set("sortBy", options.sortBy);
      if (options.sortDirection)
        params.set("sortDirection", options.sortDirection);
      this.catalogLoading = true;
      try {
        const catalog = await this.request(
          `/api/admin/catalog?${params.toString()}`,
        );
        if (requestId !== this.catalogRequestId) return;
        this.categories = catalog.categories || [];
        this.products = catalog.products || [];
        this.banners = catalog.banners || [];
        this.priceEntries = catalog.priceEntries || [];
        this.catalogPagination = catalog.pagination || {
          page: 1,
          pageSize: options.pageSize || 50,
          total: this.products.length,
        };
        this.catalogCounts = catalog.counts || emptyCatalogCounts();
      } finally {
        if (requestId === this.catalogRequestId) this.catalogLoading = false;
      }
    },
    async fetchMatchingCatalogProductIds(options: CatalogQuery) {
      const params = catalogFilterParams(options);
      params.set("ids", "matches");
      const result = (await this.request(`/api/admin/catalog?${params}`)) as {
        productIds: string[];
      };
      return result.productIds;
    },
    async loadAllProducts() {
      await this.loadCatalogProducts({ page: 1, pageSize: 1000 });
    },
    async fetchCatalogProduct(productId: string) {
      const params = new URLSearchParams({ productId, pageSize: "1" });
      const catalog = await this.request(`/api/admin/catalog?${params}`) as {
        products: Product[];
        priceEntries: ProductPriceEntry[];
      };
      return { product: catalog.products[0], priceEntries: catalog.priceEntries };
    },
    async fetchAllProducts() {
      const catalog = await this.request(
        "/api/admin/catalog?page=1&pageSize=1000",
      );
      return (catalog.products || []) as Product[];
    },
    async loadRecentProducts() {
      const catalog = await this.request(
        "/api/admin/catalog?page=1&pageSize=4&sortBy=created-at&sortDirection=desc",
      );
      this.recentProducts = (catalog.products || []) as Product[];
    },
    async loadPriceLists() {
      const pricing = await this.request("/api/admin/price-lists");
      this.priceLists = pricing.priceLists || [];
      this.activePriceListId = pricing.activePriceListId || "";
      this.business.activePriceListId = this.activePriceListId;
    },
    async createPriceList(payload: Partial<PriceList>) {
      await this.request("/api/admin/price-lists", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await this.loadPriceLists();
      this.notify("បានបង្កើតបញ្ជីតម្លៃ។");
    },
    async updatePriceList(priceListId: string, payload: Partial<PriceList>) {
      await this.request(`/api/admin/price-lists/${priceListId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await this.loadPriceLists();
      this.notify(
        payload.isArchived
          ? "បានដាក់បញ្ជីតម្លៃក្នុងប័ណ្ណសារ។"
          : "បានរក្សាទុកបញ្ជីតម្លៃ។",
      );
    },
    async saveProductPrice(payload: {
      productId: string;
      priceListId: string;
      portionId: string | null;
      priceCents: number | null;
    }) {
      const result = await this.request("/api/admin/product-prices", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const index = this.priceEntries.findIndex(
        (entry) =>
          entry.productId === payload.productId &&
          entry.priceListId === payload.priceListId &&
          entry.portionId === payload.portionId,
      );
      const priceList = this.priceLists.find(
        (item) => item.id === payload.priceListId,
      );
      if (payload.priceCents == null) {
        if (index >= 0) {
          this.priceEntries.splice(index, 1);
          if (priceList)
            priceList.overrideCount = Math.max(
              0,
              Number(priceList.overrideCount || 0) - 1,
            );
        }
      } else {
        const entry = { ...payload, priceCents: payload.priceCents };
        if (index >= 0) this.priceEntries[index] = entry;
        else {
          this.priceEntries.push(entry);
          if (priceList)
            priceList.overrideCount = Number(priceList.overrideCount || 0) + 1;
        }
      }
      if (priceList?.isNormal && payload.priceCents != null) {
        const product = this.products.find(
          (item) => item.id === payload.productId,
        );
        if (product) {
          if (payload.portionId == null) {
            product.priceCents = payload.priceCents;
            product.maxPrice = payload.priceCents;
          } else {
            const portion = product.portions?.find(
              (item) => item.id === payload.portionId,
            );
            if (portion) {
              portion.priceCents = payload.priceCents;
              const prices = (product.portions || []).map((item) =>
                Number(item.priceCents || 0),
              );
              product.priceCents = Math.min(...prices);
              product.maxPrice = Math.max(...prices);
            }
          }
        }
      }
      return result;
    },
    async uploadMedia(
      file: File,
      profile: "default" | "banner" | "background" | "print" = "default",
    ): Promise<MediaImage> {
      const compressed = await compressImageForUpload(file, profile);
      const form = new FormData();
      form.append("file", compressed);
      const uploaded = await this.request("/api/admin/media", {
        method: "POST",
        body: form,
      });
      this.connected = true;
      return {
        id: uploaded.id,
        url: uploaded.url,
        filename: compressed.name,
      };
    },
    async addCategory(payload: Partial<Category>) {
      let item = {
        id: `cat_${Date.now()}`,
        name: payload.nameKm || "ប្រភេទគ្មានឈ្មោះ",
        nameKm: payload.nameKm,
        nameEn: payload.nameEn,
        nameZh: payload.nameZh,
        parentId: payload.parentId || null,
        imageUrl: payload.imageUrl,
        imageMediaId: payload.imageMediaId,
        sortOrder: Number(payload.sortOrder ?? 0),
        isActive: payload.isActive === false ? 0 : 1,
      };
      const response = await this.request("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      item.id = response.id;
      this.connected = true;
      this.categories.push(item);
      this.dashboardCounts.categories += 1;
      this.notify("បានបន្ថែមប្រភេទ។");
    },
    async updateCategory(categoryId: string, payload: Partial<Category>) {
      await this.request(`/api/admin/categories/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const index = this.categories.findIndex((item) => item.id === categoryId);
      if (index >= 0) {
        this.categories[index] = {
          ...this.categories[index],
          ...payload,
          name: payload.nameKm || this.categories[index].name,
        };
      }
      this.connected = true;
      this.notify("បានកែប្រែប្រភេទ។");
    },
    async addProduct(payload: Partial<Product>) {
      let item = {
        id: `prd_${Date.now()}`,
        menuIds: payload.menuIds,
        code: payload.code,
        rating: payload.rating ?? null,
        categoryId: payload.categoryId || this.categories[0]?.id,
        name: payload.nameKm || "មុខម្ហូបគ្មានឈ្មោះ",
        nameKm: payload.nameKm,
        nameEn: payload.nameEn,
        nameZh: payload.nameZh,
        description: payload.description || "",
        priceCents: Number(payload.priceCents || 0),
        maxPrice: Number(payload.maxPrice ?? payload.priceCents ?? 0),
        unit: payload.unit || "",
        portions: payload.portions || [],
        modifierGroups: payload.modifierGroups || [],
        imageUrl: payload.imageUrl || "",
        primaryMediaId: payload.primaryMediaId,
        images: payload.images || [],
        sortOrder: Number(payload.sortOrder ?? 0),
        isFeatured: payload.isFeatured ? 1 : 0,
        isAvailable: payload.isAvailable === false ? 0 : 1,
      };
      const response = await this.request("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      item.id = response.id;
      this.connected = true;
      this.products.push(item);
      this.dashboardCounts.products += 1;
      const normal = this.priceLists.find((list) => list.isNormal);
      if (normal) {
        this.priceEntries.push({
          productId: item.id,
          priceListId: normal.id,
          portionId: null,
          priceCents: item.priceCents,
        });
        for (const portion of item.portions)
          this.priceEntries.push({
            productId: item.id,
            priceListId: normal.id,
            portionId: portion.id,
            priceCents: portion.priceCents,
          });
      }
      for (const entry of payload.priceEntries || []) {
        if (entry.priceCents == null || entry.priceListId === normal?.id)
          continue;
        this.priceEntries.push({
          productId: item.id,
          priceListId: entry.priceListId,
          portionId: entry.portionId,
          priceCents: entry.priceCents,
        });
      }
      this.notify("បានបន្ថែមមុខម្ហូប។");
    },
    async updateProduct(productId: string, payload: Partial<Product>) {
      await this.request(`/api/admin/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const index = this.products.findIndex((item) => item.id === productId);
      if (index >= 0) {
        this.products[index] = {
          ...this.products[index],
          ...payload,
          name: payload.nameKm || this.products[index].name,
        };
      }
      if (payload.priceEntries) {
        const normal = this.priceLists.find((list) => list.isNormal);
        const replacedListIds = new Set([
          ...(normal ? [normal.id] : []),
          ...payload.priceEntries.map((entry) => entry.priceListId),
        ]);
        this.priceEntries = this.priceEntries.filter(
          (entry) =>
            entry.productId !== productId ||
            !replacedListIds.has(entry.priceListId),
        );
        const product = this.products.find((item) => item.id === productId);
        if (normal && product) {
          this.priceEntries.push({
            productId,
            priceListId: normal.id,
            portionId: null,
            priceCents: product.priceCents,
          });
          for (const portion of product.portions || [])
            this.priceEntries.push({
              productId,
              priceListId: normal.id,
              portionId: portion.id,
              priceCents: portion.priceCents,
            });
        }
        for (const entry of payload.priceEntries) {
          if (entry.priceCents == null || entry.priceListId === normal?.id)
            continue;
          this.priceEntries.push({
            productId,
            ...entry,
            priceCents: entry.priceCents,
          });
        }
      }
      this.connected = true;
      this.notify("បានកែប្រែមុខម្ហូប។");
    },
    async bulkUpdateProductInfo(items: BulkProductInfoUpdate[]) {
      await this.request("/api/admin/products/bulk-info", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      const updates = new Map(items.map((item) => [item.id, item]));
      this.products = this.products.map((product) => {
        const update = updates.get(product.id);
        return update
          ? {
              ...product,
              ...update,
              name: update.nameKm,
            }
          : product;
      });
      this.connected = true;
      this.notify(`បានកែប្រែមុខម្ហូប ${items.length} មុខ។`);
    },
    async reorderCategories(items: SortOrderItem[]) {
      await this.request("/api/admin/categories/reorder", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      const order = new Map(items.map((item) => [item.id, item.sortOrder]));
      this.categories = this.categories.map((item) => ({
        ...item,
        sortOrder: order.get(item.id) ?? item.sortOrder,
      }));
      this.connected = true;
      this.notify("បានរក្សាទុកលំដាប់ប្រភេទ។");
    },
    async reorderProducts(categoryId: string, items: SortOrderItem[]) {
      await this.request("/api/admin/products/reorder", {
        method: "PUT",
        body: JSON.stringify({ categoryId, items }),
      });
      const order = new Map(items.map((item) => [item.id, item.sortOrder]));
      this.products = this.products.map((item) => ({
        ...item,
        sortOrder: order.get(item.id) ?? item.sortOrder,
      }));
      this.connected = true;
      this.notify("បានរក្សាទុកលំដាប់មុខម្ហូប។");
    },
    async addBanner(payload: Partial<Banner>) {
      let item: Banner = {
        id: `ban_${Date.now()}`,
        title: payload.title || "បដាគ្មានចំណងជើង",
        subtitle: payload.subtitle || "",
        imageUrl: payload.imageUrl || "",
        detailText: payload.detailText || "",
        ctaLabel: payload.ctaLabel || "",
        ctaUrl: payload.ctaUrl || "",
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        sortOrder: Number(payload.sortOrder ?? 0),
        isActive: payload.isActive === false ? 0 : 1,
      };
      const response = await this.request("/api/admin/banners", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      item.id = response.id;
      this.connected = true;
      this.banners.push(item);
      this.dashboardCounts.banners += 1;
      this.notify("បានផ្សព្វផ្សាយបដា។");
    },
    async updateBanner(bannerId: string, payload: Partial<Banner>) {
      await this.request(`/api/admin/banners/${bannerId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const index = this.banners.findIndex((item) => item.id === bannerId);
      if (index >= 0)
        this.banners[index] = { ...this.banners[index], ...payload };
      this.connected = true;
      this.notify("បានកែប្រែបដា។");
    },
    async bulkDeleteProducts(productIds: string[]) {
      const result = await this.request("/api/admin/products/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ productIds }),
      }) as { deletedIds: string[]; protectedIds: string[] };
      const deleted = new Set(result.deletedIds);
      this.products = this.products.filter(({ id }) => !deleted.has(id));
      this.recentProducts = this.recentProducts.filter(({ id }) => !deleted.has(id));
      this.priceEntries = this.priceEntries.filter(({ productId }) => !deleted.has(productId));
      this.dashboardCounts.products = Math.max(0, this.dashboardCounts.products - deleted.size);
      return result;
    },
    async remove(kind: "categories" | "products" | "banners", itemId: string) {
      const existed =
        kind === "categories"
          ? this.categories.some((item) => item.id === itemId)
          : kind === "products"
            ? this.products.some((item) => item.id === itemId)
            : this.banners.some((item) => item.id === itemId);
      await this.request(`/api/admin/${kind}/${itemId}`, {
        method: "DELETE",
      });
      if (kind === "categories")
        this.categories = this.categories.filter((x) => x.id !== itemId);
      if (kind === "products")
        this.products = this.products.filter((x) => x.id !== itemId);
      if (kind === "products")
        this.priceEntries = this.priceEntries.filter(
          (entry) => entry.productId !== itemId,
        );
      if (kind === "banners")
        this.banners = this.banners.filter((x) => x.id !== itemId);
      if (existed) {
        if (kind === "categories")
          this.dashboardCounts.categories = Math.max(
            0,
            this.dashboardCounts.categories - 1,
          );
        if (kind === "products")
          this.dashboardCounts.products = Math.max(
            0,
            this.dashboardCounts.products - 1,
          );
        if (kind === "banners")
          this.dashboardCounts.banners = Math.max(
            0,
            this.dashboardCounts.banners - 1,
          );
      }
      this.notify("បានលុបធាតុ។");
    },
  },
});
