-- 0198: Manual bank transfer channel (upload bukti + verifikasi petugas) and
-- collective uang jajan payout via asrama representatives.
--
-- Additive in meaning: no financial row is deleted or altered. Four tables are
-- rebuilt only to widen CHECK constraints (SQLite cannot ALTER a CHECK):
--   finance_payment_orders, finance_payments, finance_cooperative_admin_fee_rules,
--   finance_wallet_ledger.
--
-- D1 always enforces foreign keys and runs this file as ONE transaction, so the
-- rebuild uses: copy rows aside -> drop -> rename empty new table -> re-insert.
-- Re-inserting parent rows after the rename satisfies the deferred FK checks of
-- child tables (verified with SQLite under PRAGMA foreign_keys=ON).
--
-- Every trigger that mentions a rebuilt table is dropped first (SQLite refuses
-- to rename while another table's trigger references a missing table) and is
-- recreated at the end. Run the preflight in docs/MANUAL_TRANSFER_MIGRATION.md
-- first: it lists triggers in the target database that this file must know.
PRAGMA defer_foreign_keys = on;
-- Row-count guard: a mismatch violates the CHECK and aborts the whole file.
CREATE TABLE _migration_0198_rowcheck (name TEXT NOT NULL, ok INTEGER NOT NULL CHECK (ok = 1));

-- ------------------------------------------------------------------
-- 1. Drop triggers that reference rebuilt tables
-- ------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_finance_briva_expiry_guard;
DROP TRIGGER IF EXISTS trg_finance_payments_briva_guard;
DROP TRIGGER IF EXISTS trg_finance_payments_prevent_invalid_settled;
DROP TRIGGER IF EXISTS trg_finance_orders_prevent_paid_if_not_pending;
DROP TRIGGER IF EXISTS trg_finance_order_money_guard;
DROP TRIGGER IF EXISTS trg_finance_order_snapshot_immutable;
DROP TRIGGER IF EXISTS trg_finance_order_terms_immutable;
DROP TRIGGER IF EXISTS trg_finance_bri_settlement_items_guard;
DROP TRIGGER IF EXISTS trg_finance_operation_session_guard;
DROP TRIGGER IF EXISTS trg_finance_wallet_verify_balance;
DROP TRIGGER IF EXISTS trg_finance_wallet_withdrawal_limit;
DROP TRIGGER IF EXISTS trg_finance_wallet_integer_guard;
DROP TRIGGER IF EXISTS trg_sandbox_recovery_wallet_arithmetic;
-- Sandbox-only (sandbox-recovery/0194). They reference finance_payments, so they must be
-- dropped before the rename; recreate them on sandbox with
-- sandbox-recovery/0198_sandbox_restore_recovery_triggers.sql. No-op on production.
DROP TRIGGER IF EXISTS trg_sandbox_recovery_quarantine_dist_insert;
DROP TRIGGER IF EXISTS trg_sandbox_recovery_quarantine_dist_update;
DROP TRIGGER IF EXISTS trg_finance_billing_order_review;
DROP TRIGGER IF EXISTS trg_finance_billing_allocation_review;

-- ------------------------------------------------------------------
-- 2. Destination bank accounts (needed by the orders FK)
-- ------------------------------------------------------------------
CREATE TABLE finance_transfer_accounts (
  id TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL CHECK (length(trim(bank_name)) > 0),
  account_number TEXT NOT NULL CHECK (length(trim(account_number)) > 0),
  account_holder TEXT NOT NULL CHECK (length(trim(account_holder)) > 0),
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bank_name, account_number)
);

-- ------------------------------------------------------------------
-- 3. Rebuild finance_payment_orders
-- ------------------------------------------------------------------
CREATE TABLE finance_payment_orders_copy AS SELECT * FROM finance_payment_orders;
CREATE TABLE finance_payment_orders_new (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    payer_type TEXT NOT NULL CHECK (payer_type IN ('PORTAL_ORTU', 'LOKET')),
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    cooperative_admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (cooperative_admin_fee >= 0),
    fee_payer TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (fee_payer IN ('CUSTOMER', 'INSTITUTION')),
    total_charged INTEGER NOT NULL CHECK (total_charged >= 0),
    payment_method TEXT CHECK (payment_method IN ('BRI_VA', 'CASH', 'MANUAL_TRANSFER')),
    fixed_va_number TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REPLACED')),
    expires_at TEXT NOT NULL,
    cash_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    cooperative_fee_rule_id TEXT,
    cooperative_fee_snapshot TEXT,
    unique_code INTEGER NOT NULL DEFAULT 0 CHECK (unique_code >= 0 AND unique_code <= 9999),
    fee_mode TEXT CHECK (fee_mode IS NULL OR fee_mode IN ('ADD', 'DEDUCT')),
    destination_account_id TEXT REFERENCES finance_transfer_accounts(id),
    destination_snapshot TEXT,
    CHECK (
      (payment_method = 'MANUAL_TRANSFER' AND unique_code > 0 AND fee_mode IS NOT NULL
        AND fee_payer = 'CUSTOMER' AND destination_account_id IS NOT NULL AND destination_snapshot IS NOT NULL
        AND total_charged = gross_amount + cooperative_admin_fee + unique_code)
      OR (payment_method IS NOT 'MANUAL_TRANSFER' AND unique_code = 0 AND fee_mode IS NULL
        AND destination_account_id IS NULL AND destination_snapshot IS NULL)
    )
);
DROP TABLE finance_payment_orders;
ALTER TABLE finance_payment_orders_new RENAME TO finance_payment_orders;
INSERT INTO finance_payment_orders (
  id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, fee_payer,
  total_charged, payment_method, fixed_va_number, status, expires_at, cash_session_id,
  created_at, updated_at, cooperative_fee_rule_id, cooperative_fee_snapshot
) SELECT
  id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, fee_payer,
  total_charged, payment_method, fixed_va_number, status, expires_at, cash_session_id,
  created_at, updated_at, cooperative_fee_rule_id, cooperative_fee_snapshot
FROM finance_payment_orders_copy;
INSERT INTO _migration_0198_rowcheck(name, ok) SELECT 'MIGRATION_0198_ROWCOUNT_ORDERS', (SELECT COUNT(*) FROM finance_payment_orders) = (SELECT COUNT(*) FROM finance_payment_orders_copy);
DROP TABLE finance_payment_orders_copy;

CREATE INDEX idx_finance_payment_orders_expires ON finance_payment_orders(expires_at);
CREATE INDEX idx_finance_payment_orders_number ON finance_payment_orders(order_number);
CREATE INDEX idx_finance_payment_orders_santri ON finance_payment_orders(santri_id, status);
CREATE INDEX idx_finance_payment_orders_status ON finance_payment_orders(status);
-- Max one active online order (BRIVA or manual transfer) per santri.
CREATE UNIQUE INDEX uq_finance_payment_orders_single_active_online
    ON finance_payment_orders(santri_id)
    WHERE status = 'PENDING' AND payment_method IN ('BRI_VA', 'MANUAL_TRANSFER');
-- The exact transfer amount (incl. unique code) identifies one pending order.
CREATE UNIQUE INDEX uq_finance_payment_orders_transfer_amount
    ON finance_payment_orders(total_charged)
    WHERE status = 'PENDING' AND payment_method = 'MANUAL_TRANSFER';

