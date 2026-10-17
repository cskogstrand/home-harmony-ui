import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: { "/api/config": "http://127.0.0.1:8099" },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), {
    name: "production-script-policy",
    apply: "build",
    // Vite's development preamble uses inline scripts; production uses self-hosted modules.
    transformIndexHtml: () => [{ tag: "meta", attrs: {
      "http-equiv": "Content-Security-Policy",
      content: "script-src 'self'; object-src 'none'; base-uri 'self'",
    }, injectTo: "head-prepend" }],
  }],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
