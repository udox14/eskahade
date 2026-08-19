-- Finance migration 0006b: isi 0006 TANPA `ALTER TABLE ... ADD COLUMN consumed_at`.
--
-- Kapan memakai berkas ini:
--   Jalankan 0006b bila `finance_period_reopen_approvals.consumed_at` SUDAH ada
--   di database target. Menjalankan 0006 penuh di kondisi itu gagal dengan
--   `duplicate column name: consumed_at` dan seluruh migrasi tergulung balik,
--   sehingga tiga blok lainnya pun tidak pernah terpasang.
--
--   Jalankan 0006 penuh hanya bila kolomnya belum ada.
--
-- Cara memastikan kondisi target:
--   npx wrangler d1 execute <BINDING> --remote \
--     --command "SELECT COUNT(*) ada FROM pragma_table_info('finance_period_reopen_approvals') WHERE name='consumed_at'"
--
-- Seluruh pernyataan di bawah aman diulang berapa kali pun: trigger memakai
-- DROP IF EXISTS lebih dulu, dan pengaturan memakai INSERT OR IGNORE.

-- 1. Validasi alokasi-tagihan: tambahkan pemeriksaan kepemilikan santri.
DROP TRIGGER IF EXISTS trg_finance_allocation_bill_validate;
CREATE TRIGGER trg_finance_allocation_bill_validate
BEFORE INSERT ON finance_allocation_bill_items
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_bills WHERE id=NEW.bill_id),'') NOT IN ('OPEN','PARTIAL')
    THEN RAISE(ABORT,'FINANCE_BILL_NOT_OPEN') END;
  SELECT CASE WHEN
    COALESCE((SELECT santri_id FROM finance_bills WHERE id=NEW.bill_id),'')
    <> COALESCE((SELECT santri_id FROM finance_allocations WHERE id=NEW.allocation_id),'')
    THEN RAISE(ABORT,'FINANCE_BILL_OWNER_MISMATCH') END;
  SELECT CASE WHEN NEW.amount_rupiah>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN (SELECT bill_kind FROM finance_bills WHERE id=NEW.bill_id) IN ('SPP','NON_SPP')
    AND NEW.amount_rupiah<>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

-- 2. Terapkan pembayaran tagihan langsung dari trigger. Aplikasi tidak boleh
-- lagi menjalankan UPDATE finance_bills sendiri saat alokasi.
DROP TRIGGER IF EXISTS trg_finance_allocation_bill_apply;
CREATE TRIGGER trg_finance_allocation_bill_apply
AFTER INSERT ON finance_allocation_bill_items
BEGIN
  UPDATE finance_bills
  SET paid_rupiah=paid_rupiah+NEW.amount_rupiah,
      status=CASE WHEN paid_rupiah+NEW.amount_rupiah=amount_rupiah THEN 'PAID' ELSE 'PARTIAL' END,
      updated_at=datetime('now')
  WHERE id=NEW.bill_id;
END;

-- 3. Persetujuan reopen periode harus dikonsumsi sekali pakai. Kolom
-- `consumed_at` diasumsikan sudah ada — lihat catatan di kepala berkas.
DROP TRIGGER IF EXISTS trg_finance_period_reopen_two_approvals;
CREATE TRIGGER trg_finance_period_reopen_two_approvals
BEFORE UPDATE OF status ON finance_periods
WHEN OLD.status='CLOSED' AND NEW.status='OPEN'
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(DISTINCT approver_id) FROM finance_period_reopen_approvals
    WHERE period_key=OLD.period_key AND consumed_at IS NULL
  ) < 2 THEN RAISE(ABORT, 'FINANCE_REOPEN_NEEDS_TWO_APPROVALS') END;
END;

-- 4. Biaya payout API dipindahkan dari konstanta di kode ke pengaturan runtime
-- supaya checker melihat angka yang sama dengan yang dibukukan.
INSERT OR IGNORE INTO finance_settings(key,value) VALUES
('finance_payout_api_fee_rupiah','2500');
