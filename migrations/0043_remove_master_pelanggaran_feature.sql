-- Migration 0043: Hapus fitur legacy Master Pelanggaran
-- Pengaturan jenis pelanggaran sudah berada di /dashboard/keamanan tab Kamus Pelanggaran.

DELETE FROM fitur_akses
WHERE href = '/dashboard/master/pelanggaran';
