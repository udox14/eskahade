-- Migration: Fitur Santri Keluar Tengah Tahun
-- Tambah kolom tanggal_keluar dan alasan_keluar ke tabel santri
-- status_global baru: 'keluar' (beda dari 'arsip' = alumni resmi tahunan)

ALTER TABLE santri ADD COLUMN tanggal_keluar TEXT;
ALTER TABLE santri ADD COLUMN alasan_keluar  TEXT;

-- Seragamkan status dari surat BERHENTI lama (dikeluarkan → keluar)
UPDATE santri SET status_global = 'keluar'
WHERE status_global = 'dikeluarkan';

-- Seragamkan riwayat_pendidikan: status 'keluar' → 'pindah' (sesuai permintaan)
UPDATE riwayat_pendidikan SET status_riwayat = 'pindah'
WHERE status_riwayat = 'keluar';

-- Index untuk query daftar santri keluar
CREATE INDEX IF NOT EXISTS idx_santri_status_keluar ON santri(status_global, tanggal_keluar);

-- Tambah fitur Santri Keluar ke sidebar
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Kesantrian', 'Santri Keluar', '/dashboard/santri/keluar', 'UserX', '["admin","dewan_santri"]', 1, 14);
