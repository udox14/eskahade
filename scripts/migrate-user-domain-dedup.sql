UPDATE kelas SET wali_kelas_id = CASE wali_kelas_id
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE wali_kelas_id END
WHERE wali_kelas_id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE absensi_harian SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE absensi_guru SET updated_by = CASE updated_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE updated_by END
WHERE updated_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE absen_asrama SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE absen_sakit SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE nilai_akademik SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE pelanggaran SET penindak_id = CASE penindak_id
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE penindak_id END
WHERE penindak_id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE perizinan SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE hasil_tes_klasifikasi SET tester_id = CASE tester_id
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE tester_id END
WHERE tester_id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE spp_log SET penerima_id = CASE penerima_id
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE penerima_id END
WHERE penerima_id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE spp_setoran SET penerima_id = CASE penerima_id
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE penerima_id END
WHERE penerima_id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE spp_setoran SET konfirmasi_bulan_ini_by = CASE konfirmasi_bulan_ini_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE konfirmasi_bulan_ini_by END
WHERE konfirmasi_bulan_ini_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE spp_setoran SET konfirmasi_tunggakan_by = CASE konfirmasi_tunggakan_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE konfirmasi_tunggakan_by END
WHERE konfirmasi_tunggakan_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE pembayaran_tahunan SET penerima_id = CASE penerima_id
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE penerima_id END
WHERE penerima_id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE tabungan_log SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_transaksi SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE riwayat_surat SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE absen_malam_v2 SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE absen_berjamaah SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE spp_tunggakan_alasan SET updated_by = CASE updated_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE updated_by END
WHERE updated_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE surat_pernyataan SET dibuat_oleh = CASE dibuat_oleh
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE dibuat_oleh END
WHERE dibuat_oleh IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE surat_perjanjian SET dibuat_oleh = CASE dibuat_oleh
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE dibuat_oleh END
WHERE dibuat_oleh IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE perpulangan_periode SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE perpulangan_log SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE perpulangan_log SET updated_by = CASE updated_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE updated_by END
WHERE updated_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE mutasi_asrama_log SET dilakukan_oleh = CASE dilakukan_oleh
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE dilakukan_oleh END
WHERE dilakukan_oleh IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_antrian SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_antrian SET cashier_by = CASE cashier_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE cashier_by END
WHERE cashier_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_stok_mutasi SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_rencana_belanja SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_belanja SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE santri_nonaktif_log SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE santri_nonaktif_log SET closed_by = CASE closed_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE closed_by END
WHERE closed_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE upk_pemasukan SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE denda_buku_pribadi SET created_by = CASE created_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE created_by END
WHERE created_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

UPDATE denda_buku_pribadi SET paid_by = CASE paid_by
  WHEN '5dea9df7-f0a2-43e6-8a73-5908fcb33a6c' THEN '0598bbf5-c159-40d5-a686-fdaaa75dac53'
  WHEN '4ff69e5c-039f-414c-ae96-3c85f7213dbb' THEN 'e17d67a7-76a0-42a8-b075-74685a13d954'
  WHEN '516245c6-acac-491d-8fd3-ce2783546efd' THEN 'fb4b7fc9-908a-4c3b-a1f8-40652177d4f5'
  ELSE paid_by END
WHERE paid_by IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

DELETE FROM users
WHERE id IN ('5dea9df7-f0a2-43e6-8a73-5908fcb33a6c','4ff69e5c-039f-414c-ae96-3c85f7213dbb','516245c6-acac-491d-8fd3-ce2783546efd');

SELECT COUNT(*) AS remaining_old_domain
FROM users
WHERE email LIKE '%@sukahideng.com';
