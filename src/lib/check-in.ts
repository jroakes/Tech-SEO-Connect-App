// Guest check-in at the door: the event's Luma guest list (copied into D1),
// the AI that judges which guest was meant, and the check-ins themselves.
// In demo mode (CHECK_IN_DEMO, the default) check-ins and walk-ins are saved
// only in this app, and nothing is sent to Luma. Luma's API can't check a
// guest in, so real check-ins are kept here too.
import { env, waitUntil } from "cloudflare:workers";
import { z } from "zod";
import { candidates, exactMatch, livestreamOnly, type Guest } from "./guest-match";

const LUMA = "https://public-api.luma.com";
const MODEL = "anthropic/claude-sonnet-5.5"; // as fast as Haiku 5.5 on OpenRouter, and better with nicknames
const STALE_MS = 2 * 60_000; // refresh the copied guest list in the background once it's this old
const RECHECK_MS = 30_000; // when nobody matches, fetch the list again if it's older than this
const WALK_IN_MAX_AGE_MS = 10_000; // before adding a walk-in, the list must be this fresh
const SIMILAR_NAME = 0.9; // a walk-in's name this close to a guest's might be the same person
const OPTIONS = 5;
const MIN_AI_SCORE = 40; // below this, the AI doesn't think it's them
const OBVIOUS_SCORE = 85;

export const isDemo = () => (env.CHECK_IN_DEMO as string) !== "false";

/** A problem to show the admin, like Luma refusing a walk-in. */
export class CheckInError extends Error {}

/** A guest as the check-in page shows them. */
export interface GuestResult {
  id: string;
  name: string;
  email: string;
  tickets: string[];
  status: string;
  livestreamOnly: boolean;
  checkedInAt: string | null;
  /** Checked in here (so it can be undone), rather than in Luma. */
  checkedInHere: boolean;
  walkIn: boolean;
}

export interface SearchResult {
  /** The guest, when it's clear who was meant. */
  match: GuestResult | null;
  /** Whether the search just checked the match in. */
  checkedIn: boolean;
  /** Otherwise the closest guests, best first. Empty when nobody matches. */
  options: GuestResult[];
}

// The Luma guest list ---------------------------------------------------------

interface LumaGuest {
  id: string;
  user_name: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string;
  approval_status: string;
  event_tickets?: { name: string; checked_in_at: string | null }[] | null;
}

function toGuest(g: LumaGuest): Guest {
  const tickets = g.event_tickets ?? [];
  // Some people's Luma name is only their first name.
  const fullName = g.user_first_name && g.user_last_name ? `${g.user_first_name} ${g.user_last_name}` : null;
  return {
    id: g.id,
    name: fullName ?? (g.user_name || g.user_email),
    firstName: g.user_first_name,
    lastName: g.user_last_name,
    email: g.user_email,
    status: g.approval_status,
    tickets: tickets.map((t) => t.name),
    lumaCheckedInAt: tickets.map((t) => t.checked_in_at).filter((at): at is string => !!at).sort()[0] ?? null,
  };
}

