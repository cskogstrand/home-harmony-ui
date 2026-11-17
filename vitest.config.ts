import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Use jsdom storage instead of Node's file-backed Web Storage.
    execArgv: ["--no-experimental-webstorage"],
    // Concurrent app renders compete with cold route imports on busy machines.
    maxWorkers: 2,
    testTimeout: 15_000,
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
