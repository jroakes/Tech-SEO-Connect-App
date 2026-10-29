-- Matchmaking: one profile per signed-in attendee (Clerk user ID) who answered
-- the questionnaire. Topics are JSON arrays of IDs from src/data/topics.ts.
-- Joining matchmaking shows the profile to other attendees who have joined.
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  role TEXT,
  working_on TEXT,
  want_to_learn TEXT,
  can_help TEXT,
  learn_topics TEXT NOT NULL DEFAULT '[]',
  help_topics TEXT NOT NULL DEFAULT '[]',
  contact TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
