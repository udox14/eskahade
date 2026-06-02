-- Tunggakan SPP historis sebelum aplikasi SPP mulai dipakai.
-- Periode ini tidak masuk spp_log agar awal tagihan sistem tetap sederhana.

CREATE TABLE IF NOT EXISTS spp_tunggakan_historis (
  id              TEXT PRIMARY KEY,
  santri_id       TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tahun           INTEGER NOT NULL,
  bulan           INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  nominal_tagihan INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'BELUM_LUNAS',
  tanggal_lunas   TEXT,
  penerima_id     TEXT REFERENCES users(id),
  catatan         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, tahun, bulan)
);

CREATE INDEX IF NOT EXISTS idx_spp_tunggakan_historis_santri_status
  ON spp_tunggakan_historis(santri_id, status, tahun, bulan);

CREATE INDEX IF NOT EXISTS idx_spp_tunggakan_historis_lunas
  ON spp_tunggakan_historis(status, tanggal_lunas);

UPDATE app_settings
SET value = '2026-06', updated_at = datetime('now')
WHERE key = 'spp_tagihan_mulai' AND value = '2026-01';

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('spp_tagihan_mulai', '2026-06');
