-- ============================================================
-- Migration 0067: Restore Verifikasi Absensi and Cetak Pemanggilan Sidebar
-- ============================================================

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Absensi Akademik', 'Verifikasi Absensi', '/dashboard/akademik/absensi/verifikasi', 'UserCheck', '["admin","sekpen"]', 1, 2),
  ('Absensi Akademik', 'Cetak Pemanggilan', '/dashboard/akademik/absensi/cetak', 'Printer', '["admin","sekpen"]', 1, 3);

UPDATE fitur_akses
SET group_name = 'Absensi Akademik',
    title = 'Verifikasi Absensi',
    icon = 'UserCheck',
    roles = '["admin","sekpen"]',
    is_active = 1,
    urutan = 2,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/verifikasi';

UPDATE fitur_akses
SET group_name = 'Absensi Akademik',
    title = 'Cetak Pemanggilan',
    icon = 'Printer',
    roles = '["admin","sekpen"]',
    is_active = 1,
    urutan = 3,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/cetak';
