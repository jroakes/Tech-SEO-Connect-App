// Queries for the organizers' analytics page (src/pages/admin/analytics.astro),
// over the events table, the saved talks and places, Meet profiles and
// check-ins.
import placesData from "../data/places.json";
import { TOPICS } from "../data/topics";
import { getSchedule } from "./db";
import { currentSessionId } from "./sessions";
import { fold } from "./utils";

export type Range = "24h" | "7d" | "all";

export const RANGES: { value: Range; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "all", label: "All time" },
];

export interface Insights {
  totals: {
    visitors: number;
    pageViews: number;
    signedIn: number;
    directions: number;
    talkSaves: number;
    placeSaves: number;
    aiRequests: number;
  };
  activity: { label: string; tooltip: string; value: number }[];
  activityUnit: "hour" | "day";
  talks: { title: string; speaker: string | null; saves: number }[];
  places: { name: string; category: string; views: number; directions: number; saves: number }[];
  pages: { path: string; views: number }[];
  aiTools: { tool: string; calls: number; people: number }[];
  aiSearches: { query: string; count: number }[];
  directionsByApp: { google: number; apple: number };
  connector: { opened: number; copied: number };
  meet: {
    /** Who's on Meet right now, whatever the range. */
    people: number;
    withLinkedin: number;
    /** Actions in the range. */
    joins: number;
    updates: number;
    leaves: number;
    topicOpens: number;
    linkedinTaps: number;
    /** Topics anyone picked or opened: picked now, and opens and LinkedIn taps in the range. */
    topics: { topic: string; label: string; people: number; opens: number; taps: number }[];
  };
  checkIn: {
    /** Check-ins in the range (demo ones in demo mode). */
    checkedIn: number;
    walkIns: number;
    /** On the guest list now. */
    guests: number;
  };
}

const TIME_ZONE = "America/New_York";
// Organizers' own use of the admin pages isn't attendee activity.
const NOT_ADMIN = "(path IS NULL OR path NOT LIKE '/admin%')";
// Page views by attendees.
const ATTENDEE_VIEW = `type = 'page_view' AND ${NOT_ADMIN}`;

/**
 * How many people have each talk (or place) saved right now: every signed-in
 * attendee's list, plus what each device saved while signed out since it was
 * last signed in. Saves made before signing in are merged into the account,
 * so they're counted there and not again from the device's events. A page
 * that couldn't store its saves (anon ID "no-storage") kept them only while
 * it was open.
 */
