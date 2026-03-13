-- Konfigurasi kamar per asrama (reusable tiap tahun)
CREATE TABLE IF NOT EXISTS kamar_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  asrama      TEXT NOT NULL,
  nomor_kamar TEXT NOT NULL,
  kuota       INTEGER NOT NULL DEFAULT 10,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(asrama, nomor_kamar)
);

-- Draft perpindahan santri (sebelum & setelah apply)
CREATE TABLE IF NOT EXISTS kamar_draft (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  asrama      TEXT NOT NULL,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kamar_lama  TEXT,
  kamar_baru  TEXT NOT NULL,
  applied     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(asrama, santri_id)
);

-- Ketua kamar (permanen, update tiap tahun)
CREATE TABLE IF NOT EXISTS kamar_ketua (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  asrama      TEXT NOT NULL,
  nomor_kamar TEXT NOT NULL,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(asrama, nomor_kamar)
);
