-- ============================================================
-- Migration 0029: Tambah fitur Cetak ke modul EHB
-- ============================================================

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Cetak EHB', '/dashboard/ehb/cetak', 'Printer', '["admin"]', 1, 10);
