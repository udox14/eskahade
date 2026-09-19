-- Migration: 0158_finance_payment_order_multi_payment.sql
-- Fase 3A Patch: Relaksasi Idempotensi Payment Order (1 Order -> Banyak Transaksi Pembayaran Nyata)
-- Sistem Keuangan Baru Pesantren

-- 1. Hapus partial unique index uq_finance_payments_order_id agar order_id tidak menjadi
-- idempotency key tunggal. Uang nyata dengan external_reference berbeda tidak boleh hilang
-- atau ditolak hanya karena Payment Order sudah pernah dibayar.
DROP INDEX IF EXISTS uq_finance_payments_order_id;

-- 2. Pastikan non-unique index pada order_id tetap aktif untuk lookup performa query order
CREATE INDEX IF NOT EXISTS idx_finance_payments_order
    ON finance_payments(order_id);
