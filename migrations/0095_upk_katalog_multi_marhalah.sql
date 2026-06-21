-- ============================================================
-- Migration 0095: Katalog UPK multi-marhalah
-- ============================================================
-- 1 item katalog = 1 pool stok, bisa dipakai di banyak marhalah.
-- Tiap relasi marhalah punya flag is_default (auto-ceklis di kasir).
-- Mulai bersih: data katalog lama dikosongkan, diisi ulang lewat modal.

-- Lepaskan referensi katalog di tabel anak agar tidak menggantung
UPDATE upk_antrian_item SET katalog_id = NULL;
UPDATE upk_stok_mutasi SET katalog_id = NULL;
UPDATE upk_rencana_belanja_item SET katalog_id = NULL;
UPDATE upk_belanja_item SET katalog_id = NULL;

DROP INDEX IF EXISTS idx_upk_katalog_marhalah;
DROP INDEX IF EXISTS idx_upk_katalog_toko;
DROP TABLE IF EXISTS upk_katalog;

CREATE TABLE upk_katalog (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  kitab_id              INTEGER REFERENCES kitab(id) ON DELETE SET NULL,
  nama_kitab            TEXT NOT NULL,
  toko_id               INTEGER REFERENCES upk_toko(id) ON DELETE SET NULL,
  stok_lama             INTEGER NOT NULL DEFAULT 0,
  stok_baru             INTEGER NOT NULL DEFAULT 0,
  harga_beli            INTEGER NOT NULL DEFAULT 0,
  harga_jual            INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  catatan               TEXT,
  stok_updated_at       TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_katalog_aktif
  ON upk_katalog(is_active, nama_kitab);

CREATE INDEX IF NOT EXISTS idx_upk_katalog_toko
  ON upk_katalog(toko_id, is_active);

CREATE TABLE IF NOT EXISTS upk_katalog_marhalah (
  katalog_id   INTEGER NOT NULL REFERENCES upk_katalog(id) ON DELETE CASCADE,
  marhalah_id  INTEGER NOT NULL REFERENCES marhalah(id),
  is_default   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (katalog_id, marhalah_id)
);

CREATE INDEX IF NOT EXISTS idx_upk_katalog_marhalah_marhalah
  ON upk_katalog_marhalah(marhalah_id, is_default);
