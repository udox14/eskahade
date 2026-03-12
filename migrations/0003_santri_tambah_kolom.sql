-- ============================================================
-- Migration 0003: Tambah kolom baru di tabel santri
-- ============================================================

ALTER TABLE santri ADD COLUMN gol_darah        TEXT;           -- A | B | AB | O
ALTER TABLE santri ADD COLUMN alamat_lengkap   TEXT;           -- Jalan/Kampung, RT/RW sampai Desa
ALTER TABLE santri ADD COLUMN kecamatan        TEXT;
ALTER TABLE santri ADD COLUMN kab_kota         TEXT;
ALTER TABLE santri ADD COLUMN provinsi         TEXT;
ALTER TABLE santri ADD COLUMN jemaah           TEXT;           -- Pengelompokan berdasarkan alamat
ALTER TABLE santri ADD COLUMN no_wa_ortu       TEXT;           -- No. WhatsApp Orang Tua
ALTER TABLE santri ADD COLUMN tanggal_masuk    TEXT;           -- YYYY-MM-DD
ALTER TABLE santri ADD COLUMN tanggal_keluar   TEXT;           -- YYYY-MM-DD, diisi jika keluar sebelum lulus
