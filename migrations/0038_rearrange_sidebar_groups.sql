-- Migration 0038: Rapikan kategori dan urutan fitur sidebar
-- Idempotent: melengkapi entri yang mungkin belum ada, lalu menormalkan grup/title/urutan.

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('_standalone', 'Dashboard', '/dashboard', 'LayoutDashboard', '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]', 1, 0),

('Data Santri', 'Data Santri', '/dashboard/santri', 'Users', '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]', 1, 0),
('Data Santri', 'Input Santri', '/dashboard/santri/input', 'UserPlus', '["admin","sekpen"]', 1, 1),
('Data Santri', 'Export Santri', '/dashboard/santri/export', 'Download', '["admin","sekpen","pengurus_asrama"]', 1, 2),
('Data Santri', 'Manajemen Foto', '/dashboard/santri/foto', 'ImageIcon', '["admin","dewan_santri"]', 1, 3),
('Data Santri', 'Santri Keluar', '/dashboard/santri/keluar', 'UserX', '["admin","sekpen","dewan_santri"]', 1, 4),
('Data Santri', 'Arsip Alumni', '/dashboard/santri/arsip', 'Archive', '["admin"]', 1, 5),

('Kesantrian', 'Sensus Penduduk', '/dashboard/dewan-santri/sensus', 'BarChart3', '["admin","dewan_santri"]', 1, 0),
('Kesantrian', 'Laporan Sensus', '/dashboard/dewan-santri/sensus/laporan', 'Printer', '["admin","dewan_santri"]', 1, 1),
('Kesantrian', 'Layanan Surat', '/dashboard/dewan-santri/surat', 'Mail', '["admin","dewan_santri"]', 1, 2),

('Asrama', 'Absen Malam', '/dashboard/asrama/absen-malam', 'Moon', '["admin","pengurus_asrama"]', 1, 0),
('Asrama', 'Absen Berjamaah', '/dashboard/asrama/absen-berjamaah', 'Flame', '["admin","pengurus_asrama"]', 1, 1),
('Asrama', 'Rekap Absen Malam', '/dashboard/keamanan/rekap-absen-malam', 'Moon', '["admin","keamanan","pengurus_asrama"]', 1, 2),
('Asrama', 'Rekap Absen Berjamaah', '/dashboard/keamanan/rekap-absen-berjamaah', 'Flame', '["admin","keamanan","pengurus_asrama"]', 1, 3),
('Asrama', 'Absen Sakit Pagi', '/dashboard/asrama/absen-sakit', 'Stethoscope', '["admin","pengurus_asrama"]', 1, 4),
('Asrama', 'Perpindahan Kamar', '/dashboard/asrama/perpindahan-kamar', 'ArrowLeftRight', '["admin","pengurus_asrama"]', 1, 5),
('Asrama', 'Mutasi Asrama', '/dashboard/asrama/mutasi-asrama', 'Shuffle', '["admin","pengurus_asrama"]', 1, 6),
('Asrama', 'Katering & Laundry', '/dashboard/asrama/layanan', 'Utensils', '["admin","dewan_santri","pengurus_asrama"]', 1, 7),
('Asrama', 'Perpulangan', '/dashboard/asrama/perpulangan', 'LogOut', '["admin","pengurus_asrama"]', 1, 8),
('Asrama', 'Monitoring Perpulangan', '/dashboard/asrama/perpulangan/monitoring', 'LayoutList', '["admin","pengurus_asrama","keamanan","dewan_santri"]', 1, 9),

('Perizinan & Disiplin', 'Perizinan Santri', '/dashboard/keamanan/perizinan', 'MapPin', '["admin","dewan_santri"]', 1, 0),
('Perizinan & Disiplin', 'Cetak Telat Datang', '/dashboard/keamanan/perizinan/cetak-telat', 'Clock', '["admin","keamanan"]', 1, 1),
('Perizinan & Disiplin', 'Verifikasi Telat', '/dashboard/keamanan/perizinan/verifikasi-telat', 'Gavel', '["admin","keamanan"]', 1, 2),
('Perizinan & Disiplin', 'Pelanggaran & SP', '/dashboard/keamanan', 'ShieldAlert', '["admin","keamanan"]', 1, 3),
('Perizinan & Disiplin', 'Surat Santri (SP/SK)', '/dashboard/surat-santri', 'FileWarning', '["admin","keamanan","dewan_santri"]', 1, 4),

