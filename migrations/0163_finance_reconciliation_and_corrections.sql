-- Migration: 0163_finance_reconciliation_and_corrections.sql
-- Fase 8: Rekonsiliasi & Koreksi (Sistem Keuangan Baru Pesantren)
-- PRD Bab 32 & 5.2, Implementation Plan #3.3, #3.5, #3.7 & #8

-- 1. Tabel Header Settlement Bank (finance_settlements)
-- Mencatat berkas pencairan dana payment gateway Duitku ke rekening bank pesantren
CREATE TABLE IF NOT EXISTS finance_settlements (
    id TEXT PRIMARY KEY,
    settlement_number TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'DUITKU',
    settlement_date TEXT NOT NULL,
    destination_bank TEXT NOT NULL,
    destination_account TEXT NOT NULL,
    total_payments_count INTEGER NOT NULL CHECK (total_payments_count >= 0),
    total_gross_amount INTEGER NOT NULL CHECK (total_gross_amount >= 0),
    total_fee_amount INTEGER NOT NULL CHECK (total_fee_amount >= 0),
    total_net_amount INTEGER NOT NULL CHECK (total_net_amount >= 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'DISCREPANCY')),
    notes TEXT,
    verified_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_settlements_date
    ON finance_settlements(settlement_date);

CREATE INDEX IF NOT EXISTS idx_finance_settlements_number
    ON finance_settlements(settlement_number);

CREATE INDEX IF NOT EXISTS idx_finance_settlements_status
    ON finance_settlements(status);

-- 2. Tabel Item Settlement (finance_settlement_items)
-- Menautkan transaksi finance_payments online ke batch settlement bank secara 1-to-1 mutlak
CREATE TABLE IF NOT EXISTS finance_settlement_items (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES finance_settlements(id),
    payment_id TEXT NOT NULL UNIQUE REFERENCES finance_payments(id),
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    gateway_fee INTEGER NOT NULL CHECK (gateway_fee >= 0),
    net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_settlement_items_settlement
    ON finance_settlement_items(settlement_id);

CREATE INDEX IF NOT EXISTS idx_finance_settlement_items_payment
    ON finance_settlement_items(payment_id);

-- 3. Tabel Header Koreksi Finansial (finance_corrections)
-- Mencatat transaksi VOID, REVERSAL, dan REFUND secara non-destruktif
CREATE TABLE IF NOT EXISTS finance_corrections (
    id TEXT PRIMARY KEY,
    correction_number TEXT NOT NULL UNIQUE,
    correction_type TEXT NOT NULL CHECK (correction_type IN ('VOID', 'REVERSAL', 'REFUND')),
    target_payment_id TEXT NOT NULL REFERENCES finance_payments(id),
    total_amount INTEGER NOT NULL CHECK (total_amount > 0),
    method TEXT CHECK (method IN ('CASH', 'TRANSFER', 'GATEWAY')),
    reason TEXT NOT NULL,
    is_recovery_case INTEGER NOT NULL DEFAULT 0 CHECK (is_recovery_case IN (0, 1)),
    recovery_amount INTEGER NOT NULL DEFAULT 0 CHECK (recovery_amount >= 0),
    recovery_status TEXT NOT NULL DEFAULT 'NONE' CHECK (recovery_status IN ('NONE', 'PENDING_RECOVERY', 'RECOVERED')),
    recovery_notes TEXT,
    cash_session_id TEXT REFERENCES finance_cash_sessions(id),
    approved_by TEXT REFERENCES users(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_corrections_payment
    ON finance_corrections(target_payment_id);

CREATE INDEX IF NOT EXISTS idx_finance_corrections_number
    ON finance_corrections(correction_number);

CREATE INDEX IF NOT EXISTS idx_finance_corrections_type
    ON finance_corrections(correction_type);

CREATE INDEX IF NOT EXISTS idx_finance_corrections_recovery
    ON finance_corrections(is_recovery_case, recovery_status);

-- 4. Tabel Item Koreksi (finance_correction_items)
-- Mencatat rincian per alokasi/kewajiban yang dikoreksi (mendukung koreksi parsial)
CREATE TABLE IF NOT EXISTS finance_correction_items (
    id TEXT PRIMARY KEY,
    correction_id TEXT NOT NULL REFERENCES finance_corrections(id),
    target_allocation_id TEXT REFERENCES finance_allocations(id),
    obligation_id TEXT REFERENCES finance_obligations(id),
    target_type TEXT NOT NULL CHECK (target_type IN ('OBLIGATION', 'UANG_JAJAN')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    is_disbursed_portion INTEGER NOT NULL DEFAULT 0 CHECK (is_disbursed_portion IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_correction_items_corr
    ON finance_correction_items(correction_id);

CREATE INDEX IF NOT EXISTS idx_finance_correction_items_alloc
    ON finance_correction_items(target_allocation_id);

CREATE INDEX IF NOT EXISTS idx_finance_correction_items_oblg
    ON finance_correction_items(obligation_id);

-- 5. Tabel Sesi Rekonsiliasi (finance_reconciliations)
CREATE TABLE IF NOT EXISTS finance_reconciliations (
    id TEXT PRIMARY KEY,
    reconciliation_code TEXT NOT NULL UNIQUE,
    period TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('DUITKU', 'CASH')),
    total_matched_count INTEGER NOT NULL DEFAULT 0 CHECK (total_matched_count >= 0),
    total_discrepancy_count INTEGER NOT NULL DEFAULT 0 CHECK (total_discrepancy_count >= 0),
    total_internal_amount INTEGER NOT NULL CHECK (total_internal_amount >= 0),
    total_external_amount INTEGER NOT NULL CHECK (total_external_amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('BALANCED', 'DISCREPANCY_OPEN', 'RESOLVED')),
    notes TEXT,
    conducted_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_code
    ON finance_reconciliations(reconciliation_code);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_period
    ON finance_reconciliations(period, channel);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_status
    ON finance_reconciliations(status);

-- 6. Index Tambahan pada finance_reconciliation_items
CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_rec_id
    ON finance_reconciliation_items(reconciliation_id);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_settlement_id
    ON finance_reconciliation_items(settlement_id);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_cash_session
    ON finance_reconciliation_items(cash_session_id);

-- 7. Trigger Pencegahan Over-Correction pada Level Basis Data
CREATE TRIGGER IF NOT EXISTS trg_finance_correction_items_prevent_over_correct
BEFORE INSERT ON finance_correction_items
FOR EACH ROW
WHEN NEW.target_allocation_id IS NOT NULL
BEGIN
    SELECT
        CASE
            WHEN (
                COALESCE((
                    SELECT SUM(amount)
                    FROM finance_correction_items
                    WHERE target_allocation_id = NEW.target_allocation_id
                ), 0) + NEW.amount
            ) > (
                SELECT amount
                FROM finance_allocations
                WHERE id = NEW.target_allocation_id
            )
            THEN RAISE(ABORT, 'Total nominal koreksi melebihi nominal alokasi yang tersedia pada alokasi ini.')
        END;
END;

-- 8. Registrasi Menu Rekonsiliasi ke fitur_akses
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Rekonsiliasi',
    '/dashboard/keuangan/rekonsiliasi',
    'ArrowLeftRight',
    '["admin","bendahara","pimpinan"]',
    1,
    4
);
