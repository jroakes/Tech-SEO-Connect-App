// Meet: joining with topics and LinkedIn, changing answers, leaving, and who
// can see whom.
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { GET as matches } from "@/pages/api/matches";
import { DELETE, GET, PUT } from "@/pages/api/profile";
import { call, rows } from "./helpers";

vi.mock("@/lib/clerk", () => import("./fake-clerk"));

const join = (user: string, answers: Record<string, unknown>) => call(PUT, { method: "PUT", user, body: { name: `Name ${user}`, ...answers } });
const meetEvents = () => rows<{ type: string; user_id: string; props: string | null }>(env.DB, "SELECT type, user_id, props FROM events ORDER BY id");

describe("Meet", () => {
  it("needs sign-in", async () => {
    expect((await call(GET)).status).toBe(401);
    expect((await call(PUT, { method: "PUT", body: {} })).status).toBe(401);
    expect((await call(DELETE, { method: "DELETE" })).status).toBe(401);
    expect((await call(matches)).status).toBe(401);
  });

  it("suggests the account's name before joining", async () => {
    expect((await call(GET, { user: "ann" })).data).toEqual({ profile: null, suggestedName: "Test ann" });
  });

  it("joins, changes answers and leaves, logging each", async () => {
    const joined = await join("ann", { title: "SEO Lead", topics: ["bigquery", "python"], linkedin: "annsmith" });
    expect(joined.status).toBe(200);
    expect(joined.data.profile).toMatchObject({ name: "Name ann", title: "SEO Lead", topics: ["bigquery", "python"], linkedin: "https://www.linkedin.com/in/annsmith" });
    expect((await call(GET, { user: "ann" })).data.profile.topics).toEqual(["bigquery", "python"]);

    await join("ann", { topics: ["local"] });
    expect((await call(GET, { user: "ann" })).data.profile).toMatchObject({ topics: ["local"], linkedin: null });

    expect((await call(DELETE, { method: "DELETE", user: "ann" })).status).toBe(204);
    expect((await call(GET, { user: "ann" })).data.profile).toBeNull();

    const events = await meetEvents();
    expect(events.map((e) => e.type)).toEqual(["match_join", "match_update", "match_leave"]);
    expect(JSON.parse(events[0].props!)).toEqual({ topics: "bigquery,python", topic_count: 2, linkedin: true });
  });

  it("checks the answers", async () => {
    expect((await join("ann", { topics: [] })).status).toBe(400);
    expect((await join("ann", { topics: ["bigquery", "python", "local", "careers"] })).status).toBe(400);
    expect((await join("ann", { topics: ["not-a-topic"] })).status).toBe(400);
    expect((await join("ann", { topics: ["bigquery"], linkedin: "https://twitter.com/ann" })).status).toBe(400);
    expect((await call(PUT, { method: "PUT", user: "ann", body: { name: " ", topics: ["bigquery"] } })).status).toBe(400);
    expect(await meetEvents()).toEqual([]);
  });

  it("shows only people who share your topics, and only once you've joined", async () => {
    expect((await call(matches, { user: "ann" })).status).toBe(403);

    await join("ann", { topics: ["bigquery", "python"] });
    await join("bob", { topics: ["python"], linkedin: "bob" });
    await join("cat", { topics: ["local"] });
    await join("dan", { topics: ["bigquery", "local"] });

    const { status, data } = await call(matches, { user: "ann" });
    expect(status).toBe(200);
    expect(data.me.userId).toBe("ann");
    expect(data.others.map((p: { userId: string }) => p.userId).sort()).toEqual(["bob", "dan"]);
    const count = (topic: string) => data.counts.find((c: { topic: string }) => c.topic === topic).count;
    expect([count("bigquery"), count("python"), count("local"), count("careers")]).toEqual([2, 2, 2, 0]);
  });
});
