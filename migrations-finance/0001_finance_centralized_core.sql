-- Finance migration 0001: Sistem Keuangan Terpusat v1
-- Seluruh tabel memakai prefix finance_ dan tidak membaca saldo legacy.
-- Nominal disimpan sebagai INTEGER rupiah. Jurnal POSTED dan pergerakan dompet immutable.

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

CREATE TABLE IF NOT EXISTS finance_periods (
  period_key TEXT PRIMARY KEY CHECK (period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_at TEXT,
  closed_by TEXT,
  close_hash TEXT,
  reopened_at TEXT,
  reopen_reason TEXT
);

CREATE TABLE IF NOT EXISTS finance_period_reopen_approvals (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL REFERENCES finance_periods(period_key),
  approver_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(period_key,approver_id)
);

CREATE TRIGGER IF NOT EXISTS trg_finance_period_reopen_two_approvals
BEFORE UPDATE OF status ON finance_periods
WHEN OLD.status='CLOSED' AND NEW.status='OPEN'
BEGIN
  SELECT CASE WHEN (SELECT COUNT(DISTINCT approver_id) FROM finance_period_reopen_approvals WHERE period_key=OLD.period_key) < 2
    THEN RAISE(ABORT, 'FINANCE_REOPEN_NEEDS_TWO_APPROVALS') END;
END;

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

CREATE INDEX IF NOT EXISTS idx_finance_journal_date ON finance_journals(effective_date, status);
CREATE INDEX IF NOT EXISTS idx_finance_journal_source ON finance_journals(source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_single_allocation_return ON finance_journals(source_type,source_id) WHERE source_type='ALLOCATION_RETURN';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_single_payout_journal ON finance_journals(source_type,source_id) WHERE source_type='PAYOUT';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_single_provider_reversal ON finance_journals(source_type,source_id) WHERE source_type='PROVIDER_REVERSAL';
CREATE INDEX IF NOT EXISTS idx_finance_entry_account ON finance_journal_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_entry_santri ON finance_journal_entries(santri_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_entry_asrama ON finance_journal_entries(asrama_scope, created_at);

CREATE TABLE IF NOT EXISTS finance_account_balances (
  account_id TEXT PRIMARY KEY REFERENCES finance_accounts(id),
  balance_rupiah INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_period_open
BEFORE INSERT ON finance_journals
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM finance_periods
    WHERE period_key = substr(NEW.effective_date, 1, 7) AND status = 'CLOSED'
  ) THEN RAISE(ABORT, 'FINANCE_PERIOD_CLOSED') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_entry_draft_only
BEFORE INSERT ON finance_journal_entries
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_journals WHERE id = NEW.journal_id), '') <> 'DRAFT'
    THEN RAISE(ABORT, 'FINANCE_JOURNAL_NOT_DRAFT') END;
  SELECT CASE WHEN COALESCE((SELECT is_active FROM finance_accounts WHERE id = NEW.account_id), 0) <> 1
    THEN RAISE(ABORT, 'FINANCE_ACCOUNT_INACTIVE') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_entry_no_update
BEFORE UPDATE ON finance_journal_entries BEGIN SELECT RAISE(ABORT, 'FINANCE_ENTRY_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_entry_no_delete
BEFORE DELETE ON finance_journal_entries BEGIN SELECT RAISE(ABORT, 'FINANCE_ENTRY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_validate_post
BEFORE UPDATE OF status ON finance_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM finance_journal_entries WHERE journal_id = NEW.id) < 2
    THEN RAISE(ABORT, 'FINANCE_JOURNAL_MINIMUM_TWO_ENTRIES') END;
  SELECT CASE WHEN
    COALESCE((SELECT SUM(CASE WHEN side='DEBIT' THEN amount_rupiah ELSE 0 END) FROM finance_journal_entries WHERE journal_id=NEW.id), 0)
    <>
    COALESCE((SELECT SUM(CASE WHEN side='CREDIT' THEN amount_rupiah ELSE 0 END) FROM finance_journal_entries WHERE journal_id=NEW.id), 0)
    THEN RAISE(ABORT, 'FINANCE_JOURNAL_UNBALANCED') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM finance_journal_entries e
    JOIN finance_accounts a ON a.id=e.account_id
    LEFT JOIN finance_account_balances b ON b.account_id=e.account_id
    WHERE e.journal_id=NEW.id AND a.allow_negative=0
    GROUP BY e.account_id
    HAVING COALESCE(MAX(b.balance_rupiah),0) + SUM(CASE WHEN a.normal_balance=e.side THEN e.amount_rupiah ELSE -e.amount_rupiah END) < 0
  ) THEN RAISE(ABORT, 'FINANCE_ACCOUNT_NEGATIVE') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM finance_wallet_movements m
    LEFT JOIN finance_student_wallets w ON w.santri_id=m.santri_id AND w.wallet_kind=m.wallet_kind
    WHERE m.journal_id=NEW.id
    GROUP BY m.santri_id,m.wallet_kind
    HAVING COALESCE(MAX(w.balance_rupiah),0)+SUM(m.amount_rupiah)<0 OR MAX(CASE WHEN w.frozen_at IS NOT NULL THEN 1 ELSE 0 END)=1
  ) THEN RAISE(ABORT, 'FINANCE_WALLET_INSUFFICIENT') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_apply_balances