-- ------------------------------------------------------------------
-- 4. Rebuild finance_payments (channel TRANSFER + unique_code_amount)
-- ------------------------------------------------------------------
CREATE TABLE finance_payments_copy AS SELECT * FROM finance_payments;
CREATE TABLE finance_payments_new (
    id TEXT PRIMARY KEY,
    payment_number TEXT NOT NULL UNIQUE,
    order_id TEXT REFERENCES finance_payment_orders(id),
    santri_id TEXT NOT NULL REFERENCES santri(id),
    channel TEXT NOT NULL CHECK (channel IN ('BRI', 'CASH', 'TRANSFER')),
    method TEXT NOT NULL,
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    cooperative_admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (cooperative_admin_fee >= 0),
    bri_fee_amount INTEGER CHECK (bri_fee_amount IS NULL OR bri_fee_amount >= 0),
    net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
    status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'SETTLED')),
    correction_status TEXT NOT NULL DEFAULT 'NONE' CHECK (correction_status IN ('NONE', 'PARTIALLY_CORRECTED', 'FULLY_CORRECTED')),
    allocation_status TEXT NOT NULL DEFAULT 'ALLOCATED' CHECK (allocation_status IN ('ALLOCATED', 'PARTIALLY_ALLOCATED', 'UNALLOCATED')),
    paid_at TEXT NOT NULL,
    bri_payment_request_id TEXT,
    bri_trx_id TEXT,
    external_reference TEXT,
    cash_session_id TEXT,
    received_by TEXT REFERENCES users(id),
    source TEXT NOT NULL DEFAULT 'NEW_FINANCE' CHECK (source IN ('NEW_FINANCE', 'LEGACY')),
    fund_management TEXT NOT NULL DEFAULT 'KOPERASI' CHECK (fund_management IN ('PRE_KOPERASI', 'KOPERASI')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    unique_code_amount INTEGER NOT NULL DEFAULT 0 CHECK (unique_code_amount >= 0),
    CHECK (channel = 'TRANSFER' OR unique_code_amount = 0),
    CHECK (channel != 'TRANSFER' OR method = 'MANUAL_TRANSFER')
);
DROP TABLE finance_payments;
ALTER TABLE finance_payments_new RENAME TO finance_payments;
INSERT INTO finance_payments (
  id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee,
  bri_fee_amount, net_amount, status, correction_status, allocation_status, paid_at,
  bri_payment_request_id, bri_trx_id, external_reference, cash_session_id, received_by,
  source, fund_management, created_at
) SELECT
  id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee,
  bri_fee_amount, net_amount, status, correction_status, allocation_status, paid_at,
  bri_payment_request_id, bri_trx_id, external_reference, cash_session_id, received_by,
  source, fund_management, created_at
FROM finance_payments_copy;
INSERT INTO _migration_0198_rowcheck(name, ok) SELECT 'MIGRATION_0198_ROWCOUNT_PAYMENTS', (SELECT COUNT(*) FROM finance_payments) = (SELECT COUNT(*) FROM finance_payments_copy);
DROP TABLE finance_payments_copy;

CREATE INDEX idx_finance_payments_alloc_status ON finance_payments(allocation_status);
CREATE INDEX idx_finance_payments_number ON finance_payments(payment_number);
CREATE INDEX idx_finance_payments_order ON finance_payments(order_id);
CREATE INDEX idx_finance_payments_paid_at ON finance_payments(paid_at);
CREATE INDEX idx_finance_payments_santri ON finance_payments(santri_id);
CREATE INDEX idx_finance_payments_status ON finance_payments(status);
CREATE INDEX idx_finance_payments_channel_paid ON finance_payments(channel, paid_at);
CREATE UNIQUE INDEX uq_finance_payments_bri_payment_req_id ON finance_payments(bri_payment_request_id)
    WHERE bri_payment_request_id IS NOT NULL;
CREATE UNIQUE INDEX uq_finance_payments_bri_trx_id ON finance_payments(bri_trx_id)
    WHERE bri_trx_id IS NOT NULL;
CREATE UNIQUE INDEX uq_finance_payments_channel_ext_ref ON finance_payments(channel, external_reference)
    WHERE external_reference IS NOT NULL;

