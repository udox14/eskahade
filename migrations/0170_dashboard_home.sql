-- Configurable dashboard home. Existing feature and finance tables remain unchanged.
CREATE TABLE IF NOT EXISTS dashboard_role_widgets (
  role TEXT NOT NULL,
  widget_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id),
  PRIMARY KEY (role, widget_key)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_role_widgets_role_position
  ON dashboard_role_widgets(role, enabled, position);

CREATE TABLE IF NOT EXISTS dashboard_user_shortcuts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fitur_id INTEGER NOT NULL REFERENCES fitur_akses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 7),
  PRIMARY KEY (user_id, fitur_id),
  UNIQUE (user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_user_shortcuts_user_position
  ON dashboard_user_shortcuts(user_id, position);

CREATE INDEX IF NOT EXISTS idx_dashboard_activity_actor_date
  ON activity_log(actor_user_id, created_at DESC);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Master Data', 'Pengaturan Dashboard', '/dashboard/pengaturan/dashboard', 'Palette', '["admin"]', 1, 12);

CREATE TABLE IF NOT EXISTS dashboard_user_shortcut_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_reconciliation_open
  ON finance_reconciliation_items(resolution_action, match_status);

CREATE INDEX IF NOT EXISTS idx_dashboard_absen_malam_date_status
  ON absen_malam_v2(tanggal, status, santri_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_jadwal_hari_sesi
  ON kelas_jadwal_guru_mingguan(hari_index, sesi, kelas_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_payments_fund_date
  ON finance_payments(fund_management, paid_at);
