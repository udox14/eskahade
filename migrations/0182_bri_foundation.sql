-- Migration: 0182_bri_foundation.sql
-- Fase BRI-1: Target Data Model & Duitku Retirement
-- Sistem Keuangan Baru Pesantren (Integrasi BRI & BRIVA Online)
-- PRD: docs/BRI_INTEGRATION_PRD.md & AGENTS.md

PRAGMA foreign_keys = OFF;

-- ============================================================================
-- 0. PREFLIGHT & DEPENDENCY-SAFE CLEANUP OF DEV/TEST DUITKU DATA
-- Sesuai invariant BRI-0 & PRD: Transaksi Duitku lama BUKAN transaksi BRI,
-- dan fee Duitku lama BUKAN pendapatan administrasi Koperasi.
-- Sistem Keuangan Baru belum memiliki transaksi produksi Duitku.
-- Seluruh data test Duitku dibersihkan secara aman berdasarkan rantai relasi.
-- ============================================================================

-- A. Bersihkan item rekonsiliasi yang mereferensikan payment test Duitku
DELETE FROM finance_reconciliation_items
WHERE payment_id IN (SELECT id FROM finance_payments WHERE channel = 'DUITKU');

-- B. Bersihkan item settlement legacy yang mereferensikan payment test Duitku
DELETE FROM finance_settlement_items
WHERE payment_id IN (SELECT id FROM finance_payments WHERE channel = 'DUITKU');

-- C. Bersihkan alokasi dana yang dihasilkan dari payment test Duitku
DELETE FROM finance_allocations
WHERE payment_id IN (SELECT id FROM finance_payments WHERE channel = 'DUITKU');

-- D. Hapus payment test Duitku
DELETE FROM finance_payments
WHERE channel = 'DUITKU';

-- E. Bersihkan order items dari payment orders test Duitku
DELETE FROM finance_order_items
WHERE order_id IN (
    SELECT id FROM finance_payment_orders
    WHERE payment_method IN ('DUITKU_VA', 'DUITKU_QRIS')
);

-- F. Hapus payment orders test Duitku
DELETE FROM finance_payment_orders
WHERE payment_method IN ('DUITKU_VA', 'DUITKU_QRIS');

-- G. Hapus mapping test virtual account lama (tidak direlabel sebagai BRI)
DELETE FROM finance_student_va;

-- H. Hapus event gateway Duitku lama
DELETE FROM finance_gateway_events
WHERE provider = 'DUITKU';

-- I. Hapus rekonsiliasi channel Duitku test
DELETE FROM finance_reconciliations
WHERE channel = 'DUITKU';


