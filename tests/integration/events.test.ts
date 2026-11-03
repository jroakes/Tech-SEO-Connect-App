// The first-party event log: what the browser sends to /api/events.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { POST } from "@/pages/api/events";
import { CLIENT_EVENT_TYPES } from "@/lib/events";
import { call, rows } from "./helpers";

const send = (body: unknown, user?: string) => call(POST, { method: "POST", body, user });

describe("/api/events", () => {
  it("stores every kind of event the pages log, with the device and the signed-in user", async () => {
    const events = CLIENT_EVENT_TYPES.map((type) => ({ type, path: "/schedule", props: { place_id: "cafe", topic: "bigquery" } }));
    expect((await send({ anonId: "device-1", events }, "ann")).status).toBe(204);

    const stored = await rows<{ type: string; anon_id: string; user_id: string; path: string; props: string }>(env.DB, "SELECT * FROM events ORDER BY id");
    expect(stored.map((e) => e.type)).toEqual([...CLIENT_EVENT_TYPES]);
    expect(stored.every((e) => e.anon_id === "device-1" && e.user_id === "ann" && e.path === "/schedule")).toBe(true);
    expect(JSON.parse(stored[0].props)).toEqual({ place_id: "cafe", topic: "bigquery" });
  });

  it("stores events from signed-out visitors without a user", async () => {
    await send({ anonId: "device-2", events: [{ type: "page_view", path: "/map" }] });
    expect((await rows<{ user_id: string | null }>(env.DB, "SELECT user_id FROM events"))[0].user_id).toBeNull();
  });

  it("uses the server's clock when the browser's is more than a day off", async () => {
    await send({ events: [{ type: "page_view", ts: Date.now() - 3 * 86_400_000 }] });
    const [{ ts }] = await rows<{ ts: string }>(env.DB, "SELECT ts FROM events");
    expect(Math.abs(Date.parse(ts) - Date.now())).toBeLessThan(60_000);
  });

  it("refuses what the server logs itself, bad batches and oversized bodies", async () => {
    expect((await send({ events: [{ type: "admin_action" }] })).status).toBe(400);
    expect((await send({ events: [{ type: "match_join" }] })).status).toBe(400);
    expect((await send({ events: [] })).status).toBe(400);
    expect((await send({ events: Array.from({ length: 26 }, () => ({ type: "page_view" })) })).status).toBe(400);
    expect((await send("not json")).status).toBe(400);
    expect((await send({ events: [{ type: "page_view", path: "x".repeat(40_000) }] })).status).toBe(413);
    expect(await rows(env.DB, "SELECT * FROM events")).toEqual([]);
  });
});
