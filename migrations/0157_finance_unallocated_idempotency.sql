-- Migration: 0157_finance_unallocated_idempotency.sql
-- Fase 3A Patch: Idempotensi Pembayaran Tanpa Order (Unallocated Payment)
-- Sistem Keuangan Baru Pesantren

-- 1. Partial Unique Index: Mencegah duplikasi pembayaran untuk channel & external reference yang sama
-- (Tepat satu record payment per referensi eksternal unik gateway, misal transaksi Duitku)
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payments_channel_ext_ref
    ON finance_payments(channel, external_reference)
    WHERE external_reference IS NOT NULL;

-- 2. Index pada external_reference di finance_reconciliation_items untuk pencarian & pencocokan rekonsiliasi
CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_ext_ref
    ON finance_reconciliation_items(external_reference);
