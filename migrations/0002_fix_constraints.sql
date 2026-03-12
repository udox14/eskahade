-- ============================================================
-- migration v3 — FIX: Tambah kolom yang hilang & UNIQUE constraints
-- ============================================================
-- MASALAH: Banyak ON CONFLICT gagal karena tidak ada UNIQUE index.
-- SQLite (D1) WAJIB punya UNIQUE constraint agar ON CONFLICT bisa jalan.
-- ============================================================

-- 1. Tambah kolom updated_at yang hilang di tabel santri
ALTER TABLE santri ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- 2. Tambah kolom updated_at yang hilang di tabel hasil_tes_klasifikasi
ALTER TABLE hasil_tes_klasifikasi ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- 3. UNIQUE INDEX untuk absensi_guru (ON CONFLICT kelas_id, tanggal)
CREATE UNIQUE INDEX IF NOT EXISTS uq_absensi_guru_kelas_tanggal
  ON absensi_guru(kelas_id, tanggal);

-- 4. UNIQUE INDEX untuk absensi_harian (ON CONFLICT riwayat_pendidikan_id, tanggal)
CREATE UNIQUE INDEX IF NOT EXISTS uq_absensi_harian_riwayat_tanggal
  ON absensi_harian(riwayat_pendidikan_id, tanggal);

-- 5. UNIQUE INDEX untuk nilai_akademik (ON CONFLICT riwayat_pendidikan_id, mapel_id, semester)
CREATE UNIQUE INDEX IF NOT EXISTS uq_nilai_akademik_riwayat_mapel_semester
  ON nilai_akademik(riwayat_pendidikan_id, mapel_id, semester);

-- 6. UNIQUE INDEX untuk ranking (ON CONFLICT riwayat_pendidikan_id, semester)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ranking_riwayat_semester
  ON ranking(riwayat_pendidikan_id, semester);

-- 7. UNIQUE INDEX untuk biaya_settings (ON CONFLICT tahun_angkatan, jenis_biaya)
CREATE UNIQUE INDEX IF NOT EXISTS uq_biaya_settings_tahun_jenis
  ON biaya_settings(tahun_angkatan, jenis_biaya);

-- 8. UNIQUE INDEX untuk spp_setoran (ON CONFLICT asrama, bulan, tahun)
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_setoran_asrama_bulan_tahun
  ON spp_setoran(asrama, bulan, tahun);
