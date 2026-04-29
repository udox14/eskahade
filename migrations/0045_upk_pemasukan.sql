-- ============================================================
-- Migration 0045: Pemasukan UPK
-- ============================================================

CREATE TABLE IF NOT EXISTS upk_pemasukan (
  id                    TEXT PRIMARY KEY,
  tanggal               TEXT NOT NULL,
  waktu_catat           TEXT NOT NULL,
  kategori              TEXT NOT NULL DEFAULT 'SETORAN_PENJUALAN', -- SETORAN_PENJUALAN | PINJAMAN_MODAL | LAINNYA
  sumber                TEXT,
  nominal               INTEGER NOT NULL DEFAULT 0,
  penjualan_seharusnya  INTEGER NOT NULL DEFAULT 0,
  selisih               INTEGER NOT NULL DEFAULT 0,
  catatan               TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_pemasukan_tanggal
  ON upk_pemasukan(tanggal, kategori);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Pemasukan', '/dashboard/akademik/upk/pemasukan', 'Wallet', '["admin","sekpen"]', 1, 3);
