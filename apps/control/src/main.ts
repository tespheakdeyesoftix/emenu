import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import "./style.css";

const handoff = new URLSearchParams(location.hash.slice(1)).get("auth");
if (handoff && /^[a-f0-9]{64}$/i.test(handoff)) {
  localStorage.setItem("mf_token", handoff);
  history.replaceState({}, "", `${location.pathname}${location.search}`);
}

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");
