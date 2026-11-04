// Walk-ups: someone at the door without a ticket. Guests are checked in on
// Luma's own page (see pages/admin/check-in.astro); this adds them to the event
// with a free ticket, which Luma emails them.
import { env } from "cloudflare:workers";
import { insertEvents } from "./db";

const LUMA = "https://public-api.luma.com";
// LUMA_API_URL is for the browser tests' stand-in for Luma.
const lumaUrl = () => (env as { LUMA_API_URL?: string }).LUMA_API_URL || LUMA;

// Luma's default ticket for this event is Livestream. Free is hidden and needs
// approval, so it's looked up with the hidden types and the guest added approved.
const WALK_UP_TICKET = "Free";

export class WalkUpError extends Error {}

export type WalkUpResult = { added: true } | { added: false; name: string; tickets: string[] };

interface LumaGuest {
  user_name: string | null;
  user_email: string;
  approval_status: string;
  event_tickets?: { name: string }[] | null;
}

const luma = (path: string, init: RequestInit = {}) =>
  fetch(`${lumaUrl()}${path}`, { ...init, headers: { "x-luma-api-key": env.LUMA_API_KEY, "Content-Type": "application/json" } });

async function lumaJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await luma(path, init);
  if (!res.ok) throw new Error(`Luma ${path.split("?")[0]} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

/** The event's guest with this email, or null. */
async function findGuest(email: string): Promise<LumaGuest | null> {
  const res = await luma(`/v1/events/guests/get?${new URLSearchParams({ event_id: env.LUMA_EVENT_ID, id: email })}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Luma guests/get answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<LumaGuest>;
}

/**
 * Adds someone to the event as going, with a free ticket that Luma emails them.
 * Someone already going isn't added again: they're returned, to check in on Luma.
 */
export async function addWalkUp(name: string, email: string, adminId: string): Promise<WalkUpResult> {
  const guest = await findGuest(email);
  if (guest?.approval_status === "approved") {
    return { added: false, name: guest.user_name || guest.user_email, tickets: (guest.event_tickets ?? []).map((t) => t.name) };
  }

  const params = new URLSearchParams({ event_id: env.LUMA_EVENT_ID, include_hidden: "true" });
  const { entries } = await lumaJson<{ entries: { id: string; name: string }[] }>(`/v1/events/ticket-types/list?${params}`);
  const ticket = entries.find((t) => t.name === WALK_UP_TICKET);
  // Luma would otherwise give them the default ticket.
  if (!ticket) throw new WalkUpError(`This event has no ${WALK_UP_TICKET} ticket in Luma, so ${name} wasn't added.`);

  const { skipped } = await lumaJson<{ skipped: { email: string }[] }>("/v1/events/guests/add", {
    method: "POST",
    body: JSON.stringify({ event_id: env.LUMA_EVENT_ID, guests: [{ email, name }], ticket: { event_ticket_type_id: ticket.id }, approval_status: "approved" }),
  });
  if (skipped.length) throw new WalkUpError(`Luma won't add ${email}: they've unsubscribed from the calendar, or were removed or blocked.`);

  // A failed log never fails the walk-up.
  await insertEvents(env.DB, [{ type: "walk_up", ts: Date.now(), userId: adminId, path: "/admin/check-in" }]).catch((err) => console.error("Couldn't log a walk-up", err));
  return { added: true };
}
