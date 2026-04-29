-- ============================================================
-- Migration 0046: Pengeluaran UPK
-- ============================================================

CREATE TABLE IF NOT EXISTS upk_pengeluaran (
  id             TEXT PRIMARY KEY,
  tanggal        TEXT NOT NULL,
  waktu_catat    TEXT NOT NULL,
  kategori       TEXT NOT NULL DEFAULT 'LAINNYA', -- KONSUMSI | TRANSPORT | BAYAR_HUTANG_TOKO | BAYAR_PINJAMAN_MODAL | ROYALTI_PENULIS | OPERASIONAL | LAINNYA
  penerima       TEXT,
  nominal        INTEGER NOT NULL DEFAULT 0,
  belanja_id     TEXT REFERENCES upk_belanja(id) ON DELETE SET NULL,
  katalog_id     INTEGER REFERENCES upk_katalog(id) ON DELETE SET NULL,
  nama_kitab     TEXT,
  catatan        TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_upk_pengeluaran_tanggal
  ON upk_pengeluaran(tanggal, kategori);

CREATE INDEX IF NOT EXISTS idx_upk_pengeluaran_belanja
  ON upk_pengeluaran(belanja_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Pengeluaran', '/dashboard/akademik/upk/pengeluaran', 'CreditCard', '["admin","sekpen"]', 1, 4);
