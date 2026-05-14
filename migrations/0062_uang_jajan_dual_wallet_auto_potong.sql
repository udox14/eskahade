-- Dual wallet for Uang Jajan and Tabungan, plus scheduled deductions.
-- Existing saldo_tabungan is treated as the old Uang Jajan balance.

ALTER TABLE santri ADD COLUMN saldo_uang_jajan INTEGER NOT NULL DEFAULT 0;

UPDATE santri
SET saldo_uang_jajan = COALESCE(saldo_tabungan, 0)
WHERE saldo_uang_jajan = 0;

UPDATE santri
SET saldo_tabungan = 0
WHERE saldo_tabungan IS NULL OR saldo_tabungan != 0;

ALTER TABLE tabungan_log ADD COLUMN dompet TEXT NOT NULL DEFAULT 'JAJAN';
ALTER TABLE tabungan_log ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE tabungan_log ADD COLUMN transfer_group_id TEXT;
ALTER TABLE tabungan_log ADD COLUMN auto_rule_id TEXT;
ALTER TABLE tabungan_log ADD COLUMN run_date TEXT;

UPDATE tabungan_log
SET dompet = 'JAJAN',
    source = COALESCE(source, 'MANUAL')
WHERE dompet IS NULL OR dompet = '';

CREATE TABLE IF NOT EXISTS uang_jajan_auto_rule (
  id           TEXT PRIMARY KEY,
  scope_type   TEXT NOT NULL, -- ASRAMA | KAMAR | SANTRI
  asrama       TEXT,
  kamar        TEXT,
  santri_id    TEXT REFERENCES santri(id) ON DELETE CASCADE,
  nominal      INTEGER NOT NULL,
  jam          TEXT NOT NULL, -- HH:mm WIB
  days         TEXT NOT NULL, -- JSON array 0..6, Sunday=0
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uang_jajan_auto_skip (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  skip_date   TEXT NOT NULL, -- YYYY-MM-DD WIB
  reason      TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (santri_id, skip_date)
);

CREATE INDEX IF NOT EXISTS idx_uang_jajan_auto_rule_active ON uang_jajan_auto_rule(is_active, scope_type, asrama, kamar, santri_id);
CREATE INDEX IF NOT EXISTS idx_uang_jajan_auto_skip_date ON uang_jajan_auto_skip(skip_date, santri_id);
CREATE INDEX IF NOT EXISTS idx_tabungan_log_dompet_created ON tabungan_log(dompet, created_at);
CREATE INDEX IF NOT EXISTS idx_tabungan_log_auto_run ON tabungan_log(source, run_date, santri_id);
