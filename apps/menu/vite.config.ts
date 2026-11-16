import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const plugins = [vue()];
  if (mode !== "lan") return { plugins };

  const host = "192.168.10.179";
  const port = 5174;
  const publicProxy = { target: "http://127.0.0.1:8787", changeOrigin: true };

  return {
    plugins,
    define: {
      "import.meta.env.VITE_API_BASE_URL": "window.location.origin",
      "import.meta.env.VITE_PLATFORM_MENU_HOSTNAMES": JSON.stringify(host),
    },
    build: { outDir: ".wrangler/menu-lan" },
    preview: {
      host,
      port,
      strictPort: true,
      allowedHosts: ["la2023.aagj7.com"],
      proxy: {
        "^/api/public/domains/[a-z0-9.-]+/?(?:\\?|$)": publicProxy,
        "^/api/public/businesses/[a-z0-9-]+/(?:menu|orders(?:/ord_[a-f0-9]{32})?|table-context/[a-zA-Z0-9_-]+|analytics/events)/?(?:\\?|$)":
          publicProxy,
        "^/media/[a-zA-Z0-9_-]+/?(?:\\?|$)": publicProxy,
      },
    },
  };
});
