-- Migration 0091: SPP Rekap Asrama Snapshot
-- Cache laporan "REKAP SETORAN KEUANGAN SPP ASRAMA" per asrama/periode.
-- Cetak ulang baca dari snapshot ini (1 row read) selama source_signature tak berubah.

CREATE TABLE IF NOT EXISTS spp_rekap_snapshot (
  unit_setor       TEXT    NOT NULL,
  tahun            INTEGER NOT NULL,
  bulan            INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  source_signature TEXT    NOT NULL,
  payload_json     TEXT    NOT NULL,
  generated_by     TEXT    REFERENCES users(id),
  generated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_setor, tahun, bulan)
);
