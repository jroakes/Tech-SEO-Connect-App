-- Meet topics can't be changed once saved, not even by leaving and joining
-- again, so no one can cycle through the topics to see everyone on Meet. Only
-- the topic IDs are kept here; leaving still deletes the profile itself.
-- Everyone already on Meet keeps the topics they have now.
CREATE TABLE meet_topics (
  user_id TEXT PRIMARY KEY,
  topics TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO meet_topics (user_id, topics) SELECT user_id, topics FROM profiles;
