-- migrations/0184_bri_settlement_and_recovery.sql
-- Fase BRI-4: Payment Recovery, Bank Statement & Settlement Architecture
-- Menambahkan:
-- 1. finance_bri_statement_fetches (Audit riwayat panggilan API Rekening Koran SNAP BI v2.1)
-- 2. finance_bri_statement_transactions (Transaksi rekening koran per baris, immutable, queryable, deduped)
-- 3. finance_bri_settlements (Header batch settlement bank resmi BRI)
-- 4. finance_bri_settlement_items (Tautan 1-to-1 mutlak pembayaran BRI ke transaksi rekening koran)
-- 5. finance_bri_recovery_queue (Queue pemulihan transaksi timeout / missing webhook)
-- 6. finance_bri_reconciliation_sessions (Sesi rekonsiliasi periodik rekening koran vs buku besar internal)
-- 7. Database Triggers untuk perlindungan transisi status PAID -> SETTLED, immutability, dan anti double-settlement

-- ============================================================================
-- 1. RIWAYAT PENGAMBILAN REKENING KORAN (finance_bri_statement_fetches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_bri_statement_fetches (
    id TEXT PRIMARY KEY,
    fetch_reference_no TEXT NOT NULL UNIQUE,
    account_no TEXT NOT NULL,
    from_date_time TEXT NOT NULL,
    to_date_time TEXT NOT NULL,
    total_items_fetched INTEGER NOT NULL DEFAULT 0 CHECK (total_items_fetched >= 0),
    total_credits_count INTEGER NOT NULL DEFAULT 0 CHECK (total_credits_count >= 0),
    total_credits_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_credits_amount >= 0),
    total_debits_count INTEGER NOT NULL DEFAULT 0 CHECK (total_debits_count >= 0),
    total_debits_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_debits_amount >= 0),
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'DISCREPANCY')),
    response_code TEXT,
    response_message TEXT,
    cursor_advanced INTEGER NOT NULL DEFAULT 1 CHECK (cursor_advanced IN (0, 1)),
    body_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_fetches_acc_time
    ON finance_bri_statement_fetches(account_no, from_date_time, to_date_time);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_fetches_status
    ON finance_bri_statement_fetches(status);

