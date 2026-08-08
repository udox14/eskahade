-- Migration 0136: Rekap Absensi - beri akses role guru
-- Idempotent. Guru/wali_kelas hanya melihat kelas yang diajarnya / kelas walinya.
UPDATE fitur_akses
SET roles = '["admin","sekpen","guru","wali_kelas","keamanan","dewan_santri","pengurus_asrama"]'
WHERE href = '/dashboard/akademik/absensi/rekap';
