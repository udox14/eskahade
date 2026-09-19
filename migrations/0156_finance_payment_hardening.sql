-- Migration: 0156_finance_payment_hardening.sql
-- Fase 3A Patch: Hardening Idempotensi Pembayaran & Pencegahan Overpayment

-- 1. Partial Unique Index: Tepat satu record payment per payment order
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payments_order_id
    ON finance_payments(order_id)
    WHERE order_id IS NOT NULL;

-- 2. Partial Unique Index: Mencegah duplikasi kewajiban dalam satu order yang sama
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_order_items_order_obligation
    ON finance_order_items(order_id, obligation_id)
    WHERE obligation_id IS NOT NULL;

-- 3. Database Trigger: Mencegah concurrent overpayment pada finance_obligations
CREATE TRIGGER IF NOT EXISTS trg_finance_obligations_no_overpayment_update
BEFORE UPDATE OF amount_paid ON finance_obligations
FOR EACH ROW
WHEN NEW.amount_paid > MAX(0, NEW.amount_expected - NEW.amount_exempted)
BEGIN
  SELECT RAISE(ABORT, 'Pencegahan overpayment: amount_paid tidak boleh melebihi sisa kewajiban (effective outstanding).');
END;
