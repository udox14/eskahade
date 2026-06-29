-- seed-demo.sql
-- Data dummy untuk DEMO_DB (sandbox akun demo).
-- Cara pakai (manual): jalankan SEMUA migrasi dulu ke DEMO_DB, lalu:
--   wrangler d1 execute eskahade-demo-db --remote --file=./seed-demo.sql
--
-- Catatan: cara yang lebih lengkap & otomatis (termasuk sinkron user demo
-- dari DB asli) = POST /api/demo/reset sebagai admin. File ini hanya untuk
-- isi data; user demo tetap perlu disinkronkan (lihat route reset).

DELETE FROM riwayat_pendidikan;
DELETE FROM santri;
DELETE FROM kelas;
DELETE FROM data_guru;
DELETE FROM tahun_ajaran;
DELETE FROM spp_log;
DELETE FROM pelanggaran;

INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '1446-1447 H', 1);

INSERT INTO data_guru (id, nama_lengkap, gelar, kode_guru) VALUES
  (1, 'Ust. Demo Fulan', 'S.Pd', 'G-DEMO-1'),
  (2, 'Ust. Demo Ahmad', 'Lc', 'G-DEMO-2');

INSERT INTO kelas (id, tahun_ajaran_id, marhalah_id, nama_kelas, jenis_kelamin) VALUES
  ('demo-kelas-1', 1, 1, 'Tamhidiyyah 1A', 'L'),
  ('demo-kelas-2', 1, 4, 'Ibtidaiyyah 1A', 'L');

INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, tahun_masuk) VALUES
  ('demo-s-1', '99001', 'Demo Santri Satu',  'L', 'aktif', 'AL-FALAH', 2024),
  ('demo-s-2', '99002', 'Demo Santri Dua',   'L', 'aktif', 'AL-FALAH', 2024),
  ('demo-s-3', '99003', 'Demo Santri Tiga',  'L', 'aktif', 'AS-SALAM', 2024),
  ('demo-s-4', '99004', 'Demo Santri Empat', 'L', 'aktif', 'AS-SALAM', 2024),
  ('demo-s-5', '99005', 'Demo Santri Lima',  'L', 'aktif', 'BAHAGIA',  2024),
  ('demo-s-6', '99006', 'Demo Santri Enam',  'L', 'aktif', 'BAHAGIA',  2024);

INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat) VALUES
  ('demo-rp-demo-s-1', 'demo-s-1', 'demo-kelas-1', 'aktif'),
  ('demo-rp-demo-s-2', 'demo-s-2', 'demo-kelas-1', 'aktif'),
  ('demo-rp-demo-s-3', 'demo-s-3', 'demo-kelas-1', 'aktif'),
  ('demo-rp-demo-s-4', 'demo-s-4', 'demo-kelas-2', 'aktif'),
  ('demo-rp-demo-s-5', 'demo-s-5', 'demo-kelas-2', 'aktif'),
  ('demo-rp-demo-s-6', 'demo-s-6', 'demo-kelas-2', 'aktif');

INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, keterangan) VALUES
  ('demo-spp-1', 'demo-s-1', 1, 2025, 70000, 'Demo'),
  ('demo-spp-2', 'demo-s-2', 1, 2025, 70000, 'Demo');

INSERT INTO pelanggaran (id, santri_id, jenis, deskripsi, poin) VALUES
  ('demo-plg-1', 'demo-s-3', 'RINGAN', 'Terlambat (data demo)', 5);
