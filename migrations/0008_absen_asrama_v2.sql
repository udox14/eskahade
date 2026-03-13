-- Hapus data lama absen_asrama (harian, diganti per-tanggal)
DELETE FROM absen_asrama;

-- Absen Malam v2: per santri per tanggal
CREATE TABLE IF NOT EXISTS absen_malam_v2 (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tanggal     TEXT NOT NULL,                    -- YYYY-MM-DD
  status      TEXT NOT NULL DEFAULT 'HADIR',    -- HADIR | ALFA | IZIN
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(santri_id, tanggal)
);

-- Absen Berjamaah: per santri per tanggal, 4 waktu
-- NULL = Hadir (default, tidak disimpan), nilai hanya disimpan jika bukan Hadir
CREATE TABLE IF NOT EXISTS absen_berjamaah (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tanggal     TEXT NOT NULL,                    -- YYYY-MM-DD
  shubuh      TEXT,                             -- NULL=Hadir | A=Alfa | S=Sakit | H=Haid | P=Pulang
  ashar       TEXT,
  maghrib     TEXT,
  isya        TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(santri_id, tanggal)
);
