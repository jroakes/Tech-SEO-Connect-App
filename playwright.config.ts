// Browser tests (tests/e2e): every page, as a visitor would use it, on a phone
// and a desktop. They build the app and run it locally with Wrangler, with the
// keys in .env and a local D1 of their own (.wrangler/e2e), which starts empty
// so the bundled schedule shows. They use the installed Google Chrome, with a
// fresh profile.
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
    command: `npx wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e && npx astro build && npx wrangler dev --port ${PORT} --persist-to .wrangler/e2e`,
    url: `http://localhost:${PORT}/schedule`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
