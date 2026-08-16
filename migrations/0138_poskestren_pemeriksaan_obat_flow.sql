-- ============================================================
-- Migration 0138: POSKESTREN Pemeriksaan - alur pendaftaran → pemeriksaan → penyerahan obat.
-- (Semula bernomor 0135, direnumber karena bentrok dengan
-- 0135_legacy_sidebar_fixes.sql yang sudah lebih dulu memakai nomor itu.
-- Isi migrasi tidak berubah.)
-- Strategi: TANPA rebuild tabel (aman terhadap foreign key di D1).
-- 1. Tanda vital pendaftaran disimpan pada kunjungan.
-- 2. Kolom awaiting_medicine=1 menandakan pemeriksaan dokter selesai
--    dan obat belum diserahkan petugas (status kunjungan tetap 'DIPERIKSA').
-- 3. Potong stok terjadi saat penyerahan obat, bukan saat pemeriksaan.
--
-- CATATAN: file ini untuk database baru (fresh install). Untuk database
-- yang sudah pernah menerima migrasi versi lama (rebuild) atau dalam
-- kondisi parsial, gunakan: node scripts/migrate-0135-obat-flow.mjs
-- ============================================================

-- Bersihkan sisa tabel dari percobaan migrasi rebuild lama (jika ada).
DROP TABLE IF EXISTS poskestren_visit_new;
DROP TABLE IF EXISTS poskestren_visit_legacy;
DROP TABLE IF EXISTS poskestren_visit_old;

ALTER TABLE poskestren_visit ADD COLUMN temperature_celsius REAL;
ALTER TABLE poskestren_visit ADD COLUMN systolic_pressure INTEGER;
ALTER TABLE poskestren_visit ADD COLUMN diastolic_pressure INTEGER;
ALTER TABLE poskestren_visit ADD COLUMN weight_kg REAL;
ALTER TABLE poskestren_visit ADD COLUMN awaiting_medicine INTEGER NOT NULL DEFAULT 0 CHECK (awaiting_medicine IN (0,1));
