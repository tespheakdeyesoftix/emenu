import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from "vue-router";
import HomePage from "./views/HomePage.vue";
import MenuPage from "./views/MenuPage.vue";
import CategoryPage from "./views/CategoryPage.vue";
import SearchPage from "./views/SearchPage.vue";
import FavouritesPage from "./views/FavouritesPage.vue";
import OrderPage from "./views/OrderPage.vue";
import { isCustomMenuHostname } from "./utils/menuHost";

const pageScrollPositions = new Map<string, { left: number; top: number }>();
const maxCachedPagePositions = 10;

function rememberScrollPosition(path: string) {
  if (!path) return;
  pageScrollPositions.delete(path);
  pageScrollPositions.set(path, { left: window.scrollX, top: window.scrollY });
  while (pageScrollPositions.size > maxCachedPagePositions) {
    const oldestPath = pageScrollPositions.keys().next().value;
    if (!oldestPath) break;
    pageScrollPositions.delete(oldestPath);
  }
}

const usesCustomDomain = isCustomMenuHostname(window.location.hostname);
const customDomainRoutes = [
  {
    path: "/booking",
    name: "custom-booking",
    component: () => import("./views/BookingPage.vue"),
    meta: { customDomain: true, booking: true },
  },
  {
    path: "/",
    name: "custom-home",
    component: HomePage,
    meta: { customDomain: true, section: "home" },
  },
  {
    path: "/menu",
    name: "custom-menu",
    component: MenuPage,
    meta: { customDomain: true, section: "menu" },
  },
  {
    path: "/category/:categoryId",
    name: "custom-category",
    component: CategoryPage,
    props: (route: RouteLocationNormalized) => ({
      slug: "",
      categoryId: String(route.params.categoryId),
    }),
    meta: { customDomain: true, section: "menu" },
  },
  {
    path: "/search",
    name: "custom-search",
    component: SearchPage,
    meta: { customDomain: true, section: "search" },
  },
  {
    path: "/favourites",
    name: "custom-favourites",
    component: FavouritesPage,
    meta: { customDomain: true, section: "favourites" },
  },
  {
    path: "/order",
    name: "custom-order",
    component: OrderPage,
    meta: { customDomain: true, section: "order" },
  },
];
const platformRoutes = [
  {
    path: "/:slug/booking",
    name: "booking",
    component: () => import("./views/BookingPage.vue"),
    meta: { booking: true },
  },
  {
    path: "/",
    name: "unavailable",
    component: HomePage,
    meta: { section: "home" },
  },
  {
    path: "/:slug",
    name: "home",
    component: HomePage,
    meta: { section: "home" },
  },
  {
    path: "/:slug/menu",
    name: "menu",
    component: MenuPage,
    meta: { section: "menu" },
  },
  {
    path: "/:slug/category/:categoryId",
    name: "category",
    component: CategoryPage,
    props: (route: RouteLocationNormalized) => ({
      slug: String(route.params.slug),
      categoryId: String(route.params.categoryId),
    }),
    meta: { section: "menu" },
  },
  {
    path: "/:slug/search",
    name: "search",
    component: SearchPage,
    meta: { section: "search" },
  },
  {
    path: "/:slug/favourites",
    name: "favourites",
    component: FavouritesPage,
    meta: { section: "favourites" },
  },
  {
    path: "/:slug/order",
    name: "order",
    component: OrderPage,
    meta: { section: "order" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, from, savedPosition) => {
    if (
      to.hash !== from.hash &&
      to.fullPath.split("#")[0] === from.fullPath.split("#")[0]
    )
      return false;
    const position = savedPosition ||
      pageScrollPositions.get(to.fullPath) || { top: 0 };
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve(position));
    });
  },
  routes: [
    ...(usesCustomDomain ? customDomainRoutes : platformRoutes),
    { path: "/:pathMatch(.*)*", name: "not-found", component: HomePage },
  ],
});

router.beforeEach((to, from) => {
  if (from.name) rememberScrollPosition(from.fullPath);
  if (usesCustomDomain && to.name === "not-found")
    return { path: "/", query: to.query, hash: to.hash, replace: true };
});
