-- ============================================================
-- Migration 0080: Highlight kata untuk progress hafalan (Jurumiyah)
-- ============================================================
-- Jurumiyah: 1 bab = 1 blok teks utuh. Progress disimpan sebagai
-- daftar indeks kata yang sudah dihafal (JSON array di kolom highlight).

ALTER TABLE hafalan_progress ADD COLUMN highlight TEXT;
