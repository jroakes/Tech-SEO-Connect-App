-- Settings organizers change in the app. check_in_demo ("true" or "false")
-- is the check-in desk's live switch; until someone uses it, the
-- CHECK_IN_DEMO setting in wrangler.jsonc decides.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT
);
