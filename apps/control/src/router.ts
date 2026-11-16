import { createRouter, createWebHistory } from "vue-router";
import AppShell from "./components/AppShell.vue";
import OverviewView from "./views/OverviewView.vue";
import BusinessView from "./views/BusinessView.vue";
import AppearanceView from "./views/AppearanceView.vue";
import CatalogView from "./views/CatalogView.vue";
import BannersView from "./views/BannersView.vue";
import PriceListsView from "./views/PriceListsView.vue";
import ManagePricesView from "./views/ManagePricesView.vue";
import LoginView from "./views/LoginView.vue";
import WorkspaceUnavailableView from "./views/WorkspaceUnavailableView.vue";
import { controlPageIds, controlPages, type ControlPage } from "../../../shared/controlPages";
import { useAdminStore } from "./stores/admin";
import { telegramOrderQuery } from "./utils/telegramOrderLink";

const pages = {
  overview: OverviewView,
  business: BusinessView,
  appearance: AppearanceView,
  catalog: CatalogView,
  menus: () => import("./views/MenusView.vue"),
  priceLists: PriceListsView,
  managePrices: ManagePricesView,
  sellingOverview: () => import("./views/SellingOverviewView.vue"),
  posProfiles: () => import("./views/PosProfilesView.vue"),
  posPaymentTypes: () => import("./views/PosPaymentTypesView.vue"),
  salesList: () => import("./views/SalesListView.vue"),
  orders: () => import("./views/OrdersView.vue"),
  bookings: () => import("./views/BookingsView.vue"),
  telegramNotifications: () => import("./views/TelegramNotificationsView.vue"),
  reports: () => import("./views/ReportsView.vue"),
  tables: () => import("./views/TablesView.vue"),
  banners: BannersView,
  qrDesigns: () => import("./views/QrDesignsView.vue"),
} satisfies Record<ControlPage, unknown>;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView },
    {
      path: "/",
      component: AppShell,
      children: [
        ...controlPageIds.map((name) => ({
          path: name === "bookings" ? "bookings/:bookingId?" : controlPages[name].path.slice(1),
          name,
          component: pages[name],
        })),
        { path: "workspace-unavailable", name: "workspace-unavailable", component: WorkspaceUnavailableView },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const hasToken = Boolean(localStorage.getItem("mf_token"));
  const orderAlert = to.name === "orders" || to.path === "/login" ? telegramOrderQuery(to.query) : undefined;
  if (to.path !== "/login" && !hasToken) return { path: "/login", query: orderAlert };
  if (to.path === "/login" && hasToken) return orderAlert ? { name: "orders", query: orderAlert } : "/";

  const page = controlPageIds.find((id) => id === to.name);
  if (!page) return;
  try {
    const accessible = await useAdminStore().refreshWorkspaceAccess();
    if (accessible.includes(page)) return;
    if (page === "overview" && accessible.length)
      return { name: accessible[0], replace: true };
  } catch {
    if (!localStorage.getItem("mf_token")) return { path: "/login", query: orderAlert };
  }
  return { name: "workspace-unavailable", replace: true };
});

export default router;
