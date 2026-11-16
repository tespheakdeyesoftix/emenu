import { createI18n } from "vue-i18n";
import en from "./locales/en.json";
import km from "./locales/km.json";

export type ControlLocale = "en" | "km";

export const CONTROL_LOCALE_KEY = "angkor_emenu_control_language";

const savedLocale = localStorage.getItem(CONTROL_LOCALE_KEY);
const initialLocale: ControlLocale = savedLocale === "en" ? "en" : "km";

document.documentElement.lang = initialLocale;

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: "km",
  messages: { en, km },
});