-- ------------------------------------------------------------------
-- 5. Rebuild finance_cooperative_admin_fee_rules (channel TRANSFER)
-- ------------------------------------------------------------------
CREATE TABLE finance_cooperative_admin_fee_rules_copy AS SELECT * FROM finance_cooperative_admin_fee_rules;
CREATE TABLE finance_cooperative_admin_fee_rules_new (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    applies_to_channel TEXT NOT NULL DEFAULT 'BRI' CHECK (applies_to_channel IN ('BRI', 'TRANSFER')),
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    closed_by TEXT REFERENCES users(id),
    closed_at TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
DROP TABLE finance_cooperative_admin_fee_rules;
ALTER TABLE finance_cooperative_admin_fee_rules_new RENAME TO finance_cooperative_admin_fee_rules;
INSERT INTO finance_cooperative_admin_fee_rules (
  id, code, name, is_enabled, amount, applies_to_channel, effective_from, effective_until,
  closed_by, closed_at, created_by, created_at
) SELECT
  id, code, name, is_enabled, amount, applies_to_channel, effective_from, effective_until,
  closed_by, closed_at, created_by, created_at
FROM finance_cooperative_admin_fee_rules_copy;
INSERT INTO _migration_0198_rowcheck(name, ok) SELECT 'MIGRATION_0198_ROWCOUNT_FEE_RULES', (SELECT COUNT(*) FROM finance_cooperative_admin_fee_rules) = (SELECT COUNT(*) FROM finance_cooperative_admin_fee_rules_copy);
DROP TABLE finance_cooperative_admin_fee_rules_copy;
CREATE INDEX idx_coop_admin_fee_rules_lookup
    ON finance_cooperative_admin_fee_rules(code, applies_to_channel, is_enabled, effective_from, effective_until);
CREATE UNIQUE INDEX uq_finance_admin_fee_single_open_rule
    ON finance_cooperative_admin_fee_rules(applies_to_channel, code)
    WHERE is_enabled = 1 AND effective_until IS NULL;

-- Koperasi income: separate the admin fee from the unique transfer code.
ALTER TABLE finance_cooperative_income
  ADD COLUMN income_source TEXT NOT NULL DEFAULT 'ADMIN_FEE'
  CHECK (income_source IN ('ADMIN_FEE', 'UNIQUE_CODE'));
CREATE INDEX idx_finance_coop_income_source ON finance_cooperative_income(income_source, created_at);

-- ------------------------------------------------------------------
-- 6. Rebuild finance_wallet_ledger (transfer top-up + collective payout)
-- ------------------------------------------------------------------
CREATE TABLE finance_wallet_ledger_copy AS SELECT * FROM finance_wallet_ledger;
CREATE TABLE finance_wallet_ledger_new (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    movement_type TEXT NOT NULL CHECK (movement_type IN (
      'TOPUP_ONLINE', 'TOPUP_CASH', 'TOPUP_TRANSFER', 'WITHDRAWAL_LOKET', 'REVERSAL',
      'WITHDRAWAL_KOLEKTIF', 'WITHDRAWAL_KOLEKTIF_RETURN')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reference_id TEXT,
    cash_session_id TEXT REFERENCES finance_cash_sessions(id),
    operator_id TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (movement_type NOT IN ('TOPUP_TRANSFER', 'WITHDRAWAL_KOLEKTIF_RETURN') OR direction = 'IN'),
    CHECK (movement_type != 'WITHDRAWAL_KOLEKTIF' OR direction = 'OUT'),
    CHECK (movement_type NOT IN ('WITHDRAWAL_KOLEKTIF', 'WITHDRAWAL_KOLEKTIF_RETURN')
      OR (cash_session_id IS NOT NULL AND reference_id IS NOT NULL AND operator_id IS NOT NULL))
);
DROP TABLE finance_wallet_ledger;
ALTER TABLE finance_wallet_ledger_new RENAME TO finance_wallet_ledger;
INSERT INTO finance_wallet_ledger (
  id, santri_id, direction, movement_type, amount, balance_before, balance_after,
  reference_id, cash_session_id, operator_id, notes, created_at
) SELECT
  id, santri_id, direction, movement_type, amount, balance_before, balance_after,
  reference_id, cash_session_id, operator_id, notes, created_at
FROM finance_wallet_ledger_copy ORDER BY rowid;
INSERT INTO _migration_0198_rowcheck(name, ok) SELECT 'MIGRATION_0198_ROWCOUNT_WALLET', (SELECT COUNT(*) FROM finance_wallet_ledger) = (SELECT COUNT(*) FROM finance_wallet_ledger_copy);
DROP TABLE finance_wallet_ledger_copy;
CREATE INDEX idx_finance_wallet_ledger_created ON finance_wallet_ledger(created_at DESC);
CREATE INDEX idx_finance_wallet_ledger_ref ON finance_wallet_ledger(reference_id);
CREATE INDEX idx_finance_wallet_ledger_santri ON finance_wallet_ledger(santri_id, created_at);
CREATE INDEX idx_finance_wallet_ledger_santri_type ON finance_wallet_ledger(santri_id, movement_type, direction);
CREATE INDEX idx_finance_wallet_ledger_session ON finance_wallet_ledger(cash_session_id);
CREATE INDEX idx_finance_wallet_ledger_session_dir ON finance_wallet_ledger(cash_session_id, direction, movement_type);
-- One payout OUT and at most one return per payout item.
CREATE UNIQUE INDEX uq_finance_wallet_ledger_payout_out ON finance_wallet_ledger(reference_id)
    WHERE movement_type = 'WITHDRAWAL_KOLEKTIF';
CREATE UNIQUE INDEX uq_finance_wallet_ledger_payout_return ON finance_wallet_ledger(reference_id)
    WHERE movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN';
-- One wallet top-up per transfer payment.
CREATE UNIQUE INDEX uq_finance_wallet_ledger_transfer_topup ON finance_wallet_ledger(reference_id)
    WHERE movement_type = 'TOPUP_TRANSFER';

DROP TABLE _migration_0198_rowcheck;

-- ------------------------------------------------------------------
-- 7. Manual transfer submissions, proofs, events, verifier scopes
-- ------------------------------------------------------------------
CREATE TABLE finance_transfer_submissions (
  id TEXT PRIMARY KEY,
  submission_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL UNIQUE REFERENCES finance_payment_orders(id),
  santri_id TEXT NOT NULL REFERENCES santri(id),
  destination_account_id TEXT NOT NULL REFERENCES finance_transfer_accounts(id),
  destination_snapshot TEXT NOT NULL,
  expected_amount INTEGER NOT NULL CHECK (expected_amount > 0),
  unique_code INTEGER NOT NULL CHECK (unique_code > 0),
  cooperative_admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (cooperative_admin_fee >= 0),
  fee_mode TEXT NOT NULL CHECK (fee_mode IN ('ADD', 'DEDUCT')),
  status TEXT NOT NULL DEFAULT 'MENUNGGU_BUKTI' CHECK (status IN (
    'MENUNGGU_BUKTI', 'MENUNGGU_VERIFIKASI', 'PERLU_PERBAIKAN',
    'DITERIMA', 'DITOLAK', 'DIBATALKAN', 'KEDALUWARSA')),
  proof_object_key TEXT,
  proof_hash TEXT,
  sender_name TEXT,
  sender_bank TEXT,
  transferred_at TEXT,
  parent_notes TEXT,
  submitted_at TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_notes TEXT,
  received_amount INTEGER CHECK (received_amount IS NULL OR received_amount > 0),
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('EXACT', 'UNALLOCATED')),
  payment_id TEXT REFERENCES finance_payments(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status NOT IN ('MENUNGGU_VERIFIKASI', 'DITERIMA') OR (proof_object_key IS NOT NULL AND proof_hash IS NOT NULL AND submitted_at IS NOT NULL)),
  CHECK (status != 'DITERIMA' OR (payment_id IS NOT NULL AND reviewed_by IS NOT NULL AND received_amount IS NOT NULL AND resolution IS NOT NULL)),
  CHECK (status NOT IN ('DITOLAK', 'PERLU_PERBAIKAN') OR (reviewed_by IS NOT NULL AND length(trim(COALESCE(review_notes, ''))) >= 5))
);
CREATE INDEX idx_finance_transfer_sub_status ON finance_transfer_submissions(status, submitted_at);
CREATE INDEX idx_finance_transfer_sub_santri ON finance_transfer_submissions(santri_id, created_at);
CREATE UNIQUE INDEX uq_finance_transfer_sub_payment ON finance_transfer_submissions(payment_id) WHERE payment_id IS NOT NULL;

-- Every proof image ever uploaded; the content hash can be used only once.
CREATE TABLE finance_transfer_proofs (
  content_hash TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  submission_id TEXT NOT NULL REFERENCES finance_transfer_submissions(id),
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_finance_transfer_proofs_sub ON finance_transfer_proofs(submission_id);

CREATE TABLE finance_transfer_submission_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES finance_transfer_submissions(id),
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'PROOF_UPLOADED', 'APPROVED', 'APPROVED_UNALLOCATED',
    'REJECTED', 'FIX_REQUESTED', 'CANCELLED', 'EXPIRED', 'REPLACED')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('PARENT', 'STAFF', 'SYSTEM')),
  actor_id TEXT,
  proof_hash TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_finance_transfer_events_sub ON finance_transfer_submission_events(submission_id, created_at);

CREATE TABLE finance_transfer_verifier_scopes (
  user_id TEXT NOT NULL REFERENCES users(id),
  asrama TEXT NOT NULL CHECK (length(trim(asrama)) > 0),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, asrama)
);
CREATE INDEX idx_finance_transfer_scopes_asrama ON finance_transfer_verifier_scopes(asrama);

-- ------------------------------------------------------------------
-- 8. Collective uang jajan payout via representatives
-- ------------------------------------------------------------------
CREATE TABLE finance_wallet_payout_batches (
  id TEXT PRIMARY KEY,
  batch_number TEXT NOT NULL UNIQUE,
  payout_date TEXT NOT NULL,
  cash_session_id TEXT NOT NULL REFERENCES finance_cash_sessions(id),
  operator_id TEXT NOT NULL REFERENCES users(id),
  representative_santri_id TEXT REFERENCES santri(id),
  representative_name TEXT NOT NULL CHECK (length(trim(representative_name)) > 0),
  asrama TEXT NOT NULL,
  scope_label TEXT,
  status TEXT NOT NULL DEFAULT 'DIBAWA' CHECK (status IN ('DIBAWA', 'SELESAI')),
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  total_amount INTEGER NOT NULL CHECK (total_amount > 0),
  total_delivered INTEGER NOT NULL DEFAULT 0 CHECK (total_delivered >= 0),
  total_returned INTEGER NOT NULL DEFAULT 0 CHECK (total_returned >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_by TEXT REFERENCES users(id),
  settled_at TEXT,
  settle_notes TEXT,
  CHECK (status != 'SELESAI' OR (settled_by IS NOT NULL AND settled_at IS NOT NULL
    AND total_delivered + total_returned = total_amount))
);
CREATE INDEX idx_finance_payout_batches_status ON finance_wallet_payout_batches(status, payout_date);
CREATE INDEX idx_finance_payout_batches_session ON finance_wallet_payout_batches(cash_session_id, status);

CREATE TABLE finance_wallet_payout_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES finance_wallet_payout_batches(id),
  santri_id TEXT NOT NULL REFERENCES santri(id),
  payout_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'DIBAWA' CHECK (status IN ('DIBAWA', 'DITERIMA', 'DIBATALKAN')),
  ledger_out_id TEXT NOT NULL UNIQUE REFERENCES finance_wallet_ledger(id),
  ledger_return_id TEXT UNIQUE REFERENCES finance_wallet_ledger(id),
  cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (batch_id, santri_id),
  CHECK (status != 'DIBATALKAN' OR (ledger_return_id IS NOT NULL AND length(trim(COALESCE(cancel_reason, ''))) > 0)),
  CHECK (status = 'DIBATALKAN' OR ledger_return_id IS NULL)
);
CREATE INDEX idx_finance_payout_items_batch ON finance_wallet_payout_items(batch_id, status);
-- A santri can receive at most one live collective payout per WIB day.
CREATE UNIQUE INDEX uq_finance_payout_items_santri_day ON finance_wallet_payout_items(santri_id, payout_date)
    WHERE status IN ('DIBAWA', 'DITERIMA');

