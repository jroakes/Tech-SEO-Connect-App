-- Places (hotels, restaurants, bars, coffee, things to do) each signed-in
-- user (Clerk user ID) has saved. Place IDs come from src/data/places.json.
CREATE TABLE saved_places (
  user_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, place_id)
);