('Akademik', 'Tes Klasifikasi', '/dashboard/santri/tes-klasifikasi', 'ClipboardCheck', '["admin","sekpen"]', 1, 0),
('Akademik', 'Penempatan Kelas', '/dashboard/santri/atur-kelas', 'UserPlus', '["admin","sekpen"]', 1, 1),
('Akademik', 'Grading Santri', '/dashboard/akademik/grading', 'BarChart3', '["admin","sekpen","wali_kelas"]', 1, 2),
('Akademik', 'Kenaikan Kelas', '/dashboard/akademik/kenaikan', 'ArrowUpCircle', '["admin","sekpen"]', 1, 3),

('Nilai & Rapor', 'Input Nilai', '/dashboard/akademik/nilai/input', 'BookOpen', '["admin","sekpen","wali_kelas"]', 1, 0),
('Nilai & Rapor', 'Leger Nilai', '/dashboard/akademik/leger', 'FileSpreadsheet', '["admin","sekpen","wali_kelas"]', 1, 1),
('Nilai & Rapor', 'Ranking & Prestasi', '/dashboard/akademik/ranking', 'TrendingUp', '["admin","sekpen","wali_kelas"]', 1, 2),
('Nilai & Rapor', 'Cetak Rapor', '/dashboard/laporan/rapor', 'FileText', '["admin","sekpen","wali_kelas"]', 1, 3),

('Absensi Akademik', 'Absen Pengajian', '/dashboard/akademik/absensi', 'CalendarCheck', '["admin","sekpen"]', 1, 0),
('Absensi Akademik', 'Rekap Absensi', '/dashboard/akademik/absensi/rekap', 'Filter', '["admin","sekpen","wali_kelas","keamanan","dewan_santri","pengurus_asrama"]', 1, 1),
('Absensi Akademik', 'Verifikasi Absen', '/dashboard/akademik/absensi/verifikasi', 'UserCheck', '["admin","sekpen"]', 1, 2),
('Absensi Akademik', 'Cetak Pemanggilan', '/dashboard/akademik/absensi/cetak', 'Printer', '["admin","sekpen"]', 1, 3),
('Absensi Akademik', 'Cetak Blanko Absen', '/dashboard/akademik/absensi/cetak-blanko', 'FileText', '["admin","sekpen"]', 1, 4),
('Absensi Akademik', 'Absen Guru', '/dashboard/akademik/absensi-guru', 'Briefcase', '["admin","sekpen"]', 1, 5),
('Absensi Akademik', 'Rekap Absen Guru', '/dashboard/akademik/absensi-guru/rekap', 'UserCheck', '["admin","sekpen"]', 1, 6),

('Keuangan Pusat', 'Loket Pembayaran', '/dashboard/keuangan/pembayaran', 'Coins', '["admin","bendahara"]', 1, 0),
('Keuangan Pusat', 'Laporan Keuangan', '/dashboard/keuangan/laporan', 'FileText', '["admin","bendahara"]', 1, 1),
('Keuangan Pusat', 'Pengaturan Tarif', '/dashboard/keuangan/tarif', 'Settings', '["admin","bendahara"]', 1, 2),

('Keuangan Santri', 'Pembayaran SPP', '/dashboard/asrama/spp', 'CreditCard', '["admin","pengurus_asrama"]', 1, 0),
('Keuangan Santri', 'Status Setoran', '/dashboard/asrama/status-setoran', 'LayoutList', '["admin","pengurus_asrama"]', 1, 1),
('Keuangan Santri', 'Monitoring Setoran', '/dashboard/dewan-santri/setoran', 'LayoutList', '["admin","dewan_santri"]', 1, 2),
('Keuangan Santri', 'Uang Jajan', '/dashboard/asrama/uang-jajan', 'Wallet', '["admin","pengurus_asrama"]', 1, 3),
('Keuangan Santri', 'Monitoring Uang Jajan', '/dashboard/dewan-santri/uang-jajan', 'Wallet', '["admin","dewan_santri"]', 1, 4),

('UPK', 'Kasir', '/dashboard/akademik/upk/kasir', 'ShoppingCart', '["admin","sekpen"]', 1, 0),
('UPK', 'Katalog', '/dashboard/akademik/upk/katalog', 'BookOpen', '["admin","sekpen"]', 1, 1),
('UPK', 'Manajemen', '/dashboard/akademik/upk/manajemen', 'Package', '["admin","sekpen"]', 1, 2),

