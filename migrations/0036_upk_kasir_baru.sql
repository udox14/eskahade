-- ============================================================
-- Migration 0036: Kasir UPK Baru
-- ============================================================

CREATE TABLE IF NOT EXISTS upk_antrian (
  id                  TEXT PRIMARY KEY,
  tanggal             TEXT NOT NULL,
  nomor               INTEGER NOT NULL,
  unit                TEXT NOT NULL,                  -- PUTRA | PUTRI
  santri_id           TEXT REFERENCES santri(id),
  nis                 TEXT,
  nama_santri         TEXT NOT NULL,
  kelas_id            TEXT REFERENCES kelas(id),
  kelas_nama          TEXT,
  marhalah_id         INTEGER REFERENCES marhalah(id),
  marhalah_nama       TEXT,
  total_tagihan       INTEGER NOT NULL DEFAULT 0,
  total_bayar         INTEGER NOT NULL DEFAULT 0,
  sisa_kembalian      INTEGER NOT NULL DEFAULT 0,
  kembalian_ditahan   INTEGER NOT NULL DEFAULT 0,
  sisa_tunggakan      INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'ANTRIAN', -- ANTRIAN | SELESAI
  catatan             TEXT,
  created_by          TEXT REFERENCES users(id),
  cashier_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at             TEXT,
  updated_at          TEXT,
  UNIQUE(tanggal, unit, nomor)
);

CREATE INDEX IF NOT EXISTS idx_upk_antrian_tanggal_unit
  ON upk_antrian(tanggal, unit, nomor);

CREATE INDEX IF NOT EXISTS idx_upk_antrian_santri
  ON upk_antrian(santri_id, status);

CREATE TABLE IF NOT EXISTS upk_antrian_item (
  id             TEXT PRIMARY KEY,
  antrian_id     TEXT NOT NULL REFERENCES upk_antrian(id) ON DELETE CASCADE,
  katalog_id     INTEGER REFERENCES upk_katalog(id) ON DELETE SET NULL,
  nama_kitab     TEXT NOT NULL,
  marhalah_id    INTEGER REFERENCES marhalah(id),
  marhalah_nama  TEXT,
  qty            INTEGER NOT NULL DEFAULT 1,
  harga_jual     INTEGER NOT NULL DEFAULT 0,
  subtotal       INTEGER NOT NULL DEFAULT 0,
  status_serah   TEXT NOT NULL DEFAULT 'SUDAH',       -- SUDAH | BELUM
  masuk_pesanan  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_antrian_item_antrian
  ON upk_antrian_item(antrian_id);

CREATE INDEX IF NOT EXISTS idx_upk_antrian_item_katalog
  ON upk_antrian_item(katalog_id, status_serah);

CREATE TABLE IF NOT EXISTS upk_stok_mutasi (
  id              TEXT PRIMARY KEY,
  katalog_id      INTEGER REFERENCES upk_katalog(id) ON DELETE SET NULL,
  antrian_id      TEXT REFERENCES upk_antrian(id) ON DELETE SET NULL,
  antrian_item_id TEXT REFERENCES upk_antrian_item(id) ON DELETE SET NULL,
  tanggal         TEXT NOT NULL,
  unit            TEXT,
  tipe            TEXT NOT NULL,                      -- PENJUALAN | PESANAN_SERAH | ADJUSTMENT
  qty_lama        INTEGER NOT NULL DEFAULT 0,
  qty_baru        INTEGER NOT NULL DEFAULT 0,
  total_qty       INTEGER NOT NULL DEFAULT 0,
  catatan         TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_upk_stok_mutasi_katalog
  ON upk_stok_mutasi(katalog_id, tanggal);
