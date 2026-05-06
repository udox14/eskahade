-- ============================================================
-- Demo seed data for eskahade-demo
-- Login demo app account:
--   email    : demo@eskahade.local
--   password : demo12345
-- ============================================================

DELETE FROM riwayat_surat;
DELETE FROM master_jasa;
DELETE FROM upk_item;
DELETE FROM upk_transaksi;
DELETE FROM tabungan_log;
DELETE FROM pembayaran_tahunan;
DELETE FROM biaya_settings;
DELETE FROM spp_setoran;
DELETE FROM spp_log;
DELETE FROM spp_settings;
DELETE FROM hasil_tes_klasifikasi;
DELETE FROM perizinan;
DELETE FROM pelanggaran;
DELETE FROM master_pelanggaran;
DELETE FROM ranking;
DELETE FROM nilai_akhlak;
DELETE FROM nilai_akademik;
DELETE FROM absen_sakit;
DELETE FROM absen_asrama;
DELETE FROM absensi_guru;
DELETE FROM absensi_harian;
DELETE FROM santri_arsip;
DELETE FROM riwayat_pendidikan;
DELETE FROM santri;
DELETE FROM kelas;
DELETE FROM kitab;
DELETE FROM mapel;
DELETE FROM data_guru;
DELETE FROM marhalah;
DELETE FROM tahun_ajaran;
DELETE FROM users;

INSERT INTO users (id, email, password_hash, full_name, role, roles, asrama_binaan, avatar_url, phone, show_bottomnav, created_at, updated_at) VALUES
('demo-admin', 'demo@eskahade.local', '11111111111111111111111111111111:f5a893ed3da36190f89712f805f03b610afc818a4df8193823a042f32955ddd5', 'Akun Demo', 'admin', '["admin","keamanan","sekpen","dewan_santri","pengurus_asrama","wali_kelas","bendahara"]', 'ASY-SYIFA 1', NULL, '081234567890', 1, '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z'),
('demo-wali', 'wali.demo@eskahade.local', '22222222222222222222222222222222:f8aaf824dfb70248bf9f4ec8d743e380bd157e26c67c54e17a96379ddda30e21', 'Ust. Wali Demo', 'wali_kelas', '["wali_kelas"]', NULL, NULL, '081200000001', 1, '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z'),
('demo-asrama', 'asrama.demo@eskahade.local', '33333333333333333333333333333333:44510d33277dc5d011c0269555a617dd43c8ce81893e5413d55e7aa7849302da', 'Pengurus Asrama Demo', 'pengurus_asrama', '["pengurus_asrama"]', 'ASY-SYIFA 1', NULL, '081200000002', 1, '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z'),
('demo-bendahara', 'bendahara.demo@eskahade.local', '44444444444444444444444444444444:bc4d77ea1e3f5705945308d793dab67a136bb1e2ff44318c0eec00740083a2cf', 'Bendahara Demo', 'bendahara', '["bendahara"]', NULL, NULL, '081200000003', 1, '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z');

INSERT INTO tahun_ajaran (id, nama, is_active, created_at) VALUES
(1, '2025/2026', 0, '2026-05-05T00:00:00.000Z'),
(2, '2026/2027', 1, '2026-05-05T00:00:00.000Z');

INSERT INTO marhalah (id, nama, urutan) VALUES
(1, 'I''dad', 1),
(2, 'Wustha', 2),
(3, 'Ulya', 3);

INSERT INTO data_guru (id, nama_lengkap, gelar, kode_guru, created_at) VALUES
(1, 'Ust. Ahmad Fathoni', 'S.Pd', 'G001', '2026-05-05T00:00:00.000Z'),
(2, 'Ust. Budi Santoso', 'M.Pd', 'G002', '2026-05-05T00:00:00.000Z'),
(3, 'Ust. Chandra Maulana', NULL, 'G003', '2026-05-05T00:00:00.000Z');

INSERT INTO mapel (id, nama, aktif) VALUES
(1, 'Nahwu', 1),
(2, 'Sharaf', 1),
(3, 'Fiqih', 1),
(4, 'Tauhid', 1);

INSERT INTO kitab (id, mapel_id, marhalah_id, nama_kitab, harga, created_at) VALUES
(1, 1, 1, 'Jurumiyah', 35000, '2026-05-05T00:00:00.000Z'),
(2, 2, 2, 'Amtsilah Tashrifiyah', 42000, '2026-05-05T00:00:00.000Z'),
(3, 3, 2, 'Fathul Qarib', 50000, '2026-05-05T00:00:00.000Z'),
(4, 4, 3, 'Aqidatul Awam', 30000, '2026-05-05T00:00:00.000Z');

