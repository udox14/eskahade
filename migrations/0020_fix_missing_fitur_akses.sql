-- Migration 0020: Fix entri fitur_akses yang hilang
-- Beberapa halaman sudah pakai guardPage di kode tapi belum terdaftar di DB,
-- menyebabkan semua non-admin di-redirect ke /dashboard.

-- 1. Input Santri (sekpen yang bertugas mendata santri baru)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  '_standalone',
  'Input Santri',
  '/dashboard/santri/input',
  'UserPlus',
  '["admin","sekpen"]',
  1, 2
);

-- 2. Santri Keluar (pencatatan santri yang berhenti/keluar)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  '_standalone',
  'Santri Keluar',
  '/dashboard/santri/keluar',
  'LogOut',
  '["admin","sekpen"]',
  1, 3
);

-- 3. Export Data Santri (pengurus_asrama dibatasi ke asrama binaan di level actions)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  '_standalone',
  'Export Santri',
  '/dashboard/santri/export',
  'Download',
  '["admin","sekpen","pengurus_asrama"]',
  1, 4
);

-- 4. Monitoring Uang Jajan (oleh dewan santri)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Keuangan',
  'Monitoring Uang Jajan',
  '/dashboard/dewan-santri/uang-jajan',
  'Wallet',
  '["admin","dewan_santri"]',
  1, 7
);

-- 5. Surat Santri (halaman SP/SK, hanya keamanan & dewan santri)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Kesantrian',
  'Surat Santri (SP/SK)',
  '/dashboard/surat-santri',
  'FileWarning',
  '["admin","keamanan","dewan_santri"]',
  1, 14
);