-- ------------------------------------------------------------------
-- 9. Recreate existing triggers (unchanged semantics unless noted)
-- ------------------------------------------------------------------
CREATE TRIGGER trg_finance_briva_expiry_guard BEFORE INSERT ON finance_payments
WHEN NEW.channel='BRI' AND NEW.order_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_payment_orders WHERE id=NEW.order_id
  AND julianday(NEW.paid_at) BETWEEN julianday(created_at) AND julianday(expires_at))
  THEN RAISE(ABORT,'BRIVA_GUARD_ABORT: Payment outside order validity') END;
END;

CREATE TRIGGER trg_finance_payments_briva_guard
BEFORE INSERT ON finance_payments
FOR EACH ROW
WHEN NEW.channel = 'BRI' AND NEW.order_id IS NOT NULL
BEGIN
    SELECT CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM finance_payment_orders
            WHERE id = NEW.order_id
              AND status = 'PENDING'
              AND payment_method = 'BRI_VA'
              AND santri_id = NEW.santri_id
              AND total_charged = (NEW.gross_amount + NEW.cooperative_admin_fee)
        )
        THEN RAISE(ABORT, 'BRIVA_GUARD_ABORT: Target payment order is not PENDING, wrong payment method, student mismatch, or total amount mismatch')
        WHEN EXISTS (
            SELECT 1 FROM finance_payments
            WHERE order_id = NEW.order_id
        )
        THEN RAISE(ABORT, 'BRIVA_GUARD_ABORT: Payment already materialized for this order')
    END;
END;

-- Changed: TRANSFER payments may settle too; the statement amount includes the unique code.
CREATE TRIGGER trg_finance_payments_prevent_invalid_settled
BEFORE UPDATE OF status ON finance_payments
FOR EACH ROW
WHEN NEW.status = 'SETTLED'
BEGIN
    SELECT CASE
        WHEN OLD.status != 'PAID'
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Payment can only transition to SETTLED from PAID')
        WHEN NOT EXISTS (
            SELECT 1
            FROM finance_bri_settlement_items si
            JOIN finance_bri_statement_transactions st ON st.id = si.statement_transaction_id
            WHERE si.payment_id = NEW.id
              AND si.match_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
              AND si.currency = 'IDR'
              AND st.currency = 'IDR'
              AND st.type_normalized = 'CREDIT'
              AND (si.gross_amount + si.cooperative_admin_fee) = (NEW.gross_amount + NEW.cooperative_admin_fee)
              AND st.amount = (NEW.gross_amount + NEW.cooperative_admin_fee + NEW.unique_code_amount)
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Payment cannot transition to SETTLED without valid Bank Statement settlement item evidence')
    END;
END;

CREATE TRIGGER trg_finance_orders_prevent_paid_if_not_pending
BEFORE UPDATE OF status ON finance_payment_orders
FOR EACH ROW
WHEN NEW.status = 'PAID' AND OLD.status != 'PENDING'
BEGIN
    SELECT RAISE(ABORT, 'BRIVA_GUARD_ABORT: Cannot transition order to PAID when it is not in PENDING state');
END;

-- Changed: also validates unique_code (the table CHECK enforces the total).
CREATE TRIGGER trg_finance_order_money_guard BEFORE INSERT ON finance_payment_orders BEGIN
 SELECT CASE WHEN typeof(NEW.gross_amount)!='integer' OR NEW.gross_amount<0 OR NEW.gross_amount>9007199254740991
  OR typeof(NEW.cooperative_admin_fee)!='integer' OR NEW.cooperative_admin_fee<0
  OR typeof(NEW.total_charged)!='integer' OR NEW.total_charged>9007199254740991
  OR typeof(NEW.unique_code)!='integer' OR NEW.unique_code<0
  THEN RAISE(ABORT,'INVALID_RUPIAH') END;
END;

-- Changed: the transfer snapshot columns are immutable as well.
CREATE TRIGGER trg_finance_order_snapshot_immutable BEFORE UPDATE OF santri_id,gross_amount,cooperative_admin_fee,
 total_charged,fixed_va_number,cooperative_fee_rule_id,cooperative_fee_snapshot,unique_code,fee_mode,
 destination_account_id,destination_snapshot ON finance_payment_orders
WHEN NEW.santri_id IS NOT OLD.santri_id OR NEW.gross_amount IS NOT OLD.gross_amount
 OR NEW.cooperative_admin_fee IS NOT OLD.cooperative_admin_fee OR NEW.total_charged IS NOT OLD.total_charged
 OR NEW.fixed_va_number IS NOT OLD.fixed_va_number OR NEW.cooperative_fee_rule_id IS NOT OLD.cooperative_fee_rule_id
 OR NEW.cooperative_fee_snapshot IS NOT OLD.cooperative_fee_snapshot OR NEW.unique_code IS NOT OLD.unique_code
 OR NEW.fee_mode IS NOT OLD.fee_mode OR NEW.destination_account_id IS NOT OLD.destination_account_id
 OR NEW.destination_snapshot IS NOT OLD.destination_snapshot
BEGIN SELECT RAISE(ABORT,'ORDER_SNAPSHOT_IMMUTABLE'); END;

CREATE TRIGGER trg_finance_order_terms_immutable BEFORE UPDATE OF expires_at,payment_method,fee_payer,created_at
ON finance_payment_orders
WHEN NEW.expires_at IS NOT OLD.expires_at OR NEW.payment_method IS NOT OLD.payment_method
 OR NEW.fee_payer IS NOT OLD.fee_payer OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'ORDER_SNAPSHOT_IMMUTABLE'); END;

