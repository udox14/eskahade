CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key        TEXT NOT NULL,
  nama             TEXT NOT NULL,
  sesi             TEXT NOT NULL,
  tempat           TEXT,
  tahun_ajaran_id  INTEGER REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tahun_ajaran_id, sesi, group_key)
);

CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian_anggota (
  group_id    INTEGER NOT NULL REFERENCES kelas_gabungan_pengajian(id) ON DELETE CASCADE,
  kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, kelas_id)
);

CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_lookup
  ON kelas_gabungan_pengajian(tahun_ajaran_id, sesi, group_key);

CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_anggota_kelas
  ON kelas_gabungan_pengajian_anggota(kelas_id);
