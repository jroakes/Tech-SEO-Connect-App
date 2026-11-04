// Check-in at the door, against a stand-in Luma guest list and AI.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/pages/api/admin/check-in";
import { refreshGuestList } from "@/lib/check-in";
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
// Ticket QR code keys: guest keys (g-…) from emailed tickets, ticket keys from the CSV export.
let byKey: Record<string, LumaGuest>;
const calls = { all: 0, newest: 0, ai: 0, added: [] as unknown[], ticket: null as unknown };
const LUMA_TICKET_TYPES = [
  { id: "ttype-stream", name: "Livestream" },
  { id: "ttype-ga", name: "General Admission" },
];
let ticketTypes = LUMA_TICKET_TYPES;
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
    // Registered as Paula Morris from an account named Matt Hill, with three tickets.
    guest("g-paula", "Paula", "Morris", { user_name: "Matt Hill", event_tickets: Array(3).fill({ name: "General Admission", checked_in_at: null }) }),
    guest("g-stox1", "Patrick", "Stox"),
    guest("g-stox2", "Bob", "Stox"),
    ...["Lee", "Danita", "Mandy", "Alyssa", "Robert", "Jen", "Tom"].map((first, i) => guest(`g-smith${i}`, first, "Smith")),
  ];
  byKey = {
    "g-annkey": luma[0],
    annticket: luma[0],
    "g-livekey": luma.find((g) => g.id === "g-live")!,
    // Registered since the list was last refreshed.
    "g-newkey": guest("g-new", "Nia", "Fresh"),
  };
  calls.all = calls.newest = calls.ai = 0;
  calls.added = [];
  calls.ticket = null;
  ticketTypes = LUMA_TICKET_TYPES;
  judge = usualJudge;
  aiDown = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "public-api.luma.com") {
      if (url.pathname === "/v1/events/guests/add") {
        const body = JSON.parse(String(init?.body));
        expect(body.event_id).toBe("evt-test");
        calls.added.push(...body.guests);
        calls.ticket = body.ticket;
        return json({ skipped: [] });
      }
      expect(url.searchParams.get("event_id")).toBe("evt-test");
      if (url.pathname === "/v1/events/ticket-types/list") return json({ entries: ticketTypes });
      if (url.pathname === "/v1/events/guests/get") {
        const found = byKey[url.searchParams.get("id")!];
        return found ? json(found) : json({ message: "Guest not found" }, 404);
      }
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
// What the desk logged for the analytics page.
const logged = () => rows(env.DB, "SELECT type, user_id, path, props FROM events WHERE type LIKE 'check_in%' ORDER BY id");
const checkInEvent = (type: string, guestId: string, walkIn = false) => ({
  type,
  user_id: "admin1",
  path: "/admin/check-in",
  props: JSON.stringify({ guest_id: guestId, demo: true, walk_in: walkIn }),
});

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
    expect(await logged()).toEqual([checkInEvent("check_in", "g-ann")]);

    const undone = await desk({ action: "undo", guestId: "g-ann" });
    expect(undone.data.guest).toMatchObject({ checkedInAt: null, checkedInHere: false });
    expect(await rows(env.DB, "SELECT * FROM check_ins")).toEqual([]);
    expect(await logged()).toEqual([checkInEvent("check_in", "g-ann"), checkInEvent("check_in_undo", "g-ann")]);
  });

  it("logs the guest list's size when a sync changes it", async () => {
    await search("ann lee"); // the first search fetches the list
    const sizes = async () => (await rows<{ guests: number }>(env.DB, "SELECT json_extract(props, '$.guests') AS guests FROM events WHERE type = 'guest_list_sync' ORDER BY id")).map((r) => r.guests);
    const [size] = await sizes();
    expect(size).toBeGreaterThan(10);
    await refreshGuestList();
    expect(await sizes()).toEqual([size]);
    luma.push(guest("g-late", "Late", "Comer"));
    await refreshGuestList();
    expect(await sizes()).toEqual([size, size + 1]);
  });

  it("refuses a guest who isn't on the list", async () => {
    expect((await desk({ action: "check_in", guestId: "g-nobody" })).status).toBe(400);
  });

  it("finds a guest by the name on their Luma account", async () => {
    const result = await search("Matt Hill");
    expect(result.match).toMatchObject({ id: "g-paula", name: "Paula Morris", otherName: "Matt Hill" });
    expect(result.match.tickets).toHaveLength(3);
  });

  it("lists the other close guests after Wrong person?", async () => {
    judge = (_typed, candidates) => {
      const patrick = candidates.find((c) => c.name === "Patrick Stox");
      return { matches: patrick ? [{ id: patrick.id, score: 95 }] : [], obvious: null };
    };
    const result = await desk({ action: "search", query: "Patrick Stox", single: false, exclude: "g-stox1" });
    expect(result.data.match).toBeNull();
    expect(names(result.data.options)).toContain("Bob Stox");
    expect(names(result.data.options)).not.toContain("Patrick Stox");
  });

  describe("scanning a ticket", () => {
    const ticket = (key: string) => `https://luma.com/check-in/evt-test?pk=${key}`;

    it("shows the guest on the ticket, and checks nobody in", async () => {
      const result = (await desk({ action: "scan", code: ticket("g-annkey") })).data;
      expect(result.match).toMatchObject({ id: "g-ann", name: "Ann Lee", checkedInAt: null });
      expect(result.options).toEqual([]);
      expect(result.guestCount).toBeGreaterThan(0);
      expect((await desk({ action: "scan", code: ticket("annticket") })).data.match.id).toBe("g-ann");
      expect(calls.ai).toBe(0);
      expect(await rows(env.DB, "SELECT * FROM check_ins")).toEqual([]);
    });

    it("finds someone who registered since the last refresh, ready to check in", async () => {
      await search("ann lee");
      expect((await desk({ action: "scan", code: ticket("g-newkey") })).data.match).toMatchObject({ id: "g-new", name: "Nia Fresh" });
      expect((await desk({ action: "check_in", guestId: "g-new" })).data.guest.checkedInHere).toBe(true);
    });

    it("refuses what isn't a ticket for this event, and livestream tickets", async () => {
      const refused = async (code: string) => {
        const res = await desk({ action: "scan", code });
        expect(res.status).toBe(400);
        return res.data.error as string;
      };
      expect(await refused("https://example.com/check-in/evt-test?pk=g-annkey")).toMatch(/^That isn't a Luma ticket/);
      expect(await refused("Ann Lee")).toMatch(/^That isn't a Luma ticket/);
      expect(await refused(ticket("g-nobody"))).toMatch(/^Luma didn't find that ticket/);
      expect(await refused(ticket("g-livekey"))).toBe("Lara Stream has a livestream-only ticket, for watching online.");
    });
  });

  describe("the live switch", () => {
    it("starts from CHECK_IN_DEMO, and turns live check-in on and off for every desk", async () => {
      expect((await search("ann lee")).demo).toBe(true);
      const on = await desk({ action: "set_live", live: true });
      expect(on.data).toEqual({ demo: false });
      // Another admin's desk sees it on its next answer, and its check-ins are real.
      const checked = await desk({ action: "check_in", guestId: "g-ann" }, "admin2");
      expect(checked.data.demo).toBe(false);
      expect(await rows(env.DB, "SELECT guest_id, demo FROM check_ins")).toEqual([{ guest_id: "g-ann", demo: 0 }]);
      expect((await desk({ action: "set_live", live: false })).data).toEqual({ demo: true });
      // The demo desk doesn't show the real check-in.
      expect((await search("ann lee")).match).toMatchObject({ id: "g-ann", checkedInAt: null });
      const modes = await rows(env.DB, "SELECT user_id, props FROM events WHERE type = 'check_in_mode' ORDER BY id");
      expect(modes).toEqual([
        { user_id: "admin1", props: JSON.stringify({ demo: false }) },
        { user_id: "admin1", props: JSON.stringify({ demo: true }) },
      ]);
    });

    it("adds a live walk-in to Luma, but not if the switch changed since the admin looked", async () => {
      await desk({ action: "set_live", live: true });
      const stale = await desk({ action: "walk_in", name: "Late Comer", email: "late@example.com", live: false });
      expect(stale.status).toBe(400);
      expect(stale.data).toMatchObject({ demo: false, error: expect.stringContaining("just turned live check-in on") });
      expect(calls.added).toEqual([]);

      const added = await desk({ action: "walk_in", name: "Late Comer", email: "late@example.com", live: true });
      expect(added.data).toMatchObject({ registered: false, demo: false, guest: { name: "Late Comer", checkedInHere: true } });
      expect(calls.added).toEqual([{ email: "late@example.com", name: "Late Comer" }]);
      expect(calls.ticket).toEqual({ event_ticket_type_id: "ttype-ga" });
    });

    it("won't add a live walk-in without a General Admission ticket, rather than Luma's default", async () => {
      await desk({ action: "set_live", live: true });
      ticketTypes = [{ id: "ttype-stream", name: "Livestream" }];
      const result = await desk({ action: "walk_in", name: "Late Comer", email: "late@example.com", live: true });
      expect(result.status).toBe(400);
      expect(result.data.error).toContain("General Admission");
      expect(calls.added).toEqual([]);
      expect(await rows(env.DB, "SELECT * FROM walk_ins")).toEqual([]);
    });

    it("keeps a live walk-in on the desk after Wrong person?, and they're one person once Luma lists them", async () => {
      await desk({ action: "set_live", live: true });
      const added = await desk({ action: "walk_in", name: "Late Comer", email: "late@example.com", live: true });
      const undone = await desk({ action: "undo", guestId: added.data.guest.id });
      expect(undone.data.guest).toMatchObject({ name: "Late Comer", checkedInAt: null, checkedInHere: false });
      expect((await search("late comer")).match).toMatchObject({ id: added.data.guest.id, checkedInAt: null });

      luma.push(guest("g-late", "Late", "Comer", { user_email: "late@example.com" }));
      await refreshGuestList();
      const found = await search("late comer");
      expect(found.match).toMatchObject({ id: "g-late", tickets: ["General Admission"], checkedInAt: null });
      expect(found.options).toEqual([]);
    });

    it("is for admins only", async () => {
      expect((await desk({ action: "set_live", live: true }, "attendee")).status).toBe(403);
    });
  });

  describe("walk-ins", () => {
    it("adds a new person in demo mode, checked in and findable", async () => {
      const added = await desk({ action: "walk_in", name: "Walk In", email: "walk@example.com" });
      expect(added.data).toMatchObject({ registered: false, guest: { name: "Walk In", walkIn: true, tickets: ["Walk-in"] } });
      expect(added.data.guest.checkedInAt).toBeTruthy();
      expect((await search("walk in")).match).toMatchObject({ name: "Walk In", checkedInHere: true });

      // Undo takes back the check-in, and they stay on the desk to check in again.
      const id = added.data.guest.id;
      expect((await desk({ action: "undo", guestId: id })).data.guest).toMatchObject({ id, checkedInAt: null, checkedInHere: false });
      expect((await search("walk in")).match).toMatchObject({ id, checkedInAt: null });
      expect((await desk({ action: "check_in", guestId: id })).data.guest).toMatchObject({ id, checkedInHere: true });
      expect(await logged()).toEqual([checkInEvent("check_in", id, true), checkInEvent("check_in_undo", id, true), checkInEvent("check_in", id, true)]);
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
