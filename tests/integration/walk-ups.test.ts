// Adding walk-ups to the event in Luma, with Luma stubbed.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/pages/api/admin/walk-ups";
import { call, rows } from "./helpers";

vi.mock("@/lib/clerk", () => import("./fake-clerk"));

const TICKET_TYPES = [
  { id: "ttype-ga", name: "General Admission", is_hidden: false },
  { id: "ttype-stream", name: "Livestream", is_hidden: false },
  { id: "ttype-free", name: "Free", is_hidden: true },
];

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

let ticketTypes = TICKET_TYPES;
let registered: Record<string, unknown>;
let skipped: { email: string }[];
let added: Record<string, unknown>[];

beforeEach(() => {
  ticketTypes = TICKET_TYPES;
  registered = {};
  skipped = [];
  added = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.hostname).toBe("public-api.luma.com");
    if (url.pathname === "/v1/events/guests/add") {
      added.push(JSON.parse(String(init?.body)));
      return json({ skipped });
    }
    expect(url.searchParams.get("event_id")).toBe("evt-test");
    if (url.pathname === "/v1/events/guests/get") {
      const found = registered[url.searchParams.get("id")!];
      return found ? json(found) : json({ message: "Guest not found." }, 404);
    }
    if (url.pathname === "/v1/events/ticket-types/list") return json({ entries: ticketTypes.filter((t) => !t.is_hidden || url.searchParams.get("include_hidden")) });
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

const addWalkUp = (body: unknown, user = "admin1") => call(POST, { method: "POST", user, body });
const person = { name: "Late Comer", email: "Late@Example.com" };

describe("walk-ups", () => {
  it("adds them as going with the Free ticket, and logs it", async () => {
    const result = await addWalkUp(person);
    expect(result.data).toEqual({ added: true });
    expect(added).toEqual([
      {
        event_id: "evt-test",
        guests: [{ email: "late@example.com", name: "Late Comer" }],
        ticket: { event_ticket_type_id: "ttype-free" },
        approval_status: "approved",
      },
    ]);
    expect(await rows(env.DB, "SELECT type, user_id, path FROM events")).toEqual([{ type: "walk_up", user_id: "admin1", path: "/admin/check-in" }]);
  });

  it("doesn't add someone who's already going", async () => {
    registered["late@example.com"] = { user_name: "Late C", user_email: "late@example.com", approval_status: "approved", event_tickets: [{ name: "Livestream" }] };
    expect((await addWalkUp(person)).data).toEqual({ added: false, name: "Late C", tickets: ["Livestream"] });
    expect(added).toEqual([]);
  });

  it("adds someone who was declined", async () => {
    registered["late@example.com"] = { user_name: "Late C", user_email: "late@example.com", approval_status: "declined", event_tickets: [] };
    expect((await addWalkUp(person)).data).toEqual({ added: true });
  });

  it("won't fall back to Luma's default ticket if the event has no Free ticket", async () => {
    ticketTypes = TICKET_TYPES.filter((t) => t.name !== "Free");
    const result = await addWalkUp(person);
    expect(result.status).toBe(400);
    expect(result.data.error).toContain("no Free ticket");
    expect(added).toEqual([]);
  });

  it("says so when Luma skips them", async () => {
    skipped = [{ email: "late@example.com" }];
    const result = await addWalkUp(person);
    expect(result.status).toBe(400);
    expect(result.data.error).toContain("won't add late@example.com");
  });

  it("is for admins only, and needs a name and email", async () => {
    expect((await call(POST, { method: "POST", body: person })).status).toBe(401);
    expect((await addWalkUp(person, "attendee")).status).toBe(403);
    expect((await addWalkUp({ name: "X", email: "not-an-email" })).status).toBe(400);
    expect((await addWalkUp({ name: "", email: "x@example.com" })).status).toBe(400);
    expect(added).toEqual([]);
  });
});
