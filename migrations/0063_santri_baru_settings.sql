CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value)
VALUES
  ('santri_baru_mulai_berlaku', '2026-07-01'),
  ('santri_baru_durasi_bulan', '3');

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Master Data',
  'Masa Santri Baru',
  '/dashboard/pengaturan/santri-baru',
  'CalendarDays',
  '["admin"]',
  1,
  7
);
