INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Guru', 'Guru', '/dashboard/guru', 'GraduationCap', '["admin","guru"]', 1, 0);

UPDATE fitur_akses
SET roles = '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","guru","bendahara"]',
    updated_at = datetime('now')
WHERE href = '/dashboard'
  AND roles NOT LIKE '%"guru"%';

UPDATE fitur_akses
SET group_name = 'Guru',
    title = 'Guru',
    icon = 'GraduationCap',
    roles = '["admin","guru"]',
    is_active = 1,
    urutan = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/guru';