AFTER UPDATE OF status ON finance_journals
WHEN OLD.status='DRAFT' AND NEW.status='POSTED'
BEGIN
  INSERT INTO finance_account_balances(account_id,balance_rupiah,version,updated_at)
  SELECT e.account_id,
         SUM(CASE WHEN a.normal_balance=e.side THEN e.amount_rupiah ELSE -e.amount_rupiah END),
         1,datetime('now')
  FROM finance_journal_entries e JOIN finance_accounts a ON a.id=e.account_id
  WHERE e.journal_id=NEW.id
  GROUP BY e.account_id
  ON CONFLICT(account_id) DO UPDATE SET
    balance_rupiah=balance_rupiah+excluded.balance_rupiah,
    version=version+1,
    updated_at=datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_posted_immutable
BEFORE UPDATE ON finance_journals
WHEN OLD.status = 'POSTED'
BEGIN SELECT RAISE(ABORT, 'FINANCE_JOURNAL_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_journal_no_delete
BEFORE DELETE ON finance_journals BEGIN SELECT RAISE(ABORT, 'FINANCE_JOURNAL_IMMUTABLE'); END;

-- Dompet/subledger per santri. Tidak bersumber dari santri.saldo_uang_jajan legacy.
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

CREATE INDEX IF NOT EXISTS idx_finance_wallet_movement_student ON finance_wallet_movements(santri_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_movement_validate
BEFORE INSERT ON finance_wallet_movements
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_journals WHERE id=NEW.journal_id), '') <> 'DRAFT'
    THEN RAISE(ABORT, 'FINANCE_WALLET_JOURNAL_NOT_DRAFT') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM finance_student_wallets
    WHERE santri_id=NEW.santri_id AND wallet_kind=NEW.wallet_kind AND frozen_at IS NOT NULL
  ) THEN RAISE(ABORT, 'FINANCE_WALLET_FROZEN') END;
  SELECT CASE WHEN COALESCE((
    SELECT balance_rupiah FROM finance_student_wallets
    WHERE santri_id=NEW.santri_id AND wallet_kind=NEW.wallet_kind
  ), 0) + NEW.amount_rupiah < 0 THEN RAISE(ABORT, 'FINANCE_WALLET_INSUFFICIENT') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_apply_wallets
