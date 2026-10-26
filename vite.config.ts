import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
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
  build: {
    rollupOptions: {
      // The service worker is its own entry, served at the root so its scope is the whole app.
      input: { index: path.resolve(import.meta.dirname, "index.html"), sw: path.resolve(import.meta.dirname, "src/sw.ts") },
      output: { entryFileNames: (chunk: { name: string }) => (chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js") },
    },
  },
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
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations(path.resolve(import.meta.dirname, "worker/migrations")),
                PASSWORD_PEPPER: "test-pepper",
                TURNSTILE_SECRET_KEY: "test-turnstile",
                RESEND_API_KEY: "test-resend",
                GOOGLE_CLIENT_ID: "test-client",
                GOOGLE_CLIENT_SECRET: "test-secret",
                HUNT_JURISDICTION: "",
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
          setupFiles: ["./worker/test/apply-migrations.ts"],
        },
      },
    ],
  },
}));
