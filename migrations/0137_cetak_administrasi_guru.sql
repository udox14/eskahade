-- 0137_cetak_administrasi_guru.sql
-- Modul cetak bundle administrasi guru untuk operator akademik.

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('Akademik', 'Cetak Administrasi Guru', '/dashboard/akademik/administrasi-guru',
   'FileSpreadsheet', '["admin","sekpen","akademik"]', 1, 11, 0, 0);

UPDATE fitur_akses
SET group_name = 'Akademik',
    title = 'Cetak Administrasi Guru',
    icon = 'FileSpreadsheet',
    roles = '["admin","sekpen","akademik"]',
    is_active = 1,
    urutan = 11,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/administrasi-guru';
