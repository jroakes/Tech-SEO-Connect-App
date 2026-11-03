// Admin: who's an admin, the event export, the user actions' guard, and the
// analytics page's numbers.
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { GET as exportEvents } from "@/pages/api/admin/events";
import { POST as userAction } from "@/pages/api/admin/users";
import { GET as me } from "@/pages/api/me";
import { insertEvents, type EventRecord } from "@/lib/db";
import { getInsights } from "@/lib/insights";
import { call } from "./helpers";

vi.mock("@/lib/clerk", () => import("./fake-clerk"));

const now = Date.now();
const event = (type: string, props?: Record<string, unknown>, extra: Partial<EventRecord> = {}): EventRecord => ({ type, ts: now - 60_000, anonId: "device-1", path: "/schedule", props, ...extra });

describe("admin", () => {
  it("tells the account menu who's an admin", async () => {
    expect((await call(me)).status).toBe(401);
    expect((await call(me, { user: "attendee" })).data).toEqual({ admin: false });
    expect((await call(me, { user: "admin1" })).data).toEqual({ admin: true });
  });

  it("guards the user actions", async () => {
    expect((await call(userAction, { method: "POST", user: "attendee", body: { userId: "x", action: "block" } })).status).toBe(403);
  });

  it("removes a blocked user's Meet answers", async () => {
    await env.DB.prepare("INSERT INTO profiles (user_id, name, topics) VALUES ('bob', 'Bob', '[\"python\"]')").run();
    const res = await call(userAction, { method: "POST", user: "admin1", body: { userId: "bob", action: "block" } });
    expect(res.data.user).toMatchObject({ id: "bob", banned: true });
    expect(await env.DB.prepare("SELECT * FROM profiles WHERE user_id = 'bob'").first()).toBeNull();
  });

  it("exports every event as CSV or JSON, for admins only", async () => {
    await insertEvents(env.DB, [event("page_view"), event("place_save", { place_id: "cafe", place_name: 'Joe\'s "Best", Coffee' })]);
    expect((await call(exportEvents, { path: "/api/admin/events" })).status).toBe(401);
    expect((await call(exportEvents, { path: "/api/admin/events", user: "attendee" })).status).toBe(403);

    const csv = await call(exportEvents, { path: "/api/admin/events?format=csv", user: "admin1" });
    expect(csv.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(csv.headers.get("Content-Disposition")).toMatch(/tech-seo-connect-app-events-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = (csv.data as string).trim().split("\r\n");
    expect(lines[0]).toBe("id,ts,type,anon_id,user_id,path,props");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('"{""place_id"":""cafe"",""place_name"":""Joe\'s \\""Best\\"", Coffee""}"');

    const asJson = await call(exportEvents, { path: "/api/admin/events?format=json", user: "admin1" });
    expect(asJson.data).toHaveLength(2);
    expect(asJson.data[1].props).toEqual({ place_id: "cafe", place_name: 'Joe\'s "Best", Coffee' });
  });
});

describe("analytics", () => {
  it("adds up what attendees did", async () => {
    // The server logs these, so they have no device ID.
    const server = (userId: string) => ({ anonId: undefined, userId });
    await insertEvents(env.DB, [
      event("page_view", undefined, { anonId: "a" }),
      event("page_view", undefined, { anonId: "a", path: "/map" }),
      event("page_view", undefined, { anonId: "b", userId: "ann" }),
      event("map_button_click", { map_type: "google_maps", place_id: "cafe", place_name: "Cafe", category: "Coffee" }),
      event("map_button_click", { map_type: "apple_maps", place_id: "cafe", place_name: "Cafe", category: "Coffee" }),
      event("place_view", { place_id: "cafe", place_name: "Cafe", category: "Coffee" }),
      event("place_save", { place_id: "cafe", place_name: "Cafe", category: "Coffee" }),
      event("session_save", { session_id: "t1", title: "Logs", speaker: "Ann" }),
      event("session_save", { session_id: "t1", title: "Logs", speaker: "Ann" }),
      event("session_unsave", { session_id: "t1", title: "Logs", speaker: "Ann" }),
      event("mcp_tool_call", { tool: "search_sessions", query: "Crawl" }, server("ann")),
      event("mcp_tool_call", { tool: "find_people_to_meet", topic: "BigQuery" }, server("ann")),
      event("match_join", { topics: "bigquery", topic_count: 1, linkedin: true }, server("ann")),
      // Bob joins and is then blocked; Cy joins and leaves. Neither is on Meet now.
      event("match_join", { topics: "bigquery,python", topic_count: 2, linkedin: false }, server("bob")),
      event("match_join", { topics: "python", topic_count: 1, linkedin: false }, server("cy")),
      event("match_leave", undefined, server("cy")),
      event("match_topic_open", { topic: "bigquery" }),
      event("match_linkedin_click", { topic: "bigquery" }),
      event("page_view", undefined, { anonId: "old", ts: now - 10 * 86_400_000 }),
      // An organizer on the admin pages isn't an attendee.
      event("page_view", undefined, { anonId: "organizer", userId: "admin1", path: "/admin/analytics" }),
      event("admin_action", { action: "block", target_user_id: "bob" }, { ...server("admin1"), path: "/admin" }),
      event("mcp_tool_call", { tool: "search_sessions", query: "Solís" }, server("ann")),
      event("mcp_tool_call", { tool: "search_sessions", query: "solis" }, server("ann")),
    ]);

    // The check-in desk's events: g3's check-in was undone.
    const desk = (type: string, guestId: string, demo: boolean, walkIn = false) =>
      event(type, { guest_id: guestId, demo, walk_in: walkIn }, { ...server("admin1"), path: "/admin/check-in" });
    await insertEvents(env.DB, [
      desk("check_in", "g1", true),
      desk("check_in", "walkin-1", true, true),
      desk("check_in", "g3", true),
      desk("check_in_undo", "g3", true),
      desk("check_in", "g2", false),
      event("guest_list_sync", { guests: 3 }, { anonId: undefined, path: "/admin/check-in" }),
      event("guest_list_sync", { guests: 4 }, { anonId: undefined, path: "/admin/check-in" }),
    ]);

    const week = await getInsights(env.DB, "7d", true);
    // Ann, Bob and Cy; the organizer at the admin pages and check-in desk isn't an attendee.
    expect(week.totals).toMatchObject({ visitors: 2, pageViews: 3, signedIn: 3, directions: 2, talkSaves: 2, placeSaves: 1, aiRequests: 4 });
    expect(week.directionsByApp).toEqual({ google: 1, apple: 1 });
    // Every save counts; un-saves aren't taken off.
    expect(week.talks).toEqual([{ title: "Logs", speaker: "Ann", saves: 2 }]);
    expect(week.places).toEqual([{ name: "Cafe", category: "Coffee", views: 1, directions: 2, saves: 1 }]);
    expect(week.pages).toEqual([
      { path: "/schedule", views: 2 },
      { path: "/map", views: 1 },
    ]);
    expect(week.aiTools.map((t) => t.tool).sort()).toEqual(["find_people_to_meet", "search_sessions"]);
    expect(week.aiSearches).toEqual([
      { query: "solis", count: 2 },
      { query: "bigquery", count: 1 },
      { query: "crawl", count: 1 },
    ]);
    expect(week.meet).toMatchObject({ people: 1, withLinkedin: 1, joins: 3, leaves: 1, topicOpens: 1, linkedinTaps: 1 });
    expect(week.meet.topics).toEqual([{ topic: "bigquery", label: "BigQuery", people: 1, opens: 1, taps: 1 }]);
    expect(week.checkIn).toEqual({ checkedIn: 2, walkIns: 1, guests: 4 });

    expect((await getInsights(env.DB, "7d", false)).checkIn).toEqual({ checkedIn: 1, walkIns: 0, guests: 4 });
    expect((await getInsights(env.DB, "all", true)).totals.pageViews).toBe(4);
  });

  it("counts page views by Eastern day and hour across the end of daylight saving time", async () => {
    // Daylight saving time ended at 2 AM on Sunday, Nov 1, 2026.
    const at = (iso: string) => event("page_view", undefined, { ts: Date.parse(iso) });
    await insertEvents(env.DB, [
      at("2026-10-31T04:30:00Z"), // 12:30 AM Saturday, EDT
      at("2026-11-02T04:30:00Z"), // 11:30 PM Sunday, EST
      at("2026-11-03T14:10:00Z"), // 9:10 AM Tuesday, EST
    ]);
    const week = await getInsights(env.DB, "7d", true, new Date("2026-11-03T15:00:00Z"));
    expect(week.activity.map((d) => `${d.label} ${d.value}`)).toEqual(["Oct 28 0", "Oct 29 0", "Oct 30 0", "Oct 31 1", "Nov 1 1", "Nov 2 0", "Nov 3 1"]);

    const day = await getInsights(env.DB, "24h", true, new Date("2026-11-03T15:00:00Z"));
    expect(day.activity).toHaveLength(24);
    expect(day.activity.at(-1)).toMatchObject({ label: "10 AM", value: 0 });
    expect(day.activity.at(-2)).toMatchObject({ label: "9 AM", value: 1, tooltip: "Tue, Nov 3, 9 AM: 1 page view" });
  });
});
