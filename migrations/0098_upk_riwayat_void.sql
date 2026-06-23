-- ============================================================
-- Migration 0098: UPK Riwayat Transaksi & Void
-- ============================================================

ALTER TABLE upk_antrian ADD COLUMN void_reason TEXT;
ALTER TABLE upk_antrian ADD COLUMN voided_by TEXT REFERENCES users(id);
ALTER TABLE upk_antrian ADD COLUMN voided_at TEXT;

CREATE INDEX IF NOT EXISTS idx_upk_antrian_status_tanggal
  ON upk_antrian(status, tanggal);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Riwayat Transaksi', '/dashboard/akademik/upk/riwayat', 'Clock', '["admin","sekpen"]', 1, 5);
