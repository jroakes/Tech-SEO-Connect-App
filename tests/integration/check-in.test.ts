// Check-in at the door, against a stand-in Luma guest list and AI.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/pages/api/admin/check-in";
import { call, rows } from "./helpers";

vi.mock("@/lib/clerk", () => import("./fake-clerk"));

interface LumaGuest {
  id: string;
  user_name: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  approval_status: string;
  event_tickets: { name: string; checked_in_at: string | null }[];
}
const guest = (id: string, first: string, last: string, extra: Partial<LumaGuest> = {}): LumaGuest => ({
  id,
  user_name: `${first} ${last}`,
  user_first_name: first,
  user_last_name: last,
  user_email: `${first}.${last}@example.com`.toLowerCase(),
  approval_status: "approved",
  event_tickets: [{ name: "General Admission", checked_in_at: null }],
  ...extra,
});

let luma: LumaGuest[]; // oldest registration first
const calls = { all: 0, newest: 0, ai: 0 };
// The stand-in AI: everyone who has a typed word in their name scores 90; one
// such candidate is "obvious".
type Judge = (typed: string, candidates: { id: string; name: string }[]) => { matches: { id: string; score: number }[]; obvious: string | null };
const usualJudge: Judge = (typed, candidates) => {
  const words = typed.toLowerCase().split(/\s+/);
  const matches = candidates.filter((c) => words.some((w) => c.name.toLowerCase().split(" ").some((n) => n.startsWith(w.slice(0, 3))))).map((c) => ({ id: c.id, score: 90 }));
  return { matches, obvious: matches.length === 1 ? matches[0].id : null };
};
let judge = usualJudge;
let aiDown = false;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  luma = [
    guest("g-ann", "Ann", "Lee"),
    guest("g-john1", "John", "Murch"),
    guest("g-john2", "John", "Sherrod"),
    guest("g-john3", "John", "Gilliam"),
    guest("g-kris1", "Kristen", "Rathman"),
    guest("g-kris2", "Kristen", "Rathman", { user_email: "kristen@work.com", event_tickets: [{ name: "Free", checked_in_at: null }] }),
    guest("g-live", "Lara", "Stream", { event_tickets: [{ name: "Livestream", checked_in_at: null }] }),
    guest("g-dec", "Dave", "Bell", { approval_status: "declined", event_tickets: [] }),
    ...["Lee", "Danita", "Mandy", "Alyssa", "Robert", "Jen", "Tom"].map((first, i) => guest(`g-smith${i}`, first, "Smith")),
  ];
  calls.all = calls.newest = calls.ai = 0;
  judge = usualJudge;
  aiDown = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "public-api.luma.com") {
      expect(url.searchParams.get("event_id")).toBe("evt-test");
      if (url.searchParams.get("sort_column") === "registered_at") {
        calls.newest++;
        return json({ entries: [...luma].reverse().slice(0, 50), has_more: false });
      }
      calls.all++;
      return json({ entries: luma, has_more: false });
    }
    if (url.hostname === "openrouter.ai") {
      calls.ai++;
      if (aiDown) return json({ error: { message: "Rate limit exceeded" } }, 429);
      const { typed, candidates } = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
      return json({ choices: [{ message: { content: JSON.stringify(judge(typed, candidates)) } }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

const desk = (body: Record<string, unknown>, user = "admin1") => call(POST, { method: "POST", user, body });
const search = async (query: string, single?: boolean) => (await desk({ action: "search", query, ...(single === false ? { single } : {}) })).data;
const names = (list: { name: string }[]) => list.map((g) => g.name);

describe("check-in", () => {
  it("is for admins only", async () => {
    expect((await call(POST, { method: "POST", body: { action: "search", query: "ann" } })).status).toBe(401);
    expect((await desk({ action: "search", query: "ann" }, "attendee")).status).toBe(403);
  });

  it("finds an exact name or email without the AI, and checks nobody in", async () => {
    const byName = await search("ann lee");
    expect(byName.match).toMatchObject({ id: "g-ann", name: "Ann Lee", checkedInAt: null, tickets: ["General Admission"] });
    expect((await search("ANN.LEE@example.com")).match.id).toBe("g-ann");
    expect(calls.ai).toBe(0);
    expect(await rows(env.DB, "SELECT * FROM check_ins")).toEqual([]);
  });

  it("leaves livestream-only guests off the list", async () => {
    const result = await search("Lara Stream");
    expect(result.match).toBeNull();
    expect(names(result.options)).not.toContain("Lara Stream");
    expect(result.guestCount).toBe(luma.length - 1);
  });

  it("says when the guest list last came from Luma", async () => {
    const result = await search("ann lee");
    expect(Date.now() - result.syncedAt).toBeLessThan(60_000);
    expect(calls.all).toBe(1);
    await search("ann lee");
    expect(calls.all).toBe(1); // the saved copy is used
  });

  it("asks the AI about a typo and shows the obvious guest", async () => {
    const result = await search("Ann Leee");
    expect(calls.ai).toBe(1);
    expect(result.match?.id).toBe("g-ann");
  });

  it("lists everyone for a shared name, even if the AI picks one", async () => {
    judge = (_typed, candidates) => ({ matches: candidates.map((c, i) => ({ id: c.id, score: 95 - i })), obvious: candidates[0].id });
    const johns = await search("john");
    expect(johns.match).toBeNull();
    expect(names(johns.options)).toEqual(expect.arrayContaining(["John Murch", "John Sherrod", "John Gilliam"]));
  });

  it("lists both registrations of someone who registered twice", async () => {
    const result = await search("Kristen Rathman");
    expect(result.match).toBeNull();
    expect(result.options.map((g: { id: string }) => g.id).sort()).toEqual(["g-kris1", "g-kris2"]);
  });

  it("returns every Smith, more than five, for Show all", async () => {
    const result = await search("smith");
    expect(result.options.length).toBe(7);
  });

  it("finds someone who registered since the last refresh", async () => {
    await search("ann lee"); // the saved copy
    luma.push(guest("g-new", "Newly", "Registered"));
    const result = await search("Newly Registered");
    expect(calls.newest).toBe(1);
    expect(result.match?.id).toBe("g-new");
    // Saved, so the next search doesn't need Luma.
    expect((await search("Newly Registered")).match?.id).toBe("g-new");
    expect(calls.newest).toBe(1);
  });

  it("says nobody matches only after checking Luma's newest registrations", async () => {
    const result = await search("Zed Quux");
    expect(result).toMatchObject({ match: null, options: [] });
    expect(calls.newest).toBe(1);
  });

  it("lists spelling matches when the AI is down", async () => {
    aiDown = true;
    const result = await search("Ann Leee");
    expect(result.match).toBeNull();
    expect(names(result.options)).toContain("Ann Lee");
  });

  it("checks a guest in once, and takes it back", async () => {
    const first = await desk({ action: "check_in", guestId: "g-ann" });
    expect(first.data.guest).toMatchObject({ id: "g-ann", checkedInHere: true });
    expect(first.data.guest.checkedInAt).toBeTruthy();
    const again = await desk({ action: "check_in", guestId: "g-ann" });
    expect(again.data.guest.checkedInAt).toBe(first.data.guest.checkedInAt);
    expect(await rows(env.DB, "SELECT guest_id, demo, checked_in_by FROM check_ins")).toEqual([{ guest_id: "g-ann", demo: 1, checked_in_by: "admin1" }]);
    expect((await search("ann lee")).match.checkedInAt).toBe(first.data.guest.checkedInAt);

    const undone = await desk({ action: "undo", guestId: "g-ann" });
    expect(undone.data.guest).toMatchObject({ checkedInAt: null, checkedInHere: false });
    expect(await rows(env.DB, "SELECT * FROM check_ins")).toEqual([]);
  });

  it("refuses a guest who isn't on the list", async () => {
    expect((await desk({ action: "check_in", guestId: "g-nobody" })).status).toBe(400);
  });

  it("lists the closest guests instead of one after Wrong person?", async () => {
    const result = await search("ann lee", false);
    expect(result.match).toBeNull();
    expect(names(result.options)).toContain("Ann Lee");
  });

  describe("walk-ins", () => {
    it("adds a new person in demo mode, checked in and findable", async () => {
      const added = await desk({ action: "walk_in", name: "Walk In", email: "walk@example.com" });
      expect(added.data).toMatchObject({ registered: false, guest: { name: "Walk In", walkIn: true, tickets: ["Walk-in"] } });
      expect(added.data.guest.checkedInAt).toBeTruthy();
      expect((await search("walk in")).match).toMatchObject({ name: "Walk In", checkedInHere: true });

      // Undo removes a demo walk-in altogether.
      expect((await desk({ action: "undo", guestId: added.data.guest.id })).data.guest).toBeNull();
      expect((await search("walk in")).match).toBeNull();
    });

    it("shows the registered guest for an email already on the list", async () => {
      const result = await desk({ action: "walk_in", name: "Someone", email: "Ann.Lee@example.com" });
      expect(result.data).toMatchObject({ registered: true, guest: { id: "g-ann", checkedInAt: null } });
      expect(calls.newest).toBe(1); // checked Luma's newest first
    });

    it("asks before adding someone with a registered guest's name", async () => {
      const similar = await desk({ action: "walk_in", name: "Ann Lee", email: "ann@home.com" });
      expect(names(similar.data.similar)).toContain("Ann Lee");
      expect(await rows(env.DB, "SELECT * FROM check_ins")).toEqual([]);

      const added = await desk({ action: "walk_in", name: "Ann Lee", email: "ann@home.com", newPerson: true });
      expect(added.data.guest).toMatchObject({ walkIn: true, email: "ann@home.com" });
    });
  });

  it("rejects bad requests", async () => {
    expect((await desk({ action: "search", query: "" })).status).toBe(400);
    expect((await desk({ action: "walk_in", name: "X", email: "not-an-email" })).status).toBe(400);
    expect((await desk({ action: "dance" })).status).toBe(400);
  });
});
