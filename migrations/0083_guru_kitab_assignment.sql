-- Migration 0083: Pembagian kitab guru per tahun ajaran

CREATE TABLE IF NOT EXISTS guru_kitab_assignment (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id  INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  sesi             TEXT NOT NULL,
  hari_index       INTEGER,
  guru_id          INTEGER NOT NULL REFERENCES data_guru(id),
  kitab_id         INTEGER NOT NULL REFERENCES kitab(id),
  source           TEXT NOT NULL DEFAULT 'manual',
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_kitab_assignment_unique
ON guru_kitab_assignment(tahun_ajaran_id, kelas_id, sesi, COALESCE(hari_index, -1), kitab_id);

CREATE INDEX IF NOT EXISTS idx_guru_kitab_assignment_lookup
ON guru_kitab_assignment(tahun_ajaran_id, kelas_id, sesi, hari_index, is_active);

CREATE INDEX IF NOT EXISTS idx_guru_kitab_assignment_guru
ON guru_kitab_assignment(guru_id, tahun_ajaran_id, is_active);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Master Data', 'Pembagian Kitab Guru', '/dashboard/master/guru-kitab', 'BookOpen', '["admin"]', 1, 6);
