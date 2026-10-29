import type { Session } from "./types";
import { fallbackSchedule } from "@/data/schedule";

interface SessionRow {
  id: string;
  day: number;
  date: string | null;
  time: string;
  duration: number;
  title: string;
  speaker: string | null;
  is_break: number;
  description: string | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    day: row.day,
    ...(row.date ? { date: row.date } : {}),
    time: row.time,
    duration: row.duration,
    title: row.title,
    isBreak: row.is_break === 1,
    ...(row.speaker ? { speaker: row.speaker } : {}),
    ...(row.description ? { description: row.description } : {}),
  };
}

/** The synced schedule from D1, or the bundled one if the table is empty or unreachable. */
export async function getSchedule(db: D1Database): Promise<Session[]> {
  try {
    const { results } = await db
      .prepare("SELECT id, day, date, time, duration, title, speaker, is_break, description FROM sessions ORDER BY day, sort")
      .all<SessionRow>();
    if (results.length) return results.map(rowToSession);
  } catch (err) {
    console.error("Reading sessions from D1 failed; using the bundled schedule.", err);
  }
  return fallbackSchedule;
}

/** Replaces the whole schedule in one transaction. */
export async function replaceSchedule(db: D1Database, sessions: Session[]): Promise<void> {
  const now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO sessions (id, day, date, sort, time, duration, title, speaker, is_break, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  await db.batch([
    db.prepare("DELETE FROM sessions"),
    ...sessions.map((s, i) =>
      insert.bind(s.id, s.day, s.date ?? null, i, s.time, s.duration, s.title, s.speaker ?? null, s.isBreak ? 1 : 0, s.description ?? null, now),
    ),
  ]);
}

export async function recordSyncRun(db: D1Database, status: "ok" | "skipped" | "error", sessionCount: number, message: string) {
  await db
    .prepare("INSERT INTO sync_runs (ran_at, status, session_count, message) VALUES (?, ?, ?, ?)")
    .bind(new Date().toISOString(), status, sessionCount, message.slice(0, 1000))
    .run();
}

// What a user can save, and where each kind is stored.
export type SavedKind = "session" | "place";
const SAVED_TABLES: Record<SavedKind, { table: string; column: string }> = {
  session: { table: "saved_sessions", column: "session_id" },
  place: { table: "saved_places", column: "place_id" },
};

/** IDs of the talks or places a user has saved, oldest first. */
export async function getSavedIds(db: D1Database, kind: SavedKind, userId: string): Promise<string[]> {
  const { table, column } = SAVED_TABLES[kind];
  const { results } = await db
    .prepare(`SELECT ${column} AS id FROM ${table} WHERE user_id = ? ORDER BY created_at`)
    .bind(userId)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function updateSaved(db: D1Database, kind: SavedKind, userId: string, add: string[], remove: string[]): Promise<void> {
  const { table, column } = SAVED_TABLES[kind];
  const statements = [
    ...add.map((id) => db.prepare(`INSERT OR IGNORE INTO ${table} (user_id, ${column}) VALUES (?, ?)`).bind(userId, id)),
    ...remove.map((id) => db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND ${column} = ?`).bind(userId, id)),
  ];
  if (statements.length) await db.batch(statements);
}

export interface EventRecord {
  type: string;
  ts: number;
  anonId?: string;
  userId?: string | null;
  path?: string;
  props?: Record<string, unknown>;
}

export async function insertEvents(db: D1Database, events: EventRecord[]): Promise<void> {
  if (!events.length) return;
  const insert = db.prepare("INSERT INTO events (ts, type, anon_id, user_id, path, props) VALUES (?, ?, ?, ?, ?, ?)");
  await db.batch(
    events.map((e) =>
      insert.bind(
        new Date(e.ts).toISOString(),
        e.type,
        e.anonId ?? null,
        e.userId ?? null,
        e.path ?? null,
        e.props ? JSON.stringify(e.props) : null,
      ),
    ),
  );
}
