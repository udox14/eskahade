-- Migration: 0173_finance_zero_wallet_balance_cutover.sql
-- Aturan Bisnis & Cutover: Saldo uang jajan modul lama (Keuangan Santri / tabungan_log)
-- TIDAK dimigrasikan ke Sistem Keuangan Baru.
-- Seluruh santri memulai saldo uang jajan dari Rp 0 di sistem baru.
--
-- Karakteristik & Jaminan Keamanan:
-- 1. NON-DESTRUKTIF: Tidak menghapus baris tabel `tabungan_log` modul lama sehingga
--    arsip dan audit trail historis tetap terjaga utuh.
-- 2. AUTHORITATIVE LEDGER INVARIANT: Buku besar `finance_wallet_ledger` adalah sumber kebenaran mutlak.
-- 3. DERIVED CACHE ALIGNMENT: Menyelaraskan kolom proyeksi cepat `santri.saldo_uang_jajan`
--    murni dengan kalkulasi akumulasi `finance_wallet_ledger` (SUM(IN) - SUM(OUT)).
--    Santri yang belum memiliki mutasi baru di sistem keuangan baru akan memiliki saldo Rp 0.
-- 4. IDEMPOTENT: Aman dijalankan berulang kali tanpa risiko inkonsistensi saldo.

UPDATE santri
SET saldo_uang_jajan = COALESCE((
    SELECT SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END)
    FROM finance_wallet_ledger
    WHERE santri_id = santri.id
), 0);
