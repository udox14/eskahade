-- Migration: 0165_finance_reports_and_fitur_akses.sql
-- Fase 10: Laporan & Cetak Ekspor (PRD Bab 34 & Implementation Plan #8)
-- Mengaktifkan rute /dashboard/keuangan/laporan pada fitur_akses dengan judul 'Laporan & Ekspor',
-- serta menambahkan indeks pendukung untuk performa agregasi laporan finansial Fase 10.

-- 1. Registrasi & Aktivasi Menu Laporan & Ekspor ke fitur_akses
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Laporan & Ekspor',
    '/dashboard/keuangan/laporan',
    'FileSpreadsheet',
    '["admin","bendahara","pimpinan"]',
    1,
    6
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Laporan & Ekspor',
    icon = 'FileSpreadsheet',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 6;

-- 2. Indeks Performa untuk Agregasi Laporan Finansial
CREATE INDEX IF NOT EXISTS idx_finance_allocations_obligation_amount
    ON finance_allocations(obligation_id, amount);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_santri_period
    ON finance_obligations(santri_id, period, item_type);

CREATE INDEX IF NOT EXISTS idx_finance_exemptions_santri_active
    ON finance_exemptions(santri_id, status, item_type);

CREATE INDEX IF NOT EXISTS idx_finance_wallet_ledger_santri_type
    ON finance_wallet_ledger(santri_id, movement_type, direction);

CREATE INDEX IF NOT EXISTS idx_finance_cash_sessions_opened_at
    ON finance_cash_sessions(opened_at DESC);
