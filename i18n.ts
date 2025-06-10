import { createI18n } from 'vue-i18n';
import { getItem } from '@/services/storage-service';
import en from '@/locales/en.json';
import kh from '@/locales/kh.json';

// Define translations
 
const messages = {
  en: en,
  kh:  kh
};

// Create Vue I18n instance
const i18n = createI18n({
  legacy: false, // Required for Vue 3 Composition API
  locale: getItem("lang") || "kh", // Default locale
  fallbackLocale: 'kh', // Fallback locale
  messages,
});

export default i18n;
