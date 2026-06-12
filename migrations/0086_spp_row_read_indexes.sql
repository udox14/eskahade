-- Indexes untuk mengurangi row reads SPP (fix strftime → date range queries)

-- Composite index santri: filter aktif per asrama tanpa full scan
CREATE INDEX IF NOT EXISTS idx_santri_status_asrama
  ON santri(status_global, asrama);

-- Index spp_log.tanggal_bayar untuk date range queries
-- (menggantikan pola CAST(strftime(...)) yang tidak bisa pakai index)
CREATE INDEX IF NOT EXISTS idx_spp_log_tanggal_bayar
  ON spp_log(tanggal_bayar);
