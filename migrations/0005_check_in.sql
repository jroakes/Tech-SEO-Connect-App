-- Guest check-in at the door (/admin/check-in).

-- A copy of the event's Luma guest list, so a search doesn't wait on Luma,
-- which sends 50 guests per request. One row per event: the guests as JSON.
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
