-- Migration 0087: SPP Setoran Window
-- Per-month date from which asrama may submit physical cash setoran to dewan santri.

CREATE TABLE IF NOT EXISTS spp_setoran_window (
  tahun         INTEGER NOT NULL,
  bulan         INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tanggal_mulai TEXT    NOT NULL,
  created_by    TEXT    REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tahun, bulan)
);