-- Changed: TRANSFER payments may be settled against the bank statement too.
CREATE TRIGGER trg_finance_bri_settlement_items_guard
BEFORE INSERT ON finance_bri_settlement_items
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.match_strength NOT IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: match_strength must be strictly AUTHORITATIVE_EXACT or MANUAL_RESOLVED')
        WHEN NEW.match_strength = 'MANUAL_RESOLVED' AND (
            NEW.reconciliation_item_id IS NULL OR
            NEW.resolved_by IS NULL OR
            NEW.resolved_at IS NULL OR
            NEW.resolution_notes IS NULL
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: MANUAL_RESOLVED settlement requires reconciliation_item_id, resolved_by, resolved_at, and resolution_notes')
        WHEN NEW.currency != 'IDR'
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Currency must strictly be IDR')
        WHEN NOT EXISTS (
            SELECT 1 FROM finance_payments
            WHERE id = NEW.payment_id AND channel IN ('BRI', 'TRANSFER') AND status = 'PAID'
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Target payment must exist with channel BRI/TRANSFER and status PAID')
        WHEN NOT EXISTS (
            SELECT 1 FROM finance_bri_statement_transactions
            WHERE id = NEW.statement_transaction_id
              AND type_normalized = 'CREDIT'
              AND currency = 'IDR'
              AND amount = (NEW.gross_amount + NEW.cooperative_admin_fee
                + COALESCE((SELECT unique_code_amount FROM finance_payments WHERE id = NEW.payment_id), 0))
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Statement transaction must be CREDIT IDR and amount must match total charged amount')
        WHEN NOT EXISTS (
            SELECT 1 FROM finance_bri_settlements s
            JOIN finance_bri_statement_transactions st ON st.id = NEW.statement_transaction_id
            WHERE s.id = NEW.settlement_id
              AND s.account_no = st.account_no
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Settlement batch account_no must match statement transaction account_no')
    END;
END;

CREATE TRIGGER trg_finance_operation_session_guard BEFORE INSERT ON finance_idempotency_keys
WHEN NEW.scope IN ('LOKET_WITHDRAWAL','LOKET_DEPOSIT') BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_cash_sessions WHERE id=NEW.cash_session_id
   AND operator_id=NEW.actor_id AND status='OPEN') THEN RAISE(ABORT,'CASH_SESSION_NOT_OPEN') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM santri WHERE id=NEW.santri_id AND status_global='aktif'
   AND UPPER(TRIM(COALESCE(asrama,'')))!='AL-BAGHORY') THEN RAISE(ABORT,'STUDENT_NOT_BILLABLE') END;
 SELECT CASE WHEN typeof(NEW.amount)!='integer' OR NEW.amount<=0 THEN RAISE(ABORT,'INVALID_RUPIAH') END;
 SELECT CASE WHEN NEW.expected_wallet_balance IS NOT NULL AND NEW.expected_wallet_balance !=
  (SELECT COALESCE(SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0) FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id)
  THEN RAISE(ABORT,'STALE_WALLET_RECEIPT') END;
END;

CREATE TRIGGER trg_finance_wallet_verify_balance
BEFORE INSERT ON finance_wallet_ledger
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN (
            SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
            FROM finance_wallet_ledger
            WHERE santri_id = NEW.santri_id
        ) != NEW.balance_before
        THEN RAISE(ABORT, 'STALE_BALANCE_DETECTED: balance_before tidak sesuai dengan saldo aktual buku besar.')
        WHEN (
            NEW.balance_before + (CASE WHEN NEW.direction = 'IN' THEN NEW.amount ELSE -NEW.amount END)
        ) < 0
        THEN RAISE(ABORT, 'OVERDRAW_DETECTED: Saldo buku besar tidak mencukupi untuk mutasi ini.')
        WHEN NEW.balance_after != (
            NEW.balance_before + (CASE WHEN NEW.direction = 'IN' THEN NEW.amount ELSE -NEW.amount END)
        )
        THEN RAISE(ABORT, 'INVALID_BALANCE_AFTER: balance_after tidak sesuai dengan balance_before dan amount.')
    END;
END;

CREATE TRIGGER trg_finance_wallet_integer_guard BEFORE INSERT ON finance_wallet_ledger BEGIN
 SELECT CASE WHEN typeof(NEW.amount)!='integer' OR NEW.amount<=0 OR NEW.amount>9007199254740991
  OR typeof(NEW.balance_before)!='integer' OR typeof(NEW.balance_after)!='integer'
  OR NEW.balance_after>9007199254740991 THEN RAISE(ABORT,'INVALID_RUPIAH') END;
END;

-- Changed: loket and collective withdrawals share one limit; returned (cancelled)
-- collective payouts give the allowance back.
CREATE TRIGGER trg_finance_wallet_withdrawal_limit BEFORE INSERT ON finance_wallet_ledger
WHEN NEW.movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF') BEGIN
 SELECT CASE WHEN NEW.amount + COALESCE((SELECT SUM(CASE WHEN movement_type='WITHDRAWAL_KOLEKTIF_RETURN' THEN -amount ELSE amount END)
  FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id
  AND movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF','WITHDRAWAL_KOLEKTIF_RETURN')
  AND date(created_at,'+7 hours')=date(NEW.created_at,'+7 hours')),0)
  > MIN(COALESCE((SELECT CAST(value AS INTEGER) FROM app_settings WHERE key='uang_jajan_global_daily_limit'),100000),
     COALESCE((SELECT parent_daily_limit FROM finance_wallet_limits WHERE santri_id=NEW.santri_id),9223372036854775807))
  THEN RAISE(ABORT,'DAILY_LIMIT_EXCEEDED') END;
 SELECT CASE WHEN NEW.amount + COALESCE((SELECT SUM(CASE WHEN movement_type='WITHDRAWAL_KOLEKTIF_RETURN' THEN -amount ELSE amount END)
  FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id
  AND movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF','WITHDRAWAL_KOLEKTIF_RETURN')
  AND strftime('%Y-%W',created_at,'+7 hours')=strftime('%Y-%W',NEW.created_at,'+7 hours')),0)
  > COALESCE((SELECT parent_weekly_limit FROM finance_wallet_limits WHERE santri_id=NEW.santri_id),9223372036854775807)
  THEN RAISE(ABORT,'WEEKLY_LIMIT_EXCEEDED') END;
 SELECT CASE WHEN NEW.amount + COALESCE((SELECT SUM(CASE WHEN movement_type='WITHDRAWAL_KOLEKTIF_RETURN' THEN -amount ELSE amount END)
  FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id
  AND movement_type IN ('WITHDRAWAL_LOKET','WITHDRAWAL_KOLEKTIF','WITHDRAWAL_KOLEKTIF_RETURN')
  AND strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m',NEW.created_at,'+7 hours')),0)
  > COALESCE((SELECT parent_monthly_limit FROM finance_wallet_limits WHERE santri_id=NEW.santri_id),9223372036854775807)
  THEN RAISE(ABORT,'MONTHLY_LIMIT_EXCEEDED') END;
END;

-- BEGIN 0196 billing review triggers (verbatim copy)
CREATE TRIGGER trg_finance_billing_order_review BEFORE INSERT ON finance_order_items
WHEN NEW.obligation_id IS NOT NULL AND EXISTS(
 SELECT 1 FROM finance_obligations o WHERE o.id=NEW.obligation_id AND NOT (NOT ((EXISTS (SELECT 1 FROM (
 SELECT sl.santri_id,'SPP' AS item_type,printf('%04d-%02d',sl.tahun,sl.bulan) AS period,
   sl.nominal_bayar AS amount,0 AS voided,('LEGACY_SPP_LOG:'||sl.id) AS reference
 FROM spp_log sl
 UNION ALL
 SELECT pt.santri_id,CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'USPP' ELSE pt.jenis_biaya END,
   CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'LIFETIME'
     ELSE COALESCE(CAST(pt.tahun_tagihan AS TEXT),substr(ta.nama,1,4)) END,
   pt.nominal_bayar,CASE WHEN pt.status='VOID' THEN 1 ELSE 0 END,
   ('LEGACY_PEMBAYARAN_TAHUNAN:'||pt.id)
 FROM pembayaran_tahunan pt LEFT JOIN tahun_ajaran ta ON ta.id=pt.tahun_ajaran_id
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) be
    WHERE be.santri_id=o.santri_id AND be.item_type=o.item_type
      AND (be.period=o.period OR be.period IS NULL)
      AND (be.period IS NULL OR (be.voided=0 AND (be.amount<=0 OR
        be.amount<>COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)))
        OR (be.voided=1 AND COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)>0)))
    OR EXISTS(SELECT 1 FROM finance_allocations oa JOIN finance_payments op ON op.id=oa.payment_id
      WHERE oa.obligation_id=o.id AND op.source='LEGACY'
        AND oa.amount-COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id=oa.id),0)>0
        AND (op.external_reference LIKE 'LEGACY_SPP_LOG:%' OR op.external_reference LIKE 'LEGACY_PEMBAYARAN_TAHUNAN:%')
        AND NOT EXISTS(SELECT 1 FROM (
 SELECT sl.santri_id,'SPP' AS item_type,printf('%04d-%02d',sl.tahun,sl.bulan) AS period,
   sl.nominal_bayar AS amount,0 AS voided,('LEGACY_SPP_LOG:'||sl.id) AS reference
 FROM spp_log sl
 UNION ALL
 SELECT pt.santri_id,CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'USPP' ELSE pt.jenis_biaya END,
   CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'LIFETIME'
     ELSE COALESCE(CAST(pt.tahun_tagihan AS TEXT),substr(ta.nama,1,4)) END,
   pt.nominal_bayar,CASE WHEN pt.status='VOID' THEN 1 ELSE 0 END,
   ('LEGACY_PEMBAYARAN_TAHUNAN:'||pt.id)
 FROM pembayaran_tahunan pt LEFT JOIN tahun_ajaran ta ON ta.id=pt.tahun_ajaran_id
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) oe WHERE oe.reference=op.external_reference)))) AND NOT (o.item_type='SPP' AND (EXISTS(SELECT 1 FROM santri bs
    WHERE bs.id=o.santri_id AND COALESCE(bs.bebas_spp,0)=1)
    OR EXISTS(SELECT 1 FROM spp_tagihan_ditiadakan td WHERE td.santri_id=o.santri_id
      AND printf('%04d-%02d',td.tahun,td.bulan)=o.period AND td.is_active=1))) AND EXISTS(SELECT 1 FROM santri bstudent WHERE bstudent.id=o.santri_id
    AND (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY'))
    AND (o.item_type NOT IN ('UANG_MAKAN','UANG_NYUCI') OR
      (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY') AND UPPER(TRIM(COALESCE(bstudent.kategori_santri, 'REGULER'))) NOT IN ('SADESA'))))))
BEGIN SELECT RAISE(ABORT,'BILLING_REVIEW_REQUIRED'); END;

CREATE TRIGGER trg_finance_billing_allocation_review BEFORE INSERT ON finance_allocations
WHEN NEW.obligation_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM finance_payments bp WHERE bp.id=NEW.payment_id AND bp.source<>'LEGACY')
 AND EXISTS(SELECT 1 FROM finance_obligations o WHERE o.id=NEW.obligation_id AND NOT (NOT ((EXISTS (SELECT 1 FROM (
 SELECT sl.santri_id,'SPP' AS item_type,printf('%04d-%02d',sl.tahun,sl.bulan) AS period,
   sl.nominal_bayar AS amount,0 AS voided,('LEGACY_SPP_LOG:'||sl.id) AS reference
 FROM spp_log sl
 UNION ALL
 SELECT pt.santri_id,CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'USPP' ELSE pt.jenis_biaya END,
   CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'LIFETIME'
     ELSE COALESCE(CAST(pt.tahun_tagihan AS TEXT),substr(ta.nama,1,4)) END,
   pt.nominal_bayar,CASE WHEN pt.status='VOID' THEN 1 ELSE 0 END,
   ('LEGACY_PEMBAYARAN_TAHUNAN:'||pt.id)
 FROM pembayaran_tahunan pt LEFT JOIN tahun_ajaran ta ON ta.id=pt.tahun_ajaran_id
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) be
    WHERE be.santri_id=o.santri_id AND be.item_type=o.item_type
      AND (be.period=o.period OR be.period IS NULL)
      AND (be.period IS NULL OR (be.voided=0 AND (be.amount<=0 OR
        be.amount<>COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)))
        OR (be.voided=1 AND COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)>0)))
    OR EXISTS(SELECT 1 FROM finance_allocations oa JOIN finance_payments op ON op.id=oa.payment_id
      WHERE oa.obligation_id=o.id AND op.source='LEGACY'
        AND oa.amount-COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id=oa.id),0)>0
        AND (op.external_reference LIKE 'LEGACY_SPP_LOG:%' OR op.external_reference LIKE 'LEGACY_PEMBAYARAN_TAHUNAN:%')
        AND NOT EXISTS(SELECT 1 FROM (
 SELECT sl.santri_id,'SPP' AS item_type,printf('%04d-%02d',sl.tahun,sl.bulan) AS period,
   sl.nominal_bayar AS amount,0 AS voided,('LEGACY_SPP_LOG:'||sl.id) AS reference
 FROM spp_log sl
 UNION ALL
 SELECT pt.santri_id,CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'USPP' ELSE pt.jenis_biaya END,
   CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'LIFETIME'
     ELSE COALESCE(CAST(pt.tahun_tagihan AS TEXT),substr(ta.nama,1,4)) END,
   pt.nominal_bayar,CASE WHEN pt.status='VOID' THEN 1 ELSE 0 END,
   ('LEGACY_PEMBAYARAN_TAHUNAN:'||pt.id)
 FROM pembayaran_tahunan pt LEFT JOIN tahun_ajaran ta ON ta.id=pt.tahun_ajaran_id
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) oe WHERE oe.reference=op.external_reference)))) AND NOT (o.item_type='SPP' AND (EXISTS(SELECT 1 FROM santri bs
    WHERE bs.id=o.santri_id AND COALESCE(bs.bebas_spp,0)=1)
    OR EXISTS(SELECT 1 FROM spp_tagihan_ditiadakan td WHERE td.santri_id=o.santri_id
      AND printf('%04d-%02d',td.tahun,td.bulan)=o.period AND td.is_active=1))) AND EXISTS(SELECT 1 FROM santri bstudent WHERE bstudent.id=o.santri_id
    AND (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY'))
    AND (o.item_type NOT IN ('UANG_MAKAN','UANG_NYUCI') OR
      (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY') AND UPPER(TRIM(COALESCE(bstudent.kategori_santri, 'REGULER'))) NOT IN ('SADESA'))))))
BEGIN SELECT RAISE(ABORT,'BILLING_REVIEW_REQUIRED'); END;
-- END 0196 billing review triggers

-- ------------------------------------------------------------------
-- 10. New guards: manual transfer
-- ------------------------------------------------------------------
-- A transfer payment needs a transfer order (PENDING, or PAID earlier in the same batch)
-- whose proof is under review,
-- the exact snapshot amounts, and no earlier payment for that order.
CREATE TRIGGER trg_finance_payments_transfer_guard BEFORE INSERT ON finance_payments
WHEN NEW.channel = 'TRANSFER' BEGIN
 SELECT CASE
  WHEN NEW.order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_payment_orders o
    JOIN finance_transfer_submissions s ON s.order_id = o.id
    WHERE o.id = NEW.order_id AND o.status IN ('PENDING', 'PAID') AND o.payment_method = 'MANUAL_TRANSFER'
      AND o.santri_id = NEW.santri_id AND o.gross_amount = NEW.gross_amount
      AND o.cooperative_admin_fee = NEW.cooperative_admin_fee AND o.unique_code = NEW.unique_code_amount
      AND s.status = 'MENUNGGU_VERIFIKASI' AND s.submission_number = NEW.external_reference)
  THEN RAISE(ABORT, 'TRANSFER_GUARD_ABORT: order/submission not reviewable or amount mismatch')
  WHEN NEW.order_id IS NOT NULL AND EXISTS (SELECT 1 FROM finance_payments WHERE order_id = NEW.order_id)
  THEN RAISE(ABORT, 'TRANSFER_GUARD_ABORT: Payment already materialized for this order')
  WHEN NEW.order_id IS NULL AND (NEW.allocation_status != 'UNALLOCATED' OR NOT EXISTS (
    SELECT 1 FROM finance_transfer_submissions s WHERE s.submission_number = NEW.external_reference
      AND s.santri_id = NEW.santri_id AND s.status = 'MENUNGGU_VERIFIKASI'))
  THEN RAISE(ABORT, 'TRANSFER_GUARD_ABORT: unallocated transfer needs a reviewable submission')
  WHEN NEW.received_by IS NULL
  THEN RAISE(ABORT, 'TRANSFER_GUARD_ABORT: verifier is required')
 END;
END;

-- Money already sent by the parent must not disappear through expiry/replacement.
CREATE TRIGGER trg_finance_transfer_order_locked_in_review BEFORE UPDATE OF status ON finance_payment_orders
WHEN OLD.payment_method = 'MANUAL_TRANSFER' AND NEW.status IN ('EXPIRED', 'REPLACED', 'CANCELLED')
 AND EXISTS (SELECT 1 FROM finance_transfer_submissions s WHERE s.order_id = OLD.id
   AND s.status IN ('MENUNGGU_VERIFIKASI', 'PERLU_PERBAIKAN'))
BEGIN SELECT RAISE(ABORT, 'TRANSFER_IN_REVIEW: Bukti transfer sedang diperiksa petugas'); END;

CREATE TRIGGER trg_finance_transfer_sub_insert_guard BEFORE INSERT ON finance_transfer_submissions BEGIN
 SELECT CASE WHEN NEW.status != 'MENUNGGU_BUKTI' OR NOT EXISTS (
   SELECT 1 FROM finance_payment_orders o WHERE o.id = NEW.order_id AND o.payment_method = 'MANUAL_TRANSFER'
     AND o.status = 'PENDING' AND o.santri_id = NEW.santri_id AND o.total_charged = NEW.expected_amount
     AND o.unique_code = NEW.unique_code AND o.cooperative_admin_fee = NEW.cooperative_admin_fee
     AND o.fee_mode = NEW.fee_mode AND o.destination_account_id = NEW.destination_account_id
     AND o.destination_snapshot = NEW.destination_snapshot)
 THEN RAISE(ABORT, 'TRANSFER_GUARD_ABORT: submission must mirror its pending order') END;
END;

CREATE TRIGGER trg_finance_transfer_sub_immutable BEFORE UPDATE OF order_id, santri_id, submission_number,
 destination_account_id, destination_snapshot, expected_amount, unique_code, cooperative_admin_fee, fee_mode, created_at
 ON finance_transfer_submissions
BEGIN SELECT RAISE(ABORT, 'TRANSFER_SNAPSHOT_IMMUTABLE'); END;

CREATE TRIGGER trg_finance_transfer_sub_transition BEFORE UPDATE OF status ON finance_transfer_submissions
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status = 'MENUNGGU_BUKTI' AND NEW.status IN ('MENUNGGU_VERIFIKASI', 'DIBATALKAN', 'KEDALUWARSA'))
  OR (OLD.status = 'MENUNGGU_VERIFIKASI' AND NEW.status IN ('DITERIMA', 'DITOLAK', 'PERLU_PERBAIKAN'))
  OR (OLD.status = 'PERLU_PERBAIKAN' AND NEW.status IN ('MENUNGGU_VERIFIKASI', 'DITOLAK'))
)
BEGIN SELECT RAISE(ABORT, 'TRANSFER_INVALID_TRANSITION'); END;

CREATE TRIGGER trg_finance_transfer_sub_terminal BEFORE UPDATE ON finance_transfer_submissions
WHEN OLD.status IN ('DITERIMA', 'DITOLAK', 'DIBATALKAN', 'KEDALUWARSA')
BEGIN SELECT RAISE(ABORT, 'TRANSFER_SUBMISSION_FINAL'); END;

CREATE TRIGGER trg_finance_transfer_sub_accept_guard BEFORE UPDATE OF status ON finance_transfer_submissions
WHEN NEW.status = 'DITERIMA' AND NOT EXISTS (
  SELECT 1 FROM finance_payments p WHERE p.id = NEW.payment_id AND p.channel = 'TRANSFER'
    AND p.santri_id = NEW.santri_id AND p.external_reference = NEW.submission_number
    AND p.gross_amount + p.cooperative_admin_fee + p.unique_code_amount = NEW.received_amount
    AND ((NEW.resolution = 'EXACT' AND p.order_id = NEW.order_id AND NEW.received_amount = NEW.expected_amount)
      OR (NEW.resolution = 'UNALLOCATED' AND p.order_id IS NULL AND p.allocation_status = 'UNALLOCATED')))
BEGIN SELECT RAISE(ABORT, 'TRANSFER_GUARD_ABORT: accepted submission must point at its payment'); END;

CREATE TRIGGER trg_finance_transfer_proof_guard BEFORE INSERT ON finance_transfer_proofs
WHEN NOT EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE id = NEW.submission_id
  AND status IN ('MENUNGGU_BUKTI', 'PERLU_PERBAIKAN'))
BEGIN SELECT RAISE(ABORT, 'TRANSFER_GUARD_ABORT: proof upload not allowed in this state'); END;

CREATE TRIGGER trg_finance_transfer_proofs_append_only BEFORE UPDATE ON finance_transfer_proofs
BEGIN SELECT RAISE(ABORT, 'TRANSFER_PROOF_APPEND_ONLY'); END;
CREATE TRIGGER trg_finance_transfer_proofs_no_delete BEFORE DELETE ON finance_transfer_proofs
BEGIN SELECT RAISE(ABORT, 'TRANSFER_PROOF_APPEND_ONLY'); END;
CREATE TRIGGER trg_finance_transfer_events_append_only BEFORE UPDATE ON finance_transfer_submission_events
BEGIN SELECT RAISE(ABORT, 'TRANSFER_EVENT_APPEND_ONLY'); END;
CREATE TRIGGER trg_finance_transfer_events_no_delete BEFORE DELETE ON finance_transfer_submission_events
BEGIN SELECT RAISE(ABORT, 'TRANSFER_EVENT_APPEND_ONLY'); END;
CREATE TRIGGER trg_finance_transfer_sub_no_delete BEFORE DELETE ON finance_transfer_submissions
BEGIN SELECT RAISE(ABORT, 'TRANSFER_SUBMISSION_NO_DELETE'); END;

-- Wallet top-up from a transfer must reference a TRANSFER payment of the same santri.
CREATE TRIGGER trg_finance_wallet_transfer_topup_guard BEFORE INSERT ON finance_wallet_ledger
WHEN NEW.movement_type = 'TOPUP_TRANSFER' AND NOT EXISTS (
  SELECT 1 FROM finance_payments p WHERE p.id = NEW.reference_id AND p.channel = 'TRANSFER' AND p.santri_id = NEW.santri_id)
BEGIN SELECT RAISE(ABORT, 'TRANSFER_GUARD_ABORT: top-up must reference its transfer payment'); END;

-- ------------------------------------------------------------------
-- 11. New guards: collective payout
-- ------------------------------------------------------------------
CREATE TRIGGER trg_finance_payout_ledger_out_guard BEFORE INSERT ON finance_wallet_ledger
WHEN NEW.movement_type = 'WITHDRAWAL_KOLEKTIF' BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_cash_sessions WHERE id = NEW.cash_session_id
   AND operator_id = NEW.operator_id AND status = 'OPEN') THEN RAISE(ABORT, 'CASH_SESSION_NOT_OPEN') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM santri WHERE id = NEW.santri_id AND status_global = 'aktif'
   AND UPPER(TRIM(COALESCE(asrama, ''))) != 'AL-BAGHORY') THEN RAISE(ABORT, 'STUDENT_NOT_BILLABLE') END;
END;

CREATE TRIGGER trg_finance_payout_ledger_return_guard BEFORE INSERT ON finance_wallet_ledger
WHEN NEW.movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN' BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_wallet_payout_items i
   JOIN finance_wallet_payout_batches b ON b.id = i.batch_id
   WHERE i.id = NEW.reference_id AND i.status = 'DIBAWA' AND b.status = 'DIBAWA'
     AND i.santri_id = NEW.santri_id AND i.amount = NEW.amount)
 THEN RAISE(ABORT, 'PAYOUT_GUARD_ABORT: return must match an outstanding payout item') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_cash_sessions WHERE id = NEW.cash_session_id
   AND operator_id = NEW.operator_id AND status = 'OPEN') THEN RAISE(ABORT, 'CASH_SESSION_NOT_OPEN') END;
