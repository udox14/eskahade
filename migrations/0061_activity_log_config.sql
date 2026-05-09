CREATE TABLE IF NOT EXISTS activity_log_config (
  fitur_href   TEXT PRIMARY KEY,
  group_name   TEXT NOT NULL,
  title        TEXT NOT NULL,
  log_create   INTEGER NOT NULL DEFAULT 1,
  log_update   INTEGER NOT NULL DEFAULT 1,
  log_delete   INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO activity_log_config (
  fitur_href, group_name, title, log_create, log_update, log_delete, updated_at
)
SELECT href, group_name, title, 1, 1, 1, datetime('now')
FROM fitur_akses
WHERE href IS NOT NULL
  AND TRIM(href) <> '';
