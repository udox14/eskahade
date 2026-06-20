-- Migration 0093: urutan manual santri dalam kolom grade (view grading sekpen).
-- grade_urutan kecil = posisi lebih atas (mengikuti peringkat nilai). NULL = belum diatur.
-- Idempotent: error "duplicate column name" diabaikan jika sudah ada.

ALTER TABLE riwayat_pendidikan ADD COLUMN grade_urutan INTEGER;
