// Meet profiles in D1 (see migrations/0004_simpler_meet.sql).
import type { Profile } from "./matching";

interface ProfileRow {
  user_id: string;
  name: string;
  image_url: string | null;
  title: string | null;
  topics: string;
  linkedin: string | null;
}

const parseTopics = (json: string): string[] => {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
};

const toProfile = (row: ProfileRow): Profile => ({
  userId: row.user_id,
  name: row.name,
  imageUrl: row.image_url,
  title: row.title,
  topics: parseTopics(row.topics),
  linkedin: row.linkedin,
});

export async function getProfile(db: D1Database, userId: string): Promise<Profile | null> {
  const row = await db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first<ProfileRow>();
  return row ? toProfile(row) : null;
}

/** Everyone on the Meet page, most recently updated first. */
export async function listProfiles(db: D1Database): Promise<Profile[]> {
  const { results } = await db.prepare("SELECT * FROM profiles ORDER BY updated_at DESC").all<ProfileRow>();
  return results.map(toProfile);
}

export async function saveProfile(db: D1Database, profile: Profile): Promise<void> {
  await db
    .prepare(
      `INSERT INTO profiles (user_id, name, image_url, title, topics, linkedin)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (user_id) DO UPDATE SET name = ?2, image_url = ?3, title = ?4, topics = ?5, linkedin = ?6,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(profile.userId, profile.name, profile.imageUrl ?? null, profile.title || null, JSON.stringify(profile.topics), profile.linkedin || null)
    .run();
}

export async function deleteProfile(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();
}

/** The topics the attendee saved first, which they keep (see migrations/0006_locked_topics.sql), or null if they've never saved any. */
export async function getLockedTopics(db: D1Database, userId: string): Promise<string[] | null> {
  const row = await db.prepare("SELECT topics FROM meet_topics WHERE user_id = ?").bind(userId).first<{ topics: string }>();
  return row ? parseTopics(row.topics) : null;
}

/** Saves the attendee's topics the first time only, and returns the topics they're locked to. */
export async function lockTopics(db: D1Database, userId: string, topics: string[]): Promise<string[]> {
  // The no-op update makes RETURNING give back the row that was already there.
  const row = await db
    .prepare("INSERT INTO meet_topics (user_id, topics) VALUES (?1, ?2) ON CONFLICT (user_id) DO UPDATE SET user_id = user_id RETURNING topics")
    .bind(userId, JSON.stringify(topics))
    .first<{ topics: string }>();
  return row ? parseTopics(row.topics) : topics;
}
