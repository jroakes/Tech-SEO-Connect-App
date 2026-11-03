// Browser tests (tests/e2e): every page, as a visitor would use it, on a phone
// and a desktop. They build the app with fake accounts instead of Clerk
// (FAKE_AUTH=1, tests/fake-auth), so a test can sign in as anyone, and run it
// locally with Wrangler, with the keys in .env, a local D1 of their own
// (.wrangler/e2e, which starts empty so the bundled schedule shows) and a
// stand-in for Luma with fictional guests (tests/e2e/fake-luma.mjs). They use
// the installed Google Chrome, with a fresh profile.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
const FAKE_LUMA_PORT = 8799;

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
  webServer: [
    {
      command: "node tests/e2e/fake-luma.mjs",
      url: `http://127.0.0.1:${FAKE_LUMA_PORT}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e && FAKE_AUTH=1 npx astro build && npx wrangler dev --port ${PORT} --persist-to .wrangler/e2e --var LUMA_API_URL:http://127.0.0.1:${FAKE_LUMA_PORT}`,
      url: `http://localhost:${PORT}/schedule`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
