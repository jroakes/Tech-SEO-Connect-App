// Admin: who's an admin, the event export, the user actions' guard, and the
// analytics page's numbers.
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { GET as exportEvents } from "@/pages/api/admin/events";
import { POST as userAction } from "@/pages/api/admin/users";
import { GET as me } from "@/pages/api/me";
import { insertEvents, type EventRecord } from "@/lib/db";
import { getInsights } from "@/lib/insights";
import { fallbackSchedule } from "@/data/schedule";
import placesData from "@/data/places.json";
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
    expect(csv.headers.get("Content-Disposition")).toMatch(/tech-seo-connect-events-\d{4}-\d{2}-\d{2}\.csv/);
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
      // Ann saved Logs on her phone before signing in there; signing in put it in her account.
      event("session_save", { session_id: "t1", title: "Logs", speaker: "Ann" }, { anonId: "b", ts: now - 120_000 }),
      // A page that couldn't store saves keeps them only while it's open.
      event("session_save", { session_id: "t1", title: "Logs", speaker: "Ann" }, { anonId: "no-storage" }),
      event("mcp_tool_call", { tool: "search_sessions", query: "Crawl" }, server("ann")),
      event("mcp_tool_call", { tool: "find_people_to_meet", topic: "BigQuery" }, server("ann")),
      event("match_join", { topics: "bigquery" }, server("ann")),
      event("match_topic_open", { topic: "bigquery" }),
      event("match_linkedin_click", { topic: "bigquery" }),
      event("page_view", undefined, { anonId: "old", ts: now - 10 * 86_400_000 }),
      // An organizer on the admin pages isn't an attendee.
      event("page_view", undefined, { anonId: "organizer", userId: "admin1", path: "/admin/analytics" }),
      event("admin_action", { action: "block", target_user_id: "bob" }, { ...server("admin1"), path: "/admin" }),
      event("mcp_tool_call", { tool: "search_sessions", query: "Solís" }, server("ann")),
      event("mcp_tool_call", { tool: "search_sessions", query: "solis" }, server("ann")),
    ]);
    // Ann's account also has a talk and a place she saved without a tap being
    // logged (on a device that synced them, or before events were logged).
    const talk = fallbackSchedule.find((s) => !s.isBreak)!;
    const place = placesData[0];
    await env.DB.batch([
      env.DB.prepare("INSERT INTO profiles (user_id, name, topics, linkedin) VALUES ('ann', 'Ann', '[\"bigquery\"]', 'https://www.linkedin.com/in/ann')"),
      env.DB.prepare("INSERT INTO check_ins (guest_id, demo, name, walk_in) VALUES ('g1', 1, 'A', 0), ('walkin-1', 1, 'B', 1), ('g2', 0, 'C', 0)"),
      env.DB.prepare("INSERT INTO guest_list (event_id, guests, synced_at) VALUES ('evt-test', '[{},{},{},{}]', 0)"),
      env.DB.prepare("INSERT INTO saved_sessions (user_id, session_id) VALUES ('ann', 't1'), ('ann', ?)").bind(talk.id),
      env.DB.prepare("INSERT INTO saved_places (user_id, place_id) VALUES ('ann', ?)").bind(place.id),
    ]);

    const week = await getInsights(env.DB, "7d", true);
    // The organizer isn't a signed-in attendee; save taps count every tap.
    expect(week.totals).toMatchObject({ visitors: 2, pageViews: 3, signedIn: 1, directions: 2, talkSaves: 4, placeSaves: 1, aiRequests: 4 });
    expect(week.directionsByApp).toEqual({ google: 1, apple: 1 });
    // Saved now: device-1's Logs (saved twice, removed once) and Ann's account
    // (Logs once, though her phone logged a save too, and the other talk).
    expect(week.talks).toEqual([
      { title: "Logs", speaker: "Ann", saves: 2 },
      { title: talk.title, speaker: talk.speaker ?? null, saves: 1 },
    ]);
    expect(week.places).toEqual([
      { name: "Cafe", category: "Coffee", views: 1, directions: 2, saves: 1 },
      { name: place.name, category: place.category, views: 0, directions: 0, saves: 1 },
    ]);
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
    expect(week.meet).toMatchObject({ people: 1, withLinkedin: 1, joins: 1, topicOpens: 1, linkedinTaps: 1 });
    expect(week.meet.topics).toEqual([{ topic: "bigquery", label: "BigQuery", people: 1, opens: 1, taps: 1 }]);
    expect(week.checkIn).toEqual({ checkedIn: 2, walkIns: 1, guests: 4 });

    expect((await getInsights(env.DB, "7d", false)).checkIn).toEqual({ checkedIn: 1, walkIns: 0, guests: 4 });
    expect((await getInsights(env.DB, "all", true)).totals.pageViews).toBe(4);
    // What's saved now doesn't depend on the range.
    expect((await getInsights(env.DB, "24h", true)).talks).toEqual(week.talks);
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
