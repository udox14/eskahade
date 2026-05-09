CREATE TABLE IF NOT EXISTS activity_log (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name    TEXT,
  actor_roles   TEXT,
  module        TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  entity_label  TEXT,
  summary       TEXT NOT NULL,
  details_json  TEXT,
  status        TEXT NOT NULL DEFAULT 'success',
  ip_address    TEXT,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id
  ON activity_log(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_module
  ON activity_log(module);

CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log(action);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type
  ON activity_log(entity_type);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id
  ON activity_log(entity_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Master Data', 'Log Aktivitas', '/dashboard/pengaturan/log-aktivitas', 'ClipboardList', '["admin"]', 1, 9);
