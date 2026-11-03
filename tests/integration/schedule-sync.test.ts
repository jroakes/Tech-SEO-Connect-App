// The hourly cron that copies the schedule from www.techseoconnect.com into D1.
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { fallbackSchedule } from "@/data/schedule";
import fixture from "@/lib/__fixtures__/main-site-schedule.html?raw";
import { getSchedule } from "@/lib/db";
import { parseMainSiteSchedule } from "@/lib/schedule-parse";
import { syncSchedule } from "@/lib/schedule-sync";
import { assignSessionIds } from "@/lib/sessions";
import { rows } from "./helpers";

const mainSite = (body: string, status = 200) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status }));
const lastRun = async () => (await rows<{ status: string; session_count: number; message: string }>(env.DB, "SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1"))[0];

describe("schedule sync", () => {
  it("shows the bundled schedule until the first sync", async () => {
    expect(await getSchedule(env.DB)).toEqual(fallbackSchedule);
  });

  it("copies the main site's schedule into D1", async () => {
    const fetch = mainSite(fixture);
    await syncSchedule(env);
    expect(fetch).toHaveBeenCalledWith("https://www.techseoconnect.com/", expect.anything());

    // Exactly what the parser reads from the page, in order, with stable IDs.
    const sessions = await getSchedule(env.DB);
    expect(sessions).toEqual(assignSessionIds(parseMainSiteSchedule(fixture).sessions));
    expect(sessions.filter((s) => !s.isBreak).length).toBeGreaterThanOrEqual(5);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(sessions.length);
    expect(await lastRun()).toMatchObject({ status: "ok", session_count: sessions.length });
  });

  it("keeps the current schedule when the page has too few talks", async () => {
    mainSite(fixture);
    await syncSchedule(env);
    const before = await getSchedule(env.DB);

    mainSite("<html><body>Coming soon</body></html>");
    await syncSchedule(env);
    expect(await getSchedule(env.DB)).toEqual(before);
    expect(await lastRun()).toMatchObject({ status: "error" });
    expect((await lastRun()).message).toMatch(/kept the current schedule/);
  });

  it("keeps the current schedule when the main site is down", async () => {
    mainSite(fixture);
    await syncSchedule(env);
    const before = await getSchedule(env.DB);

    mainSite("Server error", 503);
    await syncSchedule(env);
    expect(await getSchedule(env.DB)).toEqual(before);
    expect((await lastRun()).message).toMatch(/HTTP 503/);
  });
});
