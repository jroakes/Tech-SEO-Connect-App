-- People added at the door, kept apart from their check-ins, so taking a
-- check-in back leaves them on the desk. Demo ones are kept apart, as demo
-- check-ins are.
CREATE TABLE walk_ins (
  guest_id TEXT NOT NULL,
  demo INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (guest_id, demo)
);

INSERT INTO walk_ins (guest_id, demo, name, email, added_at)
  SELECT guest_id, demo, name, email, checked_in_at FROM check_ins WHERE walk_in = 1;