INSERT INTO kelas (id, tahun_ajaran_id, marhalah_id, nama_kelas, wali_kelas_id, jenis_kelamin, guru_shubuh_id, guru_ashar_id, guru_maghrib_id, created_at) VALUES
('kelas-idad-a', 2, 1, 'I''dad A', 'demo-wali', 'L', 1, 2, 3, '2026-05-05T00:00:00.000Z'),
('kelas-wustha-a', 2, 2, 'Wustha A', 'demo-wali', 'L', 1, 2, 3, '2026-05-05T00:00:00.000Z');

INSERT INTO santri (id, nis, nama_lengkap, nik, tempat_lahir, tanggal_lahir, jenis_kelamin, nama_ayah, nama_ibu, alamat, status_global, foto_url, sekolah, kelas_sekolah, asrama, kamar, tahun_masuk, tempat_makan_id, tempat_mencuci_id, created_at) VALUES
('santri-001', '260001', 'Ahmad Fauzan', '3201010101010001', 'Tasikmalaya', '2011-01-10', 'L', 'Bpk. Rahmat', 'Ibu Siti', 'Tasikmalaya', 'aktif', NULL, 'MTs Sukahideng', '7A', 'ASY-SYIFA 1', '1', 2024, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-002', '260002', 'Bilal Ramadhan', '3201010101010002', 'Garut', '2011-03-12', 'L', 'Bpk. Hasan', 'Ibu Aminah', 'Garut', 'aktif', NULL, 'MTs Sukahideng', '7A', 'ASY-SYIFA 1', '1', 2024, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-003', '260003', 'Cahya Maulana', '3201010101010003', 'Ciamis', '2010-07-01', 'L', 'Bpk. Jaja', 'Ibu Ela', 'Ciamis', 'aktif', NULL, 'MTs Sukahideng', '8B', 'ASY-SYIFA 1', '2', 2023, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-004', '260004', 'Dani Mubarok', '3201010101010004', 'Bandung', '2010-09-15', 'L', 'Bpk. Iwan', 'Ibu Mira', 'Bandung', 'aktif', NULL, 'MTs Sukahideng', '8B', 'ASY-SYIFA 1', '2', 2023, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-005', '260005', 'Eko Saputra', '3201010101010005', 'Tasikmalaya', '2009-02-20', 'L', 'Bpk. Tono', 'Ibu Nina', 'Tasikmalaya', 'aktif', NULL, 'MA Sukahideng', '10 IPA', 'ASY-SYIFA 2', '1', 2022, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-006', '260006', 'Farhan Akbar', '3201010101010006', 'Tasikmalaya', '2009-05-05', 'L', 'Bpk. Dedi', 'Ibu Nani', 'Tasikmalaya', 'aktif', NULL, 'MA Sukahideng', '10 IPS', 'ASY-SYIFA 2', '1', 2022, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-007', '260007', 'Gilang Pratama', '3201010101010007', 'Cirebon', '2011-11-25', 'L', 'Bpk. Arif', 'Ibu Lina', 'Cirebon', 'aktif', NULL, 'MTs Sukahideng', '7B', 'ASY-SYIFA 1', NULL, 2024, NULL, NULL, '2026-05-05T00:00:00.000Z'),
('santri-008', '260008', 'Hafidz Kurniawan', '3201010101010008', 'Subang', '2012-01-30', 'L', 'Bpk. Eman', 'Ibu Yayah', 'Subang', 'aktif', NULL, 'MTs Sukahideng', '7B', NULL, NULL, 2024, NULL, NULL, '2026-05-05T00:00:00.000Z');

INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, grade_lanjutan, created_at) VALUES
('rp-001', 'santri-001', 'kelas-idad-a', 'aktif', 'A', '2026-05-05T00:00:00.000Z'),
('rp-002', 'santri-002', 'kelas-idad-a', 'aktif', 'A', '2026-05-05T00:00:00.000Z'),
('rp-003', 'santri-003', 'kelas-wustha-a', 'aktif', 'B', '2026-05-05T00:00:00.000Z'),
('rp-004', 'santri-004', 'kelas-wustha-a', 'aktif', 'B', '2026-05-05T00:00:00.000Z'),
('rp-005', 'santri-005', 'kelas-wustha-a', 'aktif', 'A', '2026-05-05T00:00:00.000Z'),
('rp-006', 'santri-006', 'kelas-wustha-a', 'aktif', 'A', '2026-05-05T00:00:00.000Z'),
('rp-007', 'santri-007', 'kelas-idad-a', 'aktif', 'A', '2026-05-05T00:00:00.000Z'),
('rp-008', 'santri-008', 'kelas-idad-a', 'aktif', 'A', '2026-05-05T00:00:00.000Z');