('EHB', 'Jadwal', '/dashboard/ehb/jadwal', 'CalendarDays', '["admin"]', 1, 0),
('EHB', 'Ruangan', '/dashboard/ehb/ruangan', 'LayoutList', '["admin"]', 1, 1),
('EHB', 'Pengawas', '/dashboard/ehb/pengawas', 'UserCheck', '["admin"]', 1, 2),
('EHB', 'Absensi Peserta', '/dashboard/ehb/absensi', 'UserCheck', '["admin"]', 1, 3),
('EHB', 'Absensi Pengawas', '/dashboard/ehb/absensi-pengawas', 'ClipboardCheck', '["admin"]', 1, 4),
('EHB', 'Daftar Susulan', '/dashboard/ehb/susulan', 'ClipboardList', '["admin"]', 1, 5),
('EHB', 'Cetak EHB', '/dashboard/ehb/cetak', 'Printer', '["admin"]', 1, 6),
('EHB', 'Kepanitiaan', '/dashboard/ehb/kepanitiaan', 'UserCog', '["admin"]', 1, 7),
('EHB', 'Keuangan', '/dashboard/ehb/keuangan', 'Wallet', '["admin"]', 1, 8),

('Master Data', 'Manajemen User', '/dashboard/pengaturan/users', 'UserCog', '["admin"]', 1, 0),
('Master Data', 'Tahun Ajaran', '/dashboard/pengaturan/tahun-ajaran', 'CalendarDays', '["admin"]', 1, 1),
('Master Data', 'Manajemen Santri', '/dashboard/master/santri-tools', 'Users', '["admin"]', 1, 2),
('Master Data', 'Manajemen Guru & Jadwal', '/dashboard/master/wali-kelas', 'UserCheck', '["admin"]', 1, 3),
('Master Data', 'Manajemen Kelas', '/dashboard/master/kelas', 'Database', '["admin"]', 1, 4),
('Master Data', 'Manajemen Kitab', '/dashboard/master/kitab', 'Book', '["admin"]', 1, 5),
('Master Data', 'Master Pelanggaran', '/dashboard/master/pelanggaran', 'Settings', '["admin"]', 0, 6),
('Master Data', 'Periode Perpulangan', '/dashboard/pengaturan/perpulangan-periode', 'CalendarRange', '["admin","keamanan","dewan_santri"]', 1, 7),
('Master Data', 'Manajemen Fitur', '/dashboard/pengaturan/fitur-akses', 'ToggleRight', '["admin"]', 1, 8);