-- ============================================================================
-- 1. FIRST-CLASS DISTRIBUTION RECIPIENTS & RECIPIENT ACCOUNTS
-- Mendukung multi-vendor Katering dan Laundry (mereuse master_jasa)
-- Pesantren sebagai first-class entity (provider_id IS NULL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS finance_distribution_recipients (
    id TEXT PRIMARY KEY,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PESANTREN', 'KATERING', 'LAUNDRY')),
    name TEXT NOT NULL,
    provider_id TEXT REFERENCES master_jasa(id),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    allowed_methods TEXT NOT NULL DEFAULT 'BRI_QLOLA,CASH,MANUAL_TRANSFER',
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mencegah duplikasi mapping untuk satu vendor master_jasa yang sama
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_recipient_provider
    ON finance_distribution_recipients(provider_id)
    WHERE provider_id IS NOT NULL;

-- Memastikan hanya ada 1 penerima level institusi Pesantren
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_recipient_pesantren
    ON finance_distribution_recipients(recipient_type)
    WHERE recipient_type = 'PESANTREN';

CREATE TABLE IF NOT EXISTS finance_recipient_accounts (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES finance_distribution_recipients(id),
    bank_code TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hard Guard: Maksimum satu rekening primer aktif per recipient
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_recipient_single_primary
    ON finance_recipient_accounts(recipient_id)
    WHERE is_primary = 1 AND is_active = 1;

CREATE INDEX IF NOT EXISTS idx_finance_recipient_accounts_recipient
    ON finance_recipient_accounts(recipient_id);

-- Seed penerima Pesantren (Bendahara)
INSERT OR IGNORE INTO finance_distribution_recipients (
    id, recipient_type, name, provider_id, is_active, allowed_methods, created_at, updated_at
) VALUES (
    'rec_pesantren', 'PESANTREN', 'Pesantren Sukahideng (Bendahara)', NULL, 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER',
    datetime('now'), datetime('now')
);

-- Seed seluruh penyedia Katering dari master_jasa
INSERT OR IGNORE INTO finance_distribution_recipients (
    id, recipient_type, name, provider_id, is_active, allowed_methods, created_at, updated_at
)
SELECT
    'rec_' || id,
    'KATERING',
    nama_jasa,
    id,
    1,
    'BRI_QLOLA,CASH,MANUAL_TRANSFER',
    datetime('now'),
    datetime('now')
FROM master_jasa
WHERE jenis = 'Makan';

-- Seed seluruh penyedia Laundry dari master_jasa
INSERT OR IGNORE INTO finance_distribution_recipients (
    id, recipient_type, name, provider_id, is_active, allowed_methods, created_at, updated_at
)
SELECT
    'rec_' || id,
    'LAUNDRY',
    nama_jasa,
    id,
    1,
    'BRI_QLOLA,CASH,MANUAL_TRANSFER',
    datetime('now'),
    datetime('now')
FROM master_jasa
WHERE jenis = 'Cuci';

-- Relational Authoritative Representation: Allowed Methods per Recipient
CREATE TABLE IF NOT EXISTS finance_recipient_allowed_methods (
    recipient_id TEXT NOT NULL REFERENCES finance_distribution_recipients(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('BRI_QLOLA', 'CASH', 'MANUAL_TRANSFER')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (recipient_id, method)
);

CREATE INDEX IF NOT EXISTS idx_finance_rec_allowed_methods_rec
    ON finance_recipient_allowed_methods(recipient_id);

-- Seed allowed methods untuk Pesantren
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
VALUES 
    ('rec_pesantren', 'BRI_QLOLA', datetime('now')),
    ('rec_pesantren', 'CASH', datetime('now')),
    ('rec_pesantren', 'MANUAL_TRANSFER', datetime('now'));

-- Seed allowed methods untuk Katering (BRI_QLOLA, CASH, MANUAL_TRANSFER)
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
SELECT 'rec_' || id, 'BRI_QLOLA', datetime('now') FROM master_jasa WHERE jenis = 'Makan';
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
SELECT 'rec_' || id, 'CASH', datetime('now') FROM master_jasa WHERE jenis = 'Makan';
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
SELECT 'rec_' || id, 'MANUAL_TRANSFER', datetime('now') FROM master_jasa WHERE jenis = 'Makan';

-- Seed allowed methods untuk Laundry (BRI_QLOLA, CASH, MANUAL_TRANSFER)
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
SELECT 'rec_' || id, 'BRI_QLOLA', datetime('now') FROM master_jasa WHERE jenis = 'Cuci';
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
SELECT 'rec_' || id, 'CASH', datetime('now') FROM master_jasa WHERE jenis = 'Cuci';
INSERT OR IGNORE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
SELECT 'rec_' || id, 'MANUAL_TRANSFER', datetime('now') FROM master_jasa WHERE jenis = 'Cuci';

-- Migrasi rekening dari finance_provider_accounts ke finance_recipient_accounts
INSERT OR IGNORE INTO finance_recipient_accounts (
    id, recipient_id, bank_code, account_number, account_holder,
    is_primary, is_active, notes, created_at, updated_at
)
SELECT
    pa.id,
    'rec_' || pa.provider_id,
    pa.bank_name,
    pa.account_number,
    pa.account_holder,
    pa.is_primary,
    1,
    pa.notes,
    pa.created_at,
    pa.updated_at
FROM finance_provider_accounts pa
JOIN finance_distribution_recipients r ON r.id = ('rec_' || pa.provider_id);


-- ============================================================================
-- 2. BIAYA ADMINISTRASI KOPERASI (VERSIONED RULES & APPEND-ONLY INCOME LEDGER)
-- Rules bersifat effective-dated (berlaku menurut rentang tanggal & kanal)
-- Initial state: disabled (is_enabled = 0), amount = 0
-- ============================================================================

CREATE TABLE IF NOT EXISTS finance_cooperative_admin_fee_rules (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    applies_to_channel TEXT NOT NULL DEFAULT 'BRI' CHECK (applies_to_channel IN ('BRI')),
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    closed_by TEXT REFERENCES users(id),
    closed_at TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coop_admin_fee_rules_lookup
    ON finance_cooperative_admin_fee_rules(code, applies_to_channel, is_enabled, effective_from, effective_until);

-- Hard Guard: Mencegah overlapping current rules (maksimum tepat satu open-ended enabled rule per channel & code)
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_admin_fee_single_open_rule
    ON finance_cooperative_admin_fee_rules(applies_to_channel, code)
    WHERE is_enabled = 1 AND effective_until IS NULL;

-- Seed initial version: disabled, nominal 0
INSERT OR IGNORE INTO finance_cooperative_admin_fee_rules (
    id, code, name, is_enabled, amount, applies_to_channel, effective_from, effective_until, created_at
) VALUES (
    'rule_default_online_v1',
    'ONLINE_CHECKOUT_FEE',
    'Biaya Operasional Koperasi Transaksi Online',
    0,
    0,
    'BRI',
    datetime('now'),
    NULL,
    datetime('now')
);

CREATE TABLE IF NOT EXISTS finance_cooperative_income (
    id TEXT PRIMARY KEY,
    income_number TEXT NOT NULL UNIQUE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME', 'REVERSAL', 'REFUND')),
    reference_income_id TEXT REFERENCES finance_cooperative_income(id),
    correction_id TEXT,
    payment_id TEXT NOT NULL REFERENCES finance_payments(id),
    order_id TEXT REFERENCES finance_payment_orders(id),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    rule_id TEXT REFERENCES finance_cooperative_admin_fee_rules(id),
    rule_snapshot TEXT,
    reference_note TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_cooperative_income_payment
    ON finance_cooperative_income(payment_id);

CREATE INDEX IF NOT EXISTS idx_finance_cooperative_income_ref
    ON finance_cooperative_income(reference_income_id);

CREATE INDEX IF NOT EXISTS idx_finance_cooperative_income_order
    ON finance_cooperative_income(order_id);

CREATE INDEX IF NOT EXISTS idx_finance_cooperative_income_type
    ON finance_cooperative_income(entry_type);


-- ============================================================================
-- 3. TABLE REBUILD: finance_student_va (Fixed BRIVA Foundation)
-- Lifecycle lengkap: ACTIVE, INACTIVE, activated_at, deactivated_at
-- Bersih dari data dummy legacy.
-- ============================================================================

CREATE TABLE finance_student_va_new (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL UNIQUE REFERENCES santri(id),
    customer_no TEXT NOT NULL UNIQUE,
    va_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    activated_at TEXT,
    deactivated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

DROP TABLE IF EXISTS finance_student_va;
ALTER TABLE finance_student_va_new RENAME TO finance_student_va;

CREATE INDEX IF NOT EXISTS idx_finance_student_va_number
    ON finance_student_va(va_number);

CREATE INDEX IF NOT EXISTS idx_finance_student_va_customer
    ON finance_student_va(customer_no);


-- ============================================================================
-- 4. TABLE REBUILD: finance_payment_orders (Single Active Online Order)
-- Hanya mempertahankan order CASH yang sah. Data online legacy test telah dibersihkan.
-- Partial unique index menjamin maks 1 order online PENDING per santri.
-- ============================================================================

CREATE TABLE finance_payment_orders_new (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    payer_type TEXT NOT NULL CHECK (payer_type IN ('PORTAL_ORTU', 'LOKET')),
    gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
    cooperative_admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (cooperative_admin_fee >= 0),
    fee_payer TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (fee_payer IN ('CUSTOMER', 'INSTITUTION')),
    total_charged INTEGER NOT NULL CHECK (total_charged >= 0),
    payment_method TEXT CHECK (payment_method IN ('BRI_VA', 'CASH')),
    fixed_va_number TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REPLACED')),
    expires_at TEXT NOT NULL,
    cash_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hanya salin order yang tersisa (non-Duitku, yaitu CASH)
INSERT INTO finance_payment_orders_new (
    id, order_number, santri_id, payer_type, gross_amount,
    cooperative_admin_fee, fee_payer, total_charged, payment_method,
    fixed_va_number, status, expires_at, cash_session_id,
    created_at, updated_at
)
SELECT
    o.id,
    o.order_number,
    o.santri_id,
    o.payer_type,
    o.gross_amount,
    0, -- order CASH tidak memiliki cooperative_admin_fee
    o.fee_payer,
    o.gross_amount,
    'CASH',
    NULL,
    o.status,
    o.expires_at,
    o.cash_session_id,
    o.created_at,
    o.updated_at
FROM finance_payment_orders o
WHERE o.payment_method = 'CASH';

DROP TABLE finance_payment_orders;
ALTER TABLE finance_payment_orders_new RENAME TO finance_payment_orders;

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_santri
    ON finance_payment_orders(santri_id, status);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_number
    ON finance_payment_orders(order_number);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_status
    ON finance_payment_orders(status);

CREATE INDEX IF NOT EXISTS idx_finance_payment_orders_expires
    ON finance_payment_orders(expires_at);

-- Invariant: Maksimum 1 active online order (PENDING & BRI_VA) per santri
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payment_orders_single_active_online
    ON finance_payment_orders(santri_id)
    WHERE status = 'PENDING' AND payment_method = 'BRI_VA';


-- ============================================================================
-- 5. TABLE REBUILD: finance_payments (BRI Channel & Idempotency Metadata)
-- Memisahkan cooperative_admin_fee dan bri_fee_amount.
-- Menyimpan CASH orders tanpa fee palsu.
-- Partial unique index untuk kedua identitas transaksi resmi BRI.
-- ============================================================================

CREATE TABLE finance_payments_new (
    id TEXT PRIMARY KEY,
    payment_number TEXT NOT NULL UNIQUE,
    order_id TEXT REFERENCES finance_payment_orders(id),
    santri_id TEXT NOT NULL REFERENCES santri(id),
    channel TEXT NOT NULL CHECK (channel IN ('BRI', 'CASH')),
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Salin pembayaran CASH yang valid (pembayaran Duitku telah dibersihkan di step 0)
INSERT INTO finance_payments_new (
    id, payment_number, order_id, santri_id, channel, method,
    gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
    status, correction_status, allocation_status, paid_at,
    bri_payment_request_id, bri_trx_id, external_reference, cash_session_id,
    received_by, source, fund_management, created_at
)
SELECT
    p.id,
    p.payment_number,
    p.order_id,
    p.santri_id,
    'CASH',
    'CASH',
    p.gross_amount,
    0,
    NULL,
    p.gross_amount,
    p.status,
    p.correction_status,
    p.allocation_status,
    p.paid_at,
    NULL,
    NULL,
    p.external_reference,
    p.cash_session_id,
    p.received_by,
    COALESCE(p.source, 'NEW_FINANCE'),
    COALESCE(p.fund_management, 'KOPERASI'),
    p.created_at
FROM finance_payments p
WHERE p.channel = 'CASH';

DROP TABLE finance_payments;
ALTER TABLE finance_payments_new RENAME TO finance_payments;

CREATE INDEX IF NOT EXISTS idx_finance_payments_santri
    ON finance_payments(santri_id);

CREATE INDEX IF NOT EXISTS idx_finance_payments_order
    ON finance_payments(order_id);

CREATE INDEX IF NOT EXISTS idx_finance_payments_number
    ON finance_payments(payment_number);

CREATE INDEX IF NOT EXISTS idx_finance_payments_status
    ON finance_payments(status);

CREATE INDEX IF NOT EXISTS idx_finance_payments_alloc_status
    ON finance_payments(allocation_status);

CREATE INDEX IF NOT EXISTS idx_finance_payments_paid_at
    ON finance_payments(paid_at);

-- Idempotency guards resmi BRI (DB-Level Partial Unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payments_bri_payment_req_id
    ON finance_payments(bri_payment_request_id)
    WHERE bri_payment_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payments_bri_trx_id
    ON finance_payments(bri_trx_id)
    WHERE bri_trx_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payments_channel_ext_ref
    ON finance_payments(channel, external_reference)
    WHERE external_reference IS NOT NULL;


-- ============================================================================
-- 6. TABLE REBUILD: finance_gateway_events (No Silent Default & Strict Uniqueness)
-- Event key wajib unik untuk menjamin idempotensi webhook gateway
-- ============================================================================

CREATE TABLE finance_gateway_events_new (
    id TEXT PRIMARY KEY,
    gateway_name TEXT NOT NULL CHECK (gateway_name IN ('BRI', 'BRI_BRIVA', 'BRI_QLOLA')),
    event_key TEXT NOT NULL UNIQUE,
    merchant_order_id TEXT,
    event_type TEXT NOT NULL,
    signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0, 1)),
    payload_json TEXT NOT NULL,
    response_code TEXT,
    is_processed INTEGER NOT NULL DEFAULT 0 CHECK (is_processed IN (0, 1)),
    processing_status TEXT NOT NULL CHECK (processing_status IN ('PENDING', 'PROCESSED', 'IGNORED', 'ERROR')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Salin event non-Duitku yang tersisa (jika ada)
INSERT INTO finance_gateway_events_new (
    id, gateway_name, event_key, merchant_order_id, event_type,
    signature_valid, payload_json, response_code, is_processed, processing_status, created_at
)
SELECT
    id,
    'BRI',
    event_key,
    merchant_order_id,
    'PAYMENT_CALLBACK',
    signature_valid,
    payload_json,
    '200',
    1,
    processing_status,
    created_at
FROM finance_gateway_events
WHERE provider != 'DUITKU';

DROP TABLE finance_gateway_events;
ALTER TABLE finance_gateway_events_new RENAME TO finance_gateway_events;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_gateway_events_key
    ON finance_gateway_events(event_key);

CREATE INDEX IF NOT EXISTS idx_finance_gateway_events_order
    ON finance_gateway_events(merchant_order_id);


-- ============================================================================
-- 7. TABLE REBUILD: finance_reconciliations (Channel Isolation)
-- Hanya mempertahankan rekonsiliasi CASH yang sah
-- ============================================================================

CREATE TABLE finance_reconciliations_new (
    id TEXT PRIMARY KEY,
    reconciliation_code TEXT NOT NULL UNIQUE,
    period TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('BRI', 'CASH')),
    total_matched_count INTEGER NOT NULL DEFAULT 0 CHECK (total_matched_count >= 0),
    total_discrepancy_count INTEGER NOT NULL DEFAULT 0 CHECK (total_discrepancy_count >= 0),
    total_internal_amount INTEGER NOT NULL CHECK (total_internal_amount >= 0),
    total_external_amount INTEGER NOT NULL CHECK (total_external_amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('BALANCED', 'DISCREPANCY_OPEN', 'RESOLVED')),
    notes TEXT,
    conducted_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO finance_reconciliations_new (
    id, reconciliation_code, period, channel,
    total_matched_count, total_discrepancy_count,
    total_internal_amount, total_external_amount,
    status, notes, conducted_by, created_at
)
SELECT
    id,
    reconciliation_code,
    period,
    channel,
    total_matched_count,
    total_discrepancy_count,
    total_internal_amount,
    total_external_amount,
    status,
    notes,
    conducted_by,
    created_at
FROM finance_reconciliations
WHERE channel = 'CASH';

DROP TABLE finance_reconciliations;
ALTER TABLE finance_reconciliations_new RENAME TO finance_reconciliations;

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_code
    ON finance_reconciliations(reconciliation_code);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_period
    ON finance_reconciliations(period, channel);


-- ============================================================================
-- 8. TABLE REBUILD: finance_distributions (Non-STP & Reservation Support)
-- Status: DRAFT -> PENDING_APPROVAL -> PROCESSING -> DISTRIBUTED / REJECTED / CANCELLED
-- ============================================================================

CREATE TABLE finance_distributions_new (
    id TEXT PRIMARY KEY,
    distribution_number TEXT NOT NULL UNIQUE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PESANTREN', 'KATERING', 'LAUNDRY')),
    recipient_id TEXT REFERENCES finance_distribution_recipients(id),
    item_type TEXT NOT NULL,
    period TEXT NOT NULL,
    total_amount INTEGER NOT NULL CHECK (total_amount > 0),
    method TEXT NOT NULL CHECK (method IN ('BRI_QLOLA', 'CASH', 'MANUAL_TRANSFER')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING',
        'DISTRIBUTED', 'FAILED', 'REJECTED', 'CANCELLED'
    )),
    destination_bank TEXT,
    destination_account TEXT,
    account_holder_name TEXT,
    external_reference TEXT,
    proof_attachment_url TEXT,
    submitted_by TEXT REFERENCES users(id),
    submitted_at TEXT,
    transferred_by TEXT REFERENCES users(id),
    transferred_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO finance_distributions_new (
    id, distribution_number, recipient_type, recipient_id,
    item_type, period, total_amount, method, status,
    destination_bank, destination_account, account_holder_name,
    external_reference, proof_attachment_url,
    submitted_by, submitted_at, transferred_by, transferred_at,
    notes, created_at, updated_at
)
SELECT
    d.id,
    d.distribution_number,
    CASE WHEN d.recipient_type = 'BENDAHARA' THEN 'PESANTREN' ELSE d.recipient_type END,
    CASE
        WHEN d.recipient_type = 'BENDAHARA' THEN 'rec_pesantren'
        ELSE 'rec_' || d.recipient_id
    END,
    d.item_type,
    d.period,
    d.total_amount,
    CASE WHEN d.method = 'TRANSFER' THEN 'MANUAL_TRANSFER' ELSE 'CASH' END,
    'DISTRIBUTED',
    d.destination_bank,
    d.destination_account,
    d.account_holder_name,
    NULL,
    d.proof_attachment_url,
    d.transferred_by,
    d.transferred_at,
    d.transferred_by,
    d.transferred_at,
    d.notes,
    d.created_at,
    d.created_at
FROM finance_distributions d;

DROP TABLE finance_distributions;
ALTER TABLE finance_distributions_new RENAME TO finance_distributions;

CREATE INDEX IF NOT EXISTS idx_finance_distributions_recipient
    ON finance_distributions(recipient_type, recipient_id, period);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_item
    ON finance_distributions(item_type, period);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_number
    ON finance_distributions(distribution_number);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_status
    ON finance_distributions(status);


-- ============================================================================
-- 9. TRIGGERS: HARD GUARD RESERVASI & OVER-DISTRIBUTION
-- Reservation active: PENDING_APPROVAL, PROCESSING, CANCEL_PENDING, DISTRIBUTED
-- ============================================================================

DROP TRIGGER IF EXISTS trg_finance_dist_items_prevent_overdraw;
DROP TRIGGER IF EXISTS trg_finance_dist_status_prevent_over_reserve;
DROP TRIGGER IF EXISTS trg_finance_dist_items_immutable_on_update;
DROP TRIGGER IF EXISTS trg_finance_dist_items_immutable_on_delete;
DROP TRIGGER IF EXISTS trg_finance_dist_header_financial_fields_immutable;
DROP TRIGGER IF EXISTS trg_finance_dist_enforce_qlola_insert;
DROP TRIGGER IF EXISTS trg_finance_dist_enforce_qlola_transitions;
DROP TRIGGER IF EXISTS trg_finance_dist_enforce_allowed_method;
DROP TRIGGER IF EXISTS trg_finance_dist_enforce_allowed_method_update;
DROP TRIGGER IF EXISTS trg_finance_correction_items_prevent_over_correct;

-- Trigger A: Hard guard overdraw saat insert item baru pada distribusi reserving
-- Memperhitungkan nominal alokasi efektif (allocation.amount - valid corrections)
CREATE TRIGGER trg_finance_dist_items_prevent_overdraw
BEFORE INSERT ON finance_distribution_items
FOR EACH ROW
WHEN (
    SELECT status FROM finance_distributions WHERE id = NEW.distribution_id
) IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
BEGIN
    SELECT
        CASE
            WHEN (
                COALESCE((
                    SELECT SUM(di.amount)
                    FROM finance_distribution_items di
                    JOIN finance_distributions d ON di.distribution_id = d.id
                    WHERE di.allocation_id = NEW.allocation_id
                      AND d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                ), 0) + NEW.amount
            ) > (
                SELECT fa.amount - COALESCE((
                    SELECT SUM(fci.amount)
                    FROM finance_correction_items fci
                    WHERE fci.target_allocation_id = fa.id
                ), 0)
                FROM finance_allocations fa
                WHERE fa.id = NEW.allocation_id
            )
            THEN RAISE(ABORT, 'Total penyaluran dan reservasi melebihi dana alokasi efektif yang tersedia (setelah memperhitungkan koreksi).')
        END;
END;

-- Trigger B: Hard guard saat transisi status distribusi ke status reserving (mencegah race draft paralel)
-- Menggunakan formula alokasi efektif yang sama
CREATE TRIGGER trg_finance_dist_status_prevent_over_reserve
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN (
    OLD.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
    AND NEW.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
)
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM finance_distribution_items cur_di
                JOIN finance_allocations a ON cur_di.allocation_id = a.id
                WHERE cur_di.distribution_id = NEW.id
                  AND (
                      COALESCE((
                          SELECT SUM(other_di.amount)
                          FROM finance_distribution_items other_di
                          JOIN finance_distributions other_d ON other_di.distribution_id = other_d.id
                          WHERE other_di.allocation_id = cur_di.allocation_id
                            AND other_d.id != NEW.id
                            AND other_d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                      ), 0) + cur_di.amount
                  ) > (
                      a.amount - COALESCE((
                          SELECT SUM(fci.amount)
                          FROM finance_correction_items fci
                          WHERE fci.target_allocation_id = a.id
                      ), 0)
                  )
            )
            THEN RAISE(ABORT, 'Perubahan status gagal: Reservasi dana melebihi sisa alokasi efektif yang tersedia (setelah memperhitungkan koreksi).')
        END;
END;

-- Trigger C: Immutabilitas Item Distribusi pada UPDATE setelah diajukan (hanya boleh diubah saat DRAFT)
CREATE TRIGGER trg_finance_dist_items_immutable_on_update
BEFORE UPDATE ON finance_distribution_items
FOR EACH ROW
WHEN (
    SELECT status FROM finance_distributions WHERE id = OLD.distribution_id
) != 'DRAFT'
BEGIN
    SELECT RAISE(ABORT, 'Item penyaluran bersifat immutable dan tidak boleh diubah setelah pengajuan (hanya boleh diubah saat berstatus DRAFT).');
END;

-- Trigger D: Immutabilitas Item Distribusi pada DELETE setelah diajukan (hanya boleh dihapus saat DRAFT)
CREATE TRIGGER trg_finance_dist_items_immutable_on_delete
BEFORE DELETE ON finance_distribution_items
FOR EACH ROW
WHEN (
    SELECT status FROM finance_distributions WHERE id = OLD.distribution_id
) != 'DRAFT'
BEGIN
    SELECT RAISE(ABORT, 'Item penyaluran bersifat immutable dan tidak boleh dihapus setelah pengajuan (hanya boleh dihapus saat berstatus DRAFT).');
END;

-- Trigger E: Non-STP Guard pada INSERT untuk BRI_QLOLA (hanya boleh diawali DRAFT atau PENDING_APPROVAL)
CREATE TRIGGER trg_finance_dist_enforce_qlola_insert
BEFORE INSERT ON finance_distributions
FOR EACH ROW
WHEN NEW.method = 'BRI_QLOLA' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL')
BEGIN
    SELECT RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP baru wajib berstatus DRAFT atau PENDING_APPROVAL.');
END;

-- Trigger F: Non-STP Guard pada UPDATE untuk BRI_QLOLA (State Machine Lengkap)
CREATE TRIGGER trg_finance_dist_enforce_qlola_transitions
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN NEW.method = 'BRI_QLOLA'
BEGIN
    -- Dari DRAFT: hanya boleh diajukan ke PENDING_APPROVAL atau dibatalkan ke CANCELLED
    SELECT CASE
        WHEN OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
        THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari DRAFT hanya boleh diajukan ke PENDING_APPROVAL atau dibatalkan ke CANCELLED.')
    END;

    -- Dari PENDING_APPROVAL: boleh beralih ke PROCESSING (approval bank), REJECTED, CANCEL_PENDING, atau CANCELLED (sebelum submit bank)
    SELECT CASE
        WHEN OLD.status = 'PENDING_APPROVAL' AND NEW.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'REJECTED', 'CANCEL_PENDING', 'CANCELLED')
        THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari PENDING_APPROVAL hanya boleh beralih ke PROCESSING, REJECTED, CANCEL_PENDING, atau CANCELLED.')
    END;

    -- Dari PROCESSING: boleh beralih ke DISTRIBUTED (sukses), FAILED (gagal terminal), atau CANCEL_PENDING (pembatalan diajukan)
    SELECT CASE
        WHEN OLD.status = 'PROCESSING' AND NEW.status NOT IN ('PROCESSING', 'DISTRIBUTED', 'FAILED', 'CANCEL_PENDING')
        THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari PROCESSING hanya boleh beralih ke DISTRIBUTED, FAILED, atau CANCEL_PENDING.')
    END;

    -- Dari CANCEL_PENDING: boleh beralih ke CANCELLED (konfirmasi pembatalan), DISTRIBUTED (bank tetap eksekusi), FAILED, atau PROCESSING
    SELECT CASE
        WHEN OLD.status = 'CANCEL_PENDING' AND NEW.status NOT IN ('CANCEL_PENDING', 'CANCELLED', 'DISTRIBUTED', 'FAILED', 'PROCESSING')
        THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari CANCEL_PENDING hanya boleh beralih ke CANCELLED, DISTRIBUTED, FAILED, atau PROCESSING.')
    END;

    -- Terminal status bersifat final dan immutable
    SELECT CASE
        WHEN OLD.status IN ('DISTRIBUTED', 'FAILED', 'REJECTED', 'CANCELLED') AND NEW.status != OLD.status
        THEN RAISE(ABORT, 'Penyaluran dengan status terminal bersifat final dan tidak dapat diubah.')
    END;
END;

-- Trigger G: Validasi Allowed Distribution Methods untuk Penerima pada INSERT
CREATE TRIGGER trg_finance_dist_enforce_allowed_method
BEFORE INSERT ON finance_distributions
FOR EACH ROW
WHEN NEW.recipient_id IS NOT NULL
BEGIN
    SELECT
        CASE
            WHEN NOT EXISTS (
                SELECT 1
                FROM finance_recipient_allowed_methods ram
                WHERE ram.recipient_id = NEW.recipient_id
                  AND ram.method = NEW.method
            )
            THEN RAISE(ABORT, 'Metode penyaluran tidak diizinkan untuk penerima ini.')
        END;
END;

-- Trigger H: Validasi Allowed Distribution Methods untuk Penerima pada UPDATE (hanya berlaku saat DRAFT)
CREATE TRIGGER trg_finance_dist_enforce_allowed_method_update
BEFORE UPDATE OF method, recipient_id ON finance_distributions
FOR EACH ROW
WHEN NEW.recipient_id IS NOT NULL AND OLD.status = 'DRAFT'
BEGIN
    SELECT
        CASE
            WHEN NOT EXISTS (
                SELECT 1
                FROM finance_recipient_allowed_methods ram
                WHERE ram.recipient_id = NEW.recipient_id
                  AND ram.method = NEW.method
            )
            THEN RAISE(ABORT, 'Metode penyaluran tidak diizinkan untuk penerima ini.')
        END;
END;

-- Trigger I: Mencegah koreksi jika melebihi alokasi ATAU membuat live bank reservation undercollateralized
-- Alokasi yang sudah DISTRIBUTED tetap BOLEH dikoreksi (menghasilkan recovery case di aplikasi)
CREATE TRIGGER trg_finance_correction_items_prevent_over_correct
BEFORE INSERT ON finance_correction_items
FOR EACH ROW
WHEN NEW.target_allocation_id IS NOT NULL
BEGIN
    -- 1. Total koreksi tidak boleh melebihi total alokasi
    SELECT
        CASE
            WHEN (
                COALESCE((
                    SELECT SUM(fci.amount)
                    FROM finance_correction_items fci
                    WHERE fci.target_allocation_id = NEW.target_allocation_id
                ), 0) + NEW.amount
            ) > (
                SELECT fa.amount FROM finance_allocations fa WHERE fa.id = NEW.target_allocation_id
            )
            THEN RAISE(ABORT, 'Total nominal koreksi melebihi nominal alokasi.')
        END;

    -- 2. Sisa alokasi efektif setelah koreksi tidak boleh lebih kecil dari reservasi bank aktif
    -- Hanya mengecek live reservations: PENDING_APPROVAL, PROCESSING, CANCEL_PENDING (tidak termasuk DISTRIBUTED)
    SELECT
        CASE
            WHEN (
                COALESCE((
                    SELECT SUM(fci.amount)
                    FROM finance_correction_items fci
                    WHERE fci.target_allocation_id = NEW.target_allocation_id
                ), 0) + NEW.amount + COALESCE((
                    SELECT SUM(fdi.amount)
                    FROM finance_distribution_items fdi
                    JOIN finance_distributions fd ON fd.id = fdi.distribution_id
                    WHERE fdi.allocation_id = NEW.target_allocation_id
                      AND fd.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING')
                ), 0)
            ) > (
                SELECT fa.amount FROM finance_allocations fa WHERE fa.id = NEW.target_allocation_id
            )
            THEN RAISE(ABORT, 'Koreksi ditolak: Nominal koreksi membuat reservasi penyaluran bank aktif (PENDING_APPROVAL, PROCESSING, CANCEL_PENDING) melebihi sisa alokasi.')
        END;
END;

-- Trigger J: Freeze identitas finansial header distribusi setelah meninggalkan DRAFT
CREATE TRIGGER trg_finance_dist_header_financial_fields_immutable
BEFORE UPDATE ON finance_distributions
FOR EACH ROW
WHEN OLD.status != 'DRAFT'
BEGIN
    SELECT
        CASE
            WHEN NEW.recipient_type != OLD.recipient_type
              OR NEW.recipient_id IS NOT OLD.recipient_id
              OR NEW.item_type != OLD.item_type
              OR NEW.period != OLD.period
              OR NEW.total_amount != OLD.total_amount
              OR NEW.method != OLD.method
              OR NEW.destination_bank IS NOT OLD.destination_bank
              OR NEW.destination_account IS NOT OLD.destination_account
              OR NEW.account_holder_name IS NOT OLD.account_holder_name
            THEN RAISE(ABORT, 'Field finansial instruksi penyaluran (recipient, rekening, item, periode, nominal, metode) bersifat immutable setelah pengajuan.')
        END;
END;


-- ============================================================================
-- 10. PURGE DUITKU SECRETS & SEED DEFAULT CONFIGS
-- ============================================================================

DELETE FROM app_settings
WHERE key LIKE 'duitku_%'
   OR key IN (
    'gateway_channels_enabled',
    'gateway_default_va_fee',
    'gateway_default_qris_fee_percent'
);

PRAGMA foreign_keys = ON;