INSERT INTO absensi_harian (id, riwayat_pendidikan_id, tanggal, shubuh, ashar, maghrib, verif_shubuh, verif_ashar, verif_maghrib, created_by, created_at) VALUES
('absen-harian-001', 'rp-001', '2026-05-04', 'H', 'H', 'H', NULL, NULL, NULL, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('absen-harian-002', 'rp-002', '2026-05-04', 'A', 'H', 'H', 'sidang', NULL, NULL, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('absen-harian-003', 'rp-003', '2026-05-04', 'H', 'I', 'H', NULL, 'izin', NULL, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('absen-harian-004', 'rp-004', '2026-05-04', 'H', 'H', 'S', NULL, NULL, 'sakit', 'demo-wali', '2026-05-05T00:00:00.000Z');

INSERT INTO absensi_guru (id, kelas_id, guru_id, tanggal, shubuh, ashar, maghrib, updated_by, created_at) VALUES
('absen-guru-001', 'kelas-idad-a', 1, '2026-05-04', 'L', 'L', 'L', 'demo-admin', '2026-05-05T00:00:00.000Z'),
('absen-guru-002', 'kelas-wustha-a', 2, '2026-05-04', 'L', 'T', 'L', 'demo-admin', '2026-05-05T00:00:00.000Z');

INSERT INTO absen_asrama (santri_id, status, updated_at, created_by) VALUES
('santri-001', 'HADIR', '2026-05-05T00:00:00.000Z', 'demo-asrama'),
('santri-002', 'IZIN', '2026-05-05T00:00:00.000Z', 'demo-asrama'),
('santri-003', 'ALFA', '2026-05-05T00:00:00.000Z', 'demo-asrama'),
('santri-004', 'HADIR', '2026-05-05T00:00:00.000Z', 'demo-asrama');

INSERT INTO absen_sakit (id, santri_id, tanggal, keterangan, created_by, created_at) VALUES
('sakit-001', 'santri-004', '2026-05-03', 'Demam dan istirahat di asrama', 'demo-asrama', '2026-05-05T00:00:00.000Z');

INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, nilai, semester, created_by, created_at) VALUES
('nilai-001', 'rp-001', 1, 88, 1, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('nilai-002', 'rp-001', 2, 90, 1, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('nilai-003', 'rp-002', 1, 78, 1, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('nilai-004', 'rp-003', 3, 84, 1, 'demo-wali', '2026-05-05T00:00:00.000Z'),
('nilai-005', 'rp-004', 4, 86, 1, 'demo-wali', '2026-05-05T00:00:00.000Z');

INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian, created_at) VALUES
('akhlak-001', 'rp-001', 1, 88, 90, 92, 91, 87, '2026-05-05T00:00:00.000Z'),
('akhlak-002', 'rp-002', 1, 75, 80, 82, 78, 76, '2026-05-05T00:00:00.000Z'),
('akhlak-003', 'rp-003', 1, 84, 83, 85, 82, 81, '2026-05-05T00:00:00.000Z');

INSERT INTO ranking (id, riwayat_pendidikan_id, semester, jumlah_nilai, rata_rata, ranking_kelas, predikat, catatan_wali_kelas, created_at) VALUES
('ranking-001', 'rp-001', 1, 178, 89, 1, 'Mumtaz', 'Performa sangat baik dan stabil.', '2026-05-05T00:00:00.000Z'),
('ranking-002', 'rp-002', 1, 78, 78, 2, 'Jayyid', 'Perlu ditingkatkan di disiplin hadir.', '2026-05-05T00:00:00.000Z'),
('ranking-003', 'rp-003', 1, 84, 84, 1, 'Jayyid Jiddan', 'Bagus di fiqih dan partisipasi kelas.', '2026-05-05T00:00:00.000Z');

INSERT INTO master_pelanggaran (id, kategori, nama_pelanggaran, poin, created_at) VALUES
(1, 'RINGAN', 'Terlambat ke kelas', 5, '2026-05-05T00:00:00.000Z'),
(2, 'SEDANG', 'Tidak ikut jamaah tanpa izin', 10, '2026-05-05T00:00:00.000Z'),
(3, 'BERAT', 'Keluar area tanpa izin', 25, '2026-05-05T00:00:00.000Z');

INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id, created_at) VALUES
('pel-001', 'santri-002', '2026-05-02', 'RINGAN', 'Datang terlambat ke kelas pagi.', 5, 'demo-admin', '2026-05-05T00:00:00.000Z'),
('pel-002', 'santri-003', '2026-05-02', 'SEDANG', 'Tidak ikut jamaah maghrib tanpa keterangan.', 10, 'demo-admin', '2026-05-05T00:00:00.000Z');

INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, tgl_kembali_aktual, created_by, created_at) VALUES
('izin-001', 'santri-005', 'PULANG', '2026-05-01', '2026-05-03', 'Menjenguk orang tua sakit', 'Pengasuh', 'KEMBALI', '2026-05-03', 'demo-admin', '2026-05-05T00:00:00.000Z'),
('izin-002', 'santri-006', 'KELUAR', '2026-05-04', '2026-05-04', 'Kontrol kesehatan', 'Keamanan', 'AKTIF', NULL, 'demo-admin', '2026-05-05T00:00:00.000Z');

INSERT INTO hasil_tes_klasifikasi (id, santri_id, hari_tes, sesi_tes, tulis_arab, baca_kelancaran, baca_tajwid, hafalan_juz, nahwu_pengalaman, rekomendasi_marhalah, catatan_grade, tester_id, created_at) VALUES
('tes-001', 'santri-008', 'Senin', 'Pagi', 'Baik', 'Baik', 'Cukup', 1, 0, 'I''dad', 'Masuk kelas dasar dengan penguatan baca.', 'demo-admin', '2026-05-05T00:00:00.000Z');

INSERT INTO spp_settings (id, tahun_kalender, nominal, is_active, created_at) VALUES
(1, 2026, 175000, 1, '2026-05-05T00:00:00.000Z');

INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, tanggal_bayar, penerima_id, keterangan) VALUES
('spp-001', 'santri-001', 4, 2026, 175000, '2026-04-05T08:00:00.000Z', 'demo-bendahara', 'Lunas April'),
('spp-002', 'santri-002', 4, 2026, 175000, '2026-04-06T08:00:00.000Z', 'demo-bendahara', 'Lunas April'),
('spp-003', 'santri-003', 4, 2026, 100000, '2026-04-07T08:00:00.000Z', 'demo-bendahara', 'Cicilan April');

INSERT INTO spp_setoran (id, asrama, bulan, tahun, tanggal_terima, penerima_id, jumlah_sistem, jumlah_aktual, nama_penyetor, catatan, created_at) VALUES
('setoran-001', 'ASY-SYIFA 1', 4, 2026, '2026-04-08T08:00:00.000Z', 'demo-bendahara', 450000, 450000, 'Pengurus Asrama Demo', 'Sesuai laporan', '2026-05-05T00:00:00.000Z');

INSERT INTO biaya_settings (id, tahun_angkatan, jenis_biaya, nominal, created_at) VALUES
(1, 2024, 'Daftar Ulang', 350000, '2026-05-05T00:00:00.000Z'),
(2, 2024, 'Seragam', 500000, '2026-05-05T00:00:00.000Z');

INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, tanggal_bayar, penerima_id, keterangan) VALUES
('bayar-001', 'santri-001', 'Daftar Ulang', 2026, 350000, '2026-04-15T08:00:00.000Z', 'demo-bendahara', 'Lunas'),
('bayar-002', 'santri-002', 'Seragam', 2026, 250000, '2026-04-16T08:00:00.000Z', 'demo-bendahara', 'Cicilan pertama');

