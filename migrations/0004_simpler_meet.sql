-- Meet, simplified: each attendee gives a name, a title, the topics they're
-- interested in and, optionally, their LinkedIn so people can message them to
-- meet up. Existing answers keep their name, title and topics (both old lists).
CREATE TABLE profiles_new (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  title TEXT,
  topics TEXT NOT NULL DEFAULT '[]',
  linkedin TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO profiles_new (user_id, name, image_url, title, topics, created_at, updated_at)
SELECT
  user_id,
  name,
  image_url,
  role,
  (SELECT json_group_array(value) FROM (SELECT value FROM json_each(learn_topics) UNION SELECT value FROM json_each(help_topics))),
  created_at,
  updated_at
FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;
