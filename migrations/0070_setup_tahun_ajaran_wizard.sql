CREATE TABLE IF NOT EXISTS setup_wizard_overrides (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id  INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  item_key         TEXT NOT NULL,
  status           TEXT NOT NULL CHECK(status IN ('complete', 'skipped')),
  note             TEXT,
  updated_by       TEXT REFERENCES users(id),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tahun_ajaran_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_setup_wizard_overrides_tahun
  ON setup_wizard_overrides(tahun_ajaran_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Master Data',
  'Setup Tahun Ajaran',
  '/dashboard/setup-tahun-ajaran',
  'ClipboardList',
  '["admin"]',
  1,
  2
);
