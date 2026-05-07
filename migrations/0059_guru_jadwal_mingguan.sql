CREATE TABLE IF NOT EXISTS kelas_jadwal_guru_mingguan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  sesi        TEXT NOT NULL,
  hari_index  INTEGER NOT NULL,
  guru_id     INTEGER NOT NULL REFERENCES data_guru(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, sesi, hari_index)
);

CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_lookup
  ON kelas_jadwal_guru_mingguan(kelas_id, sesi, hari_index);

CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_guru
  ON kelas_jadwal_guru_mingguan(guru_id, sesi, hari_index);

ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_id_snapshot INTEGER REFERENCES data_guru(id);
ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_nama_snapshot TEXT;
ALTER TABLE absensi_guru ADD COLUMN guru_ashar_id_snapshot INTEGER REFERENCES data_guru(id);
ALTER TABLE absensi_guru ADD COLUMN guru_ashar_nama_snapshot TEXT;
ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_id_snapshot INTEGER REFERENCES data_guru(id);
ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_nama_snapshot TEXT;