UPDATE fitur_akses
SET
  group_name = CASE href
    WHEN '/dashboard' THEN '_standalone'

    WHEN '/dashboard/santri' THEN 'Data Santri'
    WHEN '/dashboard/santri/input' THEN 'Data Santri'
    WHEN '/dashboard/santri/export' THEN 'Data Santri'
    WHEN '/dashboard/santri/foto' THEN 'Data Santri'
    WHEN '/dashboard/santri/keluar' THEN 'Data Santri'
    WHEN '/dashboard/santri/arsip' THEN 'Data Santri'

    WHEN '/dashboard/dewan-santri/sensus' THEN 'Kesantrian'
    WHEN '/dashboard/dewan-santri/sensus/laporan' THEN 'Kesantrian'
    WHEN '/dashboard/dewan-santri/surat' THEN 'Kesantrian'

    WHEN '/dashboard/asrama/absen-malam' THEN 'Asrama'
    WHEN '/dashboard/asrama/absen-berjamaah' THEN 'Asrama'
    WHEN '/dashboard/keamanan/rekap-asrama' THEN 'Asrama'
    WHEN '/dashboard/keamanan/rekap-absen-malam' THEN 'Asrama'
    WHEN '/dashboard/keamanan/rekap-absen-berjamaah' THEN 'Asrama'
    WHEN '/dashboard/asrama/absen-sakit' THEN 'Asrama'
    WHEN '/dashboard/asrama/perpindahan-kamar' THEN 'Asrama'
    WHEN '/dashboard/asrama/mutasi-asrama' THEN 'Asrama'
    WHEN '/dashboard/asrama/layanan' THEN 'Asrama'
    WHEN '/dashboard/asrama/perpulangan' THEN 'Asrama'
    WHEN '/dashboard/asrama/perpulangan/monitoring' THEN 'Asrama'

    WHEN '/dashboard/keamanan/perizinan' THEN 'Perizinan & Disiplin'
    WHEN '/dashboard/keamanan/perizinan/cetak-telat' THEN 'Perizinan & Disiplin'
    WHEN '/dashboard/keamanan/perizinan/verifikasi-telat' THEN 'Perizinan & Disiplin'
    WHEN '/dashboard/keamanan' THEN 'Perizinan & Disiplin'
    WHEN '/dashboard/surat-santri' THEN 'Perizinan & Disiplin'

    WHEN '/dashboard/santri/tes-klasifikasi' THEN 'Akademik'
    WHEN '/dashboard/santri/atur-kelas' THEN 'Akademik'
    WHEN '/dashboard/akademik/grading' THEN 'Akademik'
    WHEN '/dashboard/akademik/kenaikan' THEN 'Akademik'

    WHEN '/dashboard/akademik/nilai/input' THEN 'Nilai & Rapor'
    WHEN '/dashboard/akademik/leger' THEN 'Nilai & Rapor'
    WHEN '/dashboard/akademik/ranking' THEN 'Nilai & Rapor'
    WHEN '/dashboard/laporan/rapor' THEN 'Nilai & Rapor'

    WHEN '/dashboard/akademik/absensi' THEN 'Absensi Akademik'
    WHEN '/dashboard/akademik/absensi/rekap' THEN 'Absensi Akademik'
    WHEN '/dashboard/akademik/absensi/verifikasi' THEN 'Absensi Akademik'
    WHEN '/dashboard/akademik/absensi/cetak' THEN 'Absensi Akademik'
    WHEN '/dashboard/akademik/absensi/cetak-blanko' THEN 'Absensi Akademik'
    WHEN '/dashboard/akademik/absensi-guru' THEN 'Absensi Akademik'
    WHEN '/dashboard/akademik/absensi-guru/rekap' THEN 'Absensi Akademik'

    WHEN '/dashboard/keuangan/pembayaran' THEN 'Keuangan Pusat'
    WHEN '/dashboard/keuangan/laporan' THEN 'Keuangan Pusat'
    WHEN '/dashboard/keuangan/tarif' THEN 'Keuangan Pusat'

    WHEN '/dashboard/asrama/spp' THEN 'Keuangan Santri'
    WHEN '/dashboard/asrama/status-setoran' THEN 'Keuangan Santri'
    WHEN '/dashboard/dewan-santri/setoran' THEN 'Keuangan Santri'
    WHEN '/dashboard/asrama/uang-jajan' THEN 'Keuangan Santri'
    WHEN '/dashboard/dewan-santri/uang-jajan' THEN 'Keuangan Santri'

    ELSE group_name
  END,
  title = CASE href
    WHEN '/dashboard/santri/keluar' THEN 'Santri Keluar'
    WHEN '/dashboard/keamanan/rekap-asrama' THEN 'Rekap Absen Malam'
    WHEN '/dashboard/akademik/upk/kasir' THEN 'Kasir'
    WHEN '/dashboard/akademik/upk/katalog' THEN 'Katalog'
    WHEN '/dashboard/akademik/upk/manajemen' THEN 'Manajemen'
    WHEN '/dashboard/ehb/jadwal' THEN 'Jadwal'
    WHEN '/dashboard/ehb/ruangan' THEN 'Ruangan'
    WHEN '/dashboard/ehb/pengawas' THEN 'Pengawas'
    WHEN '/dashboard/ehb/absensi' THEN 'Absensi Peserta'
    WHEN '/dashboard/ehb/absensi-pengawas' THEN 'Absensi Pengawas'
    ELSE title
  END,
  urutan = CASE href
    WHEN '/dashboard' THEN 0

    WHEN '/dashboard/santri' THEN 0
    WHEN '/dashboard/santri/input' THEN 1
    WHEN '/dashboard/santri/export' THEN 2
    WHEN '/dashboard/santri/foto' THEN 3
    WHEN '/dashboard/santri/keluar' THEN 4
    WHEN '/dashboard/santri/arsip' THEN 5

    WHEN '/dashboard/dewan-santri/sensus' THEN 0
    WHEN '/dashboard/dewan-santri/sensus/laporan' THEN 1
    WHEN '/dashboard/dewan-santri/surat' THEN 2

    WHEN '/dashboard/asrama/absen-malam' THEN 0
    WHEN '/dashboard/asrama/absen-berjamaah' THEN 1
    WHEN '/dashboard/keamanan/rekap-asrama' THEN 2
    WHEN '/dashboard/keamanan/rekap-absen-malam' THEN 2
    WHEN '/dashboard/keamanan/rekap-absen-berjamaah' THEN 3
    WHEN '/dashboard/asrama/absen-sakit' THEN 4
    WHEN '/dashboard/asrama/perpindahan-kamar' THEN 5
    WHEN '/dashboard/asrama/mutasi-asrama' THEN 6
    WHEN '/dashboard/asrama/layanan' THEN 7
    WHEN '/dashboard/asrama/perpulangan' THEN 8
    WHEN '/dashboard/asrama/perpulangan/monitoring' THEN 9

    WHEN '/dashboard/keamanan/perizinan' THEN 0
    WHEN '/dashboard/keamanan/perizinan/cetak-telat' THEN 1
    WHEN '/dashboard/keamanan/perizinan/verifikasi-telat' THEN 2
    WHEN '/dashboard/keamanan' THEN 3
    WHEN '/dashboard/surat-santri' THEN 4

    WHEN '/dashboard/santri/tes-klasifikasi' THEN 0
    WHEN '/dashboard/santri/atur-kelas' THEN 1
    WHEN '/dashboard/akademik/grading' THEN 2
    WHEN '/dashboard/akademik/kenaikan' THEN 3

    WHEN '/dashboard/akademik/nilai/input' THEN 0
    WHEN '/dashboard/akademik/leger' THEN 1
    WHEN '/dashboard/akademik/ranking' THEN 2
    WHEN '/dashboard/laporan/rapor' THEN 3

    WHEN '/dashboard/akademik/absensi' THEN 0
    WHEN '/dashboard/akademik/absensi/rekap' THEN 1
    WHEN '/dashboard/akademik/absensi/verifikasi' THEN 2
    WHEN '/dashboard/akademik/absensi/cetak' THEN 3
    WHEN '/dashboard/akademik/absensi/cetak-blanko' THEN 4
    WHEN '/dashboard/akademik/absensi-guru' THEN 5
    WHEN '/dashboard/akademik/absensi-guru/rekap' THEN 6

    WHEN '/dashboard/keuangan/pembayaran' THEN 0
    WHEN '/dashboard/keuangan/laporan' THEN 1
    WHEN '/dashboard/keuangan/tarif' THEN 2

    WHEN '/dashboard/asrama/spp' THEN 0
    WHEN '/dashboard/asrama/status-setoran' THEN 1
    WHEN '/dashboard/dewan-santri/setoran' THEN 2
    WHEN '/dashboard/asrama/uang-jajan' THEN 3
    WHEN '/dashboard/dewan-santri/uang-jajan' THEN 4

    WHEN '/dashboard/akademik/upk/kasir' THEN 0
    WHEN '/dashboard/akademik/upk/katalog' THEN 1
    WHEN '/dashboard/akademik/upk/manajemen' THEN 2

    WHEN '/dashboard/ehb/jadwal' THEN 0
    WHEN '/dashboard/ehb/ruangan' THEN 1
    WHEN '/dashboard/ehb/pengawas' THEN 2
    WHEN '/dashboard/ehb/absensi' THEN 3
    WHEN '/dashboard/ehb/absensi-pengawas' THEN 4
    WHEN '/dashboard/ehb/susulan' THEN 5
    WHEN '/dashboard/ehb/cetak' THEN 6
    WHEN '/dashboard/ehb/kepanitiaan' THEN 7
    WHEN '/dashboard/ehb/keuangan' THEN 8

    WHEN '/dashboard/pengaturan/users' THEN 0
    WHEN '/dashboard/pengaturan/tahun-ajaran' THEN 1
    WHEN '/dashboard/master/santri-tools' THEN 2
    WHEN '/dashboard/master/wali-kelas' THEN 3
    WHEN '/dashboard/master/kelas' THEN 4
    WHEN '/dashboard/master/kitab' THEN 5
    WHEN '/dashboard/master/pelanggaran' THEN 6
    WHEN '/dashboard/pengaturan/perpulangan-periode' THEN 7
    WHEN '/dashboard/pengaturan/fitur-akses' THEN 8

    ELSE urutan
  END,
  icon = CASE href
    WHEN '/dashboard/santri/keluar' THEN 'UserX'
    WHEN '/dashboard/santri/export' THEN 'Download'
    WHEN '/dashboard/asrama/mutasi-asrama' THEN 'Shuffle'
    WHEN '/dashboard/pengaturan/perpulangan-periode' THEN 'CalendarRange'
    ELSE icon
  END,
  updated_at = datetime('now')
