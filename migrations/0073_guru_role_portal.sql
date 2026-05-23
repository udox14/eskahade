UPDATE fitur_akses
SET roles = '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","guru","bendahara"]',
    updated_at = datetime('now')
WHERE href = '/dashboard'
  AND roles NOT LIKE '%"guru"%';

DELETE FROM fitur_akses
WHERE href = '/dashboard/guru';
