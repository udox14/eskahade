CREATE INDEX IF NOT EXISTS idx_absensi_guru_tanggal_kelas
  ON absensi_guru(tanggal, kelas_id);

CREATE INDEX IF NOT EXISTS idx_riwayat_kelas_status_santri
  ON riwayat_pendidikan(kelas_id, status_riwayat, santri_id);

CREATE INDEX IF NOT EXISTS idx_pengajian_libur_sesi_tanggal
  ON pengajian_libur_sesi(tanggal, sesi);
