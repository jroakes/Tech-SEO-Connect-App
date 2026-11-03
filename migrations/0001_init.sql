-- Schedule, filled by the hourly sync from the main site.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  day INTEGER NOT NULL,
  date TEXT,
  sort INTEGER NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  title TEXT NOT NULL,
  speaker TEXT,
  is_break INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  status TEXT NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0,
  message TEXT
);

-- Talks and places (IDs from src/data/places.json) each signed-in user
-- (Clerk user ID) has saved.
CREATE TABLE saved_sessions (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, session_id)
);

CREATE TABLE saved_places (
  user_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, place_id)
);

-- The event log, which the analytics page reads: page views, saves,
-- directions, Meet, check-ins, MCP tool calls and more.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  anon_id TEXT,
  user_id TEXT,
  path TEXT,
  props TEXT
);

CREATE INDEX events_type_ts ON events (type, ts);

-- Meet: each attendee who joined gives a name, a title, the topics they're
-- interested in (a JSON array of IDs from src/data/topics.ts) and, optionally,
-- their LinkedIn.
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  title TEXT,
  topics TEXT NOT NULL DEFAULT '[]',
  linkedin TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Meet topics can't be changed once saved, not even by leaving and joining
-- again, so no one can cycle through the topics to see everyone on Meet.
-- Leaving deletes the profile but keeps this row.
CREATE TABLE meet_topics (
  user_id TEXT PRIMARY KEY,
  topics TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Check-in at the door (/admin/check-in): a copy of the event's Luma guest
-- list, so a search doesn't wait on Luma, which sends 50 guests per request.
-- One row per event: the guests as JSON.
CREATE TABLE guest_list (
  event_id TEXT PRIMARY KEY,
  guests TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);

-- Who was checked in, by whom. Walk-ins added at the desk have a walkin-… ID.
-- Demo check-ins (demo = 1) are kept apart from real ones.
CREATE TABLE check_ins (
  guest_id TEXT NOT NULL,
  demo INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  walk_in INTEGER NOT NULL DEFAULT 0,
  checked_in_by TEXT,
  checked_in_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (guest_id, demo)
);
