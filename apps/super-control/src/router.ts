import { createRouter, createWebHistory } from "vue-router";
import AppShell from "./components/AppShell.vue";
import DashboardView from "./views/DashboardView.vue";
import BusinessesView from "./views/BusinessesView.vue";
import BusinessDetailView from "./views/BusinessDetailView.vue";
import RegisterBusinessView from "./views/RegisterBusinessView.vue";
import SubscriptionPlansView from "./views/SubscriptionPlansView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: AppShell,
      children: [
        { path: "", component: DashboardView },
        { path: "businesses", component: BusinessesView },
        { path: "businesses/new", component: RegisterBusinessView },
        { path: "businesses/:id", component: BusinessDetailView },
        { path: "subscription-plans", component: SubscriptionPlansView },
      ],
    },
  ],
});
