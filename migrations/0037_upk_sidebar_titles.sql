-- ============================================================
-- Migration 0037: Ringkas Judul Sidebar UPK
-- ============================================================

UPDATE fitur_akses SET title = 'Kasir'
WHERE href = '/dashboard/akademik/upk/kasir';

UPDATE fitur_akses SET title = 'Katalog'
WHERE href = '/dashboard/akademik/upk/katalog';

UPDATE fitur_akses SET title = 'Manajemen'
WHERE href = '/dashboard/akademik/upk/manajemen';
