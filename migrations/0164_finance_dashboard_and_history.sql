-- Migration: 0164_finance_dashboard_and_history.sql
-- Fase 9: Dashboard Keuangan & Riwayat Global (PRD Bab 30 & Bab 33, Implementation Plan #8)
-- Mendaftarkan rute Dashboard Keuangan & Riwayat Transaksi Global ke tabel fitur_akses,
-- serta menambahkan indeks pendukung untuk performa agregasi KPI dan query riwayat transaksi.

-- 1. Registrasi Menu Dashboard Keuangan ke fitur_akses
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Dashboard Keuangan',
    '/dashboard/keuangan',
    'LayoutDashboard',
    '["admin","bendahara","pimpinan"]',
    1,
    0
);

-- 2. Registrasi Menu Riwayat Transaksi Global ke fitur_akses
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Riwayat Transaksi',
    '/dashboard/keuangan/riwayat',
    'Clock',
    '["admin","bendahara","pimpinan"]',
    1,
    5
);

-- 3. Indeks Performa untuk Agregasi KPI & Query Riwayat Global
CREATE INDEX IF NOT EXISTS idx_finance_payments_paid_at 
    ON finance_payments(paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_wallet_ledger_created 
    ON finance_wallet_ledger(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_transferred 
    ON finance_distributions(transferred_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_corrections_created 
    ON finance_corrections(created_at DESC);
