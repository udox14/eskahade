-- Fast RFID/QR enrollment, permanent hybrid mode, secure QR reprint, and resumable batches.

PRAGMA foreign_keys = OFF;

-- Rebuild the policy CHECK constraint while preserving the withdrawal trigger.
DROP TRIGGER IF EXISTS trg_finance_withdrawal_validate;

CREATE TABLE finance_credential_policy_new (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id=1),
  mode TEXT NOT NULL CHECK (mode IN ('RFID','QR','HYBRID','BOTH_TRANSITION')),
  transition_from TEXT CHECK (transition_from IN ('RFID','QR')),
  transition_to TEXT CHECK (transition_to IN ('RFID','QR')),
  transition_ends_at TEXT,
  denomination_rupiah INTEGER NOT NULL DEFAULT 5000 CHECK (denomination_rupiah > 0),
  per_transaction_cap_rupiah INTEGER NOT NULL DEFAULT 200000 CHECK (per_transaction_cap_rupiah > 0),
  pin_max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (pin_max_attempts > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO finance_credential_policy_new(
  singleton_id,mode,transition_from,transition_to,transition_ends_at,
  denomination_rupiah,per_transaction_cap_rupiah,pin_max_attempts,updated_by,updated_at
)
SELECT singleton_id,mode,transition_from,transition_to,transition_ends_at,
  denomination_rupiah,per_transaction_cap_rupiah,pin_max_attempts,updated_by,updated_at
FROM finance_credential_policy;

DROP TABLE finance_credential_policy;
ALTER TABLE finance_credential_policy_new RENAME TO finance_credential_policy;

CREATE TRIGGER trg_finance_withdrawal_validate
BEFORE INSERT ON finance_withdrawals
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_cash_shifts WHERE id=NEW.shift_id), '') <> 'OPEN'
    THEN RAISE(ABORT, 'FINANCE_SHIFT_NOT_OPEN') END;
  SELECT CASE WHEN COALESCE((SELECT operator_id FROM finance_cash_shifts WHERE id=NEW.shift_id), '') <> NEW.operator_id
    THEN RAISE(ABORT, 'FINANCE_SHIFT_OPERATOR_MISMATCH') END;
  SELECT CASE WHEN NEW.amount_rupiah > (SELECT per_transaction_cap_rupiah FROM finance_credential_policy WHERE singleton_id=1)
    THEN RAISE(ABORT, 'FINANCE_WITHDRAWAL_CAP_EXCEEDED') END;
  SELECT CASE WHEN NEW.amount_rupiah % (SELECT denomination_rupiah FROM finance_credential_policy WHERE singleton_id=1) <> 0
    THEN RAISE(ABORT, 'FINANCE_WITHDRAWAL_DENOMINATION') END;
  SELECT CASE WHEN COALESCE((SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=NEW.santri_id AND wallet_kind='JAJAN'),0) < NEW.amount_rupiah
    THEN RAISE(ABORT, 'FINANCE_WALLET_INSUFFICIENT') END;
  SELECT CASE WHEN (SELECT daily_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id) IS NOT NULL AND
    COALESCE((SELECT SUM(amount_rupiah) FROM finance_withdrawals WHERE santri_id=NEW.santri_id AND status='SUCCESS' AND date(created_at,'+7 hours')=date('now','+7 hours')),0) + NEW.amount_rupiah >
    (SELECT daily_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id)
    THEN RAISE(ABORT, 'FINANCE_DAILY_LIMIT_EXCEEDED') END;
  SELECT CASE WHEN (SELECT weekly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id) IS NOT NULL AND
    COALESCE((SELECT SUM(amount_rupiah) FROM finance_withdrawals WHERE santri_id=NEW.santri_id AND status='SUCCESS' AND date(created_at,'+7 hours') >= date('now','+7 hours','-' || ((strftime('%w','now','+7 hours')+6)%7) || ' days')),0) + NEW.amount_rupiah >
    (SELECT weekly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id)
    THEN RAISE(ABORT, 'FINANCE_WEEKLY_LIMIT_EXCEEDED') END;
  SELECT CASE WHEN (SELECT monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id) IS NOT NULL AND
    COALESCE((SELECT SUM(amount_rupiah) FROM finance_withdrawals WHERE santri_id=NEW.santri_id AND status='SUCCESS' AND strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours')),0) + NEW.amount_rupiah >
    (SELECT monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id)
    THEN RAISE(ABORT, 'FINANCE_MONTHLY_LIMIT_EXCEEDED') END;
END;

UPDATE finance_credential_policy SET mode='HYBRID',transition_from=NULL,transition_to=NULL,transition_ends_at=NULL;

ALTER TABLE student_credentials ADD COLUMN token_encrypted TEXT;
ALTER TABLE student_credentials ADD COLUMN card_number TEXT;
ALTER TABLE student_credentials ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_credentials ADD COLUMN last_printed_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_credentials_card_number
  ON student_credentials(card_number) WHERE card_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_credentials_current_kind
  ON student_credentials(santri_id,credential_kind)
  WHERE status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED');

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
CREATE INDEX IF NOT EXISTS idx_finance_credential_batch_items_status
  ON finance_credential_batch_items(batch_id,status,position);
CREATE INDEX IF NOT EXISTS idx_finance_credential_batches_actor
  ON finance_credential_batches(created_by,status,created_at);

PRAGMA foreign_keys = ON;
