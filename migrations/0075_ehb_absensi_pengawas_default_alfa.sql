-- ============================================================
-- Migration 0075: Absensi pengawas default Alfa
-- ============================================================

-- SQLite/D1 tidak mendukung ALTER COLUMN untuk mengganti DEFAULT.
-- Aplikasi membaca row kosong sebagai TIDAK_HADIR dan semua input baru
-- selalu menulis status eksplisit, jadi migration ini menjadi penanda
-- perubahan perilaku tanpa rebuild tabel berisiko.
