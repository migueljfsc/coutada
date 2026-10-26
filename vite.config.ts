import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import path from "node:path";
import type { Plugin } from "vite";
import { headersFile, SECURITY_HEADERS } from "./worker/lib/headers.ts";

/** Writes `_headers` into the build, so static assets carry the Worker's security headers. */
function securityHeaders(): Plugin {
  return {
    name: "security-headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: headersFile(SECURITY_HEADERS) });
    },
  };
}

const alias = { "@": path.resolve(import.meta.dirname, "./src") };

export default defineConfig(() => ({
  plugins: [react(), securityHeaders()],
  resolve: { alias },
  server: {
    port: 5173,
  },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "app",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
        },
      },
    ],
  },
}));