async function luma<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${LUMA}${path}`, { ...init, headers: { "x-luma-api-key": env.LUMA_API_KEY, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Luma ${path.split("?")[0]} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function fetchGuests(): Promise<Guest[]> {
  const guests: Guest[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ event_id: env.LUMA_EVENT_ID, pagination_limit: "50" });
    if (cursor) params.set("pagination_cursor", cursor);
    const page = await luma<{ entries: LumaGuest[]; has_more: boolean; next_cursor?: string }>(`/v1/events/guests/list?${params}`);
    guests.push(...page.entries.map(toGuest));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return guests;
}

interface GuestList {
  guests: Guest[];
  syncedAt: number;
}

let syncing: Promise<GuestList> | null = null;

/** Fetches the whole list from Luma (about 3 seconds for 400 guests) and saves it. */
function syncGuests(): Promise<GuestList> {
  syncing ??= fetchGuests()
    .then(async (guests) => {
      const syncedAt = Date.now();
      await env.DB.prepare(
        "INSERT INTO guest_list (event_id, guests, synced_at) VALUES (?, ?, ?) ON CONFLICT (event_id) DO UPDATE SET guests = excluded.guests, synced_at = excluded.synced_at",
      )
        .bind(env.LUMA_EVENT_ID, JSON.stringify(guests), syncedAt)
        .run();
      return { guests, syncedAt };
    })
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

/**
 * The saved guest list, refreshed in the background once it's a couple of
 * minutes old, or fetched from Luma first if it's older than `maxAgeMs`.
 */
export async function guestList(maxAgeMs = Infinity): Promise<GuestList> {
  const row = await env.DB.prepare("SELECT guests, synced_at FROM guest_list WHERE event_id = ?")
    .bind(env.LUMA_EVENT_ID)
    .first<{ guests: string; synced_at: number }>();
  if (!row || Date.now() - row.synced_at > maxAgeMs) return syncGuests();
  if (Date.now() - row.synced_at > STALE_MS) waitUntil(syncGuests().catch((err) => console.error("Couldn't refresh the Luma guest list", err)));
  return { guests: JSON.parse(row.guests) as Guest[], syncedAt: row.synced_at };
}

// Check-ins --------------------------------------------------------------------

interface CheckInRow {
  guest_id: string;
  name: string;
  email: string | null;
  walk_in: number;
  checked_in_at: string;
}

const demoFlag = () => (isDemo() ? 1 : 0);

/** Everyone who can be checked in (Luma's guests plus walk-ins), and how to show each. */
async function desk(maxAgeMs = Infinity) {
  const [list, { results: rows }] = await Promise.all([
    guestList(maxAgeMs),
    env.DB.prepare("SELECT guest_id, name, email, walk_in, checked_in_at FROM check_ins WHERE demo = ?").bind(demoFlag()).all<CheckInRow>(),
  ]);
  const byId = new Map(rows.map((r) => [r.guest_id, r]));
  // A walk-in who's since shown up in Luma's list (live mode) is the same person.
  const byEmail = new Map(rows.filter((r) => r.walk_in && r.email).map((r) => [r.email!.toLowerCase(), r]));
  const lumaEmails = new Set(list.guests.map((g) => g.email.toLowerCase()));
  const walkIns: Guest[] = rows
    .filter((r) => r.walk_in && !(r.email && lumaEmails.has(r.email.toLowerCase())))
    .map((r) => ({ id: r.guest_id, name: r.name, firstName: null, lastName: null, email: r.email ?? "", status: "approved", tickets: ["Walk-in"], lumaCheckedInAt: null }));

  const show = (g: Guest): GuestResult => {
    const here = byId.get(g.id) ?? byEmail.get(g.email.toLowerCase());
    return {
      id: g.id,
      name: g.name,
      email: g.email,
      tickets: g.tickets,
      status: g.status,
      livestreamOnly: livestreamOnly(g),
      checkedInAt: here?.checked_in_at ?? g.lumaCheckedInAt,
      checkedInHere: !!here,
      walkIn: g.id.startsWith("walkin-"),
    };
  };
  return { guests: [...list.guests, ...walkIns], syncedAt: list.syncedAt, show };
}

/** Saves a check-in (once) and returns when it happened. */
async function record(guest: Pick<Guest, "id" | "name" | "email">, adminId: string, walkIn = false): Promise<string> {
  const [, saved] = await env.DB.batch<{ checked_in_at: string }>([
    env.DB.prepare(
      "INSERT INTO check_ins (guest_id, demo, name, email, walk_in, checked_in_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (guest_id, demo) DO NOTHING",
    ).bind(guest.id, demoFlag(), guest.name, guest.email || null, walkIn ? 1 : 0, adminId),
    env.DB.prepare("SELECT checked_in_at FROM check_ins WHERE guest_id = ? AND demo = ?").bind(guest.id, demoFlag()),
  ]);
  return saved.results[0].checked_in_at;
}

// The AI's judgment -----------------------------------------------------------------

const PROMPT = `You match what a staff member typed at a conference check-in desk (a full name, a last name, a first name or an email) to registered guests.
Score each candidate 0-100 for how likely they are the person meant. Nicknames (Bob for Robert), typos, missing or extra middle names and swapped first and last names can still be the person. A different first name with the same last name usually isn't.
List only candidates scoring 40 or more, best first, at most 5.
Set "obvious" to a candidate's id only when that one candidate is clearly the person and no other candidate is plausible; otherwise null. A last name alone is obvious only if just one candidate has it.`;

const RANKING_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, score: { type: "integer" } }, required: ["id", "score"], additionalProperties: false },
    },
    obvious: { type: ["string", "null"] },
  },
  required: ["matches", "obvious"],
  additionalProperties: false,
};
const ranking = z.object({ matches: z.array(z.object({ id: z.string(), score: z.number() })), obvious: z.string().nullable() });

/** The AI's scores for the candidates (by their place in the list), or null if it couldn't answer in time. */
async function judge(query: string, people: Guest[]): Promise<z.infer<typeof ranking> | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Tech SEO Connect check-in" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 300,
        provider: { sort: "latency" },
        messages: [
          { role: "system", content: PROMPT },
          // Short IDs, so the answer is short and quick.
          { role: "user", content: JSON.stringify({ typed: query, candidates: people.map((g, i) => ({ id: String(i), name: g.name, email: g.email })) }) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "ranking", strict: true, schema: RANKING_SCHEMA } },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return ranking.parse(JSON.parse(data.choices?.[0]?.message?.content ?? ""));
  } catch (err) {
    console.error("The AI couldn't judge the check-in matches", err);
    return null;
  }
}

// What the page does ------------------------------------------------------------

