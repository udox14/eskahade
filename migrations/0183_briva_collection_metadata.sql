-- migrations/0183_briva_collection_metadata.sql
-- Fase BRI-3: BRIVA Collection Inbound Hardening & Reconciliation Metadata
-- Menambahkan:
-- 1. finance_briva_inquiries (Inquiry-Payment correlation evidence)
-- 2. finance_briva_reconciliation_metadata (Durable reconciliation evidence for BRI-4)
-- 3. trg_finance_payments_briva_guard (Atomic compare-and-set database guard against CASH race)
-- 4. trg_finance_orders_prevent_paid_if_not_pending (Prevent invalid state transitions to PAID)

-- 1. Tabel Evidence Korelasi Inquiry ↔ Payment
CREATE TABLE IF NOT EXISTS finance_briva_inquiries (
    id TEXT PRIMARY KEY,
    inquiry_request_id TEXT NOT NULL UNIQUE,
    partner_service_id TEXT NOT NULL,
    customer_no TEXT NOT NULL,
    virtual_account_no TEXT NOT NULL,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    order_id TEXT REFERENCES finance_payment_orders(id),
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_briva_inquiries_req_id
    ON finance_briva_inquiries(inquiry_request_id);

CREATE INDEX IF NOT EXISTS idx_briva_inquiries_order_id
    ON finance_briva_inquiries(order_id);

CREATE INDEX IF NOT EXISTS idx_briva_inquiries_va
    ON finance_briva_inquiries(virtual_account_no);

-- 2. Tabel Metadata Rekonsiliasi Durable untuk BRI-4
CREATE TABLE IF NOT EXISTS finance_briva_reconciliation_metadata (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL REFERENCES finance_payments(id),
    order_id TEXT REFERENCES finance_payment_orders(id),
    virtual_account_no TEXT NOT NULL,
    partner_service_id TEXT NOT NULL,
    customer_no TEXT NOT NULL,
    paid_amount INTEGER NOT NULL CHECK (paid_amount >= 0),
    trx_date_time TEXT,
    payment_request_id TEXT NOT NULL,
    bri_trx_id TEXT,
    reference_no TEXT,
    source_bank_code TEXT,
    channel_code TEXT,
    body_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_briva_rec_meta_payment
    ON finance_briva_reconciliation_metadata(payment_id);

CREATE INDEX IF NOT EXISTS idx_briva_rec_meta_va_amount
    ON finance_briva_reconciliation_metadata(virtual_account_no, paid_amount);

CREATE INDEX IF NOT EXISTS idx_briva_rec_meta_req_id
    ON finance_briva_reconciliation_metadata(payment_request_id);

CREATE INDEX IF NOT EXISTS idx_briva_rec_meta_trx_id
    ON finance_briva_reconciliation_metadata(bri_trx_id);

-- 3. Hard DB Guard: Mencegah Race Pre-Read -> Batch (CASH Mutation Race Guard)
-- Database membuktikan secara atomik bahwa:
-- - order masih PENDING
-- - payment_method masih BRI_VA
-- - order masih milik santri yang sama
-- - payable amount (total_charged) masih exact
-- - belum ada payment BRI yang sudah dimaterialisasi untuk order ini
CREATE TRIGGER IF NOT EXISTS trg_finance_payments_briva_guard
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

-- 4. Hard DB Guard: Mencegah Transisi Order ke PAID jika Status Sebelumnya Bukan PENDING
CREATE TRIGGER IF NOT EXISTS trg_finance_orders_prevent_paid_if_not_pending
BEFORE UPDATE OF status ON finance_payment_orders
FOR EACH ROW
WHEN NEW.status = 'PAID' AND OLD.status != 'PENDING'
BEGIN
    SELECT RAISE(ABORT, 'BRIVA_GUARD_ABORT: Cannot transition order to PAID when it is not in PENDING state');
END;
