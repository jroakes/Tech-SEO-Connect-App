// Guest check-in at the door: the event's Luma guest list (copied into D1 and
// refreshed every 10 minutes in conference week), the AI that judges which guest
// was meant, and the check-ins themselves.
// In demo mode (CHECK_IN_DEMO, the default) check-ins and walk-ins are saved
// only in this app, and nothing is sent to Luma. Luma's API can't check a
// guest in, so real check-ins are kept here too.
import { env, waitUntil } from "cloudflare:workers";
import { z } from "zod";
import { candidates, exactMatch, livestreamOnly, sharesName, type Guest } from "./guest-match";

const LUMA = "https://public-api.luma.com";
const LUMA_NEWEST_TIMEOUT_MS = 2000;
// The AI that judges matches: Claude Sonnet 5.5 through OpenRouter, right on all
// our tests with real guest names, in a steady 1.1-1.4 seconds. If OpenRouter
// is busy (new accounts have a low rate limit) or slow, Llama 3.3 70B on Workers
// AI judges instead: as accurate, but sometimes several seconds slower.
const AI_MODEL = "anthropic/claude-sonnet-5.5";
const AI_TIMEOUT_MS = 3000;
const BACKUP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const BACKUP_TIMEOUT_MS = 5000;
const AI_MAX_TOKENS = 800; // room to score every candidate
const STALE_MS = 15 * 60_000; // a backup for the 10-minute cron: refresh in the background if it's missed
const SIMILAR_NAME = 0.9; // a walk-in's name this close to a guest's might be the same person
const SIMILAR_SHOWN = 5;
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

/** When the guest list last came in full from Luma, and how many guests are on it. */
export interface Freshness {
  syncedAt: number;
  guestCount: number;
}

export interface SearchResult extends Freshness {
  /** The guest, when it's clear who was meant. The admin still checks them in. */
  match: GuestResult | null;
  /** Otherwise everyone who might be them, best first. Empty when nobody matches. */
  options: GuestResult[];
}

export type WalkInResult = Freshness & ({ guest: GuestResult; registered: boolean } | { similar: GuestResult[] });

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