/**
 * Finds the guest that was typed. When it's obvious who, checks them in (if
 * they're going and not already in); otherwise returns the closest five.
 * With `auto` off it always returns the closest five, as after "Wrong person?".
 */
export async function search(query: string, adminId: string, auto = true): Promise<SearchResult> {
  let d = await desk();
  let found = candidates(query, d.guests);
  // Nobody: they may have only just registered, so look at Luma's latest list.
  if (!found.length && Date.now() - d.syncedAt > RECHECK_MS) {
    d = await desk(0);
    found = candidates(query, d.guests);
  }
  if (!found.length) return { match: null, checkedIn: false, options: [] };

  let match = auto ? exactMatch(query, d.guests) : null;
  let options: Guest[] = [];
  if (!match) {
    const scores = await judge(query, found.map((c) => c.guest));
    if (scores) {
      const ranked = scores.matches
        .filter((m) => m.score >= MIN_AI_SCORE && found[Number(m.id)])
        .sort((a, b) => b.score - a.score);
      options = [...new Set(ranked.map((m) => found[Number(m.id)].guest))].slice(0, OPTIONS);
      const best = ranked[0];
      if (auto && best && scores.obvious === best.id && best.score >= OBVIOUS_SCORE) match = found[Number(best.id)].guest;
    } else {
      // Without the AI, spelling alone, and never sure enough to check anyone in.
      options = found.filter((c) => c.score >= 0.85).slice(0, OPTIONS).map((c) => c.guest);
    }
  }

  if (match) {
    const shown = d.show(match);
    if (!shown.checkedInAt && match.status === "approved" && !shown.livestreamOnly) {
      return { match: { ...shown, checkedInAt: await record(match, adminId), checkedInHere: true }, checkedIn: true, options: [] };
    }
    return { match: shown, checkedIn: false, options: [] };
  }
  return { match: null, checkedIn: false, options: options.map(d.show) };
}

/** Checks in a guest from the list. */
export async function checkIn(guestId: string, adminId: string): Promise<GuestResult> {
  const d = await desk();
  const guest = d.guests.find((g) => g.id === guestId);
  if (!guest) throw new CheckInError("That guest isn't on the list any more.");
  const shown = d.show(guest);
  return shown.checkedInAt ? shown : { ...shown, checkedInAt: await record(guest, adminId), checkedInHere: true };
}

/** Takes back a check-in made here (one made in Luma stays). A walk-in added in demo mode is removed. */
export async function undoCheckIn(guestId: string): Promise<GuestResult | null> {
  await env.DB.prepare("DELETE FROM check_ins WHERE guest_id = ? AND demo = ?").bind(guestId, demoFlag()).run();
  const d = await desk();
  const guest = d.guests.find((g) => g.id === guestId);
  return guest ? d.show(guest) : null;
}

/**
 * Someone who isn't on the list: gives them a ticket and checks them in. In
 * demo mode they're saved only here; otherwise Luma adds them as going (and
 * emails them their ticket).
 *
 * First it gets Luma's latest list, in case they registered since the last
 * look. If the email is registered, that guest is checked in instead. If a
 * guest has a similar name, nothing is added until the admin says it's
 * someone else (`newPerson`).
 */
export async function addWalkIn(
  name: string,
  email: string,
  adminId: string,
  newPerson = false,
): Promise<{ guest: GuestResult; registered: boolean } | { similar: GuestResult[] }> {
  const d = await desk(WALK_IN_MAX_AGE_MS);
  const registered = d.guests.find((g) => g.email.toLowerCase() === email.toLowerCase());
  if (registered) {
    const shown = d.show(registered);
    if (shown.checkedInAt || registered.status !== "approved") return { guest: shown, registered: true };
    return { guest: { ...shown, checkedInAt: await record(registered, adminId), checkedInHere: true }, registered: true };
  }
  if (!newPerson) {
    const similar = candidates(name, d.guests).filter((c) => c.score >= SIMILAR_NAME);
    if (similar.length) return { similar: similar.slice(0, OPTIONS).map((c) => d.show(c.guest)) };
  }

  if (!isDemo()) {
    const { skipped } = await luma<{ skipped: { email: string }[] }>("/v1/events/guests/add", {
      method: "POST",
      body: JSON.stringify({ event_id: env.LUMA_EVENT_ID, guests: [{ email, name }] }),
    });
    if (skipped.length) throw new CheckInError(`Luma won't add ${email}: they've unsubscribed from the calendar, or were removed or blocked.`);
  }
  const guest: Guest = { id: `walkin-${crypto.randomUUID()}`, name, firstName: null, lastName: null, email, status: "approved", tickets: ["Walk-in"], lumaCheckedInAt: null };
  const checkedInAt = await record(guest, adminId, true);
  return { guest: { ...d.show(guest), checkedInAt, checkedInHere: true }, registered: false };
}