END;

CREATE TRIGGER trg_finance_payout_item_insert_guard BEFORE INSERT ON finance_wallet_payout_items
WHEN NEW.status != 'DIBAWA' OR NOT EXISTS (
  SELECT 1 FROM finance_wallet_ledger l JOIN finance_wallet_payout_batches b ON b.id = NEW.batch_id
  WHERE l.id = NEW.ledger_out_id AND l.movement_type = 'WITHDRAWAL_KOLEKTIF' AND l.reference_id = NEW.id
    AND l.santri_id = NEW.santri_id AND l.amount = NEW.amount AND l.cash_session_id = b.cash_session_id
    AND b.status = 'DIBAWA' AND b.payout_date = NEW.payout_date)
BEGIN SELECT RAISE(ABORT, 'PAYOUT_GUARD_ABORT: item must mirror its ledger withdrawal'); END;

CREATE TRIGGER trg_finance_payout_item_immutable BEFORE UPDATE OF batch_id, santri_id, payout_date, amount,
 ledger_out_id, created_at ON finance_wallet_payout_items
BEGIN SELECT RAISE(ABORT, 'PAYOUT_SNAPSHOT_IMMUTABLE'); END;

CREATE TRIGGER trg_finance_payout_item_transition BEFORE UPDATE ON finance_wallet_payout_items BEGIN
 SELECT CASE WHEN OLD.status != 'DIBAWA' THEN RAISE(ABORT, 'PAYOUT_ITEM_FINAL') END;
 SELECT CASE WHEN NEW.status = 'DIBATALKAN' AND NOT EXISTS (SELECT 1 FROM finance_wallet_ledger l
   WHERE l.id = NEW.ledger_return_id AND l.movement_type = 'WITHDRAWAL_KOLEKTIF_RETURN'
     AND l.reference_id = OLD.id AND l.santri_id = OLD.santri_id AND l.amount = OLD.amount)
   THEN RAISE(ABORT, 'PAYOUT_GUARD_ABORT: cancelled item needs its return ledger') END;