async function luma<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${LUMA}${path}`, { ...init, headers: { "x-luma-api-key": env.LUMA_API_KEY, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Luma ${path.split("?")[0]} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function fetchAllGuests(): Promise<Guest[]> {
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

/** Luma's 50 newest registrations (one request, about 0.15 seconds), or null if Luma doesn't answer quickly. */
async function fetchNewestGuests(): Promise<Guest[] | null> {
  const params = new URLSearchParams({ event_id: env.LUMA_EVENT_ID, pagination_limit: "50", sort_column: "registered_at", sort_direction: "desc nulls last" });
  try {
    const page = await luma<{ entries: LumaGuest[] }>(`/v1/events/guests/list?${params}`, { signal: AbortSignal.timeout(LUMA_NEWEST_TIMEOUT_MS) });
    return page.entries.map(toGuest);
  } catch (err) {
    console.error("Couldn't check Luma's newest registrations; using the saved list", err);
    return null;
  }
}

interface GuestList {
  guests: Guest[];
  syncedAt: number;
}

let syncing: Promise<GuestList> | null = null;

/**
 * Fetches the whole list from Luma (about 3 seconds for 400 guests) and saves
 * it. The cron in worker.ts runs this every 10 minutes in conference week.
 */
export function refreshGuestList(): Promise<GuestList> {
  syncing ??= fetchAllGuests()
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

const refreshIfStale = (syncedAt: number) => {
  if (Date.now() - syncedAt > STALE_MS) waitUntil(refreshGuestList().catch((err) => console.error("Couldn't refresh the Luma guest list", err)));
};

/** The saved guest list (fetched from Luma first if there isn't one yet). */
async function guestList(): Promise<GuestList> {
  const row = await env.DB.prepare("SELECT guests, synced_at FROM guest_list WHERE event_id = ?")
    .bind(env.LUMA_EVENT_ID)
    .first<{ guests: string; synced_at: number }>();
  if (!row) return refreshGuestList();
  refreshIfStale(row.synced_at);
  return { guests: JSON.parse(row.guests) as Guest[], syncedAt: row.synced_at };
}

/** When the guest list last came from Luma, for the page, without reading the whole list. */
export async function listFreshness(): Promise<Freshness> {
  const row = await env.DB.prepare("SELECT synced_at, json_array_length(guests) AS guest_count FROM guest_list WHERE event_id = ?")
    .bind(env.LUMA_EVENT_ID)
    .first<{ synced_at: number; guest_count: number }>();
  if (!row) {
    const list = await refreshGuestList();
    return { syncedAt: list.syncedAt, guestCount: list.guests.length };
  }
  refreshIfStale(row.synced_at);
  return { syncedAt: row.synced_at, guestCount: row.guest_count };
}

/**
 * Adds Luma's newest registrations to the list, so anyone who registered since
 * the last refresh is on it, and saves it unless a full refresh has replaced
 * the list meanwhile. Returns the same list when nothing changed.
 */
async function addNewest(list: GuestList, newest: Guest[]): Promise<GuestList> {
  const byId = new Map(list.guests.map((g) => [g.id, g]));
  const changed = newest.filter((g) => JSON.stringify(byId.get(g.id)) !== JSON.stringify(g));
  if (!changed.length) return list;
  for (const g of changed) byId.set(g.id, g);
  const guests = [...byId.values()];
  await env.DB.prepare("UPDATE guest_list SET guests = ? WHERE event_id = ? AND synced_at = ?")
    .bind(JSON.stringify(guests), env.LUMA_EVENT_ID, list.syncedAt)
    .run();
  return { guests, syncedAt: list.syncedAt };
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

interface Desk {
  list: GuestList;
  rows: CheckInRow[];
  /** Luma's guests plus walk-ins. */
  guests: Guest[];
  show: (g: Guest) => GuestResult;
  freshness: Freshness;
}

/** Everyone who can be checked in, and how to show each. */
function deskFrom(list: GuestList, rows: CheckInRow[]): Desk {
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
  return { list, rows, guests: [...list.guests, ...walkIns], show, freshness: { syncedAt: list.syncedAt, guestCount: list.guests.length } };
}

/** The desk from the saved list. With `newest`, Luma's newest registrations are added too. */
async function openDesk(newest = false): Promise<Desk> {
  const [list, { results: rows }, latest] = await Promise.all([
    guestList(),
    env.DB.prepare("SELECT guest_id, name, email, walk_in, checked_in_at FROM check_ins WHERE demo = ?").bind(demoFlag()).all<CheckInRow>(),
    newest ? fetchNewestGuests() : null,
  ]);
  return deskFrom(latest ? await addNewest(list, latest) : list, rows);
}

/** The same desk with Luma's newest registrations added, or the same desk if there are none new. */
async function withNewest(d: Desk): Promise<Desk> {
  const latest = await fetchNewestGuests();
  const list = latest ? await addNewest(d.list, latest) : d.list;
  return list === d.list ? d : deskFrom(list, d.rows);
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
List every candidate scoring ${MIN_AI_SCORE} or more, best first.
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
type Ranking = z.infer<typeof ranking>;
type Messages = { role: string; content: string }[];

async function askOpenRouter(messages: Messages): Promise<Ranking> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Tech SEO Connect check-in" },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0,
      max_tokens: AI_MAX_TOKENS,
      // Only providers that don't keep or train on what's sent (guests' names and emails).
      provider: { sort: "latency", data_collection: "deny" },
      messages,
      response_format: { type: "json_schema", json_schema: { name: "ranking", strict: true, schema: RANKING_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return ranking.parse(JSON.parse(data.choices?.[0]?.message?.content ?? ""));
}

async function askWorkersAi(messages: Messages): Promise<Ranking> {
  const { response } = (await env.AI.run(
    BACKUP_MODEL,
    { temperature: 0, max_tokens: AI_MAX_TOKENS, messages, response_format: { type: "json_schema", json_schema: RANKING_SCHEMA } },
    { signal: AbortSignal.timeout(BACKUP_TIMEOUT_MS) },
  )) as { response?: unknown };
  // The answer is usually parsed JSON already, sometimes text around JSON.
  const text = typeof response === "string" ? response : null;
  return ranking.parse(text ? JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) : response);
}

/** The AI's scores for the candidates (by their place in the list), or null if neither AI answered in time. */
async function judge(query: string, people: Guest[]): Promise<Ranking | null> {
  const messages = [
    { role: "system", content: PROMPT },
    // Short IDs, so the answer is short and quick.
    { role: "user", content: JSON.stringify({ typed: query, candidates: people.map((g, i) => ({ id: String(i), name: g.name, email: g.email })) }) },
  ];
  if (env.OPENROUTER_API_KEY) {
    try {
      return await askOpenRouter(messages);
    } catch (err) {
      console.error("OpenRouter couldn't judge the check-in matches; asking Workers AI", err);
    }
  }
  try {
    return await askWorkersAi(messages);
  } catch (err) {
    console.error("Workers AI couldn't judge the check-in matches either", err);
    return null;
  }
}

// What the page does ------------------------------------------------------------

/** The guest typed, if it's obvious who, otherwise everyone who might be them. */
async function find(query: string, d: Desk, single: boolean): Promise<{ match: Guest | null; options: Guest[] }> {
  const found = candidates(query, d.guests);
  if (!found.length) return { match: null, options: [] };
  const exact = single ? exactMatch(query, d.guests) : null;
  if (exact) return { match: exact, options: [] };

  const scores = await judge(query, found.map((c) => c.guest));
  // Without the AI, spelling alone, and never sure enough to pick one.
  if (!scores) return { match: null, options: found.map((c) => c.guest) };
  const ranked = scores.matches.filter((m) => m.score >= MIN_AI_SCORE && found[Number(m.id)]).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  // Never one obvious guest when several have the name typed, like "john" or
  // someone registered twice.
  const shared = found.filter((c) => sharesName(query, c.guest)).length > 1;
  if (single && !shared && best && scores.obvious === best.id && best.score >= OBVIOUS_SCORE) return { match: found[Number(best.id)].guest, options: [] };
  return { match: null, options: [...new Set(ranked.map((m) => found[Number(m.id)].guest))] };
}

/**
 * Finds the guest that was typed: the one guest when it's obvious who,
 * otherwise everyone who might be them, best first. Nobody is checked in
 * until the admin taps Check in. With `single` off it always returns the
 * list, as after "Wrong person?".
 */
export async function search(query: string, single = true): Promise<SearchResult> {
  let d = await openDesk();
  let found = await find(query, d, single);
  // Nobody: they may have only just registered, so check Luma's newest registrations.
  if (!found.match && !found.options.length) {
    const newer = await withNewest(d);
    if (newer !== d) found = await find(query, (d = newer), single);
  }
  return { ...d.freshness, match: found.match && d.show(found.match), options: found.options.map(d.show) };
}

/** Checks in a guest from the list. */
export async function checkIn(guestId: string, adminId: string): Promise<GuestResult> {
  let d = await openDesk();
  let guest = d.guests.find((g) => g.id === guestId);
  // Someone found among the newest registrations, before a full refresh saved them.
  if (!guest) {
    d = await withNewest(d);
    guest = d.guests.find((g) => g.id === guestId);
  }
  if (!guest) throw new CheckInError("That guest isn't on the list any more.");
  const shown = d.show(guest);
  return shown.checkedInAt ? shown : { ...shown, checkedInAt: await record(guest, adminId), checkedInHere: true };
}

/**
 * Takes back a check-in made here (one made in Luma stays). A walk-in's record
 * here goes too; in live mode Luma keeps their registration.
 */
export async function undoCheckIn(guestId: string): Promise<GuestResult | null> {
  const d = await openDesk();
  const email = d.guests.find((g) => g.id === guestId)?.email.toLowerCase() ?? "";
  // A walk-in's check-in is saved under its walkin- ID, even once Luma lists them.
  const undone = (r: CheckInRow) => r.guest_id === guestId || (r.walk_in === 1 && !!email && r.email?.toLowerCase() === email);
  await env.DB.prepare("DELETE FROM check_ins WHERE demo = ? AND (guest_id = ? OR (walk_in = 1 AND ? != '' AND lower(email) = ?))")
    .bind(demoFlag(), guestId, email, email)
    .run();
  const after = deskFrom(d.list, d.rows.filter((r) => !undone(r)));
  const guest = after.guests.find((g) => g.id === guestId);
  return guest ? after.show(guest) : null;
}

/**
 * Someone who isn't on the list: gives them a ticket and checks them in. In
 * demo mode they're saved only here; otherwise Luma adds them as going with
 * the event's default ticket type (and emails them their ticket).
 *
 * First it checks Luma's newest registrations, in case they registered since
 * the last refresh. If the email is registered, that guest is returned to
 * check in instead. If a guest has a similar name, nothing is added until the
 * admin says it's someone else (`newPerson`).
 */
export async function addWalkIn(name: string, email: string, adminId: string, newPerson = false): Promise<WalkInResult> {
  const d = await openDesk(true);
  const registered = d.guests.find((g) => g.email.toLowerCase() === email.toLowerCase());
  if (registered) return { ...d.freshness, guest: d.show(registered), registered: true };
  if (!newPerson) {
    const similar = candidates(name, d.guests).filter((c) => c.score >= SIMILAR_NAME);
    if (similar.length) return { ...d.freshness, similar: similar.slice(0, SIMILAR_SHOWN).map((c) => d.show(c.guest)) };
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
  return { ...d.freshness, guest: { ...d.show(guest), checkedInAt, checkedInHere: true }, registered: false };
}
