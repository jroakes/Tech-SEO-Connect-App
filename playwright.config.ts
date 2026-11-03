// Browser tests (tests/e2e): every page, as a visitor would use it, on a phone
// and a desktop. They build the app and run it locally with Wrangler (local D1,
// the keys in .env). They use the installed Google Chrome, with a fresh profile.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `npm run db:migrate:local && npx astro build && npx wrangler dev --port ${PORT}`,
    url: `http://localhost:${PORT}/schedule`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
