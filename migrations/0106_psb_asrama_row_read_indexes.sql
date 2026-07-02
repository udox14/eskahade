-- Index untuk statistik kuota PSB per asrama.
-- Query hot-nya filter santri aktif, asrama terisi, lalu cek created_at/kategori
-- atau keberadaan psb_flow lewat santri_id.
CREATE INDEX IF NOT EXISTS idx_santri_psb_asrama_created
  ON santri(status_global, asrama, created_at);

CREATE INDEX IF NOT EXISTS idx_santri_psb_asrama_kategori
  ON santri(status_global, asrama, kategori_santri);