AFTER UPDATE OF status ON finance_journals
WHEN OLD.status='DRAFT' AND NEW.status='POSTED'
BEGIN
  INSERT INTO finance_student_wallets(santri_id,wallet_kind,balance_rupiah,version,updated_at)
  SELECT santri_id,wallet_kind,SUM(amount_rupiah),1,datetime('now')
  FROM finance_wallet_movements WHERE journal_id=NEW.id
  GROUP BY santri_id,wallet_kind
  ON CONFLICT(santri_id,wallet_kind) DO UPDATE SET
    balance_rupiah=balance_rupiah+excluded.balance_rupiah,
    version=version+1,
    updated_at=datetime('now');

  UPDATE finance_wallet_movements
  SET balance_before=
        (SELECT w.balance_rupiah FROM finance_student_wallets w WHERE w.santri_id=finance_wallet_movements.santri_id AND w.wallet_kind=finance_wallet_movements.wallet_kind)
        - (SELECT SUM(m.amount_rupiah) FROM finance_wallet_movements m WHERE m.journal_id=NEW.id AND m.santri_id=finance_wallet_movements.santri_id AND m.wallet_kind=finance_wallet_movements.wallet_kind)
        + COALESCE((SELECT SUM(m.amount_rupiah) FROM finance_wallet_movements m WHERE m.journal_id=NEW.id AND m.santri_id=finance_wallet_movements.santri_id AND m.wallet_kind=finance_wallet_movements.wallet_kind AND m.rowid<finance_wallet_movements.rowid),0),
      balance_after=
        (SELECT w.balance_rupiah FROM finance_student_wallets w WHERE w.santri_id=finance_wallet_movements.santri_id AND w.wallet_kind=finance_wallet_movements.wallet_kind)
        - (SELECT SUM(m.amount_rupiah) FROM finance_wallet_movements m WHERE m.journal_id=NEW.id AND m.santri_id=finance_wallet_movements.santri_id AND m.wallet_kind=finance_wallet_movements.wallet_kind)
        + COALESCE((SELECT SUM(m.amount_rupiah) FROM finance_wallet_movements m WHERE m.journal_id=NEW.id AND m.santri_id=finance_wallet_movements.santri_id AND m.wallet_kind=finance_wallet_movements.wallet_kind AND m.rowid<finance_wallet_movements.rowid),0)
        + finance_wallet_movements.amount_rupiah
  WHERE journal_id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_movement_no_update
BEFORE UPDATE ON finance_wallet_movements
WHEN OLD.balance_before IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'FINANCE_WALLET_MOVEMENT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_movement_no_delete
BEFORE DELETE ON finance_wallet_movements BEGIN SELECT RAISE(ABORT, 'FINANCE_WALLET_MOVEMENT_IMMUTABLE'); END;

