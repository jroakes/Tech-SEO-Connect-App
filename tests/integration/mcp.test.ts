// The MCP server an attendee adds to Claude or another assistant.
import { createExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { mcpHandlerFor } from "@/mcp/server";
import { rows } from "./helpers";

let id = 0;
async function rpc(user: string, method: string, params: unknown = {}) {
  const request = new Request("https://app.test/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const res = await mcpHandlerFor(user)(request, env, createExecutionContext());
  const text = await res.text();
  // The answer comes as JSON or as a server-sent event.
  const body = text.trimStart().startsWith("{") ? text : text.split("\n").find((l) => l.startsWith("data:"))!.slice(5);
  return JSON.parse(body);
}
const tool = async (user: string, name: string, args: Record<string, unknown> = {}) => {
  const { result } = await rpc(user, "tools/call", { name, arguments: args });
  const text: string = result.content[0].text;
  return text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text;
};
const join = (user: string, name: string, topics: string[]) =>
  env.DB.prepare("INSERT INTO profiles (user_id, name, title, topics, linkedin) VALUES (?, ?, 'SEO', ?, ?)").bind(user, name, JSON.stringify(topics), `https://www.linkedin.com/in/${user}`).run();

describe("MCP server", () => {
  it("lists every tool", async () => {
    const { result } = await rpc("ann", "tools/list");
    expect(result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      [
        "find_people_to_meet",
        "find_places",
        "get_event_info",
        "get_meet_topics",
        "get_my_conference",
        "get_schedule",
        "list_sponsors",
        "remove_from_my_conference",
        "save_to_my_conference",
        "search_sessions",
      ].sort(),
    );
  });

  it("finds talks and places without minding accents", async () => {
    expect((await tool("ann", "search_sessions", { query: "Solis" }))[0].speaker).toBe("Aleyda Solís");
  });

  it("answers about the conference, talks, places and sponsors", async () => {
    expect(await tool("ann", "get_event_info")).toMatchObject({ name: "Tech SEO Connect", city: "Durham, NC" });
    const talks = await tool("ann", "search_sessions", { query: "log" });
    expect(talks.length).toBeGreaterThan(0);
    expect((await tool("ann", "get_schedule", { date: talks[0].date })).some((t: { id: string }) => t.id === talks[0].id)).toBe(true);
    expect((await tool("ann", "find_places", { query: "Alimentari" }))[0].name).toBe("Alimentari at Mothers & Sons");
    expect((await tool("ann", "list_sponsors")).length).toBeGreaterThan(5);
  });

  it("saves to and removes from My Conference, and logs it", async () => {
    const [talk] = await tool("ann", "search_sessions", { query: "log" });
    const [place] = await tool("ann", "find_places", { query: "Alimentari" });
    expect(await tool("ann", "save_to_my_conference", { kind: "talk", id: talk.id })).toMatch(/^Saved/);
    expect(await tool("ann", "save_to_my_conference", { kind: "place", id: place.id })).toMatch(/^Saved/);
    expect(await tool("ann", "save_to_my_conference", { kind: "talk", id: "no-such-talk" })).toMatch(/No talk has the id/);

    const mine = await tool("ann", "get_my_conference");
    expect(mine.talks.map((t: { id: string }) => t.id)).toEqual([talk.id]);
    expect(mine.places.map((p: { id: string }) => p.id)).toEqual([place.id]);
    expect((await tool("bob", "get_my_conference")).talks).toEqual([]);

    await tool("ann", "remove_from_my_conference", { kind: "talk", id: talk.id });
    expect((await tool("ann", "get_my_conference")).talks).toEqual([]);

    // Saving twice, or removing something that isn't saved, isn't logged again.
    expect(await tool("ann", "save_to_my_conference", { kind: "place", id: place.id })).toMatch(/already in My Conference/);
    expect(await tool("ann", "remove_from_my_conference", { kind: "talk", id: talk.id })).toMatch(/isn't in My Conference/);
    const types = (await rows<{ type: string }>(env.DB, "SELECT type FROM events WHERE user_id = 'ann' AND type != 'mcp_tool_call' ORDER BY id")).map((e) => e.type);
    expect(types).toEqual(["session_save", "place_save", "session_unsave"]);
  });

  it("shows Meet only to people who've joined, and only their topics", async () => {
    expect(await tool("ann", "get_meet_topics")).toMatch(/hasn't joined Meet/);
    expect(await tool("ann", "find_people_to_meet")).toMatch(/hasn't joined Meet/);

    await join("ann", "Ann", ["bigquery", "python"]);
    await join("bob", "Bob", ["python"]);
    await join("cat", "Cat", ["local"]);

    const topics = await tool("ann", "get_meet_topics");
    expect(topics.myAnswers.topics).toEqual(["BigQuery", "Python & automation"]);
    expect(topics.topics.find((t: { topic: string }) => t.topic === "Python & automation")).toEqual({ topic: "Python & automation", people: 2, mine: true });

    const people = await tool("ann", "find_people_to_meet");
    expect(people).toEqual([
      { topic: "BigQuery", people: [] },
      { topic: "Python & automation", people: [{ name: "Bob", title: "SEO", linkedin: "https://www.linkedin.com/in/bob", sharedTopics: ["Python & automation"] }] },
    ]);
    expect(await tool("ann", "find_people_to_meet", { topic: "Local SEO" })).toMatch(/only in the attendee's own topics/);
    expect(await tool("ann", "find_people_to_meet", { topic: "python & automation" })).toHaveLength(1);
  });
});
