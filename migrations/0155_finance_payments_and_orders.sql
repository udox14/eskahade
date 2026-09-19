-- Migration: 0155_finance_payments_and_orders.sql
-- Fase 3A: Fondasi Skema Pembayaran, Fixed VA & Payment Orders
-- Sistem Keuangan Baru Pesantren

-- 1. Tabel Fixed Virtual Account Permanen Santri
CREATE TABLE IF NOT EXISTS finance_student_va (
    santri_id TEXT PRIMARY KEY REFERENCES santri(id),
    va_number TEXT NOT NULL UNIQUE,
    bank_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_student_va_number
    ON finance_student_va(va_number);

-- 2. Tabel Payment Orders (Pesanan Pembayaran / Checkout)
CREATE TABLE IF NOT EXISTS finance_payment_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    payer_type TEXT NOT NULL CHECK (payer_type IN ('PORTAL_ORTU', 'LOKET')),
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    gateway_fee INTEGER NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    fee_payer TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (fee_payer IN ('CUSTOMER', 'INSTITUTION')),
    total_charged INTEGER NOT NULL CHECK (total_charged >= 0),
    payment_method TEXT CHECK (payment_method IN ('DUITKU_VA', 'DUITKU_QRIS', 'CASH')),
    fixed_va_number TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
    expires_at TEXT NOT NULL,
    cash_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_santri
    ON finance_payment_orders(santri_id, status);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_number
    ON finance_payment_orders(order_number);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_status
    ON finance_payment_orders(status);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_expires
    ON finance_payment_orders(expires_at);

-- 3. Tabel Item Pesanan Pembayaran
CREATE TABLE IF NOT EXISTS finance_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES finance_payment_orders(id),
    obligation_id TEXT REFERENCES finance_obligations(id),
    item_type TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_finance_order_items_order
    ON finance_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_finance_order_items_obligation
    ON finance_order_items(obligation_id);

-- 4. Tabel Transaksi Pembayaran Historis
CREATE TABLE IF NOT EXISTS finance_payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT NOT NULL UNIQUE,
    order_id TEXT REFERENCES finance_payment_orders(id),
    santri_id TEXT NOT NULL REFERENCES santri(id),
    channel TEXT NOT NULL CHECK (channel IN ('DUITKU', 'CASH')),
    method TEXT NOT NULL,
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    gateway_fee INTEGER NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
    status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'SETTLED')),
    correction_status TEXT NOT NULL DEFAULT 'NONE' CHECK (correction_status IN ('NONE', 'PARTIALLY_CORRECTED', 'FULLY_CORRECTED')),
    allocation_status TEXT NOT NULL DEFAULT 'ALLOCATED' CHECK (allocation_status IN ('ALLOCATED', 'PARTIALLY_ALLOCATED', 'UNALLOCATED')),
    paid_at TEXT NOT NULL,
    external_reference TEXT,
    cash_session_id TEXT,
    received_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_payments_santri
    ON finance_payments(santri_id);

CREATE INDEX IF NOT EXISTS idx_finance_payments_order
    ON finance_payments(order_id);

CREATE INDEX IF NOT EXISTS idx_finance_payments_number
    ON finance_payments(payment_number);

CREATE INDEX IF NOT EXISTS idx_finance_payments_ext_ref
    ON finance_payments(external_reference);

CREATE INDEX IF NOT EXISTS idx_finance_payments_status
    ON finance_payments(status);

CREATE INDEX IF NOT EXISTS idx_finance_payments_alloc_status
    ON finance_payments(allocation_status);

-- 5. Tabel Alokasi Pembayaran ke Pos Kewajiban / Uang Jajan
CREATE TABLE IF NOT EXISTS finance_allocations (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL REFERENCES finance_payments(id),
    obligation_id TEXT REFERENCES finance_obligations(id),
    target_type TEXT NOT NULL CHECK (target_type IN ('OBLIGATION', 'UANG_JAJAN')),
    item_type TEXT NOT NULL,
    provider_id TEXT REFERENCES master_jasa(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    disbursed_amount INTEGER NOT NULL DEFAULT 0 CHECK (disbursed_amount >= 0 AND disbursed_amount <= amount),
    distribution_status TEXT NOT NULL DEFAULT 'UNDISBURSED' CHECK (distribution_status IN ('UNDISBURSED', 'PARTIALLY_DISBURSED', 'DISBURSED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_allocations_payment
    ON finance_allocations(payment_id);

CREATE INDEX IF NOT EXISTS idx_finance_allocations_obligation
    ON finance_allocations(obligation_id);

CREATE INDEX IF NOT EXISTS idx_finance_allocations_dist_status
    ON finance_allocations(distribution_status);

-- 6. Tabel Gateway Events (Idempotensi Webhook Callback)
CREATE TABLE IF NOT EXISTS finance_gateway_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'DUITKU',
    event_key TEXT NOT NULL UNIQUE,
    merchant_order_id TEXT,
    signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0, 1)),
    payload_json TEXT NOT NULL,
    processing_status TEXT NOT NULL CHECK (processing_status IN ('PROCESSED', 'IGNORED', 'ERROR')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_gateway_events_order
    ON finance_gateway_events(merchant_order_id);

-- 7. Tabel Item Rekonsiliasi (Termasuk Penampung UNALLOCATED_TRANSFER)
CREATE TABLE IF NOT EXISTS finance_reconciliation_items (
    id TEXT PRIMARY KEY,
    reconciliation_id TEXT,
    payment_id TEXT REFERENCES finance_payments(id),
    settlement_id TEXT,
    cash_session_id TEXT,
    external_reference TEXT,
    internal_amount INTEGER NOT NULL DEFAULT 0,
    external_amount INTEGER NOT NULL DEFAULT 0,
    discrepancy_amount INTEGER NOT NULL DEFAULT 0,
    match_status TEXT NOT NULL CHECK (match_status IN ('MATCHED', 'UNMATCHED_INTERNAL', 'UNMATCHED_EXTERNAL', 'AMOUNT_MISMATCH', 'UNALLOCATED_TRANSFER')),
    resolution_action TEXT NOT NULL DEFAULT 'NONE' CHECK (resolution_action IN ('NONE', 'MANUAL_ALLOCATION', 'REFUND_RECORDED', 'VOID_RECORDED', 'ADJUSTMENT')),
    resolution_notes TEXT,
    resolved_by TEXT REFERENCES users(id),
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_status
    ON finance_reconciliation_items(match_status);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_payment
    ON finance_reconciliation_items(payment_id);
