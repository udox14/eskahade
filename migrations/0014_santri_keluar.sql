-- Migration: Fitur Santri Keluar Tengah Tahun
-- SQLite tidak punya ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- Workaround: coba tambah kolom, kalau sudah ada akan error tapi lanjut

-- Jalankan satu per satu kalau error:
ALTER TABLE santri ADD COLUMN tanggal_keluar TEXT;
ALTER TABLE santri ADD COLUMN alasan_keluar  TEXT;

-- Seragamkan status lama dari layanan surat (dikeluarkan → keluar)
UPDATE santri SET status_global = 'keluar'
WHERE status_global = 'dikeluarkan';

-- Seragamkan riwayat_pendidikan (keluar → pindah)
UPDATE riwayat_pendidikan SET status_riwayat = 'pindah'
WHERE status_riwayat = 'keluar';

-- Index untuk query daftar santri keluar
CREATE INDEX IF NOT EXISTS idx_santri_status_keluar ON santri(status_global, tanggal_keluar);

-- Tambah fitur ke sidebar
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Kesantrian', 'Santri Keluar', '/dashboard/santri/keluar', 'UserX', '["admin","dewan_santri"]', 1, 14);
