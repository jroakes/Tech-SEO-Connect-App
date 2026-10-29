// Matchmaking profiles in D1 (see migrations/0003_profiles.sql).
import type { Profile } from "./matching";

interface ProfileRow {
  user_id: string;
  name: string;
  image_url: string | null;
  role: string | null;
  working_on: string | null;
  want_to_learn: string | null;
  can_help: string | null;
  learn_topics: string;
  help_topics: string;
  contact: string | null;
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
  role: row.role,
  workingOn: row.working_on,
  wantToLearn: row.want_to_learn,
  canHelp: row.can_help,
  learnTopics: parseTopics(row.learn_topics),
  helpTopics: parseTopics(row.help_topics),
  contact: row.contact,
});

export async function getProfile(db: D1Database, userId: string): Promise<Profile | null> {
  const row = await db.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first<ProfileRow>();
  return row ? toProfile(row) : null;
}

/** Everyone in matchmaking, most recently updated first. */
export async function listProfiles(db: D1Database): Promise<Profile[]> {
  const { results } = await db.prepare("SELECT * FROM profiles ORDER BY updated_at DESC").all<ProfileRow>();
  return results.map(toProfile);
}

export async function saveProfile(db: D1Database, profile: Profile): Promise<void> {
  await db
    .prepare(
      `INSERT INTO profiles (user_id, name, image_url, role, working_on, want_to_learn, can_help, learn_topics, help_topics, contact)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT (user_id) DO UPDATE SET name = ?2, image_url = ?3, role = ?4, working_on = ?5, want_to_learn = ?6, can_help = ?7,
         learn_topics = ?8, help_topics = ?9, contact = ?10, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      profile.userId,
      profile.name,
      profile.imageUrl ?? null,
      profile.role || null,
      profile.workingOn || null,
      profile.wantToLearn || null,
      profile.canHelp || null,
      JSON.stringify(profile.learnTopics),
      JSON.stringify(profile.helpTopics),
      profile.contact || null,
    )
    .run();
}

export async function deleteProfile(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();
}
