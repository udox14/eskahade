-- Migration 0144: Kunci bulanan rekap absensi guru.
--
-- Payroll menarik jumlah sesi alfa dan badal langsung dari rekap absensi guru,
-- jadi bendahara harus punya tanda bahwa sekpen sudah selesai mengoreksi bulan
-- itu. Baris di absensi_guru_kunci adalah tanda tersebut: ada baris = terkunci.
--
-- Selama terkunci, absensi guru bulan itu tidak dapat disimpan atau diimpor
-- ulang, sehingga angka yang sudah dipakai payroll tidak berubah diam-diam.
-- Idempotent.

CREATE TABLE IF NOT EXISTS absensi_guru_kunci (
  period_key     TEXT PRIMARY KEY,           -- 'YYYY-MM'
  locked_by      TEXT,
  locked_by_nama TEXT,
  locked_at      TEXT NOT NULL DEFAULT (datetime('now')),
  note           TEXT
);

-- Riwayat kunci/buka disimpan terpisah supaya membuka kunci tidak menghapus
-- jejak siapa yang pernah mengunci bulan itu dan kapan.
CREATE TABLE IF NOT EXISTS absensi_guru_kunci_log (
  id         TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('KUNCI', 'BUKA')),
  actor_id   TEXT,
  actor_nama TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_absensi_guru_kunci_log_period
  ON absensi_guru_kunci_log(period_key, created_at DESC);
