import { defineConfig, devices } from "@playwright/test";

// Browser tests for the parts of the analyzer that only exist in a browser:
// PDF.js text extraction, IndexedDB persistence and the React workflow.
// The pure domain layer is covered by Vitest (npm test).
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The sandbox ships a pinned Chromium that may not match this
        // @playwright/test version's expected build. Point at it directly
        // rather than downloading a second browser.
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        },
      },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
