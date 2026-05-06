UPDATE fitur_akses
SET roles = '["admin","pengurus_asrama","dewan_santri"]'
WHERE href IN ('/dashboard/asrama/spp', '/dashboard/asrama/status-setoran');
