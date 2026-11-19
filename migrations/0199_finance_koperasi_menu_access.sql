-- 0199 — Akses menu keuangan untuk peran Koperasi (temuan audit 2026-11-19 #2–#4).
--
-- Server action sudah memberi wewenang berikut, tetapi seed fitur_akses (0166) tidak memuat perannya:
--   * admin_koperasi  → Pengaturan Keuangan: tab Jalur Pembayaran & BRIVA/Koperasi (biaya admin Koperasi).
--                        Tab tarif/pembebasan/limit/kop tetap hanya Admin/Bendahara (dibatasi di kode).
--   * admin_koperasi  → Laporan & Ekspor (hanya baca; statistik Pendapatan Koperasi ada di sini).
--   * admin_koperasi  → Penyaluran Dana (lihat + kelola rekening penerima; mencatat penyaluran tetap ditolak).
--   * petugas_koperasi → Penyaluran Dana (catat penyaluran TUNAI; transfer manual tetap Admin/Bendahara).
--
-- Hanya MENAMBAH peran yang belum ada (tidak menimpa kustomisasi peran yang mungkin sudah diubah di aplikasi).
-- Idempoten: aman dijalankan ulang. Tidak menyentuh data finansial.

UPDATE fitur_akses
SET roles = json_insert(roles, '$[#]', 'admin_koperasi')
WHERE href IN ('/dashboard/keuangan/tarif', '/dashboard/keuangan/laporan', '/dashboard/keuangan/penyaluran')
  AND json_valid(roles)
  AND NOT EXISTS (SELECT 1 FROM json_each(fitur_akses.roles) WHERE value = 'admin_koperasi');

UPDATE fitur_akses
SET roles = json_insert(roles, '$[#]', 'petugas_koperasi')
WHERE href = '/dashboard/keuangan/penyaluran'
  AND json_valid(roles)
  AND NOT EXISTS (SELECT 1 FROM json_each(fitur_akses.roles) WHERE value = 'petugas_koperasi');
