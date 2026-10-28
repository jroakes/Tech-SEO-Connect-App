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

-- Sessions each signed-in user (Clerk user ID) has saved.
CREATE TABLE saved_sessions (
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, session_id)
);

-- First-party analytics: page views, map and directions clicks, saves, MCP tool calls.
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
