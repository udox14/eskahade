-- Migrasi keuangan 0001d - TABEL kredensial santri, unit kas, dan penarikan loket.
-- finance_withdrawal_limits dipertahankan UTUH: tiga limit harian/mingguan/bulanan.

PRAGMA foreign_keys = ON;

-- Perubahan: mode HYBRID dan BOTH_TRANSITION dihapus beserta tiga kolom transisi.
-- Satu metode aktif saja. Kolom mode dipertahankan (bukan dihapus) supaya
-- penambahan RFID kelak cukup melonggarkan satu CHECK, tanpa migrasi tabel.
CREATE TABLE IF NOT EXISTS finance_credential_policy (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id=1),
  mode TEXT NOT NULL DEFAULT 'QR' CHECK (mode = 'QR'),
  denomination_rupiah INTEGER NOT NULL DEFAULT 5000 CHECK (denomination_rupiah > 0),
  per_transaction_cap_rupiah INTEGER NOT NULL DEFAULT 200000 CHECK (per_transaction_cap_rupiah > 0),
  pin_max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (pin_max_attempts > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Perubahan: credential_kind dipersempit ke QR_STATIC; status SUSPENDED_BY_POLICY
-- dibuang karena hanya dipakai mekanisme transisi RFID<->QR yang sudah dihapus.
-- LOST dan REVOKED tetap ada dan tetap tidak pernah bisa diaktifkan kembali.
CREATE TABLE IF NOT EXISTS student_credentials (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  credential_kind TEXT NOT NULL DEFAULT 'QR_STATIC' CHECK (credential_kind = 'QR_STATIC'),
  token_hmac TEXT NOT NULL,
  token_encrypted TEXT,
  token_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED','LOST','EXPIRED','REVOKED')),
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  blocked_reason TEXT,
  replacement_credential_id TEXT REFERENCES student_credentials(id),
  physically_verified_at TEXT,
  physically_verified_by TEXT,
  last_used_at TEXT,
  created_by TEXT,
  card_number TEXT,
  print_count INTEGER NOT NULL DEFAULT 0,
  last_printed_at TEXT,
  UNIQUE(credential_kind, token_hmac, token_version)
);

CREATE TABLE IF NOT EXISTS finance_credential_batches (
  id TEXT PRIMARY KEY,
  credential_kind TEXT NOT NULL CHECK (credential_kind IN ('RFID_UID','QR_STATIC')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','CANCELLED')),
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  filter_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS finance_credential_batch_items (
  batch_id TEXT NOT NULL REFERENCES finance_credential_batches(id),
  santri_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SUCCESS','SKIPPED','FAILED')),
  credential_id TEXT REFERENCES student_credentials(id),
  error_message TEXT,
  processed_at TEXT,
  PRIMARY KEY(batch_id,santri_id),
  UNIQUE(batch_id,position)
);

CREATE TABLE IF NOT EXISTS finance_student_security (
  santri_id TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  pin_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_withdrawal_limits (
  santri_id TEXT PRIMARY KEY,
  daily_rupiah INTEGER CHECK (daily_rupiah IS NULL OR daily_rupiah > 0),
  weekly_rupiah INTEGER CHECK (weekly_rupiah IS NULL OR weekly_rupiah > 0),
  monthly_rupiah INTEGER CHECK (monthly_rupiah IS NULL OR monthly_rupiah > 0),
  version INTEGER NOT NULL DEFAULT 1,
  changed_by_guardian_id TEXT,
  reauthenticated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_cash_units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asrama_scope TEXT,
  fixed_float_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (fixed_float_rupiah >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_cash_unit_operators (
  cash_unit_id TEXT NOT NULL REFERENCES finance_cash_units(id),
  operator_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (cash_unit_id, operator_id)
);

CREATE TABLE IF NOT EXISTS finance_cash_shifts (
  id TEXT PRIMARY KEY,
  cash_unit_id TEXT NOT NULL REFERENCES finance_cash_units(id),
  operator_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  opening_cash_rupiah INTEGER NOT NULL CHECK (opening_cash_rupiah >= 0),
  expected_closing_rupiah INTEGER,
  actual_closing_rupiah INTEGER,
  discrepancy_rupiah INTEGER,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED_OK','CLOSED_REVIEW')),
  supervisor_id TEXT,
  supervisor_note TEXT,
  operator_closing_note TEXT,
  supervisor_reviewed_at TEXT,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS finance_withdrawals (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  santri_id TEXT NOT NULL,
  credential_id TEXT NOT NULL REFERENCES student_credentials(id),
  credential_kind TEXT NOT NULL DEFAULT 'QR_STATIC' CHECK (credential_kind = 'QR_STATIC'),
  cash_unit_id TEXT NOT NULL REFERENCES finance_cash_units(id),
  shift_id TEXT NOT NULL REFERENCES finance_cash_shifts(id),
  operator_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  amount_rupiah INTEGER NOT NULL CHECK (typeof(amount_rupiah)='integer' AND amount_rupiah > 0),
  pin_verified_at TEXT NOT NULL,
  identity_confirmed INTEGER NOT NULL CHECK (identity_confirmed=1),
  journal_id TEXT NOT NULL REFERENCES finance_journals(id),
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','REVERSED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_student_credentials_student ON student_credentials(santri_id, status);
CREATE UNIQUE INDEX uq_finance_open_shift_operator ON finance_cash_shifts(operator_id) WHERE status='OPEN';
CREATE INDEX idx_finance_withdrawal_student ON finance_withdrawals(santri_id, created_at);
CREATE INDEX idx_finance_withdrawal_shift ON finance_withdrawals(shift_id, created_at);
