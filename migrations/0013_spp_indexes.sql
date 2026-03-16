-- Migration: Perbaikan index untuk query SPP agar hemat row reads
-- Index lama idx_spp_bulan_tahun ON spp_log(bulan, tahun) urutannya kurang optimal
-- untuk query WHERE tahun = ? AND bulan = ? (D1 SQLite prefer leading column = tahun)

-- Drop index lama kalau ada, buat yang baru dengan urutan tahun,bulan
DROP INDEX IF EXISTS idx_spp_bulan_tahun;
CREATE INDEX IF NOT EXISTS idx_spp_tahun_bulan ON spp_log(tahun, bulan);

-- Index tambahan untuk anti-join penunggak (santri_id + tahun + bulan)
CREATE INDEX IF NOT EXISTS idx_spp_santri_tahun_bulan ON spp_log(santri_id, tahun, bulan);
