-- 0135_legacy_sidebar_fixes.sql
-- Memindahkan "reorganisasi sidebar" yang dulu dijalankan ulang tiap request
-- (lib/cache/fitur-akses.ts & lib/operasional.ts) ke migrasi one-shot.
-- Tujuannya agar kustomisasi admin (urutan, nama, grup, status aktif)
-- tidak lagi ditimpa oleh kode runtime.

-- Nilai & Rapor
UPDATE fitur_akses SET group_name = 'Nilai & Rapor', urutan = 4 WHERE href = '/dashboard/guru/nilai-harian';
UPDATE fitur_akses SET group_name = 'Nilai & Rapor', urutan = 5 WHERE href = '/dashboard/guru/hafalan';
UPDATE fitur_akses SET group_name = 'Nilai & Rapor', title = 'Nilai Rapor', icon = 'FileSpreadsheet', is_active = 1, is_bottomnav = 1, bottomnav_urutan = 4, urutan = 1 WHERE href = '/dashboard/akademik/leger';
UPDATE fitur_akses SET is_active = 0, is_bottomnav = 0 WHERE href = '/dashboard/akademik/nilai/input';
UPDATE fitur_akses SET group_name = 'Akademik', title = 'Ranking', urutan = 4 WHERE href = '/dashboard/akademik/ranking';

-- Keuangan
UPDATE fitur_akses SET group_name = 'Keuangan Pusat', title = 'Keuangan Non-SPP', icon = 'HandCoins', is_active = 1, urutan = 0 WHERE href = '/dashboard/keuangan/non-spp';
UPDATE fitur_akses SET is_active = 0 WHERE href IN ('/dashboard/keuangan/pembayaran', '/dashboard/keuangan/tarif', '/dashboard/keuangan/laporan');

-- Role panitia UPK
UPDATE fitur_akses SET roles = replace(roles, ']', ',"panitia_upk"]') WHERE href LIKE '/dashboard/akademik/upk%' AND roles NOT LIKE '%panitia_upk%';

-- Rename menu
UPDATE fitur_akses SET title = 'Tim & Kepengurusan' WHERE href = '/dashboard/pengaturan/kepanitiaan';

-- Role pimpinan di Dashboard
UPDATE fitur_akses SET roles = replace(roles, ']', ',"pimpinan"]') WHERE href = '/dashboard' AND roles NOT LIKE '%pimpinan%';

-- Monitoring EHB dihapus dari modul pimpinan
DELETE FROM fitur_akses WHERE href = '/dashboard/pimpinan/ehb';

-- Operasional unit (dulu di lib/operasional.ts)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Keuangan Santri', 'Kas Operasional Unit', '/dashboard/operasional', 'WalletCards', '["admin","pengurus_asrama","sekpen","keamanan"]', 1, 0),
  ('Keuangan Pusat', 'Operasional Unit', '/dashboard/keuangan/operasional', 'Wallet', '["admin","bendahara"]', 1, 3);
UPDATE fitur_akses SET group_name = 'Keuangan Santri', roles = '["admin","pengurus_asrama","sekpen","keamanan"]', updated_at = datetime('now') WHERE href = '/dashboard/operasional';
UPDATE fitur_akses SET group_name = 'Keuangan Pusat', updated_at = datetime('now') WHERE href = '/dashboard/keuangan/operasional';
DELETE FROM fitur_akses WHERE href IN ('/dashboard/operasional/cetak', '/dashboard/keuangan/operasional/cetak');