END;

CREATE TRIGGER trg_finance_payout_batch_settle_guard BEFORE UPDATE OF status ON finance_wallet_payout_batches
WHEN NEW.status = 'SELESAI' BEGIN
 SELECT CASE WHEN OLD.status != 'DIBAWA' THEN RAISE(ABORT, 'PAYOUT_BATCH_FINAL') END;
 SELECT CASE WHEN EXISTS (SELECT 1 FROM finance_wallet_payout_items WHERE batch_id = OLD.id AND status = 'DIBAWA')
   THEN RAISE(ABORT, 'PAYOUT_GUARD_ABORT: every santri must be marked received or cancelled') END;
 SELECT CASE WHEN NEW.total_delivered != COALESCE((SELECT SUM(amount) FROM finance_wallet_payout_items WHERE batch_id = OLD.id AND status = 'DITERIMA'), 0)
   OR NEW.total_returned != COALESCE((SELECT SUM(amount) FROM finance_wallet_payout_items WHERE batch_id = OLD.id AND status = 'DIBATALKAN'), 0)
   THEN RAISE(ABORT, 'PAYOUT_GUARD_ABORT: batch totals do not match items') END;
END;

CREATE TRIGGER trg_finance_payout_batch_immutable BEFORE UPDATE OF batch_number, payout_date, cash_session_id,
 operator_id, representative_santri_id, representative_name, asrama, item_count, total_amount, created_at
 ON finance_wallet_payout_batches
