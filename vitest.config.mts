import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run in Node against the pure domain layer (parsers, classification,
// analysis, reconciliation). Anything that needs a browser — PDF.js, IndexedDB,
// the React steps — is exercised through Playwright instead.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
