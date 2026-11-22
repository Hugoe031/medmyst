import { defineConfig } from "@playwright/test";

// Use a dedicated port so the suite never collides with a locally running dev
// server (or anything else that happens to own 5173).
const PORT = Number(process.env.E2E_PORT) || 5199;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    browserName: "chromium",
    // Phone-sized viewport matches the app's primary form factor.
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    env: { PORT: String(PORT) },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
