-- Migration: composite indexes untuk query-query hot
-- Tambahkan ke wrangler.jsonc migrations lalu jalankan: wrangler d1 migrations apply DB

-- spp_log: query paling sering filter santri_id + tahun + bulan sekaligus
-- Index lama (santri_id) dan (bulan, tahun) terpisah tidak optimal untuk ini
CREATE INDEX IF NOT EXISTS idx_spp_santri_tahun_bulan
  ON spp_log(santri_id, tahun, bulan);

-- spp_log: query agregasi monitoring filter tahun + bulan saja (tanpa santri_id)
CREATE INDEX IF NOT EXISTS idx_spp_tahun_bulan
  ON spp_log(tahun, bulan);

-- perizinan: query absen malam filter status + tanggal range
CREATE INDEX IF NOT EXISTS idx_perizinan_status_tgl
  ON perizinan(status, tgl_mulai, tgl_selesai_rencana);

-- absen_malam_v2: query filter tanggal (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_absen_malam_tanggal
  ON absen_malam_v2(tanggal);