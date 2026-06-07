CREATE TABLE IF NOT EXISTS spp_tagihan_ditiadakan (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tahun       INTEGER NOT NULL,
  bulan       INTEGER NOT NULL,
  alasan      TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, tahun, bulan)
);

CREATE INDEX IF NOT EXISTS idx_spp_tagihan_ditiadakan_santri_period
  ON spp_tagihan_ditiadakan(santri_id, tahun, bulan, is_active);

CREATE INDEX IF NOT EXISTS idx_spp_tagihan_ditiadakan_period_active
  ON spp_tagihan_ditiadakan(tahun, bulan, is_active);
