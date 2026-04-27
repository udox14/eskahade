-- ============================================================
-- Migration 0039: Hapus Fitur Manajemen UPK
-- ============================================================

DELETE FROM fitur_akses
WHERE href = '/dashboard/akademik/upk/manajemen';
