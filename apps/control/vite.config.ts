import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import frappeui from "frappe-ui/vite";

export default defineConfig({
  // Frappe UI ships Vue and TypeScript source. Let Vite transform it before serving it.
  optimizeDeps: { exclude: ["frappe-ui"] },
  plugins: [
    frappeui({ frappeProxy: false, jinjaBootData: false, buildConfig: false }),
    vue(),
  ],
});
