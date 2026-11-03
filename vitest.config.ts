// Two kinds of tests:
// - unit (src/**/*.test.ts): pure logic, in Node.
// - integration (tests/integration): the API routes, the MCP server, the cron
//   jobs and the analytics queries, run inside workerd (Cloudflare's runtime)
//   against a real local D1 database. Clerk, Luma and the AI are stubbed.
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname, "src") };

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.resolve(import.meta.dirname, "migrations"));
  return {
    test: {
      projects: [
        {
          resolve: { alias },
          test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
        },
        {
          resolve: { alias },
          plugins: [
            cloudflareTest({
              miniflare: {
                // The newest date the test runner's workerd supports (the app uses 2026-10-01).
                compatibilityDate: "2026-08-22",
                compatibilityFlags: ["nodejs_compat"],
                d1Databases: ["DB"],
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  SCHEDULE_SOURCE_URL: "https://www.techseoconnect.com/",
                  ORGANIZER_EMAILS: "organizer@example.com",
                  LUMA_EVENT_ID: "evt-test",
                  CHECK_IN_DEMO: "true",
                  LUMA_API_KEY: "test-luma-key",
                  OPENROUTER_API_KEY: "test-openrouter-key",
                },
              },
            }),
          ],
          test: {
            name: "integration",
            include: ["tests/integration/**/*.test.ts"],
            setupFiles: ["tests/integration/setup.ts"],
          },
        },
      ],
    },
  };
});