async function savedNow(db: D1Database, kind: "session" | "place"): Promise<string[]> {
  const table = kind === "session" ? "saved_sessions" : "saved_places";
  const column = kind === "session" ? "session_id" : "place_id";
  const { results } = await db
    .prepare(
      `SELECT ${column} AS id FROM ${table}
       UNION ALL
       SELECT id FROM (
         SELECT json_extract(e.props, '$.${column}') AS id, SUM(CASE e.type WHEN '${kind}_save' THEN 1 ELSE -1 END) AS net
         FROM events e
         LEFT JOIN (SELECT anon_id, MAX(ts) AS last_in FROM events WHERE user_id IS NOT NULL AND anon_id IS NOT NULL GROUP BY anon_id) s
           ON s.anon_id = e.anon_id
         WHERE e.type IN ('${kind}_save', '${kind}_unsave') AND e.user_id IS NULL AND e.anon_id IS NOT NULL AND e.anon_id != 'no-storage'
           AND (s.last_in IS NULL OR e.ts > s.last_in)
         GROUP BY e.anon_id, json_extract(e.props, '$.${column}') HAVING net > 0)`,
    )
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

const tally = (ids: string[]) => {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
};

// The conference's local date and hour of a moment, e.g. "2026-11-05" and "9 AM".
const localDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
const localHour = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric" });
const localDay = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" });

/** `demo`: count demo check-ins (CHECK_IN_DEMO) rather than real ones. */
export async function getInsights(db: D1Database, range: Range, demo: boolean, now = new Date()): Promise<Insights> {
  const since = range === "all" ? "0000" : new Date(now.getTime() - (range === "24h" ? 24 : 7 * 24) * 3_600_000).toISOString();
  const unit = range === "24h" ? "hour" : "day";

  const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params).first<T>();
  const all = async <T>(sql: string, ...params: unknown[]) => (await db.prepare(sql).bind(...params).all<T>()).results;
  const count = async (sql: string, ...params: unknown[]) => (await one<{ n: number }>(sql, ...params))?.n ?? 0;
  const ofType = (type: string) => count("SELECT COUNT(*) AS n FROM events WHERE type = ? AND ts >= ?", type, since);

  const [visitors, pageViews, signedIn, directions, talkSaves, placeSaves, aiRequests, opened, copied] = await Promise.all([
    count(`SELECT COUNT(DISTINCT anon_id) AS n FROM events WHERE anon_id IS NOT NULL AND ${ATTENDEE_VIEW} AND ts >= ?`, since),
    count(`SELECT COUNT(*) AS n FROM events WHERE ${ATTENDEE_VIEW} AND ts >= ?`, since),
    count(
      `SELECT COUNT(DISTINCT user_id) AS n FROM (
         SELECT user_id FROM events WHERE user_id IS NOT NULL AND type != 'admin_action' AND ${NOT_ADMIN} AND ts >= ?1
         UNION SELECT user_id FROM saved_sessions WHERE created_at >= ?1
         UNION SELECT user_id FROM saved_places WHERE created_at >= ?1)`,
      since,
    ),
    ofType("map_button_click"),
    ofType("session_save"),
    ofType("place_save"),
    ofType("mcp_tool_call"),
    ofType("mcp_modal_open"),
    ofType("mcp_url_copy"),
  ]);

  const [hourRows, savedTalkIds, savedPlaceIds, schedule, talkNames, placeRows, pages, aiTools, searchRows, apps] = await Promise.all([
    // By UTC hour; they're put into Eastern hours and days below, which
    // handles the change to and from daylight saving time.
    all<{ hour: string; n: number }>(
      `SELECT strftime('%Y-%m-%dT%H', ts) AS hour, COUNT(*) AS n FROM events WHERE ${ATTENDEE_VIEW} AND ts >= ? GROUP BY hour ORDER BY hour`,
      since,
    ),
    savedNow(db, "session"),
    savedNow(db, "place"),
    getSchedule(db),
    // Titles for saved talks that are no longer in the schedule.
    all<{ id: string; title: string; speaker: string | null }>(
      `SELECT json_extract(props, '$.session_id') AS id, json_extract(props, '$.title') AS title, json_extract(props, '$.speaker') AS speaker
       FROM events WHERE type IN ('session_save', 'session_unsave') GROUP BY json_extract(props, '$.session_id')`,
    ),
    // Every place with activity, named as it was then (for places no longer listed).
    all<{ id: string; name: string; category: string; views: number; directions: number }>(
      `SELECT json_extract(props, '$.place_id') AS id, json_extract(props, '$.place_name') AS name, json_extract(props, '$.category') AS category,
         SUM(type = 'place_view' AND ts >= ?1) AS views, SUM(type = 'map_button_click' AND ts >= ?1) AS directions
       FROM events WHERE type IN ('place_view', 'map_button_click', 'place_save', 'place_unsave') GROUP BY json_extract(props, '$.place_id')`,
      since,
    ),
    all<{ path: string; views: number }>(
      `SELECT path, COUNT(*) AS views FROM events WHERE ${ATTENDEE_VIEW} AND ts >= ? AND path IS NOT NULL AND path != '' GROUP BY path ORDER BY views DESC LIMIT 8`,
      since,
    ),
    all<{ tool: string; calls: number; people: number }>(
      `SELECT json_extract(props, '$.tool') AS tool, COUNT(*) AS calls, COUNT(DISTINCT user_id) AS people
       FROM events WHERE type = 'mcp_tool_call' AND ts >= ? GROUP BY tool ORDER BY calls DESC`,
      since,
    ),
    // Searches, and the Meet topics people asked about.
    all<{ query: string; count: number }>(
      `SELECT lower(COALESCE(json_extract(props, '$.query'), json_extract(props, '$.topic'))) AS query, COUNT(*) AS count
       FROM events WHERE type = 'mcp_tool_call' AND ts >= ? AND COALESCE(json_extract(props, '$.query'), json_extract(props, '$.topic')) IS NOT NULL
       GROUP BY query ORDER BY count DESC LIMIT 500`,
      since,
    ),
    all<{ app: string; n: number }>(
      "SELECT json_extract(props, '$.map_type') AS app, COUNT(*) AS n FROM events WHERE type = 'map_button_click' AND ts >= ? GROUP BY app",
      since,
    ),
  ]);

  // "Solís" and "solis" are one search.
  const searches = new Map<string, number>();
  for (const { query, count } of searchRows) searches.set(fold(query), (searches.get(fold(query)) ?? 0) + count);
  const aiSearches = [...searches]
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count || a.query.localeCompare(b.query))
    .slice(0, 8);

  // Saved now, whatever the range. A device's saves of a talk that has since
  // moved day count under its new ID, as the accounts' saves do.
  const talkCounts = tally(savedTalkIds.map((id) => currentSessionId(id, schedule)));
  const talks = [...talkCounts]
    .map(([id, saves]) => {
      const session = schedule.find((s) => s.id === id);
      const named = talkNames.find((t) => t.id === id);
      return { title: session?.title ?? named?.title ?? id, speaker: session?.speaker ?? named?.speaker ?? null, saves };
    })
    .sort((a, b) => b.saves - a.saves || a.title.localeCompare(b.title))
    .slice(0, 10);

  // Directions and views in the range, and saves now.
  const placeSavesNow = tally(savedPlaceIds);
  const places = [...new Set([...placeRows.map((p) => p.id), ...placeSavesNow.keys()])]
    .map((id) => {
      const row = placeRows.find((p) => p.id === id);
      const listed = placesData.find((p) => p.id === id);
      return {
        name: listed?.name ?? row?.name ?? id,
        category: listed?.category ?? row?.category ?? "",
        views: row?.views ?? 0,
        directions: row?.directions ?? 0,
        saves: placeSavesNow.get(id) ?? 0,
      };
    })
    .filter((p) => p.views || p.directions || p.saves)
    .sort((a, b) => b.directions - a.directions || b.saves - a.saves || b.views - a.views || a.name.localeCompare(b.name))
    .slice(0, 12);

  const [meetPeople, picked, meetActivity, joins, updates, leaves, topicOpens, linkedinTaps, checkedIn, walkIns, guests] = await Promise.all([
    one<{ people: number; withLinkedin: number }>("SELECT COUNT(*) AS people, COALESCE(SUM(linkedin IS NOT NULL), 0) AS withLinkedin FROM profiles"),
    all<{ topic: string; n: number }>("SELECT value AS topic, COUNT(*) AS n FROM profiles, json_each(profiles.topics) GROUP BY value"),
    all<{ topic: string; opens: number; taps: number }>(
      `SELECT json_extract(props, '$.topic') AS topic, SUM(type = 'match_topic_open') AS opens, SUM(type = 'match_linkedin_click') AS taps
       FROM events WHERE type IN ('match_topic_open', 'match_linkedin_click') AND ts >= ? GROUP BY topic`,
      since,
    ),
    ofType("match_join"),
    ofType("match_update"),
    ofType("match_leave"),
    ofType("match_topic_open"),
    ofType("match_linkedin_click"),
    count("SELECT COUNT(*) AS n FROM check_ins WHERE demo = ? AND checked_in_at >= ?", demo ? 1 : 0, since),
    count("SELECT COUNT(*) AS n FROM check_ins WHERE demo = ? AND walk_in = 1 AND checked_in_at >= ?", demo ? 1 : 0, since),
    count("SELECT json_array_length(guests) AS n FROM guest_list"),
  ]);
  const meetTopics = TOPICS.map(({ id, label }) => {
    const activity = meetActivity.find((a) => a.topic === id);
    return { topic: id, label, people: picked.find((p) => p.topic === id)?.n ?? 0, opens: activity?.opens ?? 0, taps: activity?.taps ?? 0 };
  })
    .filter((t) => t.people || t.opens || t.taps)
    .sort((a, b) => b.people - a.people || b.opens - a.opens || a.label.localeCompare(b.label));

  return {
    totals: { visitors, pageViews, signedIn, directions, talkSaves, placeSaves, aiRequests },
    activity: fillBuckets(hourRows, range, unit, now),
    activityUnit: unit,
    talks,
    places,
    pages,
    aiTools,
    aiSearches,
    directionsByApp: {
      google: apps.find((a) => a.app === "google_maps")?.n ?? 0,
      apple: apps.find((a) => a.app === "apple_maps")?.n ?? 0,
    },
    connector: { opened, copied },
    meet: {
      people: meetPeople?.people ?? 0,
      withLinkedin: meetPeople?.withLinkedin ?? 0,
      joins,
      updates,
      leaves,
      topicOpens,
      linkedinTaps,
      topics: meetTopics,
    },
    checkIn: { checkedIn, walkIns, guests },
  };
}

