-- Migration: 0167_finance_legacy_bridge_and_fund_management.sql
-- Legacy Payment Coexistence Bridge & Fund Management Separation
--
-- 1. Menambahkan kolom semantic `source` ('NEW_FINANCE' | 'LEGACY')
--    dan `fund_management` ('PRE_KOPERASI' | 'KOPERASI') pada `finance_payments`.
-- 2. Menyiapkan konfigurasi dinamis cutover Koperasi (`finance_koperasi_effective_at`)
--    pada `app_settings` (default empty/null).
-- 3. Menyiapkan tabel audit `finance_legacy_sync_log` untuk pelacakan backfill/sync.
-- 4. Baseline seeding `finance_tariffs` (SPP, USPP, EHB, EKSKUL, KESEHATAN) agar
--    materialisasi kewajiban canonical berjalan deterministik tanpa error tarif kosong.

-- ============================================================
-- 1. Kolom Sumber & Pengelolaan Dana pada finance_payments
-- ============================================================

ALTER TABLE finance_payments ADD COLUMN source TEXT NOT NULL DEFAULT 'NEW_FINANCE';
ALTER TABLE finance_payments ADD COLUMN fund_management TEXT NOT NULL DEFAULT 'PRE_KOPERASI';

CREATE INDEX IF NOT EXISTS idx_finance_payments_source
    ON finance_payments(source);

CREATE INDEX IF NOT EXISTS idx_finance_payments_fund_management
    ON finance_payments(fund_management);

-- ============================================================
-- 2. Tabel Audit Log Sinkronisasi Modul Lama
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_legacy_sync_log (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL, -- 'SPP_LOG' | 'PEMBAYARAN_TAHUNAN' | 'SPP_TUNGGAKAN_HISTORIS'
    source_id TEXT NOT NULL,
    target_payment_id TEXT REFERENCES finance_payments(id),
    sync_status TEXT NOT NULL, -- 'SUCCESS' | 'FAILED' | 'VOIDED'
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_legacy_sync_log_source
    ON finance_legacy_sync_log(source, source_id);

CREATE INDEX IF NOT EXISTS idx_finance_legacy_sync_log_target
    ON finance_legacy_sync_log(target_payment_id);

-- ============================================================
-- 3. Setting Cutover Koperasi pada app_settings (Default: NULL / Empty)
-- ============================================================

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('finance_koperasi_effective_at', '', datetime('now'));

-- ============================================================
-- 4. Baseline Seeding finance_tariffs (TA 2026/2027 & USPP)
-- ============================================================

-- SPP TA 2026/2027 (ID: 2): Rp 70.000
INSERT OR IGNORE INTO finance_tariffs (
    id, item_type, academic_year_id, nominal, installment_rule,
    effective_from, effective_until, created_by, created_at
) VALUES (
    'trf-spp-2026-default',
    'SPP',
    2,
    70000,
    'DISALLOWED',
    '2026-07-01',
    '2027-06-30',
    NULL,
    datetime('now')
);

-- USPP Global (Lifetime): Rp 1.000.000
INSERT OR IGNORE INTO finance_tariffs (
    id, item_type, academic_year_id, nominal, installment_rule,
    effective_from, effective_until, created_by, created_at
) VALUES (
    'trf-uspp-global-default',
    'USPP',
    NULL,
    1000000,
    'ALLOWED',
    '2020-01-01',
    NULL,
    NULL,
    datetime('now')
);

-- EHB TA 2026/2027 (ID: 2): Rp 100.000
INSERT OR IGNORE INTO finance_tariffs (
    id, item_type, academic_year_id, nominal, installment_rule,
    effective_from, effective_until, created_by, created_at
) VALUES (
    'trf-ehb-2026-default',
    'EHB',
    2,
    100000,
    'DISALLOWED',
    '2026-07-01',
    '2027-06-30',
    NULL,
    datetime('now')
);

-- EKSKUL TA 2026/2027 (ID: 2): Rp 50.000
INSERT OR IGNORE INTO finance_tariffs (
    id, item_type, academic_year_id, nominal, installment_rule,
    effective_from, effective_until, created_by, created_at
) VALUES (
    'trf-ekskul-2026-default',
    'EKSKUL',
    2,
    50000,
    'DISALLOWED',
    '2026-07-01',
    '2027-06-30',
    NULL,
    datetime('now')
);

-- KESEHATAN TA 2026/2027 (ID: 2): Rp 200.000
INSERT OR IGNORE INTO finance_tariffs (
    id, item_type, academic_year_id, nominal, installment_rule,
    effective_from, effective_until, created_by, created_at
) VALUES (
    'trf-kesehatan-2026-default',
    'KESEHATAN',
    2,
    200000,
    'DISALLOWED',
    '2026-07-01',
    '2027-06-30',
    NULL,
    datetime('now')
);
