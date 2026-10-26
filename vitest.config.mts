import path from "node:path";
import { defineConfig } from "vitest/config";

// Minimal vitest setup (Phase 16 — testing). No React/DOM test runner is
// configured yet since the tests introduced in this phase are all pure
// function / data-layer tests (validation, normalization, metrics, AI
// schema validation). Add `environment: "jsdom"` + `@testing-library/react`
// in a later phase if/when component tests are needed.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
