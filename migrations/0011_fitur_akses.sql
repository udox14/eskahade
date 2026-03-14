-- Migration: Manajemen Fitur Akses
-- Tabel untuk menyimpan konfigurasi akses fitur per role yang bisa dikelola admin

CREATE TABLE IF NOT EXISTS fitur_akses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,        -- nama grup di sidebar (e.g. "Kesantrian", "Akademik")
  title TEXT NOT NULL,             -- label menu (e.g. "Absen Malam")
  href TEXT NOT NULL UNIQUE,       -- path unik (e.g. "/dashboard/asrama/absen-malam")
  icon TEXT NOT NULL DEFAULT '',   -- nama icon lucide (untuk referensi, tidak dirender di DB)
  roles TEXT NOT NULL,             -- JSON array string: '["admin","keamanan"]'
  is_active INTEGER NOT NULL DEFAULT 1,  -- 1 = aktif, 0 = nonaktif sementara
  urutan INTEGER NOT NULL DEFAULT 0,     -- urutan tampil dalam grup
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fitur_akses_active ON fitur_akses(is_active);
CREATE INDEX IF NOT EXISTS idx_fitur_akses_href ON fitur_akses(href);

-- ── SEED DATA (dari konfigurasi sidebar yang sudah ada) ──────────────────────

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
-- Standalone
('_standalone', 'Dashboard',    '/dashboard',        'LayoutDashboard', '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]', 1, 0),
('_standalone', 'Data Santri',  '/dashboard/santri', 'Users',           '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]', 1, 1),

-- Kesantrian
('Kesantrian', 'Sensus Penduduk',    '/dashboard/dewan-santri/sensus',                    'BarChart3',    '["admin","dewan_santri"]',                        1, 0),
('Kesantrian', 'Laporan Sensus',     '/dashboard/dewan-santri/sensus/laporan',            'Printer',      '["admin","dewan_santri"]',                        1, 1),
('Kesantrian', 'Manajemen Foto',     '/dashboard/santri/foto',                            'ImageIcon',    '["admin","dewan_santri"]',                        1, 2),
('Kesantrian', 'Layanan Surat',      '/dashboard/dewan-santri/surat',                     'Mail',         '["admin","dewan_santri"]',                        1, 3),
('Kesantrian', 'Absen Malam',        '/dashboard/asrama/absen-malam',                     'Moon',         '["admin","pengurus_asrama"]',                     1, 4),
('Kesantrian', 'Absen Berjamaah',    '/dashboard/asrama/absen-berjamaah',                 'Flame',        '["admin","pengurus_asrama"]',                     1, 5),
('Kesantrian', 'Perpindahan Kamar',  '/dashboard/asrama/perpindahan-kamar',               'ArrowLeftRight','["admin","pengurus_asrama"]',                   1, 6),
('Kesantrian', 'Absen Sakit Pagi',   '/dashboard/asrama/absen-sakit',                     'Stethoscope',  '["admin","pengurus_asrama"]',                     1, 7),
('Kesantrian', 'Katering & Laundry', '/dashboard/asrama/layanan',                         'Utensils',     '["admin","dewan_santri","pengurus_asrama"]',       1, 8),
('Kesantrian', 'Perizinan Santri',   '/dashboard/keamanan/perizinan',                     'MapPin',       '["admin","dewan_santri"]',                        1, 9),
('Kesantrian', 'Cetak Telat Datang', '/dashboard/keamanan/perizinan/cetak-telat',         'Clock',        '["admin","keamanan"]',                            1, 10),
('Kesantrian', 'Verifikasi Telat',   '/dashboard/keamanan/perizinan/verifikasi-telat',    'Gavel',        '["admin","keamanan"]',                            1, 11),
('Kesantrian', 'Rekap Absen Asrama', '/dashboard/keamanan/rekap-asrama',                  'ClipboardList','["admin","keamanan","pengurus_asrama"]',           1, 12),
('Kesantrian', 'Pelanggaran & SP',   '/dashboard/keamanan',                               'ShieldAlert',  '["admin","keamanan"]',                            1, 13),

-- Pengkelasan
('Pengkelasan', 'Tes Klasifikasi',  '/dashboard/santri/tes-klasifikasi',  'ClipboardCheck', '["admin","sekpen"]',                    1, 0),
('Pengkelasan', 'Penempatan Kelas', '/dashboard/santri/atur-kelas',       'UserPlus',       '["admin","sekpen"]',                    1, 1),
('Pengkelasan', 'Grading Santri',   '/dashboard/akademik/grading',        'BarChart3',      '["admin","sekpen","wali_kelas"]',       1, 2),
('Pengkelasan', 'Kenaikan Kelas',   '/dashboard/akademik/kenaikan',       'ArrowUpCircle',  '["admin","sekpen"]',                    1, 3),

