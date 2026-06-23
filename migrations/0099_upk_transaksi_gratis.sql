-- ============================================================
-- Migration 0099: UPK Transaksi Gratis Santri/Guru
-- ============================================================

ALTER TABLE upk_antrian ADD COLUMN jenis_transaksi TEXT NOT NULL DEFAULT 'PENJUALAN';
ALTER TABLE upk_antrian ADD COLUMN penerima_type TEXT NOT NULL DEFAULT 'SANTRI';
ALTER TABLE upk_antrian ADD COLUMN guru_id INTEGER REFERENCES data_guru(id);
ALTER TABLE upk_antrian ADD COLUMN harga_modal_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE upk_antrian ADD COLUMN pengeluaran_id TEXT REFERENCES upk_pengeluaran(id) ON DELETE SET NULL;

ALTER TABLE upk_antrian_item ADD COLUMN harga_modal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE upk_antrian_item ADD COLUMN modal_subtotal INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_upk_antrian_jenis_tanggal
  ON upk_antrian(jenis_transaksi, tanggal);

