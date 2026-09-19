-- Migration: 0161_finance_loket_and_cash_session.sql
-- Fase 6: Loket Kasir & Sesi Kas (PRD #22 & #23, Implementation Plan #8)
-- Mendaftarkan fitur akses Loket Kasir Koperasi ke tabel fitur_akses,
-- serta memastikan indeks pendukung untuk transaksi loket & sesi kas.

-- 1. Registrasi Menu Loket Kasir Koperasi ke fitur_akses
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Operasional',
    'Loket Kasir',
    '/dashboard/koperasi/loket',
    'CashRegister',
    '["admin","bendahara","admin_koperasi","petugas_koperasi"]',
    1,
    1
);

-- 2. Indeks Pendukung Mutasi Uang Jajan per Sesi Kas & Arah Mutasi
CREATE INDEX IF NOT EXISTS idx_finance_wallet_ledger_session_dir
    ON finance_wallet_ledger(cash_session_id, direction, movement_type);

-- 3. Indeks Pendukung Pembayaran Tunai per Sesi Kas
CREATE INDEX IF NOT EXISTS idx_finance_payments_cash_session_status
    ON finance_payments(cash_session_id, channel, status);
