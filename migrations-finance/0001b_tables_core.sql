-- Migrasi keuangan 0001b — TABEL inti: ledger double-entry dan dompet santri.
-- Struktur ledger disalin apa adanya dari skema lama: double-entry dipertahankan penuh.
-- Trigger TIDAK dibuat di sini; seluruhnya di 0001g setelah semua tabel ada.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finance_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT','CREDIT')),
  allow_negative INTEGER NOT NULL DEFAULT 0 CHECK (allow_negative IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Perubahan: kolom approval reopen menggantikan tabel finance_period_reopen_approvals.
-- Cukup satu approval + alasan, sesuai keputusan penyederhanaan.
CREATE TABLE IF NOT EXISTS finance_periods (
  period_key TEXT PRIMARY KEY CHECK (period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_at TEXT,
  closed_by TEXT,
  close_hash TEXT,
  reopened_at TEXT,
  reopened_by TEXT,
  reopen_approved_by TEXT,
  reopen_reason TEXT
);

CREATE TABLE IF NOT EXISTS finance_journals (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  effective_date TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  external_reference TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED')),
  reversal_of_id TEXT REFERENCES finance_journals(id),
  metadata_json TEXT,
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reversal_of_id)
);

CREATE TABLE IF NOT EXISTS finance_journal_entries (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES finance_journals(id),
  account_id TEXT NOT NULL REFERENCES finance_accounts(id),
  side TEXT NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  amount_rupiah INTEGER NOT NULL CHECK (typeof(amount_rupiah) = 'integer' AND amount_rupiah > 0),
  santri_id TEXT,
  asrama_scope TEXT,
  counterparty_type TEXT,
  counterparty_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_account_balances (
  account_id TEXT PRIMARY KEY REFERENCES finance_accounts(id),
  balance_rupiah INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_student_wallets (
  santri_id TEXT NOT NULL,
  wallet_kind TEXT NOT NULL CHECK (wallet_kind IN ('TITIPAN','SPP','USPP','NON_SPP','MAKAN','LAUNDRY','JAJAN')),
  balance_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (typeof(balance_rupiah)='integer' AND balance_rupiah >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  frozen_at TEXT,
  freeze_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (santri_id, wallet_kind)
);

CREATE TABLE IF NOT EXISTS finance_wallet_movements (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  journal_id TEXT NOT NULL REFERENCES finance_journals(id),
  santri_id TEXT NOT NULL,
  wallet_kind TEXT NOT NULL CHECK (wallet_kind IN ('TITIPAN','SPP','USPP','NON_SPP','MAKAN','LAUNDRY','JAJAN')),
  amount_rupiah INTEGER NOT NULL CHECK (typeof(amount_rupiah)='integer' AND amount_rupiah <> 0),
  movement_type TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  balance_before INTEGER,
  balance_after INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_journal_date ON finance_journals(effective_date, status);
CREATE INDEX IF NOT EXISTS idx_finance_journal_source ON finance_journals(source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_single_allocation_return ON finance_journals(source_type,source_id) WHERE source_type='ALLOCATION_RETURN';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_single_payout_journal ON finance_journals(source_type,source_id) WHERE source_type='PAYOUT';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_single_provider_reversal ON finance_journals(source_type,source_id) WHERE source_type='PROVIDER_REVERSAL';
CREATE INDEX IF NOT EXISTS idx_finance_entry_account ON finance_journal_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_entry_santri ON finance_journal_entries(santri_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_entry_asrama ON finance_journal_entries(asrama_scope, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_wallet_movement_student ON finance_wallet_movements(santri_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_entry_journal ON finance_journal_entries(journal_id);
