-- ============================================================
-- Migration 0119: Statistik penjualan lengkap per kitab UPK
-- ============================================================

-- Tambahan indeks untuk laporan berfilter unit + rentang tanggal.
-- Indeks lama (status, tanggal) tetap optimal untuk laporan semua unit.
CREATE INDEX IF NOT EXISTS idx_upk_antrian_status_unit_tanggal
  ON upk_antrian(status, unit, tanggal);

-- Tempatkan Statistik setelah Pesanan; geser menu UPK setelahnya.
UPDATE fitur_akses
SET urutan = urutan + 1
WHERE group_name = 'UPK' AND urutan >= 2;

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Statistik', '/dashboard/akademik/upk/statistik', 'BarChart3', '["admin","sekpen"]', 1, 2);