// Every hour (or day) in the range, including the ones with no page views.
// `rows` are page views by UTC hour ("2026-11-05T14"); hours are shown and
// days are counted in Eastern time.
function fillBuckets(rows: { hour: string; n: number }[], range: Range, unit: "hour" | "day", now: Date) {
  const views = (n: number) => `${n.toLocaleString()} page ${n === 1 ? "view" : "views"}`;
  const startOf = (hour: string) => new Date(`${hour}:00:00Z`);

  if (unit === "hour") {
    const counts = new Map(rows.map((r) => [r.hour, r.n]));
    const thisHour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
    return Array.from({ length: 24 }, (_, i) => {
      const date = new Date(thisHour - (23 - i) * 3_600_000);
      const value = counts.get(date.toISOString().slice(0, 13)) ?? 0;
      return { label: localHour(date), tooltip: `${localDay(date)}, ${localHour(date)}: ${views(value)}`, value };
    });
  }

  const counts = new Map<string, number>();
  for (const r of rows) {
    const day = localDate(startOf(r.hour));
    counts.set(day, (counts.get(day) ?? 0) + r.n);
  }
  // Days are stepped at noon UTC, which is the same date in Eastern time.
  const noon = (day: string) => new Date(`${day}T12:00:00Z`);
  const today = localDate(now);
  const first = range === "all" && rows.length ? localDate(startOf(rows[0].hour)) : localDate(new Date(noon(today).getTime() - 6 * 86_400_000));
  const days: string[] = [];
  for (let d = noon(first); localDate(d) <= today; d = new Date(d.getTime() + 86_400_000)) days.push(d.toISOString().slice(0, 10));
  return days.map((day) => {
    const value = counts.get(day) ?? 0;
    const date = noon(day);
    const label = date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
    const weekday = date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
    return { label, tooltip: `${weekday}: ${views(value)}`, value };
  });
}