BEGIN SELECT RAISE(ABORT, 'PAYOUT_SNAPSHOT_IMMUTABLE'); END;

CREATE TRIGGER trg_finance_payout_batch_final BEFORE UPDATE ON finance_wallet_payout_batches
WHEN OLD.status = 'SELESAI' BEGIN SELECT RAISE(ABORT, 'PAYOUT_BATCH_FINAL'); END;

CREATE TRIGGER trg_finance_payout_no_delete_batch BEFORE DELETE ON finance_wallet_payout_batches
BEGIN SELECT RAISE(ABORT, 'PAYOUT_NO_DELETE'); END;
CREATE TRIGGER trg_finance_payout_no_delete_item BEFORE DELETE ON finance_wallet_payout_items
BEGIN SELECT RAISE(ABORT, 'PAYOUT_NO_DELETE'); END;

-- Cash handed to a representative must come back (or be confirmed delivered) before closing.
CREATE TRIGGER trg_finance_cash_session_prevent_close_with_open_payout BEFORE UPDATE OF status ON finance_cash_sessions
WHEN NEW.status = 'CLOSED' AND EXISTS (SELECT 1 FROM finance_wallet_payout_batches
  WHERE cash_session_id = OLD.id AND status = 'DIBAWA')
BEGIN SELECT RAISE(ABORT, 'PAYOUT_BATCH_OPEN: Selesaikan pencairan kolektif sebelum menutup sesi kas'); END;

-- ------------------------------------------------------------------
-- 12. Settings, fee rule seed, navigation
-- ------------------------------------------------------------------
INSERT OR IGNORE INTO app_settings(key, value, updated_at) VALUES
  ('payment_channel_mode', 'TRANSFER', datetime('now')),
  ('transfer_unique_code_max', '999', datetime('now')),
  ('transfer_proof_deadline_hours', '24', datetime('now')),
  ('transfer_fee_deduct_enabled', '1', datetime('now')),
  ('finance_credentials_enabled', '0', datetime('now'));

INSERT OR IGNORE INTO finance_cooperative_admin_fee_rules (
  id, code, name, is_enabled, amount, applies_to_channel, effective_from, created_at
) VALUES ('rule_default_transfer_v1', 'TRANSFER_CHECKOUT_FEE', 'Biaya Admin Koperasi Transfer Manual',
  0, 0, 'TRANSFER', datetime('now'), datetime('now'));

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Keuangan', 'Verifikasi Transfer', '/dashboard/keuangan/verifikasi-transfer', 'ListChecks',
  '["admin","bendahara","admin_koperasi","petugas_koperasi"]', 1, 2)
ON CONFLICT(href) DO UPDATE SET group_name = 'Keuangan', title = 'Verifikasi Transfer', icon = 'ListChecks',
  roles = '["admin","bendahara","admin_koperasi","petugas_koperasi"]', is_active = 1;

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Operasional', 'Pencairan Uang Jajan', '/dashboard/koperasi/pencairan-uang-jajan', 'HandCoins',
  '["admin","bendahara","admin_koperasi","petugas_koperasi"]', 1, 2)
ON CONFLICT(href) DO UPDATE SET group_name = 'Operasional', title = 'Pencairan Uang Jajan', icon = 'HandCoins',
  roles = '["admin","bendahara","admin_koperasi","petugas_koperasi"]', is_active = 1;

-- Kartu santri is no longer used for withdrawals. Keep rows/data; hide the module.
UPDATE fitur_akses SET is_active = 0 WHERE href = '/dashboard/keuangan/kredensial';