INSERT INTO tabungan_log (id, santri_id, jenis, nominal, keterangan, created_by, created_at) VALUES
('tab-001', 'santri-001', 'MASUK', 50000, 'Setoran awal', 'demo-asrama', '2026-05-05T00:00:00.000Z'),
('tab-002', 'santri-001', 'KELUAR', 10000, 'Jajan koperasi', 'demo-asrama', '2026-05-05T00:00:00.000Z'),
('tab-003', 'santri-002', 'MASUK', 40000, 'Setoran mingguan', 'demo-asrama', '2026-05-05T00:00:00.000Z');

INSERT INTO upk_transaksi (id, santri_id, nama_pemesan, info_tambahan, total_tagihan, total_bayar, sisa_kembalian, sisa_tunggakan, status_lunas, created_by, created_at) VALUES
('upk-001', 'santri-001', 'Ahmad Fauzan', 'Pembelian awal semester', 77000, 80000, 3000, 0, 1, 'demo-admin', '2026-05-05T00:00:00.000Z');

INSERT INTO upk_item (id, transaksi_id, kitab_id, harga_saat_ini, is_gratis, status_serah, tanggal_serah) VALUES
('upk-item-001', 'upk-001', 1, 35000, 0, 'SUDAH', '2026-05-05'),
('upk-item-002', 'upk-001', 4, 30000, 0, 'SUDAH', '2026-05-05');

INSERT INTO master_jasa (id, nama_jasa, jenis, created_at) VALUES
('jasa-001', 'Legalisir Surat', 'administrasi', '2026-05-05T00:00:00.000Z'),
('jasa-002', 'Pembuatan Surat Izin', 'surat', '2026-05-05T00:00:00.000Z');

INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at) VALUES
('surat-001', 'santri-005', 'Surat Izin Pulang', 'Dummy surat izin untuk keperluan demo.', 'demo-admin', '2026-05-05T00:00:00.000Z'),
('surat-002', 'santri-002', 'Surat Pernyataan', 'Dummy surat pernyataan pelanggaran ringan.', 'demo-admin', '2026-05-05T00:00:00.000Z');
