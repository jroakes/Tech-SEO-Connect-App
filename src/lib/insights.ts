// Queries for the organizers' analytics page (src/pages/analytics.astro),
// over the events table and the saved talks and places.

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
}

const TIME_ZONE = "America/New_York";

/** The conference's UTC offset right now, in SQLite modifier form, e.g. "-5 hours". */
function localOffset(now: Date): string {
  const local = new Date(now.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return `${Math.round((local.getTime() - utc.getTime()) / 3_600_000)} hours`;
}

export async function getInsights(db: D1Database, range: Range, now = new Date()): Promise<Insights> {
  const since = range === "all" ? "0000" : new Date(now.getTime() - (range === "24h" ? 24 : 7 * 24) * 3_600_000).toISOString();
  const offset = localOffset(now);
  const unit = range === "24h" ? "hour" : "day";
  const bucket = unit === "hour" ? "%Y-%m-%d %H" : "%Y-%m-%d";

  const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params).first<T>();
  const all = async <T>(sql: string, ...params: unknown[]) => (await db.prepare(sql).bind(...params).all<T>()).results;
  const count = async (sql: string, ...params: unknown[]) => (await one<{ n: number }>(sql, ...params))?.n ?? 0;
  const ofType = (type: string) => count("SELECT COUNT(*) AS n FROM events WHERE type = ? AND ts >= ?", type, since);

  const [visitors, pageViews, signedIn, directions, talkSaves, placeSaves, aiRequests, opened, copied] = await Promise.all([
    count("SELECT COUNT(DISTINCT anon_id) AS n FROM events WHERE anon_id IS NOT NULL AND type = 'page_view' AND ts >= ?", since),
    ofType("page_view"),
    count(
      `SELECT COUNT(DISTINCT user_id) AS n FROM (
         SELECT user_id FROM events WHERE user_id IS NOT NULL AND ts >= ?1
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

  const [activityRows, talks, places, pages, aiTools, aiSearches, apps] = await Promise.all([
    all<{ bucket: string; n: number }>(
      `SELECT strftime('${bucket}', ts, ?) AS bucket, COUNT(*) AS n FROM events WHERE type = 'page_view' AND ts >= ? GROUP BY bucket ORDER BY bucket`,
      offset,
      since,
    ),
    // Saves minus un-saves, so the counts are what people have saved now.
    all<{ title: string; speaker: string | null; saves: number }>(
      `SELECT json_extract(props, '$.title') AS title, json_extract(props, '$.speaker') AS speaker,
         SUM(CASE type WHEN 'session_save' THEN 1 ELSE -1 END) AS saves
       FROM events WHERE type IN ('session_save', 'session_unsave') AND ts >= ?
       GROUP BY json_extract(props, '$.session_id') HAVING saves > 0 ORDER BY saves DESC, title LIMIT 10`,
      since,
    ),
    all<{ name: string; category: string; views: number; directions: number; saves: number }>(
      `SELECT json_extract(props, '$.place_name') AS name, json_extract(props, '$.category') AS category,
         SUM(type = 'place_view') AS views, SUM(type = 'map_button_click') AS directions,
         SUM(type = 'place_save') - SUM(type = 'place_unsave') AS saves
       FROM events WHERE type IN ('place_view', 'map_button_click', 'place_save', 'place_unsave') AND ts >= ?
       GROUP BY json_extract(props, '$.place_id') ORDER BY directions DESC, saves DESC, views DESC LIMIT 12`,
      since,
    ),
    all<{ path: string; views: number }>(
      "SELECT path, COUNT(*) AS views FROM events WHERE type = 'page_view' AND ts >= ? AND path IS NOT NULL AND path != '' GROUP BY path ORDER BY views DESC LIMIT 8",
      since,
    ),
    all<{ tool: string; calls: number; people: number }>(
      `SELECT json_extract(props, '$.tool') AS tool, COUNT(*) AS calls, COUNT(DISTINCT user_id) AS people
       FROM events WHERE type = 'mcp_tool_call' AND ts >= ? GROUP BY tool ORDER BY calls DESC`,
      since,
    ),
    all<{ query: string; count: number }>(
      `SELECT lower(json_extract(props, '$.query')) AS query, COUNT(*) AS count
       FROM events WHERE type = 'mcp_tool_call' AND ts >= ? AND json_extract(props, '$.query') IS NOT NULL
       GROUP BY query ORDER BY count DESC LIMIT 8`,
      since,
    ),
    all<{ app: string; n: number }>(
      "SELECT json_extract(props, '$.map_type') AS app, COUNT(*) AS n FROM events WHERE type = 'map_button_click' AND ts >= ? GROUP BY app",
      since,
    ),
  ]);

  return {
    totals: { visitors, pageViews, signedIn, directions, talkSaves, placeSaves, aiRequests },
    activity: fillBuckets(activityRows, range, unit, now, offset),
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
  };
}

// Every hour (or day) in the range, including the ones with no page views.
function fillBuckets(rows: { bucket: string; n: number }[], range: Range, unit: "hour" | "day", now: Date, offset: string) {
  const counts = new Map(rows.map((r) => [r.bucket, r.n]));
  const shiftMs = Number.parseInt(offset) * 3_600_000;
  const local = new Date(now.getTime() + shiftMs); // wall-clock time, read with UTC getters
  const keys: string[] = [];
  if (unit === "hour") {
    for (let h = 23; h >= 0; h--) keys.push(new Date(local.getTime() - h * 3_600_000).toISOString().slice(0, 13).replace("T", " "));
  } else {
    const first = range === "all" && rows.length ? rows[0].bucket : new Date(local.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
    for (let d = new Date(`${first}T00:00:00Z`); d <= local; d = new Date(d.getTime() + 86_400_000)) keys.push(d.toISOString().slice(0, 10));
  }
  return keys.map((key) => {
    const value = counts.get(key) ?? 0;
    const date = new Date(`${unit === "hour" ? `${key}:00` : `${key}T00:00`}:00Z`);
    const day = date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
    const hour = date.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric" });
    const views = `${value.toLocaleString()} page ${value === 1 ? "view" : "views"}`;
    return unit === "hour"
      ? { label: hour, tooltip: `${day}, ${hour}: ${views}`, value }
      : { label: date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }), tooltip: `${day}: ${views}`, value };
  });
}