WHERE href IN (
  '/dashboard',
  '/dashboard/santri',
  '/dashboard/santri/input',
  '/dashboard/santri/export',
  '/dashboard/santri/foto',
  '/dashboard/santri/keluar',
  '/dashboard/santri/arsip',
  '/dashboard/dewan-santri/sensus',
  '/dashboard/dewan-santri/sensus/laporan',
  '/dashboard/dewan-santri/surat',
  '/dashboard/asrama/absen-malam',
  '/dashboard/asrama/absen-berjamaah',
  '/dashboard/keamanan/rekap-asrama',
  '/dashboard/keamanan/rekap-absen-malam',
  '/dashboard/keamanan/rekap-absen-berjamaah',
  '/dashboard/asrama/absen-sakit',
  '/dashboard/asrama/perpindahan-kamar',
  '/dashboard/asrama/mutasi-asrama',
  '/dashboard/asrama/layanan',
  '/dashboard/asrama/perpulangan',
  '/dashboard/asrama/perpulangan/monitoring',
  '/dashboard/keamanan/perizinan',
  '/dashboard/keamanan/perizinan/cetak-telat',
  '/dashboard/keamanan/perizinan/verifikasi-telat',
  '/dashboard/keamanan',
  '/dashboard/surat-santri',
  '/dashboard/santri/tes-klasifikasi',
  '/dashboard/santri/atur-kelas',
  '/dashboard/akademik/grading',
  '/dashboard/akademik/kenaikan',
  '/dashboard/akademik/nilai/input',
  '/dashboard/akademik/leger',
  '/dashboard/akademik/ranking',
  '/dashboard/laporan/rapor',
  '/dashboard/akademik/absensi',
  '/dashboard/akademik/absensi/rekap',
  '/dashboard/akademik/absensi/verifikasi',
  '/dashboard/akademik/absensi/cetak',
  '/dashboard/akademik/absensi/cetak-blanko',
  '/dashboard/akademik/absensi-guru',
  '/dashboard/akademik/absensi-guru/rekap',
  '/dashboard/keuangan/pembayaran',
  '/dashboard/keuangan/laporan',
  '/dashboard/keuangan/tarif',
  '/dashboard/asrama/spp',
  '/dashboard/asrama/status-setoran',
  '/dashboard/dewan-santri/setoran',
  '/dashboard/asrama/uang-jajan',
  '/dashboard/dewan-santri/uang-jajan',
  '/dashboard/akademik/upk/kasir',
  '/dashboard/akademik/upk/katalog',
  '/dashboard/akademik/upk/manajemen',
  '/dashboard/ehb/jadwal',
  '/dashboard/ehb/ruangan',
  '/dashboard/ehb/pengawas',
  '/dashboard/ehb/absensi',
  '/dashboard/ehb/absensi-pengawas',
  '/dashboard/ehb/susulan',
  '/dashboard/ehb/cetak',
  '/dashboard/ehb/kepanitiaan',
  '/dashboard/ehb/keuangan',
  '/dashboard/pengaturan/users',
  '/dashboard/pengaturan/tahun-ajaran',
  '/dashboard/master/santri-tools',
  '/dashboard/master/wali-kelas',
  '/dashboard/master/kelas',
  '/dashboard/master/kitab',
  '/dashboard/master/pelanggaran',
  '/dashboard/pengaturan/perpulangan-periode',
  '/dashboard/pengaturan/fitur-akses'
);

-- Route plotting EHB sudah digabung ke halaman Ruangan/Pengawas, jadi jangan tampil sebagai fitur sidebar.
DELETE FROM fitur_akses
WHERE href IN (
  '/dashboard/keamanan/rekap-asrama',
  '/dashboard/ehb/ruangan/plotting',
  '/dashboard/ehb/pengawas/plotting'
);
