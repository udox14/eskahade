-- ============================================================
-- Migration 0040: Belanja UPK
-- ============================================================

CREATE TABLE IF NOT EXISTS upk_rencana_belanja (
  id             TEXT PRIMARY KEY,
  tanggal        TEXT NOT NULL,
  nama           TEXT NOT NULL,
  persen_target  INTEGER NOT NULL DEFAULT 75,
  status         TEXT NOT NULL DEFAULT 'DRAFT',       -- DRAFT | SELESAI
  catatan        TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS upk_rencana_belanja_item (
  id              TEXT PRIMARY KEY,
  rencana_id      TEXT NOT NULL REFERENCES upk_rencana_belanja(id) ON DELETE CASCADE,
  katalog_id      INTEGER REFERENCES upk_katalog(id) ON DELETE SET NULL,
  nama_kitab      TEXT NOT NULL,
  marhalah_id     INTEGER REFERENCES marhalah(id),
  marhalah_nama   TEXT,
  jumlah_santri   INTEGER NOT NULL DEFAULT 0,
  stok_lama       INTEGER NOT NULL DEFAULT 0,
  stok_baru       INTEGER NOT NULL DEFAULT 0,
  persen_target   INTEGER NOT NULL DEFAULT 75,
  saran_qty       INTEGER NOT NULL DEFAULT 0,
  qty_rencana     INTEGER NOT NULL DEFAULT 0,
  harga_beli      INTEGER NOT NULL DEFAULT 0,
  subtotal        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_rencana_item_rencana
  ON upk_rencana_belanja_item(rencana_id);

CREATE TABLE IF NOT EXISTS upk_belanja (
  id                 TEXT PRIMARY KEY,
  tanggal            TEXT NOT NULL,
  jenis              TEXT NOT NULL DEFAULT 'TAMBAHAN', -- AWAL | TAMBAHAN
  toko_id            INTEGER REFERENCES upk_toko(id) ON DELETE SET NULL,
  toko_nama          TEXT,
  status_pembayaran  TEXT NOT NULL DEFAULT 'HUTANG',  -- LUNAS | HUTANG | SEBAGIAN
  total              INTEGER NOT NULL DEFAULT 0,
  dibayar            INTEGER NOT NULL DEFAULT 0,
  sisa_hutang        INTEGER NOT NULL DEFAULT 0,
  catatan            TEXT,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_belanja_tanggal
  ON upk_belanja(tanggal, status_pembayaran);

CREATE TABLE IF NOT EXISTS upk_belanja_item (
  id             TEXT PRIMARY KEY,
  belanja_id     TEXT NOT NULL REFERENCES upk_belanja(id) ON DELETE CASCADE,
  katalog_id     INTEGER REFERENCES upk_katalog(id) ON DELETE SET NULL,
  nama_kitab     TEXT NOT NULL,
  marhalah_id    INTEGER REFERENCES marhalah(id),
  marhalah_nama  TEXT,
  qty            INTEGER NOT NULL DEFAULT 0,
  harga_beli     INTEGER NOT NULL DEFAULT 0,
  subtotal       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_belanja_item_belanja
  ON upk_belanja_item(belanja_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Belanja', '/dashboard/akademik/upk/belanja', 'ShoppingBag', '["admin","sekpen"]', 1, 2);
