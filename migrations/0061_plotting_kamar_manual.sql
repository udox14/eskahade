CREATE TABLE IF NOT EXISTS fitur_akses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  title TEXT NOT NULL,
  href TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '',
  roles TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  urutan INTEGER NOT NULL DEFAULT 0,
  is_bottomnav INTEGER NOT NULL DEFAULT 0,
  bottomnav_urutan INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fitur_akses_active ON fitur_akses(is_active);
CREATE INDEX IF NOT EXISTS idx_fitur_akses_href ON fitur_akses(href);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Asrama',
  'Plotting Kamar Manual',
  '/dashboard/asrama/plotting-kamar-manual',
  'DoorOpen',
  '["admin","pengurus_asrama"]',
  1,
  6
);
