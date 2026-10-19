import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { runtimeOptions } from "./server/runtime.mjs";
import { dashboardAccess, attachHomeAssistantSocket } from "./server/home-assistant.mjs";
import { createAppHandler } from "./server/app.mjs";

async function configurationMiddleware(server: import("vite").ViteDevServer | import("vite").PreviewServer) {
  const options = await runtimeOptions();
  const handler = await createAppHandler({ ...options, distDir: path.resolve("public") });
  const authorize = dashboardAccess(options.dashboardPassword, options.dashboardAuthDisabled);
  if ("fs" in server.config.server) server.config.server.fs.deny.push(`${normalizePath(options.dataDir)}/**`);
  const closeSockets = attachHomeAssistantSocket(server.httpServer, options);
  server.httpServer.once("close", closeSockets);
  server.middlewares.use((request, response, next) => {
    if (request.url?.startsWith("/api/")) { void handler(request, response); return; }
    try { authorize(request); next(); }
    catch (error) {
      response.writeHead(error.status ?? 403, { "WWW-Authenticate": 'Basic realm="Home Harmony", charset="UTF-8"', "Cache-Control": "no-store" });
      response.end("Dashboard authentication required.");
    }
  });
}

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Keep Vite's default exclusions and protect household data from direct file requests.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.data/**", "**/data/**", `${normalizePath(path.resolve(process.env.DATA_DIR ?? "data"))}/**`],
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
