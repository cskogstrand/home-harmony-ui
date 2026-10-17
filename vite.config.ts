import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createAppHandler } from "./server/app.mjs";

async function configurationMiddleware(server: import("vite").ViteDevServer | import("vite").PreviewServer) {
  if (server.config.mode === "browser") return;
  const handler = await createAppHandler({
    dataDir: path.resolve(process.env.DATA_DIR ?? ".data"),
    distDir: path.resolve("public"),
    homeAssistantUrl: process.env.HOME_ASSISTANT_URL ?? "http://homeassistant.local:8123",
  });
  server.middlewares.use((request, response, next) => {
    if (request.url?.startsWith("/api/")) void handler(request, response);
    else next();
  });
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Keep Vite's default exclusions and protect household data from direct file requests.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.data/**", `${normalizePath(path.resolve(process.env.DATA_DIR ?? ".data"))}/**`],
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), {
    name: "persistent-configuration",
    configureServer: configurationMiddleware,
    configurePreviewServer: configurationMiddleware,
  }, {
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