-- Nilai & Rapor
('Nilai & Rapor', 'Input Nilai',        '/dashboard/akademik/nilai/input', 'BookOpen',       '["admin","sekpen","wali_kelas"]', 1, 0),
('Nilai & Rapor', 'Leger Nilai',        '/dashboard/akademik/leger',       'FileSpreadsheet','["admin","sekpen","wali_kelas"]', 1, 1),
('Nilai & Rapor', 'Ranking & Prestasi', '/dashboard/akademik/ranking',     'TrendingUp',     '["admin","sekpen","wali_kelas"]', 1, 2),
('Nilai & Rapor', 'Cetak Rapor',        '/dashboard/laporan/rapor',        'FileText',       '["admin","sekpen","wali_kelas"]', 1, 3),

-- Absensi
('Absensi', 'Absen Pengajian',    '/dashboard/akademik/absensi',                'CalendarCheck', '["admin","sekpen"]',                                                         1, 0),
('Absensi', 'Rekap Absensi',      '/dashboard/akademik/absensi/rekap',          'Filter',        '["admin","sekpen","wali_kelas","keamanan","dewan_santri","pengurus_asrama"]', 1, 1),
('Absensi', 'Verifikasi Absen',   '/dashboard/akademik/absensi/verifikasi',     'UserCheck',     '["admin","sekpen"]',                                                         1, 2),
('Absensi', 'Cetak Pemanggilan',  '/dashboard/akademik/absensi/cetak',          'Printer',       '["admin","sekpen"]',                                                         1, 3),
('Absensi', 'Cetak Blanko Absen', '/dashboard/akademik/absensi/cetak-blanko',   'FileText',      '["admin","sekpen"]',                                                         1, 4),
('Absensi', 'Absen Guru',         '/dashboard/akademik/absensi-guru',           'Briefcase',     '["admin","sekpen"]',                                                         1, 5),
('Absensi', 'Rekap Absen Guru',   '/dashboard/akademik/absensi-guru/rekap',     'UserCheck',     '["admin","sekpen"]',                                                         1, 6),

-- Keuangan
('Keuangan', 'Loket Pembayaran',   '/dashboard/keuangan/pembayaran',     'Coins',      '["admin","bendahara"]',         1, 0),
('Keuangan', 'Laporan Keuangan',   '/dashboard/keuangan/laporan',        'FileText',   '["admin","bendahara"]',         1, 1),
('Keuangan', 'Pembayaran SPP',     '/dashboard/asrama/spp',              'CreditCard', '["admin","pengurus_asrama"]',   1, 2),
('Keuangan', 'Uang Jajan',         '/dashboard/asrama/uang-jajan',       'Wallet',     '["admin","pengurus_asrama"]',   1, 3),
('Keuangan', 'Status Setoran',     '/dashboard/asrama/status-setoran',   'LayoutList', '["admin","pengurus_asrama"]',   1, 4),
('Keuangan', 'Monitoring Setoran', '/dashboard/dewan-santri/setoran',    'LayoutList', '["admin","dewan_santri"]',      1, 5),
('Keuangan', 'Pengaturan Tarif',   '/dashboard/keuangan/tarif',          'Settings',   '["admin","bendahara"]',         1, 6),

-- UPK
('UPK', 'Kasir UPK',      '/dashboard/akademik/upk/kasir',     'ShoppingCart', '["admin","sekpen"]', 1, 0),
('UPK', 'Manajemen UPK',  '/dashboard/akademik/upk/manajemen', 'Package',      '["admin","sekpen"]', 1, 1),

-- Master Data
('Master Data', 'Manajemen User',          '/dashboard/pengaturan/users',          'UserCog',    '["admin"]', 1, 0),
('Master Data', 'Tahun Ajaran',            '/dashboard/pengaturan/tahun-ajaran',   'CalendarDays','["admin"]', 1, 1),
('Master Data', 'Manajemen Santri',        '/dashboard/master/santri-tools',       'Users',      '["admin"]', 1, 2),
('Master Data', 'Manajemen Guru & Jadwal', '/dashboard/master/wali-kelas',         'UserCheck',  '["admin"]', 1, 3),
('Master Data', 'Manajemen Kelas',         '/dashboard/master/kelas',              'Database',   '["admin"]', 1, 4),
('Master Data', 'Manajemen Kitab',         '/dashboard/master/kitab',              'Book',       '["admin"]', 1, 5),
('Master Data', 'Master Pelanggaran',      '/dashboard/master/pelanggaran',        'Settings',   '["admin"]', 1, 6),
('Master Data', 'Arsip Alumni',            '/dashboard/santri/arsip',              'Archive',    '["admin"]', 1, 7),
('Master Data', 'Manajemen Fitur',         '/dashboard/pengaturan/fitur-akses',    'ToggleRight','["admin"]', 1, 8);
