-- ============================================================
-- Migration 0035: Katalog UPK
-- ============================================================

CREATE TABLE IF NOT EXISTS upk_toko (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT NOT NULL UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

INSERT OR IGNORE INTO upk_toko (nama, is_active) VALUES
('Katara Printgraph', 1),
('Toko Kitab A. Farid', 1),
('Online', 1);

CREATE TABLE IF NOT EXISTS upk_katalog (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  kitab_id              INTEGER REFERENCES kitab(id) ON DELETE SET NULL,
  nama_kitab            TEXT NOT NULL,
  marhalah_id           INTEGER NOT NULL REFERENCES marhalah(id),
  toko_id               INTEGER REFERENCES upk_toko(id) ON DELETE SET NULL,
  stok_lama             INTEGER NOT NULL DEFAULT 0,
  stok_baru             INTEGER NOT NULL DEFAULT 0,
  harga_beli            INTEGER NOT NULL DEFAULT 0,
  harga_jual            INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  catatan               TEXT,
  stok_updated_at       TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT,
  UNIQUE(kitab_id)
);

CREATE INDEX IF NOT EXISTS idx_upk_katalog_marhalah
  ON upk_katalog(marhalah_id, is_active, nama_kitab);

CREATE INDEX IF NOT EXISTS idx_upk_katalog_toko
  ON upk_katalog(toko_id, is_active);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Katalog', '/dashboard/akademik/upk/katalog', 'BookOpen', '["admin","sekpen"]', 1, 1);

UPDATE fitur_akses SET urutan = 2 WHERE href = '/dashboard/akademik/upk/manajemen';
