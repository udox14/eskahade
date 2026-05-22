-- ============================================================
-- Migration 0068: Add Vonis Final Pengajian Sidebar Entry
-- ============================================================

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Absensi Akademik', 'Vonis Final Pengajian', '/dashboard/akademik/absensi/vonis-final', 'ClipboardCheck', '["admin","sekpen"]', 1, 3);

UPDATE fitur_akses
SET group_name = 'Absensi Akademik',
    title = 'Vonis Final Pengajian',
    icon = 'ClipboardCheck',
    roles = '["admin","sekpen"]',
    is_active = 1,
    urutan = 3,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/vonis-final';

UPDATE fitur_akses
SET urutan = 4,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/cetak';

UPDATE fitur_akses
SET urutan = 5,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/cetak-blanko';
