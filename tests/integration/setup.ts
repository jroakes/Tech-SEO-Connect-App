// Before each test: the schema, and empty tables.
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, vi } from "vitest";

const TABLES = ["sessions", "sync_runs", "saved_sessions", "saved_places", "events", "profiles", "meet_topics", "guest_list", "check_ins", "settings"];

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

beforeEach(async () => {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});

afterEach(() => {
  vi.restoreAllMocks();
});
