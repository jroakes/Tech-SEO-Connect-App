import { parseMainSiteSchedule } from "./schedule-parse";
import { assignSessionIds } from "./sessions";
import { recordSyncRun, replaceSchedule } from "./db";

// Fewer talks than this means the page didn't parse properly; keep the
// current schedule rather than replacing it with a partial one.
const MIN_TALKS = 5;

/** Pulls the schedule from the main site into D1. Runs on the hourly cron. */
export async function syncSchedule(env: Env): Promise<void> {
  const url = env.SCHEDULE_SOURCE_URL;
  if (!url) {
    await recordSyncRun(env.DB, "skipped", 0, "SCHEDULE_SOURCE_URL is not set.");
    return;
  }

  try {
    const res = await fetch(url, { headers: { "User-Agent": "TechSEOConnectApp-ScheduleSync/1.0" } });
    if (!res.ok) throw new Error(`Fetching ${url} returned HTTP ${res.status}.`);

    const { sessions, warnings } = parseMainSiteSchedule(await res.text());
    const talks = sessions.filter((s) => !s.isBreak).length;
    if (talks < MIN_TALKS) {
      throw new Error(`Found only ${talks} talks at ${url}; kept the current schedule. ${warnings.join(" ")}`.trim());
    }

    await replaceSchedule(env.DB, assignSessionIds(sessions));
    await recordSyncRun(env.DB, "ok", sessions.length, warnings.join(" "));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Schedule sync failed:", message);
    await recordSyncRun(env.DB, "error", 0, message).catch(() => {});
  }
}