-- Akun wali baru dan relasi multi-anak. Login legacy dapat ditautkan bertahap.
CREATE TABLE IF NOT EXISTS finance_guardians (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED','MIGRATION_PENDING')),
  legacy_santri_id TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_guardian_phone ON finance_guardians(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_guardian_email ON finance_guardians(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS finance_guardian_students (
  guardian_id TEXT NOT NULL REFERENCES finance_guardians(id),
  santri_id TEXT NOT NULL,
  relationship TEXT,
  access_level TEXT NOT NULL DEFAULT 'VIEW' CHECK (access_level IN ('PRIMARY_FINANCE','VIEW','NOTIFY')),
  linked_by TEXT,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(guardian_id, santri_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_primary_guardian ON finance_guardian_students(santri_id) WHERE access_level='PRIMARY_FINANCE';

CREATE TABLE IF NOT EXISTS finance_payment_intents (
  id TEXT PRIMARY KEY,
  merchant_order_id TEXT NOT NULL UNIQUE,
  santri_id TEXT NOT NULL,
  guardian_id TEXT,
  provider TEXT NOT NULL DEFAULT 'DUITKU',
  payment_method TEXT NOT NULL,
  amount_rupiah INTEGER NOT NULL CHECK (typeof(amount_rupiah)='integer' AND amount_rupiah > 0),
  gateway_fee_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (gateway_fee_rupiah >= 0),
  charged_amount_rupiah INTEGER NOT NULL CHECK (charged_amount_rupiah > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','EXPIRED','CANCELLED','REVERSED')),
  payment_url TEXT,
  va_number TEXT,
  qr_string TEXT,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  late_paid INTEGER NOT NULL DEFAULT 0 CHECK (late_paid IN (0,1)),
  review_status TEXT NOT NULL DEFAULT 'NONE' CHECK (review_status IN ('NONE','REQUIRED','CLEARED')),
  provider_reference TEXT,
  provider_payload_json TEXT,
  journal_id TEXT REFERENCES finance_journals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_active_intent_student ON finance_payment_intents(santri_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS idx_finance_intent_status ON finance_payment_intents(status, expires_at);

CREATE TRIGGER IF NOT EXISTS trg_finance_topup_journal_requires_paid_intent
BEFORE INSERT ON finance_journals
WHEN NEW.source_type='TOPUP'
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_payment_intents WHERE id=NEW.source_id),'') <> 'PAID'
    THEN RAISE(ABORT, 'FINANCE_TOPUP_INTENT_NOT_PAID') END;
  SELECT CASE WHEN (SELECT journal_id FROM finance_payment_intents WHERE id=NEW.source_id) IS NOT NULL
    THEN RAISE(ABORT, 'FINANCE_TOPUP_ALREADY_POSTED') END;
END;

CREATE TABLE IF NOT EXISTS finance_gateway_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  merchant_order_id TEXT,
  signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0,1)),
  payload_json TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE(provider, event_key)
);

CREATE TABLE IF NOT EXISTS finance_allocations (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  santri_id TEXT NOT NULL,
  destination_kind TEXT NOT NULL CHECK (destination_kind IN ('SPP','USPP','NON_SPP','MAKAN','LAUNDRY','JAJAN')),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah > 0),
  billing_reference TEXT,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','COMMITTED','DISBURSED','RETURNED')),
  cutoff_at TEXT,
  journal_id TEXT NOT NULL REFERENCES finance_journals(id),
  created_by_type TEXT NOT NULL,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  committed_at TEXT,
  disbursed_at TEXT,
  returned_at TEXT
);

CREATE TABLE IF NOT EXISTS finance_bills (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  bill_kind TEXT NOT NULL CHECK (bill_kind IN ('SPP','USPP','NON_SPP')),
  title TEXT NOT NULL,
  period_key TEXT,
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  paid_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (paid_rupiah>=0 AND paid_rupiah<=amount_rupiah),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIAL','PAID','VOID')),
  due_date TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_bills_student ON finance_bills(santri_id,status,due_date);

CREATE TRIGGER IF NOT EXISTS trg_finance_bill_payment_rules
BEFORE UPDATE OF paid_rupiah ON finance_bills
BEGIN
  SELECT CASE WHEN NEW.paid_rupiah>NEW.amount_rupiah THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN OLD.bill_kind IN ('SPP','NON_SPP') AND NEW.paid_rupiah NOT IN (0,NEW.amount_rupiah)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

CREATE TABLE IF NOT EXISTS finance_allocation_bill_items (
  allocation_id TEXT NOT NULL REFERENCES finance_allocations(id),
  bill_id TEXT NOT NULL REFERENCES finance_bills(id),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  PRIMARY KEY(allocation_id,bill_id)
);

CREATE TRIGGER IF NOT EXISTS trg_finance_allocation_bill_validate
BEFORE INSERT ON finance_allocation_bill_items
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_bills WHERE id=NEW.bill_id),'') NOT IN ('OPEN','PARTIAL')
    THEN RAISE(ABORT,'FINANCE_BILL_NOT_OPEN') END;
  SELECT CASE WHEN NEW.amount_rupiah>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN (SELECT bill_kind FROM finance_bills WHERE id=NEW.bill_id) IN ('SPP','NON_SPP')
    AND NEW.amount_rupiah<>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

-- Credential hanya otorisasi akun santri; saldo dan limit tidak menempel pada kartu.
CREATE TABLE IF NOT EXISTS finance_credential_policy (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id=1),
  mode TEXT NOT NULL CHECK (mode IN ('RFID','QR','BOTH_TRANSITION')),
  transition_from TEXT CHECK (transition_from IN ('RFID','QR')),
  transition_to TEXT CHECK (transition_to IN ('RFID','QR')),
  transition_ends_at TEXT,
  denomination_rupiah INTEGER NOT NULL DEFAULT 5000 CHECK (denomination_rupiah > 0),
  per_transaction_cap_rupiah INTEGER NOT NULL DEFAULT 200000 CHECK (per_transaction_cap_rupiah > 0),
  pin_max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (pin_max_attempts > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_credentials (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  credential_kind TEXT NOT NULL CHECK (credential_kind IN ('RFID_UID','QR_STATIC')),
  token_hmac TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED_BY_POLICY','BLOCKED','LOST','EXPIRED','REVOKED')),
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  blocked_reason TEXT,
  replacement_credential_id TEXT REFERENCES student_credentials(id),
  physically_verified_at TEXT,
  physically_verified_by TEXT,
  last_used_at TEXT,
  created_by TEXT,
  UNIQUE(credential_kind, token_hmac, token_version)
);
CREATE INDEX IF NOT EXISTS idx_student_credentials_student ON student_credentials(santri_id, status);

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
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_open_shift_operator ON finance_cash_shifts(operator_id) WHERE status='OPEN';

CREATE TABLE IF NOT EXISTS finance_withdrawals (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  santri_id TEXT NOT NULL,
  credential_id TEXT NOT NULL REFERENCES student_credentials(id),
  credential_kind TEXT NOT NULL CHECK (credential_kind IN ('RFID_UID','QR_STATIC')),
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
CREATE INDEX IF NOT EXISTS idx_finance_withdrawal_student ON finance_withdrawals(santri_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_withdrawal_shift ON finance_withdrawals(shift_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_validate
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

CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_apply_wallet
AFTER INSERT ON finance_withdrawals
BEGIN
  INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id)
  VALUES('wm-' || NEW.id, 'withdrawal:' || NEW.idempotency_key, NEW.journal_id, NEW.santri_id, 'JAJAN', -NEW.amount_rupiah, 'WITHDRAWAL', 'WITHDRAWAL', NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_no_update
BEFORE UPDATE ON finance_withdrawals BEGIN SELECT RAISE(ABORT, 'FINANCE_WITHDRAWAL_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_no_delete
BEFORE DELETE ON finance_withdrawals BEGIN SELECT RAISE(ABORT, 'FINANCE_WITHDRAWAL_IMMUTABLE'); END;

-- Payout maker-checker-executor dan rekening penerima dengan cooling period 24 jam.
CREATE TABLE IF NOT EXISTS finance_recipients (
  id TEXT PRIMARY KEY,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('MEAL_MANAGER','LAUNDRY_MANAGER','TEACHER','OTHER')),
  name TEXT NOT NULL,
  asrama_scope TEXT,
  bank_code TEXT,
  account_number_encrypted TEXT,
  account_number_masked TEXT,
  account_holder_name TEXT,
  verified_at TEXT,
  usable_after TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','FROZEN','INACTIVE')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_payouts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient_id TEXT NOT NULL REFERENCES finance_recipients(id),
  payout_type TEXT NOT NULL CHECK (payout_type IN ('MEAL','LAUNDRY','PAYROLL','REFUND','OTHER')),
  asrama_scope TEXT,
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah > 0),
  fee_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (fee_rupiah >= 0),
  method TEXT NOT NULL CHECK (method IN ('API','MANUAL_TRANSFER','CASH')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','CHECKED','EXECUTING','PROVIDER_SUCCESS','RECONCILED','FAILED','CANCELLED')),
  maker_id TEXT NOT NULL,
  checker_id TEXT,
  executor_id TEXT,
  provider_reference TEXT,
  proof_url TEXT,
  journal_id TEXT REFERENCES finance_journals(id),
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_at TEXT,
  executed_at TEXT,
  reconciled_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS trg_finance_payout_no_self_check
BEFORE UPDATE OF status ON finance_payouts
WHEN NEW.status IN ('CHECKED','EXECUTING')
BEGIN
  SELECT CASE WHEN NEW.maker_id=NEW.checker_id THEN RAISE(ABORT, 'FINANCE_SELF_APPROVAL_FORBIDDEN') END;
  SELECT CASE WHEN NEW.status='EXECUTING' AND (NEW.executor_id=NEW.maker_id OR NEW.executor_id=NEW.checker_id)
    THEN RAISE(ABORT, 'FINANCE_SELF_EXECUTION_FORBIDDEN') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_payout_recipient_ready
BEFORE UPDATE OF status ON finance_payouts
WHEN NEW.status IN ('SUBMITTED','CHECKED','EXECUTING')
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_recipients WHERE id=NEW.recipient_id),'') <> 'ACTIVE'
    THEN RAISE(ABORT, 'FINANCE_RECIPIENT_NOT_ACTIVE') END;
  SELECT CASE WHEN datetime(COALESCE((SELECT usable_after FROM finance_recipients WHERE id=NEW.recipient_id),'9999-12-31')) > datetime('now')
    THEN RAISE(ABORT, 'FINANCE_RECIPIENT_COOLING_PERIOD') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_payout_insert_recipient_ready
BEFORE INSERT ON finance_payouts
WHEN NEW.status='SUBMITTED'
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_recipients WHERE id=NEW.recipient_id),'') <> 'ACTIVE'
    THEN RAISE(ABORT, 'FINANCE_RECIPIENT_NOT_ACTIVE') END;
  SELECT CASE WHEN datetime(COALESCE((SELECT usable_after FROM finance_recipients WHERE id=NEW.recipient_id),'9999-12-31')) > datetime('now')
    THEN RAISE(ABORT, 'FINANCE_RECIPIENT_COOLING_PERIOD') END;
END;

CREATE TABLE IF NOT EXISTS finance_reconciliation_imports (
  id TEXT PRIMARY KEY,
  bank_account_label TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  period_start TEXT,
  period_end TEXT,
  imported_by TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'IMPORTING' CHECK (status IN ('IMPORTING','READY','FAILED')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_bank_transactions (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES finance_reconciliation_imports(id),
  row_number INTEGER NOT NULL,
  transaction_at TEXT NOT NULL,
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah <> 0),
  bank_reference TEXT,
  description TEXT,
  match_status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK (match_status IN ('UNMATCHED','AUTO_MATCHED','MANUAL_MATCHED','IGNORED')),
  matched_type TEXT,
  matched_id TEXT,
  matched_by TEXT,
  matched_at TEXT,
  raw_json TEXT NOT NULL,
  UNIQUE(import_id,row_number)
);

CREATE TABLE IF NOT EXISTS finance_incident_modes (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  allowed_channels_json TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED','CANCELLED')),
  opened_by TEXT NOT NULL,
  approved_by TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_incident_receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  incident_id TEXT NOT NULL REFERENCES finance_incident_modes(id),
  santri_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('CASH','EMERGENCY_TRANSFER')),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  received_by TEXT NOT NULL,
  shift_id TEXT REFERENCES finance_cash_shifts(id),
  bank_reference TEXT,
  journal_id TEXT NOT NULL REFERENCES finance_journals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payroll terpisah, tetapi jurnal/payout tetap memakai tabel finance_* yang sama.
CREATE TABLE IF NOT EXISTS finance_payroll_policies (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  fixed_salary_mode TEXT NOT NULL CHECK (fixed_salary_mode IN ('UNCHANGED','DEDUCT_ABSENCE','ATTENDANCE_THRESHOLD')),
  threshold_percent INTEGER,
  substitute_percent INTEGER NOT NULL DEFAULT 100 CHECK (substitute_percent BETWEEN 0 AND 100),
  default_session_rate_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (default_session_rate_rupiah >= 0),
  config_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(version)
);

CREATE TABLE IF NOT EXISTS finance_payroll_periods (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL UNIQUE,
  attendance_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (attendance_status IN ('OPEN','LOCKED')),
  payroll_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (payroll_status IN ('DRAFT','CALCULATED','APPROVED','PROCESSING','COMPLETED')),
  policy_id TEXT REFERENCES finance_payroll_policies(id),
  locked_by TEXT,
  locked_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_teaching_attendance (
  id TEXT PRIMARY KEY,
  payroll_period_id TEXT NOT NULL REFERENCES finance_payroll_periods(id),
  schedule_reference TEXT NOT NULL,
  scheduled_teacher_id TEXT NOT NULL,
  actual_teacher_id TEXT,
  session_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','ABSENT','HOLIDAY','SUBSTITUTE')),
  verified_by TEXT,
  verified_at TEXT,
  notes TEXT,
  UNIQUE(payroll_period_id,schedule_reference,session_date)
);

CREATE TABLE IF NOT EXISTS finance_teacher_compensation (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  fixed_salary_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (fixed_salary_rupiah >= 0),
  session_rate_rupiah INTEGER CHECK (session_rate_rupiah IS NULL OR session_rate_rupiah >= 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(teacher_id,effective_from)
);

CREATE TABLE IF NOT EXISTS finance_payroll_items (
  id TEXT PRIMARY KEY,
  payroll_period_id TEXT NOT NULL REFERENCES finance_payroll_periods(id),
  teacher_id TEXT NOT NULL,
  fixed_salary_rupiah INTEGER NOT NULL DEFAULT 0,
  session_honor_rupiah INTEGER NOT NULL DEFAULT 0,
  deduction_rupiah INTEGER NOT NULL DEFAULT 0,
  net_rupiah INTEGER NOT NULL CHECK (net_rupiah >= 0),
  calculation_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED','APPROVED','PAYOUT_PENDING','PAID','FAILED')),
  payout_id TEXT REFERENCES finance_payouts(id),
  journal_id TEXT REFERENCES finance_journals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payroll_period_id,teacher_id)
);

INSERT OR IGNORE INTO finance_payroll_policies(id,version,effective_from,fixed_salary_mode,threshold_percent,substitute_percent,default_session_rate_rupiah,created_by)
VALUES('payroll-policy-v1',1,'2026-01-01','UNCHANGED',NULL,100,0,'SYSTEM');

CREATE TABLE IF NOT EXISTS finance_break_glass (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  scope TEXT NOT NULL,
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_staff_mfa (
  user_id TEXT PRIMARY KEY,
  method TEXT NOT NULL CHECK (method IN ('TOTP','WEBAUTHN')),
  secret_encrypted TEXT,
  recovery_codes_hash TEXT,
  enabled_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS finance_staff_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_finance_staff_sessions_user ON finance_staff_sessions(user_id,expires_at);

CREATE TABLE IF NOT EXISTS finance_auth_attempts (
  id TEXT PRIMARY KEY,
  identity_hash TEXT NOT NULL,
  ip_hash TEXT,
  succeeded INTEGER NOT NULL CHECK (succeeded IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_auth_attempts_identity ON finance_auth_attempts(identity_hash,created_at);

CREATE TABLE IF NOT EXISTS finance_audit_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  asrama_scope TEXT,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON finance_audit_log(entity_type,entity_id,created_at);

CREATE TABLE IF NOT EXISTS finance_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO finance_credential_policy(singleton_id,mode) VALUES(1,'RFID');

INSERT OR IGNORE INTO finance_accounts(id,code,name,account_type,normal_balance,allow_negative) VALUES
('fa-main-bank','1101','Rekening Utama','ASSET','DEBIT',0),
('fa-gateway-clearing','1102','Clearing Gateway','ASSET','DEBIT',1),
('fa-central-cash','1103','Kas Pusat','ASSET','DEBIT',0),
('fa-unit-cash','1104','Kas Unit/Loket','ASSET','DEBIT',0),
('fa-parent-receivable','1201','Piutang Wali','ASSET','DEBIT',0),
('fa-guardian-float','2101','Titipan Wali','LIABILITY','CREDIT',0),
('fa-meal-payable','2102','Utang Pengelola Makan','LIABILITY','CREDIT',0),
('fa-laundry-payable','2103','Utang Pengelola Laundry','LIABILITY','CREDIT',0),
('fa-payroll-payable','2104','Utang Payroll','LIABILITY','CREDIT',0),
('fa-jajan-liability','2105','Titipan Uang Jajan','LIABILITY','CREDIT',0),
('fa-spp-revenue','4101','Pendapatan SPP','REVENUE','CREDIT',0),
('fa-uspp-revenue','4102','Pendapatan USPP/Uang Bangunan','REVENUE','CREDIT',0),
('fa-nonspp-revenue','4103','Pendapatan Non-SPP','REVENUE','CREDIT',0),
('fa-gateway-fee-revenue','4104','Penerimaan Biaya Gateway dari Wali','REVENUE','CREDIT',0),
('fa-gateway-fee-expense','5101','Biaya Gateway','EXPENSE','DEBIT',0),
('fa-payroll-expense','5102','Beban Payroll','EXPENSE','DEBIT',0),
('fa-suspense','9999','Suspense/Rekonsiliasi','ASSET','DEBIT',1);

CREATE TABLE IF NOT EXISTS finance_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Snapshot master data untuk tampilan historis dan scope akses. Snapshot ini
-- diperbarui dari DB utama sebelum transaksi terkait diposting di FINANCE_DB.
CREATE TABLE IF NOT EXISTS finance_student_snapshots (
  santri_id TEXT PRIMARY KEY,
  nis TEXT NOT NULL,
  full_name TEXT NOT NULL,
  asrama TEXT,
  kamar TEXT,
  photo_url TEXT,
  status_global TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_student_snapshot_asrama ON finance_student_snapshots(asrama,status_global);

CREATE TABLE IF NOT EXISTS finance_staff_snapshots (
  user_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  roles_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(roles_json)),
  asrama_scope TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_teacher_snapshots (
  teacher_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO finance_settings(key,value) VALUES
('finance_payment_intent_ttl_hours','24'),
('finance_soft_alerts','{"topup_rupiah":5000000,"student_balance_rupiah":10000000,"aggregate_float_rupiah":500000000}'),
('finance_meal_cutoff','{"day":25,"time":"23:59"}'),
('finance_laundry_cutoff','{"day":25,"time":"23:59"}');