-- ============================================================================
-- 2. TRANSAKSI REKENING KORAN BANK STATEMENT (finance_bri_statement_transactions)
-- Dedup key deterministik & identity strength (STRONG vs WEAK)
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_bri_statement_transactions (
    id TEXT PRIMARY KEY,
    fetch_id TEXT NOT NULL REFERENCES finance_bri_statement_fetches(id),
    account_no TEXT NOT NULL,
    transaction_id TEXT,
    identity_strength TEXT NOT NULL DEFAULT 'WEAK' CHECK (identity_strength IN ('STRONG', 'WEAK')),
    dedup_key TEXT NOT NULL,
    weak_fingerprint TEXT,
    transaction_date_raw TEXT NOT NULL,
    transaction_date_utc TEXT,
    type_raw TEXT NOT NULL,
    type_normalized TEXT NOT NULL CHECK (type_normalized IN ('CREDIT', 'DEBIT')),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    amount_raw TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    remark TEXT,
    remark_custom TEXT,
    start_balance_raw TEXT,
    end_balance_raw TEXT,
    bri_trx_id TEXT,
    va_number TEXT,
    observation_count INTEGER NOT NULL DEFAULT 1 CHECK (observation_count >= 1),
    raw_evidence_hash TEXT NOT NULL,
    match_status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK (match_status IN ('UNMATCHED', 'MATCHED', 'AMBIGUOUS', 'IGNORED_DEBIT', 'UNALLOCATED_RECORDED')),
    matched_payment_id TEXT REFERENCES finance_payments(id),
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_account_time
    ON finance_bri_statement_transactions(account_no, transaction_date_raw);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_match_status
    ON finance_bri_statement_transactions(match_status);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_matched_payment
    ON finance_bri_statement_transactions(matched_payment_id);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_va_amount
    ON finance_bri_statement_transactions(va_number, amount);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_tx_id
    ON finance_bri_statement_transactions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_type_normalized
    ON finance_bri_statement_transactions(type_normalized);

-- Unique index ONLY for STRONG identity transactions (hard dedup by accountNo + transactionId)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bri_stmt_tx_strong_dedup
    ON finance_bri_statement_transactions(dedup_key)
    WHERE identity_strength = 'STRONG';

-- Index for WEAK fingerprint overlap lookup / grouping / audit
CREATE INDEX IF NOT EXISTS idx_bri_stmt_tx_weak_fingerprint
    ON finance_bri_statement_transactions(weak_fingerprint);

-- ============================================================================
-- 3. BATCH SETTLEMENT BANK BRI (finance_bri_settlements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_bri_settlements (
    id TEXT PRIMARY KEY,
    settlement_number TEXT NOT NULL UNIQUE,
    account_no TEXT NOT NULL,
    settlement_date TEXT NOT NULL,
    total_payments_count INTEGER NOT NULL CHECK (total_payments_count >= 0),
    total_gross_amount INTEGER NOT NULL CHECK (total_gross_amount >= 0),
    total_cooperative_admin_fee INTEGER NOT NULL CHECK (total_cooperative_admin_fee >= 0),
    total_net_amount INTEGER NOT NULL CHECK (total_net_amount >= 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'DISCREPANCY')),
    notes TEXT,
    verified_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bri_settlements_date
    ON finance_bri_settlements(settlement_date);

CREATE INDEX IF NOT EXISTS idx_bri_settlements_status
    ON finance_bri_settlements(status);

-- ============================================================================
-- 4. ITEM SETTLEMENT PEMBAYARAN ONLINE BRI (finance_bri_settlement_items)
-- Menautkan payment_id dan statement_transaction_id secara 1-to-1 mutlak
-- Provenance DB-enforced: match_strength strictly AUTHORITATIVE_EXACT or MANUAL_RESOLVED
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_bri_settlement_items (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES finance_bri_settlements(id),
    payment_id TEXT NOT NULL UNIQUE REFERENCES finance_payments(id),
    statement_transaction_id TEXT NOT NULL UNIQUE REFERENCES finance_bri_statement_transactions(id),
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    cooperative_admin_fee INTEGER NOT NULL CHECK (cooperative_admin_fee >= 0),
    net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
    match_strength TEXT NOT NULL CHECK (match_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')),
    match_method TEXT NOT NULL,
    reconciliation_item_id TEXT REFERENCES finance_reconciliation_items(id),
    currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
    resolved_by TEXT REFERENCES users(id),
    resolution_notes TEXT,
    resolved_at TEXT,
    settled_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_bri_settlement_items_payment UNIQUE (payment_id),
    CONSTRAINT uq_bri_settlement_items_stmt_tx UNIQUE (statement_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_bri_settlement_items_batch
    ON finance_bri_settlement_items(settlement_id);

CREATE INDEX IF NOT EXISTS idx_bri_settlement_items_payment
    ON finance_bri_settlement_items(payment_id);

CREATE INDEX IF NOT EXISTS idx_bri_settlement_items_stmt_tx
    ON finance_bri_settlement_items(statement_transaction_id);

CREATE INDEX IF NOT EXISTS idx_bri_settlement_items_strength
    ON finance_bri_settlement_items(match_strength);

-- ============================================================================
-- 5. RECOVERY QUEUE UNTUK PEMBAYARAN OUTCOME UNKNOWN (finance_bri_recovery_queue)
-- Menyimpan kasus missing callback / timeout hingga diverifikasi bukti bank
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_bri_recovery_queue (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES finance_payment_orders(id),
    santri_id TEXT NOT NULL REFERENCES santri(id),
    virtual_account_no TEXT NOT NULL,
    payment_request_id TEXT,
    bri_trx_id TEXT,
    expected_amount INTEGER NOT NULL CHECK (expected_amount >= 0),
    recovery_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (recovery_status IN ('OPEN', 'INQUIRY_PENDING', 'BANK_CONFIRMED', 'BANK_NOT_FOUND', 'STATEMENT_MATCHED', 'DISCREPANCY', 'RESOLVED')),
    recovered_payment_id TEXT REFERENCES finance_payments(id),
    statement_transaction_id TEXT REFERENCES finance_bri_statement_transactions(id),
    reason TEXT NOT NULL,
    notes TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_attempt_at TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bri_recovery_status
    ON finance_bri_recovery_queue(recovery_status);

CREATE INDEX IF NOT EXISTS idx_bri_recovery_order
    ON finance_bri_recovery_queue(order_id);

CREATE INDEX IF NOT EXISTS idx_bri_recovery_va
    ON finance_bri_recovery_queue(virtual_account_no);

CREATE INDEX IF NOT EXISTS idx_bri_recovery_trx_id
    ON finance_bri_recovery_queue(bri_trx_id);

-- ============================================================================
-- 6. SESI REKONSILIASI PERIODIK REKENING KORAN (finance_bri_reconciliation_sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_bri_reconciliation_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT NOT NULL UNIQUE,
    period TEXT NOT NULL,
    account_no TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    fetched_count INTEGER NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
    matched_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
    unmatched_count INTEGER NOT NULL DEFAULT 0 CHECK (unmatched_count >= 0),
    ambiguous_count INTEGER NOT NULL DEFAULT 0 CHECK (ambiguous_count >= 0),
    discrepancy_amount INTEGER NOT NULL DEFAULT 0 CHECK (discrepancy_amount >= 0),
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'BALANCED', 'DISCREPANCY_OPEN', 'FAILED', 'RESOLVED')),
    notes TEXT,
    conducted_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bri_rec_sessions_period
    ON finance_bri_reconciliation_sessions(period, account_no);

CREATE INDEX IF NOT EXISTS idx_bri_rec_sessions_status
    ON finance_bri_reconciliation_sessions(status);

-- ============================================================================
-- 7. DATABASE HARD GUARDS UNTUK SETTLEMENT & TRANSISI STATUS
-- ============================================================================

-- Guard 1: Pembayaran hanya boleh beralih ke SETTLED jika status sebelumnya adalah PAID
-- DAN terdapat bukti settlement item valid (AUTHORITATIVE_EXACT atau MANUAL_RESOLVED)
-- yang menunjuk transaksi statement CREDIT IDR dengan nominal cocok
CREATE TRIGGER IF NOT EXISTS trg_finance_payments_prevent_invalid_settled
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
              AND st.amount = (NEW.gross_amount + NEW.cooperative_admin_fee)
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Payment cannot transition to SETTLED without valid Bank Statement settlement item evidence')
    END;
END;

-- Guard 2: Item settlement wajib memvalidasi:
-- 1. match_strength strictly AUTHORITATIVE_EXACT atau MANUAL_RESOLVED (block CANDIDATE/AMBIGUOUS)
-- 2. MANUAL_RESOLVED wajib memiliki reconciliation_item_id, resolved_by, resolved_at, dan resolution_notes
-- 3. Currency strictly IDR
-- 4. Target payment berstatus PAID dan channel BRI
-- 5. Bukti Bank Statement CREDIT IDR yang nominalnya cocok persis
-- 6. Settlement batch account_no cocok dengan statement transaction account_no
CREATE TRIGGER IF NOT EXISTS trg_finance_bri_settlement_items_guard
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
            WHERE id = NEW.payment_id AND channel = 'BRI' AND status = 'PAID'
        )
        THEN RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Target payment must exist with channel BRI and status PAID')

        WHEN NOT EXISTS (
            SELECT 1 FROM finance_bri_statement_transactions
            WHERE id = NEW.statement_transaction_id
              AND type_normalized = 'CREDIT'
              AND currency = 'IDR'
              AND amount = (NEW.gross_amount + NEW.cooperative_admin_fee)
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

-- Guard 3: Transaksi rekening koran tidak boleh dipasangkan ke lebih dari satu pembayaran
CREATE TRIGGER IF NOT EXISTS trg_finance_bri_statement_tx_prevent_double_match
BEFORE UPDATE OF matched_payment_id ON finance_bri_statement_transactions
FOR EACH ROW
WHEN OLD.matched_payment_id IS NOT NULL AND NEW.matched_payment_id != OLD.matched_payment_id
BEGIN
    SELECT RAISE(ABORT, 'SETTLEMENT_GUARD_ABORT: Statement transaction is already matched to another payment');
END;

-- Guard 4: Raw statement financial evidence fields adalah strictly immutable setelah di-insert
CREATE TRIGGER IF NOT EXISTS trg_finance_bri_statement_tx_immutable
BEFORE UPDATE ON finance_bri_statement_transactions
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.account_no != OLD.account_no
          OR (OLD.transaction_id IS NOT NULL AND NEW.transaction_id != OLD.transaction_id)
          OR NEW.transaction_date_raw != OLD.transaction_date_raw
          OR NEW.amount != OLD.amount
          OR NEW.amount_raw != OLD.amount_raw
          OR NEW.currency != OLD.currency
          OR NEW.type_raw != OLD.type_raw
          OR NEW.type_normalized != OLD.type_normalized
          OR (OLD.remark IS NOT NULL AND NEW.remark != OLD.remark)
          OR (OLD.remark_custom IS NOT NULL AND NEW.remark_custom != OLD.remark_custom)
          OR NEW.dedup_key != OLD.dedup_key
          OR (OLD.weak_fingerprint IS NOT NULL AND NEW.weak_fingerprint != OLD.weak_fingerprint)
          OR NEW.raw_evidence_hash != OLD.raw_evidence_hash
        THEN RAISE(ABORT, 'STATEMENT_IMMUTABLE_ABORT: Raw bank statement financial evidence fields are strictly immutable')
    END;
END;

-- Guard 5: Baris transaksi rekening koran tidak boleh dihapus (immutability)
CREATE TRIGGER IF NOT EXISTS trg_finance_bri_statement_tx_prevent_delete
BEFORE DELETE ON finance_bri_statement_transactions
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'STATEMENT_IMMUTABLE_ABORT: Statement transactions cannot be deleted');
END;

-- Guard 6: Settlement items adalah strictly immutable (tidak boleh diupdate)
CREATE TRIGGER IF NOT EXISTS trg_finance_bri_settlement_items_immutable
BEFORE UPDATE ON finance_bri_settlement_items
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'SETTLEMENT_IMMUTABLE_ABORT: Settlement items are strictly immutable');
END;

-- Guard 7: Settlement items tidak boleh dihapus (immutability)
CREATE TRIGGER IF NOT EXISTS trg_finance_bri_settlement_items_prevent_delete
BEFORE DELETE ON finance_bri_settlement_items
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'SETTLEMENT_IMMUTABLE_ABORT: Settlement items cannot be deleted');
END;
