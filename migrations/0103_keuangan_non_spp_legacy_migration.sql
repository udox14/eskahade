-- Migration 0103: Keuangan Non-SPP legacy migration baseline

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('keuangan_non_spp_cutoff_tanggal', '2026-07-01');

CREATE TABLE IF NOT EXISTS keuangan_non_spp_opening_balance (
  id                TEXT PRIMARY KEY,
  santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tahun_ajaran_id   INTEGER NOT NULL REFERENCES tahun_ajaran(id),
  jenis_biaya       TEXT NOT NULL,
  nominal_tagihan   INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'AKTIF',
  catatan           TEXT,
  created_by        TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  void_reason       TEXT,
  voided_by         TEXT REFERENCES users(id),
  voided_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_non_spp_opening_balance_santri_ta
  ON keuangan_non_spp_opening_balance(santri_id, tahun_ajaran_id, status);

CREATE INDEX IF NOT EXISTS idx_non_spp_opening_balance_ta_status
  ON keuangan_non_spp_opening_balance(tahun_ajaran_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_non_spp_opening_balance_active
  ON keuangan_non_spp_opening_balance(santri_id, tahun_ajaran_id, jenis_biaya)
  WHERE COALESCE(status, 'AKTIF') != 'VOID';

UPDATE santri
SET tahun_masuk = CAST(SUBSTR(NULLIF(tanggal_masuk, ''), 1, 4) AS INTEGER)
WHERE tahun_masuk IS NULL
  AND tanggal_masuk IS NOT NULL
  AND tanggal_masuk GLOB '[0-9][0-9][0-9][0-9]-*';
