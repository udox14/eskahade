-- ============================================================
-- Migration 0076: Fitur Guru - Nilai Harian & Hafalan per Marhalah
-- ============================================================

CREATE TABLE IF NOT EXISTS nilai_harian_sesi (
  id               TEXT PRIMARY KEY,
  kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  mapel_id         INTEGER NOT NULL REFERENCES mapel(id),
  guru_id          INTEGER REFERENCES data_guru(id),
  tahun_ajaran_id  INTEGER REFERENCES tahun_ajaran(id),
  tanggal          TEXT NOT NULL,
  nama_sesi        TEXT NOT NULL,
  kkm              INTEGER NOT NULL DEFAULT 0,
  deskripsi        TEXT,
  created_by       TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nilai_harian_detail (
  id                    TEXT PRIMARY KEY,
  sesi_id               TEXT NOT NULL REFERENCES nilai_harian_sesi(id) ON DELETE CASCADE,
  riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
  nilai                 INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sesi_id, riwayat_pendidikan_id)
);

CREATE TABLE IF NOT EXISTS hafalan_bab (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis        TEXT NOT NULL,
  marhalah_id  INTEGER NOT NULL REFERENCES marhalah(id),
  parent_id    INTEGER REFERENCES hafalan_bab(id) ON DELETE CASCADE,
  judul        TEXT NOT NULL,
  urutan       INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hafalan_blok (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bab_id      INTEGER NOT NULL REFERENCES hafalan_bab(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  deskripsi   TEXT,
  urutan      INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hafalan_progress (
  id                    TEXT PRIMARY KEY,
  blok_id               INTEGER NOT NULL REFERENCES hafalan_blok(id) ON DELETE CASCADE,
  riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
  guru_id               INTEGER REFERENCES data_guru(id),
  status                TEXT NOT NULL DEFAULT 'hafal',
  tanggal_setor         TEXT NOT NULL DEFAULT (date('now')),
  updated_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(blok_id, riwayat_pendidikan_id)
);

CREATE INDEX IF NOT EXISTS idx_nilai_harian_sesi_kelas
  ON nilai_harian_sesi(kelas_id, mapel_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_nilai_harian_detail_sesi
  ON nilai_harian_detail(sesi_id);
CREATE INDEX IF NOT EXISTS idx_hafalan_bab_lookup
  ON hafalan_bab(jenis, marhalah_id, is_active, urutan);
CREATE INDEX IF NOT EXISTS idx_hafalan_bab_parent
  ON hafalan_bab(parent_id);
CREATE INDEX IF NOT EXISTS idx_hafalan_blok_bab
  ON hafalan_blok(bab_id, is_active, urutan);
CREATE INDEX IF NOT EXISTS idx_hafalan_progress_riwayat
  ON hafalan_progress(riwayat_pendidikan_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('Akademik', 'Nilai Harian', '/dashboard/guru/nilai-harian', 'BookOpen', '["admin","sekpen","akademik","guru"]', 1, 8, 1, 3),
  ('Akademik', 'Hafalan', '/dashboard/guru/hafalan', 'ClipboardCheck', '["admin","sekpen","akademik","guru"]', 1, 9, 1, 4),
  ('Master Data', 'Master Hafalan', '/dashboard/master/hafalan', 'Database', '["admin"]', 1, 11, 0, 0);
