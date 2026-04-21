-- Migration 0023: Split Rekap Absen Asrama menjadi dua halaman terpisah

-- Ubah entri lama menjadi Rekap Absen Malam
UPDATE fitur_akses
SET title = 'Rekap Absen Malam',
    href  = '/dashboard/keamanan/rekap-absen-malam',
    icon  = 'Moon'
WHERE href = '/dashboard/keamanan/rekap-asrama';

-- Geser Pelanggaran & SP ke urutan 14 untuk memberi ruang
UPDATE fitur_akses
SET urutan = 14
WHERE href = '/dashboard/keamanan' AND group_name = 'Kesantrian';

-- Tambahkan entri Rekap Absen Berjamaah
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Kesantrian',
  'Rekap Absen Berjamaah',
  '/dashboard/keamanan/rekap-absen-berjamaah',
  'Flame',
  '["admin","keamanan","pengurus_asrama"]',
  1, 13
);
